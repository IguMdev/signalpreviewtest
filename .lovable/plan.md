## Visão geral

Vamos dividir em duas partes:

1. **Servidor externo (fora do Lovable)** — pequeno serviço Node.js que você hospeda em Railway / Render / VPS. Ele roda `gramjs` (MTProto) e expõe uma API HTTP simples protegida por um token. Essa parte eu te entrego o código pronto + instruções de deploy, mas ela **não vive dentro deste projeto Lovable**.

2. **Lovable (este projeto)** — atualizo a tela "Adicionar Conta Premium" igual ao print, e crio server functions que chamam o servidor externo para: solicitar código, validar código, listar emojis premium, enviar mensagem como conta pessoal.

---

## Parte 1 — Serviço externo `tg-userbot` (você hospeda)

Stack: Node 20 + Express + gramjs + better-sqlite3 (para guardar `session string` por conta).

Endpoints (todos exigem header `X-Auth-Token` = um token forte que você gera):

```text
POST /auth/send-code    { apiId, apiHash, phone }            -> { phoneCodeHash }
POST /auth/sign-in      { apiId, apiHash, phone, phoneCodeHash, code, password? }
                                                              -> { sessionString, userId, firstName, username }
POST /emojis/list       { sessionString, apiId, apiHash }    -> [{ id, emoji, setName }]
POST /messages/send     { sessionString, apiId, apiHash, chatId, text, entities? }
                                                              -> { messageId }
POST /session/check     { sessionString, apiId, apiHash }    -> { ok, userId }
```

Eu te entrego: `package.json`, `index.js`, `Dockerfile`, `README.md` com passo-a-passo de deploy no Railway (1 clique) e como gerar o `USERBOT_TOKEN`.

---

## Parte 2 — Mudanças no Lovable

### Banco
Adicionar em `telegram_accounts`:
- `tg_api_id` (int, nullable)
- `tg_api_hash` (text, nullable, criptografado igual `bot_token`)
- `tg_session` (text, nullable, criptografado — guarda o `sessionString` do gramjs)
- `tg_phone_code_hash` (text, nullable, temporário durante login)

### Secrets do projeto
- `USERBOT_API_URL` — URL pública do seu serviço (ex: `https://tg-userbot.up.railway.app`)
- `USERBOT_TOKEN` — token de auth compartilhado

### Server functions novas (`src/lib/premium-account.functions.ts`)
- `requestPremiumCode({ accountId })` — chama `/auth/send-code`, salva `phone_code_hash`.
- `confirmPremiumCode({ accountId, code, password? })` — chama `/auth/sign-in`, salva `tg_session`, marca `status = 'ok'`.
- `syncPremiumEmojis({ accountId })` — chama `/emojis/list`, faz upsert em `premium_emojis`.
- `sendPremiumMessage({ accountId, chatId, text })` — chama `/messages/send`.

### UI — `src/routes/_authenticated/telegram-accounts.tsx`
Quando `accountType === 'premium'`, o Dialog vira o layout do print:
- Banner azul "Como conectar sua conta Telegram" com passo a passo.
- 4 inputs em grid 2x2: Nome da Conta, Telefone, API ID, API Hash.
- Botão **"Solicitar Código"** (em vez de Salvar).
- Após receber código, dialog troca para tela "Digite o código recebido no Telegram" + input de 5 dígitos + (opcional) senha 2FA + botão **"Conectar"**.
- Após conectar com sucesso, mostra toast "Conta conectada" + dispara `syncPremiumEmojis` automaticamente.

Card da conta premium ganha botão extra: **"Sincronizar emojis"**.

A página `Premium Emojis` já existe e vai listar o que foi sincronizado automaticamente.

---

## O que você precisa fazer

1. Aprovar este plano.
2. Após eu entregar, hospedar o serviço `tg-userbot` (te passo o `git clone` + 3 comandos pro Railway).
3. Colar `USERBOT_API_URL` e `USERBOT_TOKEN` quando eu pedir os secrets.
4. Em `my.telegram.org`, gerar API ID + API Hash (já está no banner da tela).

Depois disso, na UI: tipo "Premium" → preencher os 4 campos → "Solicitar Código" → digitar o código que chega no Telegram → conta conectada e emojis sincronizados.

---

## Notas técnicas

- `tg_api_hash` e `tg_session` são salvos em texto puro num primeiro momento (RLS já protege por `user_id`). Se quiser cifragem adicional via `pgcrypto`, posso adicionar num segundo passo.
- 2FA (senha de nuvem) é suportado: se o sign-in retornar `SESSION_PASSWORD_NEEDED`, a UI pede a senha e re-tenta.
- `phone_code_hash` expira em ~5 min no Telegram; se expirar, usuário clica "Solicitar Código" de novo.
- O serviço externo é stateless por requisição (sessão vai e volta como string), então pode escalar / reiniciar sem perder login.