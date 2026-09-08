import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { coerceData, coerceValor, montarLinhas, detectarColunas, lerPlanilha } from './importacao.js';

test('coerceData: aceita DD/MM/AAAA, AAAA-MM-DD e US', () => {
  assert.equal(coerceData('05/09/2026', 'br'), '2026-09-05');
  assert.equal(coerceData('2026-09-05'), '2026-09-05');
  assert.equal(coerceData('09/05/2026', 'us'), '2026-09-05');
});

test('coerceData: data impossivel dispara erro', () => {
  assert.throws(() => coerceData('31/02/2026', 'br'), /invalida/);
  assert.throws(() => coerceData('banana', 'br'), /nao reconhecida/);
});

test('coerceValor: pt-BR e US', () => {
  assert.equal(coerceValor('1.234,56', 'br'), 1234.56);
  assert.equal(coerceValor('R$ 10,00', 'br'), 10);
  assert.equal(coerceValor('1,234.56', 'us'), 1234.56);
  assert.throws(() => coerceValor('', 'br'), /vazio/);
});

test('coerceValor: numero cru (celula xlsx) passa direto, ignora formato', () => {
  assert.equal(coerceValor(89.9, 'br'), 89.9);
  assert.equal(coerceValor(1200, 'br'), 1200);
  assert.throws(() => coerceValor(NaN, 'br'), /numerico/);
});

test('lerPlanilha: xlsx -> colunas na ordem, valor como number, data como ISO', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Data', 'Valor', 'Categoria'],
    ['2026-09-01', 50, 'Insumos'],
    ['2026-09-02', 1200, 'Aluguel'],
  ]);
  // celula-data de verdade (SheetJS devolve Date) so na 1a linha, coluna A
  ws.A2 = { t: 'd', v: new Date(Date.UTC(2026, 8, 1)) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellDates: true });

  const linhas = lerPlanilha(buf, 'gastos.xlsx');
  assert.deepEqual(Object.keys(linhas[0]), ['Data', 'Valor', 'Categoria']);
  assert.equal(linhas[0].Data, '2026-09-01'); // Date -> string ISO
  assert.equal(linhas[0].Valor, 50); // number preservado

  const { colunas, total } = detectarColunas(buf, 'gastos.xlsx');
  assert.deepEqual(colunas, ['Data', 'Valor', 'Categoria']);
  assert.equal(total, 2);
});

test('montarLinhas: linhas vindas de xlsx (data ISO + valor number) montam ok', () => {
  const { linhas, erros } = montarLinhas({
    tipo: 'gastos',
    linhasCsv: [{ Data: '2026-09-01', Valor: 50, Cat: 'Insumos' }],
    mapa: { data: 'Data', valor: 'Valor', categoria: 'Cat' }, dicionarios: dic,
  });
  assert.equal(erros.length, 0);
  assert.deepEqual(linhas[0], { data: '2026-09-01', valor: 50, categoria_id: 1, descricao: null });
});

test('detectarColunas: CSV latin1 do Excel pt-BR nao quebra acento', () => {
  const buf = Buffer.from('Data;Valor;Categoria\n01/09/2026;10,00;Manuten\xE7\xE3o\n', 'latin1');
  const { amostra } = detectarColunas(buf);
  assert.equal(amostra[0].Categoria, 'Manutenção');
});

const dic = {
  categorias: [{ id: 1, nome: 'Insumos' }, { id: 2, nome: 'Aluguel' }],
  formas: [{ id: 10, nome: 'Dinheiro', requer_operadora: false, tipo_taxa: 'nenhuma' }],
  operadoras: [],
  funcionarios: [{ id: 7, nome: 'Maria', tipo_vinculo: 'diarista' }],
};

test('montarLinhas gastos: mapa valido -> N linhas, 0 erros', () => {
  const linhasCsv = [
    { Data: '01/09/2026', Valor: '50,00', Cat: 'Insumos' },
    { Data: '02/09/2026', Valor: '1.200,00', Cat: 'Aluguel' },
  ];
  const { linhas, erros } = montarLinhas({
    tipo: 'gastos', linhasCsv,
    mapa: { data: 'Data', valor: 'Valor', categoria: 'Cat' },
    opcoes: { formato_data: 'br', formato_valor: 'br' }, dicionarios: dic,
  });
  assert.equal(erros.length, 0);
  assert.deepEqual(linhas[0], { data: '2026-09-01', valor: 50, categoria_id: 1, descricao: null });
  assert.equal(linhas[1].categoria_id, 2);
});

test('montarLinhas gastos: categoria inexistente vira erro na linha certa', () => {
  const linhasCsv = [
    { Data: '01/09/2026', Valor: '50,00', Cat: 'Insumos' },
    { Data: '02/09/2026', Valor: '9,90', Cat: 'Fantasma' },
  ];
  const { linhas, erros } = montarLinhas({
    tipo: 'gastos', linhasCsv,
    mapa: { data: 'Data', valor: 'Valor', categoria: 'Cat' }, dicionarios: dic,
  });
  assert.equal(linhas.length, 1);
  assert.equal(erros.length, 1);
  assert.equal(erros[0].linha, 2);
  assert.match(erros[0].motivo, /Fantasma/);
});

test('montarLinhas gastos: data ruim reportada, resto ok', () => {
  const linhasCsv = [
    { d: '2026-13-40', v: '10,00', c: 'Insumos' },
    { d: '03/09/2026', v: '10,00', c: 'Insumos' },
  ];
  const { linhas, erros } = montarLinhas({
    tipo: 'gastos', linhasCsv, mapa: { data: 'd', valor: 'v', categoria: 'c' }, dicionarios: dic,
  });
  assert.equal(erros[0].linha, 1);
  assert.equal(linhas.length, 1);
});

test('montarLinhas pagamentos: snapshot do vinculo', () => {
  const { linhas, erros } = montarLinhas({
    tipo: 'pagamentos',
    linhasCsv: [{ dt: '10/09/2026', vl: '150,00', nome: 'Maria' }],
    mapa: { data: 'dt', valor: 'vl', funcionario: 'nome' }, dicionarios: dic,
  });
  assert.equal(erros.length, 0);
  assert.equal(linhas[0].funcionario_id, 7);
  assert.equal(linhas[0].tipo_vinculo_snapshot, 'diarista');
});

test('detectarColunas: cabecalho + amostra', () => {
  const csv = 'Data;Valor;Cat\n01/09/2026;10,00;Insumos\n02/09/2026;20,00;Aluguel\n';
  const { colunas, amostra, total } = detectarColunas(csv);
  assert.deepEqual(colunas, ['Data', 'Valor', 'Cat']);
  assert.equal(total, 2);
  assert.equal(amostra[0].Cat, 'Insumos');
});

// --- BAGUNCA: tolerancia a planilha mal preenchida ---

test('detectarColunas: pula titulo/linhas vazias antes do cabecalho', () => {
  const csv = 'Controle de Gastos;;\nPreenchido por Maria;;\n;;\nData;Valor;Categoria\n01/09/2026;10,00;Insumos\n';
  const { colunas, total, cabecalho_linha } = detectarColunas(csv);
  assert.deepEqual(colunas, ['Data', 'Valor', 'Categoria']);
  assert.equal(cabecalho_linha, 4);
  assert.equal(total, 1);
});

test('detectarColunas: opcoes.linha_cabecalho forca a linha', () => {
  const csv = 'lixo;lixo\nmais lixo;aqui\nData;Valor;Categoria\n01/09/2026;10,00;Insumos\n';
  const { colunas } = detectarColunas(csv, '', { linha_cabecalho: 3 });
  assert.deepEqual(colunas, ['Data', 'Valor', 'Categoria']);
});

test('detectarColunas: ignora coluna de cabecalho vazio', () => {
  const csv = 'Data; ;Valor;Categoria\n01/09/2026;;10,00;Insumos\n';
  const { colunas } = detectarColunas(csv);
  assert.deepEqual(colunas, ['Data', 'Valor', 'Categoria']);
});

test('montarLinhas: linha de TOTAL vai para ignoradas, nao para erros', () => {
  const linhasCsv = [
    { Data: '01/09/2026', Valor: '50,00', Cat: 'Insumos' },
    { Data: 'TOTAL', Valor: '', Cat: '' },
    { Data: '', Valor: 'SUBTOTAL: 50', Cat: '' },
  ];
  const { linhas, erros, ignoradas } = montarLinhas({
    tipo: 'gastos', linhasCsv, mapa: { data: 'Data', valor: 'Valor', categoria: 'Cat' }, dicionarios: dic,
  });
  assert.equal(linhas.length, 1);
  assert.equal(erros.length, 0);
  assert.equal(ignoradas.length, 2);
});

test('coerceData: tolera . como separador, DD/MM sem ano, serial do Excel', () => {
  assert.equal(coerceData('02.09.2026', 'br'), '2026-09-02');
  assert.equal(coerceData('2026/09/03'), '2026-09-03');
  assert.equal(coerceData('01/09', 'br', { ano_padrao: 2025 }), '2025-09-01');
  assert.equal(coerceData('45905', 'br'), '2025-09-05');
  assert.throws(() => coerceData('04 de setembro de 2026', 'br'), /nao reconhecida/);
});

test('coerceValor: limpa R$, parenteses; "30 reais" continua erro', () => {
  assert.equal(coerceValor('R$1.500,00 (nota 55)', 'br'), 1500);
  assert.equal(coerceValor('1.200', 'br'), 1200);
  assert.throws(() => coerceValor('30 reais', 'br'), /numerico/);
  assert.throws(() => coerceValor('-', 'br'), /vazio/);
});

test('montarLinhas: categoria aproximada casa e entra em casamentos', () => {
  const linhasCsv = [
    { Data: '01/09/2026', Valor: '10,00', Cat: 'gás' },
    { Data: '02/09/2026', Valor: '10,00', Cat: 'INSUMOS' },
    { Data: '03/09/2026', Valor: '10,00', Cat: 'compras de insumos' },
  ];
  const d2 = { ...dic, categorias: [{ id: 1, nome: 'Insumos' }, { id: 5, nome: 'Gas' }] };
  const { linhas, erros, casamentos } = montarLinhas({
    tipo: 'gastos', linhasCsv, mapa: { data: 'Data', valor: 'Valor', categoria: 'Cat' }, dicionarios: d2,
  });
  assert.equal(erros.length, 0);
  assert.equal(linhas.length, 3);
  assert.equal(linhas[0].categoria_id, 5); // gás -> Gas (exato sem acento, nao entra em casamentos)
  assert.equal(linhas[1].categoria_id, 1); // INSUMOS -> Insumos (exato)
  assert.equal(linhas[2].categoria_id, 1); // "compras de insumos" -> Insumos (inclusao -> casamento)
  const aprox = casamentos.map((c) => c.de);
  assert.deepEqual(aprox, ['compras de insumos']);
});

test('lerMatriz xlsx: opcoes.aba escolhe a aba certa', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['leia-me']]), 'Instrucoes');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Data', 'Valor', 'Categoria'], ['2026-09-01', 10, 'Insumos'],
  ]), 'dados');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const semAba = detectarColunas(buf, 'x.xlsx');
  assert.deepEqual(semAba.abas, ['Instrucoes', 'dados']);
  const comAba = detectarColunas(buf, 'x.xlsx', { aba: 'dados' });
  assert.deepEqual(comAba.colunas, ['Data', 'Valor', 'Categoria']);
  assert.equal(comAba.total, 1);
});
