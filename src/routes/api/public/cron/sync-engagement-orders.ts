import { createFileRoute } from "@tanstack/react-router";
import { runEngagementOrdersSync } from "@/lib/engagement.functions";

// CRON: sincroniza pedidos do painel SMM em background (a cada 5 min via pg_cron).
// Atualiza status de pedidos "pending"/"in_progress" sem depender de o usuário
// abrir a página de Recarga.
export const Route = createFileRoute("/api/public/cron/sync-engagement-orders")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runEngagementOrdersSync({ limit: 100 });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});