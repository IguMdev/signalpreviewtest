/* -------------------------------------------------------------------------- */
/*                                  IMPORTS                                   */
/* -------------------------------------------------------------------------- */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { dispatchVideoNote, dispatchVideo, loadVideoThumbnail } from "@/lib/videos.functions";
import {
  sendPhotoWithPremiumEmojiCaption,
  sendTextWithPremiumEmojis,
  sendVideoWithPremiumEmojiCaption,
  getUserEmojiLookup,
} from "@/lib/premium-send.server";
import {
  renderEmojiTokensToHtml,
  renderEmojiTokensPlain,
  hasEmojiTokens,
} from "@/lib/premium-emoji-render";
import { triggerSignalReactions } from "@/lib/engagement.functions";

async function renderButtonTextForUser(
  userId: string,
  buttonText: string | null | undefined,
): Promise<string | null> {
  if (!buttonText) return null;
  if (!hasEmojiTokens(buttonText)) return buttonText;
  const lookup = await getUserEmojiLookup(userId);
  return renderEmojiTokensPlain(buttonText, lookup);
}

const TimeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

type TelegramResult = { ok: boolean; result?: { message_id?: number }; description?: string };

async function sendCompanionButtonMessage(
  botToken: string | null | undefined,
  chatId: number | string,
  replyMarkup: unknown,
): Promise<TelegramResult> {
  if (!replyMarkup) return { ok: true };
  return await callTelegram<{ message_id: number }>(botToken, "sendMessage", {
    chat_id: chatId,
    text: "\u2063",
    reply_markup: replyMarkup,
  });
}

async function withCompanionButton(
  primary: TelegramResult,
  botToken: string | null | undefined,
  chatId: number | string,
  replyMarkup: unknown,
): Promise<TelegramResult> {
  if (!primary.ok || !replyMarkup) return primary;
  const button = await sendCompanionButtonMessage(botToken, chatId, replyMarkup);
  if (!button.ok) {
    return {
      ok: false,
      result: primary.result,
      description: `Mensagem enviada, mas o botão falhou: ${button.description ?? "erro"}`,
    };
  }
  return primary;
}

const FollowUpInput = z.object({
  delayMinutes: z.number().int().min(1).max(1440),
  delaySeconds: z.number().int().min(1).max(86400).nullable().optional(),
  content: z.string().max(4000).nullable().optional(),
  imagePath: z.string().max(500).nullable().optional(),
  imageMime: z.string().max(100).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  audioId: z.string().uuid().nullable().optional(),
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
  audioId: z.string().uuid().nullable().optional(),
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
  folderId: z.string().uuid().nullable().optional(),
});

/* -------------------------------------------------------------------------- */
/*                             SERVER FUNCTIONS                               */
/* -------------------------------------------------------------------------- */

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
      audio_id: data.audioId ?? null,
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
        audio_id: f.audioId ?? null,
        button_text: f.buttonText ?? null,
        button_url: f.buttonUrl ?? null,
      })),
      is_premium: data.isPremium,
      is_active: data.isActive,
      timezone: data.timezone,
      button_text: data.buttonText ?? null,
      button_url: data.buttonUrl ?? null,
      folder_id: data.folderId ?? null,
    };
    if (data.id) {
      const { error } = await (supabase as any)
        .from("recurring_schedules" as any)
        .update(row as any)
        .eq("id" as any, data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = (await (supabase as any)
      .from("recurring_schedules" as any)
      .insert(row as any)
      .select("id")
      .single()) as any;
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const toggleSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("recurring_schedules" as any)
      .update({ is_active: data.isActive } as any)
      .eq("id" as any, data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("recurring_schedules" as any).delete().eq("id" as any, data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: s, error } = (await (supabaseAdmin as any)
      .from("recurring_schedules")
      .select(
        "id, user_id, room_id, account_id, content, video_id, audio_id, image_path, image_mime, parse_mode, is_premium, button_text, button_url, follow_ups",
      )
      .eq("id" as any, data.id)
      .maybeSingle()) as any;
    if (error) throw new Error(error.message);
    if (!s || (s as any).user_id !== userId) throw new Error("Agendamento não encontrado");

    let accountId = (s as any).account_id as string | null;
    if (!accountId) {
      const { data: room } = await supabaseAdmin
        .from("rooms")
        .select("default_account_id, is_active")
        .eq("id", s.room_id)
        .maybeSingle();
      if (!room?.is_active) throw new Error("Sala inativa (is_active=false). Ignorando envio.");
      accountId = (room?.default_account_id as string | null) ?? null;
    } else {
      const { data: room } = await supabaseAdmin
        .from("rooms")
        .select("is_active")
        .eq("id", s.room_id)
        .maybeSingle();
      if (!room?.is_active) throw new Error("Sala inativa (is_active=false). Ignorando envio.");
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

    type VideoRow = {
      storage_path: string;
      mime_type: string | null;
      duration_seconds: number | null;
      title: string;
      kind: string | null;
      width: number | null;
      height: number | null;
    };
    const loadVideo = async (videoId: string | null | undefined): Promise<VideoRow | null> => {
      if (!videoId) return null;
      const { data: v } = await supabaseAdmin
        .from("videos")
        .select("storage_path, mime_type, duration_seconds, title, kind, width, height")
        .eq("id", videoId)
        .maybeSingle();
      return (v as VideoRow | null) ?? null;
    };

    type AudioRow = {
      storage_path: string;
      duration_seconds: number | null;
      title: string;
    };
    const loadAudio = async (audioId: string | null | undefined): Promise<AudioRow | null> => {
      if (!audioId) return null;
      const { data: a } = await (supabaseAdmin as any)
        .from("audios")
        .select("storage_path, duration_seconds, title")
        .eq("id", audioId)
        .maybeSingle();
      return (a as AudioRow | null) ?? null;
    };

    type Payload = {
      content: string | null;
      image_path: string | null;
      video: VideoRow | null;
      audio: AudioRow | null;
      parse_mode: string;
      is_premium: boolean;
    };
    const sendPayload = async (p: Payload): Promise<{ sent: number; failed: number; lastError: string | null }> => {
      let sent = 0;
      let failed = 0;
      let lastError: string | null = null;
      const video = p.video;
      const audio = p.audio;
      const isNormalVideo = video && video.kind === "normal";
      for (const c of chats) {
      let r: { ok: boolean; result?: { message_id?: number }; description?: string } = {
        ok: false,
        description: "no-op",
      };
      const replyMarkup = undefined;
      const premium =
        p.is_premium && !p.image_path && !video && p.content
          ? await sendTextWithPremiumEmojis({
              userId: s.user_id,
              chatId: c.chat_id,
              text: p.content,
              strict: true,
            })
          : { applied: false as const, reason: "skip" };
      if (premium.applied) {
        r = await withCompanionButton(
          premium.ok
            ? { ok: true, result: { message_id: premium.messageId ?? undefined } }
            : { ok: false, description: premium.error },
          acc.bot_token,
          c.chat_id,
          replyMarkup,
        );
      } else
        r = p.image_path
          ? await (async () => {
              const { data: pub } = supabaseAdmin.storage
                .from("room-images")
                .getPublicUrl(p.image_path!);
              if (p.is_premium) {
                const premiumPhoto = await sendPhotoWithPremiumEmojiCaption({
                  userId: s.user_id,
                  chatId: c.chat_id,
                  photoUrl: pub.publicUrl,
                  caption: p.content,
                  strict: true,
                });
                if (premiumPhoto.applied) {
                  return await withCompanionButton(
                    premiumPhoto.ok
                      ? { ok: true, result: { message_id: premiumPhoto.messageId ?? undefined } }
                      : { ok: false, description: premiumPhoto.error },
                    acc.bot_token,
                    c.chat_id,
                    replyMarkup,
                  );
                }
              }
              return await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
                chat_id: c.chat_id,
                photo: pub.publicUrl,
                caption: p.content ?? undefined,
                parse_mode: p.content ? p.parse_mode : undefined,
                reply_markup: replyMarkup,
              });
            })()
          : video
            ? isNormalVideo
              ? await (async () => {
                  if (p.is_premium && p.content && hasEmojiTokens(p.content)) {
                    const { data: file } = await supabaseAdmin.storage
                      .from("videos")
                      .download(video!.storage_path);
                    if (file) {
                      const bytes = await file.arrayBuffer();
                      const pv = await sendVideoWithPremiumEmojiCaption({
                        userId: s.user_id,
                        chatId: c.chat_id,
                        videoBytes: bytes,
                        thumbnailBytes: await loadVideoThumbnail(video!.storage_path),
                        filename: (video!.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
                        mimeType: video!.mime_type ?? "video/mp4",
                        duration: video!.duration_seconds,
                        width: video!.width,
                        height: video!.height,
                        caption: p.content,
                        strict: true,
                      });
                      if (pv.applied) {
                        return await withCompanionButton(
                          pv.ok
                            ? { ok: true, result: { message_id: pv.messageId ?? undefined } }
                            : { ok: false, description: pv.error },
                          acc.bot_token,
                          c.chat_id,
                          replyMarkup,
                        );
                      }
                    }
                  }
                  return await dispatchVideo({
                    botToken: acc.bot_token,
                    storagePath: video!.storage_path,
                    chatId: c.chat_id,
                    duration: video!.duration_seconds,
                    width: video!.width,
                    height: video!.height,
                    mimeType: video!.mime_type,
                    filename: (video!.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
                    caption: p.content,
                    parseMode: p.parse_mode,
                    replyMarkup,
                  });
                })()
              : await dispatchVideoNote({
                  botToken: acc.bot_token,
                  storagePath: video.storage_path,
                  chatId: c.chat_id,
                  duration: video.duration_seconds,
                  mimeType: video.mime_type,
                  filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
                })
            : audio
              ? await (async () => {
                  const { data: fileData, error } = await supabaseAdmin.storage.from("audio-files").download(audio.storage_path);
                  if (error || !fileData) return { ok: false, description: "Falha ao baixar áudio" };
                  const bytes = await fileData.arrayBuffer();
                  const { sendVoiceToChat } = await import("@/lib/audios.functions");
                  return await sendVoiceToChat({
                    botToken: acc.bot_token,
                    chatId: c.chat_id,
                    fileBytes: bytes,
                    filename: audio.title + ".ogg",
                    mimeType: "audio/ogg",
                    duration: audio.duration_seconds,
                    caption: p.content,
                  });
                })()
            : await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
                chat_id: c.chat_id,
                text: p.content ?? "",
                parse_mode: p.parse_mode,
                reply_markup: replyMarkup,
                link_preview_options: { is_disabled: true },
              });
      await supabaseAdmin.from("message_logs").insert({
        user_id: userId,
        account_id: accountId,
        chat_id: c.chat_id,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : (r.description ?? "erro"),
      } as never);
      if (r.ok) sent++;
      else {
        failed++;
        lastError = r.description ?? "erro";
      }
      if (r.ok && r.result?.message_id) {
        await triggerSignalReactions({
          userId,
          chatId: c.chat_id,
          telegramMessageId: r.result.message_id,
          roomId: s.room_id,
        });
      }
      }
      return { sent, failed, lastError };
    };

    const mainVideo = await loadVideo(s.video_id);
    const mainAudio = await loadAudio(s.audio_id);
    const mainRes = await sendPayload({
      content: s.content ?? null,
      image_path: s.image_path ?? null,
      video: mainVideo,
      audio: mainAudio,
      parse_mode: s.parse_mode,
      is_premium: !!s.is_premium,
    });
    let sent = mainRes.sent;
    let failed = mainRes.failed;
    let lastError = mainRes.lastError;

    const fups = Array.isArray(s.follow_ups) ? (s.follow_ups as Array<Record<string, unknown>>) : [];
    for (const f of fups) {
      const fVideo = await loadVideo((f.video_id as string | null) ?? null);
      const fAudio = await loadAudio((f.audio_id as string | null) ?? null);
      const fr = await sendPayload({
        content: (f.content as string | null) ?? null,
        image_path: (f.image_path as string | null) ?? null,
        video: fVideo,
        audio: fAudio,
        parse_mode: s.parse_mode,
        is_premium: !!s.is_premium,
      });
      sent += fr.sent;
      failed += fr.failed;
      if (fr.lastError) lastError = fr.lastError;
    }
    return { ok: sent > 0, sent, failed, error: lastError };
  });

const TestMessageInput = z.object({
  roomId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  content: z.string().max(4000).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  audioId: z.string().uuid().nullable().optional(),
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

    let video: {
      storage_path: string;
      mime_type: string | null;
      duration_seconds: number | null;
      title: string;
      kind: string | null;
      width: number | null;
      height: number | null;
    } | null = null;
    if (data.videoId) {
      const { data: v } = await supabaseAdmin
        .from("videos")
        .select("storage_path, mime_type, duration_seconds, title, kind, width, height")
        .eq("id", data.videoId)
        .maybeSingle();
      video = v ?? null;
    }

    let mainAudio: {
      storage_path: string;
      duration_seconds: number | null;
      title: string;
    } | null = null;
    if (data.audioId) {
      const { data: a } = (await (supabaseAdmin as any)
        .from("audios")
        .select("storage_path, duration_seconds, title")
        .eq("id", data.audioId)
        .maybeSingle()) as any;
      mainAudio = a ?? null;
    }

    const replyMarkup = undefined;
    const isNormalVideo = video && video.kind === "normal";

    // Auto-ativa caminho premium se houver tokens {NOME} no conteúdo,
    // mesmo que o toggle "Usar emoji premium" esteja desligado no diálogo.
    const wantsPremium = data.isPremium || hasEmojiTokens(data.content ?? "");

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
      let r: { ok: boolean; result?: { message_id?: number }; description?: string } = {
        ok: false,
        description: "no-op",
      };
      const premium =
        wantsPremium && !data.imagePath && !video && data.content
          ? await sendTextWithPremiumEmojis({
              userId,
              chatId: c.chat_id,
              text: data.content,
              strict: true,
            })
          : { applied: false as const, reason: "skip" };
      if (premium.applied) {
        r = await withCompanionButton(
          premium.ok
            ? { ok: true, result: { message_id: premium.messageId ?? undefined } }
            : { ok: false, description: premium.error },
          acc.bot_token,
          c.chat_id,
          replyMarkup,
        );
      } else if (data.imagePath) {
        const { data: pub } = supabaseAdmin.storage
          .from("room-images")
          .getPublicUrl(data.imagePath);
        if (wantsPremium) {
          const premiumPhoto = await sendPhotoWithPremiumEmojiCaption({
            userId,
            chatId: c.chat_id,
            photoUrl: pub.publicUrl,
            caption: data.content ?? null,
            strict: true,
          });
          if (premiumPhoto.applied) {
            r = await withCompanionButton(
              premiumPhoto.ok
                ? { ok: true, result: { message_id: premiumPhoto.messageId ?? undefined } }
                : { ok: false, description: premiumPhoto.error },
              acc.bot_token,
              c.chat_id,
              replyMarkup,
            );
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
          let premiumVideoOk = false;
          if (wantsPremium && data.content && hasEmojiTokens(data.content)) {
            const { data: file } = await supabaseAdmin.storage
              .from("videos")
              .download(video.storage_path);
            if (file) {
              const bytes = await file.arrayBuffer();
              const pv = await sendVideoWithPremiumEmojiCaption({
                userId,
                chatId: c.chat_id,
                videoBytes: bytes,
                thumbnailBytes: await loadVideoThumbnail(video.storage_path),
                filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
                mimeType: video.mime_type ?? "video/mp4",
                duration: video.duration_seconds,
                width: video.width,
                height: video.height,
                caption: data.content,
                strict: true,
              });
              if (pv.applied) {
                r = await withCompanionButton(
                  pv.ok
                    ? { ok: true, result: { message_id: pv.messageId ?? undefined } }
                    : { ok: false, description: pv.error },
                  acc.bot_token,
                  c.chat_id,
                  replyMarkup,
                );
                premiumVideoOk = true;
              }
            }
          }
          if (!premiumVideoOk) {
            r = await dispatchVideo({
              botToken: acc.bot_token,
              storagePath: video.storage_path,
              chatId: c.chat_id,
              duration: video.duration_seconds,
              width: video.width,
              height: video.height,
              mimeType: video.mime_type,
              filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
              caption: captionForMedia,
              parseMode: captionParseMode,
              replyMarkup,
            });
          }
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
      } else if (mainAudio) {
        const { data: fileData, error } = await supabaseAdmin.storage.from("audio-files").download((mainAudio as any).storage_path);
        if (error || !fileData) {
          r = { ok: false, description: "Falha ao baixar áudio" };
        } else {
          const bytes = await fileData.arrayBuffer();
          const { sendVoiceToChat } = await import("@/lib/audios.functions");
          r = await sendVoiceToChat({
            botToken: acc.bot_token,
            chatId: c.chat_id,
            fileBytes: bytes,
            filename: (mainAudio as any).title + ".ogg",
            mimeType: "audio/ogg",
            duration: (mainAudio as any).duration_seconds,
            caption: data.content,
          });
        }
      } else {
        r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
          chat_id: c.chat_id,
          text: data.content ?? "",
          parse_mode: data.parseMode,
          reply_markup: replyMarkup,
          link_preview_options: { is_disabled: true },
        });
      }
      await supabaseAdmin.from("message_logs").insert({
        user_id: userId,
        account_id: accountId,
        chat_id: c.chat_id,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : (r.description ?? "erro"),
      } as never);
      if (r.ok) sent++;
      else {
        failed++;
        lastError = r.description ?? "erro";
      }
      if (r.ok && r.result?.message_id) {
        await triggerSignalReactions({
          userId,
          chatId: c.chat_id,
          telegramMessageId: r.result.message_id,
          roomId: data.roomId,
        });
      }
    }
    return { ok: sent > 0, sent, failed, error: lastError };
  });
