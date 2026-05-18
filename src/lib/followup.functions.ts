import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";

const TimeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FollowupMessageRow = {
  id: string;
  user_id: string;
  room_id: string;
  day_number: number;
  send_time: string;
  content: string | null;
  image_path: string | null;
  image_mime: string | null;
  video_id: string | null;
  parse_mode: string;
  premium_enabled: boolean;
  premium_account_id: string | null;
  button_text: string | null;
  button_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type FollowupSettingsRow = {
  room_id: string;
  user_id: string;
  enabled: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type FollowupLeadRow = {
  id: string;
  user_id: string;
  room_id: string;
  account_id: string;
  tg_user_id: number;
  chat_id: number;
  first_name: string | null;
  username: string | null;
  status: string;
  started_at: string;
  last_sent_day: number | null;
  last_sent_at: string | null;
  stopped_at: string | null;
  stopped_reason: string | null;
};

// ===== Settings =====

export const getFollowupSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [settings, cta] = await Promise.all([
      supabase.from("followup_settings" as never).select("*").eq("room_id", data.roomId).maybeSingle(),
      supabase
        .from("room_engagement_settings")
        .select("followup_cta_enabled, followup_cta_button_text")
        .eq("room_id", data.roomId)
        .maybeSingle(),
    ]);
    return {
      settings: (settings.data as FollowupSettingsRow | null) ?? null,
      cta: (cta.data as { followup_cta_enabled: boolean; followup_cta_button_text: string } | null) ?? null,
    };
  });

export const upsertFollowupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        roomId: z.string().uuid(),
        enabled: z.boolean(),
        timezone: z.string().max(64).default("America/Sao_Paulo"),
        ctaEnabled: z.boolean(),
        ctaButtonText: z.string().min(1).max(64),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: e1 } = await supabase
      .from("followup_settings" as never)
      .upsert(
        {
          room_id: data.roomId,
          user_id: userId,
          enabled: data.enabled,
          timezone: data.timezone,
        } as never,
        { onConflict: "room_id" },
      );
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase
      .from("room_engagement_settings")
      .upsert(
        {
          room_id: data.roomId,
          user_id: userId,
          followup_cta_enabled: data.ctaEnabled,
          followup_cta_button_text: data.ctaButtonText,
        } as never,
        { onConflict: "room_id" },
      );
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

// ===== Messages =====

export const listFollowupMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("followup_messages" as never)
      .select("*")
      .eq("room_id", data.roomId)
      .order("day_number", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows as FollowupMessageRow[] | null) ?? [];
  });

const MessageInput = z.object({
  id: z.string().uuid().optional(),
  roomId: z.string().uuid(),
  dayNumber: z.number().int().min(1).max(365),
  sendTime: z.string().regex(TimeRe).default("09:00"),
  content: z.string().max(4000).nullable().optional(),
  imagePath: z.string().max(500).nullable().optional(),
  imageMime: z.string().max(100).nullable().optional(),
  videoId: z.string().uuid().nullable().optional(),
  parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).default("HTML"),
  premiumEnabled: z.boolean().default(false),
  premiumAccountId: z.string().uuid().nullable().optional(),
  buttonText: z.string().max(64).nullable().optional(),
  buttonUrl: z.string().url().max(2048).nullable().optional(),
});

export const upsertFollowupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => MessageInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      room_id: data.roomId,
      day_number: data.dayNumber,
      send_time: data.sendTime,
      content: data.content ?? null,
      image_path: data.imagePath ?? null,
      image_mime: data.imageMime ?? null,
      video_id: data.videoId ?? null,
      parse_mode: data.parseMode,
      premium_enabled: data.premiumEnabled,
      premium_account_id: data.premiumAccountId ?? null,
      button_text: data.buttonText ?? null,
      button_url: data.buttonUrl ?? null,
      sort_order: data.dayNumber,
    };
    if (data.id) {
      const { error } = await supabase
        .from("followup_messages" as never)
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("followup_messages" as never)
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (ins as { id: string }).id };
  });

export const deleteFollowupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("followup_messages" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Leads =====

export const listFollowupLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("followup_leads" as never)
      .select("*")
      .eq("room_id", data.roomId)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const list = (rows as FollowupLeadRow[] | null) ?? [];
    const counts = { active: 0, stopped: 0, completed: 0 };
    for (const r of list) {
      const s = String(r.status ?? "");
      if (s === "active") counts.active++;
      else if (s === "stopped") counts.stopped++;
      else if (s === "completed") counts.completed++;
    }
    return { leads: list, counts };
  });

export const setFollowupLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "stopped"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("followup_leads" as never)
      .update({
        status: data.status,
        stopped_at: data.status === "stopped" ? new Date().toISOString() : null,
        stopped_reason: data.status === "stopped" ? "manual" : null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Test =====

export const testFollowupMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), chatId: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: msg } = await supabaseAdmin
      .from("followup_messages" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!msg || (msg as FollowupMessageRow).user_id !== userId) {
      throw new Error("Mensagem não encontrada");
    }
    const m = msg as FollowupMessageRow;
    // Find any bot account belonging to user to use as sender
    const { data: acc } = await supabaseAdmin
      .from("telegram_accounts")
      .select("bot_token")
      .eq("user_id", userId)
      .eq("account_type", "bot")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!acc?.bot_token) throw new Error("Nenhuma conta de bot ativa");
    const r = await callTelegram(acc.bot_token, "sendMessage", {
      chat_id: data.chatId,
      text: m.content ?? "(sem conteúdo)",
      parse_mode: m.parse_mode ?? "HTML",
      reply_markup:
        m.button_text && m.button_url
          ? { inline_keyboard: [[{ text: m.button_text, url: m.button_url }]] }
          : undefined,
    });
    if (!r.ok) throw new Error(r.description ?? "Falha no envio");
    return { ok: true };
  });