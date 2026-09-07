// Nenhum termo de banco de dados na interface.

export const TIPO_TAXA = {
  nenhuma: 'Sem taxa',
  debito: 'Débito',
  credito_vista: 'Crédito à vista',
  credito_parcelado: 'Crédito parcelado',
};
export const tipoTaxaLabel = (v) => TIPO_TAXA[v] ?? v;

export const VINCULO = {
  fixo: 'Fixo',
  temporario: 'Temporário',
  diarista: 'Diarista',
};
export const vinculoLabel = (v) => VINCULO[v] ?? v;

export const PERFIL = { dono: 'Dono', caixa: 'Caixa' };
export const perfilLabel = (v) => PERFIL[v] ?? v;

// "true"/"false" -> selo de estado
export function Selo({ ativo }) {
  return ativo
    ? <span className="selo selo--on">EM USO</span>
    : <span className="selo selo--off">ARQUIVADA</span>;
}

export const pct = (v) =>
  `${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
