import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callTelegram } from "./telegram.server";

function publicBaseUrl() {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const projectId = process.env.LOVABLE_PROJECT_ID || "8dafe7ca-cf53-49eb-9c75-fa970d91c13f";
  return `https://project--${projectId}-dev.lovable.app`;
}

export const enableMemberTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: acc, error } = await supabase
      .from("telegram_accounts")
      .select("id, bot_token")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");

    const url = `${publicBaseUrl()}/api/public/telegram/webhook/${acc.id}`;
    const secret = createHash("sha256").update(`tg-tracking:${acc.bot_token}`).digest("base64url");

    const r = await callTelegram<boolean>(acc.bot_token, "setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["chat_member", "my_chat_member", "message"],
      drop_pending_updates: false,
    });
    if (!r.ok) throw new Error(r.description ?? "Falha ao registrar webhook");
    return { ok: true, url };
  });

export const disableMemberTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: acc } = await supabase
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!acc) throw new Error("Conta não encontrada");
    const r = await callTelegram<boolean>(acc.bot_token, "deleteWebhook", {});
    if (!r.ok) throw new Error(r.description ?? "Falha");
    return { ok: true };
  });

export const getMemberStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ data: events }, { data: recent }] = await Promise.all([
      supabase
        .from("telegram_member_events")
        .select("event_type, occurred_at, chat_id, chat_title")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(5000),
      supabase
        .from("telegram_member_events")
        .select("id, chat_title, chat_id, tg_first_name, tg_username, event_type, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(15),
    ]);

    const list = events ?? [];
    let joinsToday = 0;
    let leavesToday = 0;
    let joins30 = 0;
    let leaves30 = 0;
    const byDay = new Map<string, { day: string; joins: number; leaves: number }>();
    const byChat = new Map<number, { chat_id: number; chat_title: string | null; joins: number; leaves: number }>();
    const todayMs = todayStart.getTime();

    for (const e of list) {
      const t = new Date(e.occurred_at).getTime();
      const day = new Date(e.occurred_at).toISOString().slice(0, 10);
      const bd = byDay.get(day) ?? { day, joins: 0, leaves: 0 };
      const isJoin = e.event_type === "join";
      const isLeave = e.event_type === "leave" || e.event_type === "kicked";
      if (isJoin) {
        joins30++;
        bd.joins++;
        if (t >= todayMs) joinsToday++;
      }
      if (isLeave) {
        leaves30++;
        bd.leaves++;
        if (t >= todayMs) leavesToday++;
      }
      byDay.set(day, bd);

      const bc = byChat.get(e.chat_id) ?? { chat_id: e.chat_id, chat_title: e.chat_title, joins: 0, leaves: 0 };
      if (isJoin) bc.joins++;
      if (isLeave) bc.leaves++;
      byChat.set(e.chat_id, bc);
    }

    return {
      joinsToday,
      leavesToday,
      joins30,
      leaves30,
      net30: joins30 - leaves30,
      daily: Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day)),
      perChat: Array.from(byChat.values()).sort((a, b) => b.joins - a.joins),
      recent: recent ?? [],
    };
  });