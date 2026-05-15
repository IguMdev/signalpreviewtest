import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  [k: string]: unknown;
};

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
      custom_data: opts.customData,
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
