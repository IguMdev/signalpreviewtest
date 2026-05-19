import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callTelegram, type TelegramUser, type TelegramUpdate } from "./telegram.server";
import {
  getPremiumAccountConnectionStatus,
  getUserEmojiLookup,
  sendPhotoWithPremiumEmojiCaption,
  sendTextWithPremiumEmojis,
} from "./premium-send.server";
import { renderEmojiTokens, renderEmojiTokensToHtml } from "./premium-emoji-render";
import { renderTemplate } from "./signals.server";

export const verifyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc, error } = await supabase
      .from("telegram_accounts")
      .select("id, bot_token, account_type")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    if (acc.account_type === "premium") {
      const premium = await getPremiumAccountConnectionStatus(userId, acc.id);
      const premiumUpdate = premium.ok
        ? {
            status: "ok" as const,
            last_check_at: new Date().toISOString(),
            last_error: premium.isPremium
              ? null
              : "A conta conectada não tem Telegram Premium ativo.",
            bot_username: premium.username ?? null,
            bot_first_name: premium.firstName ?? null,
          }
        : {
            status: "error" as const,
            last_check_at: new Date().toISOString(),
            last_error: premium.error,
          };
      await supabase.from("telegram_accounts").update(premiumUpdate).eq("id", acc.id);
      if (!premium.ok) return { ok: false, error: premium.error };
      if (!premium.isPremium)
        return { ok: false, error: "A conta conectada não tem Telegram Premium ativo." };
      return {
        ok: true,
        bot: {
          id: 0,
          is_bot: false,
          first_name: premium.firstName ?? "Conta Premium",
          username: premium.username ?? undefined,
        },
      };
    }
    const r = await callTelegram<TelegramUser>(acc.bot_token, "getMe");
    if (!r.ok || !r.result) {
      await supabase
        .from("telegram_accounts")
        .update({
          status: "error",
          last_check_at: new Date().toISOString(),
          last_error: r.description ?? "Falha desconhecida",
        })
        .eq("id", acc.id);
      return { ok: false, error: r.description ?? "Falha" };
    }
    await supabase
      .from("telegram_accounts")
      .update({
        status: "ok",
        last_check_at: new Date().toISOString(),
        last_error: null,
        bot_username: r.result.username ?? null,
        bot_first_name: r.result.first_name ?? null,
      })
      .eq("id", acc.id);
    return { ok: true, bot: r.result };
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string().uuid(),
        chatId: z.string().min(1),
        text: z.string().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc, error } = await supabase
      .from("telegram_accounts")
      .select("id, bot_token, account_type")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    const premium = await sendTextWithPremiumEmojis({
      userId,
      accountId: acc.account_type === "premium" ? acc.id : undefined,
      chatId: data.chatId,
      text: data.text,
      allowPlain: acc.account_type === "premium",
      strict: acc.account_type === "premium",
    });
    if (premium.applied) {
      if (!premium.ok) return { ok: false, error: premium.error, reason: premium.reason };
      return { ok: true, messageId: premium.messageId ?? undefined };
    }
    // Premium não se aplicou. Para contas premium isso só ocorre quando strict
    // está desligado — ainda assim devolvemos a razão para o frontend.
    if (acc.account_type === "premium") {
      return { ok: false, error: "Envio premium não aplicado.", reason: premium.reason };
    }
    const r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
      chat_id: data.chatId,
      text: data.text,
      parse_mode: "HTML",
    });
    if (!r.ok) return { ok: false, error: r.description, reason: premium.reason };
    return { ok: true, messageId: r.result?.message_id };
  });

export const refreshChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc, error } = await supabase
      .from("telegram_accounts")
      .select("id, bot_token")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    const r = await callTelegram<TelegramUpdate[]>(acc.bot_token, "getUpdates", { limit: 100 });
    if (!r.ok || !r.result) return { ok: false, error: r.description };
    const chats = new Map<number, { title?: string; type: string; username?: string }>();
    for (const u of r.result) {
      const c = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
      if (c && (c.type === "group" || c.type === "supergroup" || c.type === "channel")) {
        chats.set(c.id, { title: c.title, type: c.type, username: c.username });
      }
    }
    const rows = Array.from(chats.entries()).map(([chat_id, v]) => ({
      account_id: acc.id,
      user_id: userId,
      chat_id,
      title: v.title ?? null,
      type: v.type,
      username: v.username ?? null,
      cached_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      const { error: upErr } = await supabase
        .from("telegram_chats")
        .upsert(rows, { onConflict: "account_id,chat_id" });
      if (upErr) return { ok: false, error: upErr.message };
    }
    return { ok: true, count: rows.length };
  });

export const sendRoomTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        roomId: z.string().uuid(),
        templateKind: z
          .enum([
            "buy_direction",
            "entry",
            "event",
            "gain",
            "loss",
            "sell_direction",
            "signal",
            "win",
            "win_martingale",
          ])
          .optional(),
        text: z.string().max(4000).optional(),
        imagePath: z.string().optional(),
        imageBucket: z.string().optional(),
        imageMime: z.string().optional(),
        imageExt: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, default_account_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (roomErr || !room) throw new Error("Sala não encontrada");
    if (!room.default_account_id)
      throw new Error("Selecione um bot padrão para a sala antes de enviar testes.");

    const { data: chat } = await supabase
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", room.id)
      .limit(1)
      .maybeSingle();
    if (!chat)
      throw new Error("Vincule pelo menos um chat do Telegram à sala antes de enviar testes.");

    const { data: acc } = await supabase
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", room.default_account_id)
      .maybeSingle();
    if (!acc) throw new Error("Bot da sala não encontrado");

    // Substitui macros ({ATIVO}, {TIMEFRAME}, {DIRECAO}, {ENTRADA}...) com os
    // valores do último sinal enviado nesta sala — assim o "Testar" reflete
    // exatamente o que sairia depois de um sinal real (ex.: WIN no BTCUSD).
    let sampleAsset = "EURUSD";
    let sampleTimeframe = "M1";
    let sampleDirection: "buy" | "sell" = "buy";
    let sampleEntryAt: Date | null = null;
    try {
      const { data: lastSig } = await supabase
        .from("signal_events")
        .select("asset_code, timeframe, direction, entry_at")
        .eq("room_id", room.id)
        .order("entry_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastSig?.asset_code) {
        sampleAsset = lastSig.asset_code;
        sampleTimeframe = lastSig.timeframe ?? sampleTimeframe;
        sampleDirection = (lastSig.direction as "buy" | "sell") ?? sampleDirection;
        sampleEntryAt = lastSig.entry_at ? new Date(lastSig.entry_at) : null;
      } else {
        const { data: ra } = await supabase
          .from("room_assets")
          .select("asset_code")
          .eq("room_id", room.id)
          .eq("is_open", true)
          .limit(1)
          .maybeSingle();
        if (ra?.asset_code) sampleAsset = ra.asset_code;
      }
    } catch { /* mantém fallbacks */ }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const entry = sampleEntryAt ?? new Date(Math.ceil((now.getTime() + 1) / 60000) * 60000);
    const rawText = data.text?.trim() || "";
    const text = rawText
      ? renderTemplate(rawText, {
          ATIVO: sampleAsset,
          TIMEFRAME: sampleTimeframe,
          DIRECAO: sampleDirection === "sell" ? "🔴 VENDA" : "🟢 COMPRA",
          ENTRADA: hhmm(entry),
          ENTRADAGALE1: hhmm(new Date(entry.getTime() + 60_000)),
          ENTRADAGALE2: hhmm(new Date(entry.getTime() + 120_000)),
          MARTINGALE: "2",
        })
      : "";
    const emojiLookup = await getUserEmojiLookup(userId);
    const { data: buttons } = await supabase
      .from("room_template_buttons")
      .select("label, url, sort_order")
      .eq("room_id", room.id)
      .eq("template_kind", data.templateKind || "signal")
      .order("sort_order", { ascending: true });
    const buttonRows = (buttons ?? [])
      .filter((b) => b.label && b.url)
      .map((b) => [{ text: renderEmojiTokens(b.label, emojiLookup).text, url: b.url }]);
    const replyMarkup = buttonRows.length ? { inline_keyboard: buttonRows } : undefined;
    const botText = replyMarkup ? renderEmojiTokensToHtml(text, emojiLookup).text : text;
    let r;
    if (data.imagePath) {
      const bucket = data.imageBucket || "room-images";
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.imagePath);
      const mime = (data.imageMime || "").toLowerCase();
      const ext = (data.imageExt || data.imagePath.split(".").pop() || "").toLowerCase();
      const isStickerByMime =
        mime === "image/webp" || mime === "application/x-tgsticker" || mime === "video/webm";
      const isStickerByExt = ext === "webp" || ext === "tgs" || ext === "webm";
      const isSticker = isStickerByMime || (!mime && isStickerByExt);
      if (isSticker) {
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendSticker", {
          chat_id: chat.chat_id,
          sticker: pub.publicUrl,
          reply_markup: replyMarkup,
        });
        if (r.ok && text) {
          const premium = await sendTextWithPremiumEmojis({
            userId,
            chatId: chat.chat_id,
            text,
            buttonRows: buttonRows.length ? buttonRows : undefined,
          });
          if (premium.applied) {
            if (!premium.ok) throw new Error(premium.error);
          } else
            await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
              chat_id: chat.chat_id,
              text: botText,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            });
        }
      } else {
        const premiumPhoto = await sendPhotoWithPremiumEmojiCaption({
          userId,
          chatId: chat.chat_id,
          photoUrl: pub.publicUrl,
          caption: text,
          buttonRows: buttonRows.length ? buttonRows : undefined,
        });
        if (premiumPhoto.applied) {
          if (premiumPhoto.ok) {
            r = { ok: true, result: { message_id: premiumPhoto.messageId ?? undefined } };
          } else {
            r = { ok: false, description: premiumPhoto.error };
          }
        } else {
          r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
              chat_id: chat.chat_id,
              photo: pub.publicUrl,
              caption: botText || undefined,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            });
        }
      }
    } else {
      if (!text) throw new Error("Mensagem vazia");
      const premium = await sendTextWithPremiumEmojis({
        userId,
        chatId: chat.chat_id,
        text,
        buttonRows: buttonRows.length ? buttonRows : undefined,
      });
      if (premium.applied) {
        if (!premium.ok) throw new Error(premium.error);
        r = { ok: true, result: { message_id: premium.messageId ?? undefined } };
      } else
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
          chat_id: chat.chat_id,
          text: botText,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        });
    }
    if (!r.ok) throw new Error(r.description ?? "Falha ao enviar");
    if (r.result?.message_id) {
      const { triggerSignalReactions } = await import("@/lib/engagement.functions");
      await triggerSignalReactions({
        userId,
        chatId: chat.chat_id,
        telegramMessageId: r.result.message_id,
        roomId: room.id,
      });
    }
    return { ok: true, messageId: r.result?.message_id };
  });
