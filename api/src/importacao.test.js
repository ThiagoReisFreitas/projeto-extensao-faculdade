import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceData, coerceValor, montarLinhas, detectarColunas } from './importacao.js';

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
