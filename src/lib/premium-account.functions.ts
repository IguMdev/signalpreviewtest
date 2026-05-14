import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function userbot() {
  const url = process.env.USERBOT_API_URL;
  const token = process.env.USERBOT_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Serviço de userbot não configurado. Configure os secrets USERBOT_API_URL e USERBOT_TOKEN.",
    );
  }
  return { url: url.replace(/\/$/, ""), token };
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { url, token } = userbot();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Auth-Token": token },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((json.error as string) || `Userbot ${res.status}`);
  }
  return json as T;
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
    const r = await call<{ phoneCodeHash: string }>("/auth/send-code", {
      apiId: data.apiId,
      apiHash: data.apiHash,
      phone: data.phone,
    });
    const { error } = await supabase
      .from("telegram_accounts")
      .update({
        tg_api_id: data.apiId,
        tg_api_hash: data.apiHash,
        phone: data.phone,
        tg_phone_code_hash: r.phoneCodeHash,
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
      .select("tg_api_id, tg_api_hash, phone, tg_phone_code_hash")
      .eq("id", data.accountId)
      .maybeSingle();
    if (error || !acc) throw new Error("Conta não encontrada");
    if (!acc.tg_api_id || !acc.tg_api_hash || !acc.phone || !acc.tg_phone_code_hash) {
      throw new Error("Solicite o código novamente.");
    }
    try {
      const r = await call<{
        sessionString: string;
        userId: number;
        firstName?: string;
        username?: string;
      }>("/auth/sign-in", {
        apiId: acc.tg_api_id,
        apiHash: acc.tg_api_hash,
        phone: acc.phone,
        phoneCodeHash: acc.tg_phone_code_hash,
        code: data.code,
        password: data.password,
      });
      await supabase
        .from("telegram_accounts")
        .update({
          tg_session: r.sessionString,
          tg_phone_code_hash: null,
          status: "ok",
          last_check_at: new Date().toISOString(),
          last_error: null,
          bot_first_name: r.firstName ?? null,
          bot_username: r.username ?? null,
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
    const list = await call<Array<{ id: string; emoji?: string; setName?: string }>>(
      "/emojis/list",
      { apiId: acc.tg_api_id, apiHash: acc.tg_api_hash, sessionString: acc.tg_session },
    );
    if (list.length === 0) return { ok: true, count: 0 };
    const rows = list.map((e) => ({
      user_id: userId,
      custom_emoji_id: e.id,
      name: e.setName || e.emoji || e.id,
      preview_char: e.emoji ?? null,
    }));
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
    const r = await call<{ messageId: number }>("/messages/send", {
      apiId: acc.tg_api_id,
      apiHash: acc.tg_api_hash,
      sessionString: acc.tg_session,
      chatId: data.chatId,
      text: data.text,
    });
    return { ok: true, messageId: r.messageId };
  });