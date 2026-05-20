import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { STORE_CLIENTS } from "@/lib/promo/registry.server";
import type { AffiliateStore, NormalizedOffer } from "@/lib/promo/types";

// ╔══════════════════════════════════════════════════════════╗
// ║  CRON: DISPATCH-PROMOS                                   ║
// ║  Envia ofertas das lojas configuradas para salas do      ║
// ║  nicho 'promo' conforme intervalo + tracking de cliques. ║
// ╚══════════════════════════════════════════════════════════╝

type Settings = {
  id: string;
  user_id: string;
  room_id: string;
  enabled: boolean;
  interval_hours: number;
  stores: string[];
  min_discount_pct: number;
  min_price: number | null;
  max_price: number | null;
  categories: string[];
  keywords: string[];
  blacklist_keywords: string[];
  message_template: string;
  parse_mode: string;
  send_image: boolean;
  last_fire_at: string | null;
};

function applyTemplate(t: string, o: NormalizedOffer, link: string) {
  const map: Record<string, string> = {
    title: o.title ?? "",
    price: o.price != null ? o.price.toFixed(2) : "",
    old_price: o.oldPrice != null ? o.oldPrice.toFixed(2) : "",
    discount: o.discountPct != null ? String(o.discountPct) : "",
    link,
    store: o.store,
    category: o.category ?? "",
  };
  return t.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? "");
}

function siteOrigin(req: Request) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function processRoom(set: Settings, origin: string) {
  const intervalMs = Math.max(1, set.interval_hours) * 3600_000;
  const last = set.last_fire_at ? new Date(set.last_fire_at).getTime() : 0;
  const now = Date.now();
  if (now - last < intervalMs) return { skipped: "interval" };

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("default_account_id, niche, is_active")
    .eq("id", set.room_id)
    .maybeSingle();
  if (!room || !room.is_active || room.niche !== "promo") return { skipped: "room_inactive" };
  if (!room.default_account_id) return { skipped: "no_account" };

  const { data: chats } = await supabaseAdmin
    .from("room_chats").select("chat_id").eq("room_id", set.room_id);
  if (!chats || chats.length === 0) return { skipped: "no_chats" };

  const { data: acc } = await supabaseAdmin
    .from("telegram_accounts").select("bot_token").eq("id", room.default_account_id).maybeSingle();
  if (!acc?.bot_token) return { skipped: "no_bot_token" };

  // Reserva slot
  await supabaseAdmin.from("promo_bot_settings")
    .update({ last_fire_at: new Date(now).toISOString() })
    .eq("id", set.id);

  // Carrega contas de afiliado do usuário
  const { data: affs } = await supabaseAdmin
    .from("affiliate_accounts")
    .select("store, credentials")
    .eq("user_id", set.user_id)
    .eq("is_active", true);
  const credMap = new Map((affs ?? []).map((a) => [a.store as AffiliateStore, a.credentials as Record<string, string>]));

  // Itera lojas até encontrar uma oferta nova
  let chosen: { offer: NormalizedOffer; affiliateLink: string; store: AffiliateStore } | null = null;
  for (const sRaw of set.stores ?? []) {
    const store = sRaw as AffiliateStore;
    const creds = credMap.get(store);
    if (!creds) continue;
    const client = STORE_CLIENTS[store];
    let offers: NormalizedOffer[] = [];
    try {
      offers = await client.fetchOffers(creds, {
        keywords: set.keywords ?? [],
        categories: set.categories ?? [],
        minDiscountPct: set.min_discount_pct,
        minPrice: set.min_price ?? undefined,
        maxPrice: set.max_price ?? undefined,
        blacklistKeywords: set.blacklist_keywords ?? [],
      });
    } catch {
      continue;
    }
    for (const o of offers) {
      const { data: seen } = await supabaseAdmin
        .from("promo_dispatches")
        .select("id")
        .eq("room_id", set.room_id)
        .eq("store", store)
        .eq("external_id", o.externalId)
        .maybeSingle();
      if (seen) continue;
      // bl
      const blob = `${o.title} ${o.description ?? ""}`.toLowerCase();
      if ((set.blacklist_keywords ?? []).some((k) => k && blob.includes(k.toLowerCase()))) continue;

      const subId = `r${set.room_id.slice(0, 8)}`;
      const affiliateLink = client.buildAffiliateLink(creds, o.productUrl, subId);
      chosen = { offer: o, affiliateLink, store };
      break;
    }
    if (chosen) break;
  }

  if (!chosen) return { skipped: "no_new_offers" };

  // Salva oferta + dispatch com short_url provisório (preencheremos id depois)
  const { data: savedOffer } = await supabaseAdmin
    .from("promo_offers")
    .insert({
      user_id: set.user_id,
      store: chosen.store,
      external_id: chosen.offer.externalId,
      title: chosen.offer.title,
      description: chosen.offer.description ?? null,
      price: chosen.offer.price ?? null,
      old_price: chosen.offer.oldPrice ?? null,
      discount_pct: chosen.offer.discountPct ?? null,
      image_url: chosen.offer.imageUrl ?? null,
      product_url: chosen.offer.productUrl,
      category: chosen.offer.category ?? null,
      raw: chosen.offer.raw as any,
    })
    .select("id")
    .single();

  let sentCount = 0;
  const errors: string[] = [];
  for (const c of chats) {
    // Cria dispatch pré-envio para gerar shortlink
    const { data: disp } = await supabaseAdmin
      .from("promo_dispatches")
      .insert({
        user_id: set.user_id,
        room_id: set.room_id,
        chat_id: c.chat_id,
        store: chosen.store,
        external_id: chosen.offer.externalId,
        affiliate_link: chosen.affiliateLink,
        offer_id: savedOffer?.id ?? null,
        ok: false,
      })
      .select("id")
      .single();

    const shortUrl = disp ? `${origin}/api/public/go/${disp.id}` : chosen.affiliateLink;
    if (disp) {
      await supabaseAdmin.from("promo_dispatches").update({ short_url: shortUrl }).eq("id", disp.id);
    }

    const text = applyTemplate(set.message_template, chosen.offer, shortUrl);
    let r;
    if (set.send_image && chosen.offer.imageUrl) {
      r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
        chat_id: c.chat_id,
        photo: chosen.offer.imageUrl,
        caption: text,
        parse_mode: set.parse_mode || "HTML",
      });
      if (!r.ok) {
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
          chat_id: c.chat_id,
          text,
          parse_mode: set.parse_mode || "HTML",
          disable_web_page_preview: false,
        });
      }
    } else {
      r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
        chat_id: c.chat_id,
        text,
        parse_mode: set.parse_mode || "HTML",
        disable_web_page_preview: false,
      });
    }

    if (disp) {
      await supabaseAdmin
        .from("promo_dispatches")
        .update({
          ok: r.ok,
          telegram_message_id: r.result?.message_id ?? null,
          error: r.ok ? null : r.description ?? "erro",
        })
        .eq("id", disp.id);
    }
    if (r.ok) sentCount++;
    else errors.push(r.description ?? "erro");
  }

  return { sent: sentCount, errors: errors.length, title: chosen.offer.title, store: chosen.store };
}

export const Route = createFileRoute("/api/public/cron/dispatch-promos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = siteOrigin(request);
        const { data: settings, error } = await supabaseAdmin
          .from("promo_bot_settings")
          .select("id, user_id, room_id, enabled, interval_hours, stores, min_discount_pct, min_price, max_price, categories, keywords, blacklist_keywords, message_template, parse_mode, send_image, last_fire_at")
          .eq("enabled", true);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }
        const results: Record<string, unknown> = {};
        for (const s of (settings ?? []) as Settings[]) {
          try { results[s.room_id] = await processRoom(s, origin); }
          catch (e) { results[s.room_id] = { error: e instanceof Error ? e.message : String(e) }; }
        }
        return new Response(JSON.stringify({ ok: true, processed: Object.keys(results).length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("promo dispatch cron alive"),
    },
  },
});