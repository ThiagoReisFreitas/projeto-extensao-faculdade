import express from 'express';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { somenteDono } from '../auth.js';
import { assertDiaAberto } from '../fechamento.js';
import { dataNaoFutura, comprovantePathValido } from '../validacao.js';

const r = express.Router();

const SELECT_JOIN = `
  SELECT g.*, c.nome AS categoria_nome, u.nome AS usuario_nome
  FROM gastos g
  JOIN categorias_gasto c ON c.id = g.categoria_id
  LEFT JOIN usuarios u ON u.id = g.usuario_id`;

r.get('/', ah(async (req, res) => {
  const { de, ate } = req.query;
  const cond = [];
  const vals = [];
  if (de) { vals.push(de); cond.push(`g.data >= $${vals.length}`); }
  if (ate) { vals.push(ate); cond.push(`g.data <= $${vals.length}`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await q(`${SELECT_JOIN} ${where} ORDER BY g.data DESC, g.id DESC`, vals);
  res.json(rows);
}));

r.post('/', ah(async (req, res) => {
  const { data, valor, categoria_id, descricao, comprovante_path } = req.body || {};
  if (!data || !categoria_id || !(Number(valor) > 0)) throw new HttpError(400, 'data, categoria_id e valor (>0) obrigatorios');
  if (!dataNaoFutura(data)) throw new HttpError(400, 'data invalida ou no futuro');
  if (comprovante_path && !comprovantePathValido(comprovante_path)) throw new HttpError(400, 'comprovante_path invalido');
  await assertDiaAberto(data);
  const { rows } = await q(
    `INSERT INTO gastos (data, valor, categoria_id, descricao, comprovante_path, usuario_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data, valor, categoria_id, descricao || null, comprovante_path || null, req.user.id],
  );
  res.status(201).json(rows[0]);
}));

r.put('/:id', somenteDono, ah(async (req, res) => {
  const { rows: cur } = await q('SELECT * FROM gastos WHERE id = $1', [req.params.id]);
  if (!cur.length) throw new HttpError(404, 'gasto nao encontrado');
  if (cur[0].estorno_de_id) throw new HttpError(400, 'lancamento de estorno nao pode ser editado');
  if (req.body.data !== undefined && !dataNaoFutura(req.body.data)) throw new HttpError(400, 'data invalida ou no futuro');
  const b = { ...cur[0], ...req.body };
  await assertDiaAberto(cur[0].data);
  await assertDiaAberto(b.data);
  const { rows } = await q(
    `UPDATE gastos SET data=$1, valor=$2, categoria_id=$3, descricao=$4 WHERE id=$5 RETURNING *`,
    [b.data, b.valor, b.categoria_id, b.descricao || null, req.params.id],
  );
  res.json(rows[0]);
}));

r.post('/:id/estorno', somenteDono, ah(async (req, res) => {
  const { motivo } = req.body || {};
  if (!motivo) throw new HttpError(400, 'motivo do estorno obrigatorio');
  const { rows: cur } = await q('SELECT * FROM gastos WHERE id = $1', [req.params.id]);
  if (!cur.length) throw new HttpError(404, 'gasto nao encontrado');
  const o = cur[0];
  if (o.estorno_de_id) throw new HttpError(400, 'nao e possivel estornar um estorno');
  await assertDiaAberto(o.data);
  const { rows: ja } = await q('SELECT id FROM gastos WHERE estorno_de_id = $1', [o.id]);
  if (ja.length) throw new HttpError(409, 'gasto ja estornado');
  const { rows } = await q(
    `INSERT INTO gastos (data, valor, categoria_id, descricao, usuario_id, estorno_de_id, motivo_estorno)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [o.data, -o.valor, o.categoria_id, `estorno do gasto #${o.id}`, req.user.id, o.id, motivo],
  );
  res.status(201).json(rows[0]);
}));

export default r;
