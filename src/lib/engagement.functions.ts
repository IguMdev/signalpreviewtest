import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SMM_PANEL_URL = "https://justanotherpanel.com/api/v2";
// IDs padrão no JustAnotherPanel (podem ser sobrescritos por plano via
// engagement_plans.smm_service_id).
const SVC_REACTIONS = Number(process.env.SMM_SERVICE_REACTIONS_ID || "8485");
const SVC_MEMBERS = Number(process.env.SMM_SERVICE_MEMBERS_ID || "7102");

// =====================================================================
// Telegram URL normalization
// =====================================================================

/**
 * Normaliza um link do Telegram para o formato canônico aceito pelo painel JAP.
 * Aceita entradas como:
 *   - "@canal"  →  "https://t.me/canal"
 *   - "canal"   →  "https://t.me/canal"
 *   - "t.me/canal/"  →  "https://t.me/canal"
 *   - "https://telegram.me/canal"  →  "https://t.me/canal"
 *   - "https://t.me/canal/123" (post) → preservado
 *
 * Retorna `null` se for um link privado (joinchat / +hash) — esses não
 * funcionam no JAP porque o serviço precisa de um @username público.
 * Também retorna `null` para entradas vazias ou com caracteres inválidos.
 */
export function normalizeTelegramLink(input: string): string | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw) return null;

  // remove zero-width / wrapper chars que vêm do copy-paste
  raw = raw.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // "@username" → "username"
  if (raw.startsWith("@")) raw = raw.slice(1);

  // adiciona protocolo se vier "t.me/..." sem schema
  if (/^(t\.me|telegram\.me)\//i.test(raw)) raw = `https://${raw}`;

  // se ainda não tem protocolo nem domínio, assume username puro
  if (!/^https?:\/\//i.test(raw) && !raw.includes("/")) {
    if (!/^[a-zA-Z0-9_]{4,64}$/.test(raw)) return null;
    return `https://t.me/${raw}`;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "t.me" && host !== "telegram.me") return null;

  // remove leading/trailing slashes do path
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length === 0) return null;

  const first = segs[0];

  // Links privados (convite) não funcionam no JAP
  if (first.toLowerCase() === "joinchat" || first.startsWith("+")) return null;

  // valida username público
  if (!/^[a-zA-Z0-9_]{4,64}$/.test(first)) return null;

  // segundo segmento (post id) — opcional, deve ser numérico
  if (segs.length >= 2 && !/^\d+$/.test(segs[1])) return null;

  const path = segs.slice(0, 2).join("/");
  return `https://t.me/${path}`;
}

export const listEngagementPlans = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("engagement_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("user_engagement_subscriptions")
      .select("*, plan:engagement_plans(*)")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const getMySubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("user_engagement_subscriptions")
      .select("*, plan:engagement_plans(*)")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRoomEngagementSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("room_engagement_settings")
      .select("*")
      .eq("room_id", data.roomId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertRoomEngagementSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().uuid(),
      autoReactEnabled: z.boolean(),
      reactionsPerSignal: z.number().int().min(1).max(10000),
      reactEmojis: z.array(z.string().min(1).max(8)).min(1).max(20),
      delaySecondsMin: z.number().int().min(0).max(3600),
      delaySecondsMax: z.number().int().min(0).max(3600),
      autoMembersEnabled: z.boolean(),
      membersPerDay: z.number().int().min(1).max(50000),
      welcomeBotEnabled: z.boolean().optional(),
      welcomeMessage: z.string().max(2000).optional(),
      forwarderEnabled: z.boolean().optional(),
      forwarderSourceChatId: z.number().int().nullable().optional(),
      forwarderTargetChatIds: z.array(z.number().int()).max(50).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("room_engagement_settings")
      .upsert(
        {
          room_id: data.roomId,
          user_id: userId,
          auto_react_enabled: data.autoReactEnabled,
          reactions_per_signal: data.reactionsPerSignal,
          react_emojis: data.reactEmojis,
          delay_seconds_min: data.delaySecondsMin,
          delay_seconds_max: data.delaySecondsMax,
          auto_members_enabled: data.autoMembersEnabled,
          members_per_day: data.membersPerDay,
          welcome_bot_enabled: data.welcomeBotEnabled ?? false,
          welcome_message: data.welcomeMessage ?? null,
          forwarder_enabled: data.forwarderEnabled ?? false,
          forwarder_source_chat_id: data.forwarderSourceChatId ?? null,
          forwarder_target_chat_ids: data.forwarderTargetChatIds ?? [],
        },
        { onConflict: "room_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function callSmmPanel(params: Record<string, string | number>) {
  const key = process.env.JAP_API_KEY || process.env.SMM_PANEL_API_KEY;
  if (!key) throw new Error("JAP_API_KEY não configurado");
  const body = new URLSearchParams({ key, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(SMM_PANEL_URL, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SMM panel ${res.status}: ${JSON.stringify(json)}`);
  return json as { order?: number; error?: string; status?: string; charge?: string };
}

export const dispatchEngagementBoost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().uuid().optional(),
      type: z.enum(["reaction", "members"]),
      target: z.string().url(),
      quantity: z.number().int().min(10).max(50000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const normalized = normalizeTelegramLink(data.target);
    if (!normalized) {
      throw new Error("Link do Telegram inválido. Use um @username público (ex: https://t.me/seucanal).");
    }
    data.target = normalized;

    // Pick the subscription that matches this bot type
    const botType = data.type === "reaction" ? "interacoes" : "inscritos";
    const { data: sub } = await supabase
      .from("user_engagement_subscriptions")
      .select("*, plan:engagement_plans(*)")
      .eq("status", "active")
      .eq("bot_type", botType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) throw new Error(`Você não tem uma assinatura ativa de Bot${botType === "interacoes" ? "Interações" : "Inscritos"}.`);

    const plan = (sub as any).plan;
    const remaining = (plan?.monthly_quota ?? 0) - ((sub as any).units_used ?? 0);
    if (remaining < data.quantity) {
      throw new Error(`Cota insuficiente. Restam ${remaining}.`);
    }

    const serviceId = data.type === "reaction" ? SVC_REACTIONS : SVC_MEMBERS;

    // Insert pending order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("engagement_orders")
      .insert({
        user_id: userId,
        room_id: data.roomId,
        subscription_id: (sub as any).id,
        type: data.type,
        target: data.target,
        quantity: data.quantity,
        smm_service_id: serviceId,
      })
      .select("*")
      .single();
    if (orderErr) throw new Error(orderErr.message);

    try {
      const resp = await callSmmPanel({
        action: "add",
        service: serviceId,
        link: data.target,
        quantity: data.quantity,
      });
      if (resp.error || !resp.order) {
        await supabaseAdmin
          .from("engagement_orders")
          .update({ status: "failed", error: resp.error ?? "no order id", raw_response: resp as any })
          .eq("id", order.id);
        throw new Error(resp.error ?? "Falha ao despachar pedido");
      }
      await supabaseAdmin
        .from("engagement_orders")
        .update({
          status: "in_progress",
          smm_order_id: String(resp.order),
          cost_usd: resp.charge ? Number(resp.charge) : null,
          raw_response: resp as any,
        })
        .eq("id", order.id);

      // Decrement quota
      const newUsed = ((sub as any).units_used ?? 0) + data.quantity;
      await supabaseAdmin
        .from("user_engagement_subscriptions")
        .update({ units_used: newUsed } as never)
        .eq("id", (sub as any).id);

      return { ok: true, orderId: order.id, smmOrderId: resp.order };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("engagement_orders")
        .update({ status: "failed", error: msg })
        .eq("id", order.id);
      throw err;
    }
  });

export const listMyEngagementOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("engagement_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("user_engagement_subscriptions")
      .select("*, plan:engagement_plans(name, price_brl, bot_type)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// =====================================================================
// SMM dispatch helpers
// =====================================================================

async function placeSmmOrder(opts: {
  userId: string;
  subscriptionId: string;
  serviceId: number;
  link: string;
  quantity: number;
  type: "reaction" | "members";
  roomId?: string | null;
}) {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("engagement_orders")
    .insert({
      user_id: opts.userId,
      room_id: opts.roomId ?? null,
      subscription_id: opts.subscriptionId,
      type: opts.type,
      target: opts.link,
      quantity: opts.quantity,
      smm_service_id: opts.serviceId,
    })
    .select("*")
    .single();
  if (orderErr) throw new Error(orderErr.message);

  try {
    const resp = await callSmmPanel({
      action: "add",
      service: opts.serviceId,
      link: opts.link,
      quantity: opts.quantity,
    });
    if (resp.error || !resp.order) {
      await supabaseAdmin
        .from("engagement_orders")
        .update({ status: "failed", error: resp.error ?? "no order id", raw_response: resp as never })
        .eq("id", order.id);
      return { ok: false as const, error: resp.error ?? "no order id" };
    }
    await supabaseAdmin
      .from("engagement_orders")
      .update({
        status: "in_progress",
        smm_order_id: String(resp.order),
        cost_usd: resp.charge ? Number(resp.charge) : null,
        raw_response: resp as never,
      })
      .eq("id", order.id);
    return { ok: true as const, smmOrderId: resp.order, orderId: order.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("engagement_orders")
      .update({ status: "failed", error: msg })
      .eq("id", order.id);
    return { ok: false as const, error: msg };
  }
}

/**
 * Define o link do canal/grupo de uma assinatura de inscritos e dispara
 * o pedido completo no painel SMM (entrega única).
 */
export const setSubscriptionTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      subscriptionId: z.string().uuid(),
      targetLink: z.string().min(1).max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const normalized = normalizeTelegramLink(data.targetLink);
    if (!normalized) {
      throw new Error("Link inválido. Use um canal/grupo público do Telegram (ex: https://t.me/seucanal). Convites privados (joinchat/+hash) não são aceitos.");
    }
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("user_engagement_subscriptions")
      .select("*, plan:engagement_plans(*)")
      .eq("id", data.subscriptionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Assinatura não encontrada.");
    if ((sub as any).target_link) throw new Error("Esta assinatura já tem um canal definido.");
    const plan = (sub as any).plan;
    if (!plan || plan.bot_type !== "inscritos") {
      throw new Error("Apenas assinaturas de inscritos precisam de canal.");
    }

    const serviceId = plan.smm_service_id ?? SVC_MEMBERS;
    const quantity = plan.smm_default_quantity ?? plan.monthly_quota ?? 0;
    if (!serviceId || !quantity) throw new Error("Plano sem configuração SMM.");

    await supabaseAdmin
      .from("user_engagement_subscriptions")
      .update({ target_link: normalized })
      .eq("id", sub.id);

    const result = await placeSmmOrder({
      userId,
      subscriptionId: sub.id,
      serviceId,
      link: normalized,
      quantity,
      type: "members",
    });
    if (!result.ok) {
      throw new Error(`Falha ao despachar inscritos: ${result.error}`);
    }
    await supabaseAdmin
      .from("user_engagement_subscriptions")
      .update({ units_used: quantity })
      .eq("id", sub.id);
    return { ok: true, smmOrderId: result.smmOrderId };
  });

/**
 * Re-tenta um pedido SMM falhado, mantendo a mesma assinatura, link e quantidade.
 * Não consome cota adicional (a cota original já foi reservada no primeiro
 * disparo). Apenas pedidos com status `failed` podem ser re-tentados.
 */
export const retryEngagementOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: order, error } = await supabaseAdmin
      .from("engagement_orders")
      .select("*")
      .eq("id", data.orderId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status !== "failed") {
      throw new Error("Apenas pedidos com falha podem ser re-tentados.");
    }

    const normalized = normalizeTelegramLink(order.target) ?? order.target;
    const serviceId = order.smm_service_id ?? (order.type === "reaction" ? SVC_REACTIONS : SVC_MEMBERS);

    // Reset para pending antes de tentar de novo
    await supabaseAdmin
      .from("engagement_orders")
      .update({ status: "pending", error: null, raw_response: null })
      .eq("id", order.id);

    try {
      const resp = await callSmmPanel({
        action: "add",
        service: serviceId,
        link: normalized,
        quantity: order.quantity,
      });
      if (resp.error || !resp.order) {
        await supabaseAdmin
          .from("engagement_orders")
          .update({ status: "failed", error: resp.error ?? "no order id", raw_response: resp as never })
          .eq("id", order.id);
        throw new Error(resp.error ?? "Falha ao re-despachar pedido");
      }
      await supabaseAdmin
        .from("engagement_orders")
        .update({
          status: "in_progress",
          smm_order_id: String(resp.order),
          cost_usd: resp.charge ? Number(resp.charge) : null,
          raw_response: resp as never,
          target: normalized,
        })
        .eq("id", order.id);
      return { ok: true, smmOrderId: resp.order };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabaseAdmin
        .from("engagement_orders")
        .update({ status: "failed", error: msg })
        .eq("id", order.id);
      throw err;
    }
  });

/**
 * Dispara reações automáticas para um sinal recém-enviado.
 * Usa o username público do chat e o telegram_message_id para montar a URL
 * `https://t.me/<username>/<message_id>`. Sem-op se o usuário não tem
 * assinatura ativa de Interações ou se o chat é privado.
 * Não falha o envio principal — sempre engole erros.
 */
export async function triggerSignalReactions(opts: {
  userId: string;
  chatId: number;
  telegramMessageId: number;
  roomId?: string | null;
}) {
  try {
    const { data: sub } = await supabaseAdmin
      .from("user_engagement_subscriptions")
      .select("*, plan:engagement_plans(*)")
      .eq("user_id", opts.userId)
      .eq("bot_type", "interacoes")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub || !(sub as any).plan) return;
    const plan = (sub as any).plan;
    const qty = plan.smm_default_quantity ?? plan.monthly_quota ?? 0;
    if (!qty) return;

    const { data: chat } = await supabaseAdmin
      .from("telegram_chats")
      .select("username")
      .eq("chat_id", opts.chatId)
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (!chat?.username) return; // chat privado — JAP precisa link público

    const link = `https://t.me/${chat.username}/${opts.telegramMessageId}`;
    const serviceId = plan.smm_service_id ?? SVC_REACTIONS;

    const result = await placeSmmOrder({
      userId: opts.userId,
      subscriptionId: (sub as any).id,
      serviceId,
      link,
      quantity: qty,
      type: "reaction",
      roomId: opts.roomId ?? null,
    });
    if (result.ok) {
      await supabaseAdmin
        .from("user_engagement_subscriptions")
        .update({ units_used: ((sub as any).units_used ?? 0) + qty })
        .eq("id", (sub as any).id);
    }
  } catch (e) {
    console.error("[triggerSignalReactions] failed:", e);
  }
}
