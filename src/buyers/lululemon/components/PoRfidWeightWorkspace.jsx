import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Collapse, Dialog, DialogTitle, DialogContent, DialogActions, Divider, IconButton, InputAdornment, ListItemText, Menu, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography
} from '@mui/material';
import { CheckCircleOutline, ErrorOutline, LinkOff, QrCodeScannerOutlined, Refresh, Sensors, RestartAltRounded, ScaleOutlined, ExpandLess, ExpandMore, SettingsOutlined, ReplayRounded, VisibilityOutlined, VisibilityOffOutlined, ViewColumnOutlined, FilterListOutlined } from '@mui/icons-material';
import CartonRfidPanel from './CartonRfidPanel';
import { identifyProcessingCarton, getProcessingSummary, armProcessingAutoWeight, saveProcessingAutoWeight, reopenProcessingManualWeight, unassignProcessingIdentity, recallFailedProcessingCarton } from '../services/cartonProcessing';
import { listMyScalePlcDevices, readScalePlcWeight } from '../services/scalePlcDevices';
import { startCartonRfidSession, reopenCartonRfidSession, getCartonRfidSession } from '../services/weighing';
import { getUniqueEpcRows, getUniqueInvalidEpcRows } from '../utils/trueVueEpc';
import { isAdmin, canWeightCheck } from '../../../utils/accessControl';
import { listManagedCartons } from 'services/managementService';
import { ALL_BP_KNOWN_HEADERS, ALL_BP_UI_LABELS } from '../../../constants/appConstants';
import { canonicalSourceKey, sourceValue } from '../domain/allBpWorkspace';

// Keep the original WeighingPage's one-popup layout and status tables, but show
// RFID FIRST (left) and automatic Weight SECOND (right), matching the live workflow.
// Both areas remain mounted at once; Weight is gated by completed RFID.
const errText = (error) => error?.response?.data?.message || error?.message || 'Operation failed.';
const sscc18 = (value) => {
  const code = String(value ?? '').trim().replace(/[()\s-]/g, '');
  return code.length === 20 && code.startsWith('00') ? code.slice(2) : code;
};
const done = (status) => status === 'PASS' || status === 'FAILED';
const kg = (value) => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(3);
const statusColor = (status) => status === 'PASS' ? 'success' : status === 'FAILED' ? 'error' : 'default';
// Matched EPCs / original carton planned Qty. Wrong-SKU or invalid tags
// are displayed as separate failure reasons, never added to the denominator.
const cartonRfidDisplay = (row) => {
  const planned = row?.plannedQty ?? '—';
  const count = row?.rfidMatchedQty ?? (row?.rfidStatus === 'PASS' ? (row?.rfidVerifiedQty ?? planned) : null);
  return {
    label: `${count ?? '—'}/${planned}`,
    detail: count == null ? 'Matching EPC count unavailable. Deploy the updated backend.'
      : `Matched ${count} / Expected ${planned} · Wrong SKU ${row.rfidWrongSkuQty ?? 0}`
  };
};

/** Read the persisted latest attempt only when an operator expands Show More. */
function RfidInspectionEvidence({ row, orderId, poId }) {
  const [session, setSession] = useState(null);
  const [fetchError, setFetchError] = useState('');
  useEffect(() => {
    if (!row.cartonIdentity || !orderId || !poId) return undefined;
    let cancelled = false;
    setSession(null); setFetchError('');
    getCartonRfidSession(orderId, poId, row.cartonIdentity)
      .then((data) => { if (!cancelled) setSession(data); })
      .catch((error) => { if (!cancelled) setFetchError(errText(error)); });
    return () => { cancelled = true; };
  }, [row.cartonIdentity, orderId, poId]);
  const epcs = useMemo(() => getUniqueEpcRows(session?.epcs, session?.expectedSku || row.labelConfirmedSku,
    session?.wrongSkuEpcs, session?.crossCartonEpcs), [session, row.labelConfirmedSku]);
  const invalid = useMemo(() => getUniqueInvalidEpcRows(session?.invalidReads), [session]);
  const matched = epcs.filter((epc) => epc.status === 'MATCH').length;
  const wrong = epcs.filter((epc) => epc.status === 'WRONG_SKU').length;
  const cross = epcs.filter((epc) => epc.status === 'DUPLICATE_CARTON').length;
  const expected = Number(session?.expectedQty ?? row.plannedQty ?? 0);
  return <Stack spacing={0.6} sx={{ mt: 0.6 }}>
    {fetchError && <Alert severity="warning" sx={{ py: 0 }}>{fetchError}</Alert>}
    {!session && !fetchError && <Typography variant="caption">Loading RFID evidence…</Typography>}
    {session && <>
      <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip size="small" color={statusColor(session.status)} label={`RFID ${session.status || 'PENDING'}`} />
        <Chip size="small" variant="outlined" label={`Matched ${matched}/${expected}`} />
        {matched < expected && <Chip size="small" color="error" variant="outlined" label={`Missing ${expected - matched}`} />}
        {matched > expected && <Chip size="small" color="error" variant="outlined" label={`Excess ${matched - expected}`} />}
        {wrong > 0 && <Chip size="small" color="error" variant="outlined" label={`Wrong SKU ${wrong}`} />}
        {cross > 0 && <Chip size="small" color="error" variant="outlined" label={`Cross-carton ${cross}`} />}
        {invalid.length > 0 && <Chip size="small" color="error" variant="outlined" label={`Invalid ${invalid.length}`} />}
        <Chip size="small" variant="outlined" label={`Read events ${session.readCount ?? 0}`} />
      </Stack>
      {session.status === 'FAILED' && <Alert severity="error" sx={{ py: 0 }}>
        <b>RFID FAILED.</b> {session.reason || 'Quantity, SKU or EPC validation failed.'}
      </Alert>}
      <TableContainer sx={{ maxHeight: 190, overflowY: 'auto' }}>
        <Table size="small" aria-label="RFID scan evidence" sx={{ '& .MuiTableCell-root': { py: 0.35, fontSize: 11 } }}>
          <TableHead><TableRow><TableCell>STT</TableCell><TableCell>EPC / Raw Tag</TableCell><TableCell>Detected SKU</TableCell><TableCell>Result</TableCell></TableRow></TableHead>
          <TableBody>
            {[...epcs, ...invalid].map((tag, index) => <TableRow key={`${tag.epc || tag.raw}-${index}`}>
              <TableCell>{index + 1}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{tag.epc || tag.raw}</TableCell>
              <TableCell>{tag.sku || '—'}</TableCell>
              <TableCell sx={{ color: tag.status === 'MATCH' ? 'success.main' : 'error.main', fontWeight: 750 }}>
                {tag.status === 'MATCH' ? 'MATCH' : tag.status === 'WRONG_SKU' ? 'WRONG SKU'
                  : tag.status === 'DUPLICATE_CARTON' ? 'CROSS-CARTON' : `INVALID${tag.reason ? ': ' + tag.reason : ''}`}
              </TableCell>
            </TableRow>)}
            {!epcs.length && !invalid.length && <TableRow><TableCell colSpan={4} align="center">No EPCs recorded.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </>}
  </Stack>;
}
const cartonFinal = (row) => {
  if (!done(row?.rfidStatus) || !done(row?.weightStatus)) return 'PENDING';
  return row.rfidStatus === 'PASS' && row.weightStatus === 'PASS' ? 'PASS' : 'FAILED';
};

// Carton Picker is scoped to the OPEN PO. Columns from ALL_BP describe that PO;
// the Qty column is intentionally the individual carton's planned pcs (not the PO total).
const CARTON_PICKER_COLUMN_STORAGE = 'lululemon.carton-picker.columns.v1';
const CARTON_PICKER_DEFAULT_COLUMNS = Object.freeze(['po', 'masterPo', 'style', 'description', 'color', 'qty']);
const CARTON_PICKER_BASE_COLUMNS = Object.freeze([
  { key: 'po', label: 'PO', minWidth: 110 },
  { key: 'masterPo', label: 'Master PO', minWidth: 115 },
  { key: 'style', label: 'Style', minWidth: 125 },
  { key: 'description', label: 'Description', minWidth: 190 },
  { key: 'color', label: 'Color Description', minWidth: 175 },
  { key: 'qty', label: 'QTY', minWidth: 85 },
  { key: 'cartonNo', label: 'Carton No.', minWidth: 100 },
  { key: 'sku', label: 'SKU', minWidth: 140 },
  { key: 'factory', label: 'Factory', minWidth: 85 },
  { key: 'poTotalQty', label: 'PO Total Qty', minWidth: 110 },
  { key: 'expectedWeight', label: 'Expected Weight', minWidth: 135 },
  { key: 'exFactory', label: 'Ex-Factory', minWidth: 115 },
]);
const PICKER_FILTER_EMPTY = Object.freeze({
  po: '', masterPo: '', style: '', description: '', color: '', qty: '', sku: '', cartonNo: ''
});
const pickerSearchText = (value) => String(value ?? '').trim().toLowerCase();
const readPickerColumns = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CARTON_PICKER_COLUMN_STORAGE));
    return Array.isArray(saved) && saved.length ? [...new Set(saved.filter((key) => typeof key === 'string'))] : [...CARTON_PICKER_DEFAULT_COLUMNS];
  } catch { return [...CARTON_PICKER_DEFAULT_COLUMNS]; }
};
const pickerCellValue = (column, carton, po, factoryCode) => {
  switch (column) {
    case 'po': return po?.poNumber || '—';
    case 'masterPo': return po?.masterPo || '—';
    case 'style': return po?.styleNumber || po?.style || '—';
    case 'description': return po?.description || '—';
    case 'color': return po?.color || '—';
    case 'qty': return carton?.plannedQty == null ? '—' : `${carton.plannedQty} pcs`;
    case 'cartonNo': return carton?.cartonNo == null ? '—' : `Carton ${carton.cartonNo}`;
    case 'sku': return carton?.labelConfirmedSku || po?.sku || '—';
    case 'factory': return carton?.factoryCode || po?.factoryCode || factoryCode || '—';
    case 'poTotalQty': return po?.totalQty ?? po?.plannedTotalQty ?? '—';
    case 'expectedWeight': return Number(po?.grossWeightKg) > 0 && Number(carton?.plannedQty) > 0
      ? `${kg(Number(po.grossWeightKg) * Number(carton.plannedQty))} kg` : '—';
    case 'exFactory': return po?.exFtyDate || '—';
    default: return column.startsWith('bp:') ? sourceValue(po, column.slice(3)) : '—';
  }
};

export default function PoRfidWeightWorkspace({ buyerCode = 'LULULEMON', orderId, po, poKey, factoryCode, onCartonSaved }) {
  const [sscc, setSscc] = useState('');
  const [sku, setSku] = useState('');
  const [cartonId, setCartonId] = useState('');
  const [cartonQuery, setCartonQuery] = useState('');
  const [pickerFilters, setPickerFilters] = useState(() => ({ ...PICKER_FILTER_EMPTY }));
  const [pickerMoreFilters, setPickerMoreFilters] = useState(false);
  const [pickerColumnKeys, setPickerColumnKeys] = useState(readPickerColumns);
  const [pickerColumnsAnchor, setPickerColumnsAnchor] = useState(null);
  const [cartonPickerOpen, setCartonPickerOpen] = useState(false);
  const [pickerDismissedFor, setPickerDismissedFor] = useState('');
  const [cartons, setCartons] = useState([]);
  const [summary, setSummary] = useState(null);
  const [active, setActive] = useState(null);
  const [rfid, setRfid] = useState(null);
  const [savedWeight, setSavedWeight] = useState(null);
  const [scaleReading, setScaleReading] = useState(null);
  const lastScaleEvent = useRef(null);
  const [devices, setDevices] = useState([]);
  const [stationCode, setStationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resultDetailsOpen, setResultDetailsOpen] = useState({});
  const [showEnd, setShowEnd] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [unassignReason, setUnassignReason] = useState('');
  const [resetPanel, setResetPanel] = useState(''); // 'assign', 'rfid', 'weight'
  const [resetReason, setResetReason] = useState('');
  const [showStationSettings, setShowStationSettings] = useState(false);
  const [recallTarget, setRecallTarget] = useState(null);
  const [recallReason, setRecallReason] = useState('');
  const [rfidMountKey, setRfidMountKey] = useState(0);
  const admin = isAdmin();
  const canRecall = canWeightCheck();
  const ssccRef = useRef(null);
  const skuRef = useRef(null);
  const cartonQueryRef = useRef(null);
  const poId = po?.id || '';

  const reload = useCallback(async () => {
    if (!poId || !factoryCode) return;
    // A PO may exceed a single backend page. FINAL tables must not show only
    // the first 200 cartons or prematurely claim END.
    const all = [];
    let page = 0;
    let totalPages = 1;
    do {
      const result = await listManagedCartons(buyerCode, orderId, poKey, { page, size: 200 });
      all.push(...(result?.content || []));
      totalPages = Number(result?.totalPages || 0) ||
        Math.ceil(Number(result?.totalElements || all.length) / Math.max(1, Number(result?.size || 200)));
      page += 1;
    } while (page < totalPages);
    const [nextSummary] = await Promise.all([getProcessingSummary(factoryCode, orderId, poId)]);
    setCartons(all);
    setSummary(nextSummary);
  }, [buyerCode, factoryCode, orderId, poId, poKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [found, scales] = await Promise.all([
          (async () => {
            const all = []; let page = 0; let totalPages = 1;
            do {
              const data = await listManagedCartons(buyerCode, orderId, poKey, { page, size: 200 });
              all.push(...(data?.content || []));
              totalPages = Number(data?.totalPages || 0) || Math.ceil(Number(data?.totalElements || all.length) / Math.max(1, Number(data?.size || 200)));
              page += 1;
            } while (page < totalPages);
            return all;
          })(),
          listMyScalePlcDevices().catch(() => [])
        ]);
        const info = await getProcessingSummary(factoryCode, orderId, poId);
        if (cancelled) return;
        setCartons(found); setSummary(info);
        const available = (Array.isArray(scales) ? scales : []).filter((row) =>
          String(row.factoryCode || '').toUpperCase() === String(factoryCode).toUpperCase());
        setDevices(available);
        // Device selected by assignment; no manual station entry for operators.
        const preferred = available.find((d) => d.connectionType === 'SIMULATOR') || available[0];
        setStationCode(preferred?.stationCode || '');
      } catch (e) { if (!cancelled) setError(errText(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [buyerCode, factoryCode, orderId, poId, poKey]);

  // A previously assigned SSCC identifies its own carton. For ANY new SSCC
  // the operator MUST choose the physical Carton No. from this PO's unassigned
  // cartons (even if only one remains). SKU cannot identify the carton because
  // every carton in a PO may share the same SKU.
  // Opening the PO workstation should be ready for the scanner immediately.
  useEffect(() => {
    if (loading || active) return undefined;
    const frame = window.requestAnimationFrame(() => ssccRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [loading]);

  const normalizedSscc = sscc18(sscc);
  const validSscc = /^\d{18}$/.test(normalizedSscc);
  const existingCarton = useMemo(() => cartons.find((row) => sscc18(row.cartonIdentity) === normalizedSscc && validSscc), [cartons, normalizedSscc, validSscc]);
  const unassigned = useMemo(() => cartons
    .filter((row) => !String(row.cartonIdentity || '').trim() && !row.weightStatus && !row.rfidStatus)
    .sort((a, b) => Number(a.cartonNo || 0) - Number(b.cartonNo || 0)), [cartons]);
  const needCartonChoice = Boolean(validSscc && !existingCarton && !active);
  // Use the same ALL_BP schema as Order → PO columns, including imported custom headers.
  // The fixed Choose action is intentionally NOT hideable.
  const pickerColumnsCatalog = useMemo(() => {
    const seen = new Set(['PO', 'MASTER_PO', 'STYLE', 'DESCRIPTION', 'COLOR', 'QTY']);
    const headers = [...ALL_BP_KNOWN_HEADERS, ...(po?.allBpHeaders || []),
      ...(po?.allBpRows || []).flatMap((sourceRow) => Object.keys(sourceRow || {}))];
    const extras = [];
    headers.forEach((header) => {
      const canonical = canonicalSourceKey(header);
      if (!seen.has(canonical)) {
        seen.add(canonical);
        extras.push({ key: `bp:${canonical}`, label: ALL_BP_UI_LABELS[canonical] || header,
          minWidth: canonical === 'DESTINATION' ? 140 : 125 });
      }
    });
    return [...CARTON_PICKER_BASE_COLUMNS, ...extras];
  }, [po?.allBpHeaders, po?.allBpRows]);
  const pickerVisibleColumns = useMemo(() => {
    const selected = new Set(pickerColumnKeys);
    const visible = pickerColumnsCatalog.filter((col) => selected.has(col.key));
    return visible.length ? visible : pickerColumnsCatalog.filter((col) => CARTON_PICKER_DEFAULT_COLUMNS.includes(col.key));
  }, [pickerColumnKeys, pickerColumnsCatalog]);
  const filteredUnassigned = useMemo(() => {
    const query = pickerSearchText(cartonQuery);
    const matches = (value, needle) => !pickerSearchText(needle) || pickerSearchText(value).includes(pickerSearchText(needle));
    return unassigned.filter((row) => {
      const rowFields = {
        po: pickerCellValue('po', row, po, factoryCode),
        masterPo: pickerCellValue('masterPo', row, po, factoryCode),
        style: pickerCellValue('style', row, po, factoryCode),
        description: pickerCellValue('description', row, po, factoryCode),
        color: pickerCellValue('color', row, po, factoryCode),
        qty: row.plannedQty ?? '',
        sku: pickerCellValue('sku', row, po, factoryCode),
        cartonNo: row.cartonNo ?? ''
      };
      if (Object.entries(pickerFilters).some(([field, term]) => !matches(rowFields[field], term))) return false;
      return !query || [...Object.values(rowFields), pickerCellValue('factory', row, po, factoryCode)]
        .some((value) => matches(value, query));
    });
  }, [cartonQuery, pickerFilters, unassigned, po, factoryCode]);
  const setPickerFilter = (key, value) => setPickerFilters((previous) => ({ ...previous, [key]: value }));
  const togglePickerColumn = (key) => setPickerColumnKeys((previous) => {
    const current = new Set(previous);
    if (current.has(key) && current.size > 1) current.delete(key);
    else current.add(key);
    return Array.from(current);
  });
  useEffect(() => {
    try { window.localStorage.setItem(CARTON_PICKER_COLUMN_STORAGE, JSON.stringify(pickerColumnKeys)); }
    catch { /* Browser may forbid storage; current dialog state still works. */ }
  }, [pickerColumnKeys]);
  const chosenCarton = unassigned.find((row) => row.id === cartonId);
  // Open a true carton selection DIALOG after a NEW SSCC has finished scanning.
  // Barcode scanners may deliver a 20-digit GS1 (00) value: wait for input to
  // settle so the dialog never intercepts digit 19 or digit 20.
  useEffect(() => {
    if (!needCartonChoice || cartonId || loading || busy || pickerDismissedFor === normalizedSscc) return undefined;
    const timer = window.setTimeout(() => setCartonPickerOpen(true), 420);
    return () => window.clearTimeout(timer);
  }, [needCartonChoice, cartonId, loading, busy, pickerDismissedFor, normalizedSscc]);
  const closeCartonPicker = () => {
    setCartonPickerOpen(false);
    setPickerColumnsAnchor(null);
    setPickerDismissedFor(normalizedSscc);
  };
  const chooseCarton = (id) => {
    setCartonId(id);
    setPickerDismissedFor('');
    setCartonPickerOpen(false);
    setPickerColumnsAnchor(null);
    setCartonQuery('');
    setPickerFilters({ ...PICKER_FILTER_EMPTY });
    setError('');
    window.requestAnimationFrame(() => skuRef.current?.focus());
  };

  // The SKU field was disabled until an unassigned physical carton was chosen.
  // Focus after React has rendered the now-enabled input (not inside onClick).
  useEffect(() => {
    if (needCartonChoice && chosenCarton && !active) skuRef.current?.focus();
  }, [needCartonChoice, chosenCarton?.id, active]);
  const activeCarton = active?.carton;
  const qty = Number(activeCarton?.plannedQty || 0);
  const expected = po?.grossWeightKg != null && Number(po.grossWeightKg) > 0 && qty > 0 ? Number(po.grossWeightKg) * qty : null;
  const tolerance = expected == null ? null : Number(po.grossWeightKg);
  const minWeight = expected == null ? null : Math.max(0, expected - tolerance);
  const maxWeight = expected == null ? null : expected + tolerance;
  const weightResult = savedWeight?.carton?.weightStatus || activeCarton?.weightStatus || null;
  const rfidResult = rfid?.status || activeCarton?.rfidStatus || null;
  const canUnassignNewIdentity = Boolean(activeCarton?.id && activeCarton?.sscc18 && activeCarton?.labelConfirmedAt
    && !activeCarton?.rfidSessionId && !activeCarton?.rfidStatus && !activeCarton?.weightStatus
    && !rfid?.id && !rfid?.startedAt && !savedWeight && !Number(activeCarton?.scannedQty || 0));
  const completedRows = useMemo(() => cartons.filter((row) => cartonFinal(row) !== 'PENDING'), [cartons]);
  const passRows = completedRows.filter((row) => cartonFinal(row) === 'PASS');
  const failedRows = completedRows.filter((row) => cartonFinal(row) === 'FAILED');

  const identify = async () => {
    if (busy || loading || active || !factoryCode) return;
    if (!/^\d{18}$/.test(normalizedSscc)) { setError('Scan an SSCC-18 or GS1 (00) + SSCC-18.'); return; }
    if (!sku.trim()) { setError('Scan the SKU on the carton label.'); skuRef.current?.focus(); return; }
    if (!stationCode.trim()) { setError('Select the assigned Scale station first.'); return; }
    // A NEW SSCC always requires an explicit Carton No. selection; no FIFO
    // fallback, including the case where there is only one unassigned carton.
    const row = existingCarton || (cartonId ? unassigned.find((c) => c.id === cartonId) : null);
    if (!row) {
      setError(needCartonChoice && unassigned.length
        ? 'Select the Carton No. printed on this physical carton before Assign.'
        : 'No unassigned Carton remains in the selected PO. Refresh or check the scanned SSCC.');
      return;
    }
    if (cartonId && existingCarton && existingCarton.id !== cartonId) {
      setError('The scanned SSCC belongs to a different Carton No.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const identified = await identifyProcessingCarton({ sscc: sscc.trim(), sku: sku.trim(), factoryCode,
        orderId, poId, cartonId: row.id });
      if (identified?.carton?.id !== row.id) throw new Error('Server returned a different Carton; operation stopped.');
      setActive(identified); setRfid(null); setSavedWeight(null); setScaleReading(null); lastScaleEvent.current = null;
      setConfirmUnassign(false); setUnassignReason(''); setResetPanel(''); setResetReason('');
      setRfidMountKey((key) => key + 1);
      setNotice(`Carton ${identified.carton.cartonNo}: SSCC/SKU confirmed. Scan RFID first, then Scale auto-captures a NEW reading.`);
      await reload(); onCartonSaved?.();
    } catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  const unassignIdentity = async () => {
    if (!activeCarton?.id || busy || !canUnassignNewIdentity) return;
    if (unassignReason.trim().length < 3) {
      setError('Enter a reason (at least 3 characters) before unassigning.'); return;
    }
    setBusy(true); setError('');
    try {
      await unassignProcessingIdentity(orderId, activeCarton.id, unassignReason.trim());
      // Reset only this carton, in the SAME popup. RFID/Weight and FINAL tables
      // remain mounted and the PO can immediately select the carton again.
      setSscc(''); setSku(''); setCartonId(''); setCartonQuery(''); setActive(null); setRfid(null);
      setSavedWeight(null); setConfirmUnassign(false); setUnassignReason(''); setResetPanel(''); setResetReason('');
      setNotice(`Carton ${activeCarton.cartonNo}: SSCC and SKU unassigned. The Items are now PENDING; ready to scan again.`);
      await reload(); onCartonSaved?.();
      window.requestAnimationFrame(() => ssccRef.current?.focus());
    } catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  const handleRfidSessionChange = useCallback((session) => {
    setRfid(session);
    if (done(session?.status)) reload().catch((e) => setError(errText(e)));
  }, [reload]);

  // The scale value comes ONLY from the assigned device, never from the carton input.
  // Polling receives simulated events. A server-side single-use claim protects the
  // event from duplicate submissions and verifies the correct Factory + completed RFID (PASS or FAILED).
  useEffect(() => {
    if (!activeCarton?.sscc18 || !done(rfidResult) || weightResult || !stationCode) return undefined;
    let cancelled = false;
    let working = false;
    let lastArmedAt = 0;
    const poll = async () => {
      if (working || cancelled) return;
      working = true;
      try {
        const reading = await readScalePlcWeight(stationCode);
        if (cancelled) return;
        setScaleReading(reading);
        if (reading?.mode === 'SIMULATOR' && Date.now() - lastArmedAt > 20000) {
          lastArmedAt = Date.now();
          await armProcessingAutoWeight({ sscc: activeCarton.sscc18, stationCode });
        }
        if (reading?.mode === 'SIMULATOR' && reading?.stable && !reading?.consumed && reading?.eventId
            && reading?.weightKg != null && lastScaleEvent.current !== reading.eventId) {
          lastScaleEvent.current = reading.eventId;
          try {
            const saved = await saveProcessingAutoWeight({ sscc: activeCarton.sscc18, stationCode, eventId: reading.eventId });
            if (cancelled) return;
            setSavedWeight(saved);
            setNotice(`Carton ${activeCarton.cartonNo}: RFID ${rfidResult} · Scale ${Number(reading.weightKg).toFixed(3)} kg · Weight ${saved.carton.weightStatus} · Final ${rfidResult === 'PASS' && saved.carton.weightStatus === 'PASS' ? 'PASS' : 'FAILED'}.`);
            await reload(); onCartonSaved?.();
          } catch (e) {
            if (!cancelled && !/Send a NEW simulator weight|already used or replaced/i.test(errText(e))) setError(errText(e));
          }
        }
      } catch (e) {
        if (!cancelled) setScaleReading({ status: 'OFFLINE', error: errText(e) });
      } finally { working = false; }
    };
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeCarton?.sscc18, activeCarton?.cartonNo, rfidResult, weightResult, stationCode, reload, onCartonSaved]);

  // Reset semantics: never erase server history. Unsaved weight is local-only.
  // Completed RFID can be reopened only by Admin; failed RFID may be rescanned
  // by an authorized operator, provided weight has not been saved. An ongoing
  // RFID capture must be finished/stopped before resetting the session.
  const resetRfid = async () => {
    if (!activeCarton?.id || busy || savedWeight || weightResult || !done(rfidResult)) return;
    if (rfidResult === 'PASS' && !admin) {
      setError('Only Admin may reopen a PASS RFID inspection.'); return;
    }
    if (rfidResult === 'PASS' && resetReason.trim().length < 5) {
      setError('Enter at least 5 characters describing why RFID PASS must be reopened.'); return;
    }
    setBusy(true); setError('');
    try {
      if (rfidResult === 'PASS') {
        await reopenCartonRfidSession(orderId, poId, activeCarton.sscc18, resetReason.trim());
      }
      const fresh = await startCartonRfidSession(orderId, poId,
        { sscc: activeCarton.sscc18, stationCode });
      setRfid(fresh);
      setRfidMountKey((key) => key + 1);
      setActive((previous) => previous ? { ...previous, carton: { ...previous.carton,
        rfidStatus: 'SCANNING', rfidSessionId: fresh.id, rfidVerifiedQty: null } } : previous);
      setResetPanel(''); setResetReason('');
      setNotice(`Carton ${activeCarton.cartonNo}: new RFID inspection started. Previous result remains in history.`);
      await reload(); onCartonSaved?.();
    } catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  const resetWeight = async () => {
    if (!activeCarton?.id || busy || (!weightResult && !savedWeight)) return;
    if (!admin) { setError('Only Admin may reopen a saved weight.'); return; }
    if (resetReason.trim().length < 3) { setError('Enter a reason of at least 3 characters.'); return; }
    setBusy(true); setError('');
    try {
      const reopened = await reopenProcessingManualWeight({ sscc: activeCarton.sscc18, reason: resetReason.trim() });
      setActive((previous) => previous ? { ...previous, carton: reopened } : previous);
      setSavedWeight(null); setScaleReading(null); lastScaleEvent.current = null; setResetPanel(''); setResetReason('');
      setNotice(`Carton ${activeCarton.cartonNo}: weight reopened. Send a NEW simulator reading after RFID finishes.`);
      await reload(); onCartonSaved?.();
    } catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  const nextCarton = () => {
    setSscc(''); setSku(''); setCartonId(''); setCartonQuery(''); setActive(null); setRfid(null);
    setSavedWeight(null); setScaleReading(null); lastScaleEvent.current = null; setError(''); setNotice('');
    setConfirmUnassign(false); setUnassignReason(''); setResetPanel(''); setResetReason('');
    reload().catch((e) => setError(errText(e)));
    onCartonSaved?.();
    window.requestAnimationFrame(() => ssccRef.current?.focus());
  };

  const openRecall = (row) => {
    if (busy) return;
    if (activeCarton && (!done(rfidResult) || !done(weightResult))) {
      setError('Finish the active carton before recalling a different FAILED carton.');
      return;
    }
    setError(''); setRecallReason(''); setRecallTarget(row);
  };

  const confirmRecall = async () => {
    if (!recallTarget || busy || recallReason.trim().length < 5) return;
    const target = recallTarget;
    setBusy(true); setError('');
    try {
      // Backend verifies Order/PO/Factory and FINAL FAILED again, then reopens
      // persisted Weight and RFID with audit; it never deletes previous attempts.
      const reopened = await recallFailedProcessingCarton({
        orderId, poId, cartonId: target.id, reason: recallReason.trim()
      });
      if (reopened?.carton?.id !== target.id) throw new Error('Recall returned a different Carton; refresh required.');
      setSscc(reopened.carton.sscc18 || target.cartonIdentity || '');
      setSku(reopened.carton.labelConfirmedSku || po?.sku || '');
      setCartonId(reopened.carton.id); setCartonQuery(''); setCartonPickerOpen(false);
      setPickerDismissedFor(''); setActive(reopened); setRfid(null);
      setSavedWeight(null); setShowEnd(false);
      setResetPanel(''); setResetReason(''); setConfirmUnassign(false);
      setUnassignReason(''); setRfidMountKey((key) => key + 1);
      setNotice(`Carton ${reopened.carton.cartonNo} recalled. Start a NEW RFID scan, then send Scale weight. Previous results remain in History.`);
      setRecallTarget(null); setRecallReason('');
      await reload(); onCartonSaved?.();
    } catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  const resultTable = (title, rows, failure) => (
    <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', minWidth: 0, width: '100%',
      borderColor: failure ? '#FECACA' : '#BBF7D0', backgroundColor: 'background.paper',
      boxShadow: '0 6px 22px rgba(15,23,42,0.04)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      height: { xs: 230, md: '100%' } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
        sx={{ px: 1.4, py: 1.05, borderBottom: '1px solid', borderColor: failure ? '#FECACA' : '#BBF7D0',
          bgcolor: failure ? '#FFF7F7' : '#F0FDF4' }}>
        <Stack direction="row" gap={0.6} alignItems="center">
          {failure ? <ErrorOutline color="error" fontSize="small" /> : <CheckCircleOutline color="success" fontSize="small" />}
          <Typography variant="subtitle2" fontWeight={900} color={failure ? 'error.main' : 'success.main'}>{title}</Typography>
        </Stack>
        <Chip size="small" variant="outlined" color={rows.length ? failure ? 'error' : 'success' : 'default'}
          label={`${rows.length} carton · ${rows.reduce((acc, row) => acc + Number(row.plannedQty || 0), 0)} pcs`} />
      </Stack>
      <TableContainer sx={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', overflowX: 'auto',
        scrollbarGutter: 'stable', bgcolor: '#FFFFFF' }}>
      <Table stickyHeader size="small" aria-label={`${title} carton results`} sx={{ minWidth: 730, tableLayout: 'fixed', width: '100%',
        '& .MuiTableCell-root': { px: 0.7, py: 0.55, verticalAlign: 'middle', borderColor: 'divider' },
        '& .MuiChip-root': { height: 21, fontSize: 10.5, fontWeight: 800 },
        '& .MuiTableRow-root': { height: 43 } }}>
        <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
          <TableCell align="center" sx={{ width: '6%', fontSize: 11, fontWeight: 900 }}>STT</TableCell>
          <TableCell sx={{ width: '12%', fontSize: 11, fontWeight: 900 }}>PO</TableCell>
          <TableCell sx={{ width: '27%', fontSize: 11, fontWeight: 900 }}>SSCC-18</TableCell>
          <TableCell sx={{ width: '17%', fontSize: 11, fontWeight: 900 }}>SKU</TableCell>
          <TableCell sx={{ width: '12%', fontSize: 11, fontWeight: 900 }}>RFID</TableCell>
          <TableCell sx={{ width: '15%', fontSize: 11, fontWeight: 900 }}>Weight</TableCell>
          <TableCell align="center" sx={{ width: '11%', fontSize: 11, fontWeight: 900 }}>Actions</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((row, index) => {
            const expanded = Boolean(resultDetailsOpen[row.id]);
            const statusIcon = (status) => status === 'PASS'
              ? <CheckCircleOutline color="success" sx={{ fontSize: 16, flexShrink: 0 }} />
              : <ErrorOutline color="error" sx={{ fontSize: 16, flexShrink: 0 }} />;
            return <Fragment key={row.id}>
              <TableRow hover>
                <TableCell align="center" sx={{ fontWeight: 800 }}>{index + 1}</TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 850, whiteSpace: 'nowrap' }}>{po?.poNumber || '—'}</Typography>
                </TableCell>
                <TableCell>
                  <Tooltip arrow title={row.cartonIdentity || 'No SSCC assigned'}>
                    <Typography sx={{ fontSize: 10.5, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{row.cartonIdentity || '—'}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip arrow title={row.labelConfirmedSku || po?.sku || 'SKU not confirmed'}>
                    <Typography sx={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{row.labelConfirmedSku || po?.sku || '—'}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip arrow title={`RFID ${row.rfidStatus || 'PENDING'} · ${cartonRfidDisplay(row).detail}`}>
                    <Stack direction="row" spacing={0.35} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
                      {statusIcon(row.rfidStatus)}
                      <Typography sx={{ fontSize: 11.5, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                        {cartonRfidDisplay(row).label}
                      </Typography>
                    </Stack>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Tooltip arrow title={`Weight: ${row.weightStatus || 'PENDING'} · Expected: ${kg(row.expectedWeightKg)} kg`}>
                    <Stack direction="row" spacing={0.35} alignItems="center" sx={{ whiteSpace: 'nowrap' }}>
                      {statusIcon(row.weightStatus)}
                      <Typography sx={{ fontSize: 11.5, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>
                        {kg(row.weightKg)} kg
                      </Typography>
                    </Stack>
                  </Tooltip>
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.25} sx={{ whiteSpace: 'nowrap' }}>
                    {failure && canRecall && <Tooltip arrow title="Recall FAILED carton: RFID then Weight">
                      <span><IconButton size="small" color="warning" aria-label={`Recall Carton ${row.cartonNo}`}
                        onClick={() => openRecall(row)} disabled={busy} sx={{ p: 0.55 }}>
                        <ReplayRounded sx={{ fontSize: 19 }} />
                      </IconButton></span>
                    </Tooltip>}
                    <Tooltip arrow title={expanded ? 'Hide carton details' : 'View carton details'}>
                      <IconButton size="small" color="primary" aria-label={`${expanded ? 'Hide' : 'View'} Carton ${row.cartonNo} details`}
                        aria-expanded={expanded}
                        onClick={() => setResultDetailsOpen((old) => ({ ...old, [row.id]: !old[row.id] }))} sx={{ p: 0.55 }}>
                        {expanded ? <VisibilityOffOutlined sx={{ fontSize: 19 }} /> : <VisibilityOutlined sx={{ fontSize: 19 }} />}
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
              {expanded && <TableRow sx={{ bgcolor: 'action.hover' }}><TableCell colSpan={7}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 0.5 }}>
                  <Typography variant="caption"><b>Carton No. / Qty:</b> {row.cartonNo ?? '—'} / {row.plannedQty ?? '—'} pcs</Typography>
                  <Typography variant="caption"><b>Expected / Actual:</b> {kg(row.expectedWeightKg)} / {kg(row.weightKg)} kg</Typography>
                  <Typography variant="caption"><b>Allowed weight:</b> {row.expectedWeightKg == null ? '—' : `${kg(Number(row.expectedWeightKg) - Number(row.weightToleranceKg || 0))}–${kg(Number(row.expectedWeightKg) + Number(row.weightToleranceKg || 0))} kg`}</Typography>
                  <Typography variant="caption"><b>RFID:</b> {cartonRfidDisplay(row).label} Matched / Expected · {row.rfidStatus || 'PENDING'}</Typography>
                </Box>
                <RfidInspectionEvidence row={row} orderId={orderId} poId={poId} />
              </TableCell></TableRow>}
            </Fragment>;
          })}
          {!rows.length && <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 1.5 }}>
            {failure ? 'No FINAL FAILED cartons.' : 'No FINAL PASS cartons yet.'}
          </TableCell></TableRow>}
        </TableBody>
      </Table>
      </TableContainer>
    </Paper>
  );

  return <Stack spacing={0} className="lululemon-fit-screen-v67" sx={{
    flex: '1 1 auto', width: '100%', height: { xs: 'auto', md: '100%' },
    minHeight: 0, minWidth: 0, gap: { xs: 0.85, md: 0.65 },
    overflowX: 'hidden', overflowY: { xs: 'visible', md: 'auto' },
    '& .MuiOutlinedInput-root': { borderRadius: 1.6, bgcolor: '#fff' },
    '& .MuiButton-root': { textTransform: 'none', borderRadius: 1.6, fontWeight: 750 },
    '& .MuiChip-root': { fontWeight: 750 },
    '& > .MuiPaper-root': { flexShrink: 0 },
    '@media (max-height: 680px)': { height: 'auto', overflowY: 'visible' },
    color: '#14264A'
  }}>
    {/* Summary is shown only once. Detailed reader/station configuration is available on demand. */}
    <Paper variant="outlined" sx={{ px: 1.2, py: 0.35, borderRadius: 1.8, borderColor: '#E2E8F0', bgcolor: '#fff' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" useFlexGap>
        <Stack direction="row" alignItems="center" gap={0.8} flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2" fontWeight={900}>Carton Processing</Typography>
          <Chip size="small" color="primary" variant="outlined" label={`Inspected ${summary?.processed ?? 0} / ${summary?.total ?? cartons.length}`} />
          <Chip size="small" color="success" variant="outlined" label={`PASS ${summary?.passed ?? passRows.length}`} />
          <Chip size="small" color="error" variant="outlined" label={`FAILED ${summary?.failed ?? failedRows.length}`} />
          {active && <Chip size="small" variant="outlined" label={`Carton ${activeCarton?.cartonNo ?? '—'} · ${qty} pcs`} />}
          {notice && <Tooltip arrow title={notice}>
            <Typography color="info.main" noWrap sx={{ fontSize: 11.5, maxWidth: { xs: 260, md: 480 }, fontWeight: 600 }}>
              {notice}
            </Typography>
          </Tooltip>}
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Button size="small" variant="text" startIcon={<SettingsOutlined fontSize="small" />}
            onClick={() => setShowStationSettings((value) => !value)}
            endIcon={showStationSettings ? <ExpandLess /> : <ExpandMore />}
            aria-expanded={showStationSettings}>Scale: {devices.find((d) => d.stationCode === stationCode)?.stationName || stationCode || 'Not assigned'}</Button>
          <Button size="small" variant="text" startIcon={<Refresh />}
            onClick={() => reload().catch((e) => setError(errText(e)))} disabled={busy}>Refresh</Button>
          {summary?.end && !active && <Button size="small" variant="contained" onClick={() => setShowEnd(true)}>END</Button>}
        </Stack>
      </Stack>
      <Collapse in={showStationSettings} unmountOnExit>
        <Stack direction="row" spacing={1} sx={{ pt: 0.8 }} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="small" variant="outlined" icon={<QrCodeScannerOutlined />} label="RFID Reader · Device Management" />
          <Chip size="small" variant="outlined" icon={<Sensors />} label={`Assigned Scale · ${stationCode || 'Not assigned'}`} />
          <Typography variant="caption" color="text.secondary">Device assignments are managed by Admin.</Typography>
        </Stack>
      </Collapse>
    </Paper>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ py: 0, minHeight: 30,
      '& .MuiAlert-message': { py: 0.35, maxHeight: 46, overflowY: 'auto' },
      '& .MuiAlert-icon': { py: 0.35 }, '& .MuiAlert-action': { py: 0 } }}>{error}</Alert>}
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'visible', position: 'relative', borderColor: '#DFE7F2',
      boxShadow: '0 4px 16px rgba(15,23,42,0.03)' }}>
      <Box sx={{ p: { xs: 1, md: 0.75 }, position: 'relative' }}>
        <Stack direction="row" gap={0.7} alignItems="center" sx={{ mb: { xs: 0.7, md: 0.35 } }}>
          <QrCodeScannerOutlined color="primary" fontSize="small" />
          <Typography variant="subtitle2" fontWeight={900}>1. Carton Identification</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>SSCC → SKU → Assign</Typography>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.65} alignItems="stretch">
          <TextField inputRef={ssccRef} fullWidth label="Carton SSCC-18" InputLabelProps={{ shrink: true }}
            placeholder="Scan GS1 (00) barcode or SSCC-18, then Enter" value={sscc}
            onChange={(e) => {
              setSscc(e.target.value.replace(/\s+/g, ''));
              // Changing the SSCC invalidates both the prior carton and SKU scans.
              setCartonId(''); setCartonQuery(''); setSku(''); setError('');
              setCartonPickerOpen(false); setPickerDismissedFor('');
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') {
              e.preventDefault();
              if (!validSscc) setError('Scan a valid SSCC-18 or GS1 (00) + SSCC-18.');
              else if (existingCarton) skuRef.current?.focus();
              else { setPickerDismissedFor(''); setCartonPickerOpen(true); }
            } }}
            disabled={Boolean(active) || busy} size="small"
            InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment>,
              sx: { fontSize: 16, fontWeight: 800, letterSpacing: 0.5 } }} sx={{ flex: 1.2, '& .MuiOutlinedInput-root': { minHeight: { xs: 48, md: 40 } } }} />
          <TextField inputRef={skuRef} fullWidth label="Scan SKU" InputLabelProps={{ shrink: true }}
            placeholder={needCartonChoice && !chosenCarton ? 'Select Carton No. from list first' : 'Scan carton SKU, then Enter'} value={sku}
            onChange={(e) => { setSku(e.target.value.replace(/\s+/g, '')); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); identify(); } }}
            disabled={Boolean(active) || busy || !validSscc || (needCartonChoice && !chosenCarton)} size="small"
            InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment>,
              sx: { fontSize: 16, fontWeight: 800, letterSpacing: 0.35 } }} sx={{ flex: 1, '& .MuiOutlinedInput-root': { minHeight: { xs: 48, md: 40 } } }} />
          <Button variant="contained" size="small" onClick={identify} disabled={busy || loading || Boolean(active) || !validSscc || !sku.trim() || !stationCode.trim() || (needCartonChoice && !chosenCarton)}
            sx={{ minWidth: 146, whiteSpace: 'nowrap' }}>{busy ? 'Saving…' : 'Assign / Identify'}</Button>
        </Stack>
        {needCartonChoice && !chosenCarton && <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.35 }}>
          <Typography variant="caption" color="text.secondary">
            New SSCC · Select the Carton No. on its physical label before scanning SKU.
          </Typography>
          <Button size="small" variant="text" sx={{ minHeight: 26, whiteSpace: 'nowrap' }}
            onClick={() => { setPickerDismissedFor(''); setCartonPickerOpen(true); }}>
            Select Carton ({unassigned.length})
          </Button>
        </Stack>}
        {chosenCarton && !active && <Typography variant="caption" color="success.main" sx={{ mt: 0.2, display: 'block' }}>
          Selected Carton {chosenCarton.cartonNo} · {chosenCarton.plannedQty} pcs · Scan SKU to confirm.
        </Typography>}
        {!stationCode && <Alert severity="warning" sx={{ mt: 0.6, py: 0 }}>
          No Scale assigned for Factory {factoryCode}. Ask Admin to assign PLC Scale Simulator in Device Management.
        </Alert>}
        {active && <Stack spacing={0.45} sx={{ mt: 0.25 }}>
          <Box sx={{ pt: 0.4, mt: 0.25, borderTop: '1px solid #E7EDF5' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap" useFlexGap>
              <Stack direction="row" alignItems="center" gap={0.65} flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" color="warning" startIcon={<LinkOff />}
                  disabled={!canUnassignNewIdentity || busy}
                  onClick={() => { setResetPanel('assign'); setConfirmUnassign(true); setResetReason(''); }}>
                  Reset Assign
                </Button>
                <Button size="small" variant="outlined" startIcon={<RestartAltRounded />}
                  disabled={busy || Boolean(weightResult) || Boolean(savedWeight) || !done(rfidResult) || (rfidResult === 'PASS' && !admin)}
                  onClick={() => { setConfirmUnassign(false); setResetPanel('rfid'); setResetReason(''); }}>
                  Reset RFID
                </Button>
                {weightResult && admin && <Button size="small" variant="outlined" startIcon={<ScaleOutlined />}
                  disabled={busy || !active}
                  onClick={() => { setConfirmUnassign(false); setResetPanel('weight'); setResetReason(''); }}>
                  Reopen Weight
                </Button>}
              </Stack>
              <Button size="small" variant="contained" disabled={!savedWeight && !summary?.end}
                onClick={() => { if (summary?.end) setShowEnd(true); else nextCarton(); }}>
                {summary?.end ? 'END' : 'Next Carton'}
              </Button>
            </Stack>
          </Box>
          {resetPanel === 'rfid' && <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5, borderColor: 'warning.light' }}>
            <Typography variant="body2" fontWeight={850}>Reset RFID — Carton {activeCarton.cartonNo}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              A completed attempt stays in history. Stop / finish an active capture before resetting. Saved Weight must be reopened first.
            </Typography>
            {rfidResult === 'PASS' && <TextField size="small" fullWidth sx={{ my: 0.7 }}
              label="Admin reason (minimum 5 characters)" value={resetReason}
              onChange={(e) => setResetReason(e.target.value)} inputProps={{ maxLength: 250 }} />}
            <Stack direction="row" gap={0.8} sx={{ mt: 0.7 }}>
              <Button size="small" color="warning" variant="contained" disabled={busy || (rfidResult === 'PASS' && resetReason.trim().length < 5)}
                onClick={resetRfid}>Confirm Reset RFID</Button>
              <Button size="small" onClick={() => { setResetPanel(''); setResetReason(''); }} disabled={busy}>Cancel</Button>
            </Stack>
          </Paper>}
          {resetPanel === 'weight' && weightResult && admin && <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5, borderColor: 'info.light' }}>
            <Typography variant="body2" fontWeight={850}>Reset Weight — Carton {activeCarton.cartonNo}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Admin can reopen a saved weight; previous result remains in history.
            </Typography>
            {weightResult && admin && <TextField size="small" fullWidth sx={{ my: 0.7 }}
              label="Reason (minimum 3 characters)" value={resetReason}
              onChange={(e) => setResetReason(e.target.value)} inputProps={{ maxLength: 250 }} />}
            <Stack direction="row" gap={0.8} sx={{ mt: 0.7 }}>
              <Button size="small" variant="contained" color="warning" onClick={resetWeight}
                disabled={busy || (Boolean(weightResult) && (!admin || resetReason.trim().length < 3))}>
                Confirm Reopen Weight
              </Button>
              <Button size="small" onClick={() => { setResetPanel(''); setResetReason(''); }} disabled={busy}>Cancel</Button>
            </Stack>
          </Paper>}
          {confirmUnassign && resetPanel === 'assign' && canUnassignNewIdentity && <Paper variant="outlined" sx={{ p: 1, borderColor: 'error.light', borderRadius: 1.5 }}>
            <Typography variant="body2" fontWeight={800}>Unassign Carton {activeCarton.cartonNo}?</Typography>
            <Typography variant="caption" color="text.secondary">
              Clear its SSCC and SKU assignment from the existing Item slots; keep all Item IDs and PO master SKU.
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.7} sx={{ mt: 0.7 }}>
              <TextField size="small" fullWidth label="Reason" placeholder="e.g. Wrong carton selected"
                value={unassignReason} onChange={(e) => setUnassignReason(e.target.value)}
                disabled={busy} inputProps={{ maxLength: 250 }} />
              <Button color="error" variant="contained" onClick={unassignIdentity}
                disabled={busy || unassignReason.trim().length < 3} sx={{ whiteSpace: 'nowrap' }}>
                Confirm Unassign
              </Button>
              <Button variant="outlined" disabled={busy} onClick={() => { setConfirmUnassign(false); setUnassignReason(''); setResetPanel(''); }}>Cancel</Button>
            </Stack>
          </Paper>}
        </Stack>}
      </Box>
    </Paper>
    {/* RFID/Weight are aligned desktop panels; their operational controls must never sit behind an inner scrollbar. */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(0,1fr)' },
      gap: { xs: 0.8, md: 0.7 }, alignItems: 'stretch',
      flex: '0 0 auto', minHeight: 0, minWidth: 0 }}>
      <Box component="section" aria-label="RFID Scanning" sx={{ p: { xs: 0.85, md: 0.75 }, border: '1px solid', borderColor: '#DAE5F2',
        borderRadius: 2, bgcolor: '#fff', minWidth: 0, boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
        display: 'flex', flexDirection: 'column', gap: 0.35, overflow: 'visible' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" gap={0.55} alignItems="center" sx={{ minWidth: 0 }}>
            <Sensors color="primary" sx={{ fontSize: 19 }}/>
            <Typography variant="subtitle2" fontWeight={900} noWrap>2. RFID Scanning</Typography>
          </Stack>
          <Chip size="small" color={rfidResult === 'SCANNING' ? 'info' : statusColor(rfidResult)}
            label={rfidResult ? `RFID ${rfidResult}` : active ? 'CONNECTING' : 'WAITING FOR CARTON'}
            sx={{ flexShrink: 0, height: 23 }}/>
        </Stack>
        {active ? <CartonRfidPanel key={`${activeCarton.id}-${rfidMountKey}`} deferStart compact orderId={orderId} poId={poId} carton={activeCarton}
          stationCode={stationCode} factoryCode={factoryCode} onSessionChange={handleRfidSessionChange} />
          : <Box sx={{ py: 1.1, px: 0.8, textAlign: 'center', borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <QrCodeScannerOutlined color="disabled" sx={{ fontSize: 23, mb: 0.2 }}/>
            <Typography variant="body2" fontWeight={850} color="text.secondary">Waiting for carton</Typography>
            <Typography variant="caption" color="text.secondary">Scan SSCC and SKU above to start RFID.</Typography>
          </Box>}
      </Box>
      <Box component="section" aria-label="Weight" sx={{ p: { xs: 0.85, md: 0.75 }, border: '1px solid', borderColor: '#DAE5F2',
        borderRadius: 2, bgcolor: '#fff', minWidth: 0, boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
        display: 'flex', flexDirection: 'column', gap: 0.65, overflow: 'visible' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={0.5}>
          <Stack direction="row" gap={0.55} alignItems="center">
            <ScaleOutlined color="primary" sx={{ fontSize: 19 }}/>
            <Typography variant="subtitle2" fontWeight={900} noWrap>3. Weight</Typography>
          </Stack>
          <Chip size="small" color={statusColor(weightResult)}
            label={weightResult ? `${weightResult} · SAVED` : active ? done(rfidResult) ? 'WAITING FOR SCALE' : 'WAITING FOR RFID' : 'WAITING FOR SSCC'}
            sx={{ flexShrink: 0, height: 23 }}/>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: 0.65 }}>
          <Box sx={{ px: 0.9, py: 0.6, border: '1px solid', borderColor: 'divider', borderRadius: 1.4, bgcolor: '#F8FAFC' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={850}>TARGET</Typography>
            <Typography sx={{ fontSize: 19, fontWeight: 950, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
              {active ? `${kg(expected)} kg` : '—'}
            </Typography>
          </Box>
          <Box sx={{ px: 0.9, py: 0.6, border: '1px solid', borderColor: 'divider', borderRadius: 1.4, bgcolor: '#F8FAFC' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={850}>ALLOWED RANGE</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 900, lineHeight: 1.7, whiteSpace: 'nowrap' }}>
              {active ? `${kg(minWeight)}–${kg(maxWeight)} kg` : '—'}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: weightResult ? '1fr' : 'minmax(110px, 0.8fr) minmax(0, 1.2fr)' },
          gap: 0.7, alignItems: 'stretch' }}>
          <Box sx={{ py: 0.65, px: 0.8, border: '1px solid', borderColor: weightResult === 'PASS' ? 'success.main' : weightResult === 'FAILED' ? 'error.main' : 'primary.light',
            borderRadius: 1.5, bgcolor: weightResult === 'PASS' ? 'success.lighter' : weightResult === 'FAILED' ? 'error.lighter' : 'background.paper',
            display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={900}>ACTUAL WEIGHT</Typography>
            <Typography sx={{ fontSize: 26, lineHeight: 1.15, fontWeight: 950, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
              {weightResult ? kg(savedWeight?.event?.actualWeightKg ?? savedWeight?.carton?.actualWeightKg ?? activeCarton?.actualWeightKg)
                : done(rfidResult) && scaleReading?.mode === 'SIMULATOR' && !scaleReading?.consumed && scaleReading?.weightKg != null ? kg(scaleReading.weightKg) : '—'}
              <Typography component="span" sx={{ ml: 0.45, fontSize: 12, fontWeight: 900 }}>kg</Typography>
            </Typography>
          </Box>
          {!weightResult && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, justifyContent: 'center' }}>
            <Typography variant="caption" fontWeight={850} color="text.secondary">AUTOMATIC SCALE</Typography>
            <Chip size="small" color={scaleReading?.status === 'OFFLINE' ? 'error' : stationCode ? 'info' : 'default'}
              label={!stationCode ? 'NOT ASSIGNED' : scaleReading?.mode === 'SIMULATOR' ? 'SIMULATED / CONNECTED' : scaleReading?.status || 'WAITING FOR SCALE'} />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {!done(rfidResult) ? 'Finish RFID scan first (PASS or FAILED).' :
                scaleReading?.mode === 'SIMULATOR' ? 'RFID result recorded. Send a NEW weight from Admin → Devices → Scale (PLC).' :
                scaleReading?.mode === 'MODBUS_TCP' ? 'Real PLC preview only; stable auto-capture is not enabled yet.' : 'Waiting for your assigned Scale simulator.'}
            </Typography>
          </Box>}
        </Box>
        {!weightResult && <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.25 }}>
          {active ? 'RFID finished (PASS or FAILED) → NEW Scale Simulator reading → Weight saved automatically.' : 'Scan SSCC and SKU above to begin.'}
        </Typography>}
      </Box>
    </Box>
    {showEnd && summary?.end && <Alert severity="success">END · All {summary.total} cartons processed. FINAL PASS: {summary.passed} · FINAL FAILED: {summary.failed}. Review FAILED cartons before closing the PO.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(0,1fr)' },
      gap: { xs: 0.8, md: 0.7 }, alignItems: 'stretch', flex: { md: '1 1 0' }, minHeight: { md: 135 }, overflow: 'hidden' }}>
      {resultTable('FINAL PASS', passRows, false)}
      {resultTable('FINAL FAILED', failedRows, true)}
    </Box>
    {loading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16}/><Typography variant="caption">Loading cartons…</Typography></Stack>}
    <Dialog open={Boolean(recallTarget)} onClose={busy ? undefined : () => { setRecallTarget(null); setRecallReason(''); }}
      aria-labelledby="lulu-recall-failed-title" fullWidth maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle id="lulu-recall-failed-title" sx={{ fontWeight: 850, pb: 0.5 }}>
        Recall FAILED Carton {recallTarget?.cartonNo ?? '—'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          SSCC: <b>{recallTarget?.cartonIdentity ?? '—'}</b>
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1.3 }}>
          <Chip size="small" label={`RFID: ${recallTarget?.rfidStatus || '—'}`} color={statusColor(recallTarget?.rfidStatus)} />
          <Chip size="small" label={`Weight: ${recallTarget?.weightStatus || '—'}`} color={statusColor(recallTarget?.weightStatus)} />
        </Stack>
        <Alert severity="warning" sx={{ mb: 1.3 }}>
          Recall will reopen both RFID and Weight for this FAILED carton. Previous history is retained. Finish RFID (PASS or FAILED), then send a new Scale weight.
        </Alert>
        {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
        <TextField size="small" fullWidth autoFocus multiline minRows={2} label="Reason for Recall (required)"
          placeholder="e.g. RFID mismatch / wrong weight, verify again" value={recallReason}
          onChange={(e) => setRecallReason(e.target.value)} inputProps={{ maxLength: 250 }} />
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 1.8 }}>
        <Button disabled={busy} onClick={() => { setRecallTarget(null); setRecallReason(''); }}>Cancel</Button>
        <Button variant="contained" color="warning" startIcon={busy ? <CircularProgress size={16} /> : <ReplayRounded />}
          disabled={busy || recallReason.trim().length < 5} onClick={confirmRecall}>
          {busy ? 'Recalling…' : 'Confirm Recall'}
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={cartonPickerOpen && needCartonChoice && !active} onClose={closeCartonPicker}
      aria-labelledby="lulu-carton-select-title" fullWidth maxWidth="xl"
      PaperProps={{ sx: { borderRadius: 2.4, width: 'min(96vw, 1450px)', height: 'min(82dvh, 710px)',
        maxHeight: 'calc(100dvh - 32px)', display: 'flex', overflow: 'hidden' } }}>
      <DialogTitle id="lulu-carton-select-title" sx={{ px: 2, py: 1.2, fontWeight: 800, borderBottom: '1px solid #E2E8F0' }}>
        Select Carton · PO {po?.poNumber || '—'}
        <Typography sx={{ mt: 0.25, fontWeight: 400, fontSize: 12.5, color: 'text.secondary' }}>
          New SSCC {normalizedSscc || '—'} · Select the matching Carton by its planned QTY and Carton No.
        </Typography>
      </DialogTitle>
      <Box sx={{ px: 1.5, pt: 1.1, pb: 0.9, flexShrink: 0, borderBottom: '1px solid #E2E8F0' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={0.75} justifyContent="space-between">
          <Stack direction="row" gap={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" color="primary"
              label={`${filteredUnassigned.length} of ${unassigned.length} unassigned cartons`} />
            <Typography variant="caption" color="text.secondary">QTY = planned pcs per carton</Typography>
          </Stack>
          <Stack direction="row" gap={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField inputRef={cartonQueryRef} autoFocus size="small" label="Search cartons / PO / Style"
              placeholder="Search..." value={cartonQuery} onChange={(e) => setCartonQuery(e.target.value)}
              sx={{ width: { xs: '100%', sm: 270 } }} />
            <Button variant={pickerMoreFilters ? 'contained' : 'outlined'} size="small"
              startIcon={<FilterListOutlined />} onClick={() => setPickerMoreFilters((open) => !open)}>
              Filters
            </Button>
            <Button variant="outlined" size="small" startIcon={<ViewColumnOutlined />}
              onClick={(event) => setPickerColumnsAnchor(event.currentTarget)}>
              Columns {pickerVisibleColumns.length}/{pickerColumnsCatalog.length}
            </Button>
            <Menu anchorEl={pickerColumnsAnchor} open={Boolean(pickerColumnsAnchor)}
              onClose={() => setPickerColumnsAnchor(null)}
              PaperProps={{ sx: { width: 290, maxHeight: 'min(65dvh, 450px)' } }}>
              <MenuItem disabled sx={{ opacity: '1 !important', fontWeight: 850 }}>Visible Columns</MenuItem>
              <MenuItem onClick={() => setPickerColumnKeys([...CARTON_PICKER_DEFAULT_COLUMNS])}>
                Restore default columns
              </MenuItem>
              <Divider />
              {pickerColumnsCatalog.map((column) => <MenuItem dense key={column.key}
                onClick={() => togglePickerColumn(column.key)}>
                <Checkbox size="small" edge="start" disableRipple
                  checked={pickerVisibleColumns.some((visible) => visible.key === column.key)}
                  tabIndex={-1} sx={{ py: 0.25 }} />
                <ListItemText primary={column.label} primaryTypographyProps={{ fontSize: 13 }} />
              </MenuItem>)}
            </Menu>
          </Stack>
        </Stack>
        <Collapse in={pickerMoreFilters} unmountOnExit>
          <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))' }, gap: 0.7 }}>
            {[
              ['po', 'PO No.'], ['masterPo', 'Master PO'], ['style', 'Style'],
              ['description', 'Description'], ['color', 'Color Description'],
              ['qty', 'Carton QTY'], ['sku', 'SKU'], ['cartonNo', 'Carton No.']
            ].map(([key, label]) => <TextField size="small" key={key}
              label={label} value={pickerFilters[key]} onChange={(event) => setPickerFilter(key, event.target.value)} />)}
          </Box>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.65 }}>
            <Button size="small" onClick={() => { setPickerFilters({ ...PICKER_FILTER_EMPTY }); setCartonQuery(''); }}>
              Clear Filters
            </Button>
          </Stack>
        </Collapse>
      </Box>
      <DialogContent dividers sx={{ p: 1, minHeight: 0, flex: '1 1 auto', overflow: 'hidden' }}>
        {unassigned.length === 0 ? <Alert severity="warning">No unassigned Carton remains in this PO. Check its SSCC or refresh the PO.</Alert> :
          <TableContainer sx={{ height: '100%', overflow: 'auto', borderRadius: 1, border: '1px solid #E2E8F0' }}>
            <Table stickyHeader size="small" aria-label="Choose an unassigned Carton from current PO"
              sx={{ minWidth: pickerVisibleColumns.reduce((width, column) => width + column.minWidth, 125),
                '& .MuiTableCell-root': { py: 0.7, px: 1, whiteSpace: 'nowrap', borderColor: 'divider' } }}>
              <TableHead><TableRow>
                {pickerVisibleColumns.map((column) => <TableCell key={column.key}
                  sx={{ fontWeight: 800, minWidth: column.minWidth, bgcolor: '#F8FAFC' }}>{column.label}</TableCell>)}
                <TableCell sx={{ fontWeight: 800, width: 145, bgcolor: '#F8FAFC' }} align="right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {filteredUnassigned.map((row) => <TableRow hover key={row.id}>
                  {pickerVisibleColumns.map((column) => <TableCell key={column.key}>
                    <Tooltip arrow title={String(pickerCellValue(column.key, row, po, factoryCode))}>
                      <Typography variant="caption" sx={{ display: 'block', maxWidth: column.key === 'description' ? 280 : 220,
                        textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {pickerCellValue(column.key, row, po, factoryCode)}
                      </Typography>
                    </Tooltip>
                  </TableCell>)}
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => chooseCarton(row.id)}
                      aria-label={`Choose Carton ${row.cartonNo}, ${row.plannedQty} pcs`} sx={{ whiteSpace: 'nowrap' }}>
                      Choose Ctn {row.cartonNo}
                    </Button>
                  </TableCell>
                </TableRow>)}
                {!filteredUnassigned.length && <TableRow><TableCell colSpan={pickerVisibleColumns.length + 1}
                  align="center" sx={{ py: 3 }}>No cartons match the current filters.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.1, borderTop: '1px solid #E2E8F0' }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Only unassigned cartons in this PO · Choose assigns the exact Carton ID, not just the PO.
        </Typography>
        <Button size="small" variant="outlined" onClick={closeCartonPicker}>Close</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
