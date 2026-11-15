import * as L from './logic.js';

// ───────────────────────── Estado y persistencia ─────────────────────────
const KEY = 'auto-mantenimiento:v1';
const emptyState = () => ({ version: 1, activeVehicleId: null, vehicles: [] });

function normalize(data) {
  if (!data || !Array.isArray(data.vehicles)) return null;
  for (const v of data.vehicles) {
    v.id ||= uid();
    v.name = String(v.name || 'Vehículo');
    for (const k of ['tires', 'services', 'consumables']) if (!Array.isArray(v[k])) v[k] = [];
  }
  return { version: 1, activeVehicleId: data.activeVehicleId ?? null, vehicles: data.vehicles };
}

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY))) || emptyState();
  } catch {
    return emptyState();
  }
}

let saveFailed = false;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let state = load();
const vehicle = () => state.vehicles.find((v) => v.id === state.activeVehicleId) || state.vehicles[0] || null;

// Consumibles sugeridos al dar de alta un vehículo (intervalos típicos; ajustar según el manual).
const DEFAULT_CONSUMABLES = [
  ['Aceite de motor', 10000, 12],
  ['Filtro de aceite', 10000, 12],
  ['Filtro de aire', 20000, 24],
  ['Filtro de cabina', 15000, 12],
  ['Balatas / pastillas de freno', 40000, null],
  ['Líquido de frenos', null, 24],
  ['Anticongelante / refrigerante', 60000, 48],
  ['Bujías', 60000, null],
  ['Batería', null, 48],
  ['Llantas', 60000, 60],
  ['Plumas limpiaparabrisas', null, 12],
  ['Rotación de llantas', 10000, null],
];
const SERVICE_TYPES = [
  'Cambio de aceite y filtro', 'Afinación', 'Servicio mayor', 'Alineación y balanceo', 'Rotación de llantas',
  'Frenos', 'Suspensión', 'Batería', 'Verificación vehicular', 'Lavado y detallado',
];

// ───────────────────────── Utilidades de presentación ─────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = new Intl.NumberFormat('es-MX');
const km = (n) => (n == null ? '—' : `${nf.format(n)} km`);
const money = (n) => (n == null ? '' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n));
const fdate = (iso) => (iso ? new Date(`${iso}T00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const STATUS_LABEL = { ok: 'Al día', soon: 'Próximo', overdue: 'Vencido', unknown: 'Sin registro' };
const TIRE_LABEL = { ok: 'Correcta', warn: 'Revisar', bad: 'Crítica', unknown: 'Sin dato' };
const badge = (status) => `<span class="badge ${status}">${STATUS_LABEL[status]}</span>`;

function plural(n, one, many) {
  return `${nf.format(n)} ${n === 1 ? one : many}`;
}

/** "faltan 1,200 km · 45 días" / "vencido por 300 km". */
function dueText(i) {
  if (i.status === 'unknown') return 'Registra el último cambio para calcular el próximo.';
  const over = [];
  const left = [];
  if (i.kmLeft != null) (i.kmLeft < 0 ? over : left).push(km(Math.abs(i.kmLeft)));
  if (i.daysLeft != null) (i.daysLeft < 0 ? over : left).push(plural(Math.abs(i.daysLeft), 'día', 'días'));
  return over.length ? `Vencido por ${over.join(' y ')}` : `Faltan ${left.join(' o ')}`;
}

function dueWhen(i) {
  const parts = [];
  if (i.dueKm != null) parts.push(`a los ${km(i.dueKm)}`);
  if (i.dueDate) parts.push(`el ${fdate(i.dueDate)}`);
  return parts.join(' o ');
}

// ───────────────────────── Formularios (un solo <dialog>) ─────────────────────────
const dlg = document.getElementById('dialog');

function fieldHTML(f) {
  const id = `f-${f.name}`;
  const common = `id="${id}" name="${f.name}" ${f.required ? 'required' : ''}`;
  const val = f.value ?? '';
  let input;
  if (f.type === 'textarea') input = `<textarea ${common}>${esc(val)}</textarea>`;
  else if (f.type === 'number') {
    input = `<input ${common} type="number" inputmode="decimal" min="${f.min ?? 0}" step="${f.step ?? 1}" value="${esc(val)}">`;
  } else {
    const list = f.list ? `list="${id}-list"` : '';
    input = `<input ${common} type="${f.type || 'text'}" ${list} value="${esc(val)}" ${f.max ? `max="${f.max}"` : ''}>`;
    if (f.list) input += `<datalist id="${id}-list">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`;
  }
  return `<label class="${f.full || f.type === 'textarea' ? 'full' : ''}" for="${id}">${esc(f.label)}${input}</label>`;
}

/**
 * onSubmit(values) devuelve un mensaje de error (string) o nada si todo salió bien.
 * Los campos numéricos vacíos llegan como null.
 */
function openForm({ title, intro, fields, submitLabel = 'Guardar', onSubmit, onDelete }) {
  dlg.innerHTML = `
    <form>
      <h2>${esc(title)}</h2>
      ${intro ? `<p class="muted">${esc(intro)}</p>` : ''}
      <div class="fields">${fields.map(fieldHTML).join('')}</div>
      <p class="error" role="alert" hidden></p>
      <div class="form-actions">
        ${onDelete ? '<button type="button" class="btn danger" data-del>Eliminar</button>' : ''}
        <button type="button" class="btn" data-cancel>Cancelar</button>
        <button class="btn primary">${esc(submitLabel)}</button>
      </div>
    </form>`;
  const form = dlg.querySelector('form');
  const done = () => {
    dlg.close();
    save();
    render();
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = {};
    for (const f of fields) {
      const raw = form.elements[f.name].value.trim();
      values[f.name] = f.type === 'number' ? (raw === '' || Number.isNaN(Number(raw)) ? null : Number(raw)) : raw;
    }
    const err = onSubmit(values);
    if (err) {
      const p = form.querySelector('.error');
      p.textContent = err;
      p.hidden = false;
      return;
    }
    done();
  });
  form.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
  form.querySelector('[data-del]')?.addEventListener('click', () => {
    if (confirm('¿Eliminar este registro? No se puede deshacer.')) {
      onDelete();
      done();
    }
  });
  dlg.showModal();
}

const bumpOdometer = (v, value) => {
  if (value != null && value > (v.odometer ?? 0)) v.odometer = value;
};

function vehicleForm(v) {
  openForm({
    title: v ? 'Editar vehículo' : 'Nuevo vehículo',
    fields: [
      { name: 'name', label: 'Nombre o alias', required: true, value: v?.name, full: true },
      { name: 'make', label: 'Marca', value: v?.make },
      { name: 'model', label: 'Modelo', value: v?.model },
      { name: 'year', label: 'Año', type: 'number', min: 1900, value: v?.year },
      { name: 'plate', label: 'Placas', value: v?.plate },
      { name: 'odometer', label: 'Kilometraje actual (km)', type: 'number', required: true, value: v?.odometer, full: true },
      { name: 'pressureFront', label: 'Presión delantera (psi)', type: 'number', step: 0.5, required: true, value: v?.pressureFront ?? 32 },
      { name: 'pressureRear', label: 'Presión trasera (psi)', type: 'number', step: 0.5, required: true, value: v?.pressureRear ?? 32 },
    ],
    intro: v ? '' : 'La presión recomendada viene en la etiqueta del marco de la puerta del conductor.',
    onSubmit(values) {
      if (v) Object.assign(v, values);
      else {
        const nv = {
          id: uid(), ...values, tires: [], services: [],
          consumables: DEFAULT_CONSUMABLES.map(([name, intervalKm, intervalMonths]) => ({
            id: uid(), name, intervalKm, intervalMonths, lastDate: '', lastKm: null, notes: '',
          })),
        };
        state.vehicles.push(nv);
        state.activeVehicleId = nv.id;
      }
    },
  });
}

function odometerForm(v) {
  openForm({
    title: 'Actualizar kilometraje',
    fields: [{ name: 'odometer', label: 'Kilometraje actual (km)', type: 'number', required: true, value: v.odometer, full: true }],
    onSubmit(values) {
      v.odometer = values.odometer;
    },
  });
}

function tireForm(v, r) {
  const today = L.todayISO();
  openForm({
    title: r ? 'Editar lectura de presión' : 'Registrar presión',
    intro: `Mide en frío. Recomendado: ${v.pressureFront} psi adelante, ${v.pressureRear} psi atrás.`,
    fields: [
      { name: 'date', label: 'Fecha', type: 'date', required: true, value: r?.date ?? today, max: today, full: true },
      ...L.TIRES.map((t) => ({ name: t.key, label: `${t.label} (psi)`, type: 'number', step: 0.5, required: true, value: r?.[t.key] ?? v[t.axle] })),
      { name: 'notes', label: 'Notas', type: 'textarea', value: r?.notes },
    ],
    onSubmit(values) {
      if (r) Object.assign(r, values);
      else v.tires.push({ id: uid(), ...values });
    },
    onDelete: r && (() => (v.tires = v.tires.filter((x) => x !== r))),
  });
}

/** Servicio realizado. Si `from` es un servicio programado, lo convierte en realizado. */
function serviceDoneForm(v, s, from) {
  const today = L.todayISO();
  openForm({
    title: from ? 'Completar servicio' : s ? 'Editar servicio' : 'Registrar servicio realizado',
    fields: [
      { name: 'type', label: 'Servicio', required: true, value: s?.type ?? from?.type, list: SERVICE_TYPES, full: true },
      { name: 'date', label: 'Fecha', type: 'date', required: true, value: s?.date ?? today, max: today },
      { name: 'km', label: 'Kilometraje (km)', type: 'number', value: s?.km ?? v.odometer },
      { name: 'cost', label: 'Costo ($)', type: 'number', step: 0.01, value: s?.cost },
      { name: 'shop', label: 'Taller', value: s?.shop },
      { name: 'notes', label: 'Notas', type: 'textarea', value: s?.notes ?? from?.notes },
    ],
    onSubmit(values) {
      const target = s || from;
      if (target) {
        Object.assign(target, values, { status: 'done' });
        delete target.dueDate;
        delete target.dueKm;
      } else v.services.push({ id: uid(), status: 'done', ...values });
      bumpOdometer(v, values.km);
    },
    onDelete: s && (() => (v.services = v.services.filter((x) => x !== s))),
  });
}

function serviceScheduledForm(v, s) {
  openForm({
    title: s ? 'Editar servicio programado' : 'Programar servicio',
    intro: 'Indica fecha, kilometraje o ambos; se avisa con lo que ocurra primero.',
    fields: [
      { name: 'type', label: 'Servicio', required: true, value: s?.type, list: SERVICE_TYPES, full: true },
      { name: 'dueDate', label: 'Fecha programada', type: 'date', value: s?.dueDate },
      { name: 'dueKm', label: 'Al llegar a (km)', type: 'number', value: s?.dueKm },
      { name: 'notes', label: 'Notas', type: 'textarea', value: s?.notes },
    ],
    onSubmit(values) {
      if (!values.dueDate && values.dueKm == null) return 'Indica una fecha o un kilometraje.';
      if (s) Object.assign(s, values);
      else v.services.push({ id: uid(), status: 'scheduled', ...values });
    },
    onDelete: s && (() => (v.services = v.services.filter((x) => x !== s))),
  });
}

function consumableForm(v, c) {
  openForm({
    title: c ? 'Editar consumible' : 'Nuevo consumible',
    intro: 'Intervalo por kilometraje, por tiempo o ambos (lo que ocurra primero).',
    fields: [
      { name: 'name', label: 'Consumible', required: true, value: c?.name, full: true },
      { name: 'intervalKm', label: 'Cada (km)', type: 'number', min: 1, value: c?.intervalKm },
      { name: 'intervalMonths', label: 'Cada (meses)', type: 'number', min: 1, value: c?.intervalMonths },
      { name: 'lastDate', label: 'Último cambio (fecha)', type: 'date', value: c?.lastDate, max: L.todayISO() },
      { name: 'lastKm', label: 'Último cambio (km)', type: 'number', value: c?.lastKm },
      { name: 'notes', label: 'Notas (marca, especificación…)', type: 'textarea', value: c?.notes },
    ],
    onSubmit(values) {
      if (!values.intervalKm && !values.intervalMonths) return 'Indica al menos un intervalo (km o meses).';
      if (c) Object.assign(c, values);
      else v.consumables.push({ id: uid(), ...values });
    },
    onDelete: c && (() => (v.consumables = v.consumables.filter((x) => x !== c))),
  });
}

/** Registra el reemplazo: reinicia el contador y deja constancia en la bitácora. */
function replaceForm(v, c) {
  const today = L.todayISO();
  openForm({
    title: `Reemplazar: ${c.name}`,
    submitLabel: 'Registrar reemplazo',
    intro: 'Se agregará también a la bitácora de servicios.',
    fields: [
      { name: 'date', label: 'Fecha', type: 'date', required: true, value: today, max: today },
      { name: 'km', label: 'Kilometraje (km)', type: 'number', required: true, value: v.odometer },
      { name: 'cost', label: 'Costo ($)', type: 'number', step: 0.01 },
      { name: 'shop', label: 'Taller' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
    ],
    onSubmit(values) {
      c.lastDate = values.date;
      c.lastKm = values.km;
      v.services.push({ id: uid(), status: 'done', type: `Reemplazo: ${c.name}`, ...values });
      bumpOdometer(v, values.km);
    },
  });
}

// ───────────────────────── Vistas ─────────────────────────
const CAR_SVG = `<svg viewBox="0 0 60 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.500">
  <rect x="8" y="4" width="44" height="112" rx="16"/><path d="M14 40q16-8 32 0l-3 14H17zM17 84h26l3 12q-16 6-32 0z"/></svg>`;

function tireDiagram(v, reading) {
  return `<div class="tires">
    ${L.TIRES.map((t) => {
      const st = reading ? L.tireStatus(reading[t.key], v[t.axle]) : 'unknown';
      return `<div class="tire ${st}" style="grid-area:${t.key}">
        <span>${t.label}</span><b>${reading ? esc(reading[t.key]) : '—'}</b>
        <small>${reading ? `psi · ${TIRE_LABEL[st]}` : 'psi'}</small></div>`;
    }).join('')}
    <div class="car">${CAR_SVG}</div>
  </div>`;
}

function dueRow(i, action) {
  return `<li>
    <div class="item"><b>${esc(i.title)}</b><span class="muted">${esc(dueText(i))}</span></div>
    <div class="side">${badge(i.status)}${action || ''}</div></li>`;
}

function viewResumen(v, today) {
  const items = L.dueItems(v, today);
  const alerts = [
    ...L.tireAlerts(v, today),
    ...items.filter((i) => i.status === 'overdue' || i.status === 'soon').map((i) => ({
      level: i.status,
      title: `${i.kind === 'service' ? 'Servicio' : 'Reemplazar'}: ${i.title}`,
      detail: dueText(i),
    })),
  ].sort((a, b) => (a.level === 'overdue' ? 0 : 1) - (b.level === 'overdue' ? 0 : 1));
  const last = L.latestReading(v);
  const upcoming = items.filter((i) => i.status === 'ok').slice(0, 4);
  const sub = [v.make, v.model, v.year].filter(Boolean).join(' ');
  return `
    <section class="card">
      <div class="row">
        <div><h2>${esc(v.name)}</h2><p class="muted">${esc(sub)}${v.plate ? ` · ${esc(v.plate)}` : ''}</p></div>
        <div class="side"><span class="big">${km(v.odometer)}</span>
          <button class="btn small" data-action="odometer">Actualizar kilometraje</button></div>
      </div>
    </section>
    <section class="card">
      <header><h2>Atención</h2><span class="muted">${alerts.length ? plural(alerts.length, 'pendiente', 'pendientes') : ''}</span></header>
      ${alerts.length
        ? `<ul class="list">${alerts.map((a) => `<li class="alert ${a.level}"><div class="item"><b>${esc(a.title)}</b><span class="muted">${esc(a.detail)}</span></div></li>`).join('')}</ul>`
        : '<p class="empty">Todo al día. Nada pendiente por ahora.</p>'}
    </section>
    <section class="card">
      <header><h2>Presión de llantas</h2><span class="muted">${last ? fdate(last.date) : 'Sin lecturas'}</span></header>
      ${tireDiagram(v, last)}
      <div class="actions"><button class="btn primary" data-action="tire-add">Registrar presión</button></div>
    </section>
    ${upcoming.length ? `<section class="card"><header><h2>Más adelante</h2></header><ul class="list">${upcoming.map((i) => dueRow(i)).join('')}</ul></section>` : ''}`;
}

function viewLlantas(v) {
  const last = L.latestReading(v);
  const history = [...v.tires].reverse().sort((a, b) => b.date.localeCompare(a.date));
  const cell = (r, t) => {
    const st = L.tireStatus(r[t.key], v[t.axle]);
    return `<td class="${st}">${esc(r[t.key])}</td>`;
  };
  return `
    <section class="card">
      <header><h2>Última lectura</h2><span class="muted">${last ? fdate(last.date) : 'Sin lecturas'}</span></header>
      ${tireDiagram(v, last)}
      <p class="muted">Recomendado: ${esc(v.pressureFront)} psi adelante · ${esc(v.pressureRear)} psi atrás.
        Correcta ±${L.PRESSURE_OK} psi; crítica a más de ±${L.PRESSURE_WARN} psi.</p>
      <div class="actions"><button class="btn primary" data-action="tire-add">Registrar presión</button></div>
    </section>
    <section class="card">
      <header><h2>Historial</h2><span class="muted">${plural(history.length, 'lectura', 'lecturas')}</span></header>
      ${history.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Del. izq.</th><th>Del. der.</th><th>Tras. izq.</th><th>Tras. der.</th><th></th></tr></thead>
        <tbody>${history.map((r) => `<tr><td>${fdate(r.date)}${r.notes ? `<br><span class="muted">${esc(r.notes)}</span>` : ''}</td>
          ${L.TIRES.map((t) => cell(r, t)).join('')}
          <td><button class="btn small" data-action="tire-edit" data-id="${r.id}">Editar</button></td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="empty">Aún no hay lecturas registradas.</p>'}
    </section>`;
}

function viewBitacora(v, today) {
  const scheduled = L.dueItems(v, today).filter((i) => i.kind === 'service');
  const done = v.services.filter((s) => s.status === 'done').reverse().sort((a, b) => b.date.localeCompare(a.date));
  const year = today.slice(0, 4);
  const spent = done.filter((s) => s.date.startsWith(year)).reduce((sum, s) => sum + (s.cost || 0), 0);
  return `
    <section class="card">
      <header><h2>Programados</h2><button class="btn" data-action="sched-add">Programar servicio</button></header>
      ${scheduled.length ? `<ul class="list">${scheduled.map((i) => `<li>
        <div class="item"><b>${esc(i.title)}</b><span class="muted">${esc(dueWhen(i))} · ${esc(dueText(i))}</span></div>
        <div class="side">${badge(i.status)}<div class="actions">
          <button class="btn small" data-action="sched-edit" data-id="${i.id}">Editar</button>
          <button class="btn small primary" data-action="sched-done" data-id="${i.id}">Completar</button></div></div></li>`).join('')}</ul>`
        : '<p class="empty">No hay servicios programados.</p>'}
    </section>
    <section class="card">
      <header><h2>Realizados</h2><button class="btn primary" data-action="svc-add">Registrar servicio</button></header>
      ${spent ? `<p class="muted">Gasto en ${year}: <b>${money(spent)}</b></p>` : ''}
      ${done.length ? `<ul class="list">${done.map((s) => `<li>
        <div class="item"><b>${esc(s.type)}</b>
          <span class="muted">${fdate(s.date)}${s.km != null ? ` · ${km(s.km)}` : ''}${s.shop ? ` · ${esc(s.shop)}` : ''}</span>
          ${s.notes ? `<span class="muted">${esc(s.notes)}</span>` : ''}</div>
        <div class="side">${s.cost != null ? `<b>${money(s.cost)}</b>` : ''}
          <button class="btn small" data-action="svc-edit" data-id="${s.id}">Editar</button></div></li>`).join('')}</ul>`
        : '<p class="empty">Aún no hay servicios registrados.</p>'}
    </section>`;
}

function viewConsumibles(v, today) {
  const items = L.dueItems(v, today).filter((i) => i.kind === 'consumable');
  return `
    <section class="card">
      <header><h2>Consumibles</h2><button class="btn" data-action="cons-add">Agregar</button></header>
      ${items.length ? `<ul class="list">${items.map((i) => {
        const c = v.consumables.find((x) => x.id === i.id);
        const wear = L.consumableWear(c, v.odometer, today);
        const every = [c.intervalKm && `cada ${km(c.intervalKm)}`, c.intervalMonths && `cada ${plural(c.intervalMonths, 'mes', 'meses')}`].filter(Boolean).join(' o ');
        const lastTxt = c.lastDate || c.lastKm != null
          ? `Último: ${[c.lastDate && fdate(c.lastDate), c.lastKm != null && km(c.lastKm)].filter(Boolean).join(' · ')}`
          : '';
        return `<li class="${i.status}">
          <div class="item"><b>${esc(c.name)}</b>
            <span class="muted">${esc(every)}${lastTxt ? ` · ${esc(lastTxt)}` : ''}</span>
            <span class="muted">${esc(dueText(i))}${i.status !== 'unknown' ? ` (${esc(dueWhen(i))})` : ''}</span>
            ${wear != null ? `<div class="bar" role="img" aria-label="Vida útil consumida: ${Math.round(wear * 100)}%"><i style="width:${Math.min(100, wear * 100)}%"></i></div>` : ''}
            ${c.notes ? `<span class="muted">${esc(c.notes)}</span>` : ''}</div>
          <div class="side">${badge(i.status)}<div class="actions">
            <button class="btn small" data-action="cons-edit" data-id="${c.id}">Editar</button>
            <button class="btn small primary" data-action="cons-replace" data-id="${c.id}">Reemplazar</button></div></div></li>`;
      }).join('')}</ul>` : '<p class="empty">No hay consumibles. Agrega el primero.</p>'}
    </section>`;
}

function viewVehiculo(v) {
  return `
    <section class="card">
      <header><h2>Vehículos</h2><button class="btn primary" data-action="veh-add">Agregar vehículo</button></header>
      <ul class="list">${state.vehicles.map((x) => `<li>
        <div class="item"><b>${esc(x.name)}</b>
          <span class="muted">${esc([x.make, x.model, x.year].filter(Boolean).join(' '))}${x.plate ? ` · ${esc(x.plate)}` : ''} · ${km(x.odometer)}</span></div>
        <div class="side"><div class="actions">
          <button class="btn small" data-action="veh-edit" data-id="${x.id}">Editar</button>
          <button class="btn small danger" data-action="veh-del" data-id="${x.id}">Eliminar</button></div></div></li>`).join('')}</ul>
    </section>
    <section class="card">
      <header><h2>Respaldo de datos</h2></header>
      <p class="muted">Los datos se guardan sólo en este navegador. Exporta un respaldo para no perderlos o para pasarlos a otro dispositivo.</p>
      <div class="actions">
        <button class="btn" data-action="export">Exportar respaldo</button>
        <button class="btn" data-action="import">Importar respaldo</button>
      </div>
    </section>`;
}

// ───────────────────────── Render y navegación ─────────────────────────
const ICON = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TABS = [
  ['resumen', 'Resumen', ICON('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'), viewResumen],
  ['llantas', 'Llantas', ICON('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>'), viewLlantas],
  ['bitacora', 'Bitácora', ICON('<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h4"/>'), viewBitacora],
  ['consumibles', 'Consumibles', ICON('<path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/>'), viewConsumibles],
  ['vehiculo', 'Vehículo', ICON('<path d="M4 16l1.500-6A3 3 0 0 1 8.400 8h7.200a3 3 0 0 1 2.900 2l1.500 6v3h-3v-2H7v2H4z"/><path d="M7.500 14h.01M16.500 14h.01"/>'), viewVehiculo],
];
const currentTab = () => TABS.find((t) => t[0] === location.hash.slice(1)) || TABS[0];

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const picker = document.getElementById('vehicle-picker');

function render() {
  const v = vehicle();
  const today = L.todayISO();
  const warn = saveFailed ? '<p class="error">No se pudo guardar en este navegador (almacenamiento bloqueado o lleno). Exporta un respaldo.</p>' : '';
  if (!v) {
    picker.innerHTML = '';
    nav.innerHTML = '';
    app.innerHTML = `${warn}<section class="card">
      <h2>Bienvenido</h2>
      <p>Lleva el control de la presión de llantas, la bitácora de servicios y los consumibles de tu automóvil.</p>
      <div class="actions"><button class="btn primary" data-action="veh-add">Agregar mi vehículo</button>
        <button class="btn" data-action="import">Importar respaldo</button></div>
    </section>`;
    return;
  }
  picker.innerHTML = state.vehicles.length > 1
    ? `<select aria-label="Vehículo activo">${state.vehicles.map((x) => `<option value="${x.id}" ${x === v ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`
    : `<span class="muted">${esc(v.name)}</span>`;
  const tab = currentTab();
  const pending = L.tireAlerts(v, today).length + L.dueItems(v, today).filter((i) => i.status === 'overdue' || i.status === 'soon').length;
  nav.innerHTML = TABS.map(([id, label, icon]) => `<a href="#${id}" ${id === tab[0] ? 'aria-current="page"' : ''}>${icon}${label}
    ${id === 'resumen' && pending ? `<span class="dot" aria-label="${pending} pendientes">${pending}</span>` : ''}</a>`).join('');
  app.innerHTML = warn + tab[3](v, today);
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `auto-mantenimiento-${L.todayISO()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    let data = null;
    try {
      data = normalize(JSON.parse(await file.text()));
    } catch { /* se informa abajo */ }
    if (!data) return alert('El archivo no es un respaldo válido.');
    if (state.vehicles.length && !confirm('Importar reemplazará todos los datos actuales. ¿Continuar?')) return;
    state = data;
    save();
    render();
  });
  input.click();
}

const ACTIONS = {
  'veh-add': () => vehicleForm(),
  'veh-edit': (v, id) => vehicleForm(state.vehicles.find((x) => x.id === id)),
  'veh-del': (v, id) => {
    const x = state.vehicles.find((y) => y.id === id);
    if (!x || !confirm(`¿Eliminar "${x.name}" con todo su historial? No se puede deshacer.`)) return;
    state.vehicles = state.vehicles.filter((y) => y !== x);
    if (state.activeVehicleId === id) state.activeVehicleId = state.vehicles[0]?.id ?? null;
    save();
    render();
  },
  odometer: (v) => odometerForm(v),
  'tire-add': (v) => tireForm(v),
  'tire-edit': (v, id) => tireForm(v, v.tires.find((x) => x.id === id)),
  'svc-add': (v) => serviceDoneForm(v),
  'svc-edit': (v, id) => serviceDoneForm(v, v.services.find((x) => x.id === id)),
  'sched-add': (v) => serviceScheduledForm(v),
  'sched-edit': (v, id) => serviceScheduledForm(v, v.services.find((x) => x.id === id)),
  'sched-done': (v, id) => serviceDoneForm(v, null, v.services.find((x) => x.id === id)),
  'cons-add': (v) => consumableForm(v),
  'cons-edit': (v, id) => consumableForm(v, v.consumables.find((x) => x.id === id)),
  'cons-replace': (v, id) => replaceForm(v, v.consumables.find((x) => x.id === id)),
  export: exportData,
  import: importData,
};

app.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (btn) ACTIONS[btn.dataset.action]?.(vehicle(), btn.dataset.id);
});
picker.addEventListener('change', (e) => {
  state.activeVehicleId = e.target.value;
  save();
  render();
});
addEventListener('hashchange', () => {
  render();
  scrollTo(0, 0);
});
// Otra pestaña modificó los datos: recargar para no sobrescribirlos.
addEventListener('storage', (e) => {
  if (e.key === KEY && !dlg.open) {
    state = load();
    render();
  }
});

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
