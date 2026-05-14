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

export const getCurrentMemberCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("id, name, default_account_id, premium_account_id, room_chats(chat_id, chat_title)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const accountIds = Array.from(
      new Set(
        (rooms ?? [])
          .map((room) => room.default_account_id ?? room.premium_account_id)
          .filter(Boolean) as string[],
      ),
    );

    const { data: accounts, error: accountsError } = await supabase
      .from("telegram_accounts")
      .select("id, bot_token, label, bot_username")
      .in("id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
    if (accountsError) throw new Error(accountsError.message);
    const accountById = new Map((accounts ?? []).map((account) => [account.id, account]));

    const results: Array<{
      roomId: string;
      roomName: string;
      chatId: number;
      chatTitle: string | null;
      accountLabel: string | null;
      count: number | null;
      error: string | null;
    }> = [];

    for (const room of rooms ?? []) {
      const accountId = room.default_account_id ?? room.premium_account_id;
      const account = accountId ? accountById.get(accountId) : null;
      for (const chat of room.room_chats ?? []) {
        if (!account?.bot_token) {
          results.push({
            roomId: room.id,
            roomName: room.name,
            chatId: chat.chat_id,
            chatTitle: chat.chat_title,
            accountLabel: account?.label ?? null,
            count: null,
            error: "Sala sem bot padrão com token.",
          });
          continue;
        }
        const response = await callTelegram<number>(account.bot_token, "getChatMemberCount", {
          chat_id: chat.chat_id,
        });
        results.push({
          roomId: room.id,
          roomName: room.name,
          chatId: chat.chat_id,
          chatTitle: chat.chat_title,
          accountLabel: account.label ?? account.bot_username ?? null,
          count: response.ok ? response.result ?? 0 : null,
          error: response.ok ? null : response.description ?? "Falha ao consultar membros.",
        });
      }
    }

    return {
      total: results.reduce((sum, row) => sum + (row.count ?? 0), 0),
      chats: results,
    };
  });