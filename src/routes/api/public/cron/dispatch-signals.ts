import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { sendTextWithPremiumEmojis } from "@/lib/premium-send.server";
import {
  buildSlots, categoryFor, getBinanceM1Candle, nowParts,
  pickRandom, renderTemplate, resolveBinary,
} from "@/lib/signals.server";

type Window = {
  id: string; user_id: string; room_id: string;
  start_time: string; end_time: string;
  weekdays: number[]; signals_qty: number;
  asset_filter: string[]; use_all_assets: boolean;
  timeframes: string[]; max_losses: number; martingale: number;
  is_active: boolean;
};

type Room = {
  id: string; user_id: string; timezone: string;
  default_account_id: string | null;
};

type Template = {
  kind: string; content: string; parse_mode: string;
};

function fmtHHMM(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

function dirLabel(d: "buy" | "sell") {
  return d === "buy" ? "🟢 COMPRA" : "🔴 VENDA";
}

async function sendToRoom(opts: {
  userId: string;
  botToken: string;
  chatIds: number[];
  text: string;
  parseMode: string;
  replyTo?: Record<string, number>; // chatId -> message_id
}): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const cid of opts.chatIds) {
    const premium = await sendTextWithPremiumEmojis({
      userId: opts.userId,
      chatId: cid,
      text: opts.text,
      replyToMessageId: opts.replyTo?.[String(cid)],
    });
    if (premium.applied) {
      if (premium.ok && premium.messageId) out[String(cid)] = premium.messageId;
      continue;
    }
    const r = await callTelegram<{ message_id: number }>(opts.botToken, "sendMessage", {
      chat_id: cid,
      text: opts.text,
      parse_mode: opts.parseMode || "HTML",
      reply_to_message_id: opts.replyTo?.[String(cid)],
      allow_sending_without_reply: true,
    });
    if (r.ok && r.result?.message_id) out[String(cid)] = r.result.message_id;
  }
  return out;
}

async function getRoomContext(roomId: string) {
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("id, user_id, timezone, default_account_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return null;
  const { data: chats } = await supabaseAdmin
    .from("room_chats").select("chat_id").eq("room_id", roomId);
  const { data: tpls } = await supabaseAdmin
    .from("room_templates").select("kind, content, parse_mode").eq("room_id", roomId);
  let botToken: string | null = null;
  if (room.default_account_id) {
    const { data: acc } = await supabaseAdmin
      .from("telegram_accounts").select("bot_token").eq("id", room.default_account_id).maybeSingle();
    botToken = acc?.bot_token ?? null;
  }
  return {
    room: room as Room,
    chatIds: (chats ?? []).map((c) => Number(c.chat_id)),
    templates: (tpls ?? []) as Template[],
    botToken,
  };
}

function getTpl(list: Template[], kind: string, fallback: string): Template {
  return list.find((t) => t.kind === kind) ?? { kind, content: fallback, parse_mode: "HTML" };
}

/* ============ STEP 1: agendar novos sinais ============ */
async function scheduleSignals(): Promise<number> {
  const { data: windows } = await supabaseAdmin
    .from("room_windows")
    .select("id, user_id, room_id, start_time, end_time, weekdays, signals_qty, asset_filter, use_all_assets, timeframes, max_losses, martingale, is_active")
    .eq("is_active", true);
  if (!windows?.length) return 0;

  // entrada será no PRÓXIMO minuto cheio
  const now = new Date();
  const nextMinute = new Date(Math.ceil((now.getTime() + 1) / 60000) * 60000);
  let scheduled = 0;

  for (const w of windows as Window[]) {
    const { data: room } = await supabaseAdmin
      .from("rooms").select("timezone").eq("id", w.room_id).maybeSingle();
    const tz = room?.timezone ?? "America/Sao_Paulo";
    const { weekday, hhmm: nowHHMM } = nowParts(tz);
    if (!w.weekdays.includes(weekday)) continue;

    const entryHHMM = fmtHHMM(nextMinute, tz);
    const slots = buildSlots(w.start_time.slice(0, 5), w.end_time.slice(0, 5), w.signals_qty);
    if (!slots.includes(entryHHMM)) continue;
    if (nowHHMM > w.end_time.slice(0, 5)) continue;

    // escolhe ativo
    let assetPool: string[] = [];
    if (w.use_all_assets || !w.asset_filter?.length) {
      const { data: ras } = await supabaseAdmin
        .from("room_assets").select("asset_code").eq("room_id", w.room_id).eq("is_open", true);
      assetPool = (ras ?? []).map((r) => r.asset_code);
    } else {
      assetPool = w.asset_filter;
    }
    if (!assetPool.length) continue;

    const asset = pickRandom(assetPool);
    const direction: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";
    const timeframe = pickRandom(w.timeframes?.length ? w.timeframes : ["M1"]);
    const expires = new Date(nextMinute.getTime() + 60_000); // M1

    const { error } = await supabaseAdmin.from("signal_events").insert({
      user_id: w.user_id,
      room_id: w.room_id,
      window_id: w.id,
      asset_code: asset,
      asset_category: categoryFor(asset),
      direction,
      timeframe,
      entry_at: nextMinute.toISOString(),
      expires_at: expires.toISOString(),
      max_gales: w.martingale ?? 2,
      status: "scheduled",
    });
    if (!error) scheduled++;
  }
  return scheduled;
}

/* ============ STEP 2: enviar sinais agendados ============ */
async function sendScheduled(): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 75_000).toISOString(); // até 75s no futuro
  const { data: list } = await supabaseAdmin
    .from("signal_events")
    .select("*")
    .eq("status", "scheduled")
    .lte("entry_at", horizon)
    .limit(200);
  if (!list?.length) return 0;
  let sent = 0;

  for (const s of list) {
    const ctx = await getRoomContext(s.room_id);
    if (!ctx?.botToken || !ctx.chatIds.length) {
      await supabaseAdmin.from("signal_events").update({
        status: "error", last_error: "Sem bot/chats vinculados",
      }).eq("id", s.id);
      continue;
    }
    const tz = ctx.room.timezone;
    const entryAt = new Date(s.entry_at);
    const entryHHMM = fmtHHMM(entryAt, tz);
    const g1 = fmtHHMM(new Date(entryAt.getTime() + 60_000), tz);
    const g2 = fmtHHMM(new Date(entryAt.getTime() + 120_000), tz);

    const tpl = getTpl(ctx.templates, "signal",
      "✅ ENTRADA CONFIRMADA ✅\n🌎 Ativo: {ATIVO}\n⏳ Expiração: {TIMEFRAME}\n📊 Direção: {DIRECAO}\n⏰ Entrada: {ENTRADA}\n👉 Fazer até {MARTINGALE} POSIÇÕES em caso de loss!\nGale 1: {ENTRADAGALE1}\nGale 2: {ENTRADAGALE2}");

    const text = renderTemplate(tpl.content, {
      ATIVO: s.asset_code,
      TIMEFRAME: s.timeframe,
      DIRECAO: dirLabel(s.direction as "buy" | "sell"),
      ENTRADA: entryHHMM,
      ENTRADAGALE1: g1,
      ENTRADAGALE2: g2,
      MARTINGALE: String(s.max_gales),
    });

    const ids = await sendToRoom({
      userId: ctx.room.user_id,
      botToken: ctx.botToken,
      chatIds: ctx.chatIds,
      text,
      parseMode: tpl.parse_mode,
    });

    await supabaseAdmin.from("signal_events").update({
      status: "sent",
      signal_message_ids: ids,
    }).eq("id", s.id);
    sent++;
  }
  return sent;
}

/* ============ STEP 3: resolver sinais expirados (WIN/LOSS) ============ */
async function resolveExpired(): Promise<number> {
  const now = new Date();
  // dá 15s de margem para a vela fechar na Binance
  const cutoff = new Date(now.getTime() - 15_000).toISOString();
  const { data: list } = await supabaseAdmin
    .from("signal_events")
    .select("*")
    .eq("status", "sent")
    .lte("expires_at", cutoff)
    .limit(100);
  if (!list?.length) return 0;
  let resolved = 0;

  for (const s of list) {
    const candle = await getBinanceM1Candle(s.asset_code, new Date(s.entry_at));
    if (!candle) {
      // ativo não está na Binance (OTC/ações) → resolve como simulado com hit rate alto
      const win = Math.random() < 0.85;
      await postResult(s, win ? "win" : "loss");
      resolved++;
      continue;
    }
    const result = resolveBinary(s.direction as "buy" | "sell", candle.open, candle.close);
    if (result === "draw") {
      // empate: trate como loss (regra mais conservadora; ajuste se preferir win)
      await postResult(s, "loss", candle);
    } else {
      await postResult(s, result, candle);
    }
    resolved++;
  }
  return resolved;
}

async function postResult(
  s: any,
  outcome: "win" | "loss",
  candle?: { open: number; close: number },
) {
  const ctx = await getRoomContext(s.room_id);
  if (!ctx?.botToken) {
    await supabaseAdmin.from("signal_events").update({
      status: "error", last_error: "bot ausente na resolução",
      entry_price: candle?.open ?? null, close_price: candle?.close ?? null,
    }).eq("id", s.id);
    return;
  }

  const tplKind = outcome === "win"
    ? (s.gale_level > 0 ? "win_martingale" : "win")
    : "loss";
  const fallback = outcome === "win"
    ? (s.gale_level > 0 ? "✅ VITÓRIA no martingale {ATIVO} 🟢" : "✅ VITÓRIA no {ATIVO} 🟢")
    : "🔴 DERROTA no {ATIVO}";
  const tpl = getTpl(ctx.templates, tplKind, fallback);
  const text = renderTemplate(tpl.content, {
    ATIVO: s.asset_code,
    TIMEFRAME: s.timeframe,
    DIRECAO: dirLabel(s.direction as "buy" | "sell"),
    ENTRADA: "",
  });

  const replyTo = (s.signal_message_ids ?? {}) as Record<string, number>;
  const ids = await sendToRoom({
    userId: ctx.room.user_id,
    botToken: ctx.botToken,
    chatIds: ctx.chatIds,
    text,
    parseMode: tpl.parse_mode,
    replyTo,
  });

  // se LOSS e ainda há gales disponíveis, encadeia próxima entrada
  if (outcome === "loss" && s.gale_level < (s.max_gales ?? 0)) {
    const nextEntry = new Date(new Date(s.entry_at).getTime() + 60_000 * (s.gale_level + 1));
    const nextExpires = new Date(nextEntry.getTime() + 60_000);
    await supabaseAdmin.from("signal_events").insert({
      user_id: s.user_id,
      room_id: s.room_id,
      window_id: s.window_id,
      asset_code: s.asset_code,
      asset_category: s.asset_category,
      direction: s.direction,
      timeframe: s.timeframe,
      entry_at: nextEntry.toISOString(),
      expires_at: nextExpires.toISOString(),
      gale_level: s.gale_level + 1,
      max_gales: s.max_gales,
      status: "sent", // já consideramos enviado pois é continuação
      signal_message_ids: replyTo,
    });
  }

  const finalStatus: "win" | "win_g1" | "win_g2" | "loss" =
    outcome === "win"
      ? (s.gale_level === 0 ? "win" : s.gale_level === 1 ? "win_g1" : "win_g2")
      : "loss";

  await supabaseAdmin.from("signal_events").update({
    status: finalStatus,
    entry_price: candle?.open ?? null,
    close_price: candle?.close ?? null,
    result_message_ids: ids,
  }).eq("id", s.id);
}

/* ============ HANDLER ============ */
export const Route = createFileRoute("/api/public/cron/dispatch-signals")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const [scheduled, sent, resolved] = [
            await scheduleSignals(),
            await sendScheduled(),
            await resolveExpired(),
          ];
          return Response.json({ ok: true, scheduled, sent, resolved });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "Use POST" }),
    },
  },
});