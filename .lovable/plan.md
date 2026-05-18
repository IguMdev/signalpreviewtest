
## Objetivo

Criar um bot de follow-up que envia mensagens diárias no **privado** do lead no Telegram. O gatilho é o lead clicar no botão **"Iniciar"** anexado à mensagem do Bot Boas-Vindas — a partir do `/start`, o sistema registra o `chat_id` privado e começa a sequência fixa (dia 1, dia 2, dia 3…). Para de enviar apenas quando o lead bloquear/parar o Bot Boas-Vindas.

## 1. Mudanças no Bot Boas-Vindas

- Adicionar um botão inline **"Iniciar conversa privada"** (texto configurável) na mensagem de boas-vindas do grupo, com URL `https://t.me/<bot_username>?start=fu_<room_id>`.
  - O `start=fu_<room_id>` é o que permite identificar a qual sala/follow-up o lead pertence quando ele abrir o privado.
- No mesmo card de configuração do Boas-Vindas, novo bloco **"Botão de follow-up privado"** com:
  - Toggle ligar/desligar
  - Texto do botão (default: "Iniciar conversa privada 💬")

## 2. Captura do /start no privado

No webhook do Telegram (`src/routes/api/public/telegram/webhook.$accountId.ts`):

- Detectar `message.text` começando com `/start fu_<room_id>` em chat `type === "private"`.
- Registrar/upsert em uma nova tabela `followup_leads`:
  - `user_id`, `room_id`, `account_id`, `tg_user_id`, `chat_id` (privado), `first_name`, `username`
  - `started_at`, `status` (`active` | `stopped`)
  - `current_day` (default 0)
- Detectar `my_chat_member` em chat privado com `new_status = "kicked"` → marca lead como `stopped` (lead bloqueou o bot).
- Disparar imediatamente a mensagem do **dia 1** (ou enviar uma confirmação de inscrição configurável).

## 3. Configuração da sequência de follow-up

Nova página `/_authenticated/bots/followup` (item no menu lateral junto com Boas-Vindas / Encaminhador):

- Seletor de sala (igual ao Boas-Vindas).
- Lista ordenável de **mensagens por dia** (dia 1, dia 2, …, dia N).
- Para cada mensagem:
  - Conteúdo: texto + emoji premium (mesmo picker do Boas-Vindas)
  - Mídia: imagem **ou** vídeo/video-note (mesma asset library)
  - Botão inline opcional (texto + URL)
  - Horário de envio diário (default: 09:00 no fuso da sala)
- Toggle global ativo/inativo por sala.
- Botão "Testar agora" envia o dia selecionado para o próprio dono (chat_id de teste).

## 4. Dispatcher (cron job)

Server route `src/routes/api/public/cron/dispatch-followups.ts`:

- Roda **a cada minuto** via `pg_cron`.
- Para cada lead `active`:
  - Calcula `days_since_start = floor((now - started_at) / 1 dia)`
  - Pega `followup_messages` onde `day_number = days_since_start + 1` e horário ≤ agora-no-fuso
  - Verifica deduplicação em `followup_dispatch_log (lead_id, day_number)` para não duplicar.
  - Envia a mensagem (reutilizando o helper `sendWelcomeBlock` ou equivalente que já cuida de texto/imagem/vídeo/premium).
  - Insere log em `followup_dispatch_log`.
  - Se Telegram responder `403 Forbidden: bot was blocked by the user` → marca lead como `stopped`.
  - Se `current_day > max(day_number)` → marca lead como `completed` (sem mais nada para enviar; volta a `active` se o admin adicionar mais dias).

## 5. Modelo de dados (migration)

```text
followup_leads
  id uuid pk
  user_id uuid (dono da sala)
  room_id uuid fk rooms
  account_id uuid fk telegram_accounts
  tg_user_id bigint
  chat_id bigint           -- chat privado com o bot
  first_name text, username text
  started_at timestamptz default now()
  status text default 'active'   -- active | stopped | completed
  unique (room_id, tg_user_id)

followup_messages
  id uuid pk
  user_id uuid
  room_id uuid fk rooms
  day_number int           -- 1, 2, 3, ...
  send_time time default '09:00'
  content text
  image_path text, image_mime text
  video_id uuid fk videos
  parse_mode text default 'HTML'
  premium_enabled bool default false
  premium_account_id uuid
  button_text text, button_url text
  sort_order int
  unique (room_id, day_number)

followup_settings
  room_id uuid pk fk rooms
  enabled bool default false
  cta_button_text text default 'Iniciar conversa privada 💬'
  cta_button_enabled bool default false
  timezone text default 'America/Sao_Paulo'

followup_dispatch_log
  id bigint pk
  lead_id uuid fk followup_leads
  day_number int
  sent_at timestamptz default now()
  ok bool, error text
  unique (lead_id, day_number)
```

RLS: todas as tabelas filtradas por `user_id = auth.uid()`. Inserts via `supabaseAdmin` no webhook/cron.

## 6. Página de monitoramento

Na mesma página de follow-up, abaixo da configuração:

- **Leads ativos** (count) / parados / completos
- Tabela últimos 50 leads: nome, @username, dia atual, status, último envio
- Botão "Pausar lead" / "Reativar"

## Detalhes técnicos

- O `start=fu_<room_id>` precisa caber em 64 chars (limite do Telegram start_param) — ok, UUID = 36 + prefixo.
- Reutilizar `sendWelcomeBlock` em `webhook.$accountId.ts` (já lida com texto/imagem/vídeo/video-note/premium/botão). Extrair para `src/lib/telegram-send.server.ts` se precisar ser chamado também pelo cron.
- Cron: `cron.schedule('dispatch-followups-every-minute', '* * * * *', ...)` chamando a URL pública estável `project--<id>.lovable.app/api/public/cron/dispatch-followups`.
- Subscription/credit: usar `hasActiveSub(userId, "boasvindas")` ou criar `"followup"` se for cobrança separada (confirmar na implementação — default é reusar a do boas-vindas).
- Detecção de `403 bot was blocked`: ao chamar `callTelegram`, se `description` incluir "blocked" ou "user is deactivated", `status = 'stopped'`.

## Fora de escopo (pode virar pedido futuro)

- Sequência com hora variável por mensagem (já incluída via `send_time` por dia).
- Múltiplas sequências A/B por sala.
- Pausar/retomar baseado em interação (clique em botão).
