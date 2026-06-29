import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";
import {
  sendTextWithPremiumEmojisRetry,
  sendPhotoWithPremiumEmojiCaptionRetry,
} from "@/lib/premium-send.server";
import { hasEmojiTokens } from "@/lib/premium-emoji-render";

const PREMIUM_LOCK_ERROR =
  "Envio bloqueado: a mensagem contém tokens {EMOJI} que não foram processados. Conecte uma conta Telegram Premium ativa e cadastre os emojis em Premium Emojis para liberar o envio.";

// ╔══════════════════════════════════════════════════════════╗
// ║  CRON: DISPATCH-SESSIONS (executado a cada minuto)       ║
// ║  Envia o aviso "Iniciando sessão em X minutos" antes do  ║
// ║  início de cada janela ativa do dia.                     ║
// ╚══════════════════════════════════════════════════════════╝

function nowParts(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:0 };
  const weekday = wdMap[get("weekday")] ?? 0;
  return { weekday, hhmm: `${get("hour").padStart(2,"0")}:${get("minute").padStart(2,"0")}` };
}

function dateKey(tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

function addMinutes(hhmm: string, delta: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + delta;
  total = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const Route = createFileRoute("/api/public/cron/dispatch-sessions")({
  server: {
    handlers: {
      POST: async () => {
        const { data: windows } = await supabaseAdmin
          .from("room_windows")
          .select("id, user_id, room_id, start_time, end_time, weekdays, is_active, last_session_fire, name")
          .eq("is_active", true);
        if (!windows?.length) return Response.json({ ok: true, fired: 0 });

        let fired = 0;
        for (const w of windows) {
          const { data: room } = await supabaseAdmin
            .from("rooms")
            .select("timezone, default_account_id, is_active")
            .eq("id", w.room_id)
            .maybeSingle();
          if (!room || !room.is_active) continue;
          const tz = room.timezone ?? "America/Sao_Paulo";
          const { weekday, hhmm } = nowParts(tz);
          if (!(w.weekdays as number[]).includes(weekday)) continue;

          const { data: msgs } = await supabaseAdmin
            .from("room_session_messages")
            .select("kind, enabled, lead_minutes, content, image_path")
            .eq("room_id", w.room_id);
          if (!msgs?.length) continue;

          const today = dateKey(tz);
          const fireState = (w.last_session_fire ?? {}) as Record<string, string>;
          const start = String(w.start_time).slice(0, 5);
          const end = String(w.end_time).slice(0, 5);

          for (const m of msgs) {
            if (!m.enabled) continue;
            const lead = Number(m.lead_minutes ?? 0) || 0;
            const targetHHMM = m.kind === "open" ? addMinutes(start, -lead) : addMinutes(end, lead);
            // dispara quando o relógio bate (com tolerância de 1 minuto pra trás)
            const tgtMin = (() => { const [h,mm] = targetHHMM.split(":").map(Number); return h*60+mm; })();
            const nowMin = (() => { const [h,mm] = hhmm.split(":").map(Number); return h*60+mm; })();
            if (nowMin < tgtMin || nowMin > tgtMin + 1) continue;

            const fireKey = `${w.id}:${m.kind}:${today}`;
            if (fireState[fireKey]) continue; // idempotente

            // marca ANTES de enviar para evitar duplicata em retry
            const nextState = { ...fireState, [fireKey]: new Date().toISOString() };
            await supabaseAdmin.from("room_windows").update({ last_session_fire: nextState }).eq("id", w.id);

            // resolve bot token + chats
            if (!room.default_account_id) continue;
            const { data: acc } = await supabaseAdmin
              .from("telegram_accounts").select("bot_token").eq("id", room.default_account_id).maybeSingle();
            if (!acc?.bot_token) continue;
            const { data: chats } = await supabaseAdmin
              .from("room_chats").select("chat_id").eq("room_id", w.room_id);
            if (!chats?.length) continue;

            // render conteúdo (MINUTOS placeholder + emojis em texto puro via Bot API)
            const baseContent = (m.content ?? "").replaceAll("{MINUTOS}", String(lead));
            const wantsPremium = hasEmojiTokens(baseContent);

            const imageUrl = m.image_path
              ? supabaseAdmin.storage.from("room-images").getPublicUrl(m.image_path).data.publicUrl
              : null;

            for (const c of chats) {
              let r: { ok: boolean; result?: { message_id?: number }; description?: string } = { ok: false };
              let premiumStatus: "premium" | "plain" | "blocked" = "plain";

              if (wantsPremium && imageUrl) {
                const pv = await sendPhotoWithPremiumEmojiCaptionRetry({
                  userId: w.user_id,
                  chatId: c.chat_id,
                  photoUrl: imageUrl,
                  caption: baseContent,
                  strict: true,
                });
                if (pv.applied) {
                  premiumStatus = pv.ok ? "premium" : "blocked";
                  r = pv.ok
                    ? { ok: true, result: { message_id: pv.messageId ?? undefined } }
                    : { ok: false, description: pv.error };
                }
              } else if (wantsPremium && !imageUrl && baseContent) {
                const pt = await sendTextWithPremiumEmojisRetry({
                  userId: w.user_id,
                  chatId: c.chat_id,
                  text: baseContent,
                  strict: true,
                });
                if (pt.applied) {
                  premiumStatus = pt.ok ? "premium" : "blocked";
                  r = pt.ok
                    ? { ok: true, result: { message_id: pt.messageId ?? undefined } }
                    : { ok: false, description: pt.error };
                }
              }

              if (premiumStatus === "plain") {
                // No premium tokens, OR premium not applied (no account) → Bot API
                if (wantsPremium) {
                  r = { ok: false, description: PREMIUM_LOCK_ERROR };
                  premiumStatus = "blocked";
                } else if (imageUrl) {
                  r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendPhoto", {
                    chat_id: c.chat_id,
                    photo: imageUrl,
                    caption: baseContent || undefined,
                  });
                } else {
                  r = await callTelegram<{ message_id: number }>(acc.bot_token, "sendMessage", {
                    chat_id: c.chat_id,
                    text: baseContent,
                  });
                }
              }

              await supabaseAdmin.from("message_logs").insert({
                user_id: w.user_id,
                account_id: room.default_account_id,
                room_id: w.room_id,
                source: `session_${m.kind}`,
                chat_id: c.chat_id,
                ok: r.ok,
                telegram_message_id: r.result?.message_id ?? null,
                error: r.ok ? null : (r.description ?? "erro"),
                premium_status: premiumStatus,
              } as never);
              if (r.ok) fired++;
            }
          }
        }
        return Response.json({ ok: true, fired });
      },
    },
  },
});