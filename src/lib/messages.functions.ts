import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callTelegram } from "./telegram.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const scheduleMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().uuid(),
      accountId: z.string().uuid(),
      content: z.string().min(1).max(4000),
      scheduledAt: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("scheduled_messages").insert({
      user_id: userId,
      room_id: data.roomId,
      account_id: data.accountId,
      content: data.content,
      scheduled_at: data.scheduledAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scheduled_messages")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dispatchDue = createServerFn({ method: "POST" }).handler(async () => {
  const now = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("scheduled_messages")
    .select("id, user_id, room_id, account_id, content, parse_mode")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .limit(50);
  if (error) throw new Error(error.message);
  if (!due?.length) return { processed: 0 };

  let processed = 0;
  for (const msg of due) {
    await supabaseAdmin.from("scheduled_messages").update({ status: "sending" }).eq("id", msg.id);

    const { data: acc } = await supabaseAdmin
      .from("telegram_accounts")
      .select("bot_token")
      .eq("id", msg.account_id!)
      .maybeSingle();
    const { data: chats } = await supabaseAdmin
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", msg.room_id);

    if (!acc || !chats?.length) {
      await supabaseAdmin
        .from("scheduled_messages")
        .update({ status: "failed", last_error: "Conta ou grupo inválido" })
        .eq("id", msg.id);
      continue;
    }

    let anyOk = false;
    let lastErr: string | null = null;
    for (const c of chats) {
      const r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
        chat_id: c.chat_id,
        text: msg.content,
        parse_mode: msg.parse_mode,
      });
      await supabaseAdmin.from("message_logs").insert({
        scheduled_message_id: msg.id,
        user_id: msg.user_id,
        chat_id: c.chat_id,
        ok: r.ok,
        telegram_message_id: r.result?.message_id ?? null,
        error: r.ok ? null : r.description ?? "erro",
      });
      if (r.ok) anyOk = true;
      else lastErr = r.description ?? "erro";
    }

    await supabaseAdmin
      .from("scheduled_messages")
      .update({
        status: anyOk ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        last_error: anyOk ? null : lastErr,
      })
      .eq("id", msg.id);

    if (anyOk) {
      await supabaseAdmin.from("credit_transactions").insert({
        user_id: msg.user_id,
        delta: -chats.length,
        reason: `Envio agendamento ${msg.id}`,
      });
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", msg.user_id)
        .maybeSingle();
      if (prof) {
        await supabaseAdmin
          .from("profiles")
          .update({ credits: Math.max(0, (prof.credits ?? 0) - chats.length) })
          .eq("id", msg.user_id);
      }
    }
    processed++;
  }
  return { processed };
});