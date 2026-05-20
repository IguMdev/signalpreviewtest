## Novos nichos de sala

Expandir o sistema de nichos de **2** (`ob`, `promo`) para **5**: `ob`, `promo`, `hot`, `igaming`, `expert`. Cada nicho exibe apenas seus bots no editor da sala.

---

### 1. Banco de dados

**Migration única:**

- Extender o enum `room_niche`: `+ 'hot' | 'igaming' | 'expert'`.
- Extender o enum `affiliate_store` para incluir parceiros adultos e casas de aposta:
  `+ 'privacy' | 'crakrevenue' | 'awempire' | 'bet365' | 'betano' | 'blaze' | 'kto' | 'sportingbet'`.
  → as tabelas `affiliate_accounts`, `promo_bot_settings`, `promo_offers`, `promo_dispatches`, `promo_conversions` já usam esse enum e passam a aceitar as novas lojas automaticamente.
- Nova tabela `hot_vip_funnel` (por sala) — funil free→VIP do nicho Hot:
  campos: `room_id`, `user_id`, `enabled`, `vip_checkout_url`, `vip_price_brl`, `teaser_interval_hours`, `last_teaser_at`, `cta_button_text`.
- Nova tabela `hot_teasers` (mídia agendada por sala):
  `room_id`, `user_id`, `image_path` ou `video_id`, `caption`, `sort_order`, `is_active`.
- Nova tabela `igaming_results` (resultado ao vivo + tracking dos sinais de cassino):
  `room_id`, `user_id`, `window_id`, `signal_message_id`, `result` (`win`|`loss`|`gale_win`), `confirmed_at`.
- Nova tabela `expert_funnel` (funil de mentoria/curso por sala):
  `room_id`, `user_id`, `enabled`, `checkout_url`, `product_name`, `price_brl`, `cta_button_text`.
- Nova tabela `expert_engagement_prompts` (perguntas/enquetes do dia):
  `room_id`, `user_id`, `kind` (`question`|`poll`), `content`, `options jsonb`, `send_time`, `weekdays`, `is_active`.
- RLS `auth.uid() = user_id` em todas (mesmo padrão das demais).

> Reaproveita-se 100% das tabelas `room_windows`, `room_assets`, `room_templates`, `room_session_messages`, `engagement_settings`, `followup_*`, `recurring_schedules`, `promo_*` — sem duplicar lógica.

---

### 2. Mapa de bots por nicho

| Nicho | Bots/cards visíveis no editor da sala |
|---|---|
| **ob** (Opções Binárias) | Janelas, Ativos, Templates, Stop-Loss, Dicas de Mercado, Engajamento, Follow-up, Recorrentes, Relatórios |
| **promo** (Promoções) | Promo Bot (Amazon/Shopee/AliExpress/Mercado Livre), Engajamento, Follow-up, Recorrentes |
| **hot** (Conteúdo adulto) | Promo Bot Adulto (Privacy/CrakRevenue/AWEmpire), Prévias Agendadas, Funil VIP, Engajamento, Follow-up, Recorrentes |
| **igaming** (Cassino/Apostas) | Janelas + Ativos (engine OB reaproveitada com jogos: Tigrinho, Aviator, Mines, Fortune Ox), Templates, Resultados ao Vivo, Promo Bot Casas (Bet365/Betano/Blaze/KTO/Sportingbet), Engajamento, Follow-up, Recorrentes |
| **expert** (Comunidade de Expert) | Funil de Venda (mentoria/curso), Aulas/Lives Agendadas (recorrentes), Engajamento Diário (perguntas/enquetes), Welcome, Follow-up |

---

### 3. UI — Wizard de criação de sala

`src/routes/_authenticated/rooms.index.tsx`:

- Substituir as 2 cards atuais (OB/Promo) por **5 cards** com ícone+descrição:
  - 📈 Opções Binárias
  - 🛒 Promoções
  - 🔥 Hot
  - 🎰 iGaming
  - 🎓 Comunidade Expert
- `niche` continua imutável após criação (trigger `prevent_room_niche_change` já existe).

### 4. UI — Editor da sala (`rooms.$roomId.edit.tsx`)

- Trocar o `if (niche === 'promo')` por **switch (room.niche)** que renderiza o conjunto de cards do mapa acima.
- Para `igaming`: reusar `WindowsCard`, `AssetsCard`, `TemplatesCard` do OB + novo `IGamingGamesCard` (substitui "ativos" por jogos de cassino) + novo `IGamingResultsCard` + reusar `PromoBotCard` configurado para lojas iGaming.
- Para `hot`: novo `HotPromoBotCard` (PromoBotCard restrito às lojas adultas) + `HotTeasersCard` + `HotVipFunnelCard`.
- Para `expert`: novo `ExpertFunnelCard` + `ExpertEngagementCard` + cards já existentes de welcome/follow-up/recorrentes.

### 5. UI — Sidebar (`_authenticated.tsx`)

Adicionar dois novos grupos colapsáveis:
- **Hot**: Contas Afiliadas Adultas, Estatísticas
- **iGaming**: Contas Casas de Aposta, Estatísticas, Resultados
- **Promoções** já existe.
- Itens do nicho expert ficam dentro da própria sala (sem grupo na sidebar).

### 6. Server functions e clients de loja

Em `src/lib/promo/`:
- `privacy.server.ts` — Privacy BR (afiliados.privacy.com.br/api)
- `crakrevenue.server.ts` — CrakRevenue Affiliate API
- `awempire.server.ts` — AWEmpire API
- `bet365.server.ts`, `betano.server.ts`, `blaze.server.ts`, `kto.server.ts`, `sportingbet.server.ts` — via Smartico/Income Access REST onde aplicável; ofertas (bonus, freebet, cashback) + postback de conversão.
- Atualizar `registry.server.ts` para mapear as novas entradas do enum.

Novas server-fns em:
- `src/lib/hot.functions.ts` — CRUD `hot_vip_funnel`, `hot_teasers`, preview do teaser.
- `src/lib/igaming.functions.ts` — CRUD configurações iGaming, registro de resultado ao vivo (win/loss/gale), envio de mensagem de "GREEN/RED" no Telegram.
- `src/lib/expert.functions.ts` — CRUD funil, prompts de engajamento, agendamento.

### 7. Cron

- Reusar `dispatch-promos` (já roda 5min) — passa a contemplar lojas hot/igaming automaticamente.
- Reusar `sync-promo-conversions` (já roda 1h) — idem.
- Novo `/api/public/cron/hot-teasers` (15min): dispara prévias por intervalo.
- Novo `/api/public/cron/expert-engagement` (1min): envia perguntas/enquetes na hora marcada.
- `room_windows` + scheduler existente cobrem sinais iGaming sem cron novo.

### 8. Tracking

- Promo (cliques/conversões) já cobre hot e igaming via `/go/$dispatchId` + `promo_conversions`.
- Para iGaming com postback S2S das casas: novo endpoint `/api/public/postback/$store.ts` (HMAC ou token por casa) que insere em `promo_conversions`.

---

### 9. Secrets

Nenhum no projeto — todas as credenciais ficam em `affiliate_accounts.credentials` (jsonb por usuário, RLS).

### 10. Ordem de execução

1. Migration (enums + tabelas novas).
2. Wizard de 5 cards + switch no editor.
3. Cards hot (Funil VIP, Teasers, Promo Adulto).
4. Cards iGaming (Jogos + Resultados + Promo Casas).
5. Cards Expert (Funil + Engagement).
6. Sidebar (links Hot/iGaming).
7. Clients de loja novos + atualização do registry.
8. Crons (hot-teasers, expert-engagement) + postback iGaming.

---

### Observações técnicas

- O enum `affiliate_store` precisa ser estendido **antes** das migrations criarem as tabelas (Postgres exige `ALTER TYPE ... ADD VALUE` fora de transação) — vai numa migration própria, executada antes das demais alterações que dependem dela.
- `niche` permanece imutável após criação (regra existente respeitada).
- `PromoBotCard` recebe prop `allowedStores: AffiliateStore[]` para limitar as opções por nicho (hot ≠ igaming ≠ promo geral).
- Todos os botões CTA dos funis (hot VIP, expert) passam pelo redirecionador `/go/$dispatchId` para tracking unificado.
