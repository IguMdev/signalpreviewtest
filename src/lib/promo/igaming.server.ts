import type { StoreClient } from "./types";

/**
 * iGaming / sportsbook clients (Bet365 / Betano / Blaze / KTO / Sportingbet).
 *
 * V1: stub. O operador cadastra o link bruto da casa em uma "oferta manual"
 * (campo `landing_url` em credentials) e o builder anexa o `btag` /
 * tracker do afiliado + o sub_id para rastreio.
 *
 * Conversões são recebidas via postback S2S em
 * /api/public/postback/$store (a ser implementado por casa).
 */
function makeStub(trackerKey: string): StoreClient {
  return {
    async fetchOffers() {
      return [];
    },
    buildAffiliateLink(creds, productUrl, subId) {
      try {
        const url = new URL(productUrl);
        const tracker = creds.btag || creds.affiliate_id || creds.tracker_id || creds.partner_id;
        if (tracker) url.searchParams.set(trackerKey, tracker);
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

export const bet365Client = makeStub("affid");
export const betanoClient = makeStub("btag");
export const blazeClient = makeStub("ref");
export const ktoClient = makeStub("btag");
export const sportingbetClient = makeStub("btag");