import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function makeClient(apiId: number, apiHash: string, session = "") {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 2,
    useWSS: true,
  });
  await client.connect();
  return client;
}

function imageDataUrl(bytes: Buffer): string | null {
  if (!bytes.length) return null;
  const mime = bytes.subarray(0, 4).toString("hex").startsWith("ffd8")
    ? "image/jpeg"
    : bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
      ? "image/png"
      : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP"
        ? "image/webp"
        : null;
  return mime ? `data:${mime};base64,${bytes.toString("base64")}` : null;
}

function detectMime(bytes: Buffer): string | null {
  if (!bytes.length) return null;
  const hex4 = bytes.subarray(0, 4).toString("hex");
  const hex8 = bytes.subarray(0, 8).toString("hex");
  if (hex4.startsWith("ffd8")) return "image/jpeg";
  if (hex8 === "89504e470d0a1a0a") return "image/png";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  // WebM / Matroska EBML header: 1A 45 DF A3
  if (hex4 === "1a45dfa3") return "video/webm";
  // GZIP (TGS = gzipped Lottie JSON)
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "application/x-tgsticker";
  return null;
}

function mediaDataUrl(bytes: Buffer): { url: string; mime: string } | null {
  const mime = detectMime(bytes);
  if (!mime) return null;
  return { url: `data:${mime};base64,${bytes.toString("base64")}`, mime };
}

export const requestPremiumCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string().uuid(),
        apiId: z.number().int().positive(),
        apiHash: z.string().min(10),
        phone: z.string().min(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const client = await makeClient(data.apiId, data.apiHash);
    let phoneCodeHash: string;
    let sessionString: string;
    try {
      const r = await client.sendCode(
        { apiId: data.apiId, apiHash: data.apiHash },
        data.phone,
      );
      phoneCodeHash = r.phoneCodeHash;
      sessionString = (client.session.save() as unknown as string) ?? "";
    } finally {
      await client.disconnect().catch(() => {});
    }
    const { error } = await supabase
      .from("telegram_accounts")
      .update({
        tg_api_id: data.apiId,
        tg_api_hash: data.apiHash,
        phone: data.phone,
        tg_phone_code_hash: phoneCodeHash,
        tg_session: sessionString,
        status: "unknown",
        last_error: null,
      })
      .eq("id", data.accountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const confirmPremiumCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string().uuid(),
        code: z.string().min(3),
        password: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: acc, error } = await supabase
      .from("telegram_accounts")
      .select("tg_api_id, tg_api_hash, phone, tg_phone_code_hash, tg_session")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    if (!acc.tg_api_id || !acc.tg_api_hash || !acc.phone || !acc.tg_phone_code_hash) {
      throw new Error("Solicite o código novamente.");
    }
    const client = await makeClient(
      acc.tg_api_id as number,
      acc.tg_api_hash as string,
      (acc.tg_session as string) ?? "",
    );
    try {
      const me = (await client.signInUser(
        { apiId: acc.tg_api_id as number, apiHash: acc.tg_api_hash as string },
        {
          phoneNumber: acc.phone as string,
          phoneCode: async () => data.code,
          password: data.password ? async () => data.password! : undefined,
          onError: (err) => {
            throw err;
          },
        },
      )) as { firstName?: string; username?: string };
      const sessionString = (client.session.save() as unknown as string) ?? "";
      await supabase
        .from("telegram_accounts")
        .update({
          tg_session: sessionString,
          tg_phone_code_hash: null,
          status: "ok",
          last_check_at: new Date().toISOString(),
          last_error: null,
          bot_first_name: me?.firstName ?? null,
          bot_username: me?.username ?? null,
        })
        .eq("id", data.accountId);
      return { ok: true, needsPassword: false as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/SESSION_PASSWORD_NEEDED/i.test(msg)) {
        return { ok: false, needsPassword: true as const };
      }
      await supabase
        .from("telegram_accounts")
        .update({ status: "error", last_error: msg })
        .eq("id", data.accountId);
      throw e;
    } finally {
      await client.disconnect().catch(() => {});
    }
  });

export const syncPremiumEmojis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        accountId: z.string().uuid(),
        since: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc, error } = await supabase
      .from("telegram_accounts")
      .select("tg_api_id, tg_api_hash, tg_session")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    if (!acc.tg_session) throw new Error("Conecte a conta premium primeiro.");
    const { Api } = await import("telegram");
    const { default: bigInt } = await import("big-integer");
    const client = await makeClient(
      acc.tg_api_id as number,
      acc.tg_api_hash as string,
      acc.tg_session as string,
    );
    const items: Array<{
      custom_emoji_id: string;
      preview_char: string | null;
      thumb_data_url: string | null;
    }> = [];
    const sinceUnix = data.since ? Math.floor(new Date(data.since).getTime() / 1000) : 0;
    try {
      const seen = new Set<string>();

      // Itera por todos os diálogos recentes (grupos, canais, privados, saved)
      // e coleta custom emojis das últimas mensagens de cada um.
      const dialogs = (await client.getDialogs({ limit: 50 })) as unknown as Array<{
        inputEntity?: unknown;
      }>;

      const peers: unknown[] = [new Api.InputPeerSelf()];
      for (const d of dialogs) {
        if (d.inputEntity) peers.push(d.inputEntity);
      }

      for (const peer of peers) {
        try {
          const history = (await client.invoke(
            new Api.messages.GetHistory({
              peer: peer as never,
              offsetId: 0,
              offsetDate: 0,
              addOffset: 0,
              limit: 100,
              maxId: 0,
              minId: 0,
              hash: bigInt(0),
            }),
          )) as unknown as {
            messages?: Array<{
              message?: string;
              out?: boolean;
              date?: number | Date;
              entities?: Array<{
                className?: string;
                documentId?: { toString(): string };
                offset?: number;
                length?: number;
              }>;
            }>;
          };
          for (const msg of history.messages ?? []) {
            const msgUnix =
              typeof msg.date === "number"
                ? msg.date
                : msg.date instanceof Date
                  ? Math.floor(msg.date.getTime() / 1000)
                  : 0;
            if (sinceUnix && msgUnix < sinceUnix) continue;
            if (msg.out !== true) continue;
            const text = msg.message ?? "";
            for (const ent of msg.entities ?? []) {
              if (ent.className === "MessageEntityCustomEmoji" && ent.documentId) {
                const id = String(ent.documentId);
                if (seen.has(id)) continue;
                seen.add(id);
                const preview =
                  typeof ent.offset === "number" && typeof ent.length === "number"
                    ? text.substr(ent.offset, ent.length)
                    : null;
                items.push({ custom_emoji_id: id, preview_char: preview, thumb_data_url: null });
              }
            }
          }
        } catch {
          // ignora diálogos sem permissão de leitura
        }
      }
      // Baixa o thumbnail real de cada custom emoji.
      if (items.length) {
        try {
          const { strippedPhotoToJpg } = await import("telegram/Utils");
          const docs = (await client.invoke(
            new Api.messages.GetCustomEmojiDocuments({
              documentId: items.map((i) => bigInt(i.custom_emoji_id) as never),
            }),
          )) as unknown as Array<{
            id?: { toString(): string };
            thumbs?: Array<{ className?: string; type?: string; bytes?: Uint8Array }>;
          }>;
          for (const doc of docs ?? []) {
            const id = doc.id ? String(doc.id) : null;
            if (!id) continue;
            const target = items.find((i) => i.custom_emoji_id === id);
            if (!target) continue;

            const downloadableThumbs = (doc.thumbs ?? []).filter((t) => t.className !== "PhotoPathSize");
            const downloaded = (await client.downloadMedia(doc as never, {
              thumb: Math.max(downloadableThumbs.length - 1, 0),
            }).catch(() => null)) as Buffer | null;
            if (downloaded?.length) {
              target.thumb_data_url = imageDataUrl(downloaded);
            }

            if (!target.thumb_data_url) {
              const embedded = downloadableThumbs.find((t) => t.bytes && t.bytes.length > 0);
              if (embedded?.bytes) {
                const raw = Buffer.from(embedded.bytes);
                const normalized = embedded.className === "PhotoStrippedSize" ? strippedPhotoToJpg(raw) : raw;
                target.thumb_data_url = imageDataUrl(normalized);
              }
            }
          }
        } catch {
          // se falhar, segue sem thumb
        }
      }
    } finally {
      await client.disconnect().catch(() => {});
    }
    // Filtra IDs que o usuário já salvou — não retorna duplicados
    const { data: existing } = await supabase
      .from("premium_emojis")
      .select("custom_emoji_id")
      .eq("user_id", userId);
    const known = new Set((existing ?? []).map((r) => r.custom_emoji_id));
    const fresh = items.filter((i) => !known.has(i.custom_emoji_id));
    return { ok: true, items: fresh, count: fresh.length };
  });

export const sendPremiumMessage = createServerFn({ method: "POST" })
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
      .select("tg_api_id, tg_api_hash, tg_session")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    if (!acc.tg_session) throw new Error("Conecte a conta premium primeiro.");
    const client = await makeClient(
      acc.tg_api_id as number,
      acc.tg_api_hash as string,
      acc.tg_session as string,
    );
    try {
      const msg = await client.sendMessage(data.chatId, { message: data.text });
      return { ok: true, messageId: Number(msg.id) };
    } finally {
      await client.disconnect().catch(() => {});
    }
  });