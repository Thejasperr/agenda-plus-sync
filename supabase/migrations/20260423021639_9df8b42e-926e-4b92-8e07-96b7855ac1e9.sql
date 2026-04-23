
-- 1) Remove os duplicados sem 55 (mantém o que já tem 55)
DELETE FROM public.clientes
WHERE id IN (
  'f1583b57-9900-4012-b633-01f6944e3b2b', -- Duda Biazotti (sem 55)
  '01b61e8a-aee8-4e3d-a6dc-83e8602f4c50', -- Maria Fernanda Avila (sem 55)
  '2083b295-9a75-42f5-a0c7-0542041407bb'  -- Cacilda (sem 55)
);

-- 2) Adiciona prefixo 55 a todos os números válidos restantes que não têm
UPDATE public.clientes
SET telefone = '55' || regexp_replace(telefone, '\D', '', 'g')
WHERE
  length(regexp_replace(telefone, '\D', '', 'g')) IN (10, 11)
  AND regexp_replace(telefone, '\D', '', 'g') !~ '^0+$';
