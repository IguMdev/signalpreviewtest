import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMetaEvent, type MetaUserData, type MetaCustomData } from "./meta-capi.server";

// ╔══════════════════════════════════════════════════════════╗
// ║  LIB SERVER — TRACKEAMENTO AVANÇADO (Track4You)          ║
// ║  Gera click_id, persiste em tracking_clicks e dispara    ║
// ║  o estágio correspondente no Meta CAPI.                  ║
// ╚══════════════════════════════════════════════════════════╝


const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateClickId(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function deriveFbc(fbc: string | null | undefined, fbclid: string | null | undefined): string | null {
  if (fbc) return fbc;
  if (!fbclid) return null;
  return `fb.1.${Date.now()}.${fbclid}`;
}

export type TrackingStage =
  | "join" | "offer_click" | "register" | "deposit"            // telegram
  | "view" | "lead" | "checkout" | "payment_info" | "purchase" | "abandoned_cart" | "chargeback" | "refund"; // direct response

const STAGE_TO_COLUMN: Record<TrackingStage, string> = {
  join: "joined_at",
  offer_click: "clicked_offer_at",
  register: "registered_at",
  deposit: "deposited_at",
  view: "viewed_at",
  lead: "lead_at",
  checkout: "checkout_at",
  payment_info: "payment_info_at",
  purchase: "purchased_at",
  abandoned_cart: "abandoned_cart_at",
  chargeback: "chargeback_at",
  refund: "refunded_at",
};

/**
 * Dispara evento Meta CAPI usando os dados ORIGINAIS do clique na landing.
 * Idempotente: usa event_id = `${click_id}:${stage}`, então pode chamar várias vezes.
 * Retorna { ok, eventName, eventId } e atualiza tracking_clicks.meta_events_sent.
 */
export async function fireTrackingEvent(opts: {
  clickId: string;
  stage: TrackingStage;
  extraUserData?: Partial<MetaUserData>;
  extraCustomData?: MetaCustomData;
  value?: number;
  currency?: string;
}): Promise<{ ok: boolean; eventName?: string; eventId?: string; error?: string }> {
  const { data: click } = await supabaseAdmin
    .from("tracking_clicks")
    .select("*, tracking_pixels(*)")
    .eq("click_id", opts.clickId)
    .maybeSingle();

  if (!click) return { ok: false, error: "click not found" };
  const pixel = (click as any).tracking_pixels;
  if (!pixel) return { ok: false, error: "pixel not found" };
  if (!pixel.is_active) return { ok: false, error: "pixel inactive" };

  // idempotência
  const sent = ((click as any).meta_events_sent ?? {}) as Record<string, string>;
  if (sent[opts.stage]) {
    return { ok: true, eventId: sent[opts.stage], eventName: "(already sent)" };
  }

  const eventName: string =
    opts.stage === "join" ? pixel.event_on_join :
    opts.stage === "offer_click" ? pixel.event_on_offer_click :
    opts.stage === "register" ? pixel.event_on_register :
    opts.stage === "deposit" ? pixel.event_on_deposit :
    opts.stage === "view" ? pixel.event_on_view :
    opts.stage === "lead" ? pixel.event_on_lead :
    opts.stage === "checkout" ? pixel.event_on_checkout :
    opts.stage === "payment_info" ? pixel.event_on_payment_info :
    opts.stage === "purchase" ? pixel.event_on_purchase :
    opts.stage === "abandoned_cart" ? "off" :
    opts.stage === "chargeback" ? "off" :
    opts.stage === "refund" ? "off" : "off";

  if (!eventName || eventName === "off") {
    return { ok: false, error: "event disabled for stage" };
  }

  const eventId = `${opts.clickId}:${opts.stage}`;

  const customData: MetaCustomData = {
    content_name: pixel.name,
    ...(opts.extraCustomData ?? {}),
  };
  if (opts.value != null) customData.value = opts.value;
  if (opts.currency) customData.currency = opts.currency;

  const userData: MetaUserData = {
    fbp: (click as any).fbp ?? undefined,
    fbc: deriveFbc((click as any).fbc, (click as any).fbclid) ?? undefined,
    clientIp: (click as any).ip ?? undefined,
    userAgent: (click as any).user_agent ?? undefined,
    externalId: (click as any).external_id ?? undefined,
    ...(opts.extraUserData ?? {}),
  };

  const result = await sendMetaEvent({
    userId: (click as any).user_id,
    eventName,
    eventId,
    actionSource: "website",
    eventSourceUrl: (click as any).landing_url ?? undefined,
    userData,
    customData,
  });

  // SEMPRE atualiza a data no banco para que o dashboard mostre os dados.
  // Só atualiza meta_events_sent se o Meta aceitar com sucesso.
  const updatePayload: any = {
    [STAGE_TO_COLUMN[opts.stage]]: new Date().toISOString()
  };

  if (result.ok) {
    updatePayload.meta_events_sent = { ...sent, [opts.stage]: eventId };
  }

  await supabaseAdmin
    .from("tracking_clicks")
    .update(updatePayload as never)
    .eq("click_id", opts.clickId);

  return { ok: result.ok, eventName, eventId, error: result.error };
}

export function hashFingerprint(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Postback-Secret",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonCors(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
