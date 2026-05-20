import { createHash, createHmac } from "crypto";
import type { StoreClient, NormalizedOffer, OfferFilters, ConversionRecord, StoreCredentials } from "./types";

// Amazon Product Advertising API 5.0 client
// Required credentials: access_key, secret_key, partner_tag, host (default webservices.amazon.com.br), region (default us-east-1 / eu-west-1 / sa-east-1)

function sigv4Sign(payload: string, creds: StoreCredentials, target: string, host: string, region: string) {
  const service = "ProductAdvertisingAPI";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = "/paapi5/searchitems";
  const canonicalQuerystring = "";
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`;
  const signedHeaders = "content-encoding;host;x-amz-date;x-amz-target";
  const payloadHash = createHash("sha256").update(payload).digest("hex");

  const canonicalRequest = [
    "POST",
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const kDate = createHmac("sha256", `AWS4${creds.secret_key}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization = `${algorithm} Credential=${creds.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      "content-encoding": "amz-1.0",
      "content-type": "application/json; charset=utf-8",
      host,
      "x-amz-date": amzDate,
      "x-amz-target": target,
      authorization,
    },
  };
}

export const amazonClient: StoreClient = {
  async fetchOffers(creds, filters) {
    const host = creds.host || "webservices.amazon.com.br";
    const region = creds.region || "us-east-1";
    const marketplace = creds.marketplace || "www.amazon.com.br";
    const partnerTag = creds.partner_tag;
    if (!creds.access_key || !creds.secret_key || !partnerTag) return [];

    const keyword = (filters.keywords && filters.keywords.length ? filters.keywords[0] : "ofertas");
    const payload = JSON.stringify({
      Keywords: keyword,
      Resources: [
        "Images.Primary.Large",
        "ItemInfo.Title",
        "Offers.Listings.Price",
        "Offers.Listings.SavingBasis",
      ],
      PartnerTag: partnerTag,
      PartnerType: "Associates",
      Marketplace: marketplace,
      ItemCount: 10,
      MinSavingPercent: filters.minDiscountPct || 1,
    });
    const target = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
    const { headers } = sigv4Sign(payload, creds, target, host, region);

    const res = await fetch(`https://${host}/paapi5/searchitems`, {
      method: "POST",
      headers,
      body: payload,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Amazon PA-API ${res.status}: ${text.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const items = data?.SearchResult?.Items ?? [];
    return items.map((it: any): NormalizedOffer => {
      const listing = it?.Offers?.Listings?.[0];
      const price = listing?.Price?.Amount;
      const oldPrice = listing?.SavingBasis?.Amount;
      const discount = price && oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : null;
      return {
        store: "amazon",
        externalId: it.ASIN,
        title: it?.ItemInfo?.Title?.DisplayValue ?? "Oferta Amazon",
        price: price ?? null,
        oldPrice: oldPrice ?? null,
        discountPct: discount,
        imageUrl: it?.Images?.Primary?.Large?.URL ?? null,
        productUrl: it?.DetailPageURL ?? `https://www.amazon.com.br/dp/${it.ASIN}?tag=${partnerTag}`,
        category: null,
        raw: it,
      };
    });
  },

  buildAffiliateLink(creds, productUrl, subId) {
    const tag = creds.partner_tag;
    if (!tag) return productUrl;
    const url = new URL(productUrl);
    url.searchParams.set("tag", tag);
    url.searchParams.set("ascsubtag", subId);
    return url.toString();
  },

  async fetchConversions(_creds, _since): Promise<ConversionRecord[]> {
    // Amazon Associates reports are not available via PA-API. Users must export
    // CSV from Associates Central and upload — to be implemented as a separate flow.
    return [];
  },
};

export type _filtersUnused = OfferFilters;