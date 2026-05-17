## Objetivo

Reorganizar o Trackeamento atual (1 rota com tabs internas) em **7 seções independentes no menu lateral**, no estilo Track4You. Cada seção tem sua própria página com filtro por pixel no topo.

## Nova estrutura do menu

Criar um grupo colapsável "Trackeamento" no sidebar (substituindo o item único atual):

```text
📊 Trackeamento
   ├── 🌐 Domínios
   ├── </> Pixels
   ├── ✈️  Canal
   ├── 🔻 Funis
   ├── 📈 Métricas
   ├── 💬 Mensagens     (em breve / locked)
   ├── ↔️  Postbacks
   └── 🔗 Integrações
```

## Rotas a criar

| Rota | O que mostra |
|------|--------------|
| `/trackeamento/dominios` | Lista de domínios próprios + botão "Adicionar domínio" (CNAME + verificação DNS) |
| `/trackeamento/pixels` | Lista/CRUD de pixels (migra a tela atual `/trackeamento`) |
| `/trackeamento/canal` | Vincula pixel → bot do Telegram + sala. Filtro de pixel no topo |
| `/trackeamento/funis` | Ofertas (links de redirect com injeção de `click_id`). Filtro de pixel no topo |
| `/trackeamento/metricas` | Dashboard de funil + atribuição por UTM + logs de cliques. Filtro de pixel no topo |
| `/trackeamento/postbacks` | URLs S2S + logs de postbacks recebidos. Filtro de pixel no topo |
| `/trackeamento/integracoes` | Conexões Meta CAPI, TikTok Events, Google Ads (por enquanto só Meta funcional, resto "em breve") |

A rota antiga `/trackeamento/$pixelId` será **removida** — o drill-down vira filtro global na sidebar.

## Componente de filtro de pixel

Criar `src/components/tracking/PixelFilter.tsx` — dropdown reutilizável no topo de Canal/Funis/Métricas/Postbacks, com estado em URL (`?pixel=<id>`) para deep-link. Inclui opção "Todos os pixels".

## Domínios (nova funcionalidade)

Nova tabela `tracking_domains`:
- `id`, `user_id`, `domain` (ex: `track.seusite.com`), `verification_token`, `verified_at`, `is_active`, `created_at`
- RLS: usuário só vê os próprios
- Fluxo: usuário adiciona domínio → mostramos CNAME que ele deve apontar para nosso host → endpoint verifica DNS → marca como `verified_at`
- Server fns: `listDomains`, `createDomain`, `verifyDomain`, `deleteDomain`
- Server route público `/api/public/track/verify-domain/:token` retorna o token (usado pelo DNS resolver server-side)
- Quando um domínio está verificado, helper `getRedirectBase(userId)` em `tracking.server.ts` retorna `https://<domínio>` no lugar do host padrão. Os endpoints `/g/:clickId/:offerSlug` e o snippet usam essa base

> Observação: a verificação real de DNS via TXT/CNAME usa `dns.resolveTxt` do Node (suportado no runtime). Sem SSL automático nesta fase — o usuário precisa apontar via Cloudflare (proxy) ou aceitar HTTP. Posso adicionar uma nota no UI.

## Sidebar (`src/routes/_authenticated.tsx`)

- Remover o item solitário "Trackeamento" do array `connectionItems`
- Adicionar novo grupo `<Collapsible>` "Trackeamento" com 8 subitens (Mensagens fica `disabled` com cadeado)
- Cada subitem usa o mesmo padrão visual dos outros grupos colapsáveis

## Reorganização de código

- `src/routes/_authenticated/trackeamento.index.tsx` → vira `trackeamento.pixels.tsx` (mesmo conteúdo, label muda)
- `trackeamento.index.tsx` redireciona para `/trackeamento/pixels`
- `trackeamento.$pixelId.tsx` é **deletado** — o conteúdo de cada tab é movido para sua nova rota:
  - Tab "Funil" + "Atribuição" + "Logs" → `metricas.tsx`
  - Tab "Ofertas" → `funis.tsx`
  - Tab "Instalação" → seção em `pixels.tsx` (botão "Ver snippet") + duplicado em `integracoes.tsx`
  - Tab "Config" (vínculo bot/sala) → `canal.tsx`
  - URLs S2S → `postbacks.tsx`

## Detalhes técnicos

- Migração SQL: cria `tracking_domains` com RLS
- Novas server fns em `src/lib/tracking.functions.ts`: `listDomains`, `createDomain`, `verifyDomain`, `deleteDomain`
- Atualiza `tracking.server.ts` com `getRedirectBase(userId)` que consulta domínio verificado
- `g.$clickId.$offerSlug.ts` continua funcionando no host padrão; quando o snippet é gerado, usa o domínio próprio se houver
- O `routeTree.gen.ts` é regenerado automaticamente
- Nenhuma quebra de URL existente para tracking público (endpoints `/api/public/track/*` permanecem iguais)

## Ordem de implementação

1. Migração: tabela `tracking_domains`
2. Server fns de domínios + helper `getRedirectBase`
3. Componente `PixelFilter` reutilizável
4. Criar as 7 novas rotas (movendo conteúdo das tabs atuais)
5. Atualizar sidebar com grupo colapsável
6. Deletar `trackeamento.$pixelId.tsx` e ajustar `trackeamento.index.tsx` para redirect
