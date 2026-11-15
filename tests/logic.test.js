import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../logic.js';

test('addMonths respeta fin de mes y cambio de año', () => {
  assert.equal(L.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(L.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(L.addMonths('2026-11-15', 6), '2027-05-15');
  assert.equal(L.addMonths('2026-03-10', 24), '2028-03-10');
});

test('daysBetween', () => {
  assert.equal(L.daysBetween('2026-11-15', '2026-12-15'), 30);
  assert.equal(L.daysBetween('2026-11-15', '2026-11-10'), -5);
});

test('dueStatus: lo que ocurra primero', () => {
  const t = '2026-11-15';
  assert.equal(L.dueStatus(null, null, 50000, t).status, 'unknown');
  assert.equal(L.dueStatus(60000, '2027-06-01', 50000, t).status, 'ok');
  assert.equal(L.dueStatus(50800, '2027-06-01', 50000, t).status, 'soon');
  assert.equal(L.dueStatus(60000, '2026-12-01', 50000, t).status, 'soon');
  assert.equal(L.dueStatus(49999, '2027-06-01', 50000, t).status, 'overdue');
  assert.equal(L.dueStatus(60000, '2026-11-14', 50000, t).status, 'overdue');
  assert.deepEqual(L.dueStatus(51000, null, 50000, t), { dueKm: 51000, dueDate: null, kmLeft: 1000, daysLeft: null, status: 'soon' });
});

test('consumableDue y desgaste', () => {
  const c = { lastKm: 40000, lastDate: '2026-05-15', intervalKm: 10000, intervalMonths: 12 };
  assert.deepEqual(L.consumableDue(c), { dueKm: 50000, dueDate: '2027-05-15' });
  assert.equal(L.consumableWear(c, 47500, '2026-11-15'), 0.75);
  assert.deepEqual(L.consumableDue({ intervalKm: 10000 }), { dueKm: null, dueDate: null });
  assert.equal(L.consumableWear({ intervalKm: 10000 }, 100, '2026-11-15'), null);
});

test('tireStatus', () => {
  assert.equal(L.tireStatus(32, 32), 'ok');
  assert.equal(L.tireStatus(30, 32), 'ok');
  assert.equal(L.tireStatus(28, 32), 'warn');
  assert.equal(L.tireStatus(26, 32), 'bad');
  assert.equal(L.tireStatus(38, 32), 'bad');
  assert.equal(L.tireStatus(null, 32), 'unknown');
});

test('dueItems ordena por urgencia e ignora servicios realizados', () => {
  const v = {
    odometer: 50000,
    services: [
      { id: 's1', status: 'done', type: 'Afinación', date: '2026-01-01' },
      { id: 's2', status: 'scheduled', type: 'Alineación', dueDate: '2026-12-01' },
    ],
    consumables: [
      { id: 'c1', name: 'Aceite', intervalKm: 10000, lastKm: 39000 },
      { id: 'c2', name: 'Batería', intervalMonths: 48, lastDate: '2026-01-01' },
      { id: 'c3', name: 'Bujías', intervalKm: 60000 },
    ],
  };
  const items = L.dueItems(v, '2026-11-15');
  assert.deepEqual(items.map((i) => [i.id, i.status]), [['c1', 'overdue'], ['s2', 'soon'], ['c2', 'ok'], ['c3', 'unknown']]);
});

test('tireAlerts', () => {
  const base = { pressureFront: 32, pressureRear: 30 };
  assert.equal(L.tireAlerts({ ...base, tires: [] }, '2026-11-15')[0].title, 'Sin lecturas de presión');
  const ok = { date: '2026-11-10', fl: 32, fr: 32, rl: 30, rr: 30 };
  assert.deepEqual(L.tireAlerts({ ...base, tires: [ok] }, '2026-11-15'), []);
  const old = L.tireAlerts({ ...base, tires: [{ ...ok, date: '2026-09-01' }] }, '2026-11-15');
  assert.equal(old.length, 1);
  const low = L.tireAlerts({ ...base, tires: [ok, { ...ok, date: '2026-11-14', rr: 22 }] }, '2026-11-15');
  assert.deepEqual(low.map((a) => [a.level, a.title]), [['overdue', 'Llanta trasera der. baja']]);
});
