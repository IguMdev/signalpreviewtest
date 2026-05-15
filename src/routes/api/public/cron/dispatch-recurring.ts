import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { dispatchVideoNote, dispatchVideo } from "@/lib/videos.functions";
import { triggerSignalReactions } from "@/lib/engagement.functions";
import { sendPhotoWithPremiumEmojiCaption, sendTextWithPremiumEmojis } from "@/lib/premium-send.server";

function nowParts(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  const weekday = wdMap[get("weekday")] ?? 0;
  const hh = get("hour").padStart(2, "0");
  const mm = get("minute").padStart(2, "0");
  return { weekday, hhmm: `${hh}:${mm}` };
}

type Schedule = {
  id: string;
  user_id: string;
  room_id: string;
  account_id: string | null;
  content: string | null;
  video_id: string | null;
  image_path: string | null;
  image_mime: string | null;
  parse_mode: string;
  is_premium: boolean;
  times: string[];
  weekdays: number[];
  weekday_overrides: Record<string, string[]> | null;
  follow_ups: Array<{
    delay_minutes: number;
    delay_seconds?: number | null;
    content: string | null;
    image_path: string | null;
    image_mime: string | null;
    video_id: string | null;
  }> | null;
  timezone: string;
  last_fire_key: string | null;
  button_text?: string | null;
  button_url?: string | null;
};

type PendingFollowup = {
  id: string;
  schedule_id: string | null;
  user_id: string;
  room_id: string;
  account_id: string | null;
  content: string | null;
  image_path: string | null;
  image_mime: string | null;
  video_id: string | null;
  parse_mode: string;
};

async function sendOne(
  botToken: string | null | undefined,
  chatId: number | string,
  msg: { content: string | null; image_path: string | null; parse_mode: string; user_id?: string; is_premium?: boolean; reply_markup?: unknown },
): Promise<{ ok: boolean; result?: { message_id?: number }; description?: string }> {
  if (!msg.image_path && msg.content && msg.user_id && msg.is_premium) {
    const premium = await sendTextWithPremiumEmojis({
      userId: msg.user_id,
      chatId,
      text: msg.content,
      strict: true,
    });
    if (premium.applied) {
      return premium.ok
        ? { ok: true, result: { message_id: premium.messageId ?? undefined } }
        : { ok: false, description: premium.error };
    }
  }
  if (msg.image_path) {
    const { data: pub } = supabaseAdmin.storage.from("room-images").getPublicUrl(msg.image_path);
    if (msg.is_premium && msg.user_id) {
      const premiumPhoto = await sendPhotoWithPremiumEmojiCaption({
        userId: msg.user_id,
        chatId,
        photoUrl: pub.publicUrl,
        caption: msg.content,
        strict: true,
      });
      if (premiumPhoto.applied) {
        return premiumPhoto.ok
          ? { ok: true, result: { message_id: premiumPhoto.messageId ?? undefined } }
          : { ok: false, description: premiumPhoto.error };
      }
    }
    return await callTelegram<{ message_id: number }>(botToken, "sendPhoto", {
      chat_id: chatId,
      photo: pub.publicUrl,
      caption: msg.content ?? undefined,
      parse_mode: msg.content ? msg.parse_mode : undefined,
      reply_markup: msg.reply_markup,
    });
  }
  return await callTelegram<{ message_id: number }>(botToken, "sendMessage", {
    chat_id: chatId,
    text: msg.content ?? "",
    parse_mode: msg.parse_mode,
    reply_markup: msg.reply_markup,
  });
}

export const Route = createFileRoute("/api/public/cron/dispatch-recurring")({
  server: {
    handlers: {
      POST: async () => {
        const { data: schedules, error } = await supabaseAdmin
          .from("recurring_schedules")
          .select(
            "id, user_id, room_id, account_id, content, video_id, image_path, image_mime, parse_mode, is_premium, times, weekdays, weekday_overrides, follow_ups, timezone, last_fire_key, button_text, button_url",
          )
          .eq("is_active", true);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const now = new Date();
        const dateKey = now.toISOString().slice(0, 16); // UTC YYYY-MM-DDTHH:MM
        let processed = 0;
        let fired = 0;

        for (const s of (schedules ?? []) as Schedule[]) {
          const { weekday, hhmm } = nowParts(s.timezone);
          if (!s.weekdays.includes(weekday)) continue;
          const override = s.weekday_overrides?.[String(weekday)];
          const effectiveTimes = override && override.length > 0 ? override : s.times;
          if (!effectiveTimes.includes(hhmm)) continue;
          if (s.last_fire_key === dateKey) continue;

          // claim this minute atomically
          const { data: claim } = await supabaseAdmin
            .from("recurring_schedules")
            .update({ last_fire_key: dateKey })
            .eq("id", s.id)
            .or(`last_fire_key.is.null,last_fire_key.neq.${dateKey}`)
            .select("id")
            .maybeSingle();
          if (!claim) continue;

          processed++;

          // resolve account
          let accountId = s.account_id;
          if (!accountId) {
            const { data: room } = await supabaseAdmin
              .from("rooms")
              .select("default_account_id")
              .eq("id", s.room_id)
              .maybeSingle();
            accountId = room?.default_account_id ?? null;
          }
          if (!accountId) continue;

          const { data: acc } = await supabaseAdmin
            .from("telegram_accounts")
            .select("bot_token")
            .eq("id", accountId)
            .maybeSingle();
          const { data: chats } = await supabaseAdmin
            .from("room_chats")
            .select("chat_id")
            .eq("room_id", s.room_id);
          if (!acc || !chats?.length) continue;

          let video: { storage_path: string; mime_type: string | null; duration_seconds: number | null; title: string; kind: string | null } | null = null;
          if (s.video_id) {
            const { data: v } = await supabaseAdmin
              .from("videos")
              .select("storage_path, mime_type, duration_seconds, title, kind")
              .eq("id", s.video_id)
              .maybeSingle();
            video = v ?? null;
          }
          const isNormalVideo = video && video.kind === "normal";
          const replyMarkup =
            s.button_text && s.button_url
              ? { inline_keyboard: [[{ text: s.button_text, url: s.button_url }]] }
              : undefined;

          let okAny = false;
          for (const c of chats) {
            let r: { ok: boolean; result?: { message_id?: number }; description?: string };
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
              user_id: s.user_id,
              account_id: accountId,
              chat_id: c.chat_id,
              ok: r.ok,
              telegram_message_id: r.result?.message_id ?? null,
              error: r.ok ? null : r.description ?? "erro",
            } as never);
            if (r.ok) okAny = true;
            if (r.ok && r.result?.message_id) {
              await triggerSignalReactions({
                userId: s.user_id,
                chatId: c.chat_id,
                telegramMessageId: r.result.message_id,
                roomId: s.room_id,
              });
            }
          }

          await supabaseAdmin
            .from("recurring_schedules")
            .update({ last_sent_at: new Date().toISOString() })
            .eq("id", s.id);
          if (okAny) fired++;

          // Enqueue follow-ups
          const fups = Array.isArray(s.follow_ups) ? s.follow_ups : [];
          if (fups.length > 0) {
            let cumulative = 0;
            const rows = fups.map((f) => {
              const sec =
                f.delay_seconds != null && Number(f.delay_seconds) > 0
                  ? Number(f.delay_seconds)
                  : Math.max(1, Number(f.delay_minutes) || 1) * 60;
              cumulative += sec;
              return {
                schedule_id: s.id,
                user_id: s.user_id,
                room_id: s.room_id,
                account_id: accountId,
                scheduled_at: new Date(Date.now() + cumulative * 1000).toISOString(),
                content: f.content ?? null,
                image_path: f.image_path ?? null,
                image_mime: f.image_mime ?? null,
                video_id: f.video_id ?? null,
                parse_mode: s.parse_mode,
              };
            });
            await supabaseAdmin.from("recurring_pending_followups").insert(rows);
          }
        }

        // Process due follow-ups
        const nowIso = new Date().toISOString();
        const { data: pendings } = await supabaseAdmin
          .from("recurring_pending_followups")
          .select("id, schedule_id, user_id, room_id, account_id, content, image_path, image_mime, video_id, parse_mode")
          .eq("status", "pending")
          .lte("scheduled_at", nowIso)
          .limit(100);

        let followupsFired = 0;
        for (const p of (pendings ?? []) as PendingFollowup[]) {
          // Claim
          const { data: claim } = await supabaseAdmin
            .from("recurring_pending_followups")
            .update({ status: "sending" })
            .eq("id", p.id)
            .eq("status", "pending")
            .select("id")
            .maybeSingle();
          if (!claim) continue;

          let accountId = p.account_id;
          if (!accountId) {
            const { data: room } = await supabaseAdmin
              .from("rooms")
              .select("default_account_id")
              .eq("id", p.room_id)
              .maybeSingle();
            accountId = room?.default_account_id ?? null;
          }
          if (!accountId) {
            await supabaseAdmin
              .from("recurring_pending_followups")
              .update({ status: "failed", last_error: "Sem conta" })
              .eq("id", p.id);
            continue;
          }
          const { data: acc } = await supabaseAdmin
            .from("telegram_accounts")
            .select("bot_token")
            .eq("id", accountId)
            .maybeSingle();
          const { data: chats } = await supabaseAdmin
            .from("room_chats")
            .select("chat_id")
            .eq("room_id", p.room_id);
          if (!acc || !chats?.length) {
            await supabaseAdmin
              .from("recurring_pending_followups")
              .update({ status: "failed", last_error: "Sem grupos" })
              .eq("id", p.id);
            continue;
          }

          let okAny = false;
          let lastErr: string | null = null;
          let video: { storage_path: string; mime_type: string | null; duration_seconds: number | null; title: string } | null = null;
          if (p.video_id) {
            const { data: v } = await supabaseAdmin
              .from("videos")
              .select("storage_path, mime_type, duration_seconds, title")
              .eq("id", p.video_id)
              .maybeSingle();
            video = v ?? null;
          }
          const { data: parentSchedule } = p.schedule_id
            ? await supabaseAdmin
                .from("recurring_schedules")
                .select("is_premium")
                .eq("id", p.schedule_id)
                .maybeSingle()
            : { data: null };
          const isPremium = Boolean(parentSchedule?.is_premium);
          for (const c of chats) {
            const r = video
              ? await dispatchVideoNote({
                  botToken: acc.bot_token,
                  storagePath: video.storage_path,
                  chatId: c.chat_id,
                  duration: video.duration_seconds,
                  mimeType: video.mime_type,
                  filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
                })
              : await sendOne(acc.bot_token, c.chat_id, {
                  content: p.content,
                  image_path: p.image_path,
                  parse_mode: p.parse_mode,
                  user_id: p.user_id,
                  is_premium: isPremium,
                });
            if (video && r.ok && p.content && p.content.trim()) {
              await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
                chat_id: c.chat_id,
                text: p.content,
                parse_mode: p.parse_mode,
              });
            }
            await supabaseAdmin.from("message_logs").insert({
              user_id: p.user_id,
              account_id: accountId,
              chat_id: c.chat_id,
              ok: r.ok,
              telegram_message_id: r.result?.message_id ?? null,
              error: r.ok ? null : r.description ?? "erro",
            } as never);
            if (r.ok) okAny = true;
            else lastErr = r.description ?? "erro";
            if (r.ok && r.result?.message_id) {
              await triggerSignalReactions({
                userId: p.user_id,
                chatId: c.chat_id,
                telegramMessageId: r.result.message_id,
                roomId: p.room_id,
              });
            }
          }
          await supabaseAdmin
            .from("recurring_pending_followups")
            .update({
              status: okAny ? "sent" : "failed",
              sent_at: new Date().toISOString(),
              last_error: okAny ? null : lastErr,
            })
            .eq("id", p.id);
          if (okAny) followupsFired++;
        }

        return Response.json({ ok: true, processed, fired, followupsFired });
      },
    },
  },
});
