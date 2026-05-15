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
  | { applied: true; ok: false; error: string; reason: string }
  | { applied: false; reason: string };

export type PremiumButtonRow = { text: string; url: string }[];

async function buildInlineMarkup(buttonRows?: PremiumButtonRow[]) {
  if (!buttonRows || !buttonRows.length) return undefined;
  const { Api } = await import("telegram");
  const rows = buttonRows
    .map(
      (row) =>
        new Api.KeyboardButtonRow({
          buttons: row
            .filter((b) => b.text && b.url)
            .map((b) => new Api.KeyboardButtonUrl({ text: b.text, url: b.url })),
        }),
    )
    .filter((r) => r.buttons.length > 0);
  if (!rows.length) return undefined;
  return new Api.ReplyInlineMarkup({ rows });
}

function logPremiumFallback(
  ctx: {
    where: string;
    userId: string;
    accountId?: string | null;
    chatId: number | string;
    text: string;
    entitiesCount: number;
    parseMode?: string | null;
  },
  reason: string,
  extra?: Record<string, unknown>,
) {
  const preview = (ctx.text ?? "").slice(0, 80).replace(/\s+/g, " ");
  console.warn("[premium-send] fallback to plain", {
    where: ctx.where,
    reason,
    userId: ctx.userId,
    accountId: ctx.accountId ?? null,
    chatId: String(ctx.chatId),
    parseMode: ctx.parseMode ?? "MTProto/customEmoji",
    entitiesCount: ctx.entitiesCount,
    textPreview: preview,
    ...extra,
  });
}

/**
 * Traduz erros crus do MTProto para mensagens claras em PT-BR.
 * Retorna `{ message, reason }` — `reason` é um código curto p/ o frontend.
 */
function translateMtprotoError(raw: string): { message: string; reason: string } {
  const r = (raw || "").toUpperCase();
  if (r.includes("CHAT_ADMIN_REQUIRED")) {
    return {
      reason: "chat-admin-required",
      message:
        "A conta Premium precisa ser admin desse canal/grupo (com permissão de postar) para enviar emojis animados.",
    };
  }
  if (r.includes("CHAT_WRITE_FORBIDDEN") || r.includes("CHANNEL_PRIVATE")) {
    return {
      reason: "chat-write-forbidden",
      message:
        "A conta Premium não tem permissão para escrever nesse chat. Adicione-a ao canal/grupo (como admin, se for canal).",
    };
  }
  if (r.includes("USER_BANNED_IN_CHANNEL") || r.includes("USER_KICKED")) {
    return {
      reason: "user-banned",
      message: "A conta Premium foi banida ou removida desse chat.",
    };
  }
  if (r.includes("PEER_ID_INVALID")) {
    return {
      reason: "peer-invalid",
      message:
        "A conta Premium ainda não conhece esse chat. Entre no canal/grupo com a conta Premium pelo menos uma vez.",
    };
  }
  if (r.includes("SLOWMODE_WAIT")) {
    return { reason: "slowmode", message: "O chat está em modo lento. Aguarde antes de enviar novamente." };
  }
  if (r.includes("FLOOD_WAIT")) {
    return { reason: "flood-wait", message: "Telegram pediu para aguardar antes de enviar (flood wait)." };
  }
  if (r.includes("AUTH_KEY") || r.includes("SESSION_REVOKED") || r.includes("SESSION_EXPIRED")) {
    return {
      reason: "session-invalid",
      message: "A sessão da conta Premium expirou. Reconecte a conta Telegram Premium.",
    };
  }
  if (r.includes("MEDIA_EMPTY") || r.includes("PHOTO_INVALID")) {
    return { reason: "media-invalid", message: "A imagem enviada é inválida ou não pôde ser baixada pelo Telegram." };
  }
  return { reason: "client-send-threw", message: raw };
}

export async function getUserEmojiLookup(userId: string): Promise<EmojiLookup> {
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
  client: Awaited<ReturnType<typeof connectAndAssertPremium>>["client"],
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
  buttonRows?: PremiumButtonRow[];
}): Promise<PremiumSendResult> {
  if (!hasEmojiTokens(opts.text)) {
    if (opts.allowPlain) {
      const acc = await getActivePremiumAccount(opts.userId, opts.accountId);
      if (!acc) {
        logPremiumFallback(
          { where: "sendText.allowPlain", userId: opts.userId, accountId: opts.accountId, chatId: opts.chatId, text: opts.text, entitiesCount: 0 },
          "no-active-premium-account",
        );
        return { applied: true, ok: false, error: "Conecte a conta Telegram Premium novamente.", reason: "no-active-premium-account" };
      }
      const { client } = await connectAndAssertPremium({
        tg_api_id: acc.tg_api_id as number,
        tg_api_hash: acc.tg_api_hash as string,
        tg_session: acc.tg_session as string,
      });
      try {
        const buttons = await buildInlineMarkup(opts.buttonRows);
        const msg = await client.sendMessage(resolveTelegramTarget(opts.chatId) as never, {
          message: opts.text,
          replyTo: opts.replyToMessageId,
          ...(buttons ? { buttons: buttons as never } : {}),
        });
        return { applied: true, ok: true, messageId: Number(msg.id) };
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const { message: error, reason } = translateMtprotoError(raw);
        logPremiumFallback(
          { where: "sendText.allowPlain", userId: opts.userId, accountId: acc.id, chatId: opts.chatId, text: opts.text, entitiesCount: 0 },
          reason,
          { rawError: raw },
        );
        return { applied: true, ok: false, error, reason };
      } finally {
        await client.disconnect().catch(() => {});
      }
    }
    logPremiumFallback(
      { where: "sendText", userId: opts.userId, accountId: opts.accountId, chatId: opts.chatId, text: opts.text, entitiesCount: 0 },
      "no-tokens",
    );
    return { applied: false, reason: "no-tokens" };
  }

  const lookup = await getUserEmojiLookup(opts.userId);

  const rendered = renderEmojiTokens(opts.text, lookup);
  if (!rendered.entities.length) {
    logPremiumFallback(
      { where: "sendText", userId: opts.userId, accountId: opts.accountId, chatId: opts.chatId, text: opts.text, entitiesCount: 0 },
      "no-known-emojis",
      { lookupSize: lookup.size },
    );
    if (opts.strict) {
      return { applied: true, ok: false, error: "Nenhum emoji premium salvo corresponde aos tokens da mensagem.", reason: "no-known-emojis" };
    }
    return { applied: false, reason: "no-known-emojis" };
  }

  const acc = await getActivePremiumAccount(opts.userId, opts.accountId);
  if (!acc) {
    logPremiumFallback(
      { where: "sendText", userId: opts.userId, accountId: opts.accountId, chatId: opts.chatId, text: opts.text, entitiesCount: rendered.entities.length },
      "no-premium-account",
    );
    if (opts.strict) {
      return { applied: true, ok: false, error: "Conecte uma conta Telegram Premium ativa para enviar emojis premium animados.", reason: "no-premium-account" };
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
    logPremiumFallback(
      { where: "sendText", userId: opts.userId, accountId: acc.id, chatId: opts.chatId, text: opts.text, entitiesCount: rendered.entities.length },
      "account-not-premium",
    );
    return {
      applied: true,
      ok: false,
      error:
        "A conta Telegram conectada não tem assinatura Premium ativa. Sem Premium o Telegram remove os emojis animados antes de entregar a mensagem.",
      reason: "account-not-premium",
    };
  }

  try {
    const normalized = await normalizeCustomEmojiAlts(client, rendered);
    const target = resolveTelegramTarget(opts.chatId);
    console.log("[premium-send] sending text", {
      userId: opts.userId,
      accountId: acc.id,
      chatId: String(opts.chatId),
      entitiesCount: normalized.entities.length,
      docIds: normalized.entities.map((e) => e.documentId),
      buttonRowsIgnored: opts.buttonRows?.length ?? 0,
    });
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
    const raw = e instanceof Error ? e.message : String(e);
    const { message: error, reason } = translateMtprotoError(raw);
    logPremiumFallback(
      { where: "sendText", userId: opts.userId, accountId: acc.id, chatId: opts.chatId, text: opts.text, entitiesCount: rendered.entities.length },
      reason,
      { rawError: raw },
    );
    return {
      applied: true,
      ok: false,
      error,
      reason,
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

export async function sendPhotoWithPremiumEmojiCaption(opts: {
  userId: string;
  accountId?: string;
  chatId: number | string;
  photoUrl: string;
  caption: string | null | undefined;
  replyToMessageId?: number;
  strict?: boolean;
  buttonRows?: PremiumButtonRow[];
}): Promise<PremiumSendResult> {
  if (!opts.caption || !hasEmojiTokens(opts.caption)) {
    return { applied: false, reason: "no-tokens" };
  }

  const lookup = await getUserEmojiLookup(opts.userId);
  const rendered = renderEmojiTokens(opts.caption, lookup);
  if (!rendered.entities.length) {
    logPremiumFallback(
      { where: "sendPhoto", userId: opts.userId, accountId: opts.accountId, chatId: opts.chatId, text: opts.caption ?? "", entitiesCount: 0 },
      "no-known-emojis",
      { lookupSize: lookup.size },
    );
    if (opts.strict) {
      return { applied: true, ok: false, error: "Nenhum emoji premium salvo corresponde aos tokens da legenda.", reason: "no-known-emojis" };
    }
    return { applied: false, reason: "no-known-emojis" };
  }

  const acc = await getActivePremiumAccount(opts.userId, opts.accountId);
  if (!acc) {
    logPremiumFallback(
      { where: "sendPhoto", userId: opts.userId, accountId: opts.accountId, chatId: opts.chatId, text: opts.caption ?? "", entitiesCount: rendered.entities.length },
      "no-premium-account",
    );
    if (opts.strict) {
      return { applied: true, ok: false, error: "Conecte uma conta Telegram Premium ativa para enviar emojis premium animados.", reason: "no-premium-account" };
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
    logPremiumFallback(
      { where: "sendPhoto", userId: opts.userId, accountId: acc.id, chatId: opts.chatId, text: opts.caption ?? "", entitiesCount: rendered.entities.length },
      "account-not-premium",
    );
    return {
      applied: true,
      ok: false,
      error:
        "A conta Telegram conectada não tem assinatura Premium ativa. Sem Premium o Telegram remove os emojis animados da legenda antes de entregar.",
      reason: "account-not-premium",
    };
  }

  try {
    const normalized = await normalizeCustomEmojiAlts(client, rendered);
    const target = resolveTelegramTarget(opts.chatId);
    const buttons = await buildInlineMarkup(opts.buttonRows);
    console.log("[premium-send] sending photo", {
      userId: opts.userId,
      accountId: acc.id,
      chatId: String(opts.chatId),
      entitiesCount: normalized.entities.length,
      docIds: normalized.entities.map((e) => e.documentId),
      buttonRows: opts.buttonRows?.length ?? 0,
    });
    const msg = await client.sendFile(target as never, {
      file: opts.photoUrl,
      caption: normalized.text,
      formattingEntities: normalized.entities.map(
        (entity) =>
          new Api.MessageEntityCustomEmoji({
            offset: entity.offset,
            length: entity.length,
            documentId: bigInt(entity.documentId) as never,
          }),
      ),
      replyTo: opts.replyToMessageId,
      ...(buttons ? { buttons: buttons as never } : {}),
    });
    return { applied: true, ok: true, messageId: Number(msg.id) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const { message: error, reason } = translateMtprotoError(raw);
    logPremiumFallback(
      { where: "sendPhoto", userId: opts.userId, accountId: acc.id, chatId: opts.chatId, text: opts.caption ?? "", entitiesCount: rendered.entities.length },
      reason,
      { rawError: raw },
    );
    return {
      applied: true,
      ok: false,
      error,
      reason,
    };
  } finally {
    await client.disconnect().catch(() => {});
  }
}