import useActiveFactories from '../../../../common/factory/useActiveFactories';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Breadcrumbs, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, LinearProgress, Link, ListItemText, Menu, MenuItem, Select, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import {
  ArrowBack, CloudUploadOutlined, DeleteOutline, EditOutlined, FilterListOutlined, LocalShippingOutlined, MoveToInboxOutlined, QrCodeScannerOutlined, Refresh, ScaleOutlined, ViewColumnOutlined
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { APP_MESSAGES, createAllBpImportedMessage, createGenerationReviewMessage, createMasterDataBuildSummary, createMasterDataImportedMessage, createPoDeletedMessage, createWorkflowNotConfiguredMessage, createDeleteImportedPoConfirmMessage } from '../../../../constants/appMessages';

import ManagementTable from 'components/ManagementTable';
import PoScanProgressCell from 'buyers/lululemon/components/PoScanProgressCell';
import PoInspectionProgressCell from 'buyers/lululemon/components/PoInspectionProgressCell';
import StatusChip from 'components/StatusChip';
import { CompactPageHeader, CompactStat, CompactToolbar } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { BUYER_CODE, buyerOrderStorageKey, ALL_BP_KNOWN_HEADERS, ALL_BP_FORMULA_KEYS, ALL_BP_FORMULA_TEXT, ALL_BP_UI_LABELS, ALL_BP_SHARED_KEYS, ALL_BP_IMPORTANT_SOURCE_ORDER, DEFAULT_TABLE_ROWS_PER_PAGE, EXCEL_FILE_ACCEPT, IMPORT_MODE, DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY, WORKSPACE_SYSTEM_COLUMN_DEFINITIONS, WORKSPACE_DEFAULT_COLUMN_KEYS, PROGRESS_STATUS } from '../../../../constants/appConstants';
import { value, canonicalSourceKey, canonicalRowEntry, canonicalRowValue, calculatedCartonMetrics, fallbackAllBpValue, recalculateAllBpPreview, sourceValue } from 'buyers/lululemon/domain/allBpWorkspace';
import { canAssignBarcode, canManageSales, canWeightCheck } from 'utils/accessControl';
import { useSelectedFactory } from 'utils/factorySelection';
import { getBuyerBySlug, saveSelectedBuyer } from 'utils/buyerAccess';
import { getManagedOrder, getManagedScheduledPoInspectionSummary, listManagedPos } from 'services/managementService';
import { createShippingSchedule, createWeighingOrder, deletePo, importAllBp, listShippingSchedules, schedulePoShippingDate, updatePo } from 'buyers/lululemon/services/service';
import { generatePackingList, importPackingAllocationLines } from 'buyers/es/services/packingListService';
import { generateCartonPlanFromWsp } from 'buyers/es/services/cartonLoadingService';

// Schedule picker uses the same ALL_BP metadata as the PO management table.
// Filters are evaluated by the backend before pagination, so a search never
// silently omits unscheduled POs from other pages.
const SCHEDULE_COLUMN_STORAGE_KEY = 'lululemon.shipping-schedule.columns.v1';
const SCHEDULE_DEFAULT_COLUMNS = Object.freeze(['po', 'masterPo', 'style', 'description', 'color', 'qty']);
const SCHEDULE_COLUMN_CATALOG = Object.freeze([
  { key: 'po', label: 'PO', minWidth: 110 },
  { key: 'masterPo', label: 'Master PO', minWidth: 110 },
  { key: 'style', label: 'Style', minWidth: 125 },
  { key: 'description', label: 'Description', minWidth: 190 },
  { key: 'color', label: 'Color Description', minWidth: 170 },
  { key: 'qty', label: 'QTY', minWidth: 92 },
  { key: 'factory', label: 'Factory', minWidth: 88 },
  { key: 'sku', label: 'SKU', minWidth: 145 },
  { key: 'destination', label: 'Destination', minWidth: 145 },
  { key: 'exFactory', label: 'Ex-Factory', minWidth: 115 },
  { key: 'cartonRatio', label: 'Carton Ratio', minWidth: 110 },
  { key: 'fullCartons', label: 'Full Ctns', minWidth: 100 },
  { key: 'remainderQty', label: 'Remainder Qty', minWidth: 115 },
  { key: 'packingPlan', label: 'Packing Plan', minWidth: 125 },
  { key: 'status', label: 'Workflow Status', minWidth: 130 }
]);
const emptyScheduleFilters = () => ({ poNumber: '', masterPo: '', style: '', description: '', color: '', qty: '', factory: '', sku: '', destination: '' });
const savedScheduleColumns = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(SCHEDULE_COLUMN_STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? [...new Set(saved.filter((key) => typeof key === 'string'))] : [...SCHEDULE_DEFAULT_COLUMNS];
  } catch { return [...SCHEDULE_DEFAULT_COLUMNS]; }
};
const scheduleColumnText = (row, key) => {
  switch (key) {
    case 'po': return row.poNumber;
    case 'masterPo': return row.masterPo;
    case 'style': return row.styleNumber;
    case 'description': return row.description;
    case 'color': return row.color;
    case 'qty': return row.totalQty == null ? '—' : Number(row.totalQty).toLocaleString('en-US');
    case 'factory': return row.factoryCode;
    case 'sku': return row.sku;
    case 'destination': return row.destination;
    case 'exFactory': return row.exFtyDate;
    case 'cartonRatio': return calculatedCartonMetrics(row).reduce((sum, metric) => sum + metric.cartonRatio, 0) || row.plannedCartons;
    case 'fullCartons': return calculatedCartonMetrics(row).reduce((sum, metric) => sum + metric.fullCartons, 0);
    case 'remainderQty': return row.remainderQty;
    case 'packingPlan': return row.packingPlan;
    case 'status': return row.status;
    default: return key.startsWith('bp:') ? sourceValue(row, key.slice(3)) : '—';
  }
};

const emptyPoFilters = () => ({ poNumber: '', factory: '', style: '', sku: '', destination: '', status: '', inspectionStatus: '', exFtyDate: '' });
const pageState = () => ({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE, count: 0, rows: [], loading: false });
const isSsccWorkflowBuyer = (buyer) => buyer?.code === BUYER_CODE.LULULEMON;
const isBarcodeWorkflowBuyer = (buyer) => buyer?.code === BUYER_CODE.ENGELBERT_STRAUSS;
const hasOperationalWorkflow = (buyer) => isSsccWorkflowBuyer(buyer) || isBarcodeWorkflowBuyer(buyer);

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

export default function BuyerOrderWorkspacePage() {
  const { codes: factoryCodes } = useActiveFactories();
  const { buyerSlug, orderId } = useParams();
  const navigate = useNavigate();
  // Keep the resolved buyer object stable for the lifetime of the route.
  // getBuyerBySlug() rebuilds the catalog objects, so calling it on every render
  // would otherwise create a new object reference each time.
  const buyer = useMemo(() => getBuyerBySlug(buyerSlug), [buyerSlug]);
  const buyerCode = buyer?.code || '';
  const { factoryCode: selectedFactory, loading: factoryLoading } = useSelectedFactory(buyerCode);
  const writable = canManageSales();
  // LULULEMON hand-off is Packing's exclusive Shipment Management flow.
  const maySendToWeight = !isSsccWorkflowBuyer(buyer) && (canManageSales() || canAssignBarcode() || canWeightCheck());
  const fileRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [pos, setPos] = useState(pageState());
  const [filters, setFilters] = useState(emptyPoFilters);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
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
  const [shippingSchedules, setShippingSchedules] = useState([]);
  const [poTab, setPoTab] = useState('all');
  const [scheduledInspection, setScheduledInspection] = useState(null);
  const [scheduledInspectionLoading, setScheduledInspectionLoading] = useState(false);
  const [scheduledInspectionError, setScheduledInspectionError] = useState('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleSelection, setScheduleSelection] = useState([]);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleSearchTerm, setScheduleSearchTerm] = useState('');
  const [scheduleFilters, setScheduleFilters] = useState(emptyScheduleFilters);
  const [scheduleAppliedFilters, setScheduleAppliedFilters] = useState(emptyScheduleFilters);
  const [scheduleFiltersOpen, setScheduleFiltersOpen] = useState(false);
  const [scheduleColumnsAnchor, setScheduleColumnsAnchor] = useState(null);
  const [scheduleVisibleColumns, setScheduleVisibleColumns] = useState(savedScheduleColumns);
  const [scheduleCandidates, setScheduleCandidates] = useState(pageState());
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const scheduleRequestRef = useRef(0);
  const [reassignDialog, setReassignDialog] = useState(null);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [selectedWeightPoIds, setSelectedWeightPoIds] = useState([]);
  const [sendingToWeight, setSendingToWeight] = useState(false);
  const posRequestRef = useRef(0);
  const posPaginationRef = useRef({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE });

  // Keep inputs interactive while typing; only query PO data after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setScheduleSearchTerm(scheduleSearch.trim());
      setScheduleAppliedFilters(scheduleFilters);
    }, 300);
    return () => clearTimeout(timer);
  }, [scheduleSearch, scheduleFilters]);

  useEffect(() => {
    if (buyer) saveSelectedBuyer(buyer);
    if (buyer?.code === BUYER_CODE.LULULEMON && orderId) localStorage.setItem(buyerOrderStorageKey(buyer.code), orderId);
  }, [buyer?.code, orderId]);

  const loadOrder = useCallback(async () => {
    if (!buyerCode || !orderId) return;
    try { setOrder(await getManagedOrder(buyerCode, orderId)); }
    catch (e) { setError(e?.response?.data?.message || e?.message || APP_MESSAGES.LOAD_ORDER_FAILED); }
  }, [buyerCode, orderId]);

  const loadShippingSchedules = useCallback(async () => {
    if (!buyerCode || !orderId || !isSsccWorkflowBuyer(buyer)) {
      setShippingSchedules([]);
      return;
    }
    try {
      setShippingSchedules(await listShippingSchedules(orderId, buyerCode));
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Unable to load Shipping Schedule assignments.');
    }
  }, [buyer, buyerCode, orderId]);

  const loadScheduledInspection = useCallback(async () => {
    if (buyerCode !== BUYER_CODE.LULULEMON || !orderId) return;
    setScheduledInspectionLoading(true);
    setScheduledInspectionError('');
    try {
      const summary = await getManagedScheduledPoInspectionSummary(buyerCode, orderId);
      setScheduledInspection(summary);
    } catch (e) {
      setScheduledInspectionError(e?.response?.data?.message || e?.message || 'Unable to load scheduled PO inspection totals.');
    } finally {
      setScheduledInspectionLoading(false);
    }
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
      const result = await listManagedPos(buyerCode, orderId, { ...debouncedFilters,
        inspectionStatus: buyerCode === BUYER_CODE.LULULEMON ? debouncedFilters.inspectionStatus : undefined,
        shippingScheduled: buyerCode === BUYER_CODE.LULULEMON && poTab !== 'all' ? poTab === 'scheduled' : undefined, page: nextPage, size: nextSize });
      if (requestId !== posRequestRef.current) return;

      const rows = (result?.content || []).map((row, index) => ({ ...row, __stt: nextPage * nextSize + index + 1 }));
      setPos({ page: nextPage, size: nextSize, count: Number(result?.totalElements || 0), rows, loading: false });
    } catch (e) {
      if (requestId !== posRequestRef.current) return;
      setError(e?.response?.data?.message || e?.message || APP_MESSAGES.LOAD_PO_FAILED);
      setPos((current) => ({ ...current, loading: false }));
    }
  }, [buyerCode, orderId, debouncedFilters, poTab]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    loadShippingSchedules();
  }, [loadShippingSchedules]);

  useEffect(() => {
    loadPos(0, posPaginationRef.current.size);
  }, [loadPos]);

  useEffect(() => {
    if (poTab === 'scheduled' && buyerCode === BUYER_CODE.LULULEMON) loadScheduledInspection();
  }, [poTab, buyerCode, loadScheduledInspection]);

  const loadScheduleCandidates = useCallback(async (page = 0, size = 25) => {
    if (!scheduleDialogOpen || buyerCode !== BUYER_CODE.LULULEMON || !orderId) return;
    const requestId = ++scheduleRequestRef.current;
    setScheduleCandidates((current) => ({ ...current, page, size, loading: true }));
    try {
      const result = await listManagedPos(buyerCode, orderId, {
        shippingScheduled: false,
        search: scheduleSearchTerm,
        ...scheduleAppliedFilters,
        page,
        size
      });
      if (requestId !== scheduleRequestRef.current) return;
      setScheduleCandidates({
        rows: result?.content || [],
        count: Number(result?.totalElements || 0),
        page,
        size,
        loading: false
      });
    } catch (e) {
      if (requestId !== scheduleRequestRef.current) return;
      setScheduleCandidates((current) => ({ ...current, loading: false }));
      setScheduleError(e?.response?.data?.message || e?.message || 'Unable to load unscheduled POs.');
    }
  }, [buyerCode, orderId, scheduleDialogOpen, scheduleSearchTerm, scheduleAppliedFilters]);

  useEffect(() => {
    if (scheduleDialogOpen) loadScheduleCandidates(0, 25);
  }, [scheduleDialogOpen, loadScheduleCandidates]);

  const scheduleColumns = useMemo(() => {
    const seen = new Set(SCHEDULE_COLUMN_CATALOG.map((column) => column.key));
    const columns = [...SCHEDULE_COLUMN_CATALOG];
    const sourceHeaders = [...ALL_BP_KNOWN_HEADERS, ...scheduleCandidates.rows.flatMap((row) => [
      ...(row.allBpHeaders || []), ...(row.allBpRows || []).flatMap((entry) => Object.keys(entry || {}))
    ])];
    sourceHeaders.forEach((header) => {
      const canonical = canonicalSourceKey(header);
      const key = `bp:${canonical}`;
      if (!canonical || seen.has(key)) return;
      seen.add(key);
      columns.push({ key, label: ALL_BP_UI_LABELS[canonical] || header, minWidth: canonical === 'DESCRIPTION' ? 190 : 125 });
    });
    return columns;
  }, [scheduleCandidates.rows]);

  const visibleScheduleColumns = useMemo(() => {
    const columnMap = new Map(scheduleColumns.map((col) => [col.key, col]));
    const selected = scheduleVisibleColumns.map((key) => columnMap.get(key)).filter(Boolean);
    return selected.length ? selected : SCHEDULE_COLUMN_CATALOG.filter((column) => SCHEDULE_DEFAULT_COLUMNS.includes(column.key));
  }, [scheduleColumns, scheduleVisibleColumns]);

  const toggleScheduleColumn = (key) => {
    setScheduleVisibleColumns((previous) => {
      const next = previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key];
      if (!next.length) return previous;
      try { localStorage.setItem(SCHEDULE_COLUMN_STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };

  const resetScheduleColumns = () => {
    setScheduleVisibleColumns([...SCHEDULE_DEFAULT_COLUMNS]);
    try { localStorage.setItem(SCHEDULE_COLUMN_STORAGE_KEY, JSON.stringify(SCHEDULE_DEFAULT_COLUMNS)); } catch { /* private mode */ }
  };

  const schedulePageIds = scheduleCandidates.rows.map((candidate) => candidate.id || candidate.key).filter(Boolean);
  const selectedScheduleIds = new Set(scheduleSelection.map((selected) => selected.id));
  const scheduledSelectedPageCount = schedulePageIds.filter((id) => selectedScheduleIds.has(id)).length;
  const scheduleAllPageSelected = schedulePageIds.length > 0 && scheduledSelectedPageCount === schedulePageIds.length;
  const toggleSchedulePage = () => {
    if (scheduleAllPageSelected) {
      const pageIds = new Set(schedulePageIds);
      setScheduleSelection((previous) => previous.filter((selected) => !pageIds.has(selected.id)));
    } else {
      setScheduleSelection((previous) => {
        const existing = new Set(previous.map((selected) => selected.id));
        const available = scheduleCandidates.rows.filter((row) => !existing.has(row.id || row.key));
        const additions = available.slice(0, Math.max(0, 200 - previous.length))
          .map((row) => ({ id: row.id || row.key, poNumber: row.poNumber, factoryCode: row.factoryCode }));
        return [...previous, ...additions];
      });
    }
  };

  const openScheduleDialog = () => {
    setScheduleDate('');
    setScheduleSelection([]);
    setScheduleSearch('');
    setScheduleFilters(emptyScheduleFilters());
    setScheduleFiltersOpen(false);
    setScheduleColumnsAnchor(null);
    setScheduleError('');
    setScheduleDialogOpen(true);
  };

  const toggleScheduleSelection = (row) => {
    const id = row.id || row.key;
    if (!id) return;
    setScheduleSelection((current) => current.some((po) => po.id === id)
      ? current.filter((po) => po.id !== id)
      : current.length >= 200 ? current : [...current, { id, poNumber: row.poNumber, factoryCode: row.factoryCode }]);
  };

  const submitShippingPlan = async () => {
    if (!scheduleDate || !scheduleSelection.length || scheduleSaving) return;
    setScheduleSaving(true);
    setScheduleError('');
    try {
      const result = await schedulePoShippingDate(orderId, {
        shippingDate: scheduleDate,
        poIds: scheduleSelection.map((po) => po.id)
      }, buyerCode);
      setScheduleDialogOpen(false);
      setScheduleSelection([]);
      setNotice({ severity: 'success', text: `Successfully scheduled ${result?.scheduledCount ?? 0} PO(s) for ${scheduleDate}.` });
      // The tab effect fetches server-filtered data; never move rows in local-only state.
      if (poTab === 'scheduled') {
        await Promise.all([loadPos(0, posPaginationRef.current.size), loadScheduledInspection()]);
      } else {
        setPoTab('scheduled');
      }
    } catch (e) {
      setScheduleError(e?.response?.data?.message || e?.message || 'Unable to save the shipping schedule. Review the selected POs and try again.');
      // A concurrent update could commit a subset. Force the caller to refresh before retrying.
      loadScheduleCandidates(scheduleCandidates.page, scheduleCandidates.size);
    } finally {
      setScheduleSaving(false);
    }
  };

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
      if (buyerCode === BUYER_CODE.LULULEMON && poTab === 'scheduled') await loadScheduledInspection();
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || APP_MESSAGES.MASTER_DATA_IMPORT_FAILED });
    } finally { setImporting(false); setImportProgress(0); }
  };

  const openPoEditor = (row) => {
    if (!isSsccWorkflowBuyer(buyer) || !writable || row.weightEditLocked) return;
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
      picked: Boolean(row.picked),
      structuralLocked: Boolean(row.hasOperationalData || row.plannedShippingDate || poAssignmentMap.has(row.id || row.key)),
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
              // Never fall back to ALL_BP raw numbers: those are planned, not completed.
              // The progress component explicitly marks missing old-API data as unavailable.
              return progress;
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

  const poAssignmentMap = useMemo(() => {
    const map = new Map();
    shippingSchedules.forEach((row) => {
      const schedule = row?.schedule;
      if (!schedule?.poIds?.length || schedule.status === 'COMPLETED') return;
      const assignment = {
        scheduleId: schedule.id,
        scheduleNo: schedule.scheduleNo,
        status: schedule.status,
        factoryCode: schedule.factoryCode || '',
        exFtyDate: schedule.exFtyDate || '',
        reassignable: ['PLANNED', 'REVIEWED'].includes(schedule.status) && !schedule.weighingOrderId && !schedule.sentToWeightAt
      };
      schedule.poIds.forEach((poId) => {
        if (!map.has(poId)) map.set(poId, assignment);
      });
    });
    return map;
  }, [shippingSchedules]);

  const openPoReassignDialog = (row, assignment) => {
    const poId = row?.id || row?.key;
    if (!poId || !assignment?.reassignable) return;
    setReassignDialog({
      poId,
      poNumber: row.poNumber,
      currentScheduleNo: assignment.scheduleNo,
      currentStatus: assignment.status,
      factoryCode: assignment.factoryCode || row.factoryCode || '',
      exFtyDate: assignment.exFtyDate || row.exFtyDate || ''
    });
  };

  const setReassignField = (key, nextValue) => setReassignDialog((current) => current ? { ...current, [key]: nextValue } : current);

  const savePoReassignment = async () => {
    if (!orderId || !reassignDialog?.poId || !reassignDialog.factoryCode || !reassignDialog.exFtyDate || reassignSaving) return;
    setReassignSaving(true);
    setNotice(null);
    setError('');
    try {
      const detail = await createShippingSchedule(orderId, {
        factoryCode: reassignDialog.factoryCode,
        exFtyDate: reassignDialog.exFtyDate,
        poIds: [reassignDialog.poId]
      }, buyerCode);
      setNotice({
        severity: 'success',
        text: `PO ${reassignDialog.poNumber} was reassigned to ${detail?.schedule?.scheduleNo || 'a new Shipping Schedule'}.`
      });
      setReassignDialog(null);
      await Promise.all([
        loadPos(posPaginationRef.current.page, posPaginationRef.current.size),
        loadShippingSchedules()
      ]);
    } catch (e) {
      setNotice({ severity: 'error', text: e?.response?.data?.message || e?.message || 'Unable to reassign the selected PO.' });
    } finally {
      setReassignSaving(false);
    }
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
    const weightSelectColumn = false ? [{
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
    const planningDateColumn = {
      key: 'plannedShippingDate', label: 'Scheduled Ship Date', minWidth: 155,
      render: (row) => row.plannedShippingDate
        ? <Chip size="small" color="primary" variant="outlined" label={row.plannedShippingDate} />
        : <Typography variant="caption" color="text.secondary">Not scheduled</Typography>
    };
    // Fixed operational column, visible in ALL three LULULEMON PO tabs regardless of
    // per-user ALL_BP column preferences. Never infer carton completion by adding
    // separate RFID and Weight totals: both PASS must refer to the SAME carton.
    const inspectionColumn = {
      key: '__inspection', label: 'Carton / RFID / Weight', minWidth: 228,
      render: (row) => <PoInspectionProgressCell row={row} />
    };
    if (!writable) return [inspectionColumn, ...weightSelectColumn, ...dataColumns, planningDateColumn];

    return [inspectionColumn, ...weightSelectColumn, ...dataColumns, planningDateColumn, {
      key: '__actions',
      label: 'Actions',
      minWidth: 105,
      render: (row) => {
        const poId = row.id || row.key;
        const deleting = poDeletingId === poId;
        const assignment = poAssignmentMap.get(poId);
        return (
          <Stack direction="row" spacing={0.25} onClick={(event) => event.stopPropagation()}>
            {row.weightEditLocked ? (
              <Tooltip title="Carton Weight completed: PO editing locked.">
                <Chip size="small" label="Weight Locked" variant="outlined" />
              </Tooltip>
            ) : (
              <Tooltip title={row.hasOperationalData || assignment
                ? 'Edit PO (descriptive fields only once Packing/Shipment starts; carton/scan data is preserved)'
                : 'Edit imported PO, including already picked POs'}>
                <span><IconButton size="small" disabled={deleting} onClick={() => openPoEditor(row)}><EditOutlined fontSize="small" /></IconButton></span>
              </Tooltip>
            )}
            {!row.weightEditLocked && !row.picked && !row.hasOperationalData && !row.plannedShippingDate && !assignment ? (
              <Tooltip title="Delete unpicked and unstarted PO">
                <span><IconButton size="small" color="error" disabled={deleting} onClick={() => removeImportedPo(row)}><DeleteOutline fontSize="small" /></IconButton></span>
              </Tooltip>
            ) : null}
            {false && !row.weightEditLocked && assignment?.reassignable ? (
              <Tooltip title={`Reassign from ${assignment.scheduleNo}`}>
                <span><IconButton size="small" color="primary" disabled={deleting} onClick={() => openPoReassignDialog(row, assignment)}><LocalShippingOutlined fontSize="small" /></IconButton></span>
              </Tooltip>
            ) : null}
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
          subtitle={isSsccWorkflowBuyer(buyer) ? 'Import Excel All_BP (sheet All_BP; headers on row 2). Factory comes from this Order. Open a PO for SSCC / RFID / Weight.' : 'Purchase Orders · Cartons and Items are generated only when opened.'}
          breadcrumbs={(
            <Breadcrumbs separator="/">
              <Link component={RouterLink} underline="hover" color="inherit" to="/workflow">Buyers</Link>
              <Link component={RouterLink} underline="hover" color="inherit" to={`/buyers/${buyer.slug}/orders`}>{buyer.label}</Link>
              <Typography color="text.primary">{order?.orderName || 'Order'}</Typography>
            </Breadcrumbs>
          )}
          meta={<Chip size="small" variant="outlined" label={isSsccWorkflowBuyer(buyer) ? 'PO Workspace' : `${pos.count.toLocaleString()} POs`} />}
          actions={(<>
            <Tooltip title="Back to Orders"><Button size="small" startIcon={<ArrowBack />} onClick={() => navigate(`/buyers/${buyer.slug}/orders`)}>Orders</Button></Tooltip>
            <Tooltip title="Refresh"><Button size="small" startIcon={<Refresh />} onClick={() => { loadOrder(); loadShippingSchedules(); loadPos(posPaginationRef.current.page, posPaginationRef.current.size); if (poTab === 'scheduled') loadScheduledInspection(); }}>Refresh</Button></Tooltip>
            {isSsccWorkflowBuyer(buyer) ? <Chip size="small" variant="outlined" label="Open a PO → Scan / RFID / Weight" /> : null}
          </>)}
        />

        {isSsccWorkflowBuyer(buyer) && !factoryLoading && order?.factoryCode &&
          String(order.factoryCode).toUpperCase() !== String(selectedFactory || '').toUpperCase() &&
          <Alert severity="warning">This Order belongs to Factory {order.factoryCode}. Select that Factory in the header to work on its PO.</Alert>}
        {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        {!hasOperationalWorkflow(buyer) ? (
          <Alert severity="info">{APP_MESSAGES.BUYER_WORKFLOW_NOT_ASSIGNED}</Alert>
        ) : null}

        {/* Global PO actions stay above and independent of the three schedule tabs. */}
        {isSsccWorkflowBuyer(buyer) ? (
          <CompactToolbar sx={{ px: { xs: 1.25, md: 1.75 }, py: 1.25, borderRadius: 2.5 }}>
            <Box sx={{ width: '100%', minWidth: 0 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                spacing={1.5}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={800} color="text.primary">PO Management</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Schedule shipments, import PO data, and customize your table view.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                  {writable ? (
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<LocalShippingOutlined />}
                      onClick={openScheduleDialog}
                      sx={{ textTransform: 'none', fontWeight: 750, minHeight: 36, whiteSpace: 'nowrap' }}
                    >
                      Schedule Shipping
                    </Button>
                  ) : null}
                  {writable ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={importing ? <CircularProgress size={15} thickness={5} /> : <CloudUploadOutlined />}
                      onClick={() => fileRef.current?.click()}
                      disabled={importing}
                      sx={{ textTransform: 'none', fontWeight: 700, minHeight: 36, whiteSpace: 'nowrap' }}
                    >
                      {importing ? (importProgress < 100 ? `Uploading ${importProgress}%` : 'Processing file...') : 'Import Excel (All_BP)'}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ViewColumnOutlined />}
                    onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
                    aria-label="Customize PO table columns"
                    aria-haspopup="menu"
                    aria-expanded={Boolean(columnMenuAnchor)}
                    sx={{ textTransform: 'none', fontWeight: 700, minHeight: 36, whiteSpace: 'nowrap' }}
                  >
                    Columns {(visibleColumnKeys || WORKSPACE_DEFAULT_COLUMN_KEYS).filter((key) => availableColumnKeys.has(key)).length}/{allWorkflowColumns.length}
                  </Button>
                  {!writable ? <Chip size="small" label="View only" /> : null}
                </Stack>
              </Stack>
              {importing ? (
                <Box sx={{ maxWidth: 340, mt: 1 }}>
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
              <Menu
                anchorEl={columnMenuAnchor}
                open={Boolean(columnMenuAnchor)}
                onClose={() => setColumnMenuAnchor(null)}
                PaperProps={{ sx: { width: 330, maxHeight: 520 } }}
              >
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography fontWeight={800}>Customize Columns</Typography>
                  <Typography variant="caption" color="text.secondary">Choose which columns are shown in the PO table.</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" onClick={resetColumns}>Default</Button>
                    <Button size="small" onClick={showAllColumns}>Show All</Button>
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
            </Box>
          </CompactToolbar>
        ) : (
          <CompactToolbar>
            <CompactStat label="POs" value={pos.count.toLocaleString()} />
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
            {writable && hasOperationalWorkflow(buyer) ? (
              <>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={importing ? <CircularProgress size={15} thickness={5} /> : <CloudUploadOutlined />}
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (importProgress < 100 ? `Uploading ${importProgress}%` : 'Processing file...') : 'Import Excel'}
                </Button>
                <input ref={fileRef} hidden type="file" accept={EXCEL_FILE_ACCEPT} onChange={uploadMasterData} />
              </>
            ) : !writable ? <Chip size="small" label="View only" /> : null}
          </CompactToolbar>
        )}

        {isSsccWorkflowBuyer(buyer) ? (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 0.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Tabs
                value={poTab}
                onChange={(_, next) => { setPoTab(next); posPaginationRef.current.page = 0; }}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="LULULEMON purchase order shipping schedule views"
                sx={{
                  minHeight: 44,
                  minWidth: 0,
                  '& .MuiTab-root': {
                    minHeight: 44,
                    minWidth: 0,
                    px: { xs: 1.25, sm: 2 },
                    textTransform: 'none',
                    fontWeight: 700
                  }
                }}
              >
                <Tab value="all" label="1. All POs" />
                <Tab value="scheduled" label="2. Scheduled POs" />
                <Tab value="unscheduled" label="3. Unscheduled POs" />
              </Tabs>
              <Chip
                size="small"
                variant="outlined"
                label={pos.loading ? 'Loading POs...' : `${pos.count.toLocaleString()} ${pos.count === 1 ? 'PO' : 'POs'} in view`}
                sx={{ flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' }, bgcolor: 'background.paper' }}
              />
            </Stack>
          </Box>
        ) : null}

        {isSsccWorkflowBuyer(buyer) && poTab === 'scheduled' ? (
          <Box sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', borderRadius: 2, px: 1.5, py: 1.25 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={0.5} sx={{ mb: 1 }}>
              <Box>
                <Typography fontWeight={800} variant="subtitle2">Scheduled PO Inspection Overview</Typography>
                <Typography variant="caption" color="text.secondary">
                  Across all scheduled POs in this Order · Complete only when all planned cartons have RFID PASS and Weight PASS.
                </Typography>
              </Box>
              <Button size="small" startIcon={scheduledInspectionLoading ? <CircularProgress size={14} /> : <Refresh />}
                disabled={scheduledInspectionLoading} onClick={loadScheduledInspection} sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}>
                Refresh Totals
              </Button>
            </Stack>
            {scheduledInspectionError ? <Alert severity="error" sx={{ mb: 1 }}>{scheduledInspectionError}</Alert> : null}
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' } }}>
              {[
                { label: 'Scheduled POs', number: scheduledInspection?.totalScheduledPos, tone: 'text.primary' },
                { label: 'Fully Completed', number: scheduledInspection?.completedPos, tone: 'success.main' },
                { label: 'RFID Not Complete', number: scheduledInspection?.pendingRfidPos, tone: 'warning.main' },
                { label: 'Weight Not Complete', number: scheduledInspection?.pendingWeightPos, tone: 'warning.main' },
                { label: 'Both Not Complete', number: scheduledInspection?.pendingBothPos, tone: 'error.main' }
              ].map((item) => (
                <Box key={item.label} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25, minWidth: 0, bgcolor: '#FBFCFE' }}>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap title={item.label}>{item.label}</Typography>
                  <Typography variant="h5" fontWeight={850} color={item.tone} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {scheduledInspectionLoading && !scheduledInspection ? '…' : (item.number === undefined || item.number === null ? '—' : Number(item.number).toLocaleString())}
                  </Typography>
                </Box>
              ))}
            </Box>
            {scheduledInspection ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {scheduledInspection.incompletePos.toLocaleString()} PO(s) incomplete overall · {scheduledInspection.rfidFailedPos.toLocaleString()} with RFID failures · {scheduledInspection.weightFailedPos.toLocaleString()} with Weight failures. Categories can overlap; not limited to the current table page.
              </Typography>
            ) : null}
          </Box>
        ) : null}

        <ManagementTable
          filterBar={<TableFilterBar
          fields={[
            { key: 'poNumber', label: 'PO No.' },
            { key: 'factory', label: 'Factory' },
            { key: 'style', label: 'Style' },
            { key: 'sku', label: 'SKU' },
            { key: 'destination', label: 'Destination' },
            { key: 'status', label: isSsccWorkflowBuyer(buyer) ? 'Workflow Status' : 'Status' },
            ...(isSsccWorkflowBuyer(buyer) ? [{
              key: 'inspectionStatus', label: 'Inspection Progress', options: [
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'INCOMPLETE', label: 'Incomplete' },
                { value: 'IMPORTING', label: 'Importing' },
                { value: 'NOT_STARTED', label: 'Imported / Not Started' }
              ]
            }] : []),
            { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' }
          ]}
          values={filters}
          onChange={(key, nextValue) => setFilters((current) => ({ ...current, [key]: nextValue }))}
          onClear={() => setFilters(emptyPoFilters())}
        />}
          title={buyerCode === BUYER_CODE.LULULEMON
            ? (poTab === 'scheduled' ? 'Scheduled POs' : poTab === 'unscheduled' ? 'Unscheduled POs' : 'All Purchase Orders')
            : 'Purchase Orders'}
          {...pos}
          rowsPerPage={pos.size}
          getRowId={(row) => row.key}
          onRowClick={openPo}
          onPageChange={(page) => loadPos(page, posPaginationRef.current.size)}
          onRowsPerPageChange={(size) => loadPos(0, size)}
          columns={tableColumns}
          emptyText={buyerCode === BUYER_CODE.LULULEMON && filters.inspectionStatus === 'IMPORTING'
            ? 'PO records become available after ALL_BP import finishes. Live upload progress is shown above.'
            : buyerCode === BUYER_CODE.LULULEMON && poTab === 'scheduled'
            ? 'No scheduled POs match the current filters.'
            : buyerCode === BUYER_CODE.LULULEMON && poTab === 'unscheduled'
              ? 'No unscheduled POs match the current filters.'
              : 'No PO records. Import Excel to create PO data for this Order.'}
        />
      </Stack>

      {isSsccWorkflowBuyer(buyer) ? (
        <Dialog
          open={scheduleDialogOpen}
          onClose={() => { if (!scheduleSaving) setScheduleDialogOpen(false); }}
          fullWidth maxWidth="lg"
          PaperProps={{ sx: { width: 'min(1350px, 98vw)', maxWidth: 'none', maxHeight: 'calc(100dvh - 32px)', display: 'flex', overflow: 'hidden' } }}
        >
          <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>Schedule Shipping · LULULEMON</DialogTitle>
          <Box sx={{ px: 2.5, pb: 1, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, alignItems: { sm: 'center' }, flexShrink: 0 }}>
            <TextField size="small" required type="date" label="Shipping Date" value={scheduleDate}
              InputLabelProps={{ shrink: true }} onChange={(event) => setScheduleDate(event.target.value)}
              sx={{ width: { xs: '100%', sm: 230 } }} />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Select unscheduled POs in this Order. HOD and Ex-Factory dates remain unchanged.
            </Typography>
            <Chip color={scheduleSelection.length ? 'primary' : 'default'} variant="outlined" size="small"
              label={`${scheduleSelection.length} selected · Max 200`} />
          </Box>
          <Box sx={{ px: 2.5, pb: 1, flexShrink: 0 }}>
            {scheduleError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setScheduleError('')}>{scheduleError}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
              <TextField size="small" fullWidth label="Search POs" placeholder="PO, Master PO, Style, Description, Color, SKU…"
                value={scheduleSearch} onChange={(event) => setScheduleSearch(event.target.value)} />
              <Button variant={scheduleFiltersOpen ? 'contained' : 'outlined'} size="small" startIcon={<FilterListOutlined />}
                onClick={() => setScheduleFiltersOpen((open) => !open)} sx={{ whiteSpace: 'nowrap' }}>Filters</Button>
              <Button variant="outlined" size="small" startIcon={<ViewColumnOutlined />}
                onClick={(event) => setScheduleColumnsAnchor(event.currentTarget)} sx={{ whiteSpace: 'nowrap' }}>
                Columns {visibleScheduleColumns.length}/{scheduleColumns.length}
              </Button>
              <Menu anchorEl={scheduleColumnsAnchor} open={Boolean(scheduleColumnsAnchor)} onClose={() => setScheduleColumnsAnchor(null)}
                PaperProps={{ sx: { width: 315, maxHeight: 'min(64dvh, 480px)' } }}>
                <Box sx={{ px: 1.5, py: 0.7 }}>
                  <Typography variant="subtitle2" fontWeight={850}>Visible Columns</Typography>
                  <Button size="small" onClick={resetScheduleColumns}>Restore Defaults</Button>
                  <Button size="small" onClick={() => {
                    const keys = scheduleColumns.map((column) => column.key);
                    setScheduleVisibleColumns(keys);
                    try { localStorage.setItem(SCHEDULE_COLUMN_STORAGE_KEY, JSON.stringify(keys)); } catch { /* private mode */ }
                  }}>Show All</Button>
                </Box>
                <Divider />
                {scheduleColumns.map((column) => <MenuItem key={column.key} dense onClick={() => toggleScheduleColumn(column.key)}>
                  <Checkbox size="small" disableRipple checked={visibleScheduleColumns.some((visible) => visible.key === column.key)}
                    tabIndex={-1} sx={{ py: 0.25 }} />
                  <ListItemText primary={column.label} primaryTypographyProps={{ fontSize: 13 }} />
                </MenuItem>)}
              </Menu>
            </Stack>
            {scheduleFiltersOpen && <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: {
              xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(5, minmax(0,1fr))' }, gap: 0.85 }}>
              {[
                ['poNumber', 'PO No.'], ['masterPo', 'Master PO'], ['style', 'Style'],
                ['description', 'Description'], ['color', 'Color Description'], ['qty', 'QTY'],
                ['factory', 'Factory'], ['sku', 'SKU'], ['destination', 'Destination']
              ].map(([key, label]) => <TextField size="small" key={key} label={label}
                value={scheduleFilters[key]} onChange={(event) => setScheduleFilters((current) => ({ ...current, [key]: event.target.value }))} />)}
              <Button size="small" onClick={() => { setScheduleFilters(emptyScheduleFilters()); setScheduleSearch(''); }}>
                Clear Filters
              </Button>
            </Box>}
          </Box>
          <DialogContent dividers sx={{ p: 1.3, pt: 0.75, minHeight: 140, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.7, px: 0.5 }}>
              <Typography fontWeight={800} variant="body2">Select Unscheduled POs</Typography>
              <Typography variant="caption" color="text.secondary">
                {scheduleCandidates.count} matching · {scheduledSelectedPageCount} selected on this page
              </Typography>
            </Stack>
            <TableContainer sx={{ flex: '1 1 auto', minHeight: 100, maxHeight: '44dvh', overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <Table stickyHeader size="small" aria-label="Select POs for Schedule Shipping"
                sx={{ minWidth: visibleScheduleColumns.reduce((w, col) => w + col.minWidth, 60),
                  '& .MuiTableCell-root': { py: 0.8, px: 1, borderColor: 'divider' } }}>
                <TableHead><TableRow>
                  <TableCell padding="checkbox" sx={{ bgcolor: '#F8FAFC' }}>
                    <Tooltip title="Select or deselect all POs on this page">
                      <span><Checkbox size="small" checked={scheduleAllPageSelected}
                        indeterminate={scheduledSelectedPageCount > 0 && !scheduleAllPageSelected}
                        disabled={scheduleCandidates.loading || schedulePageIds.length === 0 || (!scheduleAllPageSelected && scheduleSelection.length >= 200)}
                        onChange={toggleSchedulePage} inputProps={{ 'aria-label': 'Select POs on current page' }} /></span>
                    </Tooltip>
                  </TableCell>
                  {visibleScheduleColumns.map((column) => <TableCell key={column.key} sx={{ minWidth: column.minWidth,
                    whiteSpace: 'nowrap', fontWeight: 800, bgcolor: '#F8FAFC' }}>{column.label}</TableCell>)}
                </TableRow></TableHead>
                <TableBody>
                  {scheduleCandidates.loading ? <TableRow><TableCell colSpan={visibleScheduleColumns.length + 1} align="center">
                    <CircularProgress size={22} sx={{ my: 1.5 }} /></TableCell></TableRow>
                  : scheduleCandidates.rows.length ? scheduleCandidates.rows.map((candidate) => {
                    const candidateId = candidate.id || candidate.key;
                    const checked = selectedScheduleIds.has(candidateId);
                    return <TableRow key={candidateId} hover selected={checked} onClick={() => toggleScheduleSelection(candidate)}
                      sx={{ cursor: 'pointer' }}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked} disabled={!checked && scheduleSelection.length >= 200}
                          onChange={() => toggleScheduleSelection(candidate)} onClick={(event) => event.stopPropagation()}
                          inputProps={{ 'aria-label': `Select PO ${candidate.poNumber || candidateId}` }} />
                      </TableCell>
                      {visibleScheduleColumns.map((column) => {
                        const text = String(scheduleColumnText(candidate, column.key) ?? '—');
                        return <TableCell key={column.key}>
                          <Tooltip title={text} arrow><Typography variant="caption" sx={{ display: 'block',
                            maxWidth: column.key === 'description' ? 280 : 210, overflow: 'hidden',
                            whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{text}</Typography></Tooltip>
                        </TableCell>;
                      })}
                    </TableRow>;
                  }) : <TableRow><TableCell colSpan={visibleScheduleColumns.length + 1} align="center" sx={{ py: 3 }}>
                    No unscheduled POs match your search or filters.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={scheduleCandidates.count} page={scheduleCandidates.page}
              rowsPerPage={scheduleCandidates.size} rowsPerPageOptions={[10, 25, 50, 100]}
              onPageChange={(_, page) => loadScheduleCandidates(page, scheduleCandidates.size)}
              onRowsPerPageChange={(event) => loadScheduleCandidates(0, Number(event.target.value))}
              sx={{ flexShrink: 0, '& .MuiTablePagination-toolbar': { minHeight: 45 } }} />
            {scheduleSelection.length > 0 && <Box sx={{ pt: 0.6, borderTop: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography fontWeight={800} variant="caption">{scheduleSelection.length} POs selected across pages</Typography>
                <Button size="small" onClick={() => setScheduleSelection([])}>Clear Selection</Button>
              </Stack>
              <Stack direction="row" gap={0.6} flexWrap="wrap" sx={{ maxHeight: 76, overflowY: 'auto' }}>
                {scheduleSelection.map((selected) => <Chip key={selected.id} size="small"
                  label={selected.poNumber || selected.id}
                  onDelete={() => setScheduleSelection((rows) => rows.filter((po) => po.id !== selected.id))} />)}
              </Stack>
            </Box>}
          </DialogContent>
          <DialogActions sx={{ px: 2, py: 1, flexShrink: 0 }}>
            <Button disabled={scheduleSaving} onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={scheduleSaving || !scheduleDate || !scheduleSelection.length}
              startIcon={scheduleSaving ? <CircularProgress size={16} color="inherit" /> : <LocalShippingOutlined />}
              onClick={submitShippingPlan}>
              {scheduleSaving ? 'Saving…' : `Submit Schedule (${scheduleSelection.length})`}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}

      <Dialog open={Boolean(reassignDialog)} onClose={() => { if (!reassignSaving) setReassignDialog(null); }} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={900}>Reassign PO to Shipping Schedule</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            <Alert severity="info">Assigned PO cannot be edited or deleted directly. Reassign it to a new Shipping Schedule here.</Alert>
            {reassignDialog ? (
              <>
                <Typography variant="body2"><strong>PO:</strong> {reassignDialog.poNumber}</Typography>
                <Typography variant="body2"><strong>Current Schedule:</strong> {reassignDialog.currentScheduleNo} · {reassignDialog.currentStatus}</Typography>
                <TextField
                  select
                  size="small"
                  label="New Factory"
                  value={reassignDialog.factoryCode || ''}
                  onChange={(event) => setReassignField('factoryCode', event.target.value)}
                >
                  {factoryCodes.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
                </TextField>
                <TextField
                  size="small"
                  type="date"
                  label="New Shipping Date"
                  InputLabelProps={{ shrink: true }}
                  value={reassignDialog.exFtyDate || ''}
                  onChange={(event) => setReassignField('exFtyDate', event.target.value)}
                />
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignDialog(null)} disabled={reassignSaving}>Cancel</Button>
          <Button variant="contained" startIcon={reassignSaving ? <CircularProgress size={16} color="inherit" /> : <LocalShippingOutlined />} onClick={savePoReassignment} disabled={reassignSaving || !reassignDialog?.factoryCode || !reassignDialog?.exFtyDate}>
            {reassignSaving ? 'Reassigning...' : 'Reassign PO'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(poEditor)} onClose={() => { if (!poSaving) setPoEditor(null); }} fullWidth maxWidth="xl">
        <DialogTitle fontWeight={900}>Edit Imported PO · ALL_BP</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Sales/Admin can edit picked POs until Weight is completed. After Packing or Shipment starts, only non-structural descriptive fields may change; PO Number, Factory, Qty, SKU identity, carton plan, weights and Ex-Factory date stay fixed to protect carton/SSCC history. Formula columns Q, R, S, X, Y, Z and AA remain read-only.
            If Cartons/Items were already generated and Packing has not started, they are rebuilt from the edited PO after Save.
          </Alert>

          {poEditor ? (
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 0.75 }}>System fields</Typography>
                {poEditor.structuralLocked ? <Alert severity="warning" sx={{ mb: 1 }}>Packing or Shipment has started. Structural fields are read-only; descriptive fields can still be updated until Weight completes.</Alert> : null}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 320px))' }, gap: 1.25 }}>
                  <TextField size="small" label="Factory (optional)" disabled={poEditor.picked || poEditor.structuralLocked} value={poEditor.factoryCode || ''} onChange={(e) => setPoField('factoryCode', e.target.value)} />
                  <TextField size="small" type="date" label="Ex-Factory" disabled={poEditor.structuralLocked} InputLabelProps={{ shrink: true }} value={poEditor.exFtyDate || ''} onChange={(e) => setPoField('exFtyDate', e.target.value)} />
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
                      const lockedSource = (poEditor.picked && canonical === 'PO') ||
                        (poEditor.structuralLocked && [
                          'PO', 'MASTER_PO', 'DC_CODE', 'DESTINATION', 'CHANNEL', 'PACKING_PLAN',
                          'SALES_ORDER_PTS', 'SHIP_MODE', 'CARTON_BOX_SIZE', 'STYLE', 'COLOR', 'SIZE',
                          'QTY', 'PCS_CTN', 'NW', 'GW'
                        ].includes(canonical));
                      return (
                        <TextField
                          key={`${rowIndex}-${label}`}
                          required={required}
                          disabled={formula || lockedSource}
                          size="small"
                          label={label}
                          value={sourceRow?.[label] ?? ''}
                          onChange={(event) => setAllBpField(rowIndex, label, event.target.value)}
                          helperText={formula ? `Formula ${ALL_BP_FORMULA_TEXT[canonical] || ''} · View only` : lockedSource ? 'Locked to protect picked PO / operational data' : undefined}
                          sx={formula || lockedSource ? { '& .MuiInputBase-root.Mui-disabled': { bgcolor: 'action.hover' } } : undefined}
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
