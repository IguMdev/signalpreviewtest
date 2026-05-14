# Refatorar `/rooms/$roomId/edit` para bater com a referência

A tela atual usa um menu lateral com seções clicáveis. A referência é uma **página única e rolável** com todas as seções visíveis ao mesmo tempo, layout horizontal denso e campos novos. Vamos reconstruir nesse formato.

## Estrutura final (top → bottom)

1. **Cabeçalho**
   - Breadcrumb: Home › Salas › Editar Sala
   - Título: `Editar Sala - {nome} {emojis}` + botão **Acessar** (link Telegram)

2. **Configurações Base** (card)
   - Linha 1: Conta Telegram (bot) | Conta Premium (com texto auxiliar)
   - Linha 2: Corretora (select com ✕ para limpar) | ID do Grupo
   - Caixa azul informativa "Sistema de Envio Híbrido"

3. **Configurações de Mensagens** (card)
   - Bloco "Tipos de arquivos suportados"
   - Bloco "Tags HTML / Macros para Template de Sinal"

4. **Janelas de Operação** (card, lista repetível, botão "+ Adicionar Janela")
   - Por janela: Nome da Sessão, Início, Fim, Qtd. Sinais, Max Losses (Stop Loss), Martingale, Tipo de Sinal (Mensagem/Lista)
   - Timeframes: M1, M2, M3, M5, M15, M30
   - Dias da Semana: Seg–Dom
   - "Usar Todos os Ativos" (toggle) + legenda Aberto/Fechado/Pagou ≥ 70%
   - Filtros por categoria + grid de ativos em **4 colunas** (Forex, Cripto, Ações, OTC) com checkbox + badge Aberto/Fechado + input de payout (%)

5. **Templates de Mensagem** (card, com abas Mensagem/Lista)
   - Template principal de Sinal (textarea HTML grande) + botões Emojis / Restaurar / Enviar teste
   - "Botões Personalizados" (lista + botão Adicionar Botão)
   - Três colunas: **Vitória / Vitória Martingale / Derrota** — cada uma com input de template, "Enviar teste", preview da imagem (GAIN/GAIN/LOSS), Remover arquivo, Escolher arquivo
   - Direção: Template de **Compra** | Template de **Venda**

6. **Mensagem de Sessão** (card)
   - 2 colunas (Início | Término): Habilitar (checkbox), textarea, Enviar teste, Imagem (file picker)
   - Antecedência da Mensagem de Início (select de minutos)

7. **Relatório de Fim de Sessão** (card)
   - Habilitar (checkbox), Delay (minutos), Template (textarea com macros {SESSAO_NOME}/{TOTAL_WINS}/{TOTAL_LOSSES}/{WIN_RATE}/{TOTAL_OPERACOES}), Imagem

8. **Fuso Horário** (card)

9. **Mensagem de Stop Loss** (card) — textarea + Enviar teste

10. **Dicas de Mercado** (card) — checkbox "Habilitar envio"

11. **Rodapé sticky**: botões **Salvar** | **Cancelar**

## Mudanças de banco

Necessárias para suportar campos novos. Todos com RLS por dono.

- `rooms`: + `premium_account_id uuid`, `access_url text`, `stop_loss_message text`, `market_tips_enabled boolean`
- `room_windows`: + `signals_qty int`, `max_losses int`, `martingale int`, `signal_type text` ('message'|'list'), `timeframes text[]`, `use_all_assets boolean`
- `room_templates`: extensão para suportar 6 tipos novos via enum (`win`, `win_martingale`, `loss`, `buy_direction`, `sell_direction`, `signal`) e campo `tab text` ('message'|'list')
- nova `room_template_buttons` (id, room_id, template_kind, label, url, order)
- `room_session_messages`: + `image_path text`, `enabled boolean`, `lead_minutes int` (na linha 'open')
- `room_reports`: + `delay_minutes int`, `template text`, `image_path text`
- `room_assets`: já suporta payout/aberto — manteremos. Adicionar `window_id uuid null` opcional para permitir override por janela (na referência os ativos vivem dentro da janela; vamos manter ativos por sala E por janela, com a janela podendo herdar via toggle "Usar todos os ativos").

## Componentização

Quebrar em arquivos para o `rooms.$roomId.edit.tsx` não virar monstro:

```
src/components/room-edit/
  RoomEditHeader.tsx
  BaseConfigCard.tsx
  MessagesInfoCard.tsx
  WindowsCard.tsx           // wrapper + add
  WindowItem.tsx            // 1 janela com timeframes/dias/ativos
  WindowAssetsGrid.tsx      // grid 4-col Forex/Cripto/Ações/OTC
  TemplatesCard.tsx
  TemplateButtonsList.tsx
  ResultTemplateColumn.tsx  // Vitória / Vitória MG / Derrota
  DirectionTemplates.tsx    // Compra / Venda
  SessionMessagesCard.tsx
  ReportCard.tsx
  TimezoneCard.tsx
  StopLossMessageCard.tsx
  MarketTipsCard.tsx
  StickyFooter.tsx          // Salvar / Cancelar
```

A página `rooms.$roomId.edit.tsx` apenas faz fetch da sala e empilha os cards.

## Salvamento

Botão **Salvar** único no rodapé que dispara em paralelo:
- update na `rooms`
- upsert das janelas (e seus ativos/timeframes/dias)
- upsert dos 6 templates + botões personalizados
- upsert das 2 mensagens de sessão (+ imagens via Storage `room-images`)
- upsert do relatório (+ imagem)
- upsert do timezone, stop loss, market tips

Estado mantido localmente com `useReducer`/`useState` por card; ao salvar, dispara mutações e mostra toast consolidado.

## Faseamento (entrega em 2 passos)

**Fase 1 (este ciclo)**
- Migration com todos os campos/tabelas novas
- Reescrita da página em layout vertical sem sidebar
- Cards: Cabeçalho, Configurações Base, Configurações de Mensagens (info), Janelas (com timeframes/dias/qtd/max losses/martingale/tipo + ativos no formato 4 colunas), Fuso Horário, Stop Loss (existentes adaptados), rodapé Salvar/Cancelar

**Fase 2 (próximo ciclo)**
- Templates de Mensagem (com abas, botões customizados, 3 colunas resultado, imagens GAIN/LOSS, direções)
- Mensagem de Sessão (com upload e antecedência)
- Relatório de Fim de Sessão (com upload)
- Dicas de Mercado
- Botão "Acessar" (deep link Telegram), Breadcrumb, "Enviar teste" em todos os textos

## Fora de escopo

- Funcionalidade real do botão **Enviar teste** (apenas botão UI por enquanto, sem disparo real no Telegram).
- Botão **Acessar** vai abrir `https://t.me/<chatId>` se possível, senão mostra ID.
- Editor de emojis premium (botão "Emojis" abrirá a lista existente em `premium_emojis`).
- Integração com pg_cron / scheduler para realmente enviar nos horários — só configuração visual.

## Confirmar antes de começar

1. Pode rodar a migration adicionando todos os campos/tabelas listados? (sem perda de dados — tudo é additive ou nullable)
2. Toparia o **faseamento em 2 etapas** acima, ou prefere tudo de uma vez (resposta longa, maior chance de algo precisar de ajuste)?
3. O botão "Salvar" no rodapé deve persistir **tudo de uma vez**, ou cada card mantém seu próprio Salvar como hoje?
