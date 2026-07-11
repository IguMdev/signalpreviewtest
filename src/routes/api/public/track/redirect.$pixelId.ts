import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateClickId, fireTrackingEvent, deriveFbc } from "@/lib/tracking.server";

export const Route = createFileRoute("/api/public/track/redirect/$pixelId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const pixelId = params.pixelId;
        const url = new URL(request.url);

        // 1. Carregar o pixel
        const { data: pixel } = await supabaseAdmin
          .from("tracking_pixels" as never)
          .select("id, user_id, is_active, tracking_mode, sales_page_url")
          .eq("id", pixelId)
          .maybeSingle();

        if (!pixel || !(pixel as any).is_active) {
          return new Response("Pixel não encontrado ou inativo", { status: 404 });
        }

        const p = pixel as any;
        const destUrlStr = p.sales_page_url;

        if (!destUrlStr) {
          return new Response("Pixel não possui uma URL de destino configurada.", { status: 400 });
        }

        // 2. Extrair UTMs e Parâmetros da URL atual
        const utm_source = url.searchParams.get("utm_source") || url.searchParams.get("src") || null;
        const utm_medium = url.searchParams.get("utm_medium") || null;
        const utm_campaign = url.searchParams.get("utm_campaign") || null;
        const utm_content = url.searchParams.get("utm_content") || null;
        const utm_term = url.searchParams.get("utm_term") || null;
        const fbclid = url.searchParams.get("fbclid") || null;
        const fbp = url.searchParams.get("_fbp") || null;
        const fbc = deriveFbc(url.searchParams.get("_fbc") || null, fbclid);

        // 3. Informações do cliente
        const ip = request.headers.get("cf-connecting-ip")
          ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? null;
        const userAgent = request.headers.get("user-agent");

        // 4. Gerar click_id e salvar no banco
        let clickId = generateClickId();
        for (let i = 0; i < 5; i++) {
          const { data: existing } = await supabaseAdmin
            .from("tracking_clicks" as never)
            .select("click_id")
            .eq("click_id", clickId)
            .maybeSingle();
          if (!existing) break;
          clickId = generateClickId();
        }

        await supabaseAdmin
          .from("tracking_clicks" as never)
          .insert({
            click_id: clickId,
            pixel_id: p.id,
            user_id: p.user_id,
            ip,
            user_agent: userAgent,
            fbp,
            fbc,
            fbclid,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            utm_term,
            // Como é um redirect direto, consideramos "view" e "lead" instantaneamente dependendo do objetivo
            viewed_at: new Date().toISOString(),
            // Se for WhatsApp, já consideramos como "lead" que entrou no grupo
            lead_at: destUrlStr.includes("chat.whatsapp.com") ? new Date().toISOString() : null,
          } as never);

        // 5. Disparar evento para o Meta Ads (PageView / ViewContent)
        // Disparamos de forma assíncrona para não atrasar o redirect
        fireTrackingEvent({ clickId, stage: "view" }).catch(e => console.error("Error firing view:", e));

        // Se for WhatsApp, já enviamos o Lead pro Meta também
        if (destUrlStr.includes("chat.whatsapp.com")) {
           fireTrackingEvent({ clickId, stage: "lead" }).catch(e => console.error("Error firing lead:", e));
        }

        // 6. Construir a URL de destino final anexando as UTMs originais
        const dest = new URL(destUrlStr);
        // Repassa todos os parâmetros originais
        url.searchParams.forEach((value, key) => {
          if (!dest.searchParams.has(key)) {
            dest.searchParams.set(key, value);
          }
        });
        // Anexa o click_id da plataforma
        dest.searchParams.set("ck", clickId);

        return Response.redirect(dest.toString(), 302);
      },
    },
  },
});
