// Logica pura da importacao (migracao de base de outro sistema).
// Sem acesso a banco -> testavel isolado. A rota (routes/importacao.js) chama
// estas funcoes e faz os INSERT em transacao.
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

// SSF nao vem no namespace ESM do pacote; fica no default (CJS).
const SSF = XLSX.SSF || (XLSX.default && XLSX.default.SSF);

const RE_PLANILHA = /\.xlsx?$/i;

// Excel pt-BR exporta CSV em latin1; forcamos utf8 e caimos pra latin1 se der lixo.
function decodificarTexto(bufOrStr) {
  if (!Buffer.isBuffer(bufOrStr)) return String(bufOrStr);
  const utf8 = bufOrStr.toString('utf8');
  return utf8.includes('�') ? bufOrStr.toString('latin1') : utf8;
}

// campos que cada tipo aceita. obrigatorio = precisa vir mapeado (ou ter default).
export const CAMPOS = {
  receitas: {
    obrigatorios: ['data', 'valor_bruto', 'forma_pagamento'],
    opcionais: ['operadora', 'observacao'],
  },
  gastos: {
    obrigatorios: ['data', 'valor', 'categoria'],
    opcionais: ['descricao'],
  },
  pagamentos: {
    obrigatorios: ['data', 'valor', 'funcionario'],
    opcionais: ['periodo_referencia'],
  },
};

// sniff do separador na 1a linha nao-vazia (planilha pt-BR costuma usar ';')
function detectarSep(texto) {
  const cab = String(texto).split(/\r?\n/).find((l) => l.trim()) || '';
  const cont = (ch) => (cab.match(new RegExp(`\\${ch}`, 'g')) || []).length;
  const cands = [[';', cont(';')], [',', cont(',')], ['\t', cont('\t')]];
  cands.sort((a, b) => b[1] - a[1]);
  return cands[0][1] > 0 ? cands[0][0] : ',';
}

// SheetJS devolve celula-data como Date em UTC midnight -> ler em UTC evita drift de 1 dia.
const isoData = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

// CSV/XLSX -> { matriz: linha[][], abas: string[] }. Ainda nao interpreta cabecalho.
// opcoes.aba = nome da aba do xlsx (default: a primeira).
function lerMatriz(bufOrStr, nomeArquivo, opcoes = {}) {
  if (RE_PLANILHA.test(nomeArquivo || '')) {
    const wb = XLSX.read(bufOrStr, { type: Buffer.isBuffer(bufOrStr) ? 'buffer' : 'string', cellDates: true });
    const abas = wb.SheetNames;
    const nome = opcoes.aba && abas.includes(opcoes.aba) ? opcoes.aba : abas[0];
    const ws = nome ? wb.Sheets[nome] : null;
    const matriz = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true }) : [];
    return { matriz, abas };
  }
  const texto = decodificarTexto(bufOrStr);
  const matriz = parse(texto, {
    delimiter: detectarSep(texto),
    bom: true,
    trim: true,
    skip_empty_lines: false,
    relax_column_count: true,
    relax_quotes: true,
  });
  return { matriz, abas: [] };
}

const vazio = (v) => v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const ehTexto = (v) => typeof v === 'string' && v.trim() !== '' && !Number.isFinite(Number(v));

// 1a linha (ate a 15a) com >= 2 celulas de texto nao-numerico. -1 se a matriz e vazia.
function acharCabecalho(matriz) {
  const lim = Math.min(matriz.length, 15);
  for (let i = 0; i < lim; i += 1) {
    if ((matriz[i] || []).filter(ehTexto).length >= 2) return i;
  }
  return matriz.length ? 0 : -1;
}

// matriz -> { colunas, linhas: [{coluna: valor}], cabecalho_linha (1-based) }.
// Ignora colunas de cabecalho vazio e linhas totalmente vazias. Data -> string ISO.
// opcoes.linha_cabecalho (1-based) forca a linha do cabecalho.
export function montarTabela(matriz, opcoes = {}) {
  if (!matriz.length) return { colunas: [], linhas: [], cabecalho_linha: 0 };
  const idxCab = opcoes.linha_cabecalho
    ? Math.max(0, Math.min(matriz.length - 1, Number(opcoes.linha_cabecalho) - 1))
    : acharCabecalho(matriz);
  if (idxCab < 0) return { colunas: [], linhas: [], cabecalho_linha: 0 };

  const nomes = new Set();
  const usados = []; // { idx, nome }
  (matriz[idxCab] || []).forEach((h, idx) => {
    const nome = String(h ?? '').trim();
    if (!nome) return;
    let final = nome;
    let k = 2;
    while (nomes.has(final)) { final = `${nome}_${k}`; k += 1; }
    nomes.add(final);
    usados.push({ idx, nome: final });
  });

  const linhas = [];
  for (let i = idxCab + 1; i < matriz.length; i += 1) {
    const row = matriz[i] || [];
    const obj = {};
    for (const { idx, nome } of usados) {
      const v = row[idx];
      obj[nome] = v instanceof Date ? isoData(v) : (v === undefined ? '' : v);
    }
    if (Object.values(obj).some((v) => !vazio(v))) linhas.push(obj);
  }
  return { colunas: usados.map((u) => u.nome), linhas, cabecalho_linha: idxCab + 1 };
}

// Compat: array de objetos { coluna: valor }, cabecalho auto (ou opcoes.linha_cabecalho).
export function lerPlanilha(bufOrStr, nomeArquivo = '', opcoes = {}) {
  const { matriz } = lerMatriz(bufOrStr, nomeArquivo, opcoes);
  return montarTabela(matriz, opcoes).linhas;
}

// { colunas, amostra (<=20 linhas), total, abas, cabecalho_linha }
export function detectarColunas(bufOrStr, nomeArquivo = '', opcoes = {}) {
  const { matriz, abas } = lerMatriz(bufOrStr, nomeArquivo, opcoes);
  const { colunas, linhas, cabecalho_linha } = montarTabela(matriz, opcoes);
  return { colunas, amostra: linhas.slice(0, 20), total: linhas.length, abas, cabecalho_linha };
}

const RE_ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const RE_DMY = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/;
const RE_DM = /^(\d{1,2})[/.\-](\d{1,2})$/;

function valida(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// formato: 'iso' | 'br' (DD/MM/AAAA) | 'us' (MM/DD/AAAA).
// Tolera separador . / - ; ano de 2 digitos; "DD/MM" sem ano (usa opcoes.ano_padrao
// ou o ano atual); numero de serie do Excel. Mes por extenso NAO e aceito de proposito.
export function coerceData(str, formato = 'br', opcoes = {}) {
  if (str instanceof Date && !Number.isNaN(str.getTime())) return isoData(str);
  const s = String(str ?? '').trim();
  if (!s) throw new Error('data vazia');
  let y; let m; let d; let mm;
  if ((mm = s.match(RE_ISO))) {
    [, y, m, d] = mm.map(Number);
  } else if ((mm = s.match(RE_DMY))) {
    if (formato === 'us') [, m, d, y] = mm.map(Number);
    else [, d, m, y] = mm.map(Number);
    if (y < 100) y += 2000;
  } else if ((mm = s.match(RE_DM))) {
    const ano = Number(opcoes.ano_padrao) || new Date().getUTCFullYear();
    if (formato === 'us') [, m, d] = mm.map(Number);
    else [, d, m] = mm.map(Number);
    y = ano;
  } else if (SSF && /^\d{4,5}$/.test(s) && Number(s) >= 20000 && Number(s) <= 60000) {
    const o = SSF.parse_date_code(Number(s));
    if (!o || !o.y) throw new Error(`data "${s}" nao reconhecida`);
    ({ y, m, d } = o);
  } else {
    throw new Error(`data "${s}" nao reconhecida`);
  }
  if (!valida(y, m, d)) throw new Error(`data "${s}" invalida`);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// formato: 'br' (1.234,56) | 'us' (1,234.56 ou 1234.56).
// Limpa R$, %, espacos e texto entre parenteses. NAO tenta extrair numero de
// dentro de palavra ("30 reais" -> erro claro).
export function coerceValor(str, formato = 'br') {
  if (typeof str === 'number') {
    if (!Number.isFinite(str)) throw new Error(`valor "${str}" nao numerico`);
    return Math.round(str * 100) / 100;
  }
  let s = String(str ?? '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s ]|R\$|%/gi, '')
    .trim();
  if (!s || s === '-') throw new Error('valor vazio');
  if (formato === 'br') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`valor "${str}" nao numerico`);
  return Math.round(n * 100) / 100;
}

const semAcento = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// { item, exato } | null. Casa exato (ignorando acento/caixa) e, se nao achar,
// por inclusao ("insumo" ~ "Insumos", "compras de insumos" ~ "Insumos").
function casar(lista, nome) {
  const alvo = semAcento(nome);
  if (!alvo) return null;
  const arr = lista || [];
  const ex = arr.find((x) => semAcento(x.nome) === alvo);
  if (ex) return { item: ex, exato: true };
  const ap = arr.find((x) => {
    const a = semAcento(x.nome);
    return a && (a.includes(alvo) || alvo.includes(a));
  });
  return ap ? { item: ap, exato: false } : null;
}
const porId = (lista, id) => (id ? (lista || []).find((x) => String(x.id) === String(id)) || null : null);

const RE_TOTAL = /\b(total|totais|subtotal|soma)\b/i;
const consegue = (fn) => { try { fn(); return true; } catch { return false; } };

// { linhas: [...prontas p/ INSERT], erros: [{linha, motivo}], ignoradas: [{linha, motivo}],
//   casamentos: [{campo, de, para}] }.
// linha = numero 1-based da linha de dados (nao conta o cabecalho).
// ignoradas = linhas de total/resumo (data e valor ilegiveis + celula com "total").
export function montarLinhas({ tipo, linhasCsv, mapa, opcoes = {}, dicionarios = {} }) {
  const spec = CAMPOS[tipo];
  if (!spec) throw new Error(`tipo invalido: ${tipo}`);
  const fData = opcoes.formato_data || 'br';
  const fValor = opcoes.formato_valor || 'br';
  const linhas = [];
  const erros = [];
  const ignoradas = [];
  const casamentos = [];
  const jaCasado = new Set();
  const registra = (campo, de, para) => {
    const chave = `${campo}::${semAcento(de)}`;
    if (jaCasado.has(chave)) return;
    jaCasado.add(chave);
    casamentos.push({ campo, de: String(de ?? ''), para });
  };

  linhasCsv.forEach((row, i) => {
    const n = i + 1;
    const get = (campo) => {
      const col = mapa[campo];
      return col ? row[col] : undefined;
    };
    const brutoData = get('data');
    const valorCampo = tipo === 'receitas' ? 'valor_bruto' : 'valor';
    const brutoValor = get(valorCampo);
    try {
      const data = coerceData(brutoData, fData, opcoes);
      const valor = coerceValor(brutoValor, fValor);
      if (!(valor > 0)) throw new Error('valor deve ser maior que zero');

      if (tipo === 'receitas') {
        const mf = casar(dicionarios.formas, get('forma_pagamento'));
        const forma = (mf && mf.item) || porId(dicionarios.formas, opcoes.forma_default_id);
        if (!forma) throw new Error(`forma de pagamento "${get('forma_pagamento') ?? ''}" nao encontrada`);
        if (mf && !mf.exato) registra('forma de pagamento', get('forma_pagamento'), forma.nome);

        let operadora = null;
        const opNome = get('operadora');
        if (opNome) {
          const mo = casar(dicionarios.operadoras, opNome);
          operadora = mo && mo.item;
          if (!operadora) throw new Error(`maquininha "${opNome}" nao encontrada`);
          if (!mo.exato) registra('maquininha', opNome, operadora.nome);
        } else {
          operadora = porId(dicionarios.operadoras, opcoes.operadora_default_id);
        }
        if (forma.requer_operadora && !operadora) {
          throw new Error(`forma "${forma.nome}" exige maquininha — mapeie a coluna "operadora" ou escolha uma padrao`);
        }
        linhas.push({
          data,
          valor_bruto: valor,
          forma_pagamento_id: forma.id,
          operadora_id: operadora ? operadora.id : null,
          observacao: get('observacao') || null,
        });
      } else if (tipo === 'gastos') {
        const mc = casar(dicionarios.categorias, get('categoria'));
        const cat = (mc && mc.item) || porId(dicionarios.categorias, opcoes.categoria_default_id);
        if (!cat) throw new Error(`categoria "${get('categoria') ?? ''}" nao encontrada`);
        if (mc && !mc.exato) registra('categoria', get('categoria'), cat.nome);
        linhas.push({ data, valor, categoria_id: cat.id, descricao: get('descricao') || null });
      } else {
        const mfn = casar(dicionarios.funcionarios, get('funcionario'));
        const fn = (mfn && mfn.item) || porId(dicionarios.funcionarios, opcoes.funcionario_default_id);
        if (!fn) throw new Error(`funcionario "${get('funcionario') ?? ''}" nao encontrado`);
        if (mfn && !mfn.exato) registra('funcionario', get('funcionario'), fn.nome);
        linhas.push({
          funcionario_id: fn.id,
          data,
          valor,
          periodo_referencia: get('periodo_referencia') || null,
          tipo_vinculo_snapshot: fn.tipo_vinculo,
        });
      }
    } catch (e) {
      // linha de total/resumo: a propria celula de data diz "total", OU data e valor
      // ambos ilegiveis e alguma celula da linha tem "total/subtotal/soma".
      const dRuim = !consegue(() => coerceData(brutoData, fData, opcoes));
      const vRuim = !consegue(() => coerceValor(brutoValor, fValor));
      const naData = RE_TOTAL.test(String(brutoData ?? ''));
      const naLinha = Object.values(row).some((v) => RE_TOTAL.test(String(v ?? '')));
      if (naData || (dRuim && vRuim && naLinha)) ignoradas.push({ linha: n, motivo: 'linha de total/resumo' });
      else erros.push({ linha: n, motivo: e.message });
    }
  });

  return { linhas, erros, ignoradas, casamentos };
}
