import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Painel SMM ativo para novos pedidos: n1panel.
// JAP fica somente como fallback de leitura para pedidos antigos já criados lá.
const N1PANEL_URL = "https://n1panel.com/api/v2";
const LEGACY_JAP_URL = "https://justanotherpanel.com/api/v2";
const DEFAULT_N1_REACTIONS_SERVICE_ID = 2208;
const DEFAULT_N1_MEMBERS_SERVICE_ID = 3440;

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
    if (data.welcomeBotEnabled) {
      await assertActiveBotSub(userId, "boasvindas");
    }
    if (data.forwarderEnabled) {
      await assertActiveBotSub(userId, "encaminhador");
    }
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

// =====================================================================
// Active subscription gate (BotBoasVindas / BotEncaminhador)
// =====================================================================

async function assertActiveBotSub(userId: string, botType: "boasvindas" | "encaminhador") {
  const { data } = await supabaseAdmin
    .from("user_engagement_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("bot_type", botType)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!data) {
    const label = botType === "boasvindas" ? "BotBoasVindas" : "BotEncaminhador";
    throw new Error(`Você não tem assinatura ativa de ${label}. Adquira na aba Recarga.`);
  }
}

// =====================================================================
// BotBoasVindas — config por sala
// =====================================================================

export const getWelcomeBotConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("room_engagement_settings")
      .select("welcome_bot_enabled, welcome_message, welcome_image_path, welcome_image_mime, welcome_video_id, welcome_parse_mode, welcome_premium_enabled, welcome_premium_account_id")
      .eq("room_id", data.roomId)
      .maybeSingle();
    return row;
  });

export const upsertWelcomeBotConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().uuid(),
      enabled: z.boolean(),
      message: z.string().max(4000).nullable().optional(),
      imagePath: z.string().max(500).nullable().optional(),
      imageMime: z.string().max(100).nullable().optional(),
      videoId: z.string().uuid().nullable().optional(),
      parseMode: z.enum(["HTML", "MarkdownV2", "Markdown"]).optional(),
      premiumEnabled: z.boolean().optional(),
      premiumAccountId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.enabled) await assertActiveBotSub(userId, "boasvindas");
    const { error } = await supabase
      .from("room_engagement_settings")
      .upsert(
        {
          room_id: data.roomId,
          user_id: userId,
          welcome_bot_enabled: data.enabled,
          welcome_message: data.message ?? null,
          welcome_image_path: data.imagePath ?? null,
          welcome_image_mime: data.imageMime ?? null,
          welcome_video_id: data.videoId ?? null,
          welcome_parse_mode: data.parseMode ?? "HTML",
          welcome_premium_enabled: data.premiumEnabled ?? false,
          welcome_premium_account_id: data.premiumAccountId ?? null,
        } as never,
        { onConflict: "room_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =====================================================================
// BotEncaminhador — config por sala
// =====================================================================

export const getForwarderConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("room_engagement_settings")
      .select("forwarder_enabled, forwarder_source_chat_id, forwarder_target_chat_ids, forwarder_allowed_types, forwarder_marked_recurring, forwarder_marked_scheduled, forwarder_marked_templates, forwarder_premium_enabled, forwarder_premium_account_id")
      .eq("room_id", data.roomId)
      .maybeSingle();
    return row;
  });

export const upsertForwarderConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().uuid(),
      enabled: z.boolean(),
      sourceChatId: z.number().int().nullable().optional(),
      targetChatIds: z.array(z.number().int()).max(50).optional(),
      allowedTypes: z.array(z.string().min(1).max(32)).max(20).optional(),
      markedRecurring: z.array(z.string().uuid()).max(200).optional(),
      markedScheduled: z.array(z.string().uuid()).max(200).optional(),
      markedTemplates: z.array(z.string().min(1).max(64)).max(50).optional(),
      premiumEnabled: z.boolean().optional(),
      premiumAccountId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.enabled) await assertActiveBotSub(userId, "encaminhador");
    const { error } = await supabase
      .from("room_engagement_settings")
      .upsert(
        {
          room_id: data.roomId,
          user_id: userId,
          forwarder_enabled: data.enabled,
          forwarder_source_chat_id: data.sourceChatId ?? null,
          forwarder_target_chat_ids: data.targetChatIds ?? [],
          forwarder_allowed_types: data.allowedTypes ?? [],
          forwarder_marked_recurring: data.markedRecurring ?? [],
          forwarder_marked_scheduled: data.markedScheduled ?? [],
          forwarder_marked_templates: data.markedTemplates ?? [],
          forwarder_premium_enabled: data.premiumEnabled ?? false,
          forwarder_premium_account_id: data.premiumAccountId ?? null,
        },
        { onConflict: "room_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =====================================================================
// Cached chats por conta — para selecionar origem/destinos do encaminhador
// =====================================================================

export const listAccountChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("telegram_chats")
      .select("account_id, chat_id, title, username, type")
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Lista os itens (modelos / agendamentos / recorrentes) vinculados à sala
// para o usuário marcar quais o encaminhador deve mirror-ar para os destinos.
export const listForwarderSourceItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ roomId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [tpls, scheds, recs] = await Promise.all([
      supabase
        .from("quick_send_templates")
        .select("id, name, sort_order")
        .eq("default_room_id", data.roomId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("scheduled_messages")
        .select("id, content, scheduled_at, status")
        .eq("room_id", data.roomId)
        .in("status", ["pending", "sent"])
        .order("scheduled_at", { ascending: true })
        .limit(100),
      supabase
        .from("recurring_schedules")
        .select("id, title, is_active")
        .eq("room_id", data.roomId)
        .order("title", { ascending: true }),
    ]);
    return {
      templates: tpls.data ?? [],
      scheduled: scheds.data ?? [],
      recurring: recs.data ?? [],
    };
  });

async function callSmmPanel(params: Record<string, string | number>) {
  const key =
    process.env.N1PANEL_API_KEY ||
    process.env.SMM_PANEL_API_KEY;
  if (!key) throw new Error("Nenhuma chave de painel SMM configurada (N1PANEL_API_KEY).");
  const body = new URLSearchParams({ key, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(N1PANEL_URL, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`SMM panel ${res.status}: ${JSON.stringify(json)}`);
  return json as { order?: number; error?: string; status?: string; charge?: string };
}

export const dispatchEngagementBoost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      roomId: z.string().uuid(),
      type: z.enum(["reaction", "members"]),
      postId: z.number().int().positive().optional(),
      quantity: z.number().int().min(10).max(50000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirma posse da sala e deriva username público do canal.
    const { data: room } = await supabase
      .from("rooms")
      .select("id, name, default_account_id")
      .eq("id", data.roomId)
      .maybeSingle();
    if (!room) throw new Error("Sala não encontrada (ou sem permissão).");

    const { data: roomChat } = await supabaseAdmin
      .from("room_chats")
      .select("chat_id")
      .eq("room_id", data.roomId)
      .maybeSingle();
    if (!roomChat?.chat_id) {
      throw new Error("Esta sala não tem um canal Telegram vinculado. Vincule um chat primeiro.");
    }
    const { data: chat } = await supabaseAdmin
      .from("telegram_chats")
      .select("username, type, title")
      .eq("chat_id", roomChat.chat_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!chat?.username) {
      throw new Error(
        "O canal desta sala não é público (não tem @username). O painel SMM precisa de canal público para entregar.",
      );
    }

    const target =
      data.type === "reaction" && data.postId != null
        ? `https://t.me/${chat.username}/${data.postId}`
        : `https://t.me/${chat.username}`;

    if (data.type === "reaction" && data.postId == null) {
      throw new Error("Para reações é necessário informar o número do post (postId).");
    }

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
        target,
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
        link: target,
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
// Alocação automática de assinaturas em sala (modal pós-pagamento + renovação)
// =====================================================================

/**
 * Retorna assinaturas ativas de inscritos/interacoes que ainda NÃO foram
 * alocadas a uma sala (target_room_id IS NULL). O dialog global usa isso
 * para abrir automaticamente o modal de escolha de canal.
 */
export const listPendingBoostAllocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("user_engagement_subscriptions")
      .select("id, bot_type, current_period_end, plan:engagement_plans(name, monthly_quota, smm_service_id, smm_default_quantity, bot_type)")
      .eq("status", "active")
      .in("bot_type", ["inscritos", "interacoes"])
      .is("target_room_id", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Lista as salas do usuário que têm um canal Telegram público vinculado
 * (com @username) — únicas elegíveis para receber boost SMM.
 */
export const listEligibleBoostRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rooms, error } = await supabase
      .from("rooms")
      .select("id, name, photo_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rooms?.length) return [];

    // Para cada sala, descobre o canal vinculado e o username público
    const ids = rooms.map((r) => r.id);
    const { data: chats } = await supabaseAdmin
      .from("room_chats")
      .select("room_id, chat_id")
      .in("room_id", ids);
    const chatIds = (chats ?? []).map((c) => c.chat_id);
    const { data: tchats } = await supabaseAdmin
      .from("telegram_chats")
      .select("chat_id, username, title, type")
      .in("chat_id", chatIds.length ? chatIds : [0])
      .eq("user_id", userId);
    const byChat = new Map((tchats ?? []).map((t) => [String(t.chat_id), t]));
    const byRoom = new Map(
      (chats ?? []).map((c) => [c.room_id, byChat.get(String(c.chat_id))]),
    );

    return rooms
      .map((r) => {
        const tc = byRoom.get(r.id);
        return {
          id: r.id,
          name: r.name,
          photoUrl: r.photo_url,
          username: tc?.username ?? null,
          channelTitle: tc?.title ?? null,
          hasPublicChannel: !!tc?.username,
        };
      })
      .filter((r) => r.hasPublicChannel);
  });

/**
 * Aloca uma sala a uma assinatura e dispara automaticamente a cota inteira.
 *   • inscritos → fire-and-forget de monthly_quota membros no n1panel
 *   • interacoes → apenas salva a sala (cota é consumida por sinal pelo
 *     triggerSignalReactions)
 * Idempotente: se a sub já tem target_room_id, retorna 409.
 */
export const allocateSubscriptionToRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      subscriptionId: z.string().uuid(),
      roomId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    return await allocateAndAutoDispatch({
      userId,
      subscriptionId: data.subscriptionId,
      roomId: data.roomId,
    });
  });

/**
 * Núcleo reutilizável de alocação+disparo. Usado tanto pela função do cliente
 * acima quanto pelo webhook Kirvano (renovação repete o canal anterior).
 */
export async function allocateAndAutoDispatch(opts: {
  userId: string;
  subscriptionId: string;
  roomId: string;
}) {
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("user_engagement_subscriptions")
    .select("*, plan:engagement_plans(*)")
    .eq("id", opts.subscriptionId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (subErr) throw new Error(subErr.message);
  if (!sub) throw new Error("Assinatura não encontrada.");
  if ((sub as any).target_room_id) {
    throw new Error("Esta assinatura já está alocada a uma sala.");
  }
  const plan = (sub as any).plan;
  if (!plan) throw new Error("Plano não encontrado.");
  const botType = plan.bot_type as string;
  if (botType !== "inscritos" && botType !== "interacoes") {
    throw new Error("Apenas Inscritos/Interações precisam de canal.");
  }

  // Verifica posse da sala e canal público
  const { data: room } = await supabaseAdmin
    .from("rooms")
    .select("id, user_id")
    .eq("id", opts.roomId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (!room) throw new Error("Sala inválida.");

  const { data: rc } = await supabaseAdmin
    .from("room_chats")
    .select("chat_id")
    .eq("room_id", opts.roomId)
    .maybeSingle();
  if (!rc?.chat_id) throw new Error("A sala não tem canal vinculado.");

  const { data: chat } = await supabaseAdmin
    .from("telegram_chats")
    .select("username")
    .eq("chat_id", rc.chat_id)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (!chat?.username) {
    throw new Error("O canal da sala não é público (sem @username).");
  }

  const link = `https://t.me/${chat.username}`;

  // Marca a alocação imediatamente (idempotência)
  await supabaseAdmin
    .from("user_engagement_subscriptions")
    .update({ target_room_id: opts.roomId, target_link: link })
    .eq("id", opts.subscriptionId);

  if (botType === "interacoes") {
    // Reações são consumidas por sinal — não dispara cota inteira agora.
    return { ok: true, mode: "saved" as const, link };
  }

  // inscritos: dispara a cota mensal inteira no n1panel
  // Usa o service_id do env (validado no n1panel) e cai para o do plano caso não configurado.
  const serviceId = SVC_MEMBERS || plan.smm_service_id;
  const quantity = plan.smm_default_quantity ?? plan.monthly_quota ?? 0;
  if (!serviceId || !quantity) {
    throw new Error("Plano sem configuração SMM (service_id/quantity).");
  }

  const result = await placeSmmOrder({
    userId: opts.userId,
    subscriptionId: opts.subscriptionId,
    serviceId,
    link,
    quantity,
    type: "members",
    roomId: opts.roomId,
  });
  if (!result.ok) {
    throw new Error(`Falha ao despachar inscritos: ${result.error}`);
  }
  await supabaseAdmin
    .from("user_engagement_subscriptions")
    .update({
      units_used: quantity,
      auto_dispatched_at: new Date().toISOString(),
    })
    .eq("id", opts.subscriptionId);
  return {
    ok: true,
    mode: "dispatched" as const,
    smmOrderId: result.smmOrderId,
    quantity,
    link,
  };
}

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

    const serviceId = SVC_MEMBERS || plan.smm_service_id;
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
    // Idempotência: registra (chat_id, message_id) ANTES de disparar.
    // Em retries ou chamadas duplicadas (manual + mirror + cron), o conflito
    // na PK garante que o JAP só recebe a ordem uma vez por mensagem real.
    const { data: claim, error: claimErr } = await supabaseAdmin
      .from("engagement_reaction_dispatches")
      .insert({
        chat_id: opts.chatId,
        telegram_message_id: opts.telegramMessageId,
        user_id: opts.userId,
      } as never)
      .select("chat_id")
      .maybeSingle();
    if (claimErr) {
      // 23505 = unique_violation -> já disparado, sem-op silencioso
      if ((claimErr as { code?: string }).code === "23505") return;
      console.error("[triggerSignalReactions] claim failed:", claimErr);
      return;
    }
    if (!claim) return;

    const { data: sub } = await supabaseAdmin
      .from("user_engagement_subscriptions")
      .select("*, plan:engagement_plans(*)")
      .eq("user_id", opts.userId)
      .eq("bot_type", "interacoes")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub || !(sub as any).plan) {
      await releaseReactionClaim(opts.chatId, opts.telegramMessageId);
      return;
    }
    const plan = (sub as any).plan;
    const qty = plan.smm_default_quantity ?? plan.monthly_quota ?? 0;
    if (!qty) {
      await releaseReactionClaim(opts.chatId, opts.telegramMessageId);
      return;
    }

    // Respeita cota mensal — sem disparar se já excedeu.
    const remaining = (plan.monthly_quota ?? qty) - ((sub as any).units_used ?? 0);
    if (remaining < qty) {
      await releaseReactionClaim(opts.chatId, opts.telegramMessageId);
      return;
    }

    const { data: chat } = await supabaseAdmin
      .from("telegram_chats")
      .select("username")
      .eq("chat_id", opts.chatId)
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (!chat?.username) {
      await releaseReactionClaim(opts.chatId, opts.telegramMessageId);
      return; // chat privado — JAP precisa link público
    }

    const link = `https://t.me/${chat.username}/${opts.telegramMessageId}`;
    const serviceId = SVC_REACTIONS || plan.smm_service_id;

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
      await supabaseAdmin
        .from("engagement_reaction_dispatches")
        .update({
          subscription_id: (sub as any).id,
          smm_order_id: result.smmOrderId ? String(result.smmOrderId) : null,
        } as never)
        .eq("chat_id", opts.chatId)
        .eq("telegram_message_id", opts.telegramMessageId);
    } else {
      // Falha no SMM: libera o claim para permitir nova tentativa futura.
      await releaseReactionClaim(opts.chatId, opts.telegramMessageId);
    }
  } catch (e) {
    console.error("[triggerSignalReactions] failed:", e);
    await releaseReactionClaim(opts.chatId, opts.telegramMessageId).catch(() => undefined);
  }
}

async function releaseReactionClaim(chatId: number, telegramMessageId: number) {
  await supabaseAdmin
    .from("engagement_reaction_dispatches")
    .delete()
    .eq("chat_id", chatId)
    .eq("telegram_message_id", telegramMessageId);
}
