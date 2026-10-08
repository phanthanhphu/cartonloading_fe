import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Breadcrumbs, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, LinearProgress, Link, ListItemText, Menu, MenuItem, Select, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import {
  ArrowBack, CloudUploadOutlined, DeleteOutline, EditOutlined, LocalShippingOutlined, MoveToInboxOutlined, QrCodeScannerOutlined, Refresh, ScaleOutlined, ViewColumnOutlined
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { APP_MESSAGES, createAllBpImportedMessage, createGenerationReviewMessage, createMasterDataBuildSummary, createMasterDataImportedMessage, createPoDeletedMessage, createWorkflowNotConfiguredMessage, createDeleteImportedPoConfirmMessage } from '../../constants/appMessages';

import ManagementTable from 'components/ManagementTable';
import PoScanProgressCell from 'buyers/lululemon/components/PoScanProgressCell';
import StatusChip from 'components/StatusChip';
import { CompactPageHeader, CompactStat, CompactToolbar } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { BUYER_CODE, buyerOrderStorageKey, ALL_BP_KNOWN_HEADERS, ALL_BP_SOURCE_ALIAS, ALL_BP_FORMULA_KEYS, ALL_BP_FORMULA_TEXT, ALL_BP_UI_LABELS, ALL_BP_SHARED_KEYS, ALL_BP_IMPORTANT_SOURCE_ORDER, DEFAULT_TABLE_ROWS_PER_PAGE, EXCEL_FILE_ACCEPT, IMPORT_MODE, DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY, WORKSPACE_SYSTEM_COLUMN_DEFINITIONS, WORKSPACE_DEFAULT_COLUMN_KEYS, PROGRESS_STATUS } from '../../constants/appConstants';
import { canAssignBarcode, canManageSales, canWeightCheck } from 'utils/accessControl';
import { getBuyerBySlug, saveSelectedBuyer } from 'utils/buyerAccess';
import { getManagedOrder, listManagedPos } from 'services/managementService';
import { createWeighingOrder, deletePo, importAllBp, updatePo } from 'buyers/lululemon/services/service';
import { generatePackingList, importPackingAllocationLines } from 'buyers/es/services/packingListService';
import { generateCartonPlanFromWsp } from 'buyers/es/services/cartonLoadingService';

const pageState = () => ({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE, count: 0, rows: [], loading: false });
const isSsccWorkflowBuyer = (buyer) => buyer?.code === BUYER_CODE.LULULEMON;
const isBarcodeWorkflowBuyer = (buyer) => buyer?.code === BUYER_CODE.ENGELBERT_STRAUSS;
const hasOperationalWorkflow = (buyer) => isSsccWorkflowBuyer(buyer) || isBarcodeWorkflowBuyer(buyer);
const value = (v) => (v === null || v === undefined || v === '' ? '—' : v);

const headerKey = (input) => String(input || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '');


const canonicalSourceKey = (label) => {
  const normalized = headerKey(label);
  return ALL_BP_SOURCE_ALIAS[normalized] || `RAW_${normalized || 'COLUMN'}`;
};




const canonicalRowEntry = (sourceRow, canonical) => Object.entries(sourceRow || {})
  .find(([label]) => canonicalSourceKey(label) === canonical);

const canonicalRowValue = (sourceRow, canonical) => canonicalRowEntry(sourceRow, canonical)?.[1] ?? '';


const calculatedCartonMetrics = (row) => {
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

const numberValue = (raw, percent = false) => {
  const text = String(raw ?? '').trim();
  if (!text) return 0;
  const explicitPercent = text.endsWith('%');
  const parsed = Number(text.replace(/,/g, '').replace(/\$/g, '').replace(/%/g, '').trim());
  if (!Number.isFinite(parsed)) return 0;
  if (percent && (explicitPercent || Math.abs(parsed) > 1)) return parsed / 100;
  return parsed;
};

const displayNumber = (raw, maxDecimals = 10) => {
  if (!Number.isFinite(raw)) return '';
  const fixed = raw.toFixed(maxDecimals);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
};

const setCanonicalPreview = (sourceRow, canonical, nextValue) => {
  const entry = canonicalRowEntry(sourceRow, canonical);
  if (!entry) return sourceRow;
  return { ...sourceRow, [entry[0]]: nextValue };
};

const fallbackAllBpValue = (row, canonical) => ({
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

const recalculateAllBpPreview = (sourceRow) => {
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

const systemColumns = WORKSPACE_SYSTEM_COLUMN_DEFINITIONS.map((column) => ({
  ...column,
  render: (row) => {
    if (column.key === '__stt') return value(row.__stt);
    if (column.key === 'sys:factory') return value(row.factoryCode);
    if (column.key === 'sys:sku') return value(row.sku);
    if (column.key === 'sys:exFtyDate') return value(row.exFtyDate);
    if (column.key === 'sys:status') return <StatusChip status={row.status || PROGRESS_STATUS.READY} />;
    return '—';
  }
}));

const loadSavedColumns = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const sourceValues = (row, canonical) => {
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

const uniqueSourceValues = (row, canonical) => [...new Set(sourceValues(row, canonical))];

const summedSourceNumber = (row, canonical) => {
  const values = sourceValues(row, canonical);
  if (!values.length) return null;
  const numbers = values.map((item) => Number(String(item).replace(/,/g, '')));
  if (numbers.some((item) => !Number.isFinite(item))) return null;
  return numbers.reduce((sum, item) => sum + item, 0);
};

const sourceValue = (row, canonical) => {
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

export default function BuyerOrderWorkspacePage() {
  const { buyerSlug, orderId } = useParams();
  const navigate = useNavigate();
  // Keep the resolved buyer object stable for the lifetime of the route.
  // getBuyerBySlug() rebuilds the catalog objects, so calling it on every render
  // would otherwise create a new object reference each time.
  const buyer = useMemo(() => getBuyerBySlug(buyerSlug), [buyerSlug]);
  const buyerCode = buyer?.code || '';
  const writable = canManageSales();
  const maySendToWeight = canManageSales() || canAssignBarcode() || canWeightCheck();
  const fileRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [pos, setPos] = useState(pageState());
  const [filters, setFilters] = useState({ poNumber: '', factory: '', style: '', sku: '', destination: '', status: '', exFtyDate: '' });
  const [importMode, setImportMode] = useState(IMPORT_MODE.UPSERT);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(loadSavedColumns);
  const [poEditor, setPoEditor] = useState(null);
  const [poSaving, setPoSaving] = useState(false);
  const [poDeletingId, setPoDeletingId] = useState(null);
  const [selectedWeightPoIds, setSelectedWeightPoIds] = useState([]);
  const [sendingToWeight, setSendingToWeight] = useState(false);
  const posRequestRef = useRef(0);
  const posPaginationRef = useRef({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE });

  useEffect(() => {
    if (buyer) saveSelectedBuyer(buyer);
    if (buyer?.code === BUYER_CODE.LULULEMON && orderId) localStorage.setItem(buyerOrderStorageKey(buyer.code), orderId);
  }, [buyer?.code, orderId]);

  const loadOrder = useCallback(async () => {
    if (!buyerCode || !orderId) return;
    try { setOrder(await getManagedOrder(buyerCode, orderId)); }
    catch (e) { setError(e?.response?.data?.message || e?.message || APP_MESSAGES.LOAD_ORDER_FAILED); }
  }, [buyerCode, orderId]);

  const loadPos = useCallback(async (page = posPaginationRef.current.page, size = posPaginationRef.current.size) => {
    if (!buyerCode || !orderId) return;
    // IMPORTANT: depend on the stable primitive buyerCode, not the buyer object.
    // The buyer catalog can return a newly allocated object, which used to recreate
    // loadPos and retrigger the effect indefinitely (GET /pos request loop).
    const workflowEnabled = buyerCode === BUYER_CODE.LULULEMON
      || buyerCode === BUYER_CODE.ENGELBERT_STRAUSS;
    if (!workflowEnabled) {
      setPos((current) => ({ ...current, page: 0, count: 0, rows: [], loading: false }));
      return;
    }
    const nextPage = Math.max(0, Number(page || 0));
    const nextSize = Math.max(1, Number(size || 10));
    const requestId = ++posRequestRef.current;

    posPaginationRef.current = { page: nextPage, size: nextSize };
    setPos((current) => ({ ...current, page: nextPage, size: nextSize, loading: true }));

    try {
      const result = await listManagedPos(buyerCode, orderId, { ...filters, page: nextPage, size: nextSize });
      if (requestId !== posRequestRef.current) return;

      const rows = (result?.content || []).map((row, index) => ({ ...row, __stt: nextPage * nextSize + index + 1 }));
      setPos({ page: nextPage, size: nextSize, count: Number(result?.totalElements || 0), rows, loading: false });
    } catch (e) {
      if (requestId !== posRequestRef.current) return;
      setError(e?.response?.data?.message || e?.message || APP_MESSAGES.LOAD_PO_FAILED);
      setPos((current) => ({ ...current, loading: false }));
    }
  }, [buyerCode, orderId, filters]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    loadPos(0, posPaginationRef.current.size);
  }, [loadPos]);

  const uploadMasterData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !buyer || !orderId) return;
    setImporting(true); setImportProgress(0); setNotice(null); setError('');
    try {
      if (isSsccWorkflowBuyer(buyer)) {
        const result = await importAllBp(orderId, file, true, buyerCode, (progressEvent) => {
          const total = Number(progressEvent?.total || 0);
          const loaded = Number(progressEvent?.loaded || 0);
          const percent = total > 0
            ? Math.round((loaded * 100) / total)
            : Math.round(Number(progressEvent?.progress || 0) * 100);
          if (Number.isFinite(percent)) setImportProgress(Math.max(0, Math.min(100, percent)));
        });
        setImportProgress(100);
        const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : [];
        setNotice({
          severity: warnings.length ? 'warning' : 'success',
          text: [createAllBpImportedMessage(result?.createdPos), ...warnings].join(' ')
        });
      } else if (isBarcodeWorkflowBuyer(buyer)) {
        const result = await importPackingAllocationLines(buyerCode, orderId, file, importMode);
        if (result?.applied === false) throw new Error(result?.errors?.[0]?.message || APP_MESSAGES.MASTER_DATA_IMPORT_FAILED);
        let buildMessage = '';
        try {
          const packing = await generatePackingList(buyerCode, orderId, true);
          const cartonPlan = await generateCartonPlanFromWsp(buyerCode, orderId, true);
          buildMessage = createMasterDataBuildSummary(packing?.created, cartonPlan?.createdCartons ?? cartonPlan?.created);
        } catch (buildError) {
          buildMessage = createGenerationReviewMessage(buildError?.response?.data?.message || buildError?.message);
        }
        setNotice({ severity: buildMessage.includes('needs review') ? 'warning' : 'success', text: createMasterDataImportedMessage(buildMessage) });
      } else {
        throw new Error(createWorkflowNotConfiguredMessage(buyerCode));
      }
      await loadOrder(); await loadPos(0, posPaginationRef.current.size);
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || APP_MESSAGES.MASTER_DATA_IMPORT_FAILED });
    } finally { setImporting(false); setImportProgress(0); }
  };

  const openPoEditor = (row) => {
    if (!isSsccWorkflowBuyer(buyer) || !writable) return;
    const headers = Array.isArray(row.allBpHeaders) && row.allBpHeaders.length
      ? row.allBpHeaders
      : ALL_BP_KNOWN_HEADERS;
    const rawRows = Array.isArray(row.allBpRows) && row.allBpRows.length
      ? row.allBpRows
      : [Object.fromEntries(headers.map((label) => [label, fallbackAllBpValue(row, canonicalSourceKey(label))]))];
    const normalizedRows = rawRows.map((sourceRow) => {
      const completed = { ...Object.fromEntries(headers.map((label) => [label, ''])), ...(sourceRow || {}) };
      return recalculateAllBpPreview(completed);
    });

    setPoEditor({
      id: row.id || row.key,
      factoryCode: row.factoryCode || '',
      exFtyDate: row.exFtyDate || '',
      headers,
      allBpRows: normalizedRows
    });
  };

  const setPoField = (key, nextValue) => setPoEditor((current) => current ? { ...current, [key]: nextValue } : current);

  const setAllBpField = (rowIndex, label, nextValue) => setPoEditor((current) => {
    if (!current) return current;
    const canonical = canonicalSourceKey(label);
    if (ALL_BP_FORMULA_KEYS.includes(canonical)) return current;

    let rows = current.allBpRows.map((sourceRow, index) => {
      if (index !== rowIndex && !ALL_BP_SHARED_KEYS.includes(canonical)) return sourceRow;
      const entry = canonicalRowEntry(sourceRow, canonical);
      if (!entry) return sourceRow;
      return { ...sourceRow, [entry[0]]: nextValue };
    });
    rows = rows.map(recalculateAllBpPreview);
    return { ...current, allBpRows: rows };
  });

  const savePoEditor = async () => {
    if (!poEditor?.id) return;
    const sourceRows = Array.isArray(poEditor.allBpRows) ? poEditor.allBpRows : [];
    if (!sourceRows.length) {
      setNotice({ severity: 'error', text: APP_MESSAGES.ALL_BP_SOURCE_ROW_REQUIRED });
      return;
    }

    const first = sourceRows[0];
    const poNumber = String(canonicalRowValue(first, 'PO') || '').trim();
    const styleNumber = String(canonicalRowValue(first, 'STYLE') || '').trim();
    const qtyPerCarton = Number(canonicalRowValue(first, 'PCS_CTN'));
    const quantities = sourceRows.map((sourceRow) => Number(canonicalRowValue(sourceRow, 'QTY')));
    const allWholePositive = quantities.every((qty) => Number.isInteger(qty) && qty > 0)
      && Number.isInteger(qtyPerCarton) && qtyPerCarton > 0;

    if (!poNumber) {
      setNotice({ severity: 'error', text: APP_MESSAGES.ALL_BP_PO_REQUIRED });
      return;
    }
    if (!styleNumber) {
      setNotice({ severity: 'error', text: APP_MESSAGES.ALL_BP_STYLE_REQUIRED });
      return;
    }
    if (!allWholePositive) {
      setNotice({ severity: 'error', text: APP_MESSAGES.ALL_BP_QUANTITY_RULE });
      return;
    }

    const totalQty = quantities.reduce((sum, qty) => sum + qty, 0);
    const nullableNumber = (raw) => {
      if (raw === '' || raw === null || raw === undefined) return null;
      const parsed = Number(String(raw).replace(/,/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    };

    setPoSaving(true);
    setNotice(null);
    try {
      await updatePo(orderId, poEditor.id, {
        allBpRows: sourceRows,
        poNumber,
        masterPo: canonicalRowValue(first, 'MASTER_PO'),
        factoryCode: poEditor.factoryCode,
        styleNumber,
        description: canonicalRowValue(first, 'DESCRIPTION'),
        color: canonicalRowValue(first, 'COLOR'),
        size: canonicalRowValue(first, 'SIZE'),
        totalQty,
        qtyPerCarton,
        dcCode: canonicalRowValue(first, 'DC_CODE'),
        destination: canonicalRowValue(first, 'DESTINATION'),
        channel: canonicalRowValue(first, 'CHANNEL'),
        packingPlan: canonicalRowValue(first, 'PACKING_PLAN'),
        salesOrderPts: canonicalRowValue(first, 'SALES_ORDER_PTS'),
        shipMode: canonicalRowValue(first, 'SHIP_MODE'),
        season: canonicalRowValue(first, 'SEASON'),
        fwd: canonicalRowValue(first, 'FWD'),
        cartonBoxSize: canonicalRowValue(first, 'CARTON_BOX_SIZE'),
        netWeightKg: nullableNumber(canonicalRowValue(first, 'NW')),
        grossWeightKg: nullableNumber(canonicalRowValue(first, 'GW')),
        exFtyDate: poEditor.exFtyDate || null
      }, buyerCode);
      setPoEditor(null);
      setNotice({
        severity: 'success',
        text: APP_MESSAGES.PO_UPDATED_REBUILT
      });
      await loadPos(posPaginationRef.current.page, posPaginationRef.current.size);
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || APP_MESSAGES.UPDATE_PO_FAILED });
    } finally {
      setPoSaving(false);
    }
  };

  const removeImportedPo = async (row) => {
    if (!row || !isSsccWorkflowBuyer(buyer) || !writable) return;
    const poId = row.id || row.key;
    if (!poId) return;
    const confirmed = window.confirm(createDeleteImportedPoConfirmMessage(row.poNumber));
    if (!confirmed) return;

    setPoDeletingId(poId);
    setNotice(null);
    try {
      await deletePo(orderId, poId, buyerCode);
      const targetPage = pos.rows.length <= 1 && posPaginationRef.current.page > 0
        ? posPaginationRef.current.page - 1
        : posPaginationRef.current.page;
      setNotice({ severity: 'success', text: createPoDeletedMessage(row.poNumber) });
      await loadPos(targetPage, posPaginationRef.current.size);
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || APP_MESSAGES.DELETE_PO_FAILED });
    } finally {
      setPoDeletingId(null);
    }
  };

  const sourceHeaders = useMemo(() => {
    const detected = [];
    const seen = new Set();
    const add = (label) => {
      const clean = String(label || '').trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      detected.push(clean);
    };

    pos.rows.forEach((row) => {
      (Array.isArray(row.allBpHeaders) ? row.allBpHeaders : []).forEach(add);
      (Array.isArray(row.allBpRows) ? row.allBpRows : []).forEach((sourceRow) => Object.keys(sourceRow || {}).forEach(add));
    });

    // Keep the full current ALL_BP schema visible even when a page happens to have no source value.
    ALL_BP_KNOWN_HEADERS.forEach(add);
    return detected;
  }, [pos.rows]);

  const sourceColumns = useMemo(() => {
    const byCanonical = new Map();
    sourceHeaders.forEach((label, index) => {
      const canonical = canonicalSourceKey(label);
      if (!byCanonical.has(canonical)) {
        byCanonical.set(canonical, {
          key: `src:${canonical}`,
          canonical,
          label: ALL_BP_UI_LABELS[canonical] || label,
          minWidth: canonical === 'DESCRIPTION' ? 200 : canonical === 'COLOR' ? 145 : canonical === 'ODD_RATIO' || canonical === 'REMAINDER' ? 125 : 115,
          group: 'ALL_BP',
          sourceIndex: index,
          render: (row) => {
            if (buyerCode === BUYER_CODE.LULULEMON && ['QTY', 'ODD_RATIO', 'CTNS', 'REMAINDER'].includes(canonical)) {
              const progress = <PoScanProgressCell row={row} canonical={canonical} metrics={calculatedCartonMetrics(row)} />;
              if (row.identifiedQty !== null && row.identifiedQty !== undefined) return progress;
            }
            return sourceValue(row, canonical);
          }
        });
      }
    });

    const priority = new Map(ALL_BP_IMPORTANT_SOURCE_ORDER.map((key, index) => [key, index]));
    return Array.from(byCanonical.values()).sort((a, b) => {
      const ap = priority.has(a.canonical) ? priority.get(a.canonical) : 1000 + a.sourceIndex;
      const bp = priority.has(b.canonical) ? priority.get(b.canonical) : 1000 + b.sourceIndex;
      return ap - bp;
    });
  }, [sourceHeaders, buyerCode]);

  const sendSelectedToCartonWeight = async () => {
    if (!orderId || !selectedWeightPoIds.length || sendingToWeight) return;
    setSendingToWeight(true);
    setNotice(null);
    setError('');
    try {
      const created = await createWeighingOrder(orderId, { name: '', poIds: selectedWeightPoIds }, buyerCode);
      setNotice({
        severity: 'success',
        text: `Sent ${selectedWeightPoIds.length} PO(s) to Carton Weight as ${created?.name || 'a Weighing Order'}.`
      });
      setSelectedWeightPoIds([]);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Unable to send the selected PO(s) to Carton Weight.');
    } finally {
      setSendingToWeight(false);
    }
  };

  const toggleWeightPo = (poId) => {
    if (!poId) return;
    setSelectedWeightPoIds((current) => current.includes(poId)
      ? current.filter((id) => id !== poId)
      : [...current, poId]);
  };

  const allWorkflowColumns = useMemo(() => {
    const stt = systemColumns[0];
    const otherSystem = systemColumns.slice(1);
    const columns = [stt];

    // Place Factory next to PO/Master PO, then put operational fields at the end.
    sourceColumns.forEach((column) => {
      columns.push(column);
      if (column.canonical === 'MASTER_PO') columns.push(otherSystem[0]);
    });
    if (!columns.some((column) => column.key === 'sys:factory')) columns.splice(1, 0, otherSystem[0]);
    columns.push(...otherSystem.slice(1));
    return columns;
  }, [sourceColumns]);

  const availableColumnKeys = useMemo(() => new Set(allWorkflowColumns.map((column) => column.key)), [allWorkflowColumns]);
  const availableColumnSignature = useMemo(() => allWorkflowColumns.map((column) => column.key).join('|'), [allWorkflowColumns]);

  useEffect(() => {
    if (!isSsccWorkflowBuyer(buyer) || !allWorkflowColumns.length) return;
    setVisibleColumnKeys((current) => {
      const defaults = WORKSPACE_DEFAULT_COLUMN_KEYS.filter((key) => availableColumnKeys.has(key));
      if (!Array.isArray(current)) return defaults;
      const valid = current.filter((key) => availableColumnKeys.has(key));
      const next = valid.length ? [...valid] : [...defaults];

      // One-time compatibility migration for users who already saved column preferences
      // before Carton Ratio / Remainder Qty were added. Keep their choices, but surface
      // the two new required carton calculation columns automatically.
      ['src:ODD_RATIO', 'src:REMAINDER'].forEach((key) => {
        if (!availableColumnKeys.has(key) || next.includes(key)) return;
        const anchor = key === 'src:ODD_RATIO' ? next.indexOf('src:PCS_CTN') : next.indexOf('src:CTNS');
        next.splice(anchor >= 0 ? anchor + 1 : next.length, 0, key);
      });

      if (current.length === next.length && current.every((key, index) => key === next[index])) return current;
      return next;
    });
  }, [buyerCode, availableColumnSignature, availableColumnKeys]);

  useEffect(() => {
    if (!isSsccWorkflowBuyer(buyer) || !Array.isArray(visibleColumnKeys)) return;
    localStorage.setItem(DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [buyerCode, visibleColumnKeys]);

  const fixedColumns = [
    { key: '__stt', label: 'STT', minWidth: 65 },
    { key: 'poNumber', label: 'PO No.', minWidth: 130, render: (r) => <Typography fontWeight={900} color="primary.main">{value(r.poNumber)}</Typography> },
    { key: 'masterPo', label: 'Master PO', minWidth: 125 },
    { key: 'factoryCode', label: 'Factory', minWidth: 90 },
    { key: 'styleNumber', label: 'Style', minWidth: 110 },
    { key: 'description', label: 'Description', minWidth: 200 },
    { key: 'color', label: 'Color', minWidth: 120 },
    { key: 'size', label: 'Size', minWidth: 85 },
    { key: 'totalQty', label: 'Total Qty', minWidth: 90 },
    { key: 'qtyPerCarton', label: 'Pcs / Ctn', minWidth: 90 },
    { key: 'plannedCartons', label: 'Planned Cartons', minWidth: 125 },
    { key: 'destination', label: 'Destination', minWidth: 130 },
    { key: 'dcCode', label: 'DC Code', minWidth: 95 },
    { key: 'channel', label: 'Channel', minWidth: 100 },
    { key: 'shipMode', label: 'Ship Mode', minWidth: 100 },
    { key: 'season', label: 'Season', minWidth: 90 },
    { key: 'fwd', label: 'FWD', minWidth: 90 },
    { key: 'cartonBoxSize', label: 'Carton Size', minWidth: 120 },
    { key: 'netWeightKg', label: 'N.W. (kg)', minWidth: 90 },
    { key: 'grossWeightKg', label: 'G.W. (kg)', minWidth: 90 },
    { key: 'exFtyDate', label: 'Ex-Factory', minWidth: 110 },
    { key: 'status', label: 'Status', minWidth: 110, render: (r) => <StatusChip status={r.status || 'READY'} /> }
  ];

  const tableColumns = (() => {
    if (!isSsccWorkflowBuyer(buyer)) return fixedColumns;
    const selected = new Set(Array.isArray(visibleColumnKeys) ? visibleColumnKeys : WORKSPACE_DEFAULT_COLUMN_KEYS);
    const dataColumns = allWorkflowColumns.filter((column) => selected.has(column.key));
    const weightSelectColumn = maySendToWeight ? [{
      key: '__sendWeight',
      label: 'CW',
      minWidth: 56,
      render: (row) => {
        const poId = row.id || row.key;
        return (
          <Tooltip title="Select PO to send to Carton Weight">
            <Checkbox
              size="small"
              checked={selectedWeightPoIds.includes(poId)}
              onClick={(event) => event.stopPropagation()}
              onChange={() => toggleWeightPo(poId)}
            />
          </Tooltip>
        );
      }
    }] : [];
    if (!writable) return [...weightSelectColumn, ...dataColumns];

    return [...weightSelectColumn, ...dataColumns, {
      key: '__actions',
      label: 'Actions',
      minWidth: 105,
      render: (row) => {
        const poId = row.id || row.key;
        const deleting = poDeletingId === poId;
        return (
          <Stack direction="row" spacing={0.25} onClick={(event) => event.stopPropagation()}>
            <Tooltip title="Edit imported PO">
              <span><IconButton size="small" disabled={deleting} onClick={() => openPoEditor(row)}><EditOutlined fontSize="small" /></IconButton></span>
            </Tooltip>
            <Tooltip title="Delete imported PO">
              <span><IconButton size="small" color="error" disabled={deleting} onClick={() => removeImportedPo(row)}><DeleteOutline fontSize="small" /></IconButton></span>
            </Tooltip>
          </Stack>
        );
      }
    }];
  })();

  const toggleColumn = (key) => {
    setVisibleColumnKeys((current) => {
      const selected = new Set(Array.isArray(current) ? current : WORKSPACE_DEFAULT_COLUMN_KEYS);
      if (selected.has(key)) {
        if (selected.size === 1) return Array.from(selected);
        selected.delete(key);
      } else {
        selected.add(key);
      }
      return Array.from(selected);
    });
  };

  const resetColumns = () => setVisibleColumnKeys(WORKSPACE_DEFAULT_COLUMN_KEYS.filter((key) => availableColumnKeys.has(key)));
  const showAllColumns = () => setVisibleColumnKeys(allWorkflowColumns.map((column) => column.key));

  if (!buyer) return <Alert severity="error">{APP_MESSAGES.BUYER_NOT_FOUND}</Alert>;

  const openPo = (row) => navigate(`/buyers/${buyer.slug}/orders/${orderId}/pos/${encodeURIComponent(row.key)}`);

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <CompactPageHeader
          title={order?.orderName || 'Order'}
          subtitle="Purchase Orders · Cartons and Items are generated only when opened."
          breadcrumbs={(
            <Breadcrumbs separator="/">
              <Link component={RouterLink} underline="hover" color="inherit" to="/workflow">Buyers</Link>
              <Link component={RouterLink} underline="hover" color="inherit" to={`/buyers/${buyer.slug}/orders`}>{buyer.label}</Link>
              <Typography color="text.primary">{order?.orderName || 'Order'}</Typography>
            </Breadcrumbs>
          )}
          meta={<Chip size="small" variant="outlined" label={`${pos.count.toLocaleString()} PO`} />}
          actions={(<>
            <Tooltip title="Back to Orders"><Button size="small" startIcon={<ArrowBack />} onClick={() => navigate(`/buyers/${buyer.slug}/orders`)}>Orders</Button></Tooltip>
            <Tooltip title="Refresh"><Button size="small" startIcon={<Refresh />} onClick={() => { loadOrder(); loadPos(posPaginationRef.current.page, posPaginationRef.current.size); }}>Refresh</Button></Tooltip>
            {isSsccWorkflowBuyer(buyer) ? <>
              <Button size="small" component={RouterLink} to={`/buyers/${buyer.slug}/packing`} startIcon={<MoveToInboxOutlined />}>Packing</Button>
              <Button size="small" component={RouterLink} to={`/buyers/${buyer.slug}/shipping`} startIcon={<LocalShippingOutlined />}>Shipping</Button>
              <Button size="small" component={RouterLink} to={`/buyers/${buyer.slug}/carton-loading`} startIcon={<QrCodeScannerOutlined />}>SSCC</Button>
            </> : null}
          </>)}
        />

        {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        {!hasOperationalWorkflow(buyer) ? (
          <Alert severity="info">{APP_MESSAGES.BUYER_WORKFLOW_NOT_ASSIGNED}</Alert>
        ) : null}

        <CompactToolbar>
          <CompactStat label="PO" value={pos.count.toLocaleString()} />
          {isBarcodeWorkflowBuyer(buyer) && writable ? (
            <FormControl size="small" sx={{ minWidth: 155 }}>
              <InputLabel>Import Mode</InputLabel>
              <Select label="Import Mode" value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                <MenuItem value={IMPORT_MODE.CREATE_ONLY}>Create Only</MenuItem>
                <MenuItem value={IMPORT_MODE.UPSERT}>Update + Create</MenuItem>
                <MenuItem value={IMPORT_MODE.REPLACE_ALL}>Replace All</MenuItem>
              </Select>
            </FormControl>
          ) : null}
          {writable && hasOperationalWorkflow(buyer) ? <>
            <Button
              size="small"
              variant="contained"
              startIcon={importing ? <CircularProgress size={15} thickness={5} /> : <CloudUploadOutlined />}
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing
                ? (importProgress < 100 ? `Uploading ${importProgress}%` : 'Processing file...')
                : 'Import Excel'}
            </Button>
            {importing && isSsccWorkflowBuyer(buyer) ? (
              <Box sx={{ width: 190, minWidth: 150 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.25 }}>
                  <Typography variant="caption" fontWeight={700}>
                    {importProgress < 100 ? 'Uploading ALL_BP' : 'Processing ALL_BP'}
                  </Typography>
                  <Typography variant="caption" fontWeight={800}>{importProgress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={importProgress} />
              </Box>
            ) : null}
            <input ref={fileRef} hidden type="file" accept={EXCEL_FILE_ACCEPT} onChange={uploadMasterData} />
          </> : !writable ? <Chip size="small" label="View only" /> : null}

          {isSsccWorkflowBuyer(buyer) ? <>
            {maySendToWeight ? (
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={sendingToWeight ? <CircularProgress size={15} color="inherit" /> : <ScaleOutlined />}
                disabled={sendingToWeight || !selectedWeightPoIds.length}
                onClick={sendSelectedToCartonWeight}
              >
                {sendingToWeight ? 'Sending...' : `Send to Carton Weight${selectedWeightPoIds.length ? ` (${selectedWeightPoIds.length})` : ''}`}
              </Button>
            ) : null}
            <Button
              size="small"
              variant="outlined"
              startIcon={<ViewColumnOutlined />}
              onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
            >
              Columns {(visibleColumnKeys || WORKSPACE_DEFAULT_COLUMN_KEYS).filter((key) => availableColumnKeys.has(key)).length}/{allWorkflowColumns.length}
            </Button>
            <Menu
              anchorEl={columnMenuAnchor}
              open={Boolean(columnMenuAnchor)}
              onClose={() => setColumnMenuAnchor(null)}
              PaperProps={{ sx: { width: 330, maxHeight: 520 } }}
            >
              <Box sx={{ px: 1.5, py: 1 }}>
                <Typography fontWeight={800}>Custom Table View</Typography>
                <Typography variant="caption" color="text.secondary">Choose which columns are shown in the table.</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button size="small" onClick={resetColumns}>Default</Button>
                  <Button size="small" onClick={showAllColumns}>Show all</Button>
                </Stack>
              </Box>
              <Divider />
              {allWorkflowColumns.map((column) => {
                const checked = (visibleColumnKeys || WORKSPACE_DEFAULT_COLUMN_KEYS).includes(column.key);
                return (
                  <MenuItem key={column.key} dense onClick={() => toggleColumn(column.key)}>
                    <Checkbox size="small" checked={checked} />
                    <ListItemText primary={column.label} secondary={column.group === 'ALL_BP' ? 'ALL_BP' : 'System'} />
                  </MenuItem>
                );
              })}
            </Menu>
          </> : null}
        </CompactToolbar>

        <TableFilterBar
          fields={[
            { key: 'poNumber', label: 'PO No.' },
            { key: 'factory', label: 'Factory' },
            { key: 'style', label: 'Style' },
            { key: 'sku', label: 'SKU' },
            { key: 'destination', label: 'Destination' },
            { key: 'status', label: 'Status' },
            { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' }
          ]}
          values={filters}
          onChange={(key, nextValue) => setFilters((current) => ({ ...current, [key]: nextValue }))}
          onClear={() => setFilters({ poNumber: '', factory: '', style: '', sku: '', destination: '', status: '', exFtyDate: '' })}
          disabled={pos.loading}
        />

        <ManagementTable
          title="Purchase Orders"
          {...pos}
          rowsPerPage={pos.size}
          getRowId={(row) => row.key}
          onRowClick={openPo}
          onPageChange={(page) => loadPos(page, posPaginationRef.current.size)}
          onRowsPerPageChange={(size) => loadPos(0, size)}
          columns={tableColumns}
          emptyText="No PO records. Import Excel to create PO data for this Order."
        />
      </Stack>

      <Dialog open={Boolean(poEditor)} onClose={() => { if (!poSaving) setPoEditor(null); }} fullWidth maxWidth="xl">
        <DialogTitle fontWeight={900}>Edit Imported PO · ALL_BP</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Columns without formulas are editable. Formula columns Q, R, S, X, Y, Z and AA are read-only and recalculate automatically.
            If Cartons/Items were already generated and Packing has not started, they are rebuilt from the edited PO after Save.
          </Alert>

          {poEditor ? (
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 0.75 }}>System fields</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 320px))' }, gap: 1.25 }}>
                  <TextField size="small" label="Factory (optional)" value={poEditor.factoryCode || ''} onChange={(e) => setPoField('factoryCode', e.target.value)} />
                  <TextField size="small" type="date" label="Ex-Factory" InputLabelProps={{ shrink: true }} value={poEditor.exFtyDate || ''} onChange={(e) => setPoField('exFtyDate', e.target.value)} />
                </Box>
              </Box>

              <Divider />

              {(poEditor.allBpRows || []).map((sourceRow, rowIndex) => (
                <Box key={`all-bp-row-${rowIndex}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={900}>ALL_BP Row {rowIndex + 1}</Typography>
                    <Chip size="small" variant="outlined" label={`${(poEditor.headers || []).length} columns`} />
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1.1 }}>
                    {(poEditor.headers || []).map((label) => {
                      const canonical = canonicalSourceKey(label);
                      const formula = ALL_BP_FORMULA_KEYS.includes(canonical);
                      const required = ['PO', 'STYLE', 'QTY', 'PCS_CTN'].includes(canonical);
                      return (
                        <TextField
                          key={`${rowIndex}-${label}`}
                          required={required}
                          disabled={formula}
                          size="small"
                          label={label}
                          value={sourceRow?.[label] ?? ''}
                          onChange={(event) => setAllBpField(rowIndex, label, event.target.value)}
                          helperText={formula ? `Formula ${ALL_BP_FORMULA_TEXT[canonical] || ''} · View only` : undefined}
                          sx={formula ? { '& .MuiInputBase-root.Mui-disabled': { bgcolor: 'action.hover' } } : undefined}
                        />
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPoEditor(null)} disabled={poSaving}>Cancel</Button>
          <Button variant="contained" onClick={savePoEditor} disabled={poSaving}>{poSaving ? 'Saving...' : 'Save PO'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
