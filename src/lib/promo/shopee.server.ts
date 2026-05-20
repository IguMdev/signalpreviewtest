import { createHash } from "crypto";
import type { StoreClient, NormalizedOffer, ConversionRecord } from "./types";

// Shopee Affiliate Open API (GraphQL).
// Required credentials: app_id, secret

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

function sign(appId: string, secret: string, payload: string, ts: number) {
  const base = `${appId}${ts}${payload}${secret}`;
  return createHash("sha256").update(base).digest("hex");
}

export const shopeeClient: StoreClient = {
  async fetchOffers(creds, filters) {
    if (!creds.app_id || !creds.secret) return [];
    const keyword = filters.keywords?.[0] ?? "";
    const query = `{
      productOfferV2(keyword: "${keyword.replace(/"/g, '\\"')}", listType: 0, sortType: 2, page: 1, limit: 20) {
        nodes { itemId productName priceMin priceMax priceDiscountRate imageUrl productLink offerLink commissionRate }
      }
    }`;
    const body = JSON.stringify({ query });
    const ts = Math.floor(Date.now() / 1000);
    const signature = sign(creds.app_id, creds.secret, body, ts);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${creds.app_id}, Timestamp=${ts}, Signature=${signature}`,
      },
      body,
    });
    if (!res.ok) throw new Error(`Shopee ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data: any = await res.json();
    const nodes = data?.data?.productOfferV2?.nodes ?? [];
    return nodes.map((n: any): NormalizedOffer => {
      const price = Number(n.priceMin);
      const discount = Math.round(Number(n.priceDiscountRate ?? 0));
      const oldPrice = discount > 0 ? +(price / (1 - discount / 100)).toFixed(2) : null;
      return {
        store: "shopee",
        externalId: String(n.itemId),
        title: n.productName,
        price,
        oldPrice,
        discountPct: discount || null,
        imageUrl: n.imageUrl,
        productUrl: n.offerLink || n.productLink,
        raw: n,
      };
    });
  },

  buildAffiliateLink(_creds, productUrl, subId) {
    // Shopee offerLink already includes the affiliate id. Append SubID:
    const url = new URL(productUrl);
    url.searchParams.set("sub_id1", subId);
    return url.toString();
  },

  async fetchConversions(_creds, _since): Promise<ConversionRecord[]> {
    // TODO: GraphQL conversionReport endpoint — requires user's affiliate report scope.
    return [];
  },
};