## Visão geral

Sistema de **trackeamento avançado** estilo Track4You + atribuição por criativo + atribuição de conversão externa (cadastro/depósito na corretora). Cobre OB, iGaming, hot, promoções.

**Fluxo end-to-end:**
```text
Anúncio (FB/TikTok/Google)
   │ ?utm_*&fbclid&ttclid&gclid
   ▼
Landing do cliente  ──[snippet]──►  POST /api/public/track/click
   │                                       │
   │ (botão reescrito)                     ▼
   ▼                              tracking_clicks
t.me/<bot>?start=tk_<click_id>    (fbp/fbc/utms/ip/ua/click_id)
   │
   ▼
Bot Telegram  ──[/start tk_xxx]──►  webhook do bot
                                       │
                                       ├─ marca joined_at
                                       ├─ envia "Lead" no Meta CAPI
                                       └─ entrega link da oferta:
                                          seuapp.com/g/<click_id>/<offer>
                                                   │
                                                   ▼
                                       Redirector
                                       ├─ marca clicked_offer_at
                                       ├─ envia "InitiateCheckout" no CAPI
                                       └─ 302 → casa.com?ref=X&sub1=<click_id>
                                                   │
                                                   ▼
                                       Cadastro / Depósito na casa
                                                   │
                                                   ▼
                                       POST /api/public/track/postback/<pixel>
                                       ├─ marca registered_at / deposited_at
                                       ├─ envia "CompleteRegistration" / "Purchase" (com valor)
                                       └─ Meta otimiza para depósito real
```

---

## 1. Banco de dados (1 migração)

### `tracking_pixels`
- `id`, `user_id`, `name`, `vertical` (`bet|igaming|hot|promo|outro`), `is_active`
- `meta_integration_id` (FK opcional → `meta_integrations`)
- `account_id` (FK → `telegram_accounts` — bot que recebe `/start`)
- `room_id` (FK opcional → `rooms`)
- `bot_username` (cache)
- `event_on_join` (default `Lead`)
- `event_on_offer_click` (default `InitiateCheckout`)
- `event_on_register` (default `CompleteRegistration`)
- `event_on_deposit` (default `Purchase`)
- `postback_secret` (texto aleatório, gerado, usado para validar postbacks)
- RLS: dono lê/edita o próprio

### `tracking_offers`
- `id`, `pixel_id`, `user_id`, `slug` (único por pixel), `name`
- `destination_url` (URL da casa com `{click_id}` placeholder ou parâmetro fixo `sub1`)
- `subid_param` (default `sub1`, ajustável por plataforma)
- `default_event`, `default_value`, `default_currency`
- RLS: dono

### `tracking_clicks`
- `click_id` (12 chars base62, único, indexado), `pixel_id`, `user_id`
- **Identificadores de anúncio:** `fbp`, `fbc`, `fbclid`, `ttclid`, `gclid`, `kwai_click_id`
- **UTMs:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- **Contexto:** `ip`, `user_agent`, `referrer`, `landing_url`, `external_id` (fingerprint)
- **Estados do funil:** `joined_at`, `clicked_offer_at`, `registered_at`, `deposited_at`
- **Telegram:** `tg_user_id`, `tg_username`
- **Conversão:** `sale_value`, `sale_currency`, `external_user_id` (id na casa, para dedup)
- **CAPI:** `meta_events_sent` (jsonb com event_id por etapa)
- Índices: `(pixel_id, created_at desc)`, `(pixel_id, utm_content)`, `(pixel_id, utm_campaign)`, `unique(click_id)`
- RLS: dono lê; insert/update via backend (service role)

### Função SQL `tracking_attribution(pixel_id, group_col, from, to)`
Agrega métricas por dimensão (`utm_content`, `utm_campaign`, `utm_source`, etc.):
clicks · joins · offer_clicks · registers · deposits · revenue · conv_rate

---

## 2. Endpoints públicos

Todos sob `/api/public/track/*`. CORS aberto, sem auth (segurança via `pixel_id`+`postback_secret`).

| Endpoint | O que faz |
|---|---|
| `POST /click` | Snippet da landing → grava clique, retorna `{click_id, deeplink}` |
| `GET /g/:clickId/:offerSlug` | Redirector para a casa, injeta `sub1=<click_id>`, dispara `InitiateCheckout` no CAPI |
| `POST /postback/:pixelId` | S2S da casa de aposta/afiliado, autenticado por `postback_secret` query/header |
| `POST /sale/:pixelId` | Webhook genérico de checkout (Kirvano/Hotmart/Stripe) — reaproveita estrutura do Kirvano existente |
| `GET /pixel.js?id=<pixel_id>` (opcional) | Variante hospedada do snippet, se o usuário preferir tag única |

Todos validam payload com Zod, gravam log estruturado em `bot_execution_logs` (com `event='track4you'`).

---

## 3. Snippet de tracking (copiável)

JS auto-contido (~3kb) que:
1. Lê cookies `_fbp`/`_fbc`, e `fbclid`/`ttclid`/`gclid`/`kwai_click_id`/UTMs da URL
2. Gera `external_id` (hash SHA-256 estável do device)
3. Em `DOMContentLoaded`: POST para `/api/public/track/click` → recebe `deeplink`
4. Reescreve `href` de elementos `[data-track4you]` ou `[href*="t.me/"]` para `deeplink`
5. Salva `click_id` em `localStorage` (continuidade entre landing → checkout próprio)

Mostrado na UI como snippet copiável com pixel_id já embutido.

---

## 4. Webhook do bot (editar existente)

`src/routes/api/public/telegram/webhook.$accountId.ts`:
- Detectar `/start tk_<click_id>` em `message.text`
- Buscar `tracking_clicks` por `click_id` (lock anti-duplicação)
- Disparar `event_on_join` no Meta CAPI via `sendMetaEvent` (já existe)
  - `event_id = click_id` (deduplica server↔browser)
  - `user_data`: `fbp`, `fbc`, `client_ip_address`, `client_user_agent` ORIGINAIS do clique
  - `external_id`: hash do `tg_user_id`
  - `event_source_url`: `landing_url` original
- Marcar `joined_at`, `tg_user_id`, `tg_username`, gravar `event_id` em `meta_events_sent`
- Continuar fluxo normal do bot (boas-vindas, etc.)
- Se usuário tem `offer_slug` default no pixel, bot envia botão com URL `seuapp.com/g/<click_id>/<slug>`

---

## 5. Redirector `/g/:clickId/:offerSlug`

1. Busca `tracking_clicks` + `tracking_offers`
2. Marca `clicked_offer_at = now()`
3. Dispara `event_on_offer_click` no CAPI (com fbc/fbp originais)
4. 302 → `destination_url` com `sub1=<click_id>` injetado

---

## 6. Postback `/postback/:pixelId`

Recebe: `{ secret, sub1, event: "register"|"deposit"|"ftd", value?, currency?, external_user_id? }`

Valida `secret == pixel.postback_secret`, encontra clique por `sub1`, marca estado, dispara evento Meta correspondente com valor real. Dedupe por `event_id = ${click_id}:${event}`.

---

## 7. UI nova — `/trackeamento` + `/trackeamento/$pixelId`

### Lista de pixels
- Card por pixel: nome, vertical, bot vinculado, evento Meta
- Stats 24h/7d/30d: clicks, joins, registers, deposits, conv rate
- Botão "Novo pixel"

### Detalhe do pixel — 5 tabs

**Tab 1 — Visão geral / Funil**
- Funil visual: Cliques → Joins → Clicou na oferta → Cadastros → Depósitos
- Gráfico de linha: 30 dias, todas as etapas sobrepostas
- Total de receita atribuída

**Tab 2 — Atribuição por criativo**
- 4 sub-tabs: `utm_content` (criativo), `utm_campaign`, `utm_source`, `utm_term`
- Tabela ordenável: dimensão | clicks | joins | registers | deposits | revenue | CTR | CR Lead | CR Depósito
- Drill-down: clica numa linha → lista cliques individuais daquele criativo

**Tab 3 — Ofertas**
- CRUD de `tracking_offers`
- Por oferta mostra: URL pronta pra colar no canal (`seuapp.com/g/<click_id>/<slug>`), URL de postback (`seuapp.com/api/public/track/postback/<pixelId>?secret=<token>&sub1={SUB_ID}`), instruções por plataforma (Affise, BetConstruct, Smartico, Income Access, genérico)

**Tab 4 — Instalação**
- Snippet JS copiável
- Instruções: passo a passo de onde colar (head da landing) + como marcar o botão (`data-track4you`)
- Botão "Testar evento" (envia click_id de teste e mostra se chegou)

**Tab 5 — Logs**
- Últimos cliques (data, utm_source/content, status, tg_user, IP, device)
- Filtros por UTM, por estado do funil
- Export CSV

### Sidebar
Adicionar item "Trackeamento" entre Membros e Bots.

---

## 8. Detalhes técnicos importantes

- **Idempotência CAPI**: `event_id` por etapa = `${click_id}:${stage}` para o Meta deduplicar entre browser pixel e CAPI
- **fbc fallback**: se `_fbc` ausente mas `fbclid` presente, montar `fbc = fb.1.<timestamp>.<fbclid>` (padrão Meta)
- **Postback secret**: 32 chars aleatórios por pixel, validado em query OU header (`X-Postback-Secret`) — algumas plataformas só aceitam um dos formatos
- **Sem rate limiting** (não temos primitivas — limite só por validação Zod estrita)
- **Limpeza**: cron diário (`/api/public/cron/cleanup-tracking`) deleta cliques sem join >90 dias
- **CORS**: `Access-Control-Allow-Origin: *` no `/click` e `/g/*`. Sem credentials. Responde OPTIONS.
- **Click ID**: 12 chars base62, gerado server-side (`nanoid` com alfabeto custom)
- **Reaproveita**: `sendMetaEvent` em `meta-capi.server.ts`, padrão de webhook público do Kirvano, layout de cards/tabs de `/integracoes/meta` e `/membros`

---

## 9. Arquivos a criar/editar

**Criar**
- `supabase/migrations/<ts>_tracking_system.sql` — tabelas + RLS + função stats
- `src/lib/tracking.functions.ts` — CRUD de pixels/ofertas (server fns autenticadas)
- `src/lib/tracking.server.ts` — helpers (gerar click_id, formatar fbc, montar payload CAPI por etapa, idempotência)
- `src/routes/api/public/track/click.ts` — endpoint do snippet (CORS)
- `src/routes/api/public/track/g.$clickId.$offerSlug.ts` — redirector
- `src/routes/api/public/track/postback.$pixelId.ts` — S2S
- `src/routes/api/public/track/sale.$pixelId.ts` — checkout
- `src/routes/api/public/cron/cleanup-tracking.ts`
- `src/routes/_authenticated/trackeamento.tsx` — lista
- `src/routes/_authenticated/trackeamento.$pixelId.tsx` — detalhe (5 tabs)
- `src/components/tracking/TrackingSnippet.tsx`
- `src/components/tracking/AttributionTable.tsx`
- `src/components/tracking/FunnelChart.tsx`
- `src/components/tracking/OfferForm.tsx`

**Editar**
- `src/routes/api/public/telegram/webhook.$accountId.ts` — handler `/start tk_<id>`
- `src/lib/meta-capi.server.ts` — função helper `sendTrackingEvent(click, stage, extra?)` (opcional, ou usar `sendMetaEvent` direto)
- Sidebar (procurar componente em `_authenticated.tsx` ou similar) — adicionar item
- `src/integrations/supabase/types.ts` — regenera

---

## 10. Faseamento

**Fase 1 — Núcleo (essa entrega)**
- Migração + tabelas
- Endpoint `/click` + snippet
- Webhook do bot com `/start tk_<id>` + disparo Lead no CAPI
- UI: lista de pixels + tab Visão geral + tab Instalação
- Suporte a `fbclid`, `fbp`, `fbc`, todas as UTMs

**Fase 2 — Atribuição externa**
- Tabela `tracking_offers` + redirector `/g/`
- Endpoint `/postback` + `/sale` (Kirvano-compatible)
- Tab Ofertas + tab Atribuição por criativo
- Suporte a `ttclid`, `gclid`, `kwai_click_id`

**Fase 3 — Refinamento (depois)**
- Fingerprint matching
- TikTok Events API + Google Enhanced Conversions
- A/B comparison view
- View materializada de stats (se volume exigir)

**Sugiro entregar Fase 1 + Fase 2 juntas** — sem postback o sistema é só "tracker de bot", e a maior parte do valor está na atribuição da conversão externa. Fase 3 fica para depois.

---

## Fora do escopo desta versão
- TikTok Events API e Google Enhanced Conversions (capturamos os IDs já; envio CAPI fica para v3)
- Fingerprint matching probabilístico
- Painel A/B dedicado de criativos (a tab Atribuição já permite comparar via ordenação)
- Editor visual do snippet