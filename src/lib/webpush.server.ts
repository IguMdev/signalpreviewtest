import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const subscribeToWebPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      subscription: z.any(),
    }).parse(d)
  )
  .handler(async (ctx) => {
    const { supabase, userId } = ctx.context;
    
    // Salva a subscription no user_metadata do auth.users (sem precisar de nova coluna no banco)
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { push_subscription: ctx.data.subscription }
    });

    if (error) {
      console.error("Erro ao salvar push_subscription:", error);
      throw new Error("Erro ao salvar inscrição");
    }

    return { success: true };
  });

export const PushSettingsSchema = z.object({
  sales_pending: z.boolean().default(false),
  sales_approved: z.boolean().default(true),
  sale_value: z.enum(["total", "hide"]).default("total"),
  show_product: z.boolean().default(false),
  show_utm: z.boolean().default(false),
  show_dashboard: z.boolean().default(true),
  report_times: z.array(z.string()).default([]),
  report_style: z.enum(["profit", "summary", "creative"]).default("profit"),
});

export type PushSettings = z.infer<typeof PushSettingsSchema>;

export const getPushSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (ctx) => {
    const { userId } = ctx.context;
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data.user) throw new Error("Usuário não encontrado");

    const rawSettings = data.user.user_metadata?.push_settings || {};
    return PushSettingsSchema.parse(rawSettings);
  });

export const updatePushSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PushSettingsSchema.parse(d))
  .handler(async (ctx) => {
    const { userId } = ctx.context;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { push_settings: ctx.data }
    });
    if (error) {
      console.error("Erro ao salvar push_settings:", error);
      throw new Error("Erro ao salvar configurações");
    }
    return { success: true };
  });

export async function sendWebPushNotification(userId: string, payload: { title: string; body: string; icon?: string }) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !data.user || !data.user.user_metadata?.push_subscription) {
    return; // O usuário não tem notificação ativada ou não foi encontrado
  }

  const push_subscription = data.user.user_metadata.push_subscription;

  try {
    const webpush = (await import("web-push")).default;
    const publicVapidKey = process.env.VAPID_PUBLIC_KEY || "";
    const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "";

    if (publicVapidKey && privateVapidKey) {
      webpush.setVapidDetails(
        "mailto:contato@telesignal.com.br",
        publicVapidKey,
        privateVapidKey
      );
    }
    await webpush.sendNotification(
      push_subscription as any,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.error("Erro ao enviar Web Push:", error);
  }
}
