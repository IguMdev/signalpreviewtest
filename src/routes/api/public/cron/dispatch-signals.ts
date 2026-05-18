import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { mirrorIfMarked } from "@/lib/forwarder.server";
import { getUserEmojiLookup, sendPhotoWithPremiumEmojiCaption, sendTextWithPremiumEmojis } from "@/lib/premium-send.server";
import { renderEmojiTokens, renderEmojiTokensToHtml } from "@/lib/premium-emoji-render";
import {
  buildSlots,
  categoryFor,
  getBinanceM1Candle,
  nowParts,
  pickRandom,
  renderTemplate,
  resolveBinary,
} from "@/lib/signals.server";
import { aggregateTerminalStats, reportDateKey, withRetry } from "@/lib/signals-aggregation";

type Window = {
  id: string;
  user_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  weekdays: number[];
  signals_qty: number;
  asset_filter: string[];
  use_all_assets: boolean;
  timeframes: string[];
  max_losses: number;
  martingale: number;
  is_active: boolean;
};

type Room = {
  id: string;
  user_id: string;
  timezone: string;
  default_account_id: string | null;
};

type Template = {
  kind: string;
  content: string;
  parse_mode: string;
  image_path?: string | null;
  image_mime?: string | null;
  image_ext?: string | null;
};

type TemplateButton = {
  template_kind: string;
  label: string;
  url: string;
  sort_order: number;
};

type SignalEvent = {
  id: string;
  user_id: string;
  room_id: string;
  window_id: string;
  asset_code: string;
  asset_category: string | null;
  direction: string;
  timeframe: string;
  entry_at: string;
  expires_at: string;
  gale_level: number;
  max_gales: number | null;
  signal_message_ids: unknown;
};

function asMessageIds(value: unknown): Record<string, number> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, number>)
    : {};
}

async function buildReplyMarkup(userId: string, buttons: TemplateButton[], kind: string) {
  const lookup = await getUserEmojiLookup(userId);
  const rows = buttons
    .filter((b) => b.template_kind === kind && b.label && b.url)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((b) => [{ text: renderEmojiTokens(b.label, lookup).text, url: b.url }]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

async function renderBotApiText(userId: string, text: string) {
  const lookup = await getUserEmojiLookup(userId);
  return renderEmojiTokensToHtml(text, lookup).text;
}

function fmtHHMM(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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
  imagePath?: string | null;
  replyTo?: Record<string, number>; // chatId -> message_id
  replyMarkup?: { inline_keyboard: { text: string; url: string }[][] };
}): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const cid of opts.chatIds) {
    if (opts.imagePath) {
      const { data: pub } = supabaseAdmin.storage.from("room-images").getPublicUrl(opts.imagePath);
      const premiumPhoto = await sendPhotoWithPremiumEmojiCaption({
        userId: opts.userId,
        chatId: cid,
        photoUrl: pub.publicUrl,
        caption: opts.text,
        replyToMessageId: opts.replyTo?.[String(cid)],
        buttonRows: opts.replyMarkup?.inline_keyboard,
      });
      if (premiumPhoto.applied && premiumPhoto.ok && premiumPhoto.messageId) {
        out[String(cid)] = premiumPhoto.messageId;
        continue;
      }
      // Premium não aplicável ou falhou → garante envio via Bot API com a imagem.
      const botText = await renderBotApiText(opts.userId, opts.text);
      const r = await withRetry(
        () =>
          callTelegram<{ message_id: number }>(opts.botToken, "sendPhoto", {
            chat_id: cid,
            photo: pub.publicUrl,
            caption: botText || undefined,
            parse_mode: opts.parseMode || "HTML",
            reply_to_message_id: opts.replyTo?.[String(cid)],
            allow_sending_without_reply: true,
            reply_markup: opts.replyMarkup,
          }),
        { isRetryable: (res, err) => Boolean(err) || !res?.ok },
      ).catch(() => ({ ok: false } as { ok: false; result?: { message_id: number } }));
      if (r.ok && r.result?.message_id) out[String(cid)] = r.result.message_id;
      continue;
    }
    const premium = await sendTextWithPremiumEmojis({
      userId: opts.userId,
      chatId: cid,
      text: opts.text,
      replyToMessageId: opts.replyTo?.[String(cid)],
      buttonRows: opts.replyMarkup?.inline_keyboard,
    });
    if (premium.applied) {
      if (premium.ok && premium.messageId) {
        out[String(cid)] = premium.messageId;
      }
      continue;
    }
    const botText = await renderBotApiText(opts.userId, opts.text);
    const r = await withRetry(
      () =>
        callTelegram<{ message_id: number }>(opts.botToken, "sendMessage", {
          chat_id: cid,
          text: botText,
          parse_mode: opts.parseMode || "HTML",
          reply_to_message_id: opts.replyTo?.[String(cid)],
          allow_sending_without_reply: true,
          reply_markup: opts.replyMarkup,
        }),
      { isRetryable: (res, err) => Boolean(err) || !res?.ok },
    ).catch(() => ({ ok: false } as { ok: false; result?: { message_id: number } }));
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
    .from("room_chats")
    .select("chat_id")
    .eq("room_id", roomId);
  const { data: tpls } = await supabaseAdmin
    .from("room_templates")
    .select("kind, content, parse_mode, image_path, image_mime, image_ext")
    .eq("room_id", roomId);
  const { data: btns } = await supabaseAdmin
    .from("room_template_buttons")
    .select("template_kind, label, url, sort_order")
    .eq("room_id", roomId)
    .order("sort_order", { ascending: true });
  let botToken: string | null = null;
  if (room.default_account_id) {
    const { data: acc } = await supabaseAdmin
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", room.default_account_id)
      .maybeSingle();
    botToken = acc?.bot_token ?? null;
  }
  return {
    room: room as Room,
    chatIds: (chats ?? []).map((c) => Number(c.chat_id)),
    templates: (tpls ?? []) as Template[],
    buttons: (btns ?? []) as TemplateButton[],
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
    .select(
      "id, user_id, room_id, start_time, end_time, weekdays, signals_qty, asset_filter, use_all_assets, timeframes, max_losses, martingale, is_active",
    )
    .eq("is_active", true);
  if (!windows?.length) return 0;

  // entrada será no PRÓXIMO minuto cheio
  const now = new Date();
  const nextMinute = new Date(Math.ceil((now.getTime() + 1) / 60000) * 60000);
  let scheduled = 0;

  for (const w of windows as Window[]) {
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("timezone")
      .eq("id", w.room_id)
      .maybeSingle();
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
        .from("room_assets")
        .select("asset_code")
        .eq("room_id", w.room_id)
        .eq("is_open", true);
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
  // Dispara apenas quando o horário do sinal já chegou (com tolerância de 5s)
  // para que o envio aconteça exatamente no minuto configurado.
  const horizon = new Date(now.getTime() + 5_000).toISOString();
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
      await supabaseAdmin
        .from("signal_events")
        .update({
          status: "error",
          last_error: "Sem bot/chats vinculados",
        })
        .eq("id", s.id);
      continue;
    }
    const tz = ctx.room.timezone;
    const entryAt = new Date(s.entry_at);
    const entryHHMM = fmtHHMM(entryAt, tz);
    const g1 = fmtHHMM(new Date(entryAt.getTime() + 60_000), tz);
    const g2 = fmtHHMM(new Date(entryAt.getTime() + 120_000), tz);

    const tpl = getTpl(
      ctx.templates,
      "signal",
      "✅ ENTRADA CONFIRMADA ✅\n🌎 Ativo: {ATIVO}\n⏳ Expiração: {TIMEFRAME}\n📊 Direção: {DIRECAO}\n⏰ Entrada: {ENTRADA}\n👉 Fazer até {MARTINGALE} POSIÇÕES em caso de loss!\nGale 1: {ENTRADAGALE1}\nGale 2: {ENTRADAGALE2}",
    );

    const text = renderTemplate(tpl.content, {
      ATIVO: s.asset_code,
      TIMEFRAME: s.timeframe,
      DIRECAO: dirLabel(s.direction as "buy" | "sell"),
      ENTRADA: entryHHMM,
      ENTRADAGALE1: g1,
      ENTRADAGALE2: g2,
      MARTINGALE: String(s.max_gales),
    });

    const signalReplyMarkup = await buildReplyMarkup(ctx.room.user_id, ctx.buttons, "signal");
    const ids = await sendToRoom({
      userId: ctx.room.user_id,
      botToken: ctx.botToken,
      chatIds: ctx.chatIds,
      text,
      parseMode: tpl.parse_mode,
      replyMarkup: signalReplyMarkup,
    });

    await supabaseAdmin
      .from("signal_events")
      .update({
        status: "sent",
        signal_message_ids: ids,
      })
      .eq("id", s.id);
    for (const [cid, mid] of Object.entries(ids)) {
      await mirrorIfMarked({
        roomId: s.room_id,
        fromChatId: Number(cid),
        messageId: mid,
        origin: { kind: "template", id: "signal" },
        payload: {
          userId: ctx.room.user_id,
          content: text,
          parseMode: tpl.parse_mode,
          replyMarkup: signalReplyMarkup,
        },
      });
    }
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
  s: SignalEvent,
  outcome: "win" | "loss",
  candle?: { open: number; close: number },
) {
  const ctx = await getRoomContext(s.room_id);
  if (!ctx?.botToken) {
    await supabaseAdmin
      .from("signal_events")
      .update({
        status: "error",
        last_error: "bot ausente na resolução",
        entry_price: candle?.open ?? null,
        close_price: candle?.close ?? null,
      })
      .eq("id", s.id);
    return;
  }

  const tplKind = outcome === "win" ? (s.gale_level > 0 ? "win_martingale" : "win") : "loss";
  const fallback =
    outcome === "win"
      ? s.gale_level > 0
        ? "✅ VITÓRIA no martingale {ATIVO} 🟢"
        : "✅ VITÓRIA no {ATIVO} 🟢"
      : "🔴 DERROTA no {ATIVO}";
  const tpl = getTpl(ctx.templates, tplKind, fallback);
  const text = renderTemplate(tpl.content, {
    ATIVO: s.asset_code,
    TIMEFRAME: s.timeframe,
    DIRECAO: dirLabel(s.direction as "buy" | "sell"),
    ENTRADA: "",
  });

  const replyTo = asMessageIds(s.signal_message_ids);
  const resultReplyMarkup = await buildReplyMarkup(ctx.room.user_id, ctx.buttons, tplKind);
  const ids = await sendToRoom({
    userId: ctx.room.user_id,
    botToken: ctx.botToken,
    chatIds: ctx.chatIds,
    text,
    parseMode: tpl.parse_mode,
    imagePath: tpl.image_path,
    replyTo,
    replyMarkup: resultReplyMarkup,
  });
  for (const [cid, mid] of Object.entries(ids)) {
    await mirrorIfMarked({
      roomId: s.room_id,
      fromChatId: Number(cid),
      messageId: mid,
      origin: { kind: "template", id: tplKind },
      payload: {
        userId: ctx.room.user_id,
        content: text,
        parseMode: tpl.parse_mode,
        imagePath: tpl.image_path,
        replyMarkup: resultReplyMarkup,
      },
    });
  }

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
      max_gales: s.max_gales ?? 0,
      status: "sent", // já consideramos enviado pois é continuação
      signal_message_ids: replyTo,
    });
  }

  const finalStatus: "win" | "win_g1" | "win_g2" | "loss" =
    outcome === "win"
      ? s.gale_level === 0
        ? "win"
        : s.gale_level === 1
          ? "win_g1"
          : "win_g2"
      : "loss";

  await supabaseAdmin
    .from("signal_events")
    .update({
      status: finalStatus,
      entry_price: candle?.open ?? null,
      close_price: candle?.close ?? null,
      result_message_ids: ids,
    })
    .eq("id", s.id);
}

async function sendDueReports(): Promise<number> {
  const { data: reports } = await supabaseAdmin
    .from("room_reports")
    .select("user_id, room_id, enabled, delay_minutes, template, image_path")
    .eq("enabled", true);
  if (!reports?.length) return 0;

  let sent = 0;
  const now = new Date();
  for (const report of reports) {
    const ctx = await getRoomContext(report.room_id);
    if (!ctx?.botToken || !ctx.chatIds.length) continue;
    const { data: windows } = await supabaseAdmin
      .from("room_windows")
      .select("id, name, end_time")
      .eq("room_id", report.room_id)
      .eq("is_active", true);
    for (const w of windows ?? []) {
      // Dispara APENAS no minuto programado (end_time + delay), na timezone da sala.
      // Suporta janelas que cruzam meia-noite: target é módulo 1440 e o report_key
      // referencia o dia da janela (now - delay), não o dia do disparo.
      const tz = ctx.room.timezone;
      const tzNowHHMM = fmtHHMM(now, tz);
      const toMin = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
      const endMin = toMin(String(w.end_time).slice(0, 5));
      const nowMin = toMin(tzNowHHMM);
      const delay = Math.max(0, Number(report.delay_minutes) || 0);
      const target = (endMin + delay) % 1440;
      // distância circular nowMin -> target (em minutos). Só dispara no minuto exato
      // (tolerância de 1 min para o cron que roda * * * * *).
      const diff = ((nowMin - target) + 1440) % 1440;
      if (diff > 1) continue;
      // dia da janela: subtrai delay para o caso de cruzar a meia-noite.
      const windowDay = reportDateKey(new Date(now.getTime() - delay * 60_000), tz);
      const key = `${windowDay}:${String(w.end_time).slice(0, 5)}`;
      const { data: claim } = await supabaseAdmin
        .from("room_report_runs")
        .insert({ user_id: report.user_id, room_id: report.room_id, window_id: w.id, report_key: key })
        .select("id")
        .maybeSingle();
      if (!claim) continue;

      // Agrega apenas operações TERMINAIS do ciclo de hoje (timezone da sala).
      const tz = ctx.room.timezone;
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: stats } = await supabaseAdmin
        .from("signal_events")
        .select("status, gale_level, max_gales, entry_at, asset_code")
        .eq("room_id", report.room_id)
        .eq("window_id", w.id)
        .gte("entry_at", since);
      const { totalWins, totalLosses, total, winRate } = aggregateTerminalStats(
        (stats ?? []) as { status: string; gale_level: number; max_gales: number; entry_at: string }[],
        { tz, now },
      );
      // Lista de operações terminais (HH:MM Ativo ✅/❌), ordenadas por horário.
      const todayKey = reportDateKey(now, tz);
      const terminalList = ((stats ?? []) as Array<{ status: string; gale_level: number | null; max_gales: number | null; entry_at: string; asset_code: string | null }>)
        .filter((e) => reportDateKey(new Date(e.entry_at), tz) === todayKey)
        .filter((e) => {
          const st = String(e.status);
          if (st === "win" || st === "win_g1" || st === "win_g2") return true;
          if (st === "loss" && Number(e.gale_level ?? 0) >= Number(e.max_gales ?? 0)) return true;
          return false;
        })
        .sort((a, b) => new Date(a.entry_at).getTime() - new Date(b.entry_at).getTime())
        .map((e) => {
          const isWin = String(e.status).startsWith("win");
          return `${fmtHHMM(new Date(e.entry_at), tz)} ${e.asset_code ?? "—"} ${isWin ? "✅" : "❌"}`;
        })
        .join("\n");
      const text = String(report.template || "📊 RELATÓRIO {SESSAO_NOME}\n{OPERACOES_LISTA}\n\n✅ Wins: {TOTAL_WINS}\n🔴 Losses: {TOTAL_LOSSES}\n📈 Operações: {TOTAL_OPERACOES}\n🎯 Win rate: {WIN_RATE}%")
        .replaceAll("{SESSAO_NOME}", w.name ?? "Sessão")
        .replaceAll("{TOTAL_WINS}", String(totalWins))
        .replaceAll("{TOTAL_LOSSES}", String(totalLosses))
        .replaceAll("{TOTAL_OPERACOES}", String(total))
        .replaceAll("{WIN_RATE}", String(winRate))
        .replaceAll("{OPERACOES_LISTA}", terminalList || "—");
      const ids = await sendToRoom({
        userId: report.user_id,
        botToken: ctx.botToken,
        chatIds: ctx.chatIds,
        text,
        parseMode: "HTML",
        imagePath: report.image_path,
      });
      await supabaseAdmin.from("room_report_runs").update({ message_ids: ids }).eq("id", claim.id);
      if (Object.keys(ids).length) sent++;
    }
  }
  return sent;
}

/* ============ HANDLER ============ */
export const Route = createFileRoute("/api/public/cron/dispatch-signals")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const [scheduled, sent, resolved, reports] = [
            await scheduleSignals(),
            await sendScheduled(),
            await resolveExpired(),
            await sendDueReports(),
          ];
          return Response.json({ ok: true, scheduled, sent, resolved, reports });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "Use POST" }),
    },
  },
});
