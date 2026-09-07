import { q } from './db.js';
import { HttpError } from './http.js';

// bloqueia escrita em dia fechado (RF19 / "sem edicao silenciosa")
export async function assertDiaAberto(data) {
  const { rows } = await q(
    'SELECT reaberto_em FROM fechamentos_diarios WHERE data = $1',
    [data],
  );
  if (rows.length && rows[0].reaberto_em === null) {
    throw new HttpError(409, `dia ${data} esta fechado - peca ao Dono para reabrir`);
  }
}
