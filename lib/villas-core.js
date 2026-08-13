const crypto = require('crypto');

function parseArrayField(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((part) => String(part || '').trim())
        .filter(Boolean);
    }
    return [];
  }
}

function normalizeQtyStep(value, fallbackType) {
  const num = parseInt(value, 10);
  if (Number.isInteger(num) && num > 0) return num;
  return String(fallbackType || '').toLowerCase().includes('pack') ? 1 : 12;
}

function normalizeSeason(value) {
  const season = String(value || 'ambos').toLowerCase();
  return ['inverno', 'verao', 'ambos'].includes(season) ? season : 'ambos';
}

function buildPublicOrderNumber(orderId, createdAt) {
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = date && !Number.isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear();
  const num = String(Math.max(1, parseInt(orderId, 10) || 0)).padStart(6, '0');
  return `VLS-${year}-${num}`;
}

function getOrderSummary(items) {
  const lines = Array.isArray(items) ? items.length : 0;
  const units = Array.isArray(items)
    ? items.reduce((sum, item) => sum + Number(item.qty || 0), 0)
    : 0;
  const total = Array.isArray(items)
    ? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0)
    : 0;
  return { lines, units, total };
}

function normalizeChoiceText(value) {
  return String(value || '').trim();
}

function cartItemKey(item) {
  return [normalizeChoiceText(item.ref), normalizeChoiceText(item.cor), normalizeChoiceText(item.tam)].join('|');
}

function createRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  parseArrayField,
  normalizeQtyStep,
  normalizeSeason,
  normalizeChoiceText,
  buildPublicOrderNumber,
  getOrderSummary,
  cartItemKey,
  createRequestId
};
