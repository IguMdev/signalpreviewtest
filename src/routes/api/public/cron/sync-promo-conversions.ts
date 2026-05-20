import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STORE_CLIENTS } from "@/lib/promo/registry.server";
import type { AffiliateStore } from "@/lib/promo/types";

// ╔══════════════════════════════════════════════════════════╗
// ║  CRON: SYNC-PROMO-CONVERSIONS                            ║
// ║  Busca conversões nas APIs das lojas e atualiza a tabela ║
// ║  promo_conversions (idempotente por (store, order_id)).  ║
// ╚══════════════════════════════════════════════════════════╝

type Account = {
  id: string;
  user_id: string;
  store: AffiliateStore;
  credentials: Record<string, string>;
  last_sync_at: string | null;
  is_active: boolean;
};

export const Route = createFileRoute("/api/public/cron/sync-promo-conversions")({
  server: {
    handlers: {
      POST: async () => {
        const startedAt = new Date().toISOString();
        const { data: accounts, error } = await supabaseAdmin
          .from("affiliate_accounts")
          .select("id,user_id,store,credentials,last_sync_at,is_active")
          .eq("is_active", true);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let total = 0;
        let failed = 0;
        const results: Array<{ account_id: string; store: string; count: number; error?: string }> = [];

        for (const acc of (accounts ?? []) as Account[]) {
          const client = STORE_CLIENTS[acc.store];
          if (!client) continue;

          // janela: desde o último sync, com fallback de 7 dias
          const since = acc.last_sync_at
            ? new Date(acc.last_sync_at)
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          try {
            const conversions = await client.fetchConversions(acc.credentials, since);
            let inserted = 0;

            for (const c of conversions) {
              // idempotência por (user_id, store, order_id)
              const { data: existing } = await supabaseAdmin
                .from("promo_conversions")
                .select("id,status,sale_value,commission_value")
                .eq("user_id", acc.user_id)
                .eq("store", c.store)
                .eq("order_id", c.orderId)
                .maybeSingle();

              // tenta vincular ao dispatch pelo sub_id (external_id do dispatch)
              let dispatchId: string | null = null;
              if (c.subId) {
                const { data: disp } = await supabaseAdmin
                  .from("promo_dispatches")
                  .select("id")
                  .eq("user_id", acc.user_id)
                  .eq("external_id", c.subId)
                  .maybeSingle();
                dispatchId = disp?.id ?? null;
              }

              if (existing) {
                await supabaseAdmin
                  .from("promo_conversions")
                  .update({
                    status: c.status,
                    sale_value: c.saleValue,
                    commission_value: c.commissionValue,
                    currency: c.currency,
                    confirmed_at: c.confirmedAt,
                    raw: c.raw as any,
                    dispatch_id: dispatchId ?? undefined,
                  })
                  .eq("id", existing.id);
              } else {
                await supabaseAdmin.from("promo_conversions").insert({
                  user_id: acc.user_id,
                  store: c.store,
                  order_id: c.orderId,
                  sub_id: c.subId ?? null,
                  sale_value: c.saleValue,
                  commission_value: c.commissionValue,
                  currency: c.currency,
                  status: c.status,
                  confirmed_at: c.confirmedAt ?? null,
                  dispatch_id: dispatchId,
                  raw: c.raw as any,
                });
                inserted += 1;
              }
              total += 1;
            }

            await supabaseAdmin
              .from("affiliate_accounts")
              .update({ last_sync_at: new Date().toISOString(), last_error: null })
              .eq("id", acc.id);

            results.push({ account_id: acc.id, store: acc.store, count: inserted });
          } catch (err: any) {
            failed += 1;
            await supabaseAdmin
              .from("affiliate_accounts")
              .update({ last_error: String(err?.message ?? err).slice(0, 500) })
              .eq("id", acc.id);
            results.push({
              account_id: acc.id,
              store: acc.store,
              count: 0,
              error: String(err?.message ?? err),
            });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, startedAt, processed: total, failed, results }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
    },
  },
});