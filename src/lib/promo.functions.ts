import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StoreSchema = z.enum([
  "amazon", "shopee", "aliexpress", "mercadolivre",
  "privacy", "crakrevenue", "awempire",
  "bet365", "betano", "blaze", "kto", "sportingbet",
]);

// ---------- Affiliate accounts CRUD ----------

export const listAffiliateAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("affiliate_accounts")
      .select("id, store, label, credentials, is_active, last_check_at, last_error, last_sync_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { accounts: data ?? [] };
  });

export const upsertAffiliateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      store: StoreSchema,
      label: z.string().min(1).max(80),
      credentials: z.record(z.string(), z.string().max(500)),
      is_active: z.boolean().default(true),
    })
  )
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      store: data.store,
      label: data.label,
      credentials: data.credentials,
      is_active: data.is_active,
    };
    const q = data.id
      ? context.supabase.from("affiliate_accounts").update(payload).eq("id", data.id).select("id").single()
      : context.supabase.from("affiliate_accounts").insert(payload).select("id").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteAffiliateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("affiliate_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testAffiliateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { STORE_CLIENTS } = await import("./promo/registry.server");
    const { data: acc, error } = await context.supabase
      .from("affiliate_accounts")
      .select("store, credentials")
      .eq("id", data.id)
      .single();
    if (error || !acc) throw new Error(error?.message || "Conta não encontrada");
    const client = STORE_CLIENTS[acc.store as keyof typeof STORE_CLIENTS];
    try {
      const offers = await client.fetchOffers(acc.credentials as Record<string, string>, {
        keywords: ["promocao"],
      });
      await context.supabase
        .from("affiliate_accounts")
        .update({ last_check_at: new Date().toISOString(), last_error: null })
        .eq("id", data.id);
      return { ok: true, sampleCount: offers.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await context.supabase
        .from("affiliate_accounts")
        .update({ last_check_at: new Date().toISOString(), last_error: msg })
        .eq("id", data.id);
      return { ok: false, error: msg };
    }
  });

// ---------- Promo bot settings ----------

const PromoSettingsSchema = z.object({
  room_id: z.string().uuid(),
  enabled: z.boolean(),
  interval_hours: z.number().int().min(1).max(168),
  stores: z.array(StoreSchema).min(0).max(12),
  min_discount_pct: z.number().int().min(0).max(100),
  min_price: z.number().nullable(),
  max_price: z.number().nullable(),
  categories: z.array(z.string().max(80)).max(20),
  keywords: z.array(z.string().max(80)).max(20),
  blacklist_keywords: z.array(z.string().max(80)).max(20),
  message_template: z.string().min(1).max(2000),
  parse_mode: z.enum(["HTML", "MarkdownV2"]),
  send_image: z.boolean(),
  premium_account_id: z.string().uuid().nullable(),
  premium_enabled: z.boolean(),
});

export const getPromoBotSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ room_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("promo_bot_settings")
      .select("*")
      .eq("room_id", data.room_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { settings: row };
  });

export const upsertPromoBotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(PromoSettingsSchema)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("promo_bot_settings")
      .upsert(
        { ...data, user_id: context.userId },
        { onConflict: "room_id" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previewPromoOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ room_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { STORE_CLIENTS } = await import("./promo/registry.server");
    const { data: settings } = await context.supabase
      .from("promo_bot_settings").select("*").eq("room_id", data.room_id).maybeSingle();
    if (!settings) return { offers: [] };
    const { data: accs } = await context.supabase
      .from("affiliate_accounts").select("store, credentials").eq("is_active", true);
    const accMap = new Map((accs ?? []).map((a) => [a.store, a.credentials as Record<string, string>]));
    type PreviewItem = { store: string; title?: string; price?: number | null; oldPrice?: number | null; discountPct?: number | null; imageUrl?: string | null; productUrl?: string; error?: string };
    const collected: PreviewItem[] = [];
    const STORES = ["amazon", "shopee", "aliexpress", "mercadolivre"] as const;
    type StoreKey = typeof STORES[number];
    for (const storeRaw of settings.stores as string[]) {
      const store = storeRaw as StoreKey;
      const creds = accMap.get(store);
      if (!creds) continue;
      try {
        const client = STORE_CLIENTS[store];
        const offers = await client.fetchOffers(creds, {
          keywords: settings.keywords ?? [],
          minDiscountPct: settings.min_discount_pct,
          minPrice: settings.min_price ?? undefined,
          maxPrice: settings.max_price ?? undefined,
        });
        collected.push(
          ...offers.slice(0, 5).map((o) => ({
            store: o.store,
            title: o.title,
            price: o.price ?? null,
            oldPrice: o.oldPrice ?? null,
            discountPct: o.discountPct ?? null,
            imageUrl: o.imageUrl ?? null,
            productUrl: o.productUrl,
          }))
        );
      } catch (e) {
        collected.push({ store, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { offers: collected };
  });

export const listPromoDispatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ room_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).default(50) }))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("promo_dispatches")
      .select("id, room_id, store, external_id, affiliate_link, ok, error, sent_at, telegram_message_id")
      .order("sent_at", { ascending: false })
      .limit(data.limit);
    if (data.room_id) q = q.eq("room_id", data.room_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { dispatches: rows ?? [] };
  });

export const getPromoStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ room_id: z.string().uuid().optional(), days: z.number().int().min(1).max(180).default(30) }))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let dispatchQ = context.supabase
      .from("promo_dispatches").select("id, store, room_id, ok", { count: "exact" }).gte("sent_at", since);
    if (data.room_id) dispatchQ = dispatchQ.eq("room_id", data.room_id);
    const { data: dispatches } = await dispatchQ;

    const { data: clicks } = await context.supabase
      .from("promo_clicks").select("dispatch_id, clicked_at").gte("clicked_at", since);

    const { data: conversions } = await context.supabase
      .from("promo_conversions").select("commission_value, sale_value, status, store").gte("created_at", since);

    return {
      sent: dispatches?.length ?? 0,
      clicks: clicks?.length ?? 0,
      conversions: conversions?.length ?? 0,
      commissionTotal: (conversions ?? []).reduce((s, c) => s + Number(c.commission_value || 0), 0),
      saleTotal: (conversions ?? []).reduce((s, c) => s + Number(c.sale_value || 0), 0),
      byStore: groupByStore(dispatches ?? []),
    };
  });

function groupByStore(rows: { store: string }[]) {
  const map: Record<string, number> = {};
  for (const r of rows) map[r.store] = (map[r.store] ?? 0) + 1;
  return map;
}