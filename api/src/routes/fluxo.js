import express from 'express';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { dataValida } from '../validacao.js';

const r = express.Router();

// range padrao: ultimos 30 dias
function range(req) {
  const ate = req.query.ate || new Date().toISOString().slice(0, 10);
  const de = req.query.de ||
    new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  if (!dataValida(de) || !dataValida(ate)) throw new HttpError(400, 'periodo invalido (use AAAA-MM-DD)');
  return { de, ate };
}

r.get('/diario', ah(async (req, res) => {
  const { de, ate } = range(req);
  const { rows } = await q(
    'SELECT * FROM vw_fluxo_diario WHERE data BETWEEN $1 AND $2 ORDER BY data', [de, ate],
  );
  res.json(rows);
}));

r.get('/operadora', ah(async (req, res) => {
  const { de, ate } = range(req);
  const { rows } = await q(
    `SELECT operadora, SUM(bruto) AS bruto, SUM(taxa) AS taxa, SUM(liquido) AS liquido
     FROM vw_receita_por_operadora WHERE data BETWEEN $1 AND $2 GROUP BY operadora ORDER BY liquido DESC`,
    [de, ate],
  );
  res.json(rows);
}));

r.get('/categoria', ah(async (req, res) => {
  const { de, ate } = range(req);
  const { rows } = await q(
    `SELECT categoria, SUM(total) AS total
     FROM vw_gasto_por_categoria WHERE data BETWEEN $1 AND $2 GROUP BY categoria ORDER BY total DESC`,
    [de, ate],
  );
  res.json(rows);
}));

r.get('/folha', ah(async (req, res) => {
  const { de, ate } = range(req);
  const { rows } = await q(
    `SELECT tipo_vinculo, SUM(total) AS total
     FROM vw_folha_por_vinculo WHERE data BETWEEN $1 AND $2 GROUP BY tipo_vinculo ORDER BY total DESC`,
    [de, ate],
  );
  res.json(rows);
}));

r.get('/resumo', ah(async (req, res) => {
  const { de, ate } = range(req);
  const { rows } = await q(
    `SELECT
       COALESCE(SUM(total_receita_liquida),0) AS receita_liquida,
       COALESCE(SUM(total_receita_bruta),0)   AS receita_bruta,
       COALESCE(SUM(total_taxas),0)           AS taxas,
       COALESCE(SUM(total_gasto),0)           AS gasto,
       COALESCE(SUM(total_folha),0)           AS folha,
       COALESCE(SUM(saldo),0)                 AS saldo
     FROM vw_fluxo_diario WHERE data BETWEEN $1 AND $2`, [de, ate],
  );
  res.json({ de, ate, ...rows[0] });
}));

// RF21: exportacao CSV do fluxo diario
r.get('/export.csv', ah(async (req, res) => {
  const { de, ate } = range(req);
  const { rows } = await q(
    'SELECT * FROM vw_fluxo_diario WHERE data BETWEEN $1 AND $2 ORDER BY data', [de, ate],
  );
  const cols = ['data', 'total_receita_bruta', 'total_receita_liquida', 'total_taxas', 'total_gasto', 'total_folha', 'saldo'];
  const linhas = [cols.join(';')];
  for (const row of rows) {
    linhas.push(cols.map((c) => {
      const v = row[c];
      return v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '');
    }).join(';'));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="fluxo_${de}_a_${ate}.csv"`);
  res.send(linhas.join('\n'));
}));

export default r;
