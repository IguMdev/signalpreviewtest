import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  hasEmojiTokens,
  renderEmojiTokens,
  renderEmojiTokensToHtml,
  type EmojiLookup,
} from "./premium-emoji-render";

export type PremiumSendResult =
  | { applied: true; ok: true; messageId: number | null }
  | { applied: true; ok: false; error: string }
  | { applied: false; reason: string };

async function getUserEmojiLookup(userId: string): Promise<EmojiLookup> {
  const { data: emojiRows } = await supabaseAdmin
    .from("premium_emojis")
    .select("name, custom_emoji_id, preview_char")
    .eq("user_id", userId);

  return new Map(
    (emojiRows ?? []).map((r) => [
      r.name,
      { custom_emoji_id: r.custom_emoji_id, preview_char: r.preview_char },
    ]),
  );
}

export async function renderPremiumEmojiTokensForBotApi(userId: string, text: string | null | undefined) {
  if (!text || !hasEmojiTokens(text)) return { text: text ?? null, replaced: false };
  const lookup = await getUserEmojiLookup(userId);
  return renderEmojiTokensToHtml(text, lookup);
}

/**
 * Tenta enviar uma mensagem de texto via conta premium MTProto, substituindo
 * tokens {NOME}/{EMOJI:NOME} por entities `MessageEntityCustomEmoji` reais.
 *
 * Retorna `{ applied: false }` quando a rota premium não se aplica
 * (sem tokens, sem conta premium ativa, ou nenhum nome bate). Nesse caso
 * o chamador deve cair no fluxo padrão (Bot API).
 */
export async function sendTextWithPremiumEmojis(opts: {
  userId: string;
  chatId: number | string;
  text: string;
  replyToMessageId?: number;
}): Promise<PremiumSendResult> {
  if (!hasEmojiTokens(opts.text)) {
    return { applied: false, reason: "no-tokens" };
  }

  const lookup = await getUserEmojiLookup(opts.userId);

  const rendered = renderEmojiTokensToHtml(opts.text, lookup);
  const { entities } = renderEmojiTokens(opts.text, lookup);
  if (!rendered.replaced) {
    return { applied: false, reason: "no-known-emojis" };
  }

  const { data: acc } = await supabaseAdmin
    .from("telegram_accounts")
    .select("tg_api_id, tg_api_hash, tg_session")
    .eq("user_id", opts.userId)
    .eq("account_type", "premium")
    .eq("is_active", true)
    .not("tg_session", "is", null)
    .limit(1)
    .maybeSingle();

  if (!acc?.tg_session || !acc.tg_api_id || !acc.tg_api_hash) {
    return { applied: false, reason: "no-premium-account" };
  }

  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");

  const client = new TelegramClient(
    new StringSession(acc.tg_session as string),
    acc.tg_api_id as number,
    acc.tg_api_hash as string,
    { connectionRetries: 2, useWSS: true },
  );
  await client.connect();

  try {
    const numeric = typeof opts.chatId === "string" ? Number(opts.chatId) : opts.chatId;
    const target = Number.isFinite(numeric) ? (numeric as number) : opts.chatId;
    const msg = await client.sendMessage(target as never, {
      message: rendered.text,
      parseMode: "html",
      replyTo: opts.replyToMessageId,
    });
    return { applied: true, ok: true, messageId: Number(msg.id) };
  } catch (e) {
    return {
      applied: true,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}