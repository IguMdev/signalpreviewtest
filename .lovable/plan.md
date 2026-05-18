## Objetivo

Tornar o código visualmente "limpo" delimitando cada feature com blocos de comentário bem marcados, para que ao editar uma área (ex.: Tracking) seja impossível bagunçar acidentalmente outra (ex.: Boas-Vindas). **Nenhum código é movido, renomeado ou alterado logicamente** — só anotações de seção. Risco zero de quebra.

## Padrão de separadores

Usarei um padrão único em todo o projeto, fácil de buscar com `rg`:

```ts
// ╔══════════════════════════════════════════════════════════╗
// ║  TRACKEAMENTO AVANÇADO (Meta CAPI + cliques)             ║
// ╚══════════════════════════════════════════════════════════╝
... código da feature ...
// ── FIM: TRACKEAMENTO AVANÇADO ──────────────────────────────
```

Cada bloco terá: cabeçalho (nome da feature + responsabilidade em 1 linha) e rodapé "FIM:". Sub-blocos usam `// ─── Sub-seção ───`.

## Arquivos e seções

### 1. `src/routes/api/public/telegram/webhook.$accountId.ts` (661 linhas)
Blocos:
- HELPERS (publicUrl, escapeHtml, etc.)
- COMANDO `/start fu_<roomId>` — FOLLOW-UP (registro de lead privado)
- EVENTO `my_chat_member` — DETECÇÃO DE BLOQUEIO (followup stop)
- EVENTO `chat_member` / `new_chat_members` — TRACKEAMENTO DE MEMBROS
- BOT BOAS-VINDAS (envio do bloco welcome em grupos)
- META CAPI (envio do evento de join/leave)
- FALLBACK / LOG

### 2. Crons (`src/routes/api/public/cron/*.ts`)
Cada arquivo recebe um cabeçalho único explicando sua responsabilidade e separadores internos quando há mais de uma rotina:
- `dispatch-signals.ts` → SINAIS / INICIANDO SESSÃO / RELATÓRIO DE JANELA / GALE & RESULTADO
- `dispatch-sessions.ts` → AVISO INICIANDO SESSÃO
- `dispatch-followups.ts` → CARREGAR LEADS / DEDUP / ENVIO (texto/foto/vídeo) / STOP POR BLOQUEIO
- `dispatch-recurring.ts` → CRIAÇÃO DE PENDENTES / ENVIO PRINCIPAL / ENVIO DE FOLLOW-UPS
- `dispatch-market-tips.ts` → SELEÇÃO DE TIP / ENVIO
- `check-premium-accounts.ts` / `check-telegram-webhooks.ts` → cabeçalho só

### 3. Páginas dos Bots (`src/routes/_authenticated/`)
- `bots.boasvindas.tsx` → CONFIGURAÇÃO PRINCIPAL / UPLOAD DE MÍDIA / PREMIUM EMOJIS / TEMPLATES EXTRAS (linhas extras)
- `bots.encaminhador.tsx` → ORIGEM/DESTINO / PREMIUM / MARCAÇÃO DE TEMPLATES
- `bots.followup.tsx` → SELEÇÃO DE SALA / CONFIGURAÇÃO + CTA / SEQUÊNCIA DE MENSAGENS / EDITOR / LEADS

### 4. Libs server (`src/lib/*.server.ts`)
Cabeçalho de arquivo (3 linhas: nome, responsabilidade, quem chama) em:
- `telegram.server.ts`, `premium-send.server.ts`, `forwarder.server.ts`, `forwarder-premium.server.ts`, `signals.server.ts`, `market-tips.server.ts`, `meta-capi.server.ts`, `tracking.server.ts`

Quando há mais de uma função pública, cada uma ganha separador próprio.

## O que NÃO vou fazer

- Não mover, renomear, deletar ou reescrever nenhuma função.
- Não extrair helpers para novos arquivos.
- Não alterar imports nem assinaturas.
- Não tocar em `routeTree.gen.ts`, `types.ts`, `client.ts`, migrações.

## Como validar

Após aplicar, a build do TS deve passar sem nenhuma mudança de comportamento. Os separadores ficam pesquisáveis com `rg "FIM: TRACKEAMENTO"` etc., facilitando localizar a fronteira de cada feature antes de editar.

## Tempo estimado

Edições puramente de comentário em ~15 arquivos. Aplico em uma única passada.