import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendMetaEvent } from "@/lib/meta-capi.server";

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
            if (eventType === "join" && u.id) {
              await sendMetaEvent({
                userId: acc.user_id,
                eventName: "CompleteRegistration",
                eventId: `tg-join-${cm.chat.id}-${u.id}-${cm.date ?? Math.floor(Date.now() / 1000)}`,
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
        }

        return Response.json({ ok: true });
      },
    },
  },
});