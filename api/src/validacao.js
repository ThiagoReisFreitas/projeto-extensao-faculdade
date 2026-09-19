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

// data de "hoje" no fuso do restaurante (America/Sao_Paulo), nao UTC do host/container.
// en-CA formata nativamente como AAAA-MM-DD.
export const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// data valida E nao no futuro (nao existe venda/gasto de amanha)
export function dataNaoFutura(s) {
  return dataValida(s) && s <= hojeISO();
}

// caminho de comprovante gerado pelo proprio upload: tipo/AAAA/MM/<uuid>.<ext>
// ext reflete o formato real do arquivo (ver extensaoImagem) — cliente sempre manda
// webp (compressao no client, CLAUDE.md), mas o upload aceita png/jpg/gif como
// trava de seguranca, entao o path tem que aceitar as mesmas extensoes.
const RE_COMPROVANTE = /^(receitas|gastos)\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png|gif)$/;
export function comprovantePathValido(s) {
  return typeof s === 'string' && RE_COMPROVANTE.test(s);
}

// senha minima (usabilidade > complexidade forcada no piloto)
export function senhaForte(s) {
  return typeof s === 'string' && s.trim().length >= 8;
}

// formato basico de e-mail (nao valida entrega, so evita erro de digitacao que
// quebraria "esqueci a senha" em silencio pra sempre pro usuario)
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function emailValido(s) {
  return typeof s === 'string' && RE_EMAIL.test(s.trim());
}

// extensao real do arquivo pelos bytes magicos, ou null se nao for imagem conhecida
export function extensaoImagem(buf) {
  if (!buf || buf.length < 12) return null;
  const b = buf;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// checa assinatura (magic bytes) de imagem real, independente do MIME declarado
export function imagemValida(buf) {
  return extensaoImagem(buf) !== null;
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
