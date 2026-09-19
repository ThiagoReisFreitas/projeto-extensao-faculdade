// Log de auditoria (login, logout, 401/403, estorno, reabertura — ver
// ops/README.md checklist pre-VPS item 5). Nunca deve derrubar a request que
// disparou o evento: falha de log e so console.error.
import { q } from './db.js';

export async function registrarEvento(tipo, { usuarioId = null, detalhe = null, ip = null } = {}) {
  try {
    await q(
      'INSERT INTO eventos_auditoria (usuario_id, tipo, detalhe, ip) VALUES ($1,$2,$3,$4)',
      [usuarioId, tipo, detalhe ? JSON.stringify(detalhe) : null, ip],
    );
  } catch (e) {
    console.error('[auditoria] falha ao registrar evento', tipo, e);
  }
}
