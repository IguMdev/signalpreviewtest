import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateClickId, deriveFbc, corsHeaders, jsonCors } from "@/lib/tracking.server";

const bodySchema = z.object({
  pixel_id: z.string().uuid(),
  fbp: z.string().max(200).nullish(),
  fbc: z.string().max(500).nullish(),
  fbclid: z.string().max(500).nullish(),
  ttclid: z.string().max(500).nullish(),
  gclid: z.string().max(500).nullish(),
  kwai_click_id: z.string().max(500).nullish(),
  utm_source: z.string().max(200).nullish(),
  utm_medium: z.string().max(200).nullish(),
  utm_campaign: z.string().max(200).nullish(),
  utm_content: z.string().max(200).nullish(),
  utm_term: z.string().max(200).nullish(),
  referrer: z.string().max(2000).nullish(),
  landing_url: z.string().max(2000).nullish(),
  external_id: z.string().max(200).nullish(),
  offer_slug: z.string().max(60).nullish(),
});

export const Route = createFileRoute("/api/public/track/click")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request }) => {
        let body: z.infer<typeof bodySchema>;
        try {
          const raw = await request.json();
          body = bodySchema.parse(raw);
        } catch (e) {
          return jsonCors({ ok: false, error: e instanceof Error ? e.message : "invalid body" }, 400);
        }

        // load pixel
        const { data: pixel } = await supabaseAdmin
          .from("tracking_pixels" as never)
          .select("id, user_id, is_active, account_id, bot_username")
          .eq("id", body.pixel_id)
          .maybeSingle();
        if (!pixel || !(pixel as any).is_active) {
          return jsonCors({ ok: false, error: "pixel inactive or not found" }, 404);
        }
        const p = pixel as any;

        // resolve bot_username (cache from pixel, fallback to telegram_accounts)
        let botUsername: string | null = p.bot_username ?? null;
        if (!botUsername && p.account_id) {
          const { data: acc } = await supabaseAdmin
            .from("telegram_accounts")
            .select("bot_username")
            .eq("id", p.account_id)
            .maybeSingle();
          botUsername = acc?.bot_username ?? null;
        }

        // client IP / UA
        const ip = (request.headers.get("cf-connecting-ip")
          ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
          ?? null);
        const userAgent = request.headers.get("user-agent");

        // generate click_id, ensure unique
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

        const fbc = deriveFbc(body.fbc ?? null, body.fbclid ?? null);

        const { error: insertErr } = await supabaseAdmin
          .from("tracking_clicks" as never)
          .insert({
            click_id: clickId,
            pixel_id: p.id,
            user_id: p.user_id,
            fbp: body.fbp ?? null,
            fbc,
            fbclid: body.fbclid ?? null,
            ttclid: body.ttclid ?? null,
            gclid: body.gclid ?? null,
            kwai_click_id: body.kwai_click_id ?? null,
            utm_source: body.utm_source ?? null,
            utm_medium: body.utm_medium ?? null,
            utm_campaign: body.utm_campaign ?? null,
            utm_content: body.utm_content ?? null,
            utm_term: body.utm_term ?? null,
            ip,
            user_agent: userAgent,
            referrer: body.referrer ?? null,
            landing_url: body.landing_url ?? null,
            external_id: body.external_id ?? null,
          } as never);

        if (insertErr) {
          return jsonCors({ ok: false, error: insertErr.message }, 500);
        }

        // build deeplink
        let deeplink: string | null = null;
        if (botUsername) {
          deeplink = `https://t.me/${botUsername}?start=tk_${clickId}`;
        }

        return jsonCors({ ok: true, click_id: clickId, deeplink });
      },
    },
  },
});
