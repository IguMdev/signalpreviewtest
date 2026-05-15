import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMetaEvent } from "@/lib/meta-capi.server";
import { callTelegram } from "@/lib/telegram.server";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function classify(oldStatus: string | undefined, newStatus: string | undefined) {
  const wasIn = oldStatus === "member" || oldStatus === "administrator" || oldStatus === "creator" || oldStatus === "restricted";
  const isIn = newStatus === "member" || newStatus === "administrator" || newStatus === "creator" || newStatus === "restricted";
  if (!wasIn && isIn) return "join" as const;
  if (wasIn && !isIn) {
    if (newStatus === "kicked" || newStatus === "banned") return "kicked" as const;
    return "leave" as const;
  }
  return null;
}

function publicUrl(bucket: string, path: string): string {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

async function hasActiveSub(userId: string, botType: "boasvindas" | "encaminhador"): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_engagement_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("bot_type", botType)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function logBot(entry: {
  userId: string;
  accountId?: string | null;
  roomId?: string | null;
  botType: "boasvindas" | "encaminhador";
  event: "received" | "sent" | "skipped" | "failed";
  chatId?: number | null;
  targetChatId?: number | null;
  tgUserId?: number | null;
  tgUsername?: string | null;
  tgFirstName?: string | null;
  message?: string | null;
  error?: string | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    await supabaseAdmin.from("bot_execution_logs").insert({
      user_id: entry.userId,
      account_id: entry.accountId ?? null,
      room_id: entry.roomId ?? null,
      bot_type: entry.botType,
      event: entry.event,
      chat_id: entry.chatId ?? null,
      target_chat_id: entry.targetChatId ?? null,
      tg_user_id: entry.tgUserId ?? null,
      tg_username: entry.tgUsername ?? null,
      tg_first_name: entry.tgFirstName ?? null,
      message: entry.message ?? null,
      error: entry.error ?? null,
      details: (entry.details ?? null) as never,
    });
  } catch (e) {
    console.error("[bot-log] insert failed:", e);
  }
}

function buildInlineButton(text: string | null | undefined, url: string | null | undefined) {
  if (!text || !url) return undefined;
  return { inline_keyboard: [[{ text, url }]] };
}

function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

async function runWelcomeBot(opts: {
  userId: string;
  accountId: string;
  botToken: string | null | undefined;
  chatId: number;
  user: { id?: number; first_name?: string; last_name?: string; username?: string };
}) {
  if (!opts.botToken || !opts.user.id) return;
  await logBot({
    userId: opts.userId, accountId: opts.accountId, botType: "boasvindas",
    event: "received", chatId: opts.chatId, tgUserId: opts.user.id ?? null,
    tgUsername: opts.user.username ?? null, tgFirstName: opts.user.first_name ?? null,
  });
  if (!(await hasActiveSub(opts.userId, "boasvindas"))) {
    await logBot({
      userId: opts.userId, accountId: opts.accountId, botType: "boasvindas",
      event: "skipped", chatId: opts.chatId, tgUserId: opts.user.id ?? null,
      message: "Sem assinatura ativa do BotBoasVindas",
    });
    return;
  }

  // Find any room owned by this user that maps this chat_id
  const { data: rc } = await supabaseAdmin
    .from("room_chats")
    .select("room_id")
    .eq("user_id", opts.userId)
    .eq("chat_id", opts.chatId)
    .limit(1)
    .maybeSingle();
  if (!rc?.room_id) {
    await logBot({
      userId: opts.userId, accountId: opts.accountId, botType: "boasvindas",
      event: "skipped", chatId: opts.chatId, message: "Chat não está vinculado a nenhuma sala",
    });
    return;
  }

  const { data: cfg } = await supabaseAdmin
    .from("room_engagement_settings")
    .select("welcome_bot_enabled, welcome_message, welcome_image_path, welcome_image_mime, welcome_video_id, welcome_parse_mode, welcome_button_text, welcome_button_url")
    .eq("room_id", rc.room_id)
    .maybeSingle();
  if (!cfg?.welcome_bot_enabled) {
    await logBot({
      userId: opts.userId, accountId: opts.accountId, roomId: rc.room_id, botType: "boasvindas",
      event: "skipped", chatId: opts.chatId, message: "BotBoasVindas desativado para esta sala",
    });
    return;
  }

  const firstName = (opts.user.first_name ?? "amigo(a)").replace(/[<>&]/g, "");
  const mention = `<a href="tg://user?id=${opts.user.id}">${firstName}</a>`;
  const text = renderTemplate(cfg.welcome_message ?? "Seja bem-vindo(a), {name}! 🎉", {
    name: mention,
    first_name: firstName,
    username: opts.user.username ?? "",
  });

  const reply_markup = buildInlineButton(cfg.welcome_button_text, cfg.welcome_button_url);
  const parse_mode = cfg.welcome_parse_mode ?? "HTML";
  let mediaKind: "video_note" | "video" | "photo" | "text" = "text";
  let resp: { ok: boolean; description?: string } | null = null;

  // Video round (video_note) takes precedence > image > text
  if (cfg.welcome_video_id) {
    const { data: vid } = await supabaseAdmin
      .from("videos")
      .select("storage_path, kind")
      .eq("id", cfg.welcome_video_id)
      .maybeSingle();
    if (vid?.storage_path) {
      const url = publicUrl("videos", vid.storage_path);
      const method = vid.kind === "round" ? "sendVideoNote" : "sendVideo";
      const body: Record<string, unknown> = { chat_id: opts.chatId };
      if (method === "sendVideoNote") body.video_note = url;
      else { body.video = url; body.caption = text; body.parse_mode = parse_mode; }
      mediaKind = method === "sendVideoNote" ? "video_note" : "video";
      resp = await callTelegram(opts.botToken, method, body);
      // companion text/button when video_note (no caption support)
      if (method === "sendVideoNote") {
        await callTelegram(opts.botToken, "sendMessage", { chat_id: opts.chatId, text, parse_mode, reply_markup });
      } else if (reply_markup) {
        await callTelegram(opts.botToken, "sendMessage", { chat_id: opts.chatId, text: "\u2063", reply_markup });
      }
      await logBot({
        userId: opts.userId, accountId: opts.accountId, roomId: rc.room_id, botType: "boasvindas",
        event: resp?.ok ? "sent" : "failed", chatId: opts.chatId, tgUserId: opts.user.id ?? null,
        tgFirstName: opts.user.first_name ?? null, message: text,
        error: resp?.ok ? null : (resp?.description ?? "telegram error"),
        details: { media: mediaKind },
      });
      return;
    }
  }

  if (cfg.welcome_image_path) {
    const url = publicUrl("room-images", cfg.welcome_image_path);
    resp = await callTelegram(opts.botToken, "sendPhoto", {
      chat_id: opts.chatId, photo: url, caption: text, parse_mode, reply_markup,
    });
    await logBot({
      userId: opts.userId, accountId: opts.accountId, roomId: rc.room_id, botType: "boasvindas",
      event: resp?.ok ? "sent" : "failed", chatId: opts.chatId, tgUserId: opts.user.id ?? null,
      tgFirstName: opts.user.first_name ?? null, message: text,
      error: resp?.ok ? null : (resp?.description ?? "telegram error"),
      details: { media: "photo" },
    });
    return;
  }

  resp = await callTelegram(opts.botToken, "sendMessage", {
    chat_id: opts.chatId, text, parse_mode, reply_markup,
    disable_web_page_preview: true,
  });
  await logBot({
    userId: opts.userId, accountId: opts.accountId, roomId: rc.room_id, botType: "boasvindas",
    event: resp?.ok ? "sent" : "failed", chatId: opts.chatId, tgUserId: opts.user.id ?? null,
    tgFirstName: opts.user.first_name ?? null, message: text,
    error: resp?.ok ? null : (resp?.description ?? "telegram error"),
    details: { media: "text" },
  });
}

async function runForwarder(opts: {
  userId: string;
  accountId: string;
  botToken: string | null | undefined;
  fromChatId: number;
  messageId: number;
}) {
  if (!opts.botToken) return;
  const { data: cfgs } = await supabaseAdmin
    .from("room_engagement_settings")
    .select("forwarder_enabled, forwarder_target_chat_ids")
    .eq("user_id", opts.userId)
    .eq("forwarder_enabled", true)
    .eq("forwarder_source_chat_id", opts.fromChatId);
  if (!cfgs?.length) return; // não loga: barulho de mensagens não relacionadas

  await logBot({
    userId: opts.userId, accountId: opts.accountId, botType: "encaminhador",
    event: "received", chatId: opts.fromChatId, details: { message_id: opts.messageId },
  });
  if (!(await hasActiveSub(opts.userId, "encaminhador"))) {
    await logBot({
      userId: opts.userId, accountId: opts.accountId, botType: "encaminhador",
      event: "skipped", chatId: opts.fromChatId, message: "Sem assinatura ativa do BotEncaminhador",
    });
    return;
  }

  const targets = new Set<number>();
  for (const c of cfgs) for (const t of (c.forwarder_target_chat_ids ?? [])) targets.add(t);
  for (const target of targets) {
    if (target === opts.fromChatId) continue;
    const r = await callTelegram(opts.botToken, "copyMessage", {
      chat_id: target,
      from_chat_id: opts.fromChatId,
      message_id: opts.messageId,
    });
    await logBot({
      userId: opts.userId, accountId: opts.accountId, botType: "encaminhador",
      event: r?.ok ? "sent" : "failed", chatId: opts.fromChatId, targetChatId: target,
      error: r?.ok ? null : (r?.description ?? "telegram error"),
      details: { message_id: opts.messageId },
    });
  }
}

export const Route = createFileRoute("/api/public/telegram/webhook/$accountId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const accountId = params.accountId;
        const { data: acc } = await supabaseAdmin
          .from("telegram_accounts")
          .select("id, user_id, bot_token")
          .eq("id", accountId)
          .maybeSingle();

        if (!acc) return new Response("not found", { status: 404 });

        const expected = createHash("sha256")
          .update(`tg-tracking:${acc.bot_token}`)
          .digest("base64url");
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(provided, expected)) {
          return new Response("unauthorized", { status: 401 });
        }

        const update = await request.json().catch(() => null);
        if (!update) return Response.json({ ok: true });

        const cm = update.chat_member ?? update.my_chat_member;
        if (cm) {
          const eventType = classify(cm.old_chat_member?.status, cm.new_chat_member?.status);
          if (eventType) {
            const u = cm.new_chat_member?.user ?? cm.old_chat_member?.user ?? {};
            await supabaseAdmin.from("telegram_member_events").insert({
              user_id: acc.user_id,
              account_id: acc.id,
              chat_id: cm.chat.id,
              chat_title: cm.chat.title ?? null,
              tg_user_id: u.id ?? 0,
              tg_username: u.username ?? null,
              tg_first_name: u.first_name ?? null,
              event_type: eventType,
              old_status: cm.old_chat_member?.status ?? null,
              new_status: cm.new_chat_member?.status ?? null,
              occurred_at: new Date((cm.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            });

            // Dispara CompleteRegistration no Meta CAPI quando alguém entra
            // Dispara evento configurado no Meta CAPI conforme escolha do usuário
            if (u.id) {
              const { data: integ } = await supabaseAdmin
                .from("meta_integrations")
                .select("event_mappings, is_active")
                .eq("user_id", acc.user_id)
                .maybeSingle();
              const mappings = (integ?.event_mappings ?? {}) as Record<string, string>;
              const chosen = mappings[eventType];
              if (integ?.is_active && chosen && chosen !== "off") {
                await sendMetaEvent({
                  userId: acc.user_id,
                  eventName: chosen,
                  eventId: `tg-${eventType}-${cm.chat.id}-${u.id}-${cm.date ?? Math.floor(Date.now() / 1000)}`,
                  actionSource: "system_generated",
                  userData: {
                    externalId: u.id,
                    firstName: u.first_name ?? null,
                    lastName: u.last_name ?? null,
                  },
                  customData: {
                    content_name: cm.chat.title ?? "Telegram group",
                    content_ids: [String(cm.chat.id)],
                    content_type: "telegram_group",
                  },
                });
              }
            }

            // BotBoasVindas — dispara mensagem ao novo membro
            if (eventType === "join") {
              await runWelcomeBot({
                userId: acc.user_id,
                accountId: acc.id,
                botToken: acc.bot_token,
                chatId: cm.chat.id,
                user: u,
              }).catch((e) => console.error("[welcome-bot] failed:", e));
            }
          }
        }

        // BotEncaminhador — copia mensagens do canal/grupo de origem para destinos
        const post = update.channel_post ?? update.message;
        if (post?.chat?.id && post?.message_id) {
          await runForwarder({
            userId: acc.user_id,
            accountId: acc.id,
            botToken: acc.bot_token,
            fromChatId: post.chat.id,
            messageId: post.message_id,
          }).catch((e) => console.error("[forwarder] failed:", e));
        }

        return Response.json({ ok: true });
      },
    },
  },
});