import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "./telegram.server";

type Origin =
  | { kind: "recurring"; id: string }
  | { kind: "scheduled"; id: string }
  | { kind: "template"; id: string };

/**
 * Mirrors a just-sent message to the forwarder's target chats using
 * Telegram's copyMessage. Silent no-op when:
 *  - forwarder is disabled
 *  - the room has no source chat configured
 *  - the sent chat differs from the configured source chat
 *  - the origin item is not marked
 *  - there are no target chats
 */
export async function mirrorIfMarked(opts: {
  roomId: string;
  fromChatId: number | string;
  messageId: number | undefined | null;
  origin: Origin;
}): Promise<void> {
  if (!opts.messageId) return;
  const { data: cfg } = await supabaseAdmin
    .from("room_engagement_settings")
    .select(
      "forwarder_enabled, forwarder_source_chat_id, forwarder_target_chat_ids, forwarder_marked_recurring, forwarder_marked_scheduled, forwarder_marked_templates",
    )
    .eq("room_id", opts.roomId)
    .maybeSingle();
  if (!cfg || !cfg.forwarder_enabled) return;
  const src = cfg.forwarder_source_chat_id;
  if (src == null || String(src) !== String(opts.fromChatId)) return;
  const targets = (cfg.forwarder_target_chat_ids ?? []) as Array<number | string>;
  if (!targets.length) return;

  let marked = false;
  if (opts.origin.kind === "recurring")
    marked = (cfg.forwarder_marked_recurring ?? []).includes(opts.origin.id);
  else if (opts.origin.kind === "scheduled")
    marked = (cfg.forwarder_marked_scheduled ?? []).includes(opts.origin.id);
  else marked = (cfg.forwarder_marked_templates ?? []).includes(opts.origin.id);
  if (!marked) return;

  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("default_account_id")
    .eq("id", opts.roomId)
    .maybeSingle();
  const accountId = room?.default_account_id;
  if (!accountId) return;
  const { data: acc } = await supabaseAdmin
    .from("telegram_accounts")
    .select("bot_token")
    .eq("id", accountId)
    .maybeSingle();
  if (!acc?.bot_token) return;

  for (const t of targets) {
    if (String(t) === String(opts.fromChatId)) continue;
    await callTelegram(acc.bot_token, "copyMessage", {
      chat_id: t,
      from_chat_id: opts.fromChatId,
      message_id: opts.messageId,
    }).catch(() => undefined);
  }
}