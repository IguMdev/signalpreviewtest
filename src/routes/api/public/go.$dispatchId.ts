import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function hashIp(ip: string) {
  const enc = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/go/$dispatchId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { dispatchId } = params as { dispatchId: string };
        const { data: disp } = await supabaseAdmin
          .from("promo_dispatches")
          .select("affiliate_link, user_id")
          .eq("id", dispatchId)
          .maybeSingle();
        if (!disp) return new Response("Not found", { status: 404 });

        try {
          const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
          const ipHash = ip ? await hashIp(ip.split(",")[0].trim()) : null;
          await supabaseAdmin.from("promo_clicks").insert({
            dispatch_id: dispatchId,
            user_id: disp.user_id,
            ip_hash: ipHash,
            user_agent: request.headers.get("user-agent") ?? null,
            referrer: request.headers.get("referer") ?? null,
            country: request.headers.get("cf-ipcountry") ?? null,
          });
        } catch {
          // fail silent — não bloqueia redirect
        }

        return new Response(null, {
          status: 302,
          headers: { Location: disp.affiliate_link, "Cache-Control": "no-store" },
        });
      },
    },
  },
});