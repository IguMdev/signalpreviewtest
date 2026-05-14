## Objetivo
Reproduzir o sistema de salas de sinais conforme os 4 prints enviados: lista em tabela, wizard de criação, edição em seções e seletor de ativos (já feito).

## Banco — novas tabelas / campos

Adicionar à `rooms`:
- `broker` text — corretora
- `welcome_message` text
- `timezone` text default 'America/Sao_Paulo'
- `stop_loss_enabled` boolean, `stop_loss_value` numeric
- `expires_at` timestamptz — para "Renovar/Vencimento"
- `is_active` boolean default true

Novas tabelas (todas com RLS por user_id):
- `room_windows` — janelas de operação (id, room_id, name, start_time, end_time, weekdays[], asset_filter[])
- `room_templates` — templates de mensagem (id, room_id, kind enum: entry/gain/loss/event, content, parse_mode)
- `room_session_messages` — mensagens de início/fim de sessão (id, room_id, kind: open/close, content)
- `room_images` — imagens GAIN/LOSS (id, room_id, kind: gain/loss, storage_path)
- `room_reports` — config de relatório fim de sessão (1 por sala: enabled, send_time, include_stats)

(`room_assets` já existe ✓)

## Telas

### 1. `/salas` — substitui `/rooms` em formato tabela
Colunas: Bot · Conta Telegram · Sala · ID grupo · Vencimento · Ativa · Ações (editar, logs, agendados, desativar, renovar). Header com filtros "Todas/Ativas/Aberto/Fechado", contador, busca.

### 2. Wizard "Nova sala" — Dialog com passos
- **Passo 1 (Básico)**: ID grupo/canal, título, corretora, conta Telegram, mensagem de boas-vindas → "Próximo"
- Após salvar passo 1, redireciona para tela de edição (passos 2+).

### 3. `/salas/$roomId/edit` — tela full-page com seções colapsáveis (sidebar de navegação à esquerda, conteúdo à direita)
Seções, na ordem do print:
1. **Configurações** — bot, conta, corretora, ID, mensagem boas-vindas
2. **Janelas de Operação** — CRUD inline (horário início/fim, dias da semana, filtro de ativos)
3. **Ativos** — abre o `AssetSelectorDialog` já feito
4. **Templates de Mensagens** — entrada/gain/loss/evento (textarea + parse_mode + preview)
5. **Imagens GAIN/LOSS** — upload no bucket existente
6. **Mensagens de Sessão** — abertura/fechamento
7. **Relatórios** — fim de sessão (toggle + horário)
8. **Fuso horário** — select
9. **Stop Loss** — toggle + valor

Cada seção salva isoladamente com botão "Salvar seção".

## Entrega faseada (recomendado)
Como é grande, sugiro entregar em ordem: 
- **Fase A**: migration completa + tela `/salas` em tabela + wizard passo 1 (criar) + shell da tela de edição (sidebar + seção Configurações funcionando)
- **Fase B**: Janelas de Operação + Templates de Mensagens
- **Fase C**: Imagens GAIN/LOSS + Mensagens de Sessão + Relatórios + Fuso + Stop Loss

Cada fase fica utilizável sozinha.

## Pontos que preciso confirmar antes de codar
1. **Manter `/rooms` antiga** ou substituir totalmente pela `/salas`?
2. **Wizard pós passo 1**: quer realmente ir direto para a página de edição (fluxo do print) ou prefere wizard com next/back para todas as seções?
3. **Janelas de operação**: o filtro "Soja/Milho/Trigo" do print é só metáfora visual — quer que cada janela tenha lista livre de ativos vinculados, ou herda os ativos da sala?
4. **Fase A primeiro**? (recomendo fortemente — assim você valida o esqueleto antes de eu construir as outras 6 seções)
