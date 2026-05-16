import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fireTrackingEvent, corsHeaders, jsonCors } from "@/lib/tracking.server";

const eventEnum = z.enum(["register", "deposit", "ftd"]);
const bodySchema = z.object({
  secret: z.string().min(10).max(200).optional(),
  sub1: z.string().min(1).max(60),
  event: eventEnum,
  value: z.coerce.number().nullish(),
  currency: z.string().min(3).max(3).default("BRL").optional(),
  external_user_id: z.string().max(200).nullish(),
});

export const Route = createFileRoute("/api/public/track/postback/$pixelId")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async ({ request, params }) => handle(request, params.pixelId, "GET"),
      POST: async ({ request, params }) => handle(request, params.pixelId, "POST"),
    },
  },
});

async function handle(request: Request, pixelId: string, method: "GET" | "POST") {
  let raw: Record<string, unknown> = {};
  if (method === "POST") {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      raw = await request.json().catch(() => ({}));
    } else {
      const form = await request.formData().catch(() => null);
      if (form) for (const [k, v] of form.entries()) raw[k] = String(v);
    }
  }
  // also accept query params (most affiliate platforms only support GET)
  const url = new URL(request.url);
  for (const [k, v] of url.searchParams.entries()) {
    if (raw[k] == null) raw[k] = v;
  }

  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(raw); }
  catch (e) { return jsonCors({ ok: false, error: e instanceof Error ? e.message : "invalid input" }, 400); }

  const headerSecret = request.headers.get("x-postback-secret");
  const providedSecret = body.secret ?? headerSecret ?? "";

  const { data: pixel } = await supabaseAdmin
    .from("tracking_pixels" as never)
    .select("id, postback_secret, is_active")
    .eq("id", pixelId)
    .maybeSingle();
  if (!pixel) return jsonCors({ ok: false, error: "pixel not found" }, 404);
  const p = pixel as any;
  if (!p.is_active) return jsonCors({ ok: false, error: "pixel inactive" }, 403);
  if (providedSecret !== p.postback_secret) {
    return jsonCors({ ok: false, error: "invalid secret" }, 401);
  }

  const { data: click } = await supabaseAdmin
    .from("tracking_clicks" as never)
    .select("click_id, pixel_id, registered_at, deposited_at")
    .eq("click_id", body.sub1)
    .eq("pixel_id", pixelId)
    .maybeSingle();
  if (!click) return jsonCors({ ok: false, error: "click not found for sub1" }, 404);
  const c = click as any;

  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {};
  let stage: "register" | "deposit";

  if (body.event === "register") {
    if (!c.registered_at) update.registered_at = nowIso;
    stage = "register";
  } else {
    // deposit / ftd
    if (!c.deposited_at) update.deposited_at = nowIso;
    if (body.value != null) {
      update.sale_value = body.value;
      update.sale_currency = body.currency ?? "BRL";
    }
    stage = "deposit";
  }
  if (body.external_user_id) update.external_user_id = body.external_user_id;

  if (Object.keys(update).length > 0) {
    await supabaseAdmin
      .from("tracking_clicks" as never)
      .update(update as never)
      .eq("click_id", body.sub1);
  }

  const result = await fireTrackingEvent({
    clickId: body.sub1,
    stage,
    value: body.value ?? undefined,
    currency: body.currency ?? undefined,
  });

  return jsonCors({ ok: true, event: body.event, capi: result });
}
