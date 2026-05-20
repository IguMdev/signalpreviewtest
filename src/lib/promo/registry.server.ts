import type { AffiliateStore, StoreClient } from "./types";
import { amazonClient } from "./amazon.server";
import { shopeeClient } from "./shopee.server";
import { aliexpressClient } from "./aliexpress.server";
import { mercadolivreClient } from "./mercadolivre.server";

export const STORE_CLIENTS: Record<AffiliateStore, StoreClient> = {
  amazon: amazonClient,
  shopee: shopeeClient,
  aliexpress: aliexpressClient,
  mercadolivre: mercadolivreClient,
};