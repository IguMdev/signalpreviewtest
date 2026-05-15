import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { dispatchVideoNote, dispatchVideo } from "@/lib/videos.functions";
import { sendPhotoWithPremiumEmojiCaption, sendTextWithPremiumEmojis, getUserEmojiLookup } from "@/lib/premium-send.server";
import { renderEmojiTokensToHtml, hasEmojiTokens } from "@/lib/premium-emoji-render";

const TimeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const FollowUpInput = z.object({
  delayMinutes: z.number().int().min(1).max(1440),
  delaySeconds: z.number().int().min(1).max(86400).nullable().optional(),
  content: z.string().max(4000).nullable().optional(),
  imagePath: z.string().max(500).nullable().optional(),
  imageMime: z.string().max(100).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  buttonText: z.string().max(64).nullable().optional(),
  buttonUrl: z.string().url().max(2048).nullable().optional(),
});

const ScheduleInput = z.object({
  id: z.string().uuid().optional(),
  roomId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(120),
  content: z.string().max(4000).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  imagePath: z.string().max(500).nullable().optional(),
  imageMime: z.string().max(100).nullable().optional(),
  parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).default("HTML"),
  times: z.array(z.string().regex(TimeRe)).min(1).max(24),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  weekdayOverrides: z
    .record(z.string().regex(/^[1-7]$/), z.array(z.string().regex(TimeRe)).max(24))
    .default({}),
  followUps: z.array(FollowUpInput).max(10).default([]),
  isPremium: z.boolean().default(false),
  isActive: z.boolean().default(true),
  timezone: z.string().default("America/Sao_Paulo"),
  buttonText: z.string().max(64).nullable().optional(),
  buttonUrl: z.string().url().max(2048).nullable().optional(),
});

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ScheduleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      room_id: data.roomId,
      account_id: data.accountId ?? null,
      title: data.title.trim(),
      content: data.content ?? null,
      video_id: data.videoId ?? null,
      image_path: data.imagePath ?? null,
      image_mime: data.imageMime ?? null,
      parse_mode: data.parseMode,
      times: Array.from(new Set(data.times)).sort(),
      weekdays: Array.from(new Set(data.weekdays)).sort(),
      weekday_overrides: Object.fromEntries(
        Object.entries(data.weekdayOverrides ?? {})
          .map(([k, v]) => [k, Array.from(new Set(v)).sort()] as const)
          .filter(([, v]) => v.length > 0),
      ),
      follow_ups: (data.followUps ?? []).map((f) => ({
        delay_minutes: f.delayMinutes,
        delay_seconds: f.delaySeconds ?? null,
        content: f.content ?? null,
        image_path: f.imagePath ?? null,
        image_mime: f.imageMime ?? null,
        video_id: f.videoId ?? null,
        button_text: f.buttonText ?? null,
        button_url: f.buttonUrl ?? null,
      })),
      is_premium: data.isPremium,
      is_active: data.isActive,
      timezone: data.timezone,
      button_text: data.buttonText ?? null,
      button_url: data.buttonUrl ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("recurring_schedules").update(row as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("recurring_schedules")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const toggleSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("recurring_schedules")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recurring_schedules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: s, error } = await supabaseAdmin
      .from("recurring_schedules")
      .select(
        "id, user_id, room_id, account_id, content, video_id, image_path, image_mime, parse_mode, is_premium, button_text, button_url",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s || s.user_id !== userId) throw new Error("Agendamento não encontrado");

    let accountId = s.account_id as string | null;
    if (!accountId) {
      const { data: room } = await supabaseAdmin
        .from("rooms")
        .select("default_account_id")
        .eq("id", s.room_id)
        .maybeSingle();
      accountId = (room?.default_account_id as string | null) ?? null;
    }
    if (!accountId) throw new Error("Nenhuma conta de bot configurada");

    const { data: acc } = await supabaseAdmin
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", accountId)
      .maybeSingle();
    const { data: chats } = await supabaseAdmin
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", s.room_id);
    if (!acc) throw new Error("Bot não encontrado");
    if (!chats?.length) throw new Error("Nenhum grupo vinculado a esta sala");

    let video: { storage_path: string; mime_type: string | null; duration_seconds: number | null; title: string; kind: string | null } | null = null;
    if (s.video_id) {
      const { data: v } = await supabaseAdmin
        .from("videos")
        .select("storage_path, mime_type, duration_seconds, title, kind")
        .eq("id", s.video_id)
        .maybeSingle();
      video = v ?? null;
    }

    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;
    for (const c of chats) {
      let r: { ok: boolean; result?: { message_id?: number }; description?: string };
      const sAny = s as unknown as { button_text: string | null; button_url: string | null };
      const replyMarkup =
        sAny.button_text && sAny.button_url
          ? { inline_keyboard: [[{ text: sAny.button_text, url: sAny.button_url }]] }
          : undefined;
      const isNormalVideo = video && video.kind === "normal";
      const premium =
        s.is_premium && !s.image_path && !video && s.content
          ? await sendTextWithPremiumEmojis({
              userId: s.user_id,
              chatId: c.chat_id,
              text: s.content,
                  strict: true,
            })
          : { applied: false as const, reason: "skip" };
      if (premium.applied) {
        r = premium.ok
          ? { ok: true, result: { message_id: premium.messageId ?? undefined } }
          : { ok: false, description: premium.error };
      } else r = s.image_path
        ? await (async () => {
            const { data: pub } = supabaseAdmin.storage
              .from("room-images")
              .getPublicUrl(s.image_path!);
            if (s.is_premium) {
              const premiumPhoto = await sendPhotoWithPremiumEmojiCaption({
                userId: s.user_id,
                chatId: c.chat_id,
                photoUrl: pub.publicUrl,
                caption: s.content,
                strict: true,
              });
              if (premiumPhoto.applied) {
                return premiumPhoto.ok
                  ? { ok: true, result: { message_id: premiumPhoto.messageId ?? undefined } }
                  : { ok: false, description: premiumPhoto.error };
              }
            }
            return await callTelegram<{ message_id: number }>(
              acc.bot_token,
              "sendPhoto",
              {
                chat_id: c.chat_id,
                photo: pub.publicUrl,
                caption: s.content ?? undefined,
                parse_mode: s.content ? s.parse_mode : undefined,
                reply_markup: replyMarkup,
              },
            );
          })()
        : video
        ? isNormalVideo
          ? await dispatchVideo({
              botToken: acc.bot_token,
              storagePath: video!.storage_path,
              chatId: c.chat_id,
              duration: video!.duration_seconds,
              mimeType: video!.mime_type,
              filename: (video!.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
              caption: s.content,
              parseMode: s.parse_mode,
              replyMarkup,
            })
          : await dispatchVideoNote({
            botToken: acc.bot_token,
            storagePath: video.storage_path,
            chatId: c.chat_id,
            duration: video.duration_seconds,
            mimeType: video.mime_type,
            filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
          })
        : await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
            chat_id: c.chat_id,
            text: s.content ?? "",
            parse_mode: s.parse_mode,
            reply_markup: replyMarkup,
          });
      await supabaseAdmin.from("message_logs").insert({
        user_id: userId,
        account_id: accountId,
        chat_id: c.chat_id,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : r.description ?? "erro",
      } as never);
      if (r.ok) sent++;
      else {
        failed++;
        lastError = r.description ?? "erro";
      }
    }
    return { ok: sent > 0, sent, failed, error: lastError };
  });

const TestMessageInput = z.object({
  roomId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  content: z.string().max(4000).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  imagePath: z.string().max(500).nullable().optional(),
  imageMime: z.string().max(100).nullable().optional(),
  parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).default("HTML"),
  isPremium: z.boolean().default(false),
  buttonText: z.string().max(64).nullable().optional(),
  buttonUrl: z.string().url().max(2048).nullable().optional(),
});

export const testMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => TestMessageInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    let accountId = data.accountId ?? null;
    if (!accountId) {
      const { data: room } = await supabaseAdmin
        .from("rooms")
        .select("default_account_id, user_id")
        .eq("id", data.roomId)
        .maybeSingle();
      if (!room || room.user_id !== userId) throw new Error("Sala não encontrada");
      accountId = (room.default_account_id as string | null) ?? null;
    }
    if (!accountId) throw new Error("Nenhuma conta de bot configurada");

    const { data: acc } = await supabaseAdmin
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", accountId)
      .maybeSingle();
    const { data: chats } = await supabaseAdmin
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", data.roomId);
    if (!acc) throw new Error("Bot não encontrado");
    if (!chats?.length) throw new Error("Nenhum grupo vinculado a esta sala");

    let video: { storage_path: string; mime_type: string | null; duration_seconds: number | null; title: string; kind: string | null } | null = null;
    if (data.videoId) {
      const { data: v } = await supabaseAdmin
        .from("videos")
        .select("storage_path, mime_type, duration_seconds, title, kind")
        .eq("id", data.videoId)
        .maybeSingle();
      video = v ?? null;
    }

    const replyMarkup =
      data.buttonText && data.buttonUrl
        ? { inline_keyboard: [[{ text: data.buttonText, url: data.buttonUrl }]] }
        : undefined;
    const buttonRows =
      data.buttonText && data.buttonUrl
        ? [[{ text: data.buttonText, url: data.buttonUrl }]]
        : undefined;
    const isNormalVideo = video && video.kind === "normal";

    // Pre-render emoji tokens to HTML for caption-bearing sends (photo/video).
    let captionForMedia: string | null = data.content ?? null;
    let captionParseMode: string = data.parseMode;
    if (captionForMedia && hasEmojiTokens(captionForMedia)) {
      const lookup = await getUserEmojiLookup(userId);
      const rendered = renderEmojiTokensToHtml(captionForMedia, lookup);
      if (rendered.replaced) {
        captionForMedia = rendered.text;
        captionParseMode = "HTML";
      }
    }

    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;
    for (const c of chats) {
      let r: { ok: boolean; result?: { message_id?: number }; description?: string };
      const premium =
        data.isPremium && !data.imagePath && !video && data.content
          ? await sendTextWithPremiumEmojis({
              userId,
              chatId: c.chat_id,
              text: data.content,
              strict: true,
              buttonRows,
            })
          : { applied: false as const, reason: "skip" };
      if (premium.applied) {
        r = premium.ok
          ? { ok: true, result: { message_id: premium.messageId ?? undefined } }
          : { ok: false, description: premium.error };
      } else if (data.imagePath) {
        const { data: pub } = supabaseAdmin.storage
          .from("room-images")
          .getPublicUrl(data.imagePath);
        if (data.isPremium) {
          const premiumPhoto = await sendPhotoWithPremiumEmojiCaption({
            userId,
            chatId: c.chat_id,
            photoUrl: pub.publicUrl,
            caption: data.content ?? null,
            strict: true,
            buttonRows,
          });
          if (premiumPhoto.applied) {
            r = premiumPhoto.ok
              ? { ok: true, result: { message_id: premiumPhoto.messageId ?? undefined } }
              : { ok: false, description: premiumPhoto.error };
          } else {
            r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
              chat_id: c.chat_id,
              photo: pub.publicUrl,
              caption: captionForMedia ?? undefined,
              parse_mode: captionForMedia ? captionParseMode : undefined,
              reply_markup: replyMarkup,
            });
          }
        } else {
          r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
            chat_id: c.chat_id,
            photo: pub.publicUrl,
            caption: captionForMedia ?? undefined,
            parse_mode: captionForMedia ? captionParseMode : undefined,
            reply_markup: replyMarkup,
          });
        }
      } else if (video) {
        if (isNormalVideo) {
          r = await dispatchVideo({
            botToken: acc.bot_token,
            storagePath: video.storage_path,
            chatId: c.chat_id,
            duration: video.duration_seconds,
            mimeType: video.mime_type,
            filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
            caption: captionForMedia,
            parseMode: captionParseMode,
            replyMarkup,
          });
        } else {
          r = await dispatchVideoNote({
            botToken: acc.bot_token,
            storagePath: video.storage_path,
            chatId: c.chat_id,
            duration: video.duration_seconds,
            mimeType: video.mime_type,
            filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
          });
        }
      } else {
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
          chat_id: c.chat_id,
          text: data.content ?? "",
          parse_mode: data.parseMode,
          reply_markup: replyMarkup,
        });
      }
      await supabaseAdmin.from("message_logs").insert({
        user_id: userId,
        account_id: accountId,
        chat_id: c.chat_id,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : r.description ?? "erro",
      } as never);
      if (r.ok) sent++;
      else {
        failed++;
        lastError = r.description ?? "erro";
      }
    }
    return { ok: sent > 0, sent, failed, error: lastError };
  });
