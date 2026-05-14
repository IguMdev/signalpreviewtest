import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SMM_PANEL_URL = "https://justanotherpanel.com/api/v2";
// Default service IDs on JustAnotherPanel for Telegram. The user can override
// later via env if their account uses different IDs.
const SVC_REACTIONS = Number(process.env.SMM_SERVICE_REACTIONS_ID || "5993");
const SVC_MEMBERS = Number(process.env.SMM_SERVICE_MEMBERS_ID || "157");

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
  const key = process.env.SMM_PANEL_API_KEY;
  if (!key) throw new Error("SMM_PANEL_API_KEY não configurado");
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
