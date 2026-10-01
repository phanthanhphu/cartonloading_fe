import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Breadcrumbs, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, IconButton, InputLabel, Link, ListItemText, Menu, MenuItem, Select, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import {
  ArrowBack, CloudUploadOutlined, DeleteOutline, EditOutlined, LocalShippingOutlined, MoveToInboxOutlined,
  QrCodeScannerOutlined, Refresh, ViewColumnOutlined
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import ManagementTable from 'components/ManagementTable';
import StatusChip from 'components/StatusChip';
import { CompactPageHeader, CompactStat, CompactToolbar } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { canManageSales } from 'utils/accessControl';
import { getBuyerBySlug, saveSelectedBuyer } from 'utils/buyerAccess';
import { getManagedOrder, listManagedPos } from 'services/managementService';
import { deleteLululemonPo, importAllBp, updateLululemonPo } from 'buyers/lululemon/services/lululemonService';
import { generatePackingList, importPackingAllocationLines } from 'buyers/es/services/packingListService';
import { generateCartonPlanFromWsp } from 'buyers/es/services/cartonLoadingService';

const pageState = () => ({ page: 0, size: 10, count: 0, rows: [], loading: false });
const isLululemon = (buyer) => buyer?.code === 'LULULEMON';
const value = (v) => (v === null || v === undefined || v === '' ? '—' : v);

const COLUMN_STORAGE_KEY = 'cartonloading.lululemon.order-workspace.visible-columns.v1';

// Exact columns from the current ALL_BP workbook. If a future workbook adds a new
// header, the backend returns it in allBpHeaders/allBpRows and this screen adds it automatically.
const KNOWN_ALL_BP_HEADERS = [
  'HOD (Hand over date)', 'SGS testing', 'GB testing', 'BV inspection', 'DC Code', 'Destination', 'Chanel',
  'Master PO', 'PO', 'Packing Plan', 'SO (PTS)', 'Style#', 'Description', 'Color description', "Q\'ty", 'Pcs/ctn',
  'lẻ', 'Ctns', 'Dư', 'Remark', 'FOB Price', 'Care & Content Label', 'China Inspection Tag', 'FOB Amount',
  'Total FOB+Prcie Tag', 'FOB Fty Price', 'FOB Fty Amount', 'Ship mode', 'Season', 'DP%', 'MPR NUMBER',
  'FWD', 'Carton Box Size', 'NW', 'GW', 'Remark 2'
];

const headerKey = (input) => String(input || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '');

const SOURCE_ALIAS = {
  HOD: 'HOD', HODHANDOVERDATE: 'HOD', HANDOVERDATE: 'HOD',
  SGSTESTING: 'SGS_TESTING', SGSTEST: 'SGS_TESTING',
  GBTESTING: 'GB_TESTING', GBTEST: 'GB_TESTING',
  BVINSPECTION: 'BV_INSPECTION', BVINSPECT: 'BV_INSPECTION',
  DCCODE: 'DC_CODE', DC: 'DC_CODE',
  DESTINATION: 'DESTINATION', DEST: 'DESTINATION',
  CHANEL: 'CHANNEL', CHANNEL: 'CHANNEL',
  MASTERPO: 'MASTER_PO',
  PO: 'PO', PONO: 'PO', PONUMBER: 'PO', PURCHASEORDER: 'PO',
  PACKINGPLAN: 'PACKING_PLAN', PACKINGPLANNO: 'PACKING_PLAN',
  SOPTS: 'SALES_ORDER_PTS', SO: 'SALES_ORDER_PTS', SALESORDERPTS: 'SALES_ORDER_PTS', SALESORDER: 'SALES_ORDER_PTS',
  STYLE: 'STYLE', STYLENO: 'STYLE', STYLENUMBER: 'STYLE',
  DESCRIPTION: 'DESCRIPTION', DESC: 'DESCRIPTION',
  COLORDESCRIPTION: 'COLOR', COLOR: 'COLOR', COLOURDESCRIPTION: 'COLOR', COLOUR: 'COLOR',
  QTY: 'QTY', QTYTOTAL: 'QTY', TOTALQTY: 'QTY', QUANTITY: 'QTY', ORDERQTY: 'QTY',
  PCSCTN: 'PCS_CTN', PCSPERCTN: 'PCS_CTN', PCSPERCARTON: 'PCS_CTN', QTYPERCTN: 'PCS_CTN', PCSCTNS: 'PCS_CTN', UNITQTY: 'PCS_CTN',
  LE: 'ODD_RATIO',
  CTNS: 'CTNS', CARTONS: 'CTNS', CARTONQTY: 'CTNS', TOTALCARTONS: 'CTNS',
  DU: 'REMAINDER', REMAINDER: 'REMAINDER', REMAINDERQTY: 'REMAINDER', BALANCEQTY: 'REMAINDER', ODDPCS: 'REMAINDER',
  REMARK: 'REMARK',
  FOBPRICE: 'FOB_PRICE',
  CARECONTENTLABEL: 'CARE_CONTENT_LABEL', CAREANDCONTENTLABEL: 'CARE_CONTENT_LABEL',
  CHINAINSPECTIONTAG: 'CHINA_INSPECTION_TAG',
  FOBAMOUNT: 'FOB_AMOUNT',
  TOTALFOBPRCIETAG: 'TOTAL_FOB_PRICE_TAG', TOTALFOBPRICETAG: 'TOTAL_FOB_PRICE_TAG',
  FOBFTYPRICE: 'FOB_FTY_PRICE', FOBFACTORYPRICE: 'FOB_FTY_PRICE',
  FOBFTYAMOUNT: 'FOB_FTY_AMOUNT', FOBFACTORYAMOUNT: 'FOB_FTY_AMOUNT',
  SHIPMODE: 'SHIP_MODE', SHIPPINGMODE: 'SHIP_MODE',
  SEASON: 'SEASON',
  DP: 'DP_PERCENT', DPPERCENT: 'DP_PERCENT',
  MPRNUMBER: 'MPR_NUMBER', MPRNO: 'MPR_NUMBER', MPR: 'MPR_NUMBER',
  FWD: 'FWD', FORWARDER: 'FWD',
  CARTONBOXSIZE: 'CARTON_BOX_SIZE', CARTONSIZE: 'CARTON_BOX_SIZE', BOXSIZE: 'CARTON_BOX_SIZE',
  NW: 'NW', NETWEIGHT: 'NW', NETWEIGHTKG: 'NW',
  GW: 'GW', GROSSWEIGHT: 'GW', GROSSWEIGHTKG: 'GW',
  REMARK2: 'REMARK_2', REMARK02: 'REMARK_2'
};

const canonicalSourceKey = (label) => {
  const normalized = headerKey(label);
  return SOURCE_ALIAS[normalized] || `RAW_${normalized || 'COLUMN'}`;
};


const ALL_BP_FORMULA_KEYS = new Set([
  'ODD_RATIO', 'CTNS', 'REMAINDER', 'FOB_AMOUNT', 'TOTAL_FOB_PRICE_TAG', 'FOB_FTY_PRICE', 'FOB_FTY_AMOUNT'
]);

const ALL_BP_FORMULA_TEXT = {
  ODD_RATIO: '=O/P',
  CTNS: '=ROUNDDOWN(Q,0)',
  REMAINDER: '=O-(R*P)',
  FOB_AMOUNT: '=O*U',
  TOTAL_FOB_PRICE_TAG: '=O*(U+V+W)',
  FOB_FTY_PRICE: '=ROUND((U+V+W)*AD,2)',
  FOB_FTY_AMOUNT: '=O*Z'
};

const ALL_BP_SHARED_KEYS = new Set([
  'PO', 'STYLE', 'PCS_CTN', 'DC_CODE', 'DESTINATION', 'CHANNEL', 'MASTER_PO',
  'DESCRIPTION', 'COLOR', 'SHIP_MODE', 'SEASON', 'FWD', 'CARTON_BOX_SIZE'
]);

const canonicalRowEntry = (sourceRow, canonical) => Object.entries(sourceRow || {})
  .find(([label]) => canonicalSourceKey(label) === canonical);

const canonicalRowValue = (sourceRow, canonical) => canonicalRowEntry(sourceRow, canonical)?.[1] ?? '';

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

const SYSTEM_COLUMNS = [
  { key: '__stt', label: 'STT', minWidth: 65, group: 'System', render: (row) => value(row.__stt) },
  { key: 'sys:factory', label: 'Factory', minWidth: 90, group: 'System', render: (row) => value(row.factoryCode) },
  { key: 'sys:sku', label: 'SKU', minWidth: 135, group: 'System', render: (row) => value(row.sku) },
  { key: 'sys:exFtyDate', label: 'Ex-Factory', minWidth: 110, group: 'System', render: (row) => value(row.exFtyDate) },
  { key: 'sys:status', label: 'Status', minWidth: 110, group: 'System', render: (row) => <StatusChip status={row.status || 'READY'} /> }
];

const DEFAULT_COLUMN_KEYS = [
  '__stt', 'src:PO', 'src:MASTER_PO', 'sys:factory', 'src:STYLE', 'src:DESCRIPTION', 'src:COLOR',
  'src:QTY', 'src:PCS_CTN', 'src:CTNS', 'src:DESTINATION', 'sys:sku', 'sys:status'
];

const IMPORTANT_SOURCE_ORDER = [
  'PO', 'MASTER_PO', 'STYLE', 'DESCRIPTION', 'COLOR', 'SIZE', 'QTY', 'PCS_CTN', 'CTNS',
  'DESTINATION', 'DC_CODE', 'CHANNEL', 'SHIP_MODE', 'SEASON', 'FWD'
];

const loadSavedColumns = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const uniqueSourceValues = (row, canonical) => {
  const result = [];
  for (const sourceRow of Array.isArray(row?.allBpRows) ? row.allBpRows : []) {
    for (const [label, raw] of Object.entries(sourceRow || {})) {
      if (canonicalSourceKey(label) !== canonical) continue;
      const text = String(raw ?? '').trim();
      if (text && !result.includes(text)) result.push(text);
    }
  }
  return result;
};

const sourceValue = (row, canonical) => {
  // These are PO-level aggregates. For repeated PO rows we show the combined value
  // used by the workflow instead of a misleading "row1 | row2" display.
  if (canonical === 'PO') return value(row.poNumber);
  if (canonical === 'MASTER_PO') return value(row.masterPo);
  if (canonical === 'STYLE') return value(row.styleNumber);
  if (canonical === 'QTY') return value(row.totalQty);
  if (canonical === 'PCS_CTN') return value(row.qtyPerCarton);

  // Formula columns always come from recalculated ALL_BP rows.
  if (ALL_BP_FORMULA_KEYS.has(canonical)) {
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

  const sourceValues = uniqueSourceValues(row, canonical);
  if (sourceValues.length) return sourceValues.join(' | ');

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
  const buyer = getBuyerBySlug(buyerSlug);
  const buyerCode = buyer?.code || '';
  const writable = canManageSales();
  const fileRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [pos, setPos] = useState(pageState());
  const [filters, setFilters] = useState({ poNumber: '', factory: '', style: '', sku: '', destination: '', status: '', exFtyDate: '' });
  const [importMode, setImportMode] = useState('UPSERT');
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(loadSavedColumns);
  const [poEditor, setPoEditor] = useState(null);
  const [poSaving, setPoSaving] = useState(false);
  const [poDeletingId, setPoDeletingId] = useState(null);
  const posRequestRef = useRef(0);
  const posPaginationRef = useRef({ page: 0, size: 10 });

  useEffect(() => {
    if (buyer) saveSelectedBuyer(buyer);
    if (buyer?.code === 'LULULEMON' && orderId) localStorage.setItem('cartonloading.lululemon.orderId', orderId);
  }, [buyer?.code, orderId]);

  const loadOrder = useCallback(async () => {
    if (!buyerCode || !orderId) return;
    try { setOrder(await getManagedOrder(buyerCode, orderId)); }
    catch (e) { setError(e?.response?.data?.message || e?.message || 'Unable to load Order.'); }
  }, [buyerCode, orderId]);

  const loadPos = useCallback(async (page = posPaginationRef.current.page, size = posPaginationRef.current.size) => {
    if (!buyerCode || !orderId) return;
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
      setError(e?.response?.data?.message || e?.message || 'Unable to load PO.');
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
    setImporting(true); setNotice(null); setError('');
    try {
      if (isLululemon(buyer)) {
        const result = await importAllBp(orderId, file, true, buyerCode);
        setNotice({ severity: 'success', text: `ALL_BP imported ${result.createdPos || 0} PO(s). Cartons and Items will be generated only when opened.` });
      } else {
        const result = await importPackingAllocationLines(buyerCode, orderId, file, importMode);
        if (result?.applied === false) throw new Error(result?.errors?.[0]?.message || 'Master Data import failed.');
        let buildMessage = '';
        try {
          const packing = await generatePackingList(buyerCode, orderId, true);
          const cartonPlan = await generateCartonPlanFromWsp(buyerCode, orderId, true);
          buildMessage = ` ${packing?.created || 0} packing row(s), ${cartonPlan?.createdCartons ?? cartonPlan?.created ?? 0} carton(s).`;
        } catch (buildError) {
          buildMessage = ` Import completed; generation needs review: ${buildError?.response?.data?.message || buildError?.message || 'generation failed'}`;
        }
        setNotice({ severity: buildMessage.includes('needs review') ? 'warning' : 'success', text: `Master Data imported.${buildMessage}` });
      }
      await loadOrder(); await loadPos(0, posPaginationRef.current.size);
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || 'Master Data import failed.' });
    } finally { setImporting(false); }
  };

  const openPoEditor = (row) => {
    if (!isLululemon(buyer) || !writable) return;
    const headers = Array.isArray(row.allBpHeaders) && row.allBpHeaders.length
      ? row.allBpHeaders
      : KNOWN_ALL_BP_HEADERS;
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
    if (ALL_BP_FORMULA_KEYS.has(canonical)) return current;

    let rows = current.allBpRows.map((sourceRow, index) => {
      if (index !== rowIndex && !ALL_BP_SHARED_KEYS.has(canonical)) return sourceRow;
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
      setNotice({ severity: 'error', text: 'ALL_BP source row is required.' });
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
      setNotice({ severity: 'error', text: 'PO is required in ALL_BP.' });
      return;
    }
    if (!styleNumber) {
      setNotice({ severity: 'error', text: 'Style# is required in ALL_BP.' });
      return;
    }
    if (!allWholePositive) {
      setNotice({ severity: 'error', text: "Q'ty and Pcs/ctn must be positive whole numbers in every ALL_BP row." });
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
      await updateLululemonPo(orderId, poEditor.id, {
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
        text: 'PO updated. ALL_BP formulas were recalculated and any previously generated Cartons/Items were rebuilt from the new data.'
      });
      await loadPos(posPaginationRef.current.page, posPaginationRef.current.size);
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || 'Unable to update PO.' });
    } finally {
      setPoSaving(false);
    }
  };

  const removeImportedPo = async (row) => {
    if (!row || !isLululemon(buyer) || !writable) return;
    const poId = row.id || row.key;
    if (!poId) return;
    const confirmed = window.confirm(
      `Delete PO "${row.poNumber || ''}"?\n\nGenerated Cartons/Items that have not started Packing will also be removed. This cannot be undone.`
    );
    if (!confirmed) return;

    setPoDeletingId(poId);
    setNotice(null);
    try {
      await deleteLululemonPo(orderId, poId, buyerCode);
      const targetPage = pos.rows.length <= 1 && posPaginationRef.current.page > 0
        ? posPaginationRef.current.page - 1
        : posPaginationRef.current.page;
      setNotice({ severity: 'success', text: `PO ${row.poNumber || ''} deleted.` });
      await loadPos(targetPage, posPaginationRef.current.size);
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || 'Unable to delete PO.' });
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
    KNOWN_ALL_BP_HEADERS.forEach(add);
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
          label,
          minWidth: canonical === 'DESCRIPTION' ? 200 : canonical === 'COLOR' ? 145 : 115,
          group: 'ALL_BP',
          sourceIndex: index,
          render: (row) => sourceValue(row, canonical)
        });
      }
    });

    const priority = new Map(IMPORTANT_SOURCE_ORDER.map((key, index) => [key, index]));
    return Array.from(byCanonical.values()).sort((a, b) => {
      const ap = priority.has(a.canonical) ? priority.get(a.canonical) : 1000 + a.sourceIndex;
      const bp = priority.has(b.canonical) ? priority.get(b.canonical) : 1000 + b.sourceIndex;
      return ap - bp;
    });
  }, [sourceHeaders]);

  const allLululemonColumns = useMemo(() => {
    const stt = SYSTEM_COLUMNS[0];
    const otherSystem = SYSTEM_COLUMNS.slice(1);
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

  const availableColumnKeys = useMemo(() => new Set(allLululemonColumns.map((column) => column.key)), [allLululemonColumns]);
  const availableColumnSignature = useMemo(() => allLululemonColumns.map((column) => column.key).join('|'), [allLululemonColumns]);

  useEffect(() => {
    if (!isLululemon(buyer) || !allLululemonColumns.length) return;
    setVisibleColumnKeys((current) => {
      const defaults = DEFAULT_COLUMN_KEYS.filter((key) => availableColumnKeys.has(key));
      if (!Array.isArray(current)) return defaults;
      const valid = current.filter((key) => availableColumnKeys.has(key));
      const next = valid.length ? valid : defaults;
      if (current.length === next.length && current.every((key, index) => key === next[index])) return current;
      return next;
    });
  }, [buyerCode, availableColumnSignature, availableColumnKeys]);

  useEffect(() => {
    if (!isLululemon(buyer) || !Array.isArray(visibleColumnKeys)) return;
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
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
    if (!isLululemon(buyer)) return fixedColumns;
    const selected = new Set(Array.isArray(visibleColumnKeys) ? visibleColumnKeys : DEFAULT_COLUMN_KEYS);
    const dataColumns = allLululemonColumns.filter((column) => selected.has(column.key));
    if (!writable) return dataColumns;

    return [...dataColumns, {
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
      const selected = new Set(Array.isArray(current) ? current : DEFAULT_COLUMN_KEYS);
      if (selected.has(key)) {
        if (selected.size === 1) return Array.from(selected);
        selected.delete(key);
      } else {
        selected.add(key);
      }
      return Array.from(selected);
    });
  };

  const resetColumns = () => setVisibleColumnKeys(DEFAULT_COLUMN_KEYS.filter((key) => availableColumnKeys.has(key)));
  const showAllColumns = () => setVisibleColumnKeys(allLululemonColumns.map((column) => column.key));

  if (!buyer) return <Alert severity="error">Buyer not found.</Alert>;

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
            {isLululemon(buyer) ? <>
              <Button size="small" component={RouterLink} to={`/buyers/${buyer.slug}/packing`} startIcon={<MoveToInboxOutlined />}>Packing</Button>
              <Button size="small" component={RouterLink} to={`/buyers/${buyer.slug}/shipping`} startIcon={<LocalShippingOutlined />}>Shipping</Button>
              <Button size="small" component={RouterLink} to={`/buyers/${buyer.slug}/carton-loading`} startIcon={<QrCodeScannerOutlined />}>SSCC</Button>
            </> : null}
          </>)}
        />

        {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

        <CompactToolbar>
          <CompactStat label="PO" value={pos.count.toLocaleString()} />
          {!isLululemon(buyer) && writable ? (
            <FormControl size="small" sx={{ minWidth: 155 }}>
              <InputLabel>Import Mode</InputLabel>
              <Select label="Import Mode" value={importMode} onChange={(e) => setImportMode(e.target.value)}>
                <MenuItem value="CREATE_ONLY">Create Only</MenuItem>
                <MenuItem value="UPSERT">Update + Create</MenuItem>
                <MenuItem value="REPLACE_ALL">Replace All</MenuItem>
              </Select>
            </FormControl>
          ) : null}
          {writable ? <>
            <Button size="small" variant="contained" startIcon={<CloudUploadOutlined />} onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? 'Importing...' : 'Import Excel'}
            </Button>
            <input ref={fileRef} hidden type="file" accept=".xlsx,.xls" onChange={uploadMasterData} />
          </> : <Chip size="small" label="View only" />}

          {isLululemon(buyer) ? <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ViewColumnOutlined />}
              onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
            >
              Columns {(visibleColumnKeys || DEFAULT_COLUMN_KEYS).filter((key) => availableColumnKeys.has(key)).length}/{allLululemonColumns.length}
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
              {allLululemonColumns.map((column) => {
                const checked = (visibleColumnKeys || DEFAULT_COLUMN_KEYS).includes(column.key);
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
                  <TextField required size="small" label="Factory" value={poEditor.factoryCode || ''} onChange={(e) => setPoField('factoryCode', e.target.value)} />
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
                      const formula = ALL_BP_FORMULA_KEYS.has(canonical);
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
