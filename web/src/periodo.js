import { hoje } from './api.js';

export const ultimos30 = () => {
  const d = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  return { de: d, ate: hoje() };
};

// espelha api/src/taxa.js -> so PREVIEW; servidor e a fonte da verdade
export function previewTaxa(valorBruto, forma, operadora) {
  const b = Number(valorBruto) || 0;
  if (!forma || !forma.requer_operadora || forma.tipo_taxa === 'nenhuma' || !operadora) {
    return { taxa: 0, liquido: b };
  }
  const pct = {
    debito: operadora.taxa_debito,
    credito_vista: operadora.taxa_credito_vista,
    credito_parcelado: operadora.taxa_credito_parcelado,
  }[forma.tipo_taxa] || 0;
  const taxa = Math.round(b * Number(pct)) / 100;
  return { taxa, liquido: Math.round((b - taxa) * 100) / 100 };
}
