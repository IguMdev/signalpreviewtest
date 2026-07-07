import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BulkReplaceInput = z.object({
  oldLink: z.string().min(1),
  newLink: z.string().min(1),
});

export const bulkReplaceLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => BulkReplaceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { oldLink, newLink } = data;

    // Helper to replace all occurrences in a string
    const replaceStr = (str: string | null | undefined) => {
      if (!str) return str;
      return str.split(oldLink).join(newLink);
    };

    let recurringUpdated = 0;
    let scheduledUpdated = 0;

    // 1. Process recurring_schedules
    const { data: recurringSchedules, error: err1 } = await (supabase as any)
      .from("recurring_schedules" as any)
      .select("*")
      .eq("user_id" as any, userId);

    if (err1) throw new Error("Erro ao buscar agendamentos recorrentes: " + err1.message);

    for (const schedule of recurringSchedules || []) {
      let changed = false;
      const updates: any = {};

      const newContent = replaceStr(schedule.content);
      if (newContent !== schedule.content) {
        updates.content = newContent;
        changed = true;
      }

      const newButtonUrl = replaceStr(schedule.button_url);
      if (newButtonUrl !== schedule.button_url) {
        updates.button_url = newButtonUrl;
        changed = true;
      }

      if (schedule.follow_ups && Array.isArray(schedule.follow_ups)) {
        let followUpsChanged = false;
        const newFollowUps = schedule.follow_ups.map((f: any) => {
          const fNewContent = replaceStr(f.content);
          const fNewButtonUrl = replaceStr(f.button_url);
          if (fNewContent !== f.content || fNewButtonUrl !== f.button_url) {
            followUpsChanged = true;
            return {
              ...f,
              content: fNewContent,
              button_url: fNewButtonUrl,
            };
          }
          return f;
        });

        if (followUpsChanged) {
          updates.follow_ups = newFollowUps;
          changed = true;
        }
      }

      if (changed) {
        const { error: updErr } = await (supabase as any)
          .from("recurring_schedules" as any)
          .update(updates)
          .eq("id" as any, schedule.id);
        
        if (updErr) throw new Error("Erro ao atualizar agendamento recorrente: " + updErr.message);
        recurringUpdated++;
      }
    }

    // 2. Process scheduled_messages (pending only)
    const { data: scheduledMessages, error: err2 } = await (supabase as any)
      .from("scheduled_messages" as any)
      .select("*")
      .eq("user_id" as any, userId)
      .eq("status" as any, "pending");

    if (err2) throw new Error("Erro ao buscar agendamentos únicos: " + err2.message);

    for (const msg of scheduledMessages || []) {
      const newContent = replaceStr(msg.content);
      if (newContent !== msg.content) {
        const { error: updErr } = await (supabase as any)
          .from("scheduled_messages" as any)
          .update({ content: newContent })
          .eq("id" as any, msg.id);
        
        if (updErr) throw new Error("Erro ao atualizar agendamento único: " + updErr.message);
        scheduledUpdated++;
      }
    }

    return { recurringUpdated, scheduledUpdated, ok: true };
  });
