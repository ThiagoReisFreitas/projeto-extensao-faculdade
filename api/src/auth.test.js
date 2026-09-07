import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'x'.repeat(40); // antes de importar auth.js

const { assinarReset, verificarReset } = await import('./auth.js');

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
