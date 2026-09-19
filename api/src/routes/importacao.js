import express from 'express';
import multer from 'multer';
import { q, pool } from '../db.js';
import { HttpError, ah } from '../http.js';
import { calcTaxa } from '../taxa.js';
import { assertDiaAberto } from '../fechamento.js';
import { detectarColunas, montarLinhas, lerPlanilha, CAMPOS } from '../importacao.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES) || 2 * 1024 * 1024 },
  // so extensao do nome (mimetype e' client-controlled e nao vale nada aqui;
  // "OR mimetype contem octet-stream" deixava passar QUALQUER arquivo, exe
  // incluido, porque octet-stream e' o generico que navegador/curl usam pra
  // binario desconhecido — testado ao vivo, um .exe passava no filtro).
  fileFilter(_req, file, cb) {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    cb(ok ? null : new HttpError(400, 'envie um arquivo .csv, .xlsx ou .xls'), ok);
  },
});

const TIPOS = ['receitas', 'gastos', 'pagamentos'];
const r = express.Router();

const validaTipo = (req, _res, next) =>
  (TIPOS.includes(req.params.tipo) ? next() : next(new HttpError(400, 'tipo invalido')));

const parseOpcoes = (raw) => {
  try { return JSON.parse(raw || '{}'); } catch { throw new HttpError(400, 'opcoes invalidas (esperado JSON)'); }
};

// passo 1: le a planilha e devolve colunas + amostra + abas + linha do cabecalho.
const LIMITE_LINHAS = 5000;

r.post('/:tipo/preview', validaTipo, upload.single('arquivo'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'arquivo obrigatorio (campo "arquivo")');
  const opcoes = parseOpcoes(req.body.opcoes);
  let resultado;
  try {
    resultado = await detectarColunas(req.file.buffer, req.file.originalname, opcoes);
  } catch (e) {
    throw new HttpError(400, `nao consegui ler a planilha: ${e.message}`);
  }
  // mesmo limite do passo de import — avisa antes do usuario investir tempo mapeando.
  if (resultado.total > LIMITE_LINHAS) {
    throw new HttpError(413, `planilha muito grande (${resultado.total} linhas) — divida em blocos de ate ${LIMITE_LINHAS} linhas`);
  }
  res.json(resultado);
}));

// so entidades ativas -> mesma regra do lancamento manual (routes/receitas.js,
// carregarFormaOperadora), senao o import consegue lancar contra uma operadora/
// forma ja desativada, coisa que o form manual bloqueia.
async function carregarDicionarios() {
  const [cat, forma, op, fn] = await Promise.all([
    q('SELECT id, nome FROM categorias_gasto WHERE ativo = true'),
    q('SELECT id, nome, requer_operadora, tipo_taxa FROM formas_pagamento WHERE ativo = true'),
    q('SELECT id, nome, taxa_debito, taxa_credito_vista, taxa_credito_parcelado FROM operadoras_cartao WHERE ativo = true'),
    q('SELECT id, nome, tipo_vinculo FROM funcionarios WHERE ativo = true'),
  ]);
  return { categorias: cat.rows, formas: forma.rows, operadoras: op.rows, funcionarios: fn.rows };
}

const DEFAULT_KEY = { forma_pagamento: 'forma_default_id', categoria: 'categoria_default_id', funcionario: 'funcionario_default_id' };

// mesma (data, valor, chave-de-negocio) ja lancada -> provavel reimportacao do mesmo arquivo.
// so olha as datas presentes no lote, pra nao varrer a tabela inteira.
async function acharDuplicatas(tipo, linhas) {
  const datas = [...new Set(linhas.map((l) => l.data))];
  if (!datas.length) return [];
  const dataStr = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
  if (tipo === 'receitas') {
    const { rows } = await q(
      'SELECT data, valor_bruto, forma_pagamento_id, operadora_id FROM receitas WHERE data = ANY($1) AND estorno_de_id IS NULL',
      [datas],
    );
    return linhas.filter((l) => rows.some((e) => dataStr(e.data) === l.data
      && Number(e.valor_bruto) === l.valor_bruto
      && e.forma_pagamento_id === l.forma_pagamento_id
      && (e.operadora_id || null) === (l.operadora_id || null)));
  }
  if (tipo === 'gastos') {
    const { rows } = await q(
      'SELECT data, valor, categoria_id FROM gastos WHERE data = ANY($1) AND estorno_de_id IS NULL',
      [datas],
    );
    return linhas.filter((l) => rows.some((e) => dataStr(e.data) === l.data
      && Number(e.valor) === l.valor
      && e.categoria_id === l.categoria_id));
  }
  const { rows } = await q(
    'SELECT data, valor, funcionario_id, periodo_referencia FROM pagamentos_funcionarios WHERE data = ANY($1) AND estorno_de_id IS NULL',
    [datas],
  );
  return linhas.filter((l) => rows.some((e) => dataStr(e.data) === l.data
    && Number(e.valor) === l.valor
    && e.funcionario_id === l.funcionario_id
    && (e.periodo_referencia || null) === (l.periodo_referencia || null)));
}

// passo 2: valida tudo e, se nao houver erro nenhum, insere em transacao (tudo ou nada).
r.post('/:tipo', validaTipo, upload.single('arquivo'), ah(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'arquivo obrigatorio (campo "arquivo")');
  const { tipo } = req.params;

  let mapa;
  try { mapa = JSON.parse(req.body.mapa || '{}'); }
  catch { throw new HttpError(400, 'mapa invalido (esperado JSON)'); }
  const opcoes = parseOpcoes(req.body.opcoes);

  // dois campos apontando pra mesma coluna de origem = provavel erro de mapeamento
  // (silencioso pra campos de texto livre, sem isso).
  const colunaDoCampo = {};
  for (const [campo, coluna] of Object.entries(mapa)) {
    if (!coluna) continue;
    if (colunaDoCampo[coluna]) {
      throw new HttpError(400, `"${colunaDoCampo[coluna]}" e "${campo}" nao podem apontar pra mesma coluna ("${coluna}")`);
    }
    colunaDoCampo[coluna] = campo;
  }

  for (const campo of CAMPOS[tipo].obrigatorios) {
    const temDefault = DEFAULT_KEY[campo] && opcoes[DEFAULT_KEY[campo]];
    if (!mapa[campo] && !temDefault) throw new HttpError(400, `mapeie uma coluna para "${campo}"`);
  }

  let linhasCsv;
  try { linhasCsv = await lerPlanilha(req.file.buffer, req.file.originalname, opcoes); }
  catch (e) { throw new HttpError(400, `nao consegui ler a planilha: ${e.message}`); }
  if (!linhasCsv.length) throw new HttpError(400, 'planilha sem linhas de dados');
  if (linhasCsv.length > LIMITE_LINHAS) throw new HttpError(413, `planilha muito grande — divida em blocos de ate ${LIMITE_LINHAS} linhas`);

  const dicionarios = await carregarDicionarios();
  const { linhas, erros, ignoradas, casamentos } = montarLinhas({ tipo, linhasCsv, mapa, opcoes, dicionarios });

  // opcoes.simular = so valida e devolve o diagnostico, nao grava nada.
  if (opcoes.simular) {
    return res.json({ simulado: true, ok: linhas.length, erros, ignoradas, casamentos });
  }

  if (erros.length) return res.status(422).json({ inseridos: 0, erros, ignoradas, casamentos });

  const duplicatas = await acharDuplicatas(tipo, linhas);
  if (duplicatas.length && !opcoes.permitir_duplicados) {
    return res.status(409).json({
      inseridos: 0, erros: [], ignoradas, casamentos,
      duplicatas: duplicatas.map((l) => l.data),
      aviso: `${duplicatas.length} linha(s) parecem ja lancadas antes (mesma data/valor). Reenvie com "opcoes.permitir_duplicados" se for intencional.`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // re-checa dia-fechado dentro da transacao (evita corrida com um fechamento concorrente)
    for (const dia of new Set(linhas.map((l) => l.data))) {
      await assertDiaAberto(dia, (text, params) => client.query(text, params));
    }
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

  res.status(201).json({ inseridos: linhas.length, erros: [], ignoradas, casamentos });
}));

export default r;
