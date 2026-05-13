## Visão geral

Recriar o painel **Sala de Sinais** em TanStack Start + Lovable Cloud, em português, com um redesign moderno (mantendo a estrutura de telas do projeto enviado). Backend completo via Lovable Cloud + Telegram Bot API (connector Telegram da Lovable, sem precisar do bot token na mão).

## Telas (rotas)

```
/login, /signup, /reset-password           públicas
/_authenticated/
  ├── dashboard                            visão geral (créditos, envios, próximos agendamentos)
  ├── telegram-accounts                    cadastro de bots Telegram + status + teste de envio
  ├── telegram-accounts/$id/chats          grupos/canais visíveis para o bot
  ├── premium-emojis                       biblioteca de emojis premium (custom_emoji_id + nome)
  ├── rooms                                grupos de destino (lista + criar/editar)
  ├── mensagens                            agendamentos de sinais (criar, listar, cancelar)
  ├── kirvano/planos                       página de recarga de créditos (mock — sem provedor real)
  └── profile                              dados da conta, foto, troca de senha
```

Layout: navbar fixa com logo, saldo de créditos e menu do usuário; sidebar com Dashboard, Contas Telegram, Emojis Premium, Grupos, Agendamentos, Recarga, Minha Conta. Tema claro/escuro.

## Backend (Lovable Cloud)

Tabelas:
- `profiles` (id ↔ auth.users, display_name, avatar_url, credits int default 0)
- `user_roles` (user_id, role enum admin/user) + função `has_role()` (security definer)
- `telegram_accounts` (id, user_id, label, bot_token criptografado, bot_username, is_active, last_check_at, status)
- `telegram_chats` (id, account_id, chat_id, title, type, username, cached_at) — cache do que o bot enxerga
- `premium_emojis` (id, user_id, name, custom_emoji_id, preview_char)
- `rooms` (id, user_id, name, description, default_account_id)
- `room_chats` (room_id, chat_id) — mapeia destinos
- `scheduled_messages` (id, user_id, room_id, account_id, content_html, parse_mode, scheduled_at, status enum pending/sent/failed, sent_at, error)
- `message_logs` (id, scheduled_message_id, chat_id, telegram_message_id, ok, error, created_at)
- `credit_transactions` (id, user_id, delta int, reason, created_at)

RLS: todas as tabelas com policies "owner only" via `auth.uid() = user_id`. Roles em tabela separada.

Server functions (`createServerFn`):
- `accounts.*`: create / update / delete / verifyStatus / listChats / sendTest
- `emojis.*`: list / create / delete
- `rooms.*`: CRUD + setMembers
- `messages.*`: schedule / cancel / list / runDue (consome créditos, envia via Telegram)
- `credits.*`: balance / addManual (admin)

Integração Telegram via **connector Telegram da Lovable** (gateway), métodos usados: `getMe`, `getUpdates` (para descobrir chats que o bot vê), `sendMessage` com `parse_mode=HTML` e suporte a custom_emoji via entities. Token do bot informado pelo usuário fica salvo cifrado, mas o envio em si pode passar pelo connector (1 connection por workspace) — confirmar abaixo.

Cron de agendamentos: server route `/api/public/cron/dispatch` chamada por pg_cron a cada minuto, processa `scheduled_messages` com `scheduled_at <= now() AND status = 'pending'`.

## Pontos a confirmar antes de iniciar

1. **Multi-bot**: o connector Telegram da Lovable usa **um único bot por conexão de workspace**. Para suportar múltiplas "Contas Telegram" como no projeto original, o ideal é deixar o usuário colar o bot token e usar diretamente `https://api.telegram.org/bot<token>/...` server-side (token cifrado no banco). OK seguir por esse caminho?
2. **Créditos / Kirvano**: faço somente UI + saldo manipulável manualmente (mock), sem integrar gateway de pagamento agora? (Stripe/Paddle podem ser adicionados depois.)
3. **Agendamento**: tudo bem ativar pg_cron na Lovable Cloud para disparar envios a cada minuto?
4. **Emojis premium**: o usuário cadastra `custom_emoji_id` manualmente (igual ao original) — confirma?

Posso seguir assumindo "sim" para os 4 itens se você não responder explicitamente.

## Detalhes técnicos

- Stack: TanStack Start (já no template), Tailwind v4, shadcn/ui, Lovable Cloud (Supabase) para auth+DB+RLS.
- Auth: email/senha + Google. Profiles auto-criadas via trigger no signup.
- Bot tokens: coluna `bot_token_encrypted` (pgcrypto `pgp_sym_encrypt` com chave em secret `TELEGRAM_TOKEN_KEY`). Server functions descriptografam só na hora do envio.
- Envio: `fetch` direto à Bot API server-side (server function), com retry simples e log em `message_logs`.
- Validação: Zod em todos os `inputValidator`.
- Design tokens novos em `src/styles.css` (paleta escura por padrão, accent verde para "ativo/sucesso", typography Inter + Plus Jakarta como no original).
- Sem mock data hardcoded — tudo vindo do banco.

## Etapas de implementação

1. Habilitar Lovable Cloud, criar schema + RLS + trigger de profile + função `has_role`.
2. Auth pages (login/signup/reset) + layout `_authenticated` com guard.
3. Layout shell (navbar + sidebar + dark mode toggle) e design tokens.
4. CRUD de Contas Telegram + verifyStatus/sendTest via Bot API.
5. Listagem de chats (cache via `getUpdates`) e CRUD de Rooms.
6. CRUD de Premium Emojis e editor de mensagem com inserção de emojis.
7. Agendamentos (criar/listar/cancelar) + página de detalhes/log.
8. Cron route + ativação de pg_cron + dedução de créditos por envio.
9. Página de Recarga (mock) + Minha Conta.
10. Polimento visual, estados vazios, toasts, loading skeletons.
