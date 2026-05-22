## Objetivo

Permitir que cada Pixel funcione em um de dois **modos de trackeamento**, com presets diferentes de eventos Meta, etapas do funil, UTMs sugeridas e postbacks — refletindo que cada nicho rastreia coisas diferentes.

## Modos

**1. Telegram (bet, igaming, hot, promo)** — fluxo atual
Funil: clique no anúncio → entra no bot → clica oferta → cadastro → depósito
Eventos padrão: `Lead` / `InitiateCheckout` / `CompleteRegistration` / `Purchase`

**2. Direct Response / Infoprodutos** (novo)
Sem bot do Telegram. Fluxo: anúncio Meta → página de vendas → checkout → compra
Etapas rastreadas:
- `ViewContent` (pageview da VSL/landing)
- `Lead` (opt-in / lead qualificado — email/whatsapp capturado)
- `InitiateCheckout` (entrou no checkout)
- `AddPaymentInfo` (escolheu método: pix/boleto/cartão)
- `Purchase` (compra confirmada, com `value` e `currency`)

Identificação do comprador: `external_id` (hash do email/CPF), `fbp`, `fbc`, `em`, `ph` enviados via CAPI; valor da compra e qual campanha (UTM source/campaign/content/term + fbclid) vinculados ao `click_id`.

## Mudanças

### 1. Schema (migration)

Tabela `tracking_pixels`:
- Adicionar coluna `tracking_mode text not null default 'telegram'` com check `('telegram','direct_response')`
- Adicionar 4 colunas de evento para o modo DR:
  `event_on_view text`, `event_on_lead text`, `event_on_checkout text`, `event_on_payment_info text`, `event_on_purchase text`
- Backfill: pixels existentes → `tracking_mode = 'telegram'`

Tabela `tracking_clicks`:
- Adicionar `viewed_at`, `lead_at`, `checkout_at`, `payment_info_at` (timestamptz nullable) — espelham os existentes `joined_at`/`registered_at`/`deposited_at` mas para o fluxo DR

### 2. Server (`src/lib/tracking.functions.ts`)
- Estender `pixelSchema` com `tracking_mode` e novos campos de evento
- Adicionar helper `MODE_PRESETS` exportado com defaults de cada modo
- `getPixelStats` e `getAttribution`: retornar contadores adequados ao modo (DR: views/leads/checkouts/purchases; Telegram: mantém)

### 3. UI (`trackeamento.pixels.tsx`)
- Wizard passo 1: seletor **Modo de trackeamento** com 2 cards (Telegram com bot / Direct Response Meta→Checkout). Cada modo mostra explicação curta e bullets do que será rastreado.
- O campo "Bot do Telegram" e "Vertical" só aparecem no modo Telegram. No DR, mostrar campo "URL da página de vendas" (informativo).
- Edit dialog: seção "Eventos Meta por etapa" renderiza linhas diferentes conforme o modo.

### 4. Endpoint de tracking p/ Direct Response
- Novo route `src/routes/api/public/track/dr/$pixelId.ts` (POST, com CORS) que recebe `{ stage, click_id, value?, currency?, em?, ph?, external_id? }` do site/checkout e dispara CAPI com os campos de identificação.
- Documentar no UI o snippet JS para colar na página de vendas/obrigado.

### 5. Postbacks por nicho
- `POSTBACK_EVENTS` expandido com `lead`, `checkout_started`, `payment_info`, `purchase` (DR). Os existentes (`viewpage`, `click_button`, `channel_enter`, `channel_leave`) permanecem para Telegram.
- UI de postbacks filtra eventos disponíveis pelo `tracking_mode` do pixel.

### 6. Tour/copy
- Atualizar copy da página Pixels explicando os dois modos.

## Técnico

- Mantém retrocompatibilidade total: pixels antigos = modo telegram, defaults inalterados.
- Sem mudança em `track/click` e `track/g` (continuam servindo Telegram). DR usa endpoint próprio porque o gatilho vem do site/checkout, não do bot.
- `fireTrackingEvent` em `tracking.server.ts` ganha cases para `view`/`lead`/`checkout`/`payment_info`/`purchase` mapeando para o evento Meta configurado no pixel.

## Fora do escopo (perguntar antes se quiser)

- Integração automática com Hotmart/Kirvano/Eduzz (webhooks dedicados por plataforma) — pode ser próximo passo
- Server-side conversion API direta com hash automático de email/CPF no front (hoje passa cru, hash no server)