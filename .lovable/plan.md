## Objetivo
Validar end-to-end que conseguimos disparar um pedido real no **n1panel** a partir do app (BotInterações/BotInscritos), com o saldo que você acabou de carregar.

## Estado atual
- `src/lib/engagement.functions.ts` está hardcoded em JAP:
  - URL: `https://justanotherpanel.com/api/v2`
  - Key: `process.env.JAP_API_KEY`
  - Service IDs padrão: `8485` (reações) / `7102` (membros)
- O fluxo já existe: `dispatchEngagementBoost` insere `engagement_orders` → chama painel → atualiza status. Só precisa apontar para o n1panel.

## Plano

### 1. Guardar a chave do n1panel como secret
Adicionar `N1PANEL_API_KEY = 6dc3d1150f5c992cd99a21000a7d121d` via `add_secret` (não commitar no código).
> JAP_API_KEY fica preservada — se quiser voltar/usar como fallback depois, basta um toggle.

### 2. Tornar o provedor configurável (mudança mínima em `engagement.functions.ts`)
- Trocar as constantes no topo do arquivo:
  ```ts
  const SMM_PANEL_URL = process.env.SMM_PANEL_URL || "https://n1panel.com/api/v2";
  const SVC_REACTIONS = Number(process.env.SMM_SERVICE_REACTIONS_ID || "3232");
  const SVC_MEMBERS   = Number(process.env.SMM_SERVICE_MEMBERS_ID   || "3440");
  ```
- Em `callSmmPanel`, ler `process.env.N1PANEL_API_KEY` primeiro, depois `JAP_API_KEY` como fallback.
- Sem mudança em UI, schemas ou tabelas — o contrato da API é idêntico (action=add/status/balance).

### 3. Teste end-to-end (sequência)
1. **Smoke do saldo**: chamar `action=balance` no n1panel via um pequeno utilitário/serverFn pra confirmar que a chave + saldo respondem (> $0).
2. **Disparo real menor possível** — para limitar gasto:
   - **Reações** (svc 3232): quantidade mínima do serviço (geralmente 10–50), apontando para um post público seu em `https://t.me/<seucanal>/<id>`.
     - Custo estimado: ~$0.0007 (≈ R$ 0,004).
   - **Membros** (svc 3440): mínimo do serviço (normalmente 100), apontando para `https://t.me/<seucanal>`.
     - Custo estimado: ~$0.008 (≈ R$ 0,04).
3. **Verificações**:
   - Linha em `engagement_orders` com `status=in_progress` e `smm_order_id` preenchido.
   - `action=status` no n1panel devolve progresso real.
   - Contagem de reações/membros no canal sobe nos próximos minutos.

### 4. Pré-requisitos que preciso de você antes de implementar
- **Link público do canal** que posso usar para o teste (precisa de @username público — joinchat/+hash não funciona).
- **Para reações**: o `message_id` (ou link completo do post) onde quer ver as reações.
- Confirmar se o BotInterações/BotInscritos já tem **assinatura ativa** na sua conta (o `dispatchEngagementBoost` exige); senão preciso inserir manualmente uma subscription de teste com cota suficiente.

### 5. Rollback
Se algo falhar, definir `SMM_PANEL_URL` de volta pra `https://justanotherpanel.com/api/v2` + usar `JAP_API_KEY` (já preservado no fallback). Zero migração de dados.

---

**Próximo passo**: assim que você me passar o link do canal + post de teste e confirmar a subscription, eu (a) registro o secret, (b) aplico as 3 linhas no `engagement.functions.ts`, (c) rodo o smoke de saldo e o disparo real e te mostro os resultados das tabelas.