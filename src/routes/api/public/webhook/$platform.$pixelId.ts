import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseWebhookPayload } from "@/lib/webhook-parsers";

export const Route = createFileRoute("/api/public/webhook/$platform/$pixelId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const { platform, pixelId } = params;
          const url = new URL(request.url);
          const token = url.searchParams.get("token") || url.searchParams.get("secret");
          const query = Object.fromEntries(url.searchParams.entries());

          if (!pixelId || !token) {
            return new Response("Missing pixelId or token", { status: 400 });
          }

          // Validar token de segurança do Pixel
          const { data: pixel } = await supabaseAdmin
            .from("tracking_pixels")
            .select("postback_secret")
            .eq("id", pixelId)
            .single();

          if (!pixel || pixel.postback_secret !== token) {
            return new Response("Unauthorized", { status: 401 });
          }

          const rawBody = await request.text();
          let payload: any = rawBody;
          try {
            payload = JSON.parse(rawBody);
          } catch (e) {
            // Hotmart sends x-www-form-urlencoded sometimes
            if (rawBody.includes("=")) {
              const q = new URLSearchParams(rawBody);
              payload = Object.fromEntries(q.entries());
              if (payload.hottok) {
                // É hotmart antigo
              }
            }
          }

          console.log(`=== WEBHOOK RECEBIDO: ${platform.toUpperCase()} ===`);
          console.log("Payload:", payload);

          const ev = parseWebhookPayload(platform, payload, query);
          
          if (ev.status === "ignored" || (!ev.email && !ev.clickId)) {
            console.log("Evento ignorado ou sem chaves de busca.");
            return new Response("Ignored", { status: 200 });
          }

          let updateData: any = {};
          const now = new Date().toISOString();

          if (ev.status === "purchased") {
            updateData.purchased_at = now;
            if (ev.value) {
              updateData.sale_value = ev.value;
              updateData.sale_currency = ev.currency;
            }
          } else if (ev.status === "refunded") {
            updateData.refunded_at = now;
          } else if (ev.status === "chargeback") {
            updateData.chargeback_at = now;
          } else if (ev.status === "abandoned_cart") {
            updateData.abandoned_cart_at = now;
          } else if (ev.status === "checkout_started") {
            updateData.checkout_at = now;
          } else if (ev.status === "lead") {
            updateData.lead_at = now;
          }

          if (Object.keys(updateData).length > 0) {
            const { createHash } = await import("crypto");
            const hashedEmail = ev.email ? createHash("sha256").update(ev.email.trim().toLowerCase()).digest("hex") : null;
            
            let q = supabaseAdmin.from("tracking_clicks").update(updateData);
            if (ev.clickId && ev.clickId.length > 5) {
              q = q.eq("click_id", ev.clickId);
            } else if (hashedEmail) {
              q = q.eq("external_id", hashedEmail);
            } else {
              return new Response("No match keys", { status: 200 });
            }
            
            // Limit to the pixel to ensure no cross-pixel contamination
            q = q.eq("pixel_id", pixelId);
            await q;
          }

          return new Response("OK", { status: 200 });
        } catch (err: any) {
          console.error(`Webhook Error [${params.platform}]:`, err);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
