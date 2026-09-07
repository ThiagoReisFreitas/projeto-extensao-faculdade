import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { q } from '../db.js';
import { HttpError, ah } from '../http.js';
import { assinarToken, authObrigatorio, bcrypt, assinarReset, verificarReset } from '../auth.js';
import { senhaForte } from '../validacao.js';
import { notificarReset, emailAtivo } from '../email.js';

const r = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'muitas tentativas de login, tente novamente em alguns minutos' },
});
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

// hash bcrypt fixo p/ comparar mesmo quando o email nao existe: nivela o tempo
// de resposta e evita enumeracao de usuarios por timing. (gerado com bcrypt.hash)
const DUMMY_HASH = '$2a$10$NI.NmV3MYAGKot8q049IdubsHDX6ezlTBWv5GWABGhI19lw0q6u9y';

r.post('/login', loginLimiter, ah(async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) throw new HttpError(400, 'email e senha obrigatorios');
  const { rows } = await q('SELECT * FROM usuarios WHERE email = $1 AND ativo = true', [email]);
  const user = rows[0];
  const confere = await bcrypt.compare(senha, user ? user.senha_hash : DUMMY_HASH);
  if (!user || !confere) throw new HttpError(401, 'credenciais invalidas');
  res.json({ token: assinarToken(user), user: { id: user.id, nome: user.nome, perfil: user.perfil } });
}));

// confere o token E se o usuario ainda existe/ativo no banco.
// sem o check no banco, um token de um banco anterior (ex: apos `down -v`)
// continuaria "logado" apontando pra um usuario que nao existe mais.
r.get('/me', authObrigatorio, ah(async (req, res) => {
  const { rows } = await q(
    'SELECT id, nome, perfil FROM usuarios WHERE id = $1 AND ativo = true', [req.user.id],
  );
  if (!rows[0]) throw new HttpError(401, 'sessao invalida');
  res.json({ user: rows[0] });
}));

// o front pergunta se pode mostrar o "Esqueci a senha" (depende de e-mail configurado)
r.get('/config', (_req, res) => res.json({ resetEmail: emailAtivo() }));

// pede um link de redefinicao. sempre 200 (nao revela se o email existe).
r.post('/esqueci', resetLimiter, ah(async (req, res) => {
  const { email } = req.body || {};
  if (email) {
    const { rows } = await q('SELECT * FROM usuarios WHERE email = $1 AND ativo = true', [email]);
    if (rows[0]) await notificarReset(rows[0], assinarReset(rows[0]));
  }
  res.json({ ok: true });
}));

// aplica a nova senha a partir do token do link.
r.post('/redefinir', resetLimiter, ah(async (req, res) => {
  const { token, senha } = req.body || {};
  if (!token || !senha) throw new HttpError(400, 'token e senha obrigatorios');
  if (!senhaForte(senha)) throw new HttpError(400, 'senha precisa de pelo menos 8 caracteres');
  // decodifica sem verificar p/ achar o usuario, depois verifica de verdade contra o hash atual
  const cru = jwt.decode(token);
  if (!cru || !cru.id) throw new HttpError(400, 'link expirado ou invalido');
  const { rows } = await q('SELECT * FROM usuarios WHERE id = $1 AND ativo = true', [cru.id]);
  const user = rows[0];
  verificarReset(token, user); // lanca 400 se nao servir
  const hash = await bcrypt.hash(senha, 10);
  await q('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, user.id]);
  res.json({ ok: true });
}));

export default r;
