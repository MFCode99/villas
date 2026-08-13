const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArrayField,
  normalizeQtyStep,
  normalizeSeason,
  buildPublicOrderNumber,
  getOrderSummary,
  cartItemKey,
  createRequestId
} = require('../lib/villas-core');

test('parseArrayField accepts JSON arrays and comma-separated strings', () => {
  assert.deepEqual(parseArrayField('["A","B"]'), ['A', 'B']);
  assert.deepEqual(parseArrayField('A, B , C'), ['A', 'B', 'C']);
});

test('normalizeQtyStep keeps explicit steps and falls back by type', () => {
  assert.equal(normalizeQtyStep('12', 'Anything'), 12);
  assert.equal(normalizeQtyStep('', 'Pack 3'), 1);
  assert.equal(normalizeQtyStep(null, 'Collant'), 12);
});

test('normalizeSeason only accepts supported modes', () => {
  assert.equal(normalizeSeason('inverno'), 'inverno');
  assert.equal(normalizeSeason('verao'), 'verao');
  assert.equal(normalizeSeason('anything'), 'ambos');
});

test('buildPublicOrderNumber is stable and padded', () => {
  assert.equal(buildPublicOrderNumber(501, '2026-03-26T21:00:00Z'), 'VLS-2026-000501');
  assert.equal(buildPublicOrderNumber(7, '2024-01-01T00:00:00Z'), 'VLS-2024-000007');
});

test('getOrderSummary computes lines, units and totals', () => {
  const summary = getOrderSummary([
    { qty: 12, price: 1.5 },
    { qty: 1, price: 2.25 }
  ]);
  assert.equal(summary.lines, 2);
  assert.equal(summary.units, 13);
  assert.equal(summary.total, 20.25);
});

test('cartItemKey isolates variants and request ids stay unique', () => {
  assert.equal(cartItemKey({ ref: '2145', cor: 'PRETO', tam: 'Unico' }), '2145|PRETO|Unico');
  const id1 = createRequestId();
  const id2 = createRequestId();
  assert.ok(id1);
  assert.ok(id2);
  assert.notEqual(id1, id2);
});

test('revisioned cart store rejects stale writes deterministically', () => {
  const store = {
    revision: 0,
    items: []
  };

  function put(revision, items){
    if (revision !== store.revision) {
      return { ok: false, revision: store.revision, items: store.items.slice() };
    }
    store.revision += 1;
    store.items = items.slice();
    return { ok: true, revision: store.revision, items: store.items.slice() };
  }

  const first = put(0, [{ ref: '2145', cor: 'PRETO', tam: 'Unico', qty: 12 }]);
  const stale = put(0, [{ ref: '2145', cor: 'AZUL', tam: 'Unico', qty: 12 }]);
  const second = put(first.revision, [{ ref: '2145', cor: 'AZUL', tam: 'Unico', qty: 12 }]);

  assert.equal(first.ok, true);
  assert.equal(first.revision, 1);
  assert.equal(stale.ok, false);
  assert.equal(stale.revision, 1);
  assert.equal(second.ok, true);
  assert.equal(second.revision, 2);
  assert.equal(store.items[0].cor, 'AZUL');
});
