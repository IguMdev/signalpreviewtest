import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fireTrackingEvent, corsHeaders } from "@/lib/tracking.server";

export const Route = createFileRoute("/api/public/track/g/$clickId/$offerSlug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: async ({ params }) => {
        const { clickId, offerSlug } = params;

        const { data: click } = await supabaseAdmin
          .from("tracking_clicks" as never)
          .select("click_id, pixel_id, user_id, clicked_offer_at")
          .eq("click_id", clickId)
          .maybeSingle();
        if (!click) return new Response("click not found", { status: 404 });
        const c = click as any;

        const { data: offer } = await supabaseAdmin
          .from("tracking_offers" as never)
          .select("destination_url, subid_param")
          .eq("pixel_id", c.pixel_id)
          .eq("slug", offerSlug)
          .maybeSingle();
        if (!offer) return new Response("offer not found", { status: 404 });
        const o = offer as any;

        // mark clicked_offer_at (only first time)
        if (!c.clicked_offer_at) {
          await supabaseAdmin
            .from("tracking_clicks" as never)
            .update({ clicked_offer_at: new Date().toISOString() } as never)
            .eq("click_id", clickId);

          // fire CAPI (idempotent)
          await fireTrackingEvent({ clickId, stage: "offer_click" }).catch((e) =>
            console.error("[track/g] capi failed:", e),
          );
        }

        // build destination URL with subid injected
        const dest = new URL(o.destination_url);
        dest.searchParams.set(o.subid_param || "sub1", clickId);

        return Response.redirect(dest.toString(), 302);
      },
    },
  },
});
