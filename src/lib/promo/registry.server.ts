import type { AffiliateStore, StoreClient } from "./types";
import { amazonClient } from "./amazon.server";
import { shopeeClient } from "./shopee.server";
import { aliexpressClient } from "./aliexpress.server";
import { mercadolivreClient } from "./mercadolivre.server";
import { privacyClient, crakrevenueClient, awempireClient } from "./adult.server";
import {
  bet365Client,
  betanoClient,
  blazeClient,
  ktoClient,
  sportingbetClient,
} from "./igaming.server";

export const STORE_CLIENTS: Record<AffiliateStore, StoreClient> = {
  amazon: amazonClient,
  shopee: shopeeClient,
  aliexpress: aliexpressClient,
  mercadolivre: mercadolivreClient,
  privacy: privacyClient,
  crakrevenue: crakrevenueClient,
  awempire: awempireClient,
  bet365: bet365Client,
  betano: betanoClient,
  blaze: blazeClient,
  kto: ktoClient,
  sportingbet: sportingbetClient,
};