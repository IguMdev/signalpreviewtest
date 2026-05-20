import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";

// CRON: EXPERT-ENGAGEMENT
// Roda a cada 1min. Para cada expert_engagement_prompts.is_active, se o dia
// da semana atual está em weekdays e o horário (HH:MM) bate com agora (TZ
// America/Sao_Paulo, janela de 1min) e ainda não foi enviado hoje, dispara
// no(s) chat(s) da sala (pergunta = sendMessage, poll = sendPoll).

function nowInSP() {
  const d = new Date();
  // simples: usar locale string com timeZone para extrair HH:MM e weekday
  const tz = "America/Sao_Paulo";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hhmm: `${get("hour")}:${get("minute")}`,
    weekday: wdMap[get("weekday")] ?? 0,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export const Route = createFileRoute("/api/public/cron/expert-engagement")({
  server: {
    handlers: {
      POST: async () => {
        const { hhmm, weekday, dateKey } = nowInSP();
        const { data: prompts } = await supabaseAdmin
          .from("expert_engagement_prompts" as any)
          .select("*")
          .eq("is_active", true);

        let sent = 0;
        for (const p of (prompts as any[]) ?? []) {
          const wd: number[] = p.weekdays ?? [];
          if (!wd.includes(weekday)) continue;
          const promptTime = (p.send_time ?? "").slice(0, 5);
          if (promptTime !== hhmm) continue;
          const last = p.last_sent_at ? new Date(p.last_sent_at).toISOString().slice(0, 10) : "";
          if (last === dateKey) continue;

          const [{ data: chats }, { data: room }] = await Promise.all([
            supabaseAdmin.from("room_chats").select("chat_id").eq("room_id", p.room_id),
            supabaseAdmin.from("rooms").select("default_account_id").eq("id", p.room_id).maybeSingle(),
          ]);
          if (!chats?.length || !room?.default_account_id) continue;
          const { data: acc } = await supabaseAdmin
            .from("telegram_accounts").select("bot_token").eq("id", room.default_account_id).maybeSingle();
          if (!acc?.bot_token) continue;

          for (const c of chats) {
            try {
              if (p.kind === "poll" && Array.isArray(p.options) && p.options.length >= 2) {
                await callTelegram(acc.bot_token, "sendPoll", {
                  chat_id: c.chat_id,
                  question: p.content,
                  options: p.options,
                  is_anonymous: true,
                });
              } else {
                await callTelegram(acc.bot_token, "sendMessage", {
                  chat_id: c.chat_id,
                  text: p.content,
                  parse_mode: "HTML",
                });
              }
              sent += 1;
            } catch (e) {
              console.error("expert-engagement send failed", e);
            }
          }

          await supabaseAdmin
            .from("expert_engagement_prompts" as any)
            .update({ last_sent_at: new Date().toISOString() } as any)
            .eq("id", p.id);
        }

        return Response.json({ ok: true, sent });
      },
    },
  },
});