import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "./telegram.server";
import {
  sendPhotoWithPremiumEmojiCaptionRetry,
  sendTextWithPremiumEmojisRetry,
  sendVideoWithPremiumEmojiCaption,
  type PremiumButtonRow,
} from "./premium-send.server";
import { hasEmojiTokens } from "./premium-emoji-render";

type Origin =
  | { kind: "recurring"; id: string }
  | { kind: "scheduled"; id: string }
  | { kind: "template"; id: string };

type MirrorPayload = {
  userId?: string | null;
  content?: string | null;
  parseMode?: string | null;
  imagePath?: string | null;
  video?: {
    storagePath: string;
    mimeType?: string | null;
    duration?: number | null;
    filename?: string | null;
  } | null;
  replyMarkup?: { inline_keyboard?: Array<Array<{ text?: string; url?: string }>> } | null;
};

function buttonRowsFromMarkup(markup: MirrorPayload["replyMarkup"]): PremiumButtonRow[] | undefined {
  const rows = markup?.inline_keyboard
    ?.map((row) => row
      .filter((button): button is { text: string; url: string } => Boolean(button.text && button.url))
      .map((button) => ({ text: button.text, url: button.url })))
    .filter((row) => row.length > 0);
  return rows?.length ? rows : undefined;
}

type PremiumMirrorStatus = "sent" | "no-account" | "blocked" | "skip";

function isNoPremiumAccount(result: { applied: boolean; ok?: boolean; reason?: string }): boolean {
  return result.reason === "no-premium-account" || result.reason === "no-active-premium-account";
}

async function sendPremiumMirror(opts: {
  payload: MirrorPayload;
  targetChatId: number | string;
  userId: string;
  premiumAccountId?: string | null;
}): Promise<PremiumMirrorStatus> {
  const text = opts.payload.content ?? "";
  if (!text || !hasEmojiTokens(text)) return "skip";
  const buttonRows = buttonRowsFromMarkup(opts.payload.replyMarkup);

  if (opts.payload.video?.storagePath) {
    const { data: file } = await supabaseAdmin.storage.from("videos").download(opts.payload.video.storagePath);
    if (!file) return "blocked";
    const result = await sendVideoWithPremiumEmojiCaption({
      userId: opts.userId,
      accountId: opts.premiumAccountId ?? undefined,
      chatId: opts.targetChatId,
      videoBytes: await file.arrayBuffer(),
      filename: opts.payload.video.filename ?? "video.mp4",
      mimeType: opts.payload.video.mimeType ?? "video/mp4",
      duration: opts.payload.video.duration,
      caption: text,
      strict: true,
      buttonRows,
    });
    if (isNoPremiumAccount(result)) return "no-account";
    return result.applied && result.ok ? "sent" : "blocked";
  }

  if (opts.payload.imagePath) {
    const { data: pub } = supabaseAdmin.storage.from("room-images").getPublicUrl(opts.payload.imagePath);
    const result = await sendPhotoWithPremiumEmojiCaptionRetry({
      userId: opts.userId,
      accountId: opts.premiumAccountId ?? undefined,
      chatId: opts.targetChatId,
      photoUrl: pub.publicUrl,
      caption: text,
      strict: true,
      buttonRows,
    });
    if (isNoPremiumAccount(result)) return "no-account";
    return result.applied && result.ok ? "sent" : "blocked";
  }

  const result = await sendTextWithPremiumEmojisRetry({
    userId: opts.userId,
    accountId: opts.premiumAccountId ?? undefined,
    chatId: opts.targetChatId,
    text,
    strict: true,
    buttonRows,
  });
  if (isNoPremiumAccount(result)) return "no-account";
  return result.applied && result.ok ? "sent" : "blocked";
}

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
  payload?: MirrorPayload;
}): Promise<void> {
  if (!opts.messageId) return;
  const { data: cfg } = await supabaseAdmin
    .from("room_engagement_settings")
    .select(
      "user_id, forwarder_enabled, forwarder_source_chat_id, forwarder_target_chat_ids, forwarder_marked_recurring, forwarder_marked_scheduled, forwarder_marked_templates, forwarder_premium_enabled, forwarder_premium_account_id",
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
    if (opts.payload?.content && hasEmojiTokens(opts.payload.content)) {
      const status = await sendPremiumMirror({
        payload: opts.payload,
        targetChatId: t,
        userId: opts.payload.userId ?? cfg.user_id,
        premiumAccountId: cfg.forwarder_premium_account_id,
      }).catch(() => "blocked" as const);
      if (status === "sent" || status === "blocked") continue;
    }
    await callTelegram(acc.bot_token, "copyMessage", {
      chat_id: t,
      from_chat_id: opts.fromChatId,
      message_id: opts.messageId,
    }).catch(() => undefined);
  }
}