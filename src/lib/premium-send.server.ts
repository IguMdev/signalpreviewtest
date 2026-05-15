import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  hasEmojiTokens,
  renderEmojiTokens,
  renderEmojiTokensToHtml,
  type EmojiLookup,
  type RenderedEntity,
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

async function getActivePremiumAccount(userId: string, accountId?: string) {
  let query = supabaseAdmin
    .from("telegram_accounts")
    .select("id, tg_api_id, tg_api_hash, tg_session")
    .eq("user_id", userId)
    .eq("account_type", "premium")
    .eq("is_active", true)
    .not("tg_session", "is", null);

  query = accountId ? query.eq("id", accountId) : query.limit(1);
  const { data: acc } = await query.maybeSingle();

  if (!acc?.tg_session || !acc.tg_api_id || !acc.tg_api_hash) return null;
  return acc;
}

function resolveTelegramTarget(chatId: number | string) {
  const numeric = typeof chatId === "string" ? Number(chatId) : chatId;
  return Number.isFinite(numeric) ? (numeric as number) : chatId;
}

/**
 * Conecta na conta MTProto e garante que ela é Telegram Premium.
 * Sem Premium o servidor do Telegram aceita a mensagem mas REMOVE as
 * entities `MessageEntityCustomEmoji` silenciosamente — o destinatário vê
 * apenas o caractere fallback (ex.: 🚨 em vez do emoji animado).
 */
async function connectAndAssertPremium(acc: {
  tg_api_id: number;
  tg_api_hash: string;
  tg_session: string;
}) {
  const { TelegramClient, Api } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");

  const client = new TelegramClient(
    new StringSession(acc.tg_session),
    acc.tg_api_id,
    acc.tg_api_hash,
    { connectionRetries: 2, useWSS: true },
  );
  await client.connect();

  let isPremium = false;
  let userInfo: { firstName?: string | null; username?: string | null } = {};
  try {
    const me = await client.invoke(
      new Api.users.GetFullUser({ id: new Api.InputUserSelf() }),
    );
    const user = (me.users ?? []).find(
      (u): u is InstanceType<typeof Api.User> => u.className === "User",
    );
    isPremium = Boolean(user?.premium);
    userInfo = {
      firstName: (user as { firstName?: string | null } | undefined)?.firstName ?? null,
      username: (user as { username?: string | null } | undefined)?.username ?? null,
    };
  } catch {
    isPremium = false;
  }

  return { client, isPremium, userInfo };
}

export async function renderPremiumEmojiTokensForBotApi(userId: string, text: string | null | undefined) {
  if (!text || !hasEmojiTokens(text)) return { text: text ?? null, replaced: false };
  const lookup = await getUserEmojiLookup(userId);
  return renderEmojiTokensToHtml(text, lookup);
}

async function normalizeCustomEmojiAlts(
  client: { invoke: (request: unknown) => Promise<unknown> },
  rendered: { text: string; entities: RenderedEntity[] },
) {
  if (!rendered.entities.length) return rendered;
  const { Api } = await import("telegram");
  const { default: bigInt } = await import("big-integer");
  const ids = Array.from(new Set(rendered.entities.map((entity) => entity.documentId)));
  const docs = (await client.invoke(
    new Api.messages.GetCustomEmojiDocuments({
      documentId: ids.map((id) => bigInt(id) as never),
    }),
  ).catch(() => [])) as Array<{
    id?: { toString(): string };
    attributes?: Array<{ className?: string; alt?: string }>;
  }>;
  const altById = new Map<string, string>();
  for (const doc of docs ?? []) {
    const id = doc.id ? String(doc.id) : null;
    const alt = doc.attributes?.find(
      (attr) => attr.className === "DocumentAttributeCustomEmoji" && typeof attr.alt === "string" && attr.alt.length > 0,
    )?.alt;
    if (id && alt) altById.set(id, alt);
  }
  if (!altById.size) return rendered;

  const entities = [...rendered.entities].sort((a, b) => a.offset - b.offset);
  let text = "";
  let last = 0;
  const normalizedEntities: RenderedEntity[] = [];
  for (const entity of entities) {
    text += rendered.text.slice(last, entity.offset);
    const fallback = rendered.text.slice(entity.offset, entity.offset + entity.length);
    const replacement = altById.get(entity.documentId) ?? fallback;
    normalizedEntities.push({
      ...entity,
      offset: text.length,
      length: replacement.length,
    });
    text += replacement;
    last = entity.offset + entity.length;
  }
  text += rendered.text.slice(last);
  return { text, entities: normalizedEntities };
}

export async function getPremiumAccountConnectionStatus(userId: string, accountId: string) {
  const acc = await getActivePremiumAccount(userId, accountId);
  if (!acc) return { ok: false as const, error: "Conecte a conta Telegram Premium novamente." };
  const { client, isPremium, userInfo } = await connectAndAssertPremium({
    tg_api_id: acc.tg_api_id as number,
    tg_api_hash: acc.tg_api_hash as string,
    tg_session: acc.tg_session as string,
  });
  await client.disconnect().catch(() => {});
  return { ok: true as const, isPremium, ...userInfo };
}

/**
 * Tenta enviar uma mensagem de texto via conta premium MTProto, substituindo
 * tokens {NOME} por entities `MessageEntityCustomEmoji` reais.
 *
 * Retorna `{ applied: false }` quando a rota premium não se aplica
 * (sem tokens, sem conta premium ativa, ou nenhum nome bate). Nesse caso
 * o chamador deve cair no fluxo padrão (Bot API).
 */
export async function sendTextWithPremiumEmojis(opts: {
  userId: string;
  accountId?: string;
  chatId: number | string;
  text: string;
  replyToMessageId?: number;
  strict?: boolean;
  allowPlain?: boolean;
}): Promise<PremiumSendResult> {
  if (!hasEmojiTokens(opts.text)) {
    if (opts.allowPlain) {
      const acc = await getActivePremiumAccount(opts.userId, opts.accountId);
      if (!acc) return { applied: true, ok: false, error: "Conecte a conta Telegram Premium novamente." };
      const { client } = await connectAndAssertPremium({
        tg_api_id: acc.tg_api_id as number,
        tg_api_hash: acc.tg_api_hash as string,
        tg_session: acc.tg_session as string,
      });
      try {
        const msg = await client.sendMessage(resolveTelegramTarget(opts.chatId) as never, {
          message: opts.text,
          replyTo: opts.replyToMessageId,
        });
        return { applied: true, ok: true, messageId: Number(msg.id) };
      } catch (e) {
        return { applied: true, ok: false, error: e instanceof Error ? e.message : String(e) };
      } finally {
        await client.disconnect().catch(() => {});
      }
    }
    return { applied: false, reason: "no-tokens" };
  }

  const lookup = await getUserEmojiLookup(opts.userId);

  const rendered = renderEmojiTokens(opts.text, lookup);
  if (!rendered.entities.length) {
    if (opts.strict) {
      return { applied: true, ok: false, error: "Nenhum emoji premium salvo corresponde aos tokens da mensagem." };
    }
    return { applied: false, reason: "no-known-emojis" };
  }

  const acc = await getActivePremiumAccount(opts.userId, opts.accountId);
  if (!acc) {
    if (opts.strict) {
      return { applied: true, ok: false, error: "Conecte uma conta Telegram Premium ativa para enviar emojis premium animados." };
    }
    return { applied: false, reason: "no-premium-account" };
  }

  const { Api } = await import("telegram");
  const { default: bigInt } = await import("big-integer");

  const { client, isPremium } = await connectAndAssertPremium({
    tg_api_id: acc.tg_api_id as number,
    tg_api_hash: acc.tg_api_hash as string,
    tg_session: acc.tg_session as string,
  });
  if (!isPremium) {
    await client.disconnect().catch(() => {});
    return {
      applied: true,
      ok: false,
      error:
        "A conta Telegram conectada não tem assinatura Premium ativa. Sem Premium o Telegram remove os emojis animados antes de entregar a mensagem.",
    };
  }

  try {
    const normalized = await normalizeCustomEmojiAlts(client, rendered);
    const target = resolveTelegramTarget(opts.chatId);
    const msg = await client.sendMessage(target as never, {
      message: normalized.text,
      formattingEntities: normalized.entities.map(
        (entity) =>
          new Api.MessageEntityCustomEmoji({
            offset: entity.offset,
            length: entity.length,
            documentId: bigInt(entity.documentId) as never,
          }),
      ),
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

export async function sendPhotoWithPremiumEmojiCaption(opts: {
  userId: string;
  chatId: number | string;
  photoUrl: string;
  caption: string | null | undefined;
  replyToMessageId?: number;
  strict?: boolean;
}): Promise<PremiumSendResult> {
  if (!opts.caption || !hasEmojiTokens(opts.caption)) {
    return { applied: false, reason: "no-tokens" };
  }

  const lookup = await getUserEmojiLookup(opts.userId);
  const rendered = renderEmojiTokens(opts.caption, lookup);
  if (!rendered.entities.length) {
    if (opts.strict) {
      return { applied: true, ok: false, error: "Nenhum emoji premium salvo corresponde aos tokens da legenda." };
    }
    return { applied: false, reason: "no-known-emojis" };
  }

  const acc = await getActivePremiumAccount(opts.userId);
  if (!acc) {
    if (opts.strict) {
      return { applied: true, ok: false, error: "Conecte uma conta Telegram Premium ativa para enviar emojis premium animados." };
    }
    return { applied: false, reason: "no-premium-account" };
  }

  const { Api } = await import("telegram");
  const { default: bigInt } = await import("big-integer");

  const { client, isPremium } = await connectAndAssertPremium({
    tg_api_id: acc.tg_api_id as number,
    tg_api_hash: acc.tg_api_hash as string,
    tg_session: acc.tg_session as string,
  });
  if (!isPremium) {
    await client.disconnect().catch(() => {});
    return {
      applied: true,
      ok: false,
      error:
        "A conta Telegram conectada não tem assinatura Premium ativa. Sem Premium o Telegram remove os emojis animados da legenda antes de entregar.",
    };
  }

  try {
    const target = resolveTelegramTarget(opts.chatId);
    const msg = await client.sendFile(target as never, {
      file: opts.photoUrl,
      caption: rendered.text,
      formattingEntities: rendered.entities.map(
        (entity) =>
          new Api.MessageEntityCustomEmoji({
            offset: entity.offset,
            length: entity.length,
            documentId: bigInt(entity.documentId) as never,
          }),
      ),
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