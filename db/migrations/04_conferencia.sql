-- Conferencia de fechamento (RF19 + spec secao 5): valor no sistema x valor conferido.
ALTER TABLE fechamentos_diarios ADD COLUMN IF NOT EXISTS conferencia JSONB;

-- categoria fixa para registrar quebra de caixa apurada no fechamento
INSERT INTO categorias_gasto (nome)
SELECT 'Quebra de caixa'
WHERE NOT EXISTS (SELECT 1 FROM categorias_gasto WHERE nome = 'Quebra de caixa');
