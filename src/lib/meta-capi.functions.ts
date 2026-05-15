import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendMetaEvent } from "./meta-capi.server";

export const getMetaIntegration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("meta_integrations")
      .select("id, pixel_id, access_token, test_event_code, is_active, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const upsertMetaIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      pixelId: z.string().min(5).max(64).regex(/^\d+$/, "Pixel ID deve ser numérico"),
      accessToken: z.string().min(20).max(500),
      testEventCode: z.string().max(64).optional().nullable(),
      isActive: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("meta_integrations")
      .upsert(
        {
          user_id: userId,
          pixel_id: data.pixelId,
          access_token: data.accessToken,
          test_event_code: data.testEventCode || null,
          is_active: data.isActive,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMetaIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("meta_integrations").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendMetaTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const result = await sendMetaEvent({
      userId,
      eventName: "Lead",
      eventId: `test-${Date.now()}`,
      actionSource: "system_generated",
      userData: { externalId: userId },
      customData: { content_name: "Teste de conexão Lovable", value: 0, currency: "BRL" },
    });
    if (!result.ok) throw new Error(result.error || "Falha ao enviar evento");
    return { ok: true };
  });

export const listMetaEventLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("meta_event_logs")
      .select("id, event_name, event_id, ok, error, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
