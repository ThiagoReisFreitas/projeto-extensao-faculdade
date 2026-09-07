// Validadores puros compartilhados pelas rotas. Sem acesso a banco -> testavel isolado.

const BLOQUEADOS_JWT = new Set([
  'dev-insecure',
  'troque-isto-por-uma-string-longa-aleatoria',
  'changeme', 'secret', 'senha',
]);

// segredo aceitavel: presente, >= 24 chars, nao e um placeholder conhecido
export function jwtSecretAceitavel(s) {
  return typeof s === 'string' && s.length >= 24 && !BLOQUEADOS_JWT.has(s.trim());
}

// data ISO 'AAAA-MM-DD' de calendario real, ano entre 2000 e (ano atual + 1)
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
export function dataValida(s) {
  const m = RE_ISO.exec(String(s || ''));
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
  const anoMax = new Date().getUTCFullYear() + 1;
  return y >= 2000 && y <= anoMax;
}

export const hojeISO = () => new Date().toISOString().slice(0, 10);

// data valida E nao no futuro (nao existe venda/gasto de amanha)
export function dataNaoFutura(s) {
  return dataValida(s) && s <= hojeISO();
}

// caminho de comprovante gerado pelo proprio upload: tipo/AAAA/MM/<uuid>.webp
const RE_COMPROVANTE = /^(receitas|gastos)\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
export function comprovantePathValido(s) {
  return typeof s === 'string' && RE_COMPROVANTE.test(s);
}

// senha minima (usabilidade > complexidade forcada no piloto)
export function senhaForte(s) {
  return typeof s === 'string' && s.trim().length >= 8;
}

// checa assinatura (magic bytes) de imagem real, independente do MIME declarado
export function imagemValida(buf) {
  if (!buf || buf.length < 12) return false;
  const b = buf;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
  const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return png || jpg || gif || webp;
}

// Sobraria pelo menos um dono ativo depois da alteracao proposta?
// usuarios: [{ id, perfil, ativo }]; mudanca: { id, perfil?, ativo? }
export function restariaAlgumDono(usuarios, mudanca) {
  return (usuarios || []).some((u) => {
    const alvo = String(u.id) === String(mudanca.id);
    const perfil = alvo && mudanca.perfil !== undefined ? mudanca.perfil : u.perfil;
    const ativo = alvo && mudanca.ativo !== undefined ? mudanca.ativo : u.ativo;
    return perfil === 'dono' && ativo === true;
  });
}
