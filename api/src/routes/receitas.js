import express from 'express';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { somenteDono } from '../auth.js';
import { calcTaxa } from '../taxa.js';
import { assertDiaAberto } from '../fechamento.js';
import { dataNaoFutura, comprovantePathValido } from '../validacao.js';

const r = express.Router();

const SELECT_JOIN = `
  SELECT r.*, f.nome AS forma_pagamento_nome, o.nome AS operadora_nome, u.nome AS usuario_nome
  FROM receitas r
  JOIN formas_pagamento f ON f.id = r.forma_pagamento_id
  LEFT JOIN operadoras_cartao o ON o.id = r.operadora_id
  LEFT JOIN usuarios u ON u.id = r.usuario_id`;

r.get('/', ah(async (req, res) => {
  const { de, ate } = req.query;
  const cond = [];
  const vals = [];
  if (de) { vals.push(de); cond.push(`r.data >= $${vals.length}`); }
  if (ate) { vals.push(ate); cond.push(`r.data <= $${vals.length}`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await q(`${SELECT_JOIN} ${where} ORDER BY r.data DESC, r.id DESC`, vals);
  res.json(rows);
}));

async function carregarFormaOperadora(forma_pagamento_id, operadora_id) {
  const { rows: fr } = await q('SELECT * FROM formas_pagamento WHERE id = $1 AND ativo = true', [forma_pagamento_id]);
  if (!fr.length) throw new HttpError(400, 'forma de pagamento invalida ou inativa');
  let operadora = null;
  if (operadora_id) {
    const { rows: or } = await q('SELECT * FROM operadoras_cartao WHERE id = $1 AND ativo = true', [operadora_id]);
    if (!or.length) throw new HttpError(400, 'operadora invalida ou inativa');
    operadora = or[0];
  }
  return { forma: fr[0], operadora };
}

r.post('/', ah(async (req, res) => {
  const { data, valor_bruto, forma_pagamento_id, operadora_id, comprovante_path, observacao } = req.body || {};
  if (!data || !forma_pagamento_id) throw new HttpError(400, 'data e forma_pagamento_id obrigatorios');
  if (!dataNaoFutura(data)) throw new HttpError(400, 'data invalida ou no futuro');
  if (comprovante_path && !comprovantePathValido(comprovante_path)) throw new HttpError(400, 'comprovante_path invalido');
  await assertDiaAberto(data);
  const { forma, operadora } = await carregarFormaOperadora(forma_pagamento_id, operadora_id);
  const { valorTaxa, valorLiquido } = calcTaxa({ valorBruto: valor_bruto, forma, operadora });
  const { rows } = await q(
    `INSERT INTO receitas
       (data, valor_bruto, forma_pagamento_id, operadora_id, valor_taxa, valor_liquido, comprovante_path, usuario_id, observacao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data, valor_bruto, forma_pagamento_id, operadora?.id || null, valorTaxa, valorLiquido, comprovante_path || null, req.user.id, observacao || null],
  );
  res.status(201).json(rows[0]);
}));

// edicao: so Dono (doc 8.1). Recalcula taxa (fato re-registrado no ato da correcao).
r.put('/:id', somenteDono, ah(async (req, res) => {
  const { rows: cur } = await q('SELECT * FROM receitas WHERE id = $1', [req.params.id]);
  if (!cur.length) throw new HttpError(404, 'receita nao encontrada');
  if (cur[0].estorno_de_id) throw new HttpError(400, 'lancamento de estorno nao pode ser editado');
  if (req.body.data !== undefined && !dataNaoFutura(req.body.data)) throw new HttpError(400, 'data invalida ou no futuro');
  const b = { ...cur[0], ...req.body };
  await assertDiaAberto(cur[0].data);
  await assertDiaAberto(b.data);
  const { forma, operadora } = await carregarFormaOperadora(b.forma_pagamento_id, b.operadora_id);
  const { valorTaxa, valorLiquido } = calcTaxa({ valorBruto: b.valor_bruto, forma, operadora });
  const { rows } = await q(
    `UPDATE receitas SET data=$1, valor_bruto=$2, forma_pagamento_id=$3, operadora_id=$4,
       valor_taxa=$5, valor_liquido=$6, observacao=$7 WHERE id=$8 RETURNING *`,
    [b.data, b.valor_bruto, b.forma_pagamento_id, operadora?.id || null, valorTaxa, valorLiquido, b.observacao || null, req.params.id],
  );
  res.json(rows[0]);
}));

// correcao de erro = estorno vinculado (RF20), nao exclusao. So o Dono corrige (doc 8.1).
r.post('/:id/estorno', somenteDono, ah(async (req, res) => {
  const { motivo } = req.body || {};
  if (!motivo) throw new HttpError(400, 'motivo do estorno obrigatorio');
  const { rows: cur } = await q('SELECT * FROM receitas WHERE id = $1', [req.params.id]);
  if (!cur.length) throw new HttpError(404, 'receita nao encontrada');
  const o = cur[0];
  if (o.estorno_de_id) throw new HttpError(400, 'nao e possivel estornar um estorno');
  await assertDiaAberto(o.data);
  const { rows: ja } = await q('SELECT id FROM receitas WHERE estorno_de_id = $1', [o.id]);
  if (ja.length) throw new HttpError(409, 'receita ja estornada');
  const { rows } = await q(
    `INSERT INTO receitas
       (data, valor_bruto, forma_pagamento_id, operadora_id, valor_taxa, valor_liquido, usuario_id, estorno_de_id, motivo_estorno, observacao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [o.data, -o.valor_bruto, o.forma_pagamento_id, o.operadora_id, -o.valor_taxa, -o.valor_liquido, req.user.id, o.id, motivo, `estorno da receita #${o.id}`],
  );
  res.status(201).json(rows[0]);
}));

export default r;
