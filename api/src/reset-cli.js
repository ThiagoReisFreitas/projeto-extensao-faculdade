// Recuperacao de emergencia (ex: o Dono esqueceu a senha e nao ha quem redefina).
// NAO e exposto por HTTP. Roda dentro do container da API, que ja tem DATABASE_URL.
// Uso: node src/reset-cli.js <email> <senha-nova>
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { senhaForte } from './validacao.js';

const [email, senha] = process.argv.slice(2);
if (!email || !senhaForte(senha)) {
  console.error('uso: node src/reset-cli.js <email> <senha (min. 8 chars)>');
  process.exit(1);
}

const hash = await bcrypt.hash(senha, 10);
const { rowCount, rows } = await pool.query(
  'UPDATE usuarios SET senha_hash = $1, ativo = true WHERE email = $2 RETURNING id, perfil',
  [hash, email],
);
console.log(rowCount
  ? `ok: usuario #${rows[0].id} (${rows[0].perfil}) — senha redefinida`
  : `nenhum usuario com email ${email}`);
await pool.end();
process.exit(rowCount ? 0 : 2);
