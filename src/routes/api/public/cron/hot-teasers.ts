import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callTelegram } from "@/lib/telegram.server";

// CRON: HOT-TEASERS
// Roda a cada 15min. Para cada hot_vip_funnel.enabled, se o intervalo
// (teaser_interval_hours) desde last_teaser_at já passou, envia o próximo
// teaser ativo (rotativo) para o(s) chat(s) da sala, com botão CTA do VIP.

export const Route = createFileRoute("/api/public/cron/hot-teasers")({
  server: {
    handlers: {
      POST: async () => {
        const now = Date.now();
        const { data: funnels } = await supabaseAdmin
          .from("hot_vip_funnel" as any)
          .select("*")
          .eq("enabled", true);

        let sent = 0;
        for (const f of (funnels as any[]) ?? []) {
          const intervalMs = (f.teaser_interval_hours ?? 3) * 3600 * 1000;
          const last = f.last_teaser_at ? new Date(f.last_teaser_at).getTime() : 0;
          if (last + intervalMs > now) continue;

          const [{ data: teasers }, { data: chats }, { data: room }] = await Promise.all([
            supabaseAdmin.from("hot_teasers" as any).select("*").eq("room_id", f.room_id).eq("is_active", true).order("sort_order"),
            supabaseAdmin.from("room_chats").select("chat_id").eq("room_id", f.room_id),
            supabaseAdmin.from("rooms").select("default_account_id").eq("id", f.room_id).maybeSingle(),
          ]);
          const list = (teasers as any[]) ?? [];
          if (!list.length || !chats?.length || !room?.default_account_id) continue;
          const { data: acc } = await supabaseAdmin
            .from("telegram_accounts").select("bot_token").eq("id", room.default_account_id).maybeSingle();
          if (!acc?.bot_token) continue;

          // rotaciona por sort_order, escolhe o próximo após last_teaser_at
          const idx = (Math.floor(now / intervalMs)) % list.length;
          const teaser = list[idx];

          const inlineKb = f.vip_checkout_url
            ? { inline_keyboard: [[{ text: f.cta_button_text ?? "VIP 🔥", url: f.vip_checkout_url }]] }
            : undefined;

          for (const c of chats) {
            try {
              if (teaser.image_path) {
                await callTelegram(acc.bot_token, "sendPhoto", {
                  chat_id: c.chat_id,
                  photo: teaser.image_path,
                  caption: teaser.caption ?? "",
                  parse_mode: "HTML",
                  reply_markup: inlineKb,
                });
              } else {
                await callTelegram(acc.bot_token, "sendMessage", {
                  chat_id: c.chat_id,
                  text: teaser.caption ?? "",
                  parse_mode: "HTML",
                  reply_markup: inlineKb,
                });
              }
              sent += 1;
            } catch (e) {
              console.error("hot-teaser send failed", e);
            }
          }

          await supabaseAdmin
            .from("hot_vip_funnel" as any)
            .update({ last_teaser_at: new Date().toISOString() } as any)
            .eq("id", f.id);
        }

        return Response.json({ ok: true, sent });
      },
    },
  },
});