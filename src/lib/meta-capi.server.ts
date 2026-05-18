import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ╔══════════════════════════════════════════════════════════╗
// ║  LIB SERVER — META CAPI (Conversions API)                ║
// ║  Envia eventos server-side para o Pixel da Meta.         ║
// ╚══════════════════════════════════════════════════════════╝

const GRAPH_VERSION = "v21.0";

function sha256(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  return createHash("sha256").update(v).digest("hex");
}

export type MetaUserData = {
  email?: string | null;
  phone?: string | null;
  externalId?: string | number | null; // ex: telegram user id
  firstName?: string | null;
  lastName?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
};

export type MetaCustomData = {
  value?: number;
  currency?: string;
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
  search_string?: string;
  predicted_ltv?: number;
  num_items?: number;
  status?: string;
  [k: string]: unknown;
};

/**
 * Specs por evento padrão do Meta:
 *  - `required`: campos obrigatórios (Meta retorna erro / não atribui se faltar).
 *  - `recommended`: campos recomendados para qualidade de matching/atribuição.
 *  - `monetary`: se true, garantimos value+currency com defaults seguros
 *    quando o caller não passou (evita rejeição em Purchase/Subscribe/StartTrial).
 * Referência: https://developers.facebook.com/docs/meta-pixel/reference
 */
export const META_EVENT_SPECS: Record<
  string,
  { required: string[]; recommended: string[]; monetary?: boolean }
> = {
  // Conversão de valor — value+currency são OBRIGATÓRIOS
  Purchase: { required: ["value", "currency"], recommended: ["content_ids", "content_type", "num_items"], monetary: true },
  Subscribe: { required: ["value", "currency"], recommended: ["predicted_ltv"], monetary: true },
  StartTrial: { required: ["value", "currency"], recommended: ["predicted_ltv"], monetary: true },

  // Eventos com value/currency RECOMENDADOS (não falham se ausentes, mas perdem otimização)
  AddPaymentInfo: { required: [], recommended: ["value", "currency", "content_ids", "content_category"] },
  AddToCart: { required: [], recommended: ["value", "currency", "content_ids", "content_type", "content_name"] },
  AddToWishlist: { required: [], recommended: ["value", "currency", "content_name", "content_category"] },
  InitiateCheckout: { required: [], recommended: ["value", "currency", "content_ids", "num_items"] },
  Donate: { required: [], recommended: ["value", "currency"] },

  // Conteúdo / leads
  ViewContent: { required: [], recommended: ["content_ids", "content_type", "content_name", "value", "currency"] },
  Search: { required: [], recommended: ["search_string", "content_ids", "content_category"] },
  Lead: { required: [], recommended: ["content_name", "content_category", "value", "currency"] },
  CompleteRegistration: { required: [], recommended: ["content_name", "status", "value", "currency"] },
  Contact: { required: [], recommended: [] },
  CustomizeProduct: { required: [], recommended: [] },
  FindLocation: { required: [], recommended: [] },
  Schedule: { required: [], recommended: [] },
  SubmitApplication: { required: [], recommended: [] },

  // App / engajamento
  Rate: { required: [], recommended: [] },
  SpentCredits: { required: [], recommended: ["value"] },
  AchievementUnlocked: { required: [], recommended: [] },
  ActivateApp: { required: [], recommended: [] },
  CompleteTutorial: { required: [], recommended: [] },
  LevelAchieved: { required: [], recommended: [] },
  UnlockAchievement: { required: [], recommended: [] },

  // Pixel-equivalentes
  PageView: { required: [], recommended: [] },
  AdImpression: { required: [], recommended: [] },
  AdClick: { required: [], recommended: [] },
};

/**
 * Aplica defaults seguros e valida required fields do evento.
 * - Para eventos monetários, garante value=0 / currency="BRL" se ausentes.
 * - Retorna lista de campos required ausentes (vazia = OK).
 */
export function applyMetaEventDefaults(
  eventName: string,
  customData: MetaCustomData | undefined,
): { customData: MetaCustomData; missingRequired: string[]; warnings: string[] } {
  const spec = META_EVENT_SPECS[eventName];
  const data: MetaCustomData = { ...(customData ?? {}) };

  if (spec?.monetary) {
    if (data.value == null || Number.isNaN(Number(data.value))) data.value = 0;
    if (!data.currency) data.currency = "BRL";
  }

  const missingRequired: string[] = [];
  const warnings: string[] = [];
  if (spec) {
    for (const f of spec.required) {
      const v = (data as Record<string, unknown>)[f];
      if (v == null || v === "") missingRequired.push(f);
    }
    for (const f of spec.recommended) {
      const v = (data as Record<string, unknown>)[f];
      if (v == null || v === "") warnings.push(`missing recommended field: ${f}`);
    }
  } else {
    warnings.push(`unknown event "${eventName}" — sending as custom event`);
  }

  return { customData: data, missingRequired, warnings };
}

/**
 * Envia um evento via Meta Conversions API para o Pixel do usuário.
 * Silencioso por padrão — engole erros e apenas grava log.
 */
export async function sendMetaEvent(opts: {
  userId: string;
  eventName: string; // "Lead" | "Subscribe" | "Purchase" | "CompleteRegistration" | "ViewContent" ...
  eventId?: string; // chave de deduplicação — passe sempre que possível
  eventTime?: number; // unix seconds
  eventSourceUrl?: string;
  actionSource?: "website" | "system_generated" | "chat" | "other";
  userData?: MetaUserData;
  customData?: MetaCustomData;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Validação de schema do evento — bloqueia envios inválidos (ex.: Purchase sem value)
    const { customData: finalCustomData, missingRequired, warnings } = applyMetaEventDefaults(
      opts.eventName,
      opts.customData,
    );
    if (missingRequired.length > 0) {
      const err = `Evento "${opts.eventName}" inválido: campos obrigatórios ausentes em custom_data: ${missingRequired.join(", ")}`;
      try {
        await supabaseAdmin.from("meta_event_logs").insert({
          user_id: opts.userId,
          event_name: opts.eventName,
          event_id: opts.eventId ?? null,
          ok: false,
          error: err,
        });
      } catch {}
      return { ok: false, error: err };
    }
    if (warnings.length > 0) {
      console.warn("[meta-capi]", opts.eventName, warnings.join("; "));
    }

    const { data: integ } = await supabaseAdmin
      .from("meta_integrations")
      .select("pixel_id, access_token, test_event_code, is_active")
      .eq("user_id", opts.userId)
      .maybeSingle();

    if (!integ || !integ.is_active || !integ.pixel_id || !integ.access_token) {
      return { ok: false, error: "no_integration" };
    }

    const ud = opts.userData ?? {};
    const userData: Record<string, unknown> = {
      em: ud.email ? [sha256(ud.email)] : undefined,
      ph: ud.phone ? [sha256(ud.phone.replace(/\D/g, ""))] : undefined,
      external_id: ud.externalId != null ? [sha256(String(ud.externalId))] : undefined,
      fn: ud.firstName ? [sha256(ud.firstName)] : undefined,
      ln: ud.lastName ? [sha256(ud.lastName)] : undefined,
      client_ip_address: ud.clientIp ?? undefined,
      client_user_agent: ud.userAgent ?? undefined,
      fbp: ud.fbp ?? undefined,
      fbc: ud.fbc ?? undefined,
    };
    // limpa undefined
    Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);

    const event: Record<string, unknown> = {
      event_name: opts.eventName,
      event_time: opts.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: opts.actionSource ?? "system_generated",
      event_id: opts.eventId,
      event_source_url: opts.eventSourceUrl,
      user_data: userData,
      custom_data: finalCustomData,
    };
    Object.keys(event).forEach((k) => event[k] === undefined && delete event[k]);

    const body: Record<string, unknown> = { data: [event] };
    if (integ.test_event_code) body.test_event_code = integ.test_event_code;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${integ.pixel_id}/events?access_token=${encodeURIComponent(integ.access_token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    const ok = res.ok && !json?.error;

    await supabaseAdmin.from("meta_event_logs").insert({
      user_id: opts.userId,
      event_name: opts.eventName,
      event_id: opts.eventId ?? null,
      ok,
      request_payload: body as never,
      response_payload: json as never,
      error: ok ? null : (json?.error?.message ?? `HTTP ${res.status}`),
    });

    return ok ? { ok: true } : { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await supabaseAdmin.from("meta_event_logs").insert({
        user_id: opts.userId,
        event_name: opts.eventName,
        event_id: opts.eventId ?? null,
        ok: false,
        error: msg,
      });
    } catch {}
    return { ok: false, error: msg };
  }
}
