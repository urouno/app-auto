// Lógica pura (sin DOM) para poder probarla con `node --test`.

export const SOON_KM = 1000; // "próximo" si faltan ≤ 1000 km
export const SOON_DAYS = 30; // "próximo" si faltan ≤ 30 días
export const PRESSURE_CHECK_DAYS = 30; // revisar presión al menos cada 30 días
export const PRESSURE_OK = 2; // ± psi considerado correcto
export const PRESSURE_WARN = 5; // ± psi antes de considerarse crítico
const KM_PER_DAY = 40; // sólo para ordenar por urgencia km vs. días

const parse = (iso) => iso.split('-').map(Number);
const pad = (n) => String(n).padStart(2, '0');

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Días de `a` a `b` (positivo si `b` es posterior). */
export function daysBetween(a, b) {
  const [ay, am, ad] = parse(a);
  const [by, bm, bd] = parse(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 864e5);
}

/** Suma meses respetando fin de mes (31 ene + 1 mes = 28/29 feb). */
export function addMonths(iso, months) {
  const [y, m, d] = parse(iso);
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}

/** Estado de algo que vence por kilometraje y/o fecha (lo que ocurra primero). */
export function dueStatus(dueKm, dueDate, odometer, today) {
  const kmLeft = dueKm != null && odometer != null ? dueKm - odometer : null;
  const daysLeft = dueDate ? daysBetween(today, dueDate) : null;
  let status = 'ok';
  if (kmLeft == null && daysLeft == null) status = 'unknown';
  else if ((kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0)) status = 'overdue';
  else if ((kmLeft != null && kmLeft <= SOON_KM) || (daysLeft != null && daysLeft <= SOON_DAYS)) status = 'soon';
  return { dueKm: dueKm ?? null, dueDate: dueDate || null, kmLeft, daysLeft, status };
}

/** Próximo reemplazo de un consumible a partir del último cambio y sus intervalos. */
export function consumableDue(c) {
  return {
    dueKm: c.lastKm != null && c.intervalKm ? c.lastKm + c.intervalKm : null,
    dueDate: c.lastDate && c.intervalMonths ? addMonths(c.lastDate, c.intervalMonths) : null,
  };
}

/** Fracción de vida útil consumida (0–1+), o null si no hay datos. */
export function consumableWear(c, odometer, today) {
  const parts = [];
  if (c.lastKm != null && c.intervalKm && odometer != null) parts.push((odometer - c.lastKm) / c.intervalKm);
  if (c.lastDate && c.intervalMonths) {
    const total = daysBetween(c.lastDate, addMonths(c.lastDate, c.intervalMonths));
    parts.push(daysBetween(c.lastDate, today) / total);
  }
  return parts.length ? Math.max(0, ...parts) : null;
}

export function tireStatus(value, target) {
  if (value == null || target == null) return 'unknown';
  const diff = Math.abs(value - target);
  return diff <= PRESSURE_OK ? 'ok' : diff <= PRESSURE_WARN ? 'warn' : 'bad';
}

export const TIRES = [
  { key: 'fl', label: 'Delantera izq.', axle: 'pressureFront' },
  { key: 'fr', label: 'Delantera der.', axle: 'pressureFront' },
  { key: 'rl', label: 'Trasera izq.', axle: 'pressureRear' },
  { key: 'rr', label: 'Trasera der.', axle: 'pressureRear' },
];

/** Lectura más reciente (ante empate de fecha gana la última registrada). */
export function latestReading(vehicle) {
  return (vehicle.tires || []).reduce((best, r) => (!best || r.date >= best.date ? r : best), null);
}

const RANK = { overdue: 0, soon: 1, ok: 2, unknown: 3 };
const urgency = (i) => Math.min(i.daysLeft ?? Infinity, i.kmLeft != null ? i.kmLeft / KM_PER_DAY : Infinity);

/** Servicios programados y consumibles con su estado, ordenados por urgencia. */
export function dueItems(vehicle, today) {
  const items = [];
  for (const s of vehicle.services || []) {
    if (s.status !== 'scheduled') continue;
    items.push({ kind: 'service', id: s.id, title: s.type, ...dueStatus(s.dueKm, s.dueDate, vehicle.odometer, today) });
  }
  for (const c of vehicle.consumables || []) {
    const d = consumableDue(c);
    items.push({ kind: 'consumable', id: c.id, title: c.name, ...dueStatus(d.dueKm, d.dueDate, vehicle.odometer, today) });
  }
  return items.sort((a, b) => RANK[a.status] - RANK[b.status] || urgency(a) - urgency(b));
}

/** Alertas de presión: lectura faltante/antigua y llantas fuera de rango. */
export function tireAlerts(vehicle, today) {
  const last = latestReading(vehicle);
  if (!last) return [{ level: 'soon', title: 'Sin lecturas de presión', detail: 'Registra la primera medición.' }];
  const alerts = [];
  const age = daysBetween(last.date, today);
  if (age > PRESSURE_CHECK_DAYS) {
    alerts.push({ level: 'soon', title: 'Revisar presión de llantas', detail: `Última lectura hace ${age} días.` });
  }
  for (const t of TIRES) {
    const target = vehicle[t.axle];
    const st = tireStatus(last[t.key], target);
    if (st === 'warn' || st === 'bad') {
      const diff = last[t.key] - target;
      alerts.push({
        level: st === 'bad' ? 'overdue' : 'soon',
        title: `Llanta ${t.label.toLowerCase()} ${diff < 0 ? 'baja' : 'alta'}`,
        detail: `${last[t.key]} psi (recomendado ${target} psi).`,
      });
    }
  }
  return alerts;
}
