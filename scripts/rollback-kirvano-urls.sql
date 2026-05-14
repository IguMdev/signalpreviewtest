-- Rollback: restaura kirvano_checkout_url anterior (NULL) para os planos
-- de bots atualizados em 2026-05-14. Execute via supabase--insert se precisar reverter.
UPDATE public.engagement_plans
SET kirvano_checkout_url = NULL
WHERE slug IN (
  'inscritos-500','inscritos-1000','inscritos-3000',
  'interacoes-10','interacoes-20','interacoes-50','interacoes-100',
  'boasvindas-mensal','encaminhador-mensal'
);