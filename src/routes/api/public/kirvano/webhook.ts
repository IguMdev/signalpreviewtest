import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Kirvano envia POST com payload da venda. Autenticamos via header
// `x-kirvano-token` comparado ao secret KIRVANO_WEBHOOK_TOKEN.
// Mapeamos o produto pela URL de checkout (slug do plano).

type KirvanoPayload = {
  event?: string; // "SALE_APPROVED" | "SUBSCRIPTION_CANCELED" | etc.
  sale_id?: string;
  customer?: { email?: string };
  product?: { offer_url?: string; slug?: string };
  // Lovable: o cliente vincula a conta passando o user_id como query/UTM
  utm?: { utm_content?: string };
  metadata?: Record<string, string>;
};

export const Route = createFileRoute("/api/public/kirvano/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.KIRVANO_WEBHOOK_TOKEN;
        if (!expected) {
          return new Response("Webhook não configurado", { status: 503 });
        }
        const token = request.headers.get("x-kirvano-token") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: KirvanoPayload;
        try {
          payload = (await request.json()) as KirvanoPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const userId = payload.metadata?.user_id ?? payload.utm?.utm_content;
        const offerUrl = payload.product?.offer_url;
        const slug = payload.product?.slug;

        if (!userId) {
          return Response.json({ ok: false, error: "user_id ausente em metadata/utm_content" }, { status: 400 });
        }

        // Find plan by checkout URL or slug
        let planQuery = supabaseAdmin.from("engagement_plans").select("*").limit(1);
        if (offerUrl) planQuery = planQuery.eq("kirvano_checkout_url", offerUrl);
        else if (slug) planQuery = planQuery.eq("slug", slug);
        else return Response.json({ ok: false, error: "produto não identificado" }, { status: 400 });

        const { data: plan, error: planErr } = await planQuery.maybeSingle();
        if (planErr || !plan) {
          return Response.json({ ok: false, error: "plano não encontrado" }, { status: 404 });
        }

        const event = (payload.event ?? "").toUpperCase();
        const isApproved = event.includes("APPROVED") || event.includes("PAID") || event.includes("ACTIVE");
        const isCanceled = event.includes("CANCEL") || event.includes("REFUND") || event.includes("CHARGEBACK");

        if (isApproved) {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          // Cancel previous active subs for this user FOR THE SAME bot type
          // (user can have multiple subs across different bots)
          await supabaseAdmin
            .from("user_engagement_subscriptions")
            .update({ status: "canceled" })
            .eq("user_id", userId)
            .eq("bot_type", plan.bot_type)
            .in("status", ["active", "pending"]);

          const { error: insErr } = await supabaseAdmin
            .from("user_engagement_subscriptions")
            .insert({
              user_id: userId,
              plan_id: plan.id,
              bot_type: plan.bot_type,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              kirvano_sale_id: payload.sale_id ?? null,
              kirvano_customer_email: payload.customer?.email ?? null,
              last_event: payload as never,
            });
          if (insErr) {
            return Response.json({ ok: false, error: insErr.message }, { status: 500 });
          }
          return Response.json({ ok: true, action: "activated" });
        }

        if (isCanceled && payload.sale_id) {
          await supabaseAdmin
            .from("user_engagement_subscriptions")
            .update({ status: "canceled", last_event: payload as never })
            .eq("kirvano_sale_id", payload.sale_id);
          return Response.json({ ok: true, action: "canceled" });
        }

        return Response.json({ ok: true, action: "ignored", event });
      },
    },
  },
});