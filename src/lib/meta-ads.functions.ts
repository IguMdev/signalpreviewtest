import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const getAppCredentials = () => {
  const appId = process.env.VITE_META_APP_ID || process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Credenciais do aplicativo Meta (App ID / App Secret) não estão configuradas no servidor.");
  }
  return { appId, appSecret };
};

export const getMetaAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ redirectUri: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const { appId } = getAppCredentials();
    const fbAuthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    fbAuthUrl.searchParams.set("client_id", appId);
    fbAuthUrl.searchParams.set("redirect_uri", data.redirectUri);
    fbAuthUrl.searchParams.set("scope", "ads_management,ads_read,business_management");
    fbAuthUrl.searchParams.set("response_type", "code");
    return { url: fbAuthUrl.toString() };
  });

export const exchangeMetaCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ 
    code: z.string(),
    redirectUri: z.string().url()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { appId, appSecret } = getAppCredentials();

    // 1. Trocar o código por um short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", data.redirectUri);
    tokenUrl.searchParams.set("code", data.code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(`Falha ao obter token: ${tokenData.error?.message || "Erro desconhecido"}`);
    }

    let accessToken = tokenData.access_token;

    // 2. Trocar por um long-lived token (dura 60 dias)
    const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", accessToken);

    const longLivedRes = await fetch(longLivedUrl.toString(), { method: "GET" });
    const longLivedData = await longLivedRes.json();
    if (longLivedRes.ok && longLivedData.access_token) {
      accessToken = longLivedData.access_token;
    }

    // 3. Pegar informações do usuário (ID e Nome)
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`);
    const meData = await meRes.json();

    if (!meRes.ok || !meData.id) {
      throw new Error("Falha ao obter perfil do usuário no Facebook");
    }

    // 4. Salvar no Supabase
    const { error: upsertErr } = await supabase
      .from("meta_connected_users" as never)
      .upsert({
        user_id: userId,
        fb_user_id: meData.id,
        fb_name: meData.name || "Usuário Facebook",
        access_token: accessToken
      } as never, { onConflict: "user_id, fb_user_id" });

    if (upsertErr) {
      throw new Error(`Erro ao salvar conexão: ${upsertErr.message}`);
    }

    return { ok: true, name: meData.name };
  });

export const getConnectedMetaAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("meta_connected_users" as never)
      .select("fb_user_id, fb_name, created_at")
      .eq("user_id", userId)
      .maybeSingle();
      
    if (error) throw new Error(error.message);
    return data as any;
  });

export const disconnectMetaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("meta_connected_users" as never)
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Função interna auxiliar para pegar o token do usuário logado
async function getUserMetaToken(supabase: any, userId: string) {
  const { data } = await supabase
    .from("meta_connected_users")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.access_token) {
    throw new Error("Você precisa conectar sua conta do Facebook primeiro.");
  }
  return data.access_token;
}

export const listAdAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = await getUserMetaToken(supabase, userId);

    const res = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=name,account_id,account_status,currency,business_name&limit=100&access_token=${token}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Erro Meta: ${data.error?.message || "Falha ao buscar contas"}`);
    }

    return (data.data || []).map((acc: any) => ({
      id: acc.account_id, // Ex: "123456789" (o act_ é prefixado nas chamadas)
      name: acc.name,
      business: acc.business_name || "Conta Pessoal",
      currency: acc.currency,
      status: acc.account_status,
    }));
  });

// Buscar insights consolidados de uma conta (Gasto, Impressões, CPM, etc)
// Para cruzar com o Telesignal, o ideal é trazer nível campanha, adset ou ad
export const fetchMetaInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    accountId: z.string(),
    level: z.enum(["campaign", "adset", "ad"]).default("campaign"),
    days: z.number().min(1).max(90).default(30),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = await getUserMetaToken(supabase, userId);
    
    // accountId geralmente vem sem o act_, mas a API requer act_
    const actId = data.accountId.startsWith("act_") ? data.accountId : `act_${data.accountId}`;
    
    const fields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,cpm,cpc,ctr";
    const datePreset = data.days === 30 ? "last_30d" : data.days === 7 ? "last_7d" : "maximum"; // simplificação, o ideal seria time_range

    const url = new URL(`https://graph.facebook.com/v19.0/${actId}/insights`);
    url.searchParams.set("level", data.level);
    url.searchParams.set("fields", fields);
    url.searchParams.set("date_preset", datePreset);
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", token);

    const res = await fetch(url.toString());
    const result = await res.json();

    if (!res.ok) {
      throw new Error(`Erro Meta: ${result.error?.message || "Falha ao buscar insights"}`);
    }

    return result.data || [];
  });

export const toggleMetaCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    objectId: z.string(),
    status: z.enum(["ACTIVE", "PAUSED"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = await getUserMetaToken(supabase, userId);

    const url = new URL(`https://graph.facebook.com/v19.0/${data.objectId}`);
    url.searchParams.set("status", data.status);
    url.searchParams.set("access_token", token);

    const res = await fetch(url.toString(), { method: "POST" });
    const result = await res.json();

    if (!res.ok) {
      throw new Error(`Erro Meta: ${result.error?.message || "Falha ao alterar status"}`);
    }

    return { ok: true, success: result.success };
  });
