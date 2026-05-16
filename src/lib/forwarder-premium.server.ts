import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Reencaminhamento preservando custom_emoji (premium emojis).
 *
 * O `copyMessage` da Bot API remove silenciosamente entities `custom_emoji`
 * quando o bot que envia não é Premium. Para preservar os emojis animados,
 * usamos a conta Telegram Premium (MTProto) do usuário para reenviar o
 * texto/mídia com as entities convertidas.
 */

export type BotApiEntity = {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: { id: number };
  language?: string;
  custom_emoji_id?: string;
};

export type BotApiPost = {
  message_id: number;
  chat: { id: number };
  text?: string;
  caption?: string;
  entities?: BotApiEntity[];
  caption_entities?: BotApiEntity[];
  photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
  video?: { file_id: string; duration?: number; width?: number; height?: number; mime_type?: string; file_name?: string };
  animation?: { file_id: string; duration?: number; width?: number; height?: number; mime_type?: string; file_name?: string };
  document?: { file_id: string; mime_type?: string; file_name?: string };
  audio?: { file_id: string; duration?: number; mime_type?: string; file_name?: string; performer?: string; title?: string };
  voice?: { file_id: string; duration?: number; mime_type?: string };
  video_note?: { file_id: string; duration?: number; length?: number };
  sticker?: { file_id: string };
};

export function hasPremiumEmojiEntities(post: BotApiPost | null | undefined): boolean {
  if (!post) return false;
  const ents = [...(post.entities ?? []), ...(post.caption_entities ?? [])];
  return ents.some((e) => e.type === "custom_emoji" && !!e.custom_emoji_id);
}

async function getActivePremiumAccount(userId: string, accountId?: string | null) {
  let q = supabaseAdmin
    .from("telegram_accounts")
    .select("id, tg_api_id, tg_api_hash, tg_session")
    .eq("user_id", userId)
    .eq("account_type", "premium")
    .eq("is_active", true)
    .not("tg_session", "is", null);
  if (accountId) q = q.eq("id", accountId);
  else q = q.limit(1);
  const { data } = await q.maybeSingle();
  if (!data?.tg_session || !data.tg_api_id || !data.tg_api_hash) return null;
  return data as { id: string; tg_api_id: number; tg_api_hash: string; tg_session: string };
}

async function convertEntities(ents: BotApiEntity[] | undefined) {
  if (!ents?.length) return [];
  const { Api } = await import("telegram");
  const { default: bigInt } = await import("big-integer");
  const out: unknown[] = [];
  for (const e of ents) {
    const base = { offset: e.offset, length: e.length };
    switch (e.type) {
      case "bold": out.push(new Api.MessageEntityBold(base)); break;
      case "italic": out.push(new Api.MessageEntityItalic(base)); break;
      case "underline": out.push(new Api.MessageEntityUnderline(base)); break;
      case "strikethrough": out.push(new Api.MessageEntityStrike(base)); break;
      case "spoiler": out.push(new Api.MessageEntitySpoiler(base)); break;
      case "blockquote": out.push(new Api.MessageEntityBlockquote({ ...base, collapsed: false })); break;
      case "code": out.push(new Api.MessageEntityCode(base)); break;
      case "pre": out.push(new Api.MessageEntityPre({ ...base, language: e.language ?? "" })); break;
      case "text_link":
        if (e.url) out.push(new Api.MessageEntityTextUrl({ ...base, url: e.url }));
        break;
      case "url": out.push(new Api.MessageEntityUrl(base)); break;
      case "email": out.push(new Api.MessageEntityEmail(base)); break;
      case "phone_number": out.push(new Api.MessageEntityPhone(base)); break;
      case "mention": out.push(new Api.MessageEntityMention(base)); break;
      case "hashtag": out.push(new Api.MessageEntityHashtag(base)); break;
      case "cashtag": out.push(new Api.MessageEntityCashtag(base)); break;
      case "bot_command": out.push(new Api.MessageEntityBotCommand(base)); break;
      case "custom_emoji":
        if (e.custom_emoji_id) {
          out.push(new Api.MessageEntityCustomEmoji({
            ...base,
            documentId: bigInt(e.custom_emoji_id) as never,
          }));
        }
        break;
      default:
        // entidades não suportadas (text_mention sem InputUser resolvido, etc.) — ignora
        break;
    }
  }
  return out;
}

async function getFileUrl(botToken: string, fileId: string): Promise<string | null> {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; result?: { file_path?: string } } | null;
  const fp = j?.result?.file_path;
  if (!fp) return null;
  return `https://api.telegram.org/file/bot${botToken}/${fp}`;
}

export type ForwardPremiumResult =
  | { applied: true; ok: true; messageId: number | null }
  | { applied: true; ok: false; error: string }
  | { applied: false; reason: string };

/**
 * Reenvia `post` para `targetChatId` via conta Premium MTProto, preservando
 * custom_emoji. Suporta texto e mídia com legenda (photo, video, animation,
 * document, audio, voice). Para tipos não suportados retorna `applied:false`
 * e o chamador deve cair para copyMessage.
 */
export async function forwardWithPremiumEmojis(opts: {
  userId: string;
  botToken: string;
  post: BotApiPost;
  targetChatId: number | string;
  premiumAccountId?: string | null;
}): Promise<ForwardPremiumResult> {
  const acc = await getActivePremiumAccount(opts.userId, opts.premiumAccountId ?? null);
  if (!acc) {
    return { applied: false, reason: "no-premium-account" };
  }

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
  try {
    const me = await client.invoke(new Api.users.GetFullUser({ id: new Api.InputUserSelf() }));
    const user = (me.users ?? []).find((u): u is InstanceType<typeof Api.User> => u.className === "User");
    isPremium = Boolean(user?.premium);
  } catch {
    isPremium = false;
  }
  if (!isPremium) {
    await client.disconnect().catch(() => {});
    return {
      applied: true,
      ok: false,
      error: "A conta Telegram conectada não tem Premium ativo — o Telegram remove os emojis animados ao entregar.",
    };
  }

  const target = typeof opts.targetChatId === "string" ? Number(opts.targetChatId) : opts.targetChatId;

  try {
    const post = opts.post;
    // Texto puro
    if (post.text) {
      const entities = await convertEntities(post.entities);
      const msg = await client.sendMessage(target as never, {
        message: post.text,
        formattingEntities: entities as never,
        linkPreview: false,
      });
      return { applied: true, ok: true, messageId: Number(msg.id) };
    }

    // Mídia com legenda — baixa via Bot API e reenvia via MTProto
    let fileId: string | null = null;
    let mimeHint: string | undefined;
    let isVoice = false;
    let isVideoNote = false;
    let isAnimation = false;
    let duration: number | undefined;
    let width: number | undefined;
    let height: number | undefined;
    let filename: string | undefined;
    let isPhoto = false;

    if (post.photo?.length) {
      // Pega o maior tamanho
      const best = post.photo.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b));
      fileId = best.file_id;
      isPhoto = true;
    } else if (post.video) {
      fileId = post.video.file_id;
      mimeHint = post.video.mime_type;
      duration = post.video.duration;
      width = post.video.width;
      height = post.video.height;
      filename = post.video.file_name ?? "video.mp4";
    } else if (post.animation) {
      fileId = post.animation.file_id;
      mimeHint = post.animation.mime_type;
      duration = post.animation.duration;
      width = post.animation.width;
      height = post.animation.height;
      filename = post.animation.file_name ?? "animation.mp4";
      isAnimation = true;
    } else if (post.document) {
      fileId = post.document.file_id;
      mimeHint = post.document.mime_type;
      filename = post.document.file_name ?? "file";
    } else if (post.audio) {
      fileId = post.audio.file_id;
      mimeHint = post.audio.mime_type;
      duration = post.audio.duration;
      filename = post.audio.file_name ?? "audio.mp3";
    } else if (post.voice) {
      fileId = post.voice.file_id;
      mimeHint = post.voice.mime_type ?? "audio/ogg";
      duration = post.voice.duration;
      isVoice = true;
      filename = "voice.ogg";
    } else if (post.video_note) {
      fileId = post.video_note.file_id;
      duration = post.video_note.duration;
      isVideoNote = true;
      filename = "video_note.mp4";
    }

    if (!fileId) {
      await client.disconnect().catch(() => {});
      return { applied: false, reason: "unsupported-media" };
    }

    const fileUrl = await getFileUrl(opts.botToken, fileId);
    if (!fileUrl) {
      return { applied: true, ok: false, error: "Não foi possível obter o arquivo original do Telegram." };
    }

    const caption = post.caption ?? "";
    const captionEntities = await convertEntities(post.caption_entities);

    const attributes: unknown[] = [];
    if (isVoice) {
      attributes.push(new Api.DocumentAttributeAudio({ duration: Math.max(1, Math.round(duration ?? 1)), voice: true }));
    } else if (isVideoNote) {
      attributes.push(new Api.DocumentAttributeVideo({
        duration: Math.max(1, Math.round(duration ?? 1)),
        w: 240, h: 240, roundMessage: true,
      }));
    } else if (post.video || post.animation) {
      attributes.push(new Api.DocumentAttributeVideo({
        duration: Math.max(1, Math.round(duration ?? 1)),
        w: width ?? 0, h: height ?? 0,
        supportsStreaming: !isAnimation,
      }));
      if (isAnimation) attributes.push(new Api.DocumentAttributeAnimated());
      if (filename) attributes.push(new Api.DocumentAttributeFilename({ fileName: filename }));
    } else if (post.audio) {
      attributes.push(new Api.DocumentAttributeAudio({
        duration: Math.max(1, Math.round(duration ?? 1)),
        title: post.audio?.title,
        performer: post.audio?.performer,
      }));
      if (filename) attributes.push(new Api.DocumentAttributeFilename({ fileName: filename }));
    } else if (post.document) {
      if (filename) attributes.push(new Api.DocumentAttributeFilename({ fileName: filename }));
    }

    const msg = await client.sendFile(target as never, {
      file: fileUrl,
      caption,
      formattingEntities: captionEntities as never,
      forceDocument: !!post.document && !post.video && !post.animation,
      ...(isPhoto ? {} : { attributes: attributes as never }),
      ...(mimeHint ? { mimeType: mimeHint } : {}),
      supportsStreaming: !!post.video,
    });
    return { applied: true, ok: true, messageId: Number(msg.id) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { applied: true, ok: false, error: raw };
  } finally {
    await client.disconnect().catch(() => {});
  }
}