import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { q } from './db.js';
import { HttpError } from './http.js';
import { comprovantePathValido, jwtSecretAceitavel, senhaForte } from './validacao.js';

const SECRET = () => process.env.JWT_SECRET;
const JWT_OPTS = { algorithms: ['HS256'] };

// Abortar o boot se a config de seguranca minima nao estiver presente.
// Chamada em index.js antes de servir qualquer request.
export function assertConfigSeguranca() {
  if (!jwtSecretAceitavel(process.env.JWT_SECRET)) {
    throw new Error(
      'JWT_SECRET ausente, curto (< 24 chars) ou com valor de exemplo. '
      + 'Rode ./ops/gen-env.sh ou defina JWT_SECRET no .env (openssl rand -hex 32).',
    );
  }
  if (!senhaForte(process.env.ADMIN_SENHA) || process.env.ADMIN_SENHA === 'trocar123') {
    throw new Error('ADMIN_SENHA ausente, fraca (< 8 chars) ou igual ao exemplo "trocar123". Defina no .env.');
  }
}

export function assinarToken(user) {
  return jwt.sign(
    { id: user.id, perfil: user.perfil, nome: user.nome, token_version: user.token_version },
    SECRET(),
    { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES || '12h' },
  );
}

// --- redefinicao de senha por link (token = JWT curto, sem tabela) ---
// `sh` prende o token ao hash atual: trocar a senha invalida tokens antigos.
const shDe = (senhaHash) => createHash('sha256').update(String(senhaHash)).digest('hex').slice(0, 16);

export function assinarReset(user) {
  return jwt.sign(
    { id: user.id, kind: 'reset', sh: shDe(user.senha_hash) },
    SECRET(),
    { algorithm: 'HS256', expiresIn: '1h' },
  );
}

// retorna { id } se o token servir p/ este usuario; senao lanca 400.
export function verificarReset(token, user) {
  let p;
  try { p = jwt.verify(token, SECRET(), JWT_OPTS); }
  catch { throw new HttpError(400, 'link expirado ou invalido'); }
  if (p.kind !== 'reset' || !user || p.sh !== shDe(user.senha_hash)) {
    throw new HttpError(400, 'link expirado ou invalido');
  }
  return { id: p.id };
}

// confere o token E se o usuario ainda existe/esta ativo/mantem o perfil no banco.
// so confiar no claim do JWT deixaria um usuario desativado/rebaixado com acesso
// total ate o token expirar sozinho (ate 12h, JWT_EXPIRES) — mesmo check que
// GET /auth/me ja fazia, agora em toda rota autenticada.
export async function carregarUsuarioAtivo(id) {
  const { rows } = await q('SELECT id, nome, perfil, token_version FROM usuarios WHERE id = $1 AND ativo = true', [id]);
  if (!rows[0]) throw new HttpError(401, 'sessao invalida');
  return rows[0];
}

export async function authObrigatorio(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'nao autenticado'));
  let payload;
  try { payload = jwt.verify(token, SECRET(), JWT_OPTS); }
  catch { return next(new HttpError(401, 'token invalido ou expirado')); }
  try {
    const usuario = await carregarUsuarioAtivo(payload.id);
    // token_version diferente = senha trocada (ou logout-all) depois deste
    // token ser emitido — revoga na hora, nao espera o JWT_EXPIRES (12h).
    if (usuario.token_version !== payload.token_version) {
      throw new HttpError(401, 'sessao invalida');
    }
    const { token_version, ...semVersao } = usuario;
    req.user = semVersao;
    next();
  } catch (e) { next(e); }
}

// URL assinada de curta duracao p/ <img>/<a> de comprovante (nao mandam header
// Authorization). Substitui o JWT de 12h cru na query string: exposto na
// internet via Funnel, aquele token vazava em log de proxy/historico do
// navegador. Aqui a assinatura so vale por TTL curto e nao serve pra mais nada.
const COMPROVANTE_TTL_MS = 5 * 60 * 1000;

const assinaturaComprovante = (caminho, exp) => createHmac('sha256', SECRET())
  .update(`${caminho}:${exp}`)
  .digest('hex');

export function assinarComprovante(caminho) {
  const exp = Date.now() + COMPROVANTE_TTL_MS;
  const sig = assinaturaComprovante(caminho, exp);
  // nginx so proxya /api/ pro backend (proxy/nginx.conf); qualquer coisa fora
  // disso cai no fallback do SPA (try_files ... /index.html). Sem o prefixo
  // aqui a URL "assinada" nunca chegava no Express — devolvia o app inteiro
  // (200, texto/html) em vez da imagem ou de um 401.
  return `/api/comprovantes/${caminho}?exp=${exp}&sig=${sig}`;
}

export function verificarAssinaturaComprovante(req, _res, next) {
  const caminho = req.path.replace(/^\/+/, '');
  const exp = Number(req.query.exp);
  const sig = String(req.query.sig || '');
  if (!comprovantePathValido(caminho) || !exp || !sig) {
    return next(new HttpError(401, 'link invalido'));
  }
  if (Date.now() > exp) return next(new HttpError(401, 'link expirado'));
  const esperada = assinaturaComprovante(caminho, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new HttpError(401, 'link invalido'));
  }
  next();
}

export function somenteDono(req, _res, next) {
  if (req.user?.perfil !== 'dono') return next(new HttpError(403, 'acao restrita ao Dono'));
  next();
}

// cria o Dono no primeiro boot se nao houver nenhum usuario
export async function bootstrapAdmin() {
  const { rows } = await q('SELECT count(*)::int AS n FROM usuarios');
  if (rows[0].n > 0) return;
  const email = process.env.ADMIN_EMAIL || 'dono@opensador.local';
  const senha = process.env.ADMIN_SENHA;
  const nome = process.env.ADMIN_NOME || 'Dono';
  if (!senhaForte(senha)) throw new Error('ADMIN_SENHA fraca — nao vou criar o Dono inicial.');
  const hash = await bcrypt.hash(senha, 10);
  await q(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES ($1,$2,$3,'dono')`,
    [nome, email, hash],
  );
  console.log(`[bootstrap] Dono criado: ${email}`);
}

export { bcrypt };
