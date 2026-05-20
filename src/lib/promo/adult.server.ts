import type { StoreClient } from "./types";

/**
 * Adult-network clients (Privacy / CrakRevenue / AWEmpire).
 *
 * V1: stub que apenas constrói o link de afiliado anexando o SubID para
 * tracking. O catálogo de ofertas (`fetchOffers`) e o feed de conversões
 * (`fetchConversions`) retornam vazio — o operador cadastra a URL crua de
 * cada criadora/oferta na conta de afiliado (campo `landing_url` em
 * credentials) e o bot envia mantendo a sub_id para rastreio via /go/.
 *
 * Para ativar integração real:
 *   - Privacy:   https://privacy.com.br/parceria  (API de afiliados restrita)
 *   - CrakRevenue: https://www.crakrevenue.com/api/
 *   - AWEmpire:  https://awempire.com/api/
 */
function makeStub(qsKey: string): StoreClient {
  return {
    async fetchOffers() {
      // intencionalmente vazio — requer integração futura
      return [];
    },
    buildAffiliateLink(creds, productUrl, subId) {
      try {
        const url = new URL(productUrl);
        const aff = creds.aff_id || creds.affiliate_id || creds.partner_id;
        if (aff) url.searchParams.set(qsKey, aff);
        if (subId) url.searchParams.set("sub_id", subId);
        return url.toString();
      } catch {
        return productUrl;
      }
    },
    async fetchConversions() {
      return [];
    },
  };
}

export const privacyClient = makeStub("aff");
export const crakrevenueClient = makeStub("aff");
export const awempireClient = makeStub("aff");