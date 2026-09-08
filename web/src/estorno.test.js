import { describe, it, expect } from 'vitest';
import { juntarEstornos } from './estorno.js';

const soma = (arr) => arr.reduce((s, m) => s + m.valor, 0);

describe('juntarEstornos', () => {
  it('funde original + reversão numa linha só que soma 0', () => {
    const raw = [
      { tipo: 'receita', id: 1, estornoDeId: null, valor: 120 },
      { tipo: 'receita', id: 2, estornoDeId: 1, valor: -120, motivo: 'duplicado' },
    ];
    const out = juntarEstornos(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 1, estornado: true, valor: 0, valorMostrar: 120, motivo: 'duplicado' });
    expect(soma(out)).toBe(0);
  });

  it('não mexe em lançamento normal', () => {
    const raw = [{ tipo: 'gasto', id: 9, estornoDeId: null, valor: -50 }];
    const out = juntarEstornos(raw);
    expect(out).toEqual([{ tipo: 'gasto', id: 9, estornoDeId: null, valor: -50, valorMostrar: -50 }]);
  });

  it('não confunde ids iguais de tabelas diferentes', () => {
    const raw = [
      { tipo: 'receita', id: 5, estornoDeId: null, valor: 100 },
      { tipo: 'gasto', id: 5, estornoDeId: null, valor: -30 },
      { tipo: 'gasto', id: 6, estornoDeId: 5, valor: 30, motivo: 'errado' }, // estorna o gasto 5, não a receita 5
    ];
    const out = juntarEstornos(raw);
    expect(out).toHaveLength(2);
    expect(out.find((m) => m.tipo === 'receita').estornado).toBeUndefined();
    expect(out.find((m) => m.tipo === 'gasto').estornado).toBe(true);
    expect(soma(out)).toBe(100); // receita 100 + gasto estornado 0
  });

  it('reversão órfã (original fora do período) aparece riscada com o valor real', () => {
    const raw = [{ tipo: 'gasto', id: 8, estornoDeId: 999, valor: 40, motivo: 'ajuste' }];
    const out = juntarEstornos(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 8, estornado: true, valor: 40, valorMostrar: 40 });
  });
});
