-- Cadastro inicial simples. O Dono ajusta tudo depois na tela de Configuracoes.
-- Taxas abaixo sao PLACEHOLDER (pendencia secao 5/10 do doc de requisitos).

INSERT INTO operadoras_cartao (nome, taxa_debito, taxa_credito_vista, taxa_credito_parcelado) VALUES
  ('Stone', 1.30, 2.50, 3.50),
  ('Cielo', 1.40, 2.80, 3.80),
  ('Rede',  1.35, 2.70, 3.70);

INSERT INTO formas_pagamento (nome, requer_operadora, tipo_taxa) VALUES
  ('Dinheiro',          false, 'nenhuma'),
  ('PIX',               false, 'nenhuma'),
  ('Vale-refeicao',     false, 'nenhuma'),
  ('Debito',            true,  'debito'),
  ('Credito a vista',   true,  'credito_vista'),
  ('Credito parcelado', true,  'credito_parcelado');

INSERT INTO categorias_gasto (nome) VALUES
  ('Insumos'), ('Aluguel'), ('Energia'), ('Manutencao'), ('Gas'), ('Outros');
