import { q } from './db.js';
import { HttpError } from './http.js';

// bloqueia escrita em dia fechado (RF19 / "sem edicao silenciosa")
// exec opcional: passe client.query (dentro de uma transacao) pra evitar
// TOCTOU entre o check e o INSERT quando o caller ja abriu BEGIN.
export async function assertDiaAberto(data, exec = q) {
  const { rows } = await exec(
    'SELECT reaberto_em FROM fechamentos_diarios WHERE data = $1',
    [data],
  );
  if (rows.length && rows[0].reaberto_em === null) {
    throw new HttpError(409, `dia ${data} esta fechado - peca ao Dono para reabrir`);
  }
}
