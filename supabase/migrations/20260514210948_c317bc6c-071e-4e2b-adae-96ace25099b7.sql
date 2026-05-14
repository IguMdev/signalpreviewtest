UPDATE public.engagement_plans SET kirvano_checkout_url = CASE slug
  WHEN 'inscritos-500' THEN 'https://pay.kirvano.com/b01958b8-e48e-45c2-9b65-d5bd2dc1017e'
  WHEN 'inscritos-1000' THEN 'https://pay.kirvano.com/5bb5d3fb-c087-4e8b-aff6-c1d875bba914'
  WHEN 'inscritos-3000' THEN 'https://pay.kirvano.com/2bc75309-9435-4a3a-96aa-707fe39716dd'
  WHEN 'interacoes-10' THEN 'https://pay.kirvano.com/581345ed-9c69-4f23-944b-70d266b0c0b5'
  WHEN 'interacoes-20' THEN 'https://pay.kirvano.com/b2400e2c-bfc4-4312-9961-b450758928e4'
  WHEN 'interacoes-50' THEN 'https://pay.kirvano.com/9a685633-f0c5-408a-8693-cc853639f0af'
  WHEN 'interacoes-100' THEN 'https://pay.kirvano.com/52891f48-d864-49ac-9364-b322ef66f11d'
  WHEN 'boasvindas-mensal' THEN 'https://pay.kirvano.com/fe152c84-bbce-40f8-9496-36f9ef3cb5a1'
  WHEN 'encaminhador-mensal' THEN 'https://pay.kirvano.com/80355f5a-217e-449e-babd-cf6a7faa4105'
END
WHERE slug IN ('inscritos-500','inscritos-1000','inscritos-3000','interacoes-10','interacoes-20','interacoes-50','interacoes-100','boasvindas-mensal','encaminhador-mensal');