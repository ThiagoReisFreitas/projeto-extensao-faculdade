-- Sistema de Controle Financeiro - O Pensador (PEX)
-- Rodado automaticamente pelo Postgres (docker-entrypoint-initdb.d) no primeiro boot.

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('dono','caixa')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE operadoras_cartao (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  taxa_debito NUMERIC(5,2) NOT NULL DEFAULT 0,
  taxa_credito_vista NUMERIC(5,2) NOT NULL DEFAULT 0,
  taxa_credito_parcelado NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE categorias_gasto (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE formas_pagamento (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  requer_operadora BOOLEAN NOT NULL DEFAULT false,
  -- qual taxa da operadora aplica; 'nenhuma' = sem taxa (dinheiro, PIX, vale)
  tipo_taxa TEXT NOT NULL DEFAULT 'nenhuma'
    CHECK (tipo_taxa IN ('nenhuma','debito','credito_vista','credito_parcelado')),
  ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE funcionarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_vinculo TEXT NOT NULL CHECK (tipo_vinculo IN ('fixo','temporario','diarista')),
  valor_referencia NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- registro existente sem reaberto_em = dia travado para novos lancamentos/edicoes
CREATE TABLE fechamentos_diarios (
  data DATE PRIMARY KEY,
  fechado_por INTEGER NOT NULL REFERENCES usuarios(id),
  fechado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  reaberto_por INTEGER REFERENCES usuarios(id),
  reaberto_em TIMESTAMPTZ
);

-- FATO IMUTAVEL: valor_taxa e valor_liquido calculados no lancamento, nunca recalculados.
CREATE TABLE receitas (
  id SERIAL PRIMARY KEY,
  data DATE NOT NULL,
  valor_bruto NUMERIC(10,2) NOT NULL,
  forma_pagamento_id INTEGER NOT NULL REFERENCES formas_pagamento(id),
  operadora_id INTEGER REFERENCES operadoras_cartao(id),
  valor_taxa NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(10,2) NOT NULL,
  comprovante_path TEXT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  estorno_de_id INTEGER REFERENCES receitas(id),
  motivo_estorno TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_receitas_data ON receitas(data);

CREATE TABLE gastos (
  id SERIAL PRIMARY KEY,
  data DATE NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  categoria_id INTEGER NOT NULL REFERENCES categorias_gasto(id),
  descricao TEXT,
  comprovante_path TEXT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  estorno_de_id INTEGER REFERENCES gastos(id),
  motivo_estorno TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gastos_data ON gastos(data);

-- SNAPSHOT: tipo_vinculo_snapshot guarda o vinculo no momento do pagamento
CREATE TABLE pagamentos_funcionarios (
  id SERIAL PRIMARY KEY,
  funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id),
  data DATE NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  periodo_referencia TEXT,
  tipo_vinculo_snapshot TEXT NOT NULL
    CHECK (tipo_vinculo_snapshot IN ('fixo','temporario','diarista')),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  estorno_de_id INTEGER REFERENCES pagamentos_funcionarios(id),
  motivo_estorno TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pag_data ON pagamentos_funcionarios(data);
