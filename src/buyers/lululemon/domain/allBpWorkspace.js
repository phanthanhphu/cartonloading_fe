// LULULEMON ALL_BP column semantics extracted without modifying calculation logic.
import { ALL_BP_SOURCE_ALIAS, ALL_BP_FORMULA_KEYS } from '../../../constants/appConstants';

export const value = (v) => (v === null || v === undefined || v === '' ? '—' : v);

export const headerKey = (input) => String(input || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '');


export const canonicalSourceKey = (label) => {
  const normalized = headerKey(label);
  return ALL_BP_SOURCE_ALIAS[normalized] || `RAW_${normalized || 'COLUMN'}`;
};




export const canonicalRowEntry = (sourceRow, canonical) => Object.entries(sourceRow || {})
  .find(([label]) => canonicalSourceKey(label) === canonical);

export const canonicalRowValue = (sourceRow, canonical) => canonicalRowEntry(sourceRow, canonical)?.[1] ?? '';


export const calculatedCartonMetrics = (row) => {
  const metrics = [];
  const sourceRows = Array.isArray(row?.allBpRows) ? row.allBpRows : [];

  for (const sourceRow of sourceRows) {
    const qty = Number(String(canonicalRowValue(sourceRow, 'QTY') ?? '').replace(/,/g, '').trim());
    const pcs = Number(String(canonicalRowValue(sourceRow, 'PCS_CTN') ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(qty) || !Number.isFinite(pcs) || qty <= 0 || pcs <= 0) continue;
    const quotient = qty / pcs;
    const fullCartons = Math.floor(quotient);
    metrics.push({
      // ALL_BP column "lẻ" is =Q'ty/Pcs/ctn and is formatted with 0 decimals in Excel.
      cartonRatio: Math.ceil(quotient),
      fullCartons,
      remainderQty: qty - (fullCartons * pcs)
    });
  }

  if (!metrics.length) {
    const qty = Number(row?.totalQty ?? row?.plannedTotalQty ?? 0);
    const pcs = Number(row?.qtyPerCarton ?? row?.pcsPerCarton ?? 0);
    if (Number.isFinite(qty) && Number.isFinite(pcs) && qty > 0 && pcs > 0) {
      const quotient = qty / pcs;
      const fullCartons = Math.floor(quotient);
      metrics.push({
        cartonRatio: Math.ceil(quotient),
        fullCartons,
        remainderQty: qty - (fullCartons * pcs)
      });
    }
  }
  return metrics;
};

export const numberValue = (raw, percent = false) => {
  const text = String(raw ?? '').trim();
  if (!text) return 0;
  const explicitPercent = text.endsWith('%');
  const parsed = Number(text.replace(/,/g, '').replace(/\$/g, '').replace(/%/g, '').trim());
  if (!Number.isFinite(parsed)) return 0;
  if (percent && (explicitPercent || Math.abs(parsed) > 1)) return parsed / 100;
  return parsed;
};

export const displayNumber = (raw, maxDecimals = 10) => {
  if (!Number.isFinite(raw)) return '';
  const fixed = raw.toFixed(maxDecimals);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};

export const setCanonicalPreview = (sourceRow, canonical, nextValue) => {
  const entry = canonicalRowEntry(sourceRow, canonical);
  if (!entry) return sourceRow;
  return { ...sourceRow, [entry[0]]: nextValue };
};

export const fallbackAllBpValue = (row, canonical) => ({
  PO: row.poNumber,
  MASTER_PO: row.masterPo,
  STYLE: row.styleNumber,
  DESCRIPTION: row.description,
  COLOR: row.color,
  QTY: row.totalQty,
  PCS_CTN: row.qtyPerCarton,
  DC_CODE: row.dcCode,
  DESTINATION: row.destination,
  CHANNEL: row.channel,
  PACKING_PLAN: row.packingPlan,
  SALES_ORDER_PTS: row.salesOrderPts,
  SHIP_MODE: row.shipMode,
  SEASON: row.season,
  FWD: row.fwd,
  CARTON_BOX_SIZE: row.cartonBoxSize,
  NW: row.netWeightKg,
  GW: row.grossWeightKg
}[canonical] ?? '');

export const recalculateAllBpPreview = (sourceRow) => {
  let next = { ...(sourceRow || {}) };
  const qty = Math.max(0, Math.trunc(numberValue(canonicalRowValue(next, 'QTY'))));
  const pcs = Math.max(0, Math.trunc(numberValue(canonicalRowValue(next, 'PCS_CTN'))));
  if (!qty || !pcs) return next;

  const fob = numberValue(canonicalRowValue(next, 'FOB_PRICE'));
  const care = numberValue(canonicalRowValue(next, 'CARE_CONTENT_LABEL'));
  const tag = numberValue(canonicalRowValue(next, 'CHINA_INSPECTION_TAG'));
  const dp = numberValue(canonicalRowValue(next, 'DP_PERCENT'), true);
  const odd = qty / pcs;
  const cartons = Math.floor(odd);
  const remainder = qty - (cartons * pcs);
  const combinedPrice = fob + care + tag;
  const ftyPrice = Math.round((combinedPrice * dp + Number.EPSILON) * 100) / 100;

  next = setCanonicalPreview(next, 'ODD_RATIO', displayNumber(odd));
  next = setCanonicalPreview(next, 'CTNS', String(cartons));
  next = setCanonicalPreview(next, 'REMAINDER', String(remainder));
  next = setCanonicalPreview(next, 'FOB_AMOUNT', displayNumber(qty * fob));
  next = setCanonicalPreview(next, 'TOTAL_FOB_PRICE_TAG', displayNumber(qty * combinedPrice));
  next = setCanonicalPreview(next, 'FOB_FTY_PRICE', ftyPrice.toFixed(2));
  next = setCanonicalPreview(next, 'FOB_FTY_AMOUNT', displayNumber(qty * ftyPrice));
  return next;
};

export const sourceValues = (row, canonical) => {
  const result = [];
  for (const sourceRow of Array.isArray(row?.allBpRows) ? row.allBpRows : []) {
    for (const [label, raw] of Object.entries(sourceRow || {})) {
      if (canonicalSourceKey(label) !== canonical) continue;
      const text = String(raw ?? '').trim();
      if (text) result.push(text);
    }
  }
  return result;
};

export const uniqueSourceValues = (row, canonical) => [...new Set(sourceValues(row, canonical))];

export const summedSourceNumber = (row, canonical) => {
  const values = sourceValues(row, canonical);
  if (!values.length) return null;
  const numbers = values.map((item) => Number(String(item).replace(/,/g, '')));
  if (numbers.some((item) => !Number.isFinite(item))) return null;
  return numbers.reduce((sum, item) => sum + item, 0);
};

export const sourceValue = (row, canonical) => {
  // These are record-level aggregates. Multiple ALL_BP rows are combined only
  // when the full LULULEMON 10-field business key is identical.
  if (canonical === 'PO') return value(row.poNumber);
  if (canonical === 'MASTER_PO') return value(row.masterPo);
  if (canonical === 'STYLE') return value(row.styleNumber);
  if (canonical === 'QTY') return value(row.totalQty);
  if (canonical === 'PCS_CTN') {
    const values = uniqueSourceValues(row, canonical);
    return values.length > 1 ? values.join(' | ') : value(row.qtyPerCarton ?? values[0]);
  }
  if (canonical === 'ODD_RATIO') {
    const metrics = calculatedCartonMetrics(row);
    return metrics.length ? metrics.map((item) => item.cartonRatio).join(' | ') : '—';
  }
  if (canonical === 'CTNS') {
    const metrics = calculatedCartonMetrics(row);
    if (metrics.length) return metrics.reduce((sum, item) => sum + item.fullCartons, 0);
    const total = summedSourceNumber(row, canonical);
    return total == null ? '—' : total;
  }
  if (canonical === 'REMAINDER') {
    const metrics = calculatedCartonMetrics(row);
    return metrics.length ? metrics.reduce((sum, item) => sum + item.remainderQty, 0) : '—';
  }

  // Formula columns always come from recalculated ALL_BP rows.
  if (ALL_BP_FORMULA_KEYS.includes(canonical)) {
    const calculatedValues = uniqueSourceValues(row, canonical);
    return calculatedValues.length ? calculatedValues.join(' | ') : '—';
  }

  // Editable PO-level values must override the original imported snapshot.
  // allBpRows remains an audit/source snapshot; the current PO record is the live value.
  const liveField = {
    DC_CODE: 'dcCode',
    DESTINATION: 'destination',
    CHANNEL: 'channel',
    PACKING_PLAN: 'packingPlan',
    SALES_ORDER_PTS: 'salesOrderPts',
    DESCRIPTION: 'description',
    COLOR: 'color',
    SIZE: 'size',
    SHIP_MODE: 'shipMode',
    SEASON: 'season',
    FWD: 'fwd',
    CARTON_BOX_SIZE: 'cartonBoxSize',
    NW: 'netWeightKg',
    GW: 'grossWeightKg'
  }[canonical];
  if (liveField) return value(row?.[liveField]);

  const fallbackSourceValues = uniqueSourceValues(row, canonical);
  if (fallbackSourceValues.length) return fallbackSourceValues.join(' | ');

  const fallback = {
    DC_CODE: row.dcCode,
    DESTINATION: row.destination,
    CHANNEL: row.channel,
    PACKING_PLAN: row.packingPlan,
    SALES_ORDER_PTS: row.salesOrderPts,
    DESCRIPTION: row.description,
    COLOR: row.color,
    SIZE: row.size,
    SHIP_MODE: row.shipMode,
    SEASON: row.season,
    FWD: row.fwd,
    CARTON_BOX_SIZE: row.cartonBoxSize,
    NW: row.netWeightKg,
    GW: row.grossWeightKg
  }[canonical];

  return value(fallback);
};
