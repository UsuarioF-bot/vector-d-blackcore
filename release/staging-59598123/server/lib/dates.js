/** Fechas YYYY-MM-DD en hora local (evita desfase UTC de `new Date('YYYY-MM-DD')`). */

function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffDaysInclusive(start, end) {
  const a = parseLocalDate(start);
  const b = parseLocalDate(end);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function eachDayInRange(start, end) {
  const days = [];
  const cur = parseLocalDate(start);
  const last = parseLocalDate(end);
  while (cur <= last) {
    days.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function startOfWeekMonday(d = new Date()) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = copy.getDay() === 0 ? 6 : copy.getDay() - 1;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

module.exports = {
  parseLocalDate,
  localDateStr,
  diffDaysInclusive,
  eachDayInRange,
  startOfWeekMonday,
};
