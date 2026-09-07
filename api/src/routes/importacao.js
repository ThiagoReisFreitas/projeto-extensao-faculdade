import express from 'express';
import multer from 'multer';
import { q, pool } from '../db.js';
import { HttpError, ah } from '../http.js';
import { calcTaxa } from '../taxa.js';
import { assertDiaAberto } from '../fechamento.js';
import { detectarColunas, montarLinhas, parseCsv, CAMPOS } from '../importacao.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES) || 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = /csv|text\/plain|excel|octet-stream/i.test(file.mimetype) || /\.csv$/i.test(file.originalname);
    cb(ok ? null : new HttpError(400, 'envie um arquivo .csv'), ok);
  },
});

const TIPOS = ['receitas', 'gastos', 'pagamentos'];
const r = express.Router();

const validaTipo = (req, _res, next) =>
  (TIPOS.includes(req.params.tipo) ? next() : next(new HttpError(400, 'tipo invalido')));

// passo 1: le o CSV e devolve colunas + amostra pra montar o mapeamento na tela
r.post('/:tipo/preview', validaTipo, upload.single('arquivo'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'arquivo .csv obrigatorio (campo "arquivo")');
  try {
    res.json(detectarColunas(req.file.buffer));
  } catch (e) {
    throw new HttpError(400, `nao consegui ler o CSV: ${e.message}`);
  }
}));

async function carregarDicionarios() {
  const [cat, forma, op, fn] = await Promise.all([
    q('SELECT id, nome FROM categorias_gasto'),
    q('SELECT id, nome, requer_operadora, tipo_taxa FROM formas_pagamento'),
    q('SELECT id, nome, taxa_debito, taxa_credito_vista, taxa_credito_parcelado FROM operadoras_cartao'),
    q('SELECT id, nome, tipo_vinculo FROM funcionarios'),
  ]);
  return { categorias: cat.rows, formas: forma.rows, operadoras: op.rows, funcionarios: fn.rows };
}

const DEFAULT_KEY = { forma_pagamento: 'forma_default_id', categoria: 'categoria_default_id', funcionario: 'funcionario_default_id' };

// passo 2: valida tudo e, se nao houver erro nenhum, insere em transacao (tudo ou nada).
r.post('/:tipo', validaTipo, upload.single('arquivo'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'arquivo .csv obrigatorio (campo "arquivo")');
  const { tipo } = req.params;

  let mapa; let opcoes;
  try {
    mapa = JSON.parse(req.body.mapa || '{}');
    opcoes = JSON.parse(req.body.opcoes || '{}');
  } catch { throw new HttpError(400, 'mapa/opcoes invalidos (esperado JSON)'); }

  for (const campo of CAMPOS[tipo].obrigatorios) {
    const temDefault = DEFAULT_KEY[campo] && opcoes[DEFAULT_KEY[campo]];
    if (!mapa[campo] && !temDefault) throw new HttpError(400, `mapeie uma coluna para "${campo}"`);
  }

  let linhasCsv;
  try { linhasCsv = parseCsv(req.file.buffer); }
  catch (e) { throw new HttpError(400, `nao consegui ler o CSV: ${e.message}`); }
  if (!linhasCsv.length) throw new HttpError(400, 'CSV sem linhas de dados');
  if (linhasCsv.length > 5000) throw new HttpError(413, 'CSV muito grande — divida em blocos de ate 5000 linhas');

  const dicionarios = await carregarDicionarios();
  const { linhas, erros } = montarLinhas({ tipo, linhasCsv, mapa, opcoes, dicionarios });

  if (erros.length) return res.status(422).json({ inseridos: 0, erros });

  // um check de dia-fechado por data distinta (nao por linha)
  for (const dia of new Set(linhas.map((l) => l.data))) await assertDiaAberto(dia);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const l of linhas) {
      if (tipo === 'receitas') {
        const forma = dicionarios.formas.find((f) => f.id === l.forma_pagamento_id);
        const operadora = l.operadora_id ? dicionarios.operadoras.find((o) => o.id === l.operadora_id) : null;
        const { valorTaxa, valorLiquido } = calcTaxa({ valorBruto: l.valor_bruto, forma, operadora });
        await client.query(
          `INSERT INTO receitas
             (data, valor_bruto, forma_pagamento_id, operadora_id, valor_taxa, valor_liquido, usuario_id, observacao)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [l.data, l.valor_bruto, l.forma_pagamento_id, l.operadora_id, valorTaxa, valorLiquido, req.user.id, l.observacao],
        );
      } else if (tipo === 'gastos') {
        await client.query(
          'INSERT INTO gastos (data, valor, categoria_id, descricao, usuario_id) VALUES ($1,$2,$3,$4,$5)',
          [l.data, l.valor, l.categoria_id, l.descricao, req.user.id],
        );
      } else {
        await client.query(
          `INSERT INTO pagamentos_funcionarios
             (funcionario_id, data, valor, periodo_referencia, tipo_vinculo_snapshot, usuario_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [l.funcionario_id, l.data, l.valor, l.periodo_referencia, l.tipo_vinculo_snapshot, req.user.id],
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e instanceof HttpError ? e : new HttpError(400, e.message);
  } finally {
    client.release();
  }

  res.status(201).json({ inseridos: linhas.length, erros: [] });
}));

export default r;
