import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'x'.repeat(40); // antes de importar auth.js

const { assinarReset, verificarReset, assinarComprovante, verificarAssinaturaComprovante } = await import('./auth.js');

const CAMINHO = 'receitas/2026/09/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d.webp';

function reqDe(url) {
  const [caminho, qs] = url.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path: `/${caminho}`, query };
}

function chama(mw, req) {
  let erro;
  mw(req, {}, (e) => { erro = e; });
  return erro;
}

const user = { id: 42, senha_hash: '$2a$10$hashatualaqui' };

test('assinarReset/verificarReset: token válido volta o id', () => {
  const t = assinarReset(user);
  assert.deepEqual(verificarReset(t, user), { id: 42 });
});

test('verificarReset: rejeita se a senha (hash) mudou', () => {
  const t = assinarReset(user);
  assert.throws(() => verificarReset(t, { id: 42, senha_hash: 'outro-hash' }), /expirad|invalid/i);
});

test('verificarReset: rejeita token corrompido', () => {
  const t = assinarReset(user).replace(/.$/, 'A');
  assert.throws(() => verificarReset(t, user), /expirad|invalid/i);
});

test('verificarReset: rejeita sem usuario', () => {
  const t = assinarReset(user);
  assert.throws(() => verificarReset(t, null), /expirad|invalid/i);
});

test('assinarComprovante/verificarAssinaturaComprovante: url valida passa', () => {
  const url = assinarComprovante(CAMINHO);
  assert.equal(chama(verificarAssinaturaComprovante, reqDe(url.replace('/comprovantes/', ''))), undefined);
});

test('verificarAssinaturaComprovante: rejeita sig adulterada', () => {
  const url = assinarComprovante(CAMINHO).replace('/comprovantes/', '');
  const req = reqDe(url);
  req.query.sig = `${req.query.sig.slice(0, -1)}${req.query.sig.at(-1) === 'a' ? 'b' : 'a'}`;
  const erro = chama(verificarAssinaturaComprovante, req);
  assert.equal(erro.status, 401);
});

test('verificarAssinaturaComprovante: rejeita link expirado', () => {
  const url = assinarComprovante(CAMINHO).replace('/comprovantes/', '');
  const req = reqDe(url);
  req.query.exp = String(Date.now() - 1000);
  const erro = chama(verificarAssinaturaComprovante, req);
  assert.equal(erro.status, 401);
});

test('verificarAssinaturaComprovante: rejeita path fora do formato esperado', () => {
  const req = reqDe(`../../etc/passwd?exp=${Date.now() + 60000}&sig=x`);
  const erro = chama(verificarAssinaturaComprovante, req);
  assert.equal(erro.status, 401);
});
