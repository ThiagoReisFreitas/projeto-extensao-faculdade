-- Views de agregacao para o dashboard. Frontend so plota, nao soma.

-- Fluxo de caixa diario. (versao corrigida: o FULL OUTER JOIN por data do
-- documento produz linhas duplicadas quando ha varias receitas/gastos no mesmo dia)
CREATE VIEW vw_fluxo_diario AS
WITH dias AS (
  SELECT data FROM receitas
  UNION SELECT data FROM gastos
  UNION SELECT data FROM pagamentos_funcionarios
)
SELECT
  d.data,
  COALESCE((SELECT SUM(valor_liquido) FROM receitas r WHERE r.data = d.data), 0) AS total_receita_liquida,
  COALESCE((SELECT SUM(valor_bruto)   FROM receitas r WHERE r.data = d.data), 0) AS total_receita_bruta,
  COALESCE((SELECT SUM(valor_taxa)    FROM receitas r WHERE r.data = d.data), 0) AS total_taxas,
  COALESCE((SELECT SUM(valor)         FROM gastos   g WHERE g.data = d.data), 0) AS total_gasto,
  COALESCE((SELECT SUM(valor)         FROM pagamentos_funcionarios p WHERE p.data = d.data), 0) AS total_folha,
  COALESCE((SELECT SUM(valor_liquido) FROM receitas r WHERE r.data = d.data), 0)
    - COALESCE((SELECT SUM(valor)     FROM gastos   g WHERE g.data = d.data), 0)
    - COALESCE((SELECT SUM(valor)     FROM pagamentos_funcionarios p WHERE p.data = d.data), 0) AS saldo
FROM dias d
ORDER BY d.data;

CREATE VIEW vw_receita_por_operadora AS
SELECT o.nome AS operadora, r.data,
       SUM(r.valor_bruto)   AS bruto,
       SUM(r.valor_taxa)    AS taxa,
       SUM(r.valor_liquido) AS liquido
FROM receitas r
JOIN operadoras_cartao o ON o.id = r.operadora_id
GROUP BY o.nome, r.data;

CREATE VIEW vw_gasto_por_categoria AS
SELECT c.nome AS categoria, g.data, SUM(g.valor) AS total
FROM gastos g
JOIN categorias_gasto c ON c.id = g.categoria_id
GROUP BY c.nome, g.data;

CREATE VIEW vw_folha_por_vinculo AS
SELECT tipo_vinculo_snapshot AS tipo_vinculo, data, SUM(valor) AS total
FROM pagamentos_funcionarios
GROUP BY tipo_vinculo_snapshot, data;
