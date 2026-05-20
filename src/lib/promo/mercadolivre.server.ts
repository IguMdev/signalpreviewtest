import type { StoreClient, NormalizedOffer, ConversionRecord } from "./types";

// Mercado Livre — busca pública + deep link de afiliado
// Required credentials: affiliate_id, site_id (default MLB)

export const mercadolivreClient: StoreClient = {
  async fetchOffers(creds, filters) {
    const siteId = creds.site_id || "MLB";
    const q = encodeURIComponent(filters.keywords?.[0] ?? "promocao");
    const url = `https://api.mercadolibre.com/sites/${siteId}/search?q=${q}&limit=20&sort=price_asc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mercado Livre ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data: any = await res.json();
    const items = data?.results ?? [];
    return items
      .filter((it: any) => {
        const disc = it.original_price ? Math.round(((it.original_price - it.price) / it.original_price) * 100) : 0;
        return disc >= (filters.minDiscountPct ?? 0);
      })
      .map((it: any): NormalizedOffer => {
        const discount = it.original_price ? Math.round(((it.original_price - it.price) / it.original_price) * 100) : null;
        return {
          store: "mercadolivre",
          externalId: it.id,
          title: it.title,
          price: it.price,
          oldPrice: it.original_price ?? null,
          discountPct: discount,
          imageUrl: it.thumbnail?.replace("-I.jpg", "-O.jpg") ?? it.thumbnail,
          productUrl: it.permalink,
          category: it.category_id ?? null,
          raw: it,
        };
      });
  },

  buildAffiliateLink(creds, productUrl, subId) {
    const aff = creds.affiliate_id;
    if (!aff) return productUrl;
    // formato social/{affiliate_id}?matt_word={subId}&matt_tool=... + redirect ao produto
    const u = new URL(productUrl);
    u.searchParams.set("matt_word", subId);
    u.searchParams.set("matt_tool", aff);
    return u.toString();
  },

  async fetchConversions(_creds, _since): Promise<ConversionRecord[]> {
    // TODO: integrar relatório de afiliados ML
    return [];
  },
};