import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { dispatchVideoNote } from "@/lib/videos.functions";

const TimeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const FollowUpInput = z.object({
  delayMinutes: z.number().int().min(1).max(1440),
  content: z.string().max(4000).nullable().optional(),
  imagePath: z.string().max(500).nullable().optional(),
  imageMime: z.string().max(100).nullable().optional(),
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
        content: f.content ?? null,
        image_path: f.imagePath ?? null,
        image_mime: f.imageMime ?? null,
      })),
      is_premium: data.isPremium,
      is_active: data.isActive,
      timezone: data.timezone,
    };
    if (data.id) {
      const { error } = await supabase.from("recurring_schedules").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("recurring_schedules")
      .insert(row)
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
        "id, user_id, room_id, account_id, content, video_id, image_path, image_mime, parse_mode",
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

    let video: { storage_path: string; mime_type: string | null; duration_seconds: number | null; title: string } | null = null;
    if (s.video_id) {
      const { data: v } = await supabaseAdmin
        .from("videos")
        .select("storage_path, mime_type, duration_seconds, title")
        .eq("id", s.video_id)
        .maybeSingle();
      video = v ?? null;
    }

    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;
    for (const c of chats) {
      const r = s.image_path
        ? await (async () => {
            const { data: pub } = supabaseAdmin.storage
              .from("room-images")
              .getPublicUrl(s.image_path!);
            return await callTelegram<{ message_id: number }>(
              acc.bot_token,
              "sendPhoto",
              {
                chat_id: c.chat_id,
                photo: pub.publicUrl,
                caption: s.content ?? undefined,
                parse_mode: s.content ? s.parse_mode : undefined,
              },
            );
          })()
        : video
        ? await dispatchVideoNote({
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
          });
      await supabaseAdmin.from("message_logs").insert({
        user_id: userId,
        chat_id: c.chat_id,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : r.description ?? "erro",
      });
      if (r.ok) sent++;
      else {
        failed++;
        lastError = r.description ?? "erro";
      }
    }
    return { ok: sent > 0, sent, failed, error: lastError };
  });
