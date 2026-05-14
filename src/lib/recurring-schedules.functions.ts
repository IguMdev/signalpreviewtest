import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TimeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

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
