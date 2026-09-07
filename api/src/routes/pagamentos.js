import express from 'express';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { somenteDono } from '../auth.js';
import { assertDiaAberto } from '../fechamento.js';
import { dataNaoFutura } from '../validacao.js';

const r = express.Router();

const SELECT_JOIN = `
  SELECT p.*, fn.nome AS funcionario_nome, u.nome AS usuario_nome
  FROM pagamentos_funcionarios p
  JOIN funcionarios fn ON fn.id = p.funcionario_id
  LEFT JOIN usuarios u ON u.id = p.usuario_id`;

r.get('/', ah(async (req, res) => {
  const { de, ate } = req.query;
  const cond = [];
  const vals = [];
  if (de) { vals.push(de); cond.push(`p.data >= $${vals.length}`); }
  if (ate) { vals.push(ate); cond.push(`p.data <= $${vals.length}`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await q(`${SELECT_JOIN} ${where} ORDER BY p.data DESC, p.id DESC`, vals);
  res.json(rows);
}));

r.post('/', ah(async (req, res) => {
  const { funcionario_id, data, valor, periodo_referencia } = req.body || {};
  if (!funcionario_id || !data || !(Number(valor) > 0)) throw new HttpError(400, 'funcionario_id, data e valor (>0) obrigatorios');
  if (!dataNaoFutura(data)) throw new HttpError(400, 'data invalida ou no futuro');
  await assertDiaAberto(data);
  const { rows: fr } = await q('SELECT * FROM funcionarios WHERE id = $1', [funcionario_id]);
  if (!fr.length) throw new HttpError(400, 'funcionario invalido');
  const { rows } = await q(
    `INSERT INTO pagamentos_funcionarios
       (funcionario_id, data, valor, periodo_referencia, tipo_vinculo_snapshot, usuario_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [funcionario_id, data, valor, periodo_referencia || null, fr[0].tipo_vinculo, req.user.id],
  );
  res.status(201).json(rows[0]);
}));

r.post('/:id/estorno', somenteDono, ah(async (req, res) => {
  const { motivo } = req.body || {};
  if (!motivo) throw new HttpError(400, 'motivo do estorno obrigatorio');
  const { rows: cur } = await q('SELECT * FROM pagamentos_funcionarios WHERE id = $1', [req.params.id]);
  if (!cur.length) throw new HttpError(404, 'pagamento nao encontrado');
  const o = cur[0];
  if (o.estorno_de_id) throw new HttpError(400, 'nao e possivel estornar um estorno');
  await assertDiaAberto(o.data);
  const { rows: ja } = await q('SELECT id FROM pagamentos_funcionarios WHERE estorno_de_id = $1', [o.id]);
  if (ja.length) throw new HttpError(409, 'pagamento ja estornado');
  const { rows } = await q(
    `INSERT INTO pagamentos_funcionarios
       (funcionario_id, data, valor, periodo_referencia, tipo_vinculo_snapshot, usuario_id, estorno_de_id, motivo_estorno)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [o.funcionario_id, o.data, -o.valor, `estorno do pagamento #${o.id}`, o.tipo_vinculo_snapshot, req.user.id, o.id, motivo],
  );
  res.status(201).json(rows[0]);
}));

export default r;
