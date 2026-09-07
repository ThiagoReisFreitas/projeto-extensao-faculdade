import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { q } from './db.js';
import { HttpError } from './http.js';
import { jwtSecretAceitavel, senhaForte } from './validacao.js';

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
    { id: user.id, perfil: user.perfil, nome: user.nome },
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

export function authObrigatorio(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'nao autenticado'));
  try {
    req.user = jwt.verify(token, SECRET(), JWT_OPTS);
    next();
  } catch {
    next(new HttpError(401, 'token invalido ou expirado'));
  }
}

// aceita token no header OU em ?token= (necessario p/ <img>/<a> de comprovante,
// que nao mandam header). ponytail: token na URL pode vazar em log de proxy —
// ok no piloto local; na VPS trocar por URL assinada de curta duracao.
export function authHeaderOuQuery(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  if (!token) return next(new HttpError(401, 'nao autenticado'));
  try { req.user = jwt.verify(token, SECRET(), JWT_OPTS); next(); }
  catch { next(new HttpError(401, 'token invalido ou expirado')); }
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
