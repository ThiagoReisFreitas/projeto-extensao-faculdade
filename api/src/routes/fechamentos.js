import express from 'express';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { somenteDono } from '../auth.js';
import { dataValida } from '../validacao.js';

const r = express.Router();

r.get('/', ah(async (req, res) => {
  const { de, ate } = req.query;
  const cond = [];
  const vals = [];
  if (de) { vals.push(de); cond.push(`data >= $${vals.length}`); }
  if (ate) { vals.push(ate); cond.push(`data <= $${vals.length}`); }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const { rows } = await q(`SELECT * FROM fechamentos_diarios ${where} ORDER BY data DESC`, vals);
  res.json(rows);
}));

// status de um dia especifico
r.get('/:data', ah(async (req, res) => {
  if (!dataValida(req.params.data)) throw new HttpError(400, 'data invalida');
  const { rows } = await q('SELECT * FROM fechamentos_diarios WHERE data = $1', [req.params.data]);
  const f = rows[0];
  res.json({ data: req.params.data, fechado: !!(f && f.reaberto_em === null), registro: f || null });
}));

// fechar dia: Dono ou Caixa
r.post('/', ah(async (req, res) => {
  const { data, conferencia } = req.body || {};
  if (!data) throw new HttpError(400, 'data obrigatoria');
  if (!dataValida(data)) throw new HttpError(400, 'data invalida');
  const conf = conferencia ? JSON.stringify(conferencia) : null;
  const { rows: ex } = await q('SELECT * FROM fechamentos_diarios WHERE data = $1', [data]);
  if (ex.length && ex[0].reaberto_em === null) throw new HttpError(409, 'dia ja esta fechado');
  if (ex.length) {
    const { rows } = await q(
      `UPDATE fechamentos_diarios SET fechado_por=$1, fechado_em=now(), reaberto_por=NULL, reaberto_em=NULL, conferencia=$3
       WHERE data=$2 RETURNING *`, [req.user.id, data, conf],
    );
    return res.json(rows[0]);
  }
  const { rows } = await q(
    `INSERT INTO fechamentos_diarios (data, fechado_por, conferencia) VALUES ($1,$2,$3) RETURNING *`,
    [data, req.user.id, conf],
  );
  res.status(201).json(rows[0]);
}));

// reabrir: somente Dono (CLAUDE.md)
r.post('/:data/reabrir', somenteDono, ah(async (req, res) => {
  if (!dataValida(req.params.data)) throw new HttpError(400, 'data invalida');
  const { rows } = await q(
    `UPDATE fechamentos_diarios SET reaberto_por=$1, reaberto_em=now()
     WHERE data=$2 AND reaberto_em IS NULL RETURNING *`,
    [req.user.id, req.params.data],
  );
  if (!rows.length) throw new HttpError(404, 'nao ha dia fechado nessa data');
  res.json(rows[0]);
}));

export default r;
