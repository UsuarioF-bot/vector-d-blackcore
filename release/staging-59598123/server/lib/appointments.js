/**
 * Cancela citas que siguen en Pendiente más de 1 h después de su fecha/hora programada.
 */
function parseCitaDateTime(fecha, hora) {
  if (!fecha || !hora) return null;
  const [y, m, d] = fecha.split('-').map(Number);
  const parts = String(hora).trim().split(':');
  const hh = Number(parts[0]);
  const mm = Number(parts[1] || 0);
  if (Number.isNaN(y) || Number.isNaN(hh)) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function cancelExpiredPending(db) {
  const pendientes = db
    .prepare(`SELECT id, fecha, hora FROM citas WHERE estado = 'Pendiente'`)
    .all();
  const update = db.prepare(`UPDATE citas SET estado = 'Cancelado' WHERE id = ?`);
  const now = Date.now();
  const unaHora = 60 * 60 * 1000;
  let count = 0;

  for (const c of pendientes) {
    const inicio = parseCitaDateTime(c.fecha, c.hora);
    if (!inicio) continue;
    if (now - inicio.getTime() >= unaHora) {
      update.run(c.id);
      count += 1;
    }
  }
  return count;
}

module.exports = { cancelExpiredPending, parseCitaDateTime };
