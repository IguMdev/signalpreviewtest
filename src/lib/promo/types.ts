export type AffiliateStore = "amazon" | "shopee" | "aliexpress" | "mercadolivre";

export type StoreLabel = Record<AffiliateStore, string>;

export const STORE_LABELS: StoreLabel = {
  amazon: "Amazon",
  shopee: "Shopee",
  aliexpress: "AliExpress",
  mercadolivre: "Mercado Livre",
};

export type OfferFilters = {
  keywords?: string[];
  categories?: string[];
  minDiscountPct?: number;
  minPrice?: number;
  maxPrice?: number;
  blacklistKeywords?: string[];
};

export type NormalizedOffer = {
  store: AffiliateStore;
  externalId: string;
  title: string;
  description?: string | null;
  price?: number | null;
  oldPrice?: number | null;
  discountPct?: number | null;
  imageUrl?: string | null;
  productUrl: string;
  category?: string | null;
  raw: unknown;
};

export type ConversionRecord = {
  store: AffiliateStore;
  orderId: string;
  subId?: string | null;
  saleValue: number;
  commissionValue: number;
  currency: string;
  status: "pending" | "approved" | "cancelled";
  confirmedAt?: string | null;
  raw: unknown;
};

export type StoreCredentials = Record<string, string>;

export interface StoreClient {
  fetchOffers(creds: StoreCredentials, filters: OfferFilters): Promise<NormalizedOffer[]>;
  buildAffiliateLink(creds: StoreCredentials, productUrl: string, subId: string): string;
  fetchConversions(creds: StoreCredentials, since: Date): Promise<ConversionRecord[]>;
}