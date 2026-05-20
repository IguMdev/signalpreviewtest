## Objetivo
Adicionar **Bot de Promoções com Afiliados** integrando APIs oficiais de Amazon, Shopee, AliExpress e Mercado Livre, com sistema de nicho fixo por sala (OB = sinais ou Promoções).

---

## 1. Conceito de Nicho por Sala

Adicionar campo `niche` na tabela `rooms` com valores fixos:
- `ob` — Opções Binárias (sinais, comportamento atual)
- `promo` — Promoções com afiliados (novo)

**Regra:** definido no momento da criação da sala, **não pode ser alterado depois** (UI desabilita). Cada sala = 1 nicho.

**Fluxo de criação:**
1. Usuário clica em "Nova Sala" → primeiro passo: escolher nicho (card OB vs card Promoções)
2. Se OB → fluxo atual (broker, sinais, janelas, etc.)
3. Se Promo → abre direto as configurações do Bot de Promoções (espelhando UX do bot de sinais)

**Filtragem da UI por nicho:**
- Sala OB: abas Sinais, Janelas, Encaminhador, Follow-up, Boas-vindas, Recorrentes — **sem** aba Promoções
- Sala Promo: abas Promoções, Encaminhador, Follow-up, Boas-vindas, Recorrentes — **sem** Sinais/Janelas/Ativos
- Boas-vindas, Encaminhador, Follow-up e Recorrentes ficam em ambos (são genéricos)

---

## 2. Banco de Dados

Novas tabelas (todas com RLS `user_id = auth.uid()`):

**`affiliate_accounts`** — credenciais por usuário/loja
- `user_id`, `store` (enum: amazon, shopee, aliexpress, mercadolivre)
- `credentials` jsonb (associate_id, app_id/secret, tracking_id, etc.)
- `is_active`, `last_check_at`, `last_error`

**`promo_bot_settings`** — config por sala (nicho promo)
- `room_id`, `user_id`
- `enabled`, `interval_hours` (intervalo fixo)
- `stores` text[] — quais lojas usar nessa sala
- `min_discount_pct`, `min_price`, `max_price`
- `categories` text[], `keywords` text[], `blacklist_keywords` text[]
- `message_template` text (com placeholders: {title}, {price}, {old_price}, {discount}, {link})
- `image_mode` (product_image | none)
- `parse_mode`, `premium_account_id`, `premium_enabled`
- `last_fire_at`

**`promo_offers`** — cache de ofertas puxadas das APIs
- `user_id`, `store`, `external_id` (unique por loja)
- `title`, `description`, `price`, `old_price`, `discount_pct`
- `image_url`, `product_url`, `category`
- `raw` jsonb, `fetched_at`, `expires_at`

**`promo_dispatches`** — log de envios (idempotência + tracking)
- `id` (usado como token no shortlink)
- `user_id`, `room_id`, `offer_id`, `chat_id`
- `affiliate_link` (link com tag/SubID = id do dispatch)
- `telegram_message_id`, `sent_at`, `error`

**`promo_clicks`** — tracking de cliques no shortlink
- `dispatch_id`, `clicked_at`, `ip_hash`, `user_agent`, `country`

**`promo_conversions`** — vendas confirmadas (puxadas via API de relatório)
- `dispatch_id` (nullable, casado via SubID), `store`, `order_id`
- `commission_value`, `sale_value`, `status`, `confirmed_at`, `raw` jsonb

---

## 3. Integrações Oficiais (server functions)

Cada loja em `src/lib/promo/{store}.server.ts`:

- **Amazon PA-API 5.0**: `SearchItems` + `GetItems` com `PartnerTag`. Assinatura AWS Sig v4. Atenção: requer 3 vendas em 180 dias.
- **Shopee Affiliate Open API**: GraphQL em `https://open-api.affiliate.shopee.com.br/graphql` com HMAC-SHA256 (AppID + secret + timestamp).
- **AliExpress (Portals/Aliexpress Open Platform)**: `aliexpress.affiliate.product.query` + `aliexpress.affiliate.order.list`. App Key + assinatura MD5/HMAC.
- **Mercado Livre**: API de busca pública + deep link de afiliado `https://www.mercadolivre.com.br/social/{user}?...&matt_word={SubID}`. Relatório de comissão via API de afiliados.

Padrão comum: `fetchOffers(filters) → Offer[]`, `fetchConversions(since) → Conversion[]`.

---

## 4. Server Functions

`src/lib/promo.functions.ts`:
- `listAffiliateAccounts`, `upsertAffiliateAccount`, `testAffiliateAccount`
- `getPromoBotSettings(roomId)`, `updatePromoBotSettings`
- `previewPromoOffers(roomId)` — testa filtros e mostra próximas ofertas
- `listPromoDispatches(roomId, range)` — histórico
- `getPromoStats(roomId)` — cliques, conversões, comissão total

---

## 5. Cron e Disparo

**Novo cron route:** `src/routes/api/public/cron/dispatch-promos.ts` (a cada 5 min)
- Para cada `promo_bot_settings` com `enabled = true` cuja janela `last_fire_at + interval_hours` venceu:
  1. Para cada loja em `stores`: chama `fetchOffers` com filtros
  2. Upsert em `promo_offers`, descarta já enviadas (via `promo_dispatches`)
  3. Escolhe a melhor (maior desconto não enviado)
  4. Cria registro `promo_dispatches` com `id = uuid`
  5. Gera affiliate link com SubID = dispatch_id (ou shortlink `/go/{dispatch_id}`)
  6. Renderiza template, envia via bot/userbot
  7. Atualiza `last_fire_at`

**Cron de conversões:** `src/routes/api/public/cron/sync-promo-conversions.ts` (1x/hora)
- Para cada `affiliate_accounts` ativa: `fetchConversions(since=last_sync)` e cruza SubID → `dispatch_id` → preenche `promo_conversions`.

---

## 6. Tracking de Cliques

**Rota pública:** `src/routes/api/public/go/$dispatchId.ts`
- Insere em `promo_clicks` (ip_hash, ua, geo via header)
- Faz 302 para `affiliate_link` da dispatch
- Esse é o link que vai na mensagem do Telegram (ex.: `https://signalpreviewtest.lovable.app/go/{id}`)

---

## 7. UI

**Nova página:** `src/routes/_authenticated/promocoes.contas.tsx`
- CRUD de contas de afiliado (Amazon/Shopee/AliExpress/ML), instruções de onde pegar cada credencial, botão "Testar conexão".

**Configuração do bot na sala (Promo):**
- `src/routes/_authenticated/rooms.$roomId.promo.tsx` (espelha UX de `rooms.$roomId.edit.tsx` aba sinais)
- Toggle enabled, intervalo (slider 1-24h), lojas (multi-select das contas ativas), filtros, template editor com preview, botão "Ver próximas ofertas".

**Página de stats:** `src/routes/_authenticated/promocoes.stats.tsx`
- Por sala/loja/período: ofertas enviadas, cliques, CTR, conversões, comissão total. Tabela de dispatches com drill-down.

**Ajustes em `rooms.index.tsx`:**
- Modal de criação ganha primeiro passo de seleção de nicho (2 cards visuais)
- Lista de salas mostra badge do nicho (OB / Promo)

**Ajustes em `rooms.$roomId.edit.tsx`:**
- Renderiza abas condicionalmente por `room.niche`
- Campo nicho exibido como read-only

---

## 8. Sidebar

Novo grupo "Promoções" (visível só se o user tiver ao menos 1 sala promo):
- Contas de Afiliado
- Estatísticas

---

## 9. Secrets

Nenhum secret global — cada usuário cadastra as próprias credenciais em `affiliate_accounts.credentials` (criptografado em coluna jsonb, acesso só via RLS + server function).

---

## 10. Detalhes Técnicos

- Migration cria enum `room_niche` e default `'ob'` para salas existentes (retrocompatível).
- Trigger impede `UPDATE` de `rooms.niche` após criação.
- Dedupe de ofertas por `(store, external_id)` + janela de 30 dias antes de reenviar a mesma.
- Rate-limit por loja respeitando limites das APIs (Amazon: 1 req/s inicial; Shopee: 100/min).
- Shortlink `/go/{id}` indexado por `dispatch_id` para latência baixa no clique.
- Template default: `🔥 *{title}*\n\n~R$ {old_price}~ → *R$ {price}*\n💰 {discount}% OFF\n\n👉 {link}`.

---

## Ordem de Implementação

1. Migration (nicho + tabelas promo)
2. UI nicho na criação/edição da sala + filtragem de abas
3. Página de contas de afiliado + integração Amazon (mais comum) como primeira loja
4. Server functions de settings + UI de config do bot na sala
5. Cron de disparo + shortlink de tracking
6. Integrações Shopee, AliExpress, ML
7. Cron de conversões + página de stats
