import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-master-password",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = {
      warning: "DELETE THIS FUNCTION IMMEDIATELY AFTER USE.",
      SOURCE_SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? null,
      SOURCE_SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null,
      SOURCE_SUPABASE_DB_URL: Deno.env.get("SUPABASE_DB_URL") ?? null,
      SOURCE_SUPABASE_ANON_KEY:
        Deno.env.get("SUPABASE_ANON_KEY") ??
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
        null,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});