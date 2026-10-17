/** Read-only UI view helpers for LULULEMON PO Picking.
 * Kept separate from the existing Orders/ALL_BP workflow so its business
 * calculations, import, and carton processing remain untouched.
 */
import {
  ALL_BP_FORMULA_KEYS, ALL_BP_KNOWN_HEADERS, ALL_BP_SOURCE_ALIAS,
  ALL_BP_UI_LABELS, PO_DEFAULT_COLUMN_KEYS, PO_SYSTEM_COLUMNS
} from '../../../constants/appConstants';

export const norm = (value) => String(value ?? '').trim().toLowerCase();
const headerKey = (value) => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
export const canonicalSourceKey = (label) => ALL_BP_SOURCE_ALIAS[headerKey(label)] || `RAW_${headerKey(label) || 'COLUMN'}`;
const canonicalValues = (row, key) => (Array.isArray(row.allBpRows) ? row.allBpRows : [])
  .flatMap((raw) => Object.entries(raw || {}).filter(([label]) => canonicalSourceKey(label) === key).map(([, value]) => String(value ?? '').trim()).filter(Boolean));
const uniqueValues = (row, key) => [...new Set(canonicalValues(row, key))];
const sumSource = (row, key) => {
  const values = canonicalValues(row, key);
  if (!values.length) return null;
  const numbers = values.map((v) => Number(v.replace(/,/g, '')));
  return numbers.every(Number.isFinite) ? numbers.reduce((s, v) => s + v, 0) : null;
};

const cartonMetrics = (row) => {
  const metrics = [];
  for (const raw of Array.isArray(row.allBpRows) ? row.allBpRows : []) {
    const first = (key) => Object.entries(raw || {}).find(([label]) => canonicalSourceKey(label) === key)?.[1];
    const qty = Number(String(first('QTY') ?? '').replace(/,/g, '').trim());
    const pcs = Number(String(first('PCS_CTN') ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(qty) || !Number.isFinite(pcs) || qty <= 0 || pcs <= 0) continue;
    const count = Math.floor(qty / pcs);
    metrics.push({ ratio: Math.ceil(qty / pcs), full: count, odd: qty - count * pcs });
  }
  if (!metrics.length) {
    const qty = Number(row.totalQty ?? row.plannedTotalQty ?? 0);
    const pcs = Number(row.qtyPerCarton ?? row.pcsPerCarton ?? 0);
    if (Number.isFinite(qty) && Number.isFinite(pcs) && qty > 0 && pcs > 0) {
      const count = Math.floor(qty / pcs);
      metrics.push({ ratio: Math.ceil(qty / pcs), full: count, odd: qty - count * pcs });
    }
  }
  return metrics;
};

/** Mirrors the Order PO list's ALL_BP display semantics without changing it. */
export const sourceValue = (row, key) => {
  if (key === 'PO') return row.poNumber || '—';
  if (key === 'STYLE') return row.styleNumber || row.style || '—';
  if (key === 'QTY') return row.totalQty ?? row.plannedTotalQty ?? '—';
  if (key === 'PCS_CTN') {
    const values = uniqueValues(row, key);
    return values.length > 1 ? values.join(' | ') : row.qtyPerCarton ?? row.pcsPerCarton ?? values[0] ?? '—';
  }
  if (key === 'ODD_RATIO') { const m = cartonMetrics(row); return m.length ? m.map((x) => x.ratio).join(' | ') : '—'; }
  if (key === 'CTNS') { const m = cartonMetrics(row); return m.length ? m.reduce((s, x) => s + x.full, 0) : sumSource(row, key) ?? '—'; }
  if (key === 'REMAINDER') { const m = cartonMetrics(row); return m.length ? m.reduce((s, x) => s + x.odd, 0) : '—'; }
  const values = uniqueValues(row, key);
  if (ALL_BP_FORMULA_KEYS.includes(key)) return values.length ? values.join(' | ') : '—';
  if (values.length) return values.join(' | ');
  const fallback = {
    MASTER_PO: row.masterPo, DC_CODE: row.dcCode, DESTINATION: row.destination,
    CHANNEL: row.channel, PACKING_PLAN: row.packingPlan, SALES_ORDER_PTS: row.salesOrderPts,
    DESCRIPTION: row.description, COLOR: row.color, SIZE: row.size,
    SHIP_MODE: row.shipMode, SEASON: row.season, FWD: row.fwd,
    CARTON_BOX_SIZE: row.cartonBoxSize, NW: row.netWeight, GW: row.grossWeight
  };
  return fallback[key] ?? '—';
};

export const poColumns = (rows) => {
  const columns = new Map();
  ALL_BP_KNOWN_HEADERS.forEach((label) => {
    const canonical = canonicalSourceKey(label);
    columns.set(canonical, { key: `src:${canonical}`, canonical, label: ALL_BP_UI_LABELS[canonical] || label, group: 'ALL_BP', minWidth: 120 });
  });
  rows.forEach((row) => {
    const names = [...(Array.isArray(row.allBpHeaders) ? row.allBpHeaders : []),
      ...(Array.isArray(row.allBpRows) ? row.allBpRows.flatMap((data) => Object.keys(data || {})) : [])];
    names.forEach((label) => {
      const canonical = canonicalSourceKey(label);
      if (!columns.has(canonical)) columns.set(canonical, { key: `src:${canonical}`, canonical, label: ALL_BP_UI_LABELS[canonical] || label, group: 'ALL_BP', minWidth: 120 });
    });
  });
  return [...PO_SYSTEM_COLUMNS, ...columns.values()];
};
export const DEFAULT_PICKING_COLUMNS = [...new Set([
  ...PO_DEFAULT_COLUMN_KEYS, 'src:MASTER_PO', 'src:DESCRIPTION', 'src:COLOR'
])];

export const splitPoNumbers = (raw) => [...new Set(String(raw || '').split(/[,;\n\r\t]+/).map(norm).filter(Boolean))];
export const multiMatch = (value, chosen) => !chosen.length || chosen.some((entry) => norm(value) === norm(entry));
export const optionValues = (rows, get) => [...new Set(rows.map(get).map((v) => String(v ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

export const augmentPoRows = (pos, picks) => {
  const byNumber = new Map((picks || []).map((claim) => [norm(claim.poNumber), claim]));
  return (pos || []).map((row) => {
    const claim = byNumber.get(norm(row.poNumber));
    return {
      ...row,
      pickStatus: claim?.pickStatus || 'UNPICKED',
      pickedBy: claim?.pickedBy || '',
      pickedAt: claim?.pickedAt || null,
      // The authoritative claim always wins over a stale ALL_BP record.
      factoryCode: claim?.factoryCode || row.factoryCode || ''
    };
  });
};

export const applyPickingFilters = (rows, { status = 'ALL', keyword = '', poNumbers = '', multi = {}, myEmail = '' } = {}) => {
  const numbers = splitPoNumbers(poNumbers);
  const containsAnyPo = (number) => !numbers.length || numbers.some((query) => norm(number).includes(query));
  return rows.filter((row) => {
    const mine = norm(row.pickedBy) === norm(myEmail) && Boolean(myEmail);
    const picked = row.pickStatus !== 'UNPICKED';
    if (status === 'UNPICKED' && picked) return false;
    if (status === 'PICKED' && !picked) return false;
    if (status === 'MINE' && !mine) return false;
    if (status === 'OTHERS' && (!picked || mine)) return false;
    if (!containsAnyPo(row.poNumber)) return false;
    const fieldValues = {
      factory: row.factoryCode, pickedBy: row.pickedBy, poStatus: row.status,
      style: row.styleNumber || row.style, sku: row.sku, destination: row.destination,
      shipMode: row.shipMode, exFty: String(row.exFtyDate || '').slice(0, 10),
      masterPo: row.masterPo, color: row.color, season: row.season, dcCode: row.dcCode
    };
    if (Object.entries(multi).some(([field, choices]) => !multiMatch(fieldValues[field], choices))) return false;
    if (keyword.trim()) {
      const content = [row.poNumber, ...Object.values(fieldValues), row.description,
        ...(Array.isArray(row.allBpRows) ? row.allBpRows.flatMap((record) => Object.values(record || {})) : [])]
        .join(' ').toLowerCase();
      if (!content.includes(norm(keyword))) return false;
    }
    return true;
  });
};

/** Validate against every line of a PO, not just the lines remaining after filters. */
export const eligiblePoNumbers = (allRows, factory, visibleRows = allRows) => {
  if (!factory) return [];
  const grouped = new Map();
  allRows.forEach((row) => {
    const key = row.poNumber;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  const shown = new Set(visibleRows.map((row) => row.poNumber));
  return [...grouped.entries()]
    .filter(([number, lines]) => shown.has(number) && lines.every((row) =>
      row.pickStatus === 'UNPICKED' && (!row.factoryCode || norm(row.factoryCode) === norm(factory))))
    .map(([number]) => number);
};

/** Separate views: available shared PO, assignments for current Factory, or global lookup. */
export const pickListView = (rows, { view = 'POOL', activeFactory = '', filter = 'ALL',
  search = '', poNumbers = '', multi = {}, myEmail = '' } = {}) => {
  const subset = applyPickingFilters(rows, {
    status: view === 'POOL' ? 'UNPICKED' : view === 'FACTORY' ? 'PICKED' : filter,
    keyword: search, poNumbers, multi, myEmail
  });
  return view === 'FACTORY'
    ? subset.filter((row) => norm(row.factoryCode) === norm(activeFactory))
    : subset;
};

/** Show a non-owner which Packing currently holds the searched PO. */
export const pickedPoSearchMatches = (rows, { view = 'POOL', poNumbers = '', search = '' } = {}) => {
  if (view !== 'POOL') return [];
  const queries = splitPoNumbers(poNumbers);
  const singleQuery = norm(search);
  if (!queries.length && singleQuery.length < 3) return [];
  const matches = rows.filter((row) =>
    row.pickStatus !== 'UNPICKED' && (
      queries.some((query) => norm(row.poNumber).includes(query)) ||
      (!queries.length && norm(row.poNumber).includes(singleQuery))
    ));
  return [...new Map(matches.map((row) => [norm(row.poNumber), row])).values()];
};

/** Collapse repeated ALL_BP/PO records into one selectable PO Number.
 * Preserve each source record for the details panel and keep the first-seen PO order.
 * Selection, server-side Pick and unpick remain PO-based; this is read-only UI grouping.
 */
export const groupPoNumberRows = (rows) => {
  const grouped = new Map();
  (rows || []).forEach((row) => {
    const key = norm(row.poNumber);
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, { poNumber: row.poNumber, lines: [] });
    grouped.get(key).lines.push(row);
  });
  return [...grouped.values()];
};
