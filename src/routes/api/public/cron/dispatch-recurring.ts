import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import { dispatchVideoNote } from "@/lib/videos.functions";
import { triggerSignalReactions } from "@/lib/engagement.functions";

function nowParts(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  const weekday = wdMap[get("weekday")] ?? 0;
  const hh = get("hour").padStart(2, "0");
  const mm = get("minute").padStart(2, "0");
  return { weekday, hhmm: `${hh}:${mm}` };
}

type Schedule = {
  id: string;
  user_id: string;
  room_id: string;
  account_id: string | null;
  content: string | null;
  video_id: string | null;
  parse_mode: string;
  times: string[];
  weekdays: number[];
  timezone: string;
  last_fire_key: string | null;
};

export const Route = createFileRoute("/api/public/cron/dispatch-recurring")({
  server: {
    handlers: {
      POST: async () => {
        const { data: schedules, error } = await supabaseAdmin
          .from("recurring_schedules")
          .select(
            "id, user_id, room_id, account_id, content, video_id, parse_mode, times, weekdays, timezone, last_fire_key",
          )
          .eq("is_active", true);
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const now = new Date();
        const dateKey = now.toISOString().slice(0, 16); // UTC YYYY-MM-DDTHH:MM
        let processed = 0;
        let fired = 0;

        for (const s of (schedules ?? []) as Schedule[]) {
          const { weekday, hhmm } = nowParts(s.timezone);
          if (!s.weekdays.includes(weekday)) continue;
          if (!s.times.includes(hhmm)) continue;
          if (s.last_fire_key === dateKey) continue;

          // claim this minute atomically
          const { data: claim } = await supabaseAdmin
            .from("recurring_schedules")
            .update({ last_fire_key: dateKey })
            .eq("id", s.id)
            .or(`last_fire_key.is.null,last_fire_key.neq.${dateKey}`)
            .select("id")
            .maybeSingle();
          if (!claim) continue;

          processed++;

          // resolve account
          let accountId = s.account_id;
          if (!accountId) {
            const { data: room } = await supabaseAdmin
              .from("rooms")
              .select("default_account_id")
              .eq("id", s.room_id)
              .maybeSingle();
            accountId = room?.default_account_id ?? null;
          }
          if (!accountId) continue;

          const { data: acc } = await supabaseAdmin
            .from("telegram_accounts")
            .select("bot_token")
            .eq("id", accountId)
            .maybeSingle();
          const { data: chats } = await supabaseAdmin
            .from("room_chats")
            .select("chat_id")
            .eq("room_id", s.room_id);
          if (!acc || !chats?.length) continue;

          let video: { storage_path: string; mime_type: string | null; duration_seconds: number | null; title: string } | null = null;
          if (s.video_id) {
            const { data: v } = await supabaseAdmin
              .from("videos")
              .select("storage_path, mime_type, duration_seconds, title")
              .eq("id", s.video_id)
              .maybeSingle();
            video = v ?? null;
          }

          let okAny = false;
          for (const c of chats) {
            const r = video
              ? await dispatchVideoNote({
                  botToken: acc.bot_token,
                  storagePath: video.storage_path,
                  chatId: c.chat_id,
                  duration: video.duration_seconds,
                  mimeType: video.mime_type,
                  filename: (video.title || "video").replace(/[^\w.-]+/g, "_") + ".mp4",
                })
              : await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
                  chat_id: c.chat_id,
                  text: s.content ?? "",
                  parse_mode: s.parse_mode,
                });
            await supabaseAdmin.from("message_logs").insert({
              user_id: s.user_id,
              chat_id: c.chat_id,
              ok: r.ok,
              telegram_message_id: r.result?.message_id ?? null,
              error: r.ok ? null : r.description ?? "erro",
            });
            if (r.ok) okAny = true;
            if (r.ok && r.result?.message_id) {
              await triggerSignalReactions({
                userId: s.user_id,
                chatId: c.chat_id,
                telegramMessageId: r.result.message_id,
                roomId: s.room_id,
              });
            }
          }

          await supabaseAdmin
            .from("recurring_schedules")
            .update({ last_sent_at: new Date().toISOString() })
            .eq("id", s.id);
          if (okAny) fired++;
        }

        return Response.json({ ok: true, processed, fired });
      },
    },
  },
});
