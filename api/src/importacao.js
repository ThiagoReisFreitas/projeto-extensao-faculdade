// Logica pura da importacao CSV (migracao de base de outro sistema).
// Sem acesso a banco -> testavel isolado. A rota (routes/importacao.js) chama
// estas funcoes e faz os INSERT em transacao.
import { parse } from 'csv-parse/sync';

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

// sniff do separador na 1a linha (planilha pt-BR costuma usar ';')
function detectarSep(texto) {
  const cab = String(texto).split(/\r?\n/)[0] || '';
  const cont = (ch) => (cab.match(new RegExp(`\\${ch}`, 'g')) || []).length;
  const cands = [[';', cont(';')], [',', cont(',')], ['\t', cont('\t')]];
  cands.sort((a, b) => b[1] - a[1]);
  return cands[0][1] > 0 ? cands[0][0] : ',';
}

export function parseCsv(bufOrStr) {
  const texto = Buffer.isBuffer(bufOrStr) ? bufOrStr.toString('utf8') : String(bufOrStr);
  return parse(texto, {
    columns: true,
    delimiter: detectarSep(texto),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

// { colunas, amostra (<=20 linhas), total }
export function detectarColunas(bufOrStr) {
  const linhas = parseCsv(bufOrStr);
  const colunas = linhas.length ? Object.keys(linhas[0]) : [];
  return { colunas, amostra: linhas.slice(0, 20), total: linhas.length };
}

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function valida(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// formato: 'iso' | 'br' (DD/MM/AAAA) | 'us' (MM/DD/AAAA)
export function coerceData(str, formato = 'br') {
  const s = String(str || '').trim();
  let y; let m; let d; let mm;
  if ((mm = s.match(RE_ISO))) { [, y, m, d] = mm.map(Number); }
  else if (formato === 'us' && (mm = s.match(RE_BR))) { [, m, d, y] = mm.map(Number); }
  else if ((mm = s.match(RE_BR))) { [, d, m, y] = mm.map(Number); }
  else throw new Error(`data "${s}" nao reconhecida`);
  if (!valida(y, m, d)) throw new Error(`data "${s}" invalida`);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// formato: 'br' (1.234,56) | 'us' (1,234.56 ou 1234.56)
export function coerceValor(str, formato = 'br') {
  let s = String(str ?? '').trim().replace(/\s|R\$/gi, '');
  if (!s) throw new Error('valor vazio');
  if (formato === 'br') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`valor "${str}" nao numerico`);
  return Math.round(n * 100) / 100;
}

const acha = (lista, nome) => {
  const alvo = String(nome || '').trim().toLowerCase();
  if (!alvo) return null;
  return (lista || []).find((x) => x.nome.trim().toLowerCase() === alvo) || null;
};
const porId = (lista, id) => (id ? (lista || []).find((x) => String(x.id) === String(id)) || null : null);

// { linhas: [...prontas p/ INSERT], erros: [{ linha, motivo }] }
// linha = numero 1-based da linha de dados (nao conta o cabecalho).
export function montarLinhas({ tipo, linhasCsv, mapa, opcoes = {}, dicionarios = {} }) {
  const spec = CAMPOS[tipo];
  if (!spec) throw new Error(`tipo invalido: ${tipo}`);
  const fData = opcoes.formato_data || 'br';
  const fValor = opcoes.formato_valor || 'br';
  const linhas = [];
  const erros = [];

  linhasCsv.forEach((row, i) => {
    const n = i + 1;
    const get = (campo) => {
      const col = mapa[campo];
      return col ? row[col] : undefined;
    };
    try {
      const data = coerceData(get('data'), fData);
      const valorCampo = tipo === 'receitas' ? 'valor_bruto' : 'valor';
      const valor = coerceValor(get(valorCampo), fValor);
      if (!(valor > 0)) throw new Error('valor deve ser maior que zero');

      if (tipo === 'receitas') {
        const forma = acha(dicionarios.formas, get('forma_pagamento'))
          || porId(dicionarios.formas, opcoes.forma_default_id);
        if (!forma) throw new Error(`forma de pagamento "${get('forma_pagamento') ?? ''}" nao encontrada`);
        let operadora = null;
        const opNome = get('operadora');
        if (opNome) {
          operadora = acha(dicionarios.operadoras, opNome);
          if (!operadora) throw new Error(`maquininha "${opNome}" nao encontrada`);
        } else {
          operadora = porId(dicionarios.operadoras, opcoes.operadora_default_id);
        }
        if (forma.requer_operadora && !operadora) {
          throw new Error(`forma "${forma.nome}" exige maquininha — mapeie a coluna "operadora" ou escolha uma padrao`);
        }
        linhas.push({
          data, valor_bruto: valor,
          forma_pagamento_id: forma.id,
          operadora_id: operadora ? operadora.id : null,
          observacao: get('observacao') || null,
        });
      } else if (tipo === 'gastos') {
        const cat = acha(dicionarios.categorias, get('categoria'))
          || porId(dicionarios.categorias, opcoes.categoria_default_id);
        if (!cat) throw new Error(`categoria "${get('categoria') ?? ''}" nao encontrada`);
        linhas.push({ data, valor, categoria_id: cat.id, descricao: get('descricao') || null });
      } else {
        const fn = acha(dicionarios.funcionarios, get('funcionario'))
          || porId(dicionarios.funcionarios, opcoes.funcionario_default_id);
        if (!fn) throw new Error(`funcionario "${get('funcionario') ?? ''}" nao encontrado`);
        linhas.push({
          funcionario_id: fn.id, data, valor,
          periodo_referencia: get('periodo_referencia') || null,
          tipo_vinculo_snapshot: fn.tipo_vinculo,
        });
      }
    } catch (e) {
      erros.push({ linha: n, motivo: e.message });
    }
  });

  return { linhas, erros };
}
