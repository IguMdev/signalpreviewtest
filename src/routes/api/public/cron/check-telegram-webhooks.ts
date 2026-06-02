import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";

// ╔══════════════════════════════════════════════════════════╗
// ║  CRON: CHECK-TELEGRAM-WEBHOOKS                           ║
// ║  Garante que cada bot ativo tem o webhook apontando      ║
// ║  para esta aplicação e com o secret_token correto.       ║
// ╚══════════════════════════════════════════════════════════╝

const ALLOWED_UPDATES = ["chat_member", "my_chat_member", "message", "channel_post", "chat_join_request"];

function publicBaseUrl() {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  return `https://telesignal.com.br`;
}

type WebhookInfo = {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
};

async function drainPending(accountId: string, botToken: string) {
  const url = `${publicBaseUrl()}/api/public/telegram/webhook/${accountId}`;
  const secret = createHash("sha256").update(`tg-tracking:${botToken}`).digest("base64url");
  let offset: number | undefined;
  let processed = 0;
  let errors = 0;
  for (let i = 0; i < 50; i++) {
    const r = await callTelegram<Array<{ update_id: number }>>(botToken, "getUpdates", {
      offset,
      limit: 100,
      timeout: 0,
      allowed_updates: ALLOWED_UPDATES,
    });
    if (!r.ok) break;
    const batch = r.result ?? [];
    if (batch.length === 0) break;
    for (const upd of batch) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-telegram-bot-api-secret-token": secret,
          },
          body: JSON.stringify(upd),
        });
        if (resp.ok) processed++;
        else errors++;
      } catch {
        errors++;
      }
      offset = upd.update_id + 1;
    }
    if (batch.length < 100) break;
  }
  return { processed, errors };
}

export const Route = createFileRoute("/api/public/cron/check-telegram-webhooks")({
  server: {
    handlers: {
      POST: async () => {
        const { data: accounts, error } = await supabaseAdmin
          .from("telegram_accounts")
          .select("id, bot_token, member_tracking_enabled")
          .eq("account_type", "bot")
          .eq("member_tracking_enabled", true)
          .eq("is_active", true);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const expectedBase = publicBaseUrl();
        const results: Array<Record<string, unknown>> = [];
        const now = Date.now();

        for (const acc of accounts ?? []) {
          if (!acc.bot_token) continue;
          const expectedUrl = `${expectedBase}/api/public/telegram/webhook/${acc.id}`;
          const secret = createHash("sha256")
            .update(`tg-tracking:${acc.bot_token}`)
            .digest("base64url");

          const info = await callTelegram<WebhookInfo>(acc.bot_token, "getWebhookInfo", {});
          const w = info.ok ? info.result ?? {} : ({} as WebhookInfo);

          const urlMissingOrWrong = !w.url || w.url !== expectedUrl;
          const lastErrorRecent =
            !!w.last_error_date && now - w.last_error_date * 1000 < 60 * 60 * 1000;
          const needsRecovery = !info.ok || urlMissingOrWrong || lastErrorRecent;

          if (!needsRecovery) {
            await supabaseAdmin
              .from("telegram_accounts")
              .update({
                member_tracking_last_check: new Date().toISOString(),
                member_tracking_last_error: null,
              })
              .eq("id", acc.id);
            results.push({
              accountId: acc.id,
              status: "ok",
              pending: w.pending_update_count ?? 0,
            });
            continue;
          }

          // Recovery: delete (preserva pendentes), drena via getUpdates, re-registra
          let drained = { processed: 0, errors: 0 };
          let setError: string | null = null;

          await callTelegram(acc.bot_token, "deleteWebhook", { drop_pending_updates: false });
          try {
            drained = await drainPending(acc.id, acc.bot_token);
          } catch (e) {
            setError = e instanceof Error ? e.message : String(e);
          }

          const set = await callTelegram<boolean>(acc.bot_token, "setWebhook", {
            url: expectedUrl,
            secret_token: secret,
            allowed_updates: ALLOWED_UPDATES,
            drop_pending_updates: false,
          });
          if (!set.ok) setError = set.description ?? "setWebhook falhou";

          await supabaseAdmin
            .from("telegram_accounts")
            .update({
              member_tracking_last_check: new Date().toISOString(),
              member_tracking_last_error: setError,
              member_tracking_recovered_at: set.ok ? new Date().toISOString() : null,
            })
            .eq("id", acc.id);

          results.push({
            accountId: acc.id,
            status: set.ok ? "recovered" : "failed",
            previousUrl: w.url ?? null,
            lastErrorMessage: w.last_error_message ?? null,
            pendingBefore: w.pending_update_count ?? 0,
            drained,
            setError,
          });
        }

        return Response.json({ ok: true, checked: results.length, results });
      },
    },
  },
});