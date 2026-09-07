import test from 'node:test';
import assert from 'node:assert/strict';
import { calcTaxa, round2 } from './taxa.js';

test('sem operadora (dinheiro/PIX): taxa zero', () => {
  const r = calcTaxa({ valorBruto: 100, forma: { requer_operadora: false, tipo_taxa: 'nenhuma' } });
  assert.equal(r.valorTaxa, 0);
  assert.equal(r.valorLiquido, 100);
});

test('credito a vista 2.50%: taxa e liquido corretos e arredondados', () => {
  const r = calcTaxa({
    valorBruto: 123.45,
    forma: { requer_operadora: true, tipo_taxa: 'credito_vista' },
    operadora: { taxa_credito_vista: 2.5 },
  });
  assert.equal(r.valorTaxa, round2(123.45 * 0.025)); // 3.09
  assert.equal(r.valorLiquido, round2(123.45 - r.valorTaxa));
  assert.equal(round2(r.valorTaxa + r.valorLiquido), 123.45);
});

test('forma exige operadora e nao veio: erro 400', () => {
  assert.throws(
    () => calcTaxa({ valorBruto: 10, forma: { requer_operadora: true, tipo_taxa: 'debito' } }),
    /operadora obrigatoria/,
  );
});

test('valor invalido: erro 400', () => {
  assert.throws(() => calcTaxa({ valorBruto: 0, forma: { requer_operadora: false, tipo_taxa: 'nenhuma' } }));
});
