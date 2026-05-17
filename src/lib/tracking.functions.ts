import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const VERTICALS = ["bet", "igaming", "hot", "promo", "outro"] as const;
export const EVENT_OPTIONS = [
  "off", "Lead", "CompleteRegistration", "Subscribe", "ViewContent", "Contact",
  "InitiateCheckout", "AddPaymentInfo", "AddToCart", "Purchase", "StartTrial",
] as const;

const pixelSchema = z.object({
  name: z.string().min(1).max(120),
  vertical: z.enum(VERTICALS).default("outro"),
  is_active: z.boolean().default(true),
  meta_integration_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  event_on_join: z.enum(EVENT_OPTIONS).default("Lead"),
  event_on_offer_click: z.enum(EVENT_OPTIONS).default("InitiateCheckout"),
  event_on_register: z.enum(EVENT_OPTIONS).default("CompleteRegistration"),
  event_on_deposit: z.enum(EVENT_OPTIONS).default("Purchase"),
  meta_pixel_id: z.string().trim().max(64).nullable().optional(),
  meta_access_token: z.string().trim().max(1024).nullable().optional(),
  meta_test_event_code: z.string().trim().max(64).nullable().optional(),
});

export const listPixels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tracking_pixels" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const getPixel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pixel, error } = await supabase
      .from("tracking_pixels" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pixel) throw new Error("Pixel não encontrado");
    return pixel as any;
  });

export const createPixel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pixelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let botUsername: string | null = null;
    if (data.account_id) {
      const { data: acc } = await supabase
        .from("telegram_accounts")
        .select("bot_username")
        .eq("id", data.account_id)
        .maybeSingle();
      botUsername = acc?.bot_username ?? null;
    }
    const { data: inserted, error } = await supabase
      .from("tracking_pixels" as never)
      .insert({ ...data, user_id: userId, bot_username: botUsername } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted as any;
  });

export const updatePixel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pixelSchema.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    let botUsername: string | undefined = undefined;
    if (rest.account_id) {
      const { data: acc } = await supabase
        .from("telegram_accounts")
        .select("bot_username")
        .eq("id", rest.account_id)
        .maybeSingle();
      botUsername = acc?.bot_username ?? undefined;
    }
    const update: any = { ...rest };
    if (botUsername !== undefined) update.bot_username = botUsername;
    const { error } = await supabase
      .from("tracking_pixels" as never)
      .update(update as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePixel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tracking_pixels" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ OFFERS ============
const offerSchema = z.object({
  pixel_id: z.string().uuid(),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9_-]+$/, "Use apenas letras minúsculas, números, _ e -"),
  name: z.string().min(1).max(120),
  destination_url: z.string().url(),
  subid_param: z.string().min(1).max(30).default("sub1"),
  default_event: z.enum(EVENT_OPTIONS).default("InitiateCheckout"),
  default_value: z.number().nullable().optional(),
  default_currency: z.string().min(3).max(3).default("BRL"),
});

export const listOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pixel_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("tracking_offers" as never)
      .select("*")
      .eq("pixel_id", data.pixel_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => offerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("tracking_offers" as never)
      .insert({ ...data, user_id: userId } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted as any;
  });

export const updateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => offerSchema.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("tracking_offers" as never)
      .update(rest as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tracking_offers" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CLICKS / STATS ============
export const listRecentClicks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pixel_id: z.string().uuid(),
    limit: z.number().min(1).max(500).default(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("tracking_clicks" as never)
      .select("click_id, created_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, ttclid, gclid, ip, joined_at, clicked_offer_at, registered_at, deposited_at, tg_username, tg_user_id, sale_value, sale_currency")
      .eq("pixel_id", data.pixel_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const getPixelStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pixel_id: z.string().uuid(),
    days: z.number().min(1).max(365).default(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ownership check
    const { data: pixel } = await supabase
      .from("tracking_pixels" as never)
      .select("id")
      .eq("id", data.pixel_id)
      .maybeSingle();
    if (!pixel) throw new Error("Pixel não encontrado");

    const from = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("tracking_clicks" as never)
      .select("created_at, joined_at, clicked_offer_at, registered_at, deposited_at, sale_value")
      .eq("pixel_id", data.pixel_id)
      .eq("user_id", userId)
      .gte("created_at", from);
    if (error) throw new Error(error.message);

    const clicks = rows?.length ?? 0;
    let joins = 0, offerClicks = 0, registers = 0, deposits = 0, revenue = 0;
    for (const r of (rows ?? []) as any[]) {
      if (r.joined_at) joins++;
      if (r.clicked_offer_at) offerClicks++;
      if (r.registered_at) registers++;
      if (r.deposited_at) deposits++;
      if (r.sale_value) revenue += Number(r.sale_value);
    }

    // daily series
    const byDay = new Map<string, { clicks: number; joins: number; registers: number; deposits: number }>();
    for (const r of (rows ?? []) as any[]) {
      const day = (r.created_at as string).slice(0, 10);
      const cur = byDay.get(day) ?? { clicks: 0, joins: 0, registers: 0, deposits: 0 };
      cur.clicks++;
      if (r.joined_at) cur.joins++;
      if (r.registered_at) cur.registers++;
      if (r.deposited_at) cur.deposits++;
      byDay.set(day, cur);
    }
    const series = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, v]) => ({ day, ...v }));

    return { clicks, joins, offerClicks, registers, deposits, revenue, series };
  });

export const getAttribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pixel_id: z.string().uuid(),
    group_col: z.enum(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]),
    days: z.number().min(1).max(365).default(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ownership
    const { data: pixel } = await supabase
      .from("tracking_pixels" as never)
      .select("id")
      .eq("id", data.pixel_id)
      .maybeSingle();
    if (!pixel) throw new Error("Pixel não encontrado");

    const from = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("tracking_clicks" as never)
      .select(`${data.group_col}, joined_at, clicked_offer_at, registered_at, deposited_at, sale_value`)
      .eq("pixel_id", data.pixel_id)
      .eq("user_id", userId)
      .gte("created_at", from);
    if (error) throw new Error(error.message);

    const agg = new Map<string, {
      dimension: string;
      clicks: number; joins: number; offer_clicks: number;
      registers: number; deposits: number; revenue: number;
    }>();
    for (const r of (rows ?? []) as any[]) {
      const key = (r[data.group_col] as string | null) ?? "(sem valor)";
      const cur = agg.get(key) ?? {
        dimension: key, clicks: 0, joins: 0, offer_clicks: 0, registers: 0, deposits: 0, revenue: 0,
      };
      cur.clicks++;
      if (r.joined_at) cur.joins++;
      if (r.clicked_offer_at) cur.offer_clicks++;
      if (r.registered_at) cur.registers++;
      if (r.deposited_at) cur.deposits++;
      if (r.sale_value) cur.revenue += Number(r.sale_value);
      agg.set(key, cur);
    }
    return Array.from(agg.values()).sort((a, b) => b.clicks - a.clicks).slice(0, 200);
  });

// ============ DOMAINS ============
const domainRegex = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export const listDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tracking_domains" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const createDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    domain: z.string().min(3).max(253).regex(domainRegex, "Domínio inválido"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain = data.domain.toLowerCase().trim();
    const { data: inserted, error } = await supabase
      .from("tracking_domains" as never)
      .insert({ user_id: userId, domain } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted as any;
  });

export const deleteDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tracking_domains" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: dom } = await supabase
      .from("tracking_domains" as never)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!dom) throw new Error("Domínio não encontrado");
    const d = dom as any;

    // Resolve TXT _lovable.<domain> and check the verification_token is present.
    const dns = await import("dns/promises");
    const recordName = `_lovable.${d.domain}`;
    let txtRecords: string[][] = [];
    try {
      txtRecords = await dns.resolveTxt(recordName);
    } catch (e) {
      throw new Error(`Falha ao consultar DNS (${recordName}). O registro TXT ainda pode não ter propagado.`);
    }
    const flat = txtRecords.flat().map((s) => s.trim());
    const expected = `lovable_verify=${d.verification_token}`;
    if (!flat.includes(expected)) {
      throw new Error(`Registro TXT não encontrado. Esperado: ${expected}`);
    }

    await supabase
      .from("tracking_domains" as never)
      .update({ verified_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    return { ok: true };
  });

/** Retorna a base de URL preferida do usuário para os links de tracking. */
export const getMyRedirectBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase
      .from("tracking_domains" as never)
      .select("domain, verified_at, is_active")
      .not("verified_at", "is", null)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const d = data as any;
    return { domain: d?.domain ?? null };
  });

// ============ POSTBACKS ============
export const POSTBACK_EVENTS = ["viewpage", "click_button", "channel_enter", "channel_leave"] as const;

const postbackSchema = z.object({
  pixel_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  url: z.string().url().max(2000),
  event: z.enum(POSTBACK_EVENTS),
  is_active: z.boolean().default(true),
});

export const listPostbacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pixel_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("tracking_postbacks" as never)
      .select("*")
      .eq("pixel_id", data.pixel_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const createPostback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => postbackSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("tracking_postbacks" as never)
      .insert({ ...data, user_id: userId } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted as any;
  });

export const updatePostback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => postbackSchema.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("tracking_postbacks" as never)
      .update(rest as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePostback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tracking_postbacks" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testPostback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    try {
      const res = await fetch(data.url, { method: "GET" });
      return { ok: res.ok, status: res.status };
    } catch (e: any) {
      return { ok: false, status: 0, error: e?.message ?? "Falha de rede" };
    }
  });
