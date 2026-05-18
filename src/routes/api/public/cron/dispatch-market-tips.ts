import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import {
  fetchMarketTips,
  formatTipMessage,
  linkHash,
  type TipCategory,
} from "@/lib/market-tips.server";

// ╔══════════════════════════════════════════════════════════╗
// ║  CRON: DISPATCH-MARKET-TIPS                              ║
// ║  Dica de mercado (forex/crypto) enviada por sala         ║
// ║  conforme o intervalo configurado, sem repetir links.    ║
// ╚══════════════════════════════════════════════════════════╝

// Cron rodando a cada minuto (pg_cron): seleciona salas com market_tips_enabled
// cujo último disparo foi há >= market_tips_interval_hours, busca uma manchete
// nova (não enviada antes) e despacha para todos os chats vinculados.

type RoomRow = {
  id: string;
  user_id: string;
  default_account_id: string | null;
  market_tips_enabled: boolean;
  market_tips_interval_hours: number | null;
  market_tips_categories: string[] | null;
  market_tips_last_fire_at: string | null;
};

async function processRoom(room: RoomRow) {
  const intervalH = Math.max(1, room.market_tips_interval_hours ?? 6);
  const last = room.market_tips_last_fire_at ? new Date(room.market_tips_last_fire_at).getTime() : 0;
  const now = Date.now();
  if (now - last < intervalH * 3600_000) return { skipped: "interval" };
  if (!room.default_account_id) return { skipped: "no_account" };

  const cats = (room.market_tips_categories ?? ["forex", "crypto"]).filter(
    (c): c is TipCategory => c === "forex" || c === "crypto",
  );
  if (cats.length === 0) return { skipped: "no_categories" };

  const { data: chats } = await supabaseAdmin
    .from("room_chats")
    .select("chat_id")
    .eq("room_id", room.id);
  if (!chats || chats.length === 0) return { skipped: "no_chats" };

  const { data: acc } = await supabaseAdmin
    .from("telegram_accounts")
    .select("bot_token")
    .eq("id", room.default_account_id)
    .maybeSingle();
  if (!acc?.bot_token) return { skipped: "no_bot_token" };

  // Reserva o slot antes de buscar RSS (evita disparos duplicados de cron paralelo).
  const { error: reserveErr } = await supabaseAdmin
    .from("rooms")
    .update({ market_tips_last_fire_at: new Date(now).toISOString() })
    .eq("id", room.id)
    .lte("market_tips_last_fire_at", new Date(now - intervalH * 3600_000).toISOString());
  // Se um cron paralelo já fez o update, não conseguimos (lte falha) — abortamos.
  // Quando last é null, o .lte não bate; então tentamos sem o predicado:
  if (reserveErr) return { error: reserveErr.message };
  if (last === 0) {
    await supabaseAdmin
      .from("rooms")
      .update({ market_tips_last_fire_at: new Date(now).toISOString() })
      .eq("id", room.id)
      .is("market_tips_last_fire_at", null);
  }

  const tips = await fetchMarketTips(cats);
  if (tips.length === 0) return { skipped: "no_tips" };

  // Pega a primeira manchete ainda não enviada nesta sala.
  let chosen: { tip: typeof tips[number]; hash: string } | null = null;
  for (const tip of tips) {
    const hash = await linkHash(tip.link);
    const { data: prev } = await supabaseAdmin
      .from("market_tips_sent")
      .select("id")
      .eq("room_id", room.id)
      .eq("link_hash", hash)
      .maybeSingle();
    if (!prev) {
      chosen = { tip, hash };
      break;
    }
  }
  if (!chosen) return { skipped: "all_seen" };

  const caption = formatTipMessage(chosen.tip);
  let sentCount = 0;
  const errors: string[] = [];
  for (const c of chats) {
    const chatId = c.chat_id;
    let r;
    if (chosen.tip.image) {
      r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
        chat_id: chatId,
        photo: chosen.tip.image,
        caption,
        parse_mode: "HTML",
      });
      if (!r.ok) {
        // fallback: imagem inacessível → manda só texto
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
          chat_id: chatId,
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        });
      }
    } else {
      r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
        chat_id: chatId,
        text: caption,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      });
    }
    if (r.ok) {
      sentCount++;
      await supabaseAdmin.from("message_logs").insert({
        user_id: room.user_id,
        room_id: room.id,
        account_id: room.default_account_id,
        chat_id: chatId,
        ok: true,
        telegram_message_id: r.result?.message_id ?? null,
        source: "market_tips",
      });
    } else {
      errors.push(r.description ?? "erro");
      await supabaseAdmin.from("message_logs").insert({
        user_id: room.user_id,
        room_id: room.id,
        account_id: room.default_account_id,
        chat_id: chatId,
        ok: false,
        error: r.description ?? "erro",
        source: "market_tips",
      });
    }
  }

  if (sentCount > 0) {
    await supabaseAdmin.from("market_tips_sent").insert({
      user_id: room.user_id,
      room_id: room.id,
      link_hash: chosen.hash,
      title: chosen.tip.title,
      link: chosen.tip.link,
    });
  }

  return { sent: sentCount, errors: errors.length, title: chosen.tip.title };
}

export const Route = createFileRoute("/api/public/cron/dispatch-market-tips")({
  server: {
    handlers: {
      POST: async () => {
        const { data: rooms, error } = await supabaseAdmin
          .from("rooms")
          .select(
            "id, user_id, default_account_id, market_tips_enabled, market_tips_interval_hours, market_tips_categories, market_tips_last_fire_at",
          )
          .eq("market_tips_enabled", true)
          .eq("is_active", true);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const results: Record<string, unknown> = {};
        for (const room of (rooms ?? []) as RoomRow[]) {
          try {
            results[room.id] = await processRoom(room);
          } catch (e) {
            results[room.id] = { error: e instanceof Error ? e.message : String(e) };
          }
        }
        return new Response(JSON.stringify({ ok: true, processed: Object.keys(results).length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response("market-tips cron alive"),
    },
  },
});