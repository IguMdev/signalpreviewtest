import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { getUserEmojiLookup, sendTextWithPremiumEmojis } from "@/lib/premium-send.server";
import { renderEmojiTokens, renderEmojiTokensToHtml } from "@/lib/premium-emoji-render";
import { categoryFor, pickRandom, renderTemplate } from "@/lib/signals.server";

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

export const testWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { windowId: string }) =>
    z.object({ windowId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };

    const { data: w, error: we } = await supabaseAdmin
      .from("room_windows")
      .select("id, user_id, room_id, asset_filter, use_all_assets, timeframes, martingale")
      .eq("id", data.windowId)
      .maybeSingle();
    if (we || !w) throw new Error("Janela não encontrada");
    if (w.user_id !== userId) throw new Error("Sem permissão");

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("id, user_id, timezone, default_account_id")
      .eq("id", w.room_id)
      .maybeSingle();
    if (!room) throw new Error("Sala não encontrada");

    const { data: chats } = await supabaseAdmin
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", w.room_id);
    const chatIds = (chats ?? []).map((c) => Number(c.chat_id));
    if (!chatIds.length) throw new Error("Vincule um chat/canal à sala antes de testar");

    let botToken: string | null = null;
    if (room.default_account_id) {
      const { data: acc } = await supabaseAdmin
        .from("telegram_accounts")
        .select("bot_token")
        .eq("id", room.default_account_id)
        .maybeSingle();
      botToken = acc?.bot_token ?? null;
    }
    if (!botToken) throw new Error("Defina uma conta bot padrão na sala");

    // pool de ativos
    let pool: string[] = [];
    if (w.use_all_assets || !w.asset_filter?.length) {
      const { data: ras } = await supabaseAdmin
        .from("room_assets")
        .select("asset_code")
        .eq("room_id", w.room_id)
        .eq("is_open", true);
      pool = (ras ?? []).map((r) => r.asset_code);
    } else {
      pool = w.asset_filter as string[];
    }
    if (!pool.length) throw new Error("Nenhum ativo disponível");

    const asset = pickRandom(pool);
    const direction: "buy" | "sell" = Math.random() < 0.5 ? "buy" : "sell";
    const timeframe = pickRandom(w.timeframes?.length ? w.timeframes : ["M1"]);
    const tz = room.timezone ?? "America/Sao_Paulo";

    const now = new Date();
    const entry = new Date(Math.ceil((now.getTime() + 1) / 60000) * 60000);
    const expires = new Date(entry.getTime() + 60_000);

    const { data: tpls } = await supabaseAdmin
      .from("room_templates")
      .select("kind, content, parse_mode")
      .eq("room_id", w.room_id);
    const { data: btnsRaw } = await supabaseAdmin
      .from("room_template_buttons")
      .select("template_kind, label, url, sort_order")
      .eq("room_id", w.room_id)
      .order("sort_order", { ascending: true });
    const emojiLookup = await getUserEmojiLookup(userId);
    const signalButtons = (btnsRaw ?? [])
      .filter((b) => b.template_kind === "signal" && b.label && b.url)
      .map((b) => [{ text: renderEmojiTokens(b.label, emojiLookup).text, url: b.url }]);
    const replyMarkup = signalButtons.length ? { inline_keyboard: signalButtons } : undefined;
    const tpl = (tpls ?? []).find((t) => t.kind === "signal") ?? {
      kind: "signal",
      parse_mode: "HTML",
      content:
        "🧪 TESTE 🧪\n✅ ENTRADA CONFIRMADA ✅\n🌎 Ativo: {ATIVO}\n⏳ Expiração: {TIMEFRAME}\n📊 Direção: {DIRECAO}\n⏰ Entrada: {ENTRADA}\nGale 1: {ENTRADAGALE1}\nGale 2: {ENTRADAGALE2}",
    };
    const text =
      "🧪 TESTE 🧪\n" +
      renderTemplate(tpl.content, {
        ATIVO: asset,
        TIMEFRAME: timeframe,
        DIRECAO: dirLabel(direction),
        ENTRADA: fmtHHMM(entry, tz),
        ENTRADAGALE1: fmtHHMM(new Date(entry.getTime() + 60_000), tz),
        ENTRADAGALE2: fmtHHMM(new Date(entry.getTime() + 120_000), tz),
        MARTINGALE: String(w.martingale ?? 2),
      });

    const botText = replyMarkup ? renderEmojiTokensToHtml(text, emojiLookup).text : text;
    const ids: Record<string, number> = {};
    const errors: string[] = [];
    for (const cid of chatIds) {
      // Botões inline exigem Bot API — pula a rota premium quando há botões.
      if (!replyMarkup) {
        const premium = await sendTextWithPremiumEmojis({
          userId: w.user_id,
          chatId: cid,
          text,
        });
        if (premium.applied) {
          if (premium.ok && premium.messageId) ids[String(cid)] = premium.messageId;
          else errors.push(`chat ${cid}: ${premium.ok ? "erro" : premium.error}`);
          continue;
        }
      }
      const r = await callTelegram<{ message_id: number }>(botToken, "sendMessage", {
        chat_id: cid,
        text: botText,
        parse_mode: tpl.parse_mode || "HTML",
        reply_markup: replyMarkup,
      });
      if (r.ok && r.result?.message_id) ids[String(cid)] = r.result.message_id;
      else errors.push(`chat ${cid}: ${r.description ?? "erro"}`);
    }

    // grava signal_event para que o resolver de WIN/LOSS rode normal
    if (Object.keys(ids).length) {
      await supabaseAdmin.from("signal_events").insert({
        user_id: w.user_id,
        room_id: w.room_id,
        window_id: w.id,
        asset_code: asset,
        asset_category: categoryFor(asset),
        direction,
        timeframe,
        entry_at: entry.toISOString(),
        expires_at: expires.toISOString(),
        max_gales: w.martingale ?? 0,
        status: "sent",
        signal_message_ids: ids,
      });
    }

    return {
      ok: Object.keys(ids).length > 0,
      asset,
      direction,
      timeframe,
      entry_at: entry.toISOString(),
      sent: Object.keys(ids).length,
      errors,
    };
  });
