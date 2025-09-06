-- Adicionar campo percentual_acrescimo para formas de pagamento
ALTER TABLE public.formas_pagamento 
ADD COLUMN percentual_acrescimo NUMERIC DEFAULT 0 CHECK (percentual_acrescimo >= 0 AND percentual_acrescimo <= 100);

-- Adicionar campo forma_pagamento para transacoes  
ALTER TABLE public.transacoes 
ADD COLUMN forma_pagamento TEXT;