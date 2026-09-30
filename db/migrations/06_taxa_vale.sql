-- Vale-refeicao/alimentacao cobra taxa propria (Alelo, Pluxee, Ticket, VR).
-- Idempotente: pode rodar a mao num banco ja existente sem perder dados.
ALTER TABLE operadoras_cartao
  ADD COLUMN IF NOT EXISTS taxa_vale NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE formas_pagamento DROP CONSTRAINT IF EXISTS formas_pagamento_tipo_taxa_check;
ALTER TABLE formas_pagamento ADD CONSTRAINT formas_pagamento_tipo_taxa_check
  CHECK (tipo_taxa IN ('nenhuma','debito','credito_vista','credito_parcelado','vale'));
