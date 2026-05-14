import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callTelegram, type TelegramUser, type TelegramUpdate } from "./telegram.server";

export const verifyAccount = createServerFn({ method: "POST" })
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
    const { supabase } = context;
    const { data: acc, error } = await supabase
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    const r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
      chat_id: data.chatId,
      text: data.text,
      parse_mode: "HTML",
    });
    if (!r.ok) return { ok: false, error: r.description };
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