import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fireTrackingEvent,
  generateClickId,
  corsHeaders,
  jsonCors,
  type TrackingStage,
} from "@/lib/tracking.server";

const DR_STAGES = ["view", "lead", "checkout", "payment_info", "purchase"] as const;

const bodySchema = z.object({
  stage: z.enum(DR_STAGES),
  click_id: z.string().min(4).max(64).nullable().optional(),
  // identificação do comprador (opcional, mas recomendado para Purchase/Lead)
  email: z.string().email().nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  external_id: z.string().max(128).nullable().optional(),
  // valor (Purchase)
  value: z.number().nullable().optional(),
  currency: z.string().min(3).max(3).default("BRL").optional(),
  // contexto da página (usado se for primeira visita sem click_id)
  fbp: z.string().max(128).nullable().optional(),
  fbc: z.string().max(256).nullable().optional(),
  fbclid: z.string().max(256).nullable().optional(),
  landing_url: z.string().url().nullable().optional(),
  referrer: z.string().max(1024).nullable().optional(),
  utm_source: z.string().max(128).nullable().optional(),
  utm_medium: z.string().max(128).nullable().optional(),
  utm_campaign: z.string().max(128).nullable().optional(),
  utm_content: z.string().max(256).nullable().optional(),
  utm_term: z.string().max(128).nullable().optional(),
});

function sha256(v: string) {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

export const Route = createFileRoute("/api/public/track/dr/$pixelId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      POST: async ({ request, params }) => {
        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch (e: any) {
          return jsonCors({ ok: false, error: "invalid_body", details: e?.message }, 400);
        }

        const { data: pixel } = await supabaseAdmin
          .from("tracking_pixels" as never)
          .select("id, user_id, is_active, tracking_mode")
          .eq("id", params.pixelId)
          .maybeSingle();
        if (!pixel) return jsonCors({ ok: false, error: "pixel_not_found" }, 404);
        const p = pixel as any;
        if (!p.is_active) return jsonCors({ ok: false, error: "pixel_inactive" }, 403);
        if (p.tracking_mode !== "direct_response") {
          return jsonCors({ ok: false, error: "pixel_not_direct_response" }, 400);
        }

        // Resolve / create click_id
        let clickId = parsed.click_id?.trim() || null;
        if (clickId) {
          const { data: existing } = await supabaseAdmin
            .from("tracking_clicks" as never)
            .select("click_id")
            .eq("click_id", clickId)
            .maybeSingle();
          if (!existing) clickId = null;
        }
        if (!clickId) {
          clickId = generateClickId();
          const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
          const userAgent = request.headers.get("user-agent") ?? null;
          const { error: insErr } = await supabaseAdmin
            .from("tracking_clicks" as never)
            .insert({
              click_id: clickId,
              pixel_id: p.id,
              user_id: p.user_id,
              fbp: parsed.fbp ?? null,
              fbc: parsed.fbc ?? null,
              fbclid: parsed.fbclid ?? null,
              ip,
              user_agent: userAgent,
              referrer: parsed.referrer ?? null,
              landing_url: parsed.landing_url ?? null,
              external_id: parsed.external_id ?? (parsed.email ? sha256(parsed.email) : null),
              utm_source: parsed.utm_source ?? null,
              utm_medium: parsed.utm_medium ?? null,
              utm_campaign: parsed.utm_campaign ?? null,
              utm_content: parsed.utm_content ?? null,
              utm_term: parsed.utm_term ?? null,
            } as never);
          if (insErr) return jsonCors({ ok: false, error: "click_insert_failed", details: insErr.message }, 500);
        }

        // Build extra user data with hashed PII for CAPI
        const extraUserData: Record<string, string> = {};
        if (parsed.email) extraUserData.em = sha256(parsed.email);
        if (parsed.phone) extraUserData.ph = sha256(parsed.phone.replace(/\D/g, ""));
        if (parsed.external_id) extraUserData.externalId = parsed.external_id;

        const result = await fireTrackingEvent({
          clickId,
          stage: parsed.stage as TrackingStage,
          value: parsed.value ?? undefined,
          currency: parsed.currency,
          extraUserData: extraUserData as never,
        });

        // For purchase, persist sale_value/currency on the click
        if (parsed.stage === "purchase" && parsed.value != null) {
          await supabaseAdmin
            .from("tracking_clicks" as never)
            .update({ sale_value: parsed.value, sale_currency: parsed.currency ?? "BRL" } as never)
            .eq("click_id", clickId);
        }

        return jsonCors({ ok: result.ok, click_id: clickId, event: result.eventName, error: result.error });
      },
    },
  },
});