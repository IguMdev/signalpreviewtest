import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const VERTICALS = ["bet", "igaming", "hot", "promo", "outro"] as const;
export const TRACKING_MODES = ["telegram", "direct_response"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

/** Presets de defaults por modo de trackeamento. UI usa para pré-preencher. */
export const MODE_PRESETS = {
  telegram: {
    label: "Telegram (bot + canal)",
    description: "Anúncio Meta → bot do Telegram → oferta → cadastro/depósito. Ideal para bet, iGaming, +18 e promoções.",
    stages: [
      { key: "join", label: "Entrada no bot", defaultEvent: "Lead" },
      { key: "offer_click", label: "Clique na oferta", defaultEvent: "InitiateCheckout" },
      { key: "register", label: "Cadastro", defaultEvent: "CompleteRegistration" },
      { key: "deposit", label: "Depósito", defaultEvent: "Purchase" },
    ],
  },
  direct_response: {
    label: "Direct Response (Meta → página → checkout)",
    description: "Anúncio Meta → página de vendas/VSL → checkout → compra. Ideal para infoprodutos, mentorias e e-commerce direto.",
    stages: [
      { key: "view", label: "Visualização da página", defaultEvent: "ViewContent" },
      { key: "lead", label: "Lead qualificado (opt-in)", defaultEvent: "Lead" },
      { key: "checkout", label: "Iniciou checkout", defaultEvent: "InitiateCheckout" },
      { key: "payment_info", label: "Escolheu pagamento", defaultEvent: "AddPaymentInfo" },
      { key: "purchase", label: "Compra confirmada", defaultEvent: "Purchase" },
    ],
  },
} as const;

export const EVENT_OPTIONS = [
  "off", "Lead", "CompleteRegistration", "Subscribe", "ViewContent", "Contact",
  "InitiateCheckout", "AddPaymentInfo", "AddToCart", "Purchase", "StartTrial",
] as const;

const drConfigSchema = z.object({
  enable_lead: z.boolean().default(false),
  enable_add_to_cart: z.boolean().default(false),
  enable_initiate_checkout: z.boolean().default(true),
  initiate_checkout_url_contains: z.string().default(""),
  purchase_approval_only: z.boolean().default(true),
  purchase_value_mode: z.string().default("Valor da venda"),
  purchase_product: z.string().default("Qualquer"),
  ipv6_enabled: z.boolean().default(true),
  is_whatsapp: z.boolean().default(false).optional(),
});

const pixelSchema = z.object({
  name: z.string().min(1).max(120),
  vertical: z.enum(VERTICALS).default("outro"),
  tracking_mode: z.enum(TRACKING_MODES).default("telegram"),
  sales_page_url: z.string().url().nullable().optional(),
  is_active: z.boolean().default(true),
  meta_integration_id: z.string().uuid().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  event_on_join: z.enum(EVENT_OPTIONS).default("Lead"),
  event_on_offer_click: z.enum(EVENT_OPTIONS).default("InitiateCheckout"),
  event_on_register: z.enum(EVENT_OPTIONS).default("CompleteRegistration"),
  event_on_deposit: z.enum(EVENT_OPTIONS).default("Purchase"),
  event_on_view: z.enum(EVENT_OPTIONS).default("ViewContent"),
  event_on_lead: z.enum(EVENT_OPTIONS).default("Lead"),
  event_on_checkout: z.enum(EVENT_OPTIONS).default("InitiateCheckout"),
  event_on_payment_info: z.enum(EVENT_OPTIONS).default("AddPaymentInfo"),
  event_on_purchase: z.enum(EVENT_OPTIONS).default("Purchase"),
  meta_pixel_id: z.string().trim().max(64).nullable().optional(),
  meta_access_token: z.string().trim().max(1024).nullable().optional(),
  meta_test_event_code: z.string().trim().max(64).nullable().optional(),
  dr_config: drConfigSchema.default({}),
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
      .select("click_id, created_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, ttclid, gclid, ip, joined_at, clicked_offer_at, registered_at, deposited_at, tg_username, tg_user_id, sale_value, sale_currency, viewed_at, lead_at, checkout_at, payment_info_at, purchased_at, abandoned_cart_at, chargeback_at, refunded_at, landing_url, user_agent, external_id")
      .eq("pixel_id", data.pixel_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

// Lista cliques com filtros opcionais (data inicial/final e tipo de evento).
// Tipo: any (qualquer), click, join, offer_click, register, deposit
export const listClicksFiltered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pixel_id: z.string().uuid(),
    from: z.string().datetime().nullable().optional(),
    to: z.string().datetime().nullable().optional(),
    event: z.enum(["any", "click", "join", "offer_click", "register", "deposit"]).default("any"),
    limit: z.number().min(1).max(5000).default(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("tracking_clicks" as never)
      .select("click_id, created_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, ttclid, gclid, ip, joined_at, clicked_offer_at, registered_at, deposited_at, tg_username, tg_user_id, sale_value, sale_currency, external_user_id, viewed_at, lead_at, checkout_at, payment_info_at, purchased_at, abandoned_cart_at, chargeback_at, refunded_at")
      .eq("pixel_id", data.pixel_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.event === "join") q = q.not("joined_at", "is", null);
    else if (data.event === "offer_click") q = q.not("clicked_offer_at", "is", null);
    else if (data.event === "register") q = q.not("registered_at", "is", null);
    else if (data.event === "deposit") q = q.not("deposited_at", "is", null);
    const { data: rows, error } = await q;
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
      .select("created_at, joined_at, clicked_offer_at, registered_at, deposited_at, viewed_at, lead_at, checkout_at, payment_info_at, purchased_at, abandoned_cart_at, chargeback_at, refunded_at, sale_value")
      .eq("pixel_id", data.pixel_id)
      .eq("user_id", userId)
      .gte("created_at", from);
    if (error) throw new Error(error.message);

    const clicks = rows?.length ?? 0;
    let joins = 0, offerClicks = 0, registers = 0, deposits = 0, revenue = 0;
    let views = 0, leads = 0, checkouts = 0, paymentInfos = 0, purchases = 0;
    let abandonedCarts = 0, chargebacks = 0, refunds = 0;
    for (const r of (rows ?? []) as any[]) {
      if (r.joined_at) joins++;
      if (r.clicked_offer_at) offerClicks++;
      if (r.registered_at) registers++;
      if (r.deposited_at) deposits++;
      if (r.viewed_at) views++;
      if (r.lead_at) leads++;
      if (r.checkout_at) checkouts++;
      if (r.payment_info_at) paymentInfos++;
      if (r.purchased_at) purchases++;
      if (r.abandoned_cart_at) abandonedCarts++;
      if (r.chargeback_at) chargebacks++;
      if (r.refunded_at) refunds++;
      if (r.sale_value && !r.refunded_at && !r.chargeback_at) revenue += Number(r.sale_value);
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

    return { clicks, joins, offerClicks, registers, deposits, views, leads, checkouts, paymentInfos, purchases, abandonedCarts, chargebacks, refunds, revenue, series };
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

export const getDRDashboardStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pixel_id: z.string().uuid(),
    days: z.number().min(1).max(365).default(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // ownership
    const { data: pixel } = await supabase
      .from("tracking_pixels" as never)
      .select("id, meta_ad_account_id")
      .eq("id", data.pixel_id)
      .maybeSingle();
    if (!pixel) throw new Error("Pixel não encontrado");

    const from = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("tracking_clicks" as never)
      .select(`utm_source, utm_medium, utm_campaign, utm_content, viewed_at, lead_at, checkout_at, payment_info_at, purchased_at, abandoned_cart_at, refunded_at, chargeback_at, sale_value`)
      .eq("pixel_id", data.pixel_id)
      .eq("user_id", userId)
      .gte("created_at", from);
    
    if (error) throw new Error(error.message);

    // Agregação local (Telesignal)
    const campaigns = new Map<string, any>();
    const adsets = new Map<string, any>();
    const ads = new Map<string, any>();

    const getAgg = (map: Map<string, any>, key: string) => {
      const k = key || "(sem valor)";
      if (!map.has(k)) {
        map.set(k, { name: k, clicks: 0, leads: 0, checkouts: 0, purchases: 0, paymentInfos: 0, revenue: 0, spend: 0, cpc: 0, cpm: 0, ctr: 0 });
      }
      return map.get(k);
    };

    for (const r of (rows ?? []) as any[]) {
      // Usar fallback se null, mas para simplificar:
      const cCamp = getAgg(campaigns, r.utm_campaign);
      const cAdset = getAgg(adsets, r.utm_medium);
      const cAd = getAgg(ads, r.utm_content);

      [cCamp, cAdset, cAd].forEach(c => {
        if (r.viewed_at) c.clicks++;
        if (r.lead_at) c.leads++;
        if (r.checkout_at) c.checkouts++;
        if (r.purchased_at) c.purchases++;
        if (r.payment_info_at) c.paymentInfos++;
        if (r.sale_value && !r.refunded_at && !r.chargeback_at) c.revenue += Number(r.sale_value);
      });
    }

    // Busca gastos do Meta Ads se configurado
    let metaCampaigns: any[] = [];
    if ((pixel as any).meta_ad_account_id) {
      try {
        const { fetchMetaInsights } = await import("./meta-ads.functions");
        metaCampaigns = await fetchMetaInsights({ data: { accountId: (pixel as any).meta_ad_account_id, level: "campaign", days: data.days }, context });
        
        // Merge nos gastos da campanha baseados no nome ou ID
        for (const meta of metaCampaigns) {
          const spend = Number(meta.spend || 0);
          const cpm = Number(meta.cpm || 0);
          const cpc = Number(meta.cpc || 0);
          const ctr = Number(meta.ctr || 0);
          
          // Procurar na UTM se há o ID da campanha ou o nome exato
          for (const [k, v] of campaigns.entries()) {
            if (k.includes(meta.campaign_id) || k === meta.campaign_name) {
              v.spend += spend;
              v.cpm = cpm;
              v.cpc = cpc;
              v.ctr = ctr;
              v.meta_id = meta.campaign_id;
              // break; (não break para caso tenha várias UTMs da mesma)
            }
          }
        }
      } catch (err) {
        console.error("Falha ao buscar insights Meta:", err);
      }
    }

    const calcMetrics = (arr: any[]) => arr.map(a => {
      a.profit = a.revenue - a.spend;
      a.roi = a.spend > 0 ? a.profit / a.spend : 0;
      a.cpa = a.purchases > 0 ? a.spend / a.purchases : 0;
      a.cpi = a.checkouts > 0 ? a.spend / a.checkouts : 0;
      a.convRate = a.clicks > 0 ? (a.purchases / a.clicks) * 100 : 0;
      return a;
    }).sort((a, b) => b.revenue - a.revenue);

    return {
      campaigns: calcMetrics(Array.from(campaigns.values())),
      adsets: calcMetrics(Array.from(adsets.values())),
      ads: calcMetrics(Array.from(ads.values())),
      rawMetaCampaigns: metaCampaigns,
    };
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

    // Resolve TXT _signal.<domain> and check the verification_token is present.
    const dns = await import("dns/promises");
    const recordName = `_signal.${d.domain}`;
    let txtRecords: string[][] = [];
    try {
      txtRecords = await dns.resolveTxt(recordName);
    } catch (e) {
      throw new Error(`Falha ao consultar DNS (${recordName}). O registro TXT ainda pode não ter propagado.`);
    }
    const flat = txtRecords.flat().map((s) => s.trim());
    const expected = `signal_verify=${d.verification_token}`;
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
export const POSTBACK_EVENTS = [
  // Telegram
  "viewpage", "click_button", "channel_enter", "channel_leave",
  // Direct Response
  "lead", "checkout_started", "payment_info", "purchase",
] as const;

export const POSTBACK_EVENTS_BY_MODE = {
  telegram: ["viewpage", "click_button", "channel_enter", "channel_leave"],
  direct_response: ["viewpage", "lead", "checkout_started", "payment_info", "purchase"],
} as const;

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

// ============ INTEGRATIONS (Track4You-style) ============
export const INTEGRATION_EVENT_TYPES = ["register", "ftd", "deposit", "custom"] as const;

const integrationSchema = z.object({
  pixel_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  event_type: z.enum(INTEGRATION_EVENT_TYPES),
  custom_event_name: z.string().max(60).nullable().optional(),
  redirect_url: z.string().url(),
  meta_custom_event: z.string().max(60).nullable().optional(),
  meta_value: z.number().nullable().optional(),
  meta_currency: z.string().min(3).max(3).default("BRL"),
  is_active: z.boolean().default(true),
});

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tracking_integrations" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const createIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => integrationSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("tracking_integrations" as never)
      .insert({ ...data, user_id: userId } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted as any;
  });

export const updateIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => integrationSchema.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("tracking_integrations" as never)
      .update(rest as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tracking_integrations" as never)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testNativeWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    pixel_id: z.string().uuid(),
    webhook_url: z.string().url(),
    platform: z.string(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { pixel_id, webhook_url } = data;
    
    const fakeClickId = "test_" + Math.random().toString(36).substring(2);
    const fakeEmail = "teste_" + Math.random().toString(36).substring(2, 6) + "@telesignal.com.br";
    
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Insere o Lead usando Admin (bypassa RLS)
    const { error: insErr } = await supabaseAdmin.from("tracking_clicks").insert({
      pixel_id,
      click_id: fakeClickId,
      ip: "127.0.0.1",
      user_agent: "Telesignal Test Bot",
      lead_at: new Date().toISOString(),
      utm_source: "teste_webhook"
    });

    if (insErr) {
      console.error("Test Webhook Insert Error", insErr);
      throw new Error("Falha ao criar lead de teste");
    }

    const payload = {
      status: "approved",
      email: fakeEmail,
      amount: 97.50,
      currency: "BRL",
      metadata: { click_id: fakeClickId, utm_source: fakeClickId },
      transaction_status: "approved",
      sale_amount: 97.50,
      tracking: { src: fakeClickId, utm_source: fakeClickId, source: fakeClickId },
      data: {
        buyer: { email: fakeEmail },
        purchase: { status: "approved", price: { value: 97.50, currency_code: "BRL" }, tracking: { source: fakeClickId } },
        amount: 97.50,
        customer_email: fakeEmail,
        customer: { email: fakeEmail },
        payment_total: 97.50,
        metadata: { utm_source: fakeClickId }
      },
      Customer: { email: fakeEmail },
      customer: { email: fakeEmail },
      order_status: "paid",
      event: "transaction.approved",
      Commissions: { charge_amount: 97.50 },
      TrackingParameters: { src: fakeClickId }
    };

    try {
      const res = await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Webhook endpoint failed with status " + res.status);
      return { ok: true, clickId: fakeClickId };
    } catch (e: any) {
      console.error("Fetch Webhook Error:", e);
      throw new Error("Erro ao disparar para a URL do Webhook");
    }
  });
