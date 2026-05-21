import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import {
  sendPhotoWithPremiumEmojiCaptionRetry,
  sendTextWithPremiumEmojisRetry,
  getUserEmojiLookup,
} from "@/lib/premium-send.server";
import { mirrorIfMarked } from "@/lib/forwarder.server";
import { hasEmojiTokens, renderEmojiTokensPlain } from "@/lib/premium-emoji-render";
import { triggerSignalReactions } from "@/lib/engagement.functions";

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  content: z.string().max(4000).default(""),
  parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).default("HTML"),
  imagePath: z.string().max(500).nullable().optional(),
  imageMime: z.string().max(100).nullable().optional(),
  imageExt: z.string().max(20).nullable().optional(),
  defaultRoomId: z.string().uuid().nullable().optional(),
  defaultAccountId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isPremium: z.boolean().default(false),
  isMeetButton: z.boolean().default(false),
});

export const upsertQuickTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      name: data.name.trim(),
      content: data.content,
      parse_mode: data.parseMode,
      image_path: data.imagePath ?? null,
      image_mime: data.imageMime ?? null,
      image_ext: data.imageExt ?? null,
      default_room_id: data.defaultRoomId ?? null,
      default_account_id: data.defaultAccountId ?? null,
      sort_order: data.sortOrder,
      is_premium: data.isPremium,
      is_meet_button: data.isMeetButton,
    };
    if (data.id) {
      const { error } = await supabase
        .from("quick_send_templates")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("quick_send_templates")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteQuickTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("quick_send_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SendInput = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  accountId: z.string().uuid(),
  content: z.string().max(4000),
  parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).default("HTML"),
  premium: z.boolean().default(false),
  imagePathOverride: z.string().max(500).nullable().optional(),
  removeImage: z.boolean().default(false),
});

export const sendQuickTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SendInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: tpl, error } = await supabaseAdmin
      .from("quick_send_templates")
      .select("id, user_id, image_path, is_premium")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tpl || tpl.user_id !== userId) throw new Error("Modelo não encontrado");

    const { data: acc } = await supabaseAdmin
      .from("telegram_accounts")
      .select("bot_token, user_id")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!acc || acc.user_id !== userId) throw new Error("Bot não encontrado");

    const { data: chats } = await supabaseAdmin
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", data.roomId)
      .eq("user_id", userId);
    if (!chats?.length) throw new Error("Nenhum grupo vinculado a esta sala");

    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;

    const imagePath = data.removeImage
      ? null
      : (data.imagePathOverride ?? (tpl.image_path as string | null));
    const publicUrl = imagePath
      ? supabaseAdmin.storage.from("room-images").getPublicUrl(imagePath).data.publicUrl
      : null;

    // Toggle global por sala (forwarder_premium_enabled funciona como master).
    // O toggle por item vem em `data.premium` (vindo da UI do dialog).
    const { data: roomCfg } = await supabaseAdmin
      .from("room_engagement_settings")
      .select("forwarder_premium_enabled")
      .eq("room_id", data.roomId)
      .maybeSingle();
    const globalPremiumOn = roomCfg?.forwarder_premium_enabled !== false; // default ON se não houver registro
    const itemPremiumOn = data.premium === true;
    const wantsPremium = globalPremiumOn && itemPremiumOn;
    const hasTokens = hasEmojiTokens(data.content);

    console.log(
      `[quick-send] tpl=${data.id} room=${data.roomId} globalPremium=${globalPremiumOn} itemPremium=${itemPremiumOn} hasTokens=${hasTokens} -> wantsPremium=${wantsPremium}`,
    );

    // Quando o usuário desativou o toggle Premium mas o texto tem {EMOJI},
    // renderizamos os tokens em texto puro (preview_char) e seguimos via Bot API.
    let effectiveContent = data.content;
    let plainForced = false;
    if (!wantsPremium && hasTokens) {
      const lookup = await getUserEmojiLookup(userId);
      effectiveContent = renderEmojiTokensPlain(data.content, lookup);
      plainForced = true;
      console.log(`[quick-send] toggle Premium OFF: renderizando {EMOJI} como texto puro`);
    }

    for (const c of chats) {
      let r: { ok: boolean; result?: { message_id?: number }; description?: string };
      let premiumStatus:
        | "premium_sent"
        | "premium_blocked"
        | "no_premium_account"
        | "plain"
        | "plain_forced" = plainForced ? "plain_forced" : "plain";

      if (wantsPremium && imagePath && publicUrl) {
        const p = await sendPhotoWithPremiumEmojiCaptionRetry({
          userId,
          chatId: c.chat_id,
          photoUrl: publicUrl,
          caption: effectiveContent,
          strict: true,
        });
        if (p.applied) {
          premiumStatus = p.ok ? "premium_sent" : "premium_blocked";
          r = p.ok
            ? { ok: true, result: { message_id: p.messageId ?? undefined } }
            : { ok: false, description: p.error };
        } else {
          // Premium não pôde aplicar (sem conta ativa) → fallback plain
          premiumStatus = "no_premium_account";
          const lookup = await getUserEmojiLookup(userId);
          const fallback = renderEmojiTokensPlain(data.content, lookup);
          r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
            chat_id: c.chat_id,
            photo: publicUrl,
            caption: fallback || undefined,
            parse_mode: fallback ? data.parseMode : undefined,
          });
        }
      } else if (wantsPremium && !imagePath && effectiveContent) {
        const p = await sendTextWithPremiumEmojisRetry({
          userId,
          chatId: c.chat_id,
          text: effectiveContent,
          strict: true,
        });
        if (p.applied) {
          premiumStatus = p.ok ? "premium_sent" : "premium_blocked";
          r = p.ok
            ? { ok: true, result: { message_id: p.messageId ?? undefined } }
            : { ok: false, description: p.error };
        } else {
          premiumStatus = "no_premium_account";
          const lookup = await getUserEmojiLookup(userId);
          const fallback = renderEmojiTokensPlain(data.content, lookup);
          r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
            chat_id: c.chat_id,
            text: fallback,
            parse_mode: data.parseMode,
          });
        }
      } else if (imagePath && publicUrl) {
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
          chat_id: c.chat_id,
          photo: publicUrl,
          caption: effectiveContent || undefined,
          parse_mode: effectiveContent ? data.parseMode : undefined,
        });
      } else {
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
          chat_id: c.chat_id,
          text: effectiveContent,
          parse_mode: data.parseMode,
        });
      }
      console.log(
        `[quick-send] tpl=${data.id} chat=${c.chat_id} premium_status=${premiumStatus} ok=${r.ok} ${r.ok ? "" : `err="${r.description}"`}`,
      );
      await supabaseAdmin.from("message_logs").insert({
        user_id: userId,
        chat_id: c.chat_id,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : r.description ?? "erro",
        premium_status: premiumStatus,
      } as never);
      if (r.ok) sent++;
      else {
        failed++;
        lastError = r.description ?? "erro";
      }
      if (r.ok) {
        await mirrorIfMarked({
          roomId: data.roomId,
          fromChatId: c.chat_id,
          messageId: r.result?.message_id ?? null,
          origin: { kind: "template", id: data.id },
          payload: {
            userId,
            content: data.content,
            parseMode: data.parseMode,
            imagePath,
          },
        }).catch(() => undefined);
        if (r.result?.message_id) {
          await triggerSignalReactions({
            userId,
            chatId: c.chat_id,
            telegramMessageId: r.result.message_id,
            roomId: data.roomId,
          });
        }
      }
    }
    return { ok: sent > 0, sent, failed, error: lastError };
  });