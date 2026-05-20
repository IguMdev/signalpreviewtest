import { createHash } from "crypto";
import type { StoreClient, NormalizedOffer, ConversionRecord } from "./types";

// AliExpress Open Platform — aliexpress.affiliate.product.query
// Required credentials: app_key, app_secret, tracking_id

const ENDPOINT = "https://api-sg.aliexpress.com/sync";

function sign(params: Record<string, string>, secret: string) {
  const keys = Object.keys(params).sort();
  const concat = secret + keys.map((k) => `${k}${params[k]}`).join("") + secret;
  return createHash("md5").update(concat).digest("hex").toUpperCase();
}

export const aliexpressClient: StoreClient = {
  async fetchOffers(creds, filters) {
    if (!creds.app_key || !creds.app_secret || !creds.tracking_id) return [];
    const params: Record<string, string> = {
      method: "aliexpress.affiliate.product.query",
      app_key: creds.app_key,
      timestamp: new Date().toISOString().replace(/[-T:]/g, "").slice(0, 14),
      format: "json",
      v: "2.0",
      sign_method: "md5",
      tracking_id: creds.tracking_id,
      keywords: filters.keywords?.[0] ?? "smartphone",
      page_size: "20",
      sort: "SALE_PRICE_ASC",
    };
    params.sign = sign(params, creds.app_secret);

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw new Error(`AliExpress ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data: any = await res.json();
    const products = data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
    return products.map((p: any): NormalizedOffer => {
      const price = Number(p.target_sale_price ?? p.sale_price ?? 0);
      const oldPrice = Number(p.target_original_price ?? p.original_price ?? 0) || null;
      const discount = p.discount ? parseInt(String(p.discount).replace(/\D/g, ""), 10) : null;
      return {
        store: "aliexpress",
        externalId: String(p.product_id),
        title: p.product_title,
        price,
        oldPrice,
        discountPct: discount,
        imageUrl: p.product_main_image_url,
        productUrl: p.promotion_link || p.product_detail_url,
        category: p.first_level_category_name ?? null,
        raw: p,
      };
    });
  },

  buildAffiliateLink(_creds, productUrl, subId) {
    // promotion_link já contém tracking_id; SubID via aff_short_key/aff_platform
    const url = new URL(productUrl);
    url.searchParams.set("sub_id", subId);
    return url.toString();
  },

  async fetchConversions(_creds, _since): Promise<ConversionRecord[]> {
    // TODO: aliexpress.affiliate.order.list
    return [];
  },
};