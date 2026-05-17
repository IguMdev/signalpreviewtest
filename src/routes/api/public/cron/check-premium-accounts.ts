import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function makeClient(apiId: number, apiHash: string, session: string) {
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions");
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 1,
    useWSS: true,
  });
  await client.connect();
  return client;
}

type PremiumAccount = {
  id: string;
  user_id: string;
  tg_api_id: number | null;
  tg_api_hash: string | null;
  tg_session: string | null;
  last_check_at: string | null;
};

async function verifyAndSync(acc: PremiumAccount) {
  if (!acc.tg_api_id || !acc.tg_api_hash || !acc.tg_session) {
    return { status: "error" as const, error: "Sessão ausente", newEmojis: 0 };
  }
  const { Api } = await import("telegram");
  const { default: bigInt } = await import("big-integer");
  let client: Awaited<ReturnType<typeof makeClient>> | null = null;
  try {
    client = await makeClient(acc.tg_api_id, acc.tg_api_hash, acc.tg_session);

    // 1. Verificação: getMe + checa flag premium
    const me = (await client.getMe()) as { premium?: boolean; firstName?: string; username?: string };
    const isPremium = me?.premium === true;

    // 2. Detecção: varre diálogos recentes desde o último check e coleta custom emojis novos
    const sinceUnix = acc.last_check_at
      ? Math.floor(new Date(acc.last_check_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 24 * 3600;

    const { data: existing } = await supabaseAdmin
      .from("premium_emojis")
      .select("custom_emoji_id")
      .eq("user_id", acc.user_id);
    const known = new Set((existing ?? []).map((r: { custom_emoji_id: string }) => r.custom_emoji_id));

    const seen = new Set<string>();
    const fresh: Array<{ custom_emoji_id: string; preview_char: string | null; name: string }> = [];

    const dialogs = (await client.getDialogs({ limit: 20 })) as unknown as Array<{ inputEntity?: unknown }>;
    const peers: unknown[] = [new Api.InputPeerSelf(), ...dialogs.map((d) => d.inputEntity).filter(Boolean)];

    for (const peer of peers) {
      try {
        const history = (await client.invoke(
          new Api.messages.GetHistory({
            peer: peer as never,
            offsetId: 0,
            offsetDate: 0,
            addOffset: 0,
            limit: 50,
            maxId: 0,
            minId: 0,
            hash: bigInt(0),
          }),
        )) as unknown as {
          messages?: Array<{
            message?: string;
            out?: boolean;
            date?: number | Date;
            entities?: Array<{ className?: string; documentId?: { toString(): string }; offset?: number; length?: number }>;
          }>;
        };
        for (const msg of history.messages ?? []) {
          const msgUnix =
            typeof msg.date === "number" ? msg.date : msg.date instanceof Date ? Math.floor(msg.date.getTime() / 1000) : 0;
          if (msgUnix < sinceUnix) continue;
          if (msg.out !== true) continue;
          const text = msg.message ?? "";
          for (const ent of msg.entities ?? []) {
            if (ent.className === "MessageEntityCustomEmoji" && ent.documentId) {
              const id = String(ent.documentId);
              if (seen.has(id) || known.has(id)) continue;
              seen.add(id);
              const preview =
                typeof ent.offset === "number" && typeof ent.length === "number"
                  ? text.substr(ent.offset, ent.length)
                  : null;
              fresh.push({ custom_emoji_id: id, preview_char: preview, name: preview ?? id.slice(0, 8) });
            }
          }
        }
      } catch {
        // ignora diálogos sem permissão
      }
    }

    if (fresh.length) {
      await supabaseAdmin.from("premium_emojis").insert(
        fresh.map((f) => ({
          user_id: acc.user_id,
          custom_emoji_id: f.custom_emoji_id,
          preview_char: f.preview_char,
          name: f.name,
        })),
      );
    }

    return {
      status: isPremium ? ("ok" as const) : ("error" as const),
      error: isPremium ? null : "Conta sem assinatura Premium ativa",
      newEmojis: fresh.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "error" as const, error: msg, newEmojis: 0 };
  } finally {
    if (client) await client.disconnect().catch(() => {});
  }
}

export const Route = createFileRoute("/api/public/cron/check-premium-accounts")({
  server: {
    handlers: {
      POST: async () => {
        const { data: accounts, error } = await supabaseAdmin
          .from("telegram_accounts")
          .select("id, user_id, tg_api_id, tg_api_hash, tg_session, last_check_at")
          .eq("account_type", "premium")
          .eq("is_active", true)
          .not("tg_session", "is", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results: Array<Record<string, unknown>> = [];
        for (const acc of (accounts ?? []) as PremiumAccount[]) {
          const r = await verifyAndSync(acc);
          await supabaseAdmin
            .from("telegram_accounts")
            .update({
              status: r.status,
              last_check_at: new Date().toISOString(),
              last_error: r.error,
            })
            .eq("id", acc.id);
          results.push({ accountId: acc.id, ...r });
        }

        return Response.json({ ok: true, checked: results.length, results });
      },
    },
  },
});