import test from 'node:test';
import assert from 'node:assert/strict';
import {
  jwtSecretAceitavel, dataValida, dataNaoFutura, hojeISO,
  comprovantePathValido, senhaForte, imagemValida, restariaAlgumDono,
} from './validacao.js';

test('jwtSecretAceitavel: rejeita ausente/curto/placeholder', () => {
  assert.equal(jwtSecretAceitavel(undefined), false);
  assert.equal(jwtSecretAceitavel('curto'), false);
  assert.equal(jwtSecretAceitavel('dev-insecure'), false);
  assert.equal(jwtSecretAceitavel('troque-isto-por-uma-string-longa-aleatoria'), false);
  assert.equal(jwtSecretAceitavel('a'.repeat(24)), true);
});

test('dataValida: ISO real, faixa de ano', () => {
  assert.equal(dataValida('2026-09-03'), true);
  assert.equal(dataValida('2026-02-30'), false);
  assert.equal(dataValida('03/09/2026'), false);
  assert.equal(dataValida('1999-01-01'), false);
  assert.equal(dataValida('9999-01-01'), false);
  assert.equal(dataValida(''), false);
});

test('dataNaoFutura: hoje ok, amanha nao, ontem ok', () => {
  const dia = 864e5;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  assert.equal(dataNaoFutura(hojeISO()), true);
  assert.equal(dataNaoFutura(iso(Date.now() - dia)), true);
  assert.equal(dataNaoFutura(iso(Date.now() + dia)), false);
  assert.equal(dataNaoFutura('2050-01-01'), false);
});

test('comprovantePathValido: só o formato do upload', () => {
  assert.equal(comprovantePathValido('receitas/2026/09/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d.webp'), true);
  assert.equal(comprovantePathValido('gastos/2026/09/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d.webp'), true);
  assert.equal(comprovantePathValido('../../etc/passwd'), false);
  assert.equal(comprovantePathValido('receitas/2026/09/arquivo.webp'), false);
  assert.equal(comprovantePathValido('outro/2026/09/0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d.webp'), false);
});

test('senhaForte: >= 8', () => {
  assert.equal(senhaForte('1234567'), false);
  assert.equal(senhaForte('12345678'), true);
  assert.equal(senhaForte('trocar123'), true); // comprimento ok; o bloqueio de "trocar123" e no boot
});

test('imagemValida: bytes magicos', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
  const texto = Buffer.from('<html>oi</html>');
  assert.equal(imagemValida(png), true);
  assert.equal(imagemValida(jpg), true);
  assert.equal(imagemValida(webp), true);
  assert.equal(imagemValida(texto), false);
  assert.equal(imagemValida(Buffer.alloc(4)), false);
});

test('restariaAlgumDono: bloqueia lockout', () => {
  const us = [
    { id: 1, perfil: 'dono', ativo: true },
    { id: 2, perfil: 'caixa', ativo: true },
  ];
  assert.equal(restariaAlgumDono(us, { id: 1, ativo: false }), false);   // desativa o unico dono
  assert.equal(restariaAlgumDono(us, { id: 1, perfil: 'caixa' }), false); // rebaixa o unico dono
  assert.equal(restariaAlgumDono(us, { id: 2, ativo: false }), true);     // mexe no caixa, dono fica
  const dois = [...us, { id: 3, perfil: 'dono', ativo: true }];
  assert.equal(restariaAlgumDono(dois, { id: 1, ativo: false }), true);   // sobra o dono 3
});
