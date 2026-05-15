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
  .inputValidator((d) => z.object({ accountId: z.string().uuid() }).parse(d))
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
    const rows: Array<{
      user_id: string;
      custom_emoji_id: string;
      name: string;
      preview_char: string | null;
    }> = [];
    try {
      // Lê as últimas mensagens de "Mensagens Salvas" (Saved Messages = peer "me")
      // e extrai todos os custom emojis enviados pelo usuário.
      const history = (await client.invoke(
        new Api.messages.GetHistory({
          peer: new Api.InputPeerSelf(),
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          limit: 200,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        }),
      )) as unknown as {
        messages?: Array<{
          message?: string;
          entities?: Array<{ className?: string; documentId?: { toString(): string }; offset?: number; length?: number }>;
        }>;
      };
      const seen = new Set<string>();
      for (const msg of history.messages ?? []) {
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
            rows.push({
              user_id: userId,
              custom_emoji_id: id,
              name: preview || id,
              preview_char: preview,
            });
          }
        }
      }
    } finally {
      await client.disconnect().catch(() => {});
    }
    if (rows.length === 0) return { ok: true, count: 0 };
    // upsert por (user_id, custom_emoji_id) — sem unique, fazemos delete+insert simples
    await supabase.from("premium_emojis").delete().eq("user_id", userId);
    const { error: insErr } = await supabase.from("premium_emojis").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { ok: true, count: rows.length };
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