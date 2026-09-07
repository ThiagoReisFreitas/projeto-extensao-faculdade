import { HttpError } from './http.js';

export const round2 = (n) =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Calcula valor_taxa / valor_liquido no momento do lancamento (fato imutavel).
// forma: linha de formas_pagamento. operadora: linha de operadoras_cartao (ou null).
export function calcTaxa({ valorBruto, forma, operadora }) {
  const bruto = Number(valorBruto);
  if (!(bruto > 0)) throw new HttpError(400, 'valor_bruto deve ser maior que zero');

  if (!forma.requer_operadora || forma.tipo_taxa === 'nenhuma') {
    return { valorTaxa: 0, valorLiquido: round2(bruto) };
  }
  if (!operadora) throw new HttpError(400, 'operadora obrigatoria para esta forma de pagamento');

  const pct = {
    debito: operadora.taxa_debito,
    credito_vista: operadora.taxa_credito_vista,
    credito_parcelado: operadora.taxa_credito_parcelado,
  }[forma.tipo_taxa];

  const valorTaxa = round2(bruto * Number(pct) / 100);
  return { valorTaxa, valorLiquido: round2(bruto - valorTaxa) };
}
