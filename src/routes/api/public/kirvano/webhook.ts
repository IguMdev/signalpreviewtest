import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { allocateAndAutoDispatch } from "@/lib/engagement.functions";
import { sendWebPushNotification } from "@/lib/webpush.server";

// Kirvano envia POST com payload da venda. Autenticamos via header
// `x-kirvano-token` comparado ao secret KIRVANO_WEBHOOK_TOKEN.
// Mapeamos o produto pela URL de checkout (slug do plano).

type KirvanoPayload = {
  event?: string; // "SALE_APPROVED" | "SUBSCRIPTION_CANCELED" | etc.
  sale_id?: string;
  customer?: { email?: string; phone?: string; name?: string };
  product?: { offer_url?: string; slug?: string };
  total_price?: number | string;
  currency?: string;
  // TeleSignal: o cliente vincula a conta passando o user_id como query/UTM
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
          try {
            await sendWebPushNotification(userId, {
              title: "Venda aprovada! | Telesignal",
              body: `Valor: ${payload.currency === "BRL" ? "R$ " : ""}${payload.total_price || ""}`,
              icon: "/favicon.ico"
            });
          } catch(e) {}
          
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          // Procura sub ATIVA/PENDING anterior do mesmo bot_type pra herdar
          // o canal escolhido (renovação repete a sala automaticamente).
          const { data: prevSub } = await supabaseAdmin
            .from("user_engagement_subscriptions")
            .select("target_room_id")
            .eq("user_id", userId)
            .eq("bot_type", plan.bot_type)
            .in("status", ["active", "pending", "canceled"])
            .not("target_room_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const inheritedRoomId = (prevSub as any)?.target_room_id ?? null;

          // Cancel previous active subs for this user FOR THE SAME bot type
          await supabaseAdmin
            .from("user_engagement_subscriptions")
            .update({ status: "canceled" })
            .eq("user_id", userId)
            .eq("bot_type", plan.bot_type)
            .in("status", ["active", "pending"]);

          const { data: newSub, error: insErr } = await supabaseAdmin
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
            })
            .select("id")
            .single();
          if (insErr) {
            return Response.json({ ok: false, error: insErr.message }, { status: 500 });
          }

          // Renovação automática: se havia sala anterior e o plano usa SMM,
          // já dispara sem precisar de modal.
          let autoDispatch: unknown = null;
          if (
            inheritedRoomId &&
            newSub?.id &&
            (plan.bot_type === "inscritos" || plan.bot_type === "interacoes")
          ) {
            try {
              autoDispatch = await allocateAndAutoDispatch({
                userId,
                subscriptionId: newSub.id,
                roomId: inheritedRoomId,
              });
            } catch (e) {
              autoDispatch = { ok: false, error: e instanceof Error ? e.message : String(e) };
            }
          }

          // Para planos de SALAS, creditar a quantidade de créditos do plano (monthly_quota)
          // diretamente no profile do usuário. Cada crédito = 1 sala que pode ser criada.
          if (plan.bot_type === "salas" && (plan.monthly_quota ?? 0) > 0) {
            const { data: prof } = await supabaseAdmin
              .from("profiles")
              .select("credits")
              .eq("id", userId)
              .maybeSingle();
            const current = prof?.credits ?? 0;
            await supabaseAdmin
              .from("profiles")
              .update({ credits: current + plan.monthly_quota })
              .eq("id", userId);
            await supabaseAdmin
              .from("credit_transactions")
              .insert({
                user_id: userId,
                delta: plan.monthly_quota,
                reason: `kirvano_${plan.slug}`,
              });
          }

          return Response.json({ ok: true, action: "activated", inheritedRoomId, autoDispatch });
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