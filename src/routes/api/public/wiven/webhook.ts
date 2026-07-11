import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/wiven/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Logar o payload bruto e os headers para inspeção durante a integração
          const rawBody = await request.text();
          let payload;
          try {
            payload = JSON.parse(rawBody);
          } catch (e) {
            return new Response("Invalid JSON", { status: 400 });
          }

          console.log("=== WIVEN WEBHOOK RECEBIDO ===");
          console.log("Headers:", Object.fromEntries(request.headers));
          console.log("Payload:", payload);

          if (payload?.action === "TEST_PUSH" && payload?.userId) {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(payload.userId);
            const rawSettings = u?.user?.user_metadata?.push_settings || {};
            
            // Apply logic based on push_settings
            let title = "Venda aprovada!";
            if (rawSettings.show_dashboard !== false) title += " | igu.ads";
            
            let body = "";
            if (rawSettings.show_product) body += "Produto Teste\n";
            if (rawSettings.sale_value !== "hide") body += "Valor: R$ 99,90\n";
            if (rawSettings.show_utm) body += "UTM: campanha_teste";

            const { sendWebPushNotification } = await import("@/lib/webpush.server");
            await sendWebPushNotification(payload.userId, {
              title,
              body: body.trim() || "Sua comissão foi aprovada!",
              icon: "/push-icon.jpg"
            });
            return new Response("OK", { status: 200 });
          }

          // Lógica de rastreamento avançado
          const status = payload?.status || payload?.event_type || "";
          const email = payload?.customer?.email || payload?.email;
          const value = payload?.amount || payload?.value || null;
          const currency = payload?.currency || "BRL";
          const clickId = payload?.metadata?.click_id || payload?.utm_source || null;

          if (email || clickId) {
            let updateData: any = {};
            const now = new Date().toISOString();

            const st = status.toLowerCase();
            if (st === "paid" || st === "approved" || st === "compra_aprovada") {
              updateData.purchased_at = now;
              if (value) {
                updateData.sale_value = value;
                updateData.sale_currency = currency;
              }
            } else if (st === "refunded" || st === "reembolso") {
              updateData.refunded_at = now;
            } else if (st === "chargeback") {
              updateData.chargeback_at = now;
            } else if (st === "abandoned_cart" || st === "abandono") {
              updateData.abandoned_cart_at = now;
            } else if (st === "checkout_started" || st === "checkout") {
              updateData.checkout_at = now;
            }

            if (Object.keys(updateData).length > 0) {
              const { createHash } = await import("crypto");
              const hashedEmail = email ? createHash("sha256").update(email.trim().toLowerCase()).digest("hex") : null;
              
              let q = supabaseAdmin.from("tracking_clicks").update(updateData);
              if (clickId && clickId.length > 5) {
                q = q.eq("click_id", clickId);
              } else if (hashedEmail) {
                q = q.eq("external_id", hashedEmail);
              }
              await q;
            }
          }

          return new Response("OK", { status: 200 });
        } catch (err: any) {
          console.error("Wiven Webhook Error:", err);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
