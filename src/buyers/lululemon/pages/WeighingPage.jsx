import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  CheckCircleOutline,
  ErrorOutline,
  GppGood,
  PlayArrow,
  QrCodeScannerOutlined,
  Refresh,
  Search,
  ScaleOutlined,
  Sensors,
  Stop,
  TaskAlt,
  Undo
} from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { CompactPageHeader } from 'components/CompactPageHeader';
import StatusChip from 'components/StatusChip';
import { canAccessAssignedFactory, canManageSales, canWeightCheck, getFactoryPermissions, isAdmin } from 'utils/accessControl';
import OrderScope from '../components/OrderScope';
import {
  completeWeighingPo,
  getPo,
  listCartonWeightAssignments,
  listWeightHistory,
  listWeighingQueue,
  listShippingSchedules,
  lookupCartonWeightSscc,
  lookupWeighingSsccForPo,
  overrideWeightPass as overrideWeightPassApi,
  reopenWeight as reopenWeightApi,
  startWeighingPo,
  stopWeighingPo,
  submitWeight as submitWeightApi
} from '../services/service';
import {
  APP_MESSAGES,
  createCartonReweighOpenMessage,
  createOverridePassReasonMessage,
  createOverridePassSuccessMessage,
  createReweighReasonMessage
} from '../../../constants/appMessages';
import {
  DEFAULT_SCALE_STATION,
  STORAGE_KEY,
  WEIGHT_ACTION,
  WEIGHT_SOURCE,
  WEIGHING_RESULT
} from '../../../constants/appConstants';

const errorText = (error) => error?.response?.data?.message || error?.message || APP_MESSAGES.OPERATION_FAILED;
const num = (value) => Number(value ?? 0);
const kg = (value, digits = 3) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—';
};
const cartonQty = (carton) => num(carton?.scannedQty || carton?.plannedQty || 0);
const normalizeResult = (value) => value === 'HOLD' ? WEIGHING_RESULT.FAILED : value;
const isPass = (value) => normalizeResult(value) === WEIGHING_RESULT.PASS;
const isFailed = (value) => normalizeResult(value) === WEIGHING_RESULT.FAILED;

const poLabel = (row) => {
  const po = row?.po || {};
  const parts = [
    `PO ${po.poNumber || '—'}`,
    po.masterPo ? `Master ${po.masterPo}` : null,
    po.dcCode ? `DC ${po.dcCode}` : null,
    po.destination || null,
    po.channel ? `Channel ${po.channel}` : null,
    po.packingPlan ? `Plan ${po.packingPlan}` : null,
    po.salesOrderPts ? `SO ${po.salesOrderPts}` : null,
    po.style ? `Style ${po.style}` : null,
    po.color ? `Color ${po.color}` : null,
    po.size ? `Size ${po.size}` : null
  ].filter(Boolean);
  return parts.join(' · ');
};

export default function WeighingPage() {
  const [orderId, setOrderId] = useState('');
  const [queue, setQueue] = useState([]);
  const [shippingSchedules, setShippingSchedules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentFilters, setAssignmentFilters] = useState({ orderNo: '', factory: '', shippingList: '', shippingDate: '' });
  const [findSscc, setFindSscc] = useState('');
  const [pendingTarget, setPendingTarget] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [poOptions, setPoOptions] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [running, setRunning] = useState(false);
  const [weighingOpen, setWeighingOpen] = useState(false);
  const [sscc, setSscc] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookupStartedAt, setLookupStartedAt] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [actualWeight, setActualWeight] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [stationCode, setStationCode] = useState(
    () => localStorage.getItem(STORAGE_KEY.WEIGHING_STATION_SSCC) || DEFAULT_SCALE_STATION
  );
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const scanRef = useRef(null);
  const resultTimerRef = useRef(null);

  const mayWeigh = canWeightCheck();
  const admin = isAdmin();
  const unrestrictedFactoryView = admin || canManageSales();
  const userFactories = useMemo(() => getFactoryPermissions(), []);
  const factoryScopeLabel = unrestrictedFactoryView ? 'ALL FACTORIES' : (userFactories.length ? userFactories.join(', ') : 'NO FACTORY ASSIGNED');

  const filteredAssignments = useMemo(() => {
    const lower = (value) => String(value || '').trim().toLowerCase();
    const orderKey = lower(assignmentFilters.orderNo);
    const factoryKey = lower(assignmentFilters.factory);
    const shippingKey = lower(assignmentFilters.shippingList);
    const dateKey = String(assignmentFilters.shippingDate || '').trim();
    return assignments.filter((row) => {
      if (orderKey && !lower(row.orderNo).includes(orderKey)) return false;
      if (factoryKey && !lower(row.factoryCode).includes(factoryKey)) return false;
      if (shippingKey && !lower(row.shippingList).includes(shippingKey)) return false;
      if (dateKey && String(row.shippingDate || '') !== dateKey) return false;
      return true;
    });
  }, [assignments, assignmentFilters]);

  const selectedSchedule = useMemo(
    () => shippingSchedules.find((row) => row?.schedule?.id === selectedScheduleId) || null,
    [shippingSchedules, selectedScheduleId]
  );
  const selectedPo = useMemo(
    () => poOptions.find((row) => row.poId === selectedPoId) || null,
    [poOptions, selectedPoId]
  );
  const selectedWeighingOrderId = selectedPo?.weighingOrder?.id || '';

  const focusScanner = useCallback(() => {
    window.setTimeout(() => scanRef.current?.focus(), 70);
  }, []);

  const clearActiveCarton = useCallback((focus = true) => {
    setLookup(null);
    setLookupStartedAt(0);
    setLastResult(null);
    setSscc('');
    setActualWeight('');
    setManualOpen(false);
    if (focus) focusScanner();
  }, [focusScanner]);

  const loadAssignments = useCallback(async () => {
    setAssignmentLoading(true);
    try {
      const rows = await listCartonWeightAssignments();
      setAssignments(Array.isArray(rows) ? rows : []);
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      setAssignments([]);
      setNotice({ severity: 'error', text: errorText(error) });
      return [];
    } finally {
      setAssignmentLoading(false);
    }
  }, []);

  const openAssignment = useCallback((row) => {
    if (!row?.orderId || !row?.shippingScheduleId || !row?.poId) return;
    setPendingTarget({ orderId: row.orderId, scheduleId: row.shippingScheduleId, poId: row.poId });
    setOrderId(row.orderId);
    setAssignmentFilters({
      orderNo: row.orderNo || '',
      factory: row.factoryCode || '',
      shippingList: row.shippingList || '',
      shippingDate: row.shippingDate || ''
    });
  }, []);

  const findAssignmentBySscc = async () => {
    const code = findSscc.trim();
    if (!code || busy || !mayWeigh) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await lookupCartonWeightSscc(code);
      const schedule = result?.shippingSchedule || {};
      const order = result?.order || {};
      const po = result?.po || {};
      setPendingTarget({ orderId: order.id, scheduleId: schedule.id, poId: po.id });
      setOrderId(order.id || '');
      setAssignmentFilters({
        orderNo: order.orderName || '',
        factory: schedule.factoryCode || '',
        shippingList: schedule.scheduleNo || '',
        shippingDate: schedule.exFtyDate || ''
      });
      setNotice({ severity: 'success', text: result?.message || 'SSCC-18 found in the assigned Shipping List.' });
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const loadSchedules = useCallback(async () => {
    if (!orderId) {
      setShippingSchedules([]);
      setSelectedScheduleId('');
      return [];
    }
    try {
      const rows = await listShippingSchedules(orderId);
      const safe = (Array.isArray(rows) ? rows : [])
        .filter((row) => row?.schedule?.weighingOrderId)
        .filter((row) => canAccessAssignedFactory(row?.schedule?.factoryCode));
      setShippingSchedules(safe);
      setSelectedScheduleId((current) => safe.some((row) => row?.schedule?.id === current) ? current : (safe[0]?.schedule?.id || ''));
      return safe;
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      return [];
    }
  }, [orderId]);

  const loadQueue = useCallback(async () => {
    if (!orderId) {
      setQueue([]);
      setPoOptions([]);
      setSelectedPoId('');
      return [];
    }
    setQueueLoading(true);
    try {
      const rows = await listWeighingQueue(orderId);
      const allRows = Array.isArray(rows) ? rows : [];
      const safeRows = selectedScheduleId
        ? allRows.filter((row) => row?.weighingOrder?.shippingScheduleId === selectedScheduleId)
        : [];
      setQueue(safeRows);

      const refs = new Map();
      safeRows.forEach((row) => {
        const job = row.weighingOrder || {};
        (job.poIds || []).forEach((poId) => {
          if (poId && !refs.has(poId)) refs.set(poId, job);
        });
      });

      const options = (await Promise.all(Array.from(refs.entries()).map(async ([poId, job]) => {
        try {
          const detail = await getPo(orderId, poId);
          const po = detail?.po || {};
          const jobCartonIds = new Set(job.cartonIds || []);
          const allCartons = Array.isArray(detail?.cartons) ? detail.cartons : [];
          const cartons = jobCartonIds.size ? allCartons.filter((carton) => jobCartonIds.has(carton.id)) : allCartons;
          const passCartons = cartons.filter((carton) => isPass(carton.weightStatus)).length;
          const failedCartons = cartons.filter((carton) => isFailed(carton.weightStatus)).length;
          const remainingCartons = Math.max(0, cartons.length - passCartons - failedCartons);
          return {
            poId,
            po,
            cartons,
            weighingOrder: job,
            totalCartons: cartons.length,
            passCartons,
            failedCartons,
            remainingCartons,
            totalQty: cartons.reduce((sum, carton) => sum + cartonQty(carton), 0),
            passQty: cartons.filter((carton) => isPass(carton.weightStatus)).reduce((sum, carton) => sum + cartonQty(carton), 0),
            failedQty: cartons.filter((carton) => isFailed(carton.weightStatus)).reduce((sum, carton) => sum + cartonQty(carton), 0)
          };
        } catch {
          return null;
        }
      }))).filter(Boolean).sort((a, b) => String(a.po?.poNumber || '').localeCompare(String(b.po?.poNumber || '')));

      setPoOptions(options);
      setSelectedPoId((current) => {
        if (options.some((row) => row.poId === current)) return current;
        return options.find((row) => row.remainingCartons > 0 || row.failedCartons > 0)?.poId || options[0]?.poId || '';
      });
      return safeRows;
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      return [];
    } finally {
      setQueueLoading(false);
    }
  }, [orderId, selectedScheduleId]);

  const loadHistory = useCallback(async (weighingOrderId = selectedWeighingOrderId) => {
    if (!orderId || !weighingOrderId) {
      setHistory([]);
      return [];
    }
    try {
      const rows = await listWeightHistory(orderId, weighingOrderId);
      const safeRows = Array.isArray(rows) ? rows : [];
      setHistory(safeRows);
      return safeRows;
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      return [];
    }
  }, [orderId, selectedWeighingOrderId]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  useEffect(() => {
    setRunning(false);
    setWeighingOpen(false);
    clearActiveCarton(false);
    loadSchedules();
  }, [orderId, loadSchedules, clearActiveCarton]);

  useEffect(() => {
    if (!pendingTarget || pendingTarget.orderId !== orderId) return;
    if (shippingSchedules.some((row) => row?.schedule?.id === pendingTarget.scheduleId)) {
      setSelectedScheduleId(pendingTarget.scheduleId);
    }
  }, [pendingTarget, orderId, shippingSchedules]);

  useEffect(() => {
    if (!pendingTarget || pendingTarget.orderId !== orderId) return;
    if (selectedScheduleId !== pendingTarget.scheduleId) return;
    if (poOptions.some((row) => row.poId === pendingTarget.poId)) {
      setSelectedPoId(pendingTarget.poId);
      setPendingTarget(null);
    }
  }, [pendingTarget, orderId, selectedScheduleId, poOptions]);

  useEffect(() => {
    setRunning(false);
    setWeighingOpen(false);
    setSelectedPoId('');
    clearActiveCarton(false);
    loadQueue();
  }, [selectedScheduleId, loadQueue, clearActiveCarton]);

  useEffect(() => {
    setRunning(false);
    setWeighingOpen(false);
    clearActiveCarton(false);
    loadHistory();
  }, [selectedPoId, loadHistory, clearActiveCarton]);

  useEffect(() => {
    if (running && selectedPoId && !lookup) focusScanner();
  }, [running, selectedPoId, lookup, focusScanner]);

  useEffect(() => () => {
    if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
  }, []);

  // The PLC bridge posts a stable reading to the backend after an SSCC is active.
  // Poll the active queue job and react to the new PASS / FAILED result.
  useEffect(() => {
    const weighingOrderId = lookup?.weighingOrder?.id;
    const activeCartonId = lookup?.carton?.id;
    if (!weighingOrderId || !activeCartonId || !lookupStartedAt || !orderId) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const rows = await listWeightHistory(orderId, weighingOrderId);
        if (cancelled) return;
        const safeRows = Array.isArray(rows) ? rows : [];
        setHistory(safeRows);
        const rawEvent = safeRows.find((item) => (
          item.cartonId === activeCartonId
          && item.action === WEIGHT_ACTION.WEIGH
          && Date.parse(item.createdAt || '') >= lookupStartedAt - 1000
        ));
        if (!rawEvent) return;

        const event = { ...rawEvent, result: normalizeResult(rawEvent.result) };
        setLookupStartedAt(0);
        setLastResult(event);
        setNotice({
          severity: event.result === WEIGHING_RESULT.PASS ? 'success' : 'error',
          text: `Carton ${event.cartonNo ?? ''}: ${event.actualWeightKg ?? '—'} kg → ${event.result}.`
        });
        await Promise.all([loadQueue(), loadAssignments()]);

        if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
        resultTimerRef.current = window.setTimeout(
          () => clearActiveCarton(true),
          event.result === WEIGHING_RESULT.PASS ? 1300 : 2200
        );
      } catch {
        // Keep the active carton on screen while communication is temporarily unavailable.
      }
    };

    poll();
    const timer = window.setInterval(poll, 800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lookup, lookupStartedAt, orderId, loadQueue, loadAssignments, clearActiveCarton]);

  const startStation = async () => {
    if (!orderId || !selectedScheduleId || !selectedPo || busy || !mayWeigh || !stationCode.trim()) return;
    if (selectedPo.remainingCartons <= 0 && selectedPo.failedCartons <= 0) {
      setNotice({ severity: 'info', text: `PO ${selectedPo.po?.poNumber || ''} is already fully PASS.` });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      localStorage.setItem(STORAGE_KEY.WEIGHING_STATION_SSCC, stationCode.trim());
      await startWeighingPo(orderId, selectedPo.poId, stationCode.trim());
      clearActiveCarton(false);
      setRunning(true);
      setWeighingOpen(true);
      setNotice({ severity: 'success', text: `Station started for ${poLabel(selectedPo)}.` });
      await Promise.all([loadQueue(), loadAssignments()]);
      focusScanner();
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const stopStation = async () => {
    if (!selectedPo || busy) return;
    setBusy(true);
    try {
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
      await stopWeighingPo(orderId, selectedPo.poId);
      setRunning(false);
      setWeighingOpen(false);
      clearActiveCarton(false);
      setNotice({ severity: 'info', text: 'Station stopped. Select a PO and press START to continue.' });
      await Promise.all([loadQueue(), loadAssignments()]);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const completePo = async () => {
    if (!selectedPo || busy) return;
    if (selectedPo.remainingCartons > 0) {
      setNotice({ severity: 'warning', text: `${selectedPo.remainingCartons} carton(s) have not been weighed yet.` });
      return;
    }
    if (selectedPo.failedCartons > 0) {
      setNotice({ severity: 'error', text: `${selectedPo.failedCartons} carton(s) are FAILED. Resolve them before completing the PO.` });
      return;
    }
    setBusy(true);
    try {
      await completeWeighingPo(orderId, selectedPo.poId);
      setRunning(false);
      setWeighingOpen(false);
      clearActiveCarton(false);
      setNotice({
        severity: 'success',
        text: `PO ${selectedPo.po?.poNumber || ''} completed: ${selectedPo.passCartons}/${selectedPo.totalCartons} cartons PASS, ${selectedPo.passQty} pcs ready.`
      });
      await Promise.all([loadQueue(), loadAssignments()]);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const scanSscc = async () => {
    const value = sscc.trim();
    if (!running || !orderId || !selectedPoId || !value || busy || !mayWeigh || lookup) return;
    setBusy(true);
    setNotice(null);
    setLastResult(null);
    try {
      const result = await lookupWeighingSsccForPo(orderId, selectedPoId, value);
      if (result?.po?.id !== selectedPoId) {
        const scannedLabel = [result?.po?.poNumber, result?.po?.style, result?.po?.color, result?.po?.size, result?.po?.salesOrderPts].filter(Boolean).join(' · ');
        throw new Error(`This SSCC belongs to another PO${scannedLabel ? ` (${scannedLabel})` : ''}. Select the correct PO before weighing.`);
      }
      setLookup(result);
      setLookupStartedAt(Date.now());
      setActualWeight('');
      setNotice({ severity: 'info', text: result.message || APP_MESSAGES.SSCC_ACCEPTED });
      await loadHistory(result.weighingOrder?.id);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      setSscc('');
      focusScanner();
    } finally {
      setBusy(false);
    }
  };

  const submitManualWeight = async () => {
    const weighingOrderId = lookup?.weighingOrder?.id;
    if (!lookup || !weighingOrderId || !actualWeight || !stationCode.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      localStorage.setItem(STORAGE_KEY.WEIGHING_STATION_SSCC, stationCode.trim());
      const result = await submitWeightApi(orderId, weighingOrderId, {
        sscc: lookup.carton?.sscc18 || lookup.carton?.sscc || sscc,
        actualWeightKg: Number(actualWeight),
        stationCode: stationCode.trim(),
        stable: true,
        source: WEIGHT_SOURCE.MANUAL
      });
      const event = { ...result.event, result: normalizeResult(result.event?.result) };
      setLastResult(event);
      setLookupStartedAt(0);
      setNotice({
        severity: event?.result === WEIGHING_RESULT.PASS ? 'success' : 'error',
        text: result.message
      });
      await Promise.all([loadQueue(), loadAssignments()]);
      await loadHistory(weighingOrderId);
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = window.setTimeout(
        () => clearActiveCarton(true),
        event?.result === WEIGHING_RESULT.PASS ? 1300 : 2200
      );
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const reopenWeight = async (event) => {
    const weighingOrderId = event.weighingOrderId || selectedWeighingOrderId;
    const reason = window.prompt(createReweighReasonMessage(event.cartonNo), APP_MESSAGES.DEFAULT_SUPERVISOR_REASON);
    if (!reason || reason.trim().length < 3 || !weighingOrderId) return;
    setBusy(true);
    try {
      await reopenWeightApi(orderId, weighingOrderId, event.cartonId, reason.trim());
      await Promise.all([loadQueue(), loadAssignments()]);
      await loadHistory(weighingOrderId);
      setRunning(false);
      clearActiveCarton(false);
      setNotice({ severity: 'success', text: `${createCartonReweighOpenMessage(event.cartonNo)} Press START before weighing it again.` });
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const overridePass = async (event) => {
    const weighingOrderId = event.weighingOrderId || selectedWeighingOrderId;
    const reason = window.prompt(createOverridePassReasonMessage(event.cartonNo), APP_MESSAGES.DEFAULT_SUPERVISOR_REASON);
    if (!reason || reason.trim().length < 3 || !weighingOrderId) return;
    setBusy(true);
    try {
      await overrideWeightPassApi(orderId, weighingOrderId, event.cartonId, reason.trim());
      setNotice({ severity: 'success', text: createOverridePassSuccessMessage(event.cartonNo) });
      await Promise.all([loadQueue(), loadAssignments()]);
      await loadHistory(weighingOrderId);
      clearActiveCarton(running);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const decisionEvents = useMemo(() => {
    if (!selectedPoId) return [];
    const latest = new Map();
    history.forEach((raw) => {
      if (raw.poId !== selectedPoId || !raw.cartonId || latest.has(raw.cartonId)) return;
      latest.set(raw.cartonId, raw);
    });
    return Array.from(latest.values())
      .filter((event) => event.action !== WEIGHT_ACTION.REOPEN)
      .map((event) => ({ ...event, result: normalizeResult(event.result) }))
      .filter((event) => [WEIGHING_RESULT.PASS, WEIGHING_RESULT.FAILED].includes(event.result));
  }, [history, selectedPoId]);

  const passRows = useMemo(
    () => decisionEvents.filter((event) => event.result === WEIGHING_RESULT.PASS),
    [decisionEvents]
  );
  const failedRows = useMemo(
    () => decisionEvents.filter((event) => event.result === WEIGHING_RESULT.FAILED),
    [decisionEvents]
  );

  const expected = Number(lookup?.expectedWeightKg);
  const tolerance = Number(lookup?.profile?.toleranceKg);
  const minWeight = Number.isFinite(expected) && Number.isFinite(tolerance) ? expected - tolerance : null;
  const maxWeight = Number.isFinite(expected) && Number.isFinite(tolerance) ? expected + tolerance : null;
  const actual = lastResult?.actualWeightKg;
  const activeResult = normalizeResult(lastResult?.result);
  const processed = selectedPo ? selectedPo.passCartons + selectedPo.failedCartons : 0;
  const poSessionCompleted = selectedPo?.po?.weighingSessionStatus === 'COMPLETED';
  const canComplete = Boolean(selectedPo && !poSessionCompleted && selectedPo.totalCartons > 0 && selectedPo.remainingCartons === 0 && selectedPo.failedCartons === 0);

  const stationState = activeResult
    ? activeResult
    : lookup
      ? 'WAITING FOR STABLE WEIGHT'
      : running
        ? 'RUNNING'
        : 'STOPPED';

  const resultTable = (title, result, rows) => {
    const failed = result === WEIGHING_RESULT.FAILED;
    const qty = rows.reduce((sum, row) => sum + num(row.cartonQty), 0);
    return (
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <Box sx={{ px: 1.2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.8} alignItems="center">
              {failed ? <ErrorOutline color="error" /> : <CheckCircleOutline color="success" />}
              <Typography fontWeight={950} color={failed ? 'error.main' : 'success.main'}>{title}</Typography>
            </Stack>
            <Typography variant="body2" fontWeight={850}>{rows.length} carton(s) · {qty} pcs</Typography>
          </Stack>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport sx={{ maxHeight: 330 }}>
            <SortableTable stickyHeader size="small">
              <TableHead><TableRow>
                <TableCell>Time</TableCell><TableCell>Carton</TableCell><TableCell>SSCC</TableCell><TableCell>Qty</TableCell><TableCell>Target</TableCell><TableCell>Actual</TableCell><TableCell>Diff</TableCell><TableCell>Station</TableCell><TableCell data-sortable={false}>Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {rows.map((event) => (
                  <TableRow key={event.id} hover>
                    <TableCell>{event.createdAt || '—'}</TableCell>
                    <TableCell>{event.cartonNo ?? '—'}</TableCell>
                    <TableCell>{event.sscc18 || '—'}</TableCell>
                    <TableCell>{event.cartonQty ?? '—'}</TableCell>
                    <TableCell>{event.expectedWeightKg ?? '—'}</TableCell>
                    <TableCell>{event.actualWeightKg ?? '—'}</TableCell>
                    <TableCell>{event.differenceKg ?? '—'}</TableCell>
                    <TableCell>{event.stationCode || '—'}</TableCell>
                    <TableCell>
                      {admin ? (
                        <Stack direction="row" spacing={0.4}>
                          {failed ? <Button size="small" color="error" startIcon={<GppGood />} onClick={() => overridePass(event)} disabled={busy}>Override PASS</Button> : null}
                          <Button size="small" startIcon={<Undo />} onClick={() => reopenWeight(event)} disabled={busy}>Re-weigh</Button>
                        </Stack>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No {title.toLowerCase()} cartons for this PO.</TableCell></TableRow> : null}
              </TableBody>
            </SortableTable>
          </LululemonTableViewport>
        </Box>
        <Stack spacing={0.7} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
          {rows.map((event) => (
            <Paper key={event.id} variant="outlined" sx={{ p: 0.9, borderRadius: 1.6 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={950}>Carton {event.cartonNo ?? '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">{event.createdAt || '—'} · Station {event.stationCode || '—'}</Typography>
                </Box>
                <Chip size="small" color={failed ? 'error' : 'success'} label={failed ? 'FAILED' : 'PASS'} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.45, wordBreak: 'break-all' }}>SSCC {event.sscc18 || '—'}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 0.55, mt: 0.7 }}>
                {[[ 'Qty', event.cartonQty ], [ 'Target', event.expectedWeightKg ], [ 'Actual', event.actualWeightKg ], [ 'Diff', event.differenceKg ]].map(([label, value]) => (
                  <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={900}>{value ?? '—'}</Typography></Box>
                ))}
              </Box>
              {admin ? (
                <Stack direction="row" spacing={0.7} sx={{ mt: 0.85 }}>
                  {failed ? <Button fullWidth color="error" variant="outlined" startIcon={<GppGood />} onClick={() => overridePass(event)} disabled={busy} sx={{ minHeight: 46 }}>Override</Button> : null}
                  <Button fullWidth variant="outlined" startIcon={<Undo />} onClick={() => reopenWeight(event)} disabled={busy} sx={{ minHeight: 46 }}>Re-weigh</Button>
                </Stack>
              ) : null}
            </Paper>
          ))}
          {!rows.length ? <Typography align="center" color="text.secondary" sx={{ py: 3 }}>No {title.toLowerCase()} cartons for this PO.</Typography> : null}
        </Stack>
      </Paper>
    );
  };

  return (
    <Stack spacing={0.85} sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader
        dense
        title="Carton Weight"
        subtitle="Packing-confirmed Shipping Lists appear here first. Find/scan SSCC-18 → open its assignment → START → stable weight → PASS / FAILED → COMPLETE."
        actions={<Button size="small" startIcon={<Refresh />} onClick={() => { loadAssignments(); loadSchedules(); loadQueue(); loadHistory(); }} disabled={queueLoading || busy}>Refresh</Button>}
      />

      <Paper variant="outlined" sx={{ p: 0.85, borderRadius: 2 }}>
        <Stack spacing={1}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.8} alignItems={{ lg: 'center' }} justifyContent="space-between">
            <Box>
              <Typography fontWeight={950}>Assigned Cartons</Typography>
              <Typography variant="caption" color="text.secondary">
                This is the default Carton Weight queue confirmed by Packing. Search by Order No., Factory, Shipping List or Date.
              </Typography>
            </Box>
            <Chip size="small" color="primary" variant="outlined" label={`${filteredAssignments.length} / ${assignments.length} carton(s)`} />
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))', xl: 'repeat(4, minmax(150px,1fr))' }, gap: 0.75 }}>
            <TextField size="small" label="Order No." value={assignmentFilters.orderNo} onChange={(e) => setAssignmentFilters((current) => ({ ...current, orderNo: e.target.value }))} />
            <TextField size="small" label="Factory" value={assignmentFilters.factory} onChange={(e) => setAssignmentFilters((current) => ({ ...current, factory: e.target.value }))} />
            <TextField size="small" label="Shipping List" value={assignmentFilters.shippingList} onChange={(e) => setAssignmentFilters((current) => ({ ...current, shippingList: e.target.value }))} />
            <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={assignmentFilters.shippingDate} onChange={(e) => setAssignmentFilters((current) => ({ ...current, shippingDate: e.target.value }))} />
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} alignItems={{ md: 'center' }}>
            <TextField
              size="small"
              fullWidth
              label="Scan SSCC-18 to find Shipping assignment"
              placeholder="Scan SSCC-18 and press Enter"
              value={findSscc}
              onChange={(e) => setFindSscc(e.target.value.replace(/\s+/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  findAssignmentBySscc();
                }
              }}
              InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment> }}
              disabled={busy || !mayWeigh}
            />
            <Button variant="contained" startIcon={<Search />} onClick={findAssignmentBySscc} disabled={!findSscc.trim() || busy || !mayWeigh} sx={{ minWidth: 120, minHeight: { xs: 48, md: 'auto' } }}>Find</Button>
            <Button variant="text" onClick={() => setAssignmentFilters({ orderNo: '', factory: '', shippingList: '', shippingDate: '' })}>Clear</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2.4, overflow: 'hidden' }}>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport sx={{ maxHeight: 360 }}>
            <SortableTable stickyHeader size="small">
              <TableHead><TableRow>
                <TableCell>Order No.</TableCell><TableCell>Factory</TableCell><TableCell>Shipping List</TableCell><TableCell>Date</TableCell><TableCell>PO</TableCell><TableCell>Style / Color / Size</TableCell><TableCell>SKU</TableCell><TableCell>Carton</TableCell><TableCell>SSCC-18</TableCell><TableCell>Weight</TableCell><TableCell data-sortable={false} align="right">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {filteredAssignments.map((row) => (
                  <TableRow key={`${row.weighingOrderId}-${row.cartonId}`} hover sx={{ cursor: 'pointer' }} onClick={() => openAssignment(row)}>
                    <TableCell><Typography fontWeight={900}>{row.orderNo || '—'}</Typography></TableCell><TableCell>{row.factoryCode || '—'}</TableCell><TableCell><Typography fontWeight={850}>{row.shippingList || '—'}</Typography></TableCell><TableCell>{row.shippingDate || '—'}</TableCell><TableCell>{row.poNumber || '—'}</TableCell><TableCell><Typography variant="body2" fontWeight={800}>{row.style || '—'}</Typography><Typography variant="caption" color="text.secondary">{row.color || '—'} · Size {row.size || '—'}</Typography></TableCell><TableCell>{row.sku || '—'}</TableCell><TableCell>{row.cartonNo ?? '—'}</TableCell><TableCell>{row.sscc18 || '—'}</TableCell><TableCell><Chip size="small" color={isPass(row.weightStatus) ? 'success' : isFailed(row.weightStatus) ? 'error' : 'default'} label={row.weightStatus || 'WAITING'} /></TableCell><TableCell align="right"><Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); openAssignment(row); }}>Open</Button></TableCell>
                  </TableRow>
                ))}
                {!filteredAssignments.length ? <TableRow><TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary' }}>{assignmentLoading ? 'Loading assigned cartons...' : 'No cartons match the current Carton Weight filters.'}</TableCell></TableRow> : null}
              </TableBody>
            </SortableTable>
          </LululemonTableViewport>
        </Box>
        <Stack spacing={0.75} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
          {filteredAssignments.map((row) => (
            <Paper key={`${row.weighingOrderId}-${row.cartonId}`} variant="outlined" sx={{ p: 1, borderRadius: 1.7 }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}><Typography fontWeight={950}>Carton {row.cartonNo ?? '—'}</Typography><Typography variant="body2" fontWeight={850}>PO {row.poNumber || '—'} · SKU {row.sku || '—'}</Typography><Typography variant="caption" color="text.secondary">{row.shippingList || '—'} · {row.factoryCode || '—'} · {row.shippingDate || '—'}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Style {row.style || '—'} · Color {row.color || '—'} · Size {row.size || '—'}</Typography></Box>
                <Chip size="small" color={isPass(row.weightStatus) ? 'success' : isFailed(row.weightStatus) ? 'error' : 'default'} label={row.weightStatus || 'WAITING'} />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.55, wordBreak: 'break-all' }}>SSCC {row.sscc18 || '—'} · Order {row.orderNo || '—'}</Typography>
              <Button fullWidth variant="contained" onClick={() => openAssignment(row)} sx={{ mt: 0.8, minHeight: 48 }}>Open Weighing</Button>
            </Paper>
          ))}
          {!filteredAssignments.length ? <Typography align="center" color="text.secondary" sx={{ py: 3 }}>{assignmentLoading ? 'Loading assigned cartons...' : 'No cartons match the current Carton Weight filters.'}</Typography> : null}
        </Stack>
      </Paper>

      <OrderScope
        value={orderId}
        onChange={(value) => {
          setOrderId(value);
          setQueue([]);
          setShippingSchedules([]);
          setSelectedScheduleId('');
          setPoOptions([]);
          setSelectedPoId('');
          setHistory([]);
          setNotice(null);
          setRunning(false);
          setWeighingOpen(false);
          setPendingTarget(null);
          clearActiveCarton(false);
        }}
        disabled={busy || running}
      />

      <Paper variant="outlined" sx={{ p: 0.85, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.9} alignItems={{ lg: 'center' }}>
          <TextField
            select
            size="small"
            label={`Shipping Schedule · ${factoryScopeLabel}`}
            value={selectedScheduleId}
            onChange={(e) => { setSelectedScheduleId(e.target.value); setSelectedPoId(''); }}
            disabled={!orderId || running || busy}
            sx={{ minWidth: { xs: '100%', lg: 430 } }}
            helperText={selectedSchedule ? `Factory ${selectedSchedule.schedule.factoryCode} · Shipping Date ${selectedSchedule.schedule.exFtyDate} · ${selectedSchedule.schedule.status}` : `Only schedules assigned to your Factory scope are shown: ${factoryScopeLabel}`}
          >
            {!shippingSchedules.length ? <MenuItem value="" disabled>No schedule assigned to {factoryScopeLabel}</MenuItem> : null}
            {shippingSchedules.map((row) => (
              <MenuItem key={row.schedule.id} value={row.schedule.id}>
                {row.schedule.scheduleNo} · {row.schedule.factoryCode} · {row.schedule.exFtyDate} · PASS {row.passCartons}/{row.totalCartons}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Purchase Order"
            value={selectedPoId}
            onChange={(e) => setSelectedPoId(e.target.value)}
            disabled={!orderId || !selectedScheduleId || queueLoading || running || busy}
            sx={{ minWidth: { xs: '100%', lg: 560 }, flex: 1 }}
            helperText={selectedPo ? `SKU ${selectedPo.po?.sku || '—'} · ${selectedPo.totalCartons} cartons · ${selectedPo.totalQty} pcs` : 'Select a PO inside the selected Shipping Schedule'}
          >
            {poOptions.map((row) => (
              <MenuItem key={row.poId} value={row.poId}>{poLabel(row)}</MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Station"
            value={stationCode}
            onChange={(e) => setStationCode(e.target.value)}
            onBlur={() => localStorage.setItem(STORAGE_KEY.WEIGHING_STATION_SSCC, stationCode.trim())}
            disabled={running || busy}
            sx={{ width: { xs: '100%', lg: 150 } }}
          />

          <Button
            variant="contained"
            color="success"
            startIcon={<PlayArrow />}
            onClick={startStation}
            disabled={!selectedScheduleId || !selectedPo || poSessionCompleted || running || busy || !mayWeigh || (selectedPo.remainingCartons <= 0 && selectedPo.failedCartons <= 0)}
            sx={{ minWidth: 150, minHeight: { xs: 50, md: 'auto' }, width: { xs: '100%', lg: 'auto' } }}
          >
            START WEIGHING
          </Button>
          {running ? (
            <Button variant="outlined" startIcon={<ScaleOutlined />} onClick={() => setWeighingOpen(true)} disabled={busy} sx={{ minWidth: 150, minHeight: { xs: 48, md: 'auto' }, width: { xs: '100%', lg: 'auto' } }}>
              Open Weighing Window
            </Button>
          ) : null}
          {poSessionCompleted ? <Chip size="small" color="success" label="COMPLETED" /> : null}
          {queueLoading ? <CircularProgress size={20} /> : null}
        </Stack>
      </Paper>

      {notice && !weighingOpen ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

      {selectedPo?.failedCartons > 0 ? (
        <Alert severity="error">{selectedPo.failedCartons} carton(s) are FAILED. Re-weigh or resolve them before COMPLETE.</Alert>
      ) : null}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(5, minmax(0,1fr))' }, gap: 1 }}>
        {[
          ['TOTAL', selectedPo?.totalCartons || 0, 'text.primary'],
          ['SCANNED', processed, 'primary.main'],
          ['PASS', selectedPo?.passCartons || 0, 'success.main'],
          ['FAILED', selectedPo?.failedCartons || 0, 'error.main'],
          ['REMAINING', selectedPo?.remainingCartons || 0, 'text.secondary']
        ].map(([label, value, color]) => (
          <Paper key={label} variant="outlined" sx={{ px: 1, py: 0.75, borderRadius: 1.7 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={850}>{label}</Typography>
            <Typography variant="h4" fontWeight={950} sx={{ color, lineHeight: 1.05 }}>{value}</Typography>
          </Paper>
        ))}
      </Box>

      <OperationWorkspaceDialog
        open={weighingOpen}
        onClose={() => setWeighingOpen(false)}
        disableClose={running}
        title={selectedPo ? `Carton Weighing · PO ${selectedPo.po?.poNumber || '—'}` : 'Carton Weighing'}
        subtitle={selectedSchedule ? `${selectedSchedule.schedule?.scheduleNo || 'Shipping List'} · Factory ${selectedSchedule.schedule?.factoryCode || '—'} · ${selectedSchedule.schedule?.exFtyDate || '—'}` : 'Dedicated weighing workspace'}
        actions={(
          <>
            <Chip
              size="small"
              icon={<Sensors />}
              label={stationState}
              color={activeResult === WEIGHING_RESULT.PASS ? 'success' : activeResult === WEIGHING_RESULT.FAILED ? 'error' : running ? 'info' : 'default'}
            />
            <Button size="small" variant="contained" color="error" startIcon={<Stop />} onClick={stopStation} disabled={!running || busy}>
              STOP
            </Button>
            <Button size="small" variant="outlined" startIcon={<TaskAlt />} onClick={completePo} disabled={!canComplete || busy}>
              {poSessionCompleted ? 'COMPLETED' : 'COMPLETE'}
            </Button>
          </>
        )}
      >
        <Stack spacing={0.9}>
          {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 1.4, py: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Box>
              <Typography fontWeight={950}>Active Weighing Station</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedPo ? poLabel(selectedPo) : 'Select an Order and PO, then press START.'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.7} alignItems="center">
              <Chip
                size="small"
                icon={<Sensors />}
                label={stationState}
                color={activeResult === WEIGHING_RESULT.PASS ? 'success' : activeResult === WEIGHING_RESULT.FAILED ? 'error' : running ? 'info' : 'default'}
              />
              <Chip size="small" variant="outlined" label={`Station ${stationCode || '—'}`} />
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 0.9, md: 1.05 } }}>
          <Typography variant="caption" color="text.secondary" fontWeight={900}>SCAN CARTON SSCC-18</Typography>
          <TextField
            inputRef={scanRef}
            fullWidth
            placeholder={!running ? 'Press START before scanning' : lookup ? 'Carton locked — waiting for stable weight' : 'Scan SSCC-18 and press Enter'}
            value={sscc}
            onChange={(e) => setSscc(e.target.value.replace(/\s+/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                scanSscc();
              }
            }}
            disabled={!running || !selectedPoId || busy || !mayWeigh || Boolean(lookup)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color={running && !lookup ? 'primary' : 'disabled'} /></InputAdornment>,
              sx: { fontSize: 22, fontWeight: 850, letterSpacing: 1.1 }
            }}
            sx={{ mt: 0.5, '& .MuiOutlinedInput-root': { minHeight: { xs: 56, md: 48 } } }}
          />

          <Divider sx={{ my: 0.9 }} />

          {!lookup ? (
            <Box sx={{ minHeight: 190, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <Box>
                {running ? <QrCodeScannerOutlined sx={{ fontSize: 58, color: 'primary.light' }} /> : <Stop sx={{ fontSize: 58, color: 'text.disabled' }} />}
                <Typography variant="h6" fontWeight={950} sx={{ mt: 0.5 }}>{running ? 'Ready for SSCC scan' : 'Station stopped'}</Typography>
                <Typography color="text.secondary">
                  {running ? 'Scan one carton SSCC. The system will verify it belongs to the selected logical PO.' : 'Select the PO and press START to begin weighing.'}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Stack spacing={1.3}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, minmax(0, 1fr))' }, gap: 0.8 }}>
                {[
                  ['PO', lookup.po?.poNumber || '—'],
                  ['SKU', lookup.po?.sku || '—'],
                  ['Style', lookup.po?.style || '—'],
                  ['Color', lookup.po?.color || '—'],
                  ['Size', lookup.po?.size || '—'],
                  ['Carton', lookup.carton?.cartonNo ?? '—'],
                  ['Qty', lookup.carton?.scannedQty || lookup.carton?.plannedQty || 0],
                  ['GW kg/pc', lookup.profile?.unitWeightKg ?? lookup.po?.grossWeightKg ?? '—']
                ].map(([label, value]) => (
                  <Box key={label} sx={{ p: 0.9, border: '1px solid', borderColor: 'divider', borderRadius: 1.3 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={750}>{label}</Typography>
                    <Typography fontWeight={900} noWrap>{value}</Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 1.4fr' }, gap: 1 }}>
                <Box sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.8 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={900}>WEIGHT STANDARD</Typography>
                  <Stack spacing={0.65} sx={{ mt: 0.7 }}>
                    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Target</Typography><Typography fontWeight={900}>{kg(expected)} kg</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Minimum</Typography><Typography fontWeight={850}>{minWeight == null ? '—' : `${kg(minWeight)} kg`}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Maximum</Typography><Typography fontWeight={850}>{maxWeight == null ? '—' : `${kg(maxWeight)} kg`}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Tolerance</Typography><Typography fontWeight={850}>± {kg(tolerance)} kg</Typography></Stack>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    p: 1.3,
                    border: '2px solid',
                    borderColor: activeResult === WEIGHING_RESULT.PASS ? 'success.main' : activeResult === WEIGHING_RESULT.FAILED ? 'error.main' : 'primary.light',
                    borderRadius: 2,
                    textAlign: 'center',
                    bgcolor: activeResult === WEIGHING_RESULT.PASS ? 'success.lighter' : activeResult === WEIGHING_RESULT.FAILED ? 'error.lighter' : 'background.paper'
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={950}>ACTUAL WEIGHT</Typography>
                  <Typography sx={{ fontSize: { xs: 58, md: 82 }, lineHeight: 0.98, fontWeight: 950, letterSpacing: -2, my: 0.6 }}>
                    {actual == null ? '—' : kg(actual, 3)}
                  </Typography>
                  <Typography variant="h6" fontWeight={900}>KG</Typography>
                  {activeResult ? (
                    <Chip
                      sx={{ mt: 0.8, fontSize: 20, fontWeight: 950, px: 1.4 }}
                      icon={activeResult === WEIGHING_RESULT.PASS ? <CheckCircleOutline /> : <ErrorOutline />}
                      color={activeResult === WEIGHING_RESULT.PASS ? 'success' : 'error'}
                      label={activeResult}
                    />
                  ) : (
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.8} sx={{ mt: 0.8 }}>
                      <CircularProgress size={17} />
                      <Typography fontWeight={850} color="primary.main">Waiting for PLC / scale stable weight...</Typography>
                    </Stack>
                  )}
                </Box>
              </Box>

              {!activeResult ? (
                <Box>
                  <Button size="small" variant="text" startIcon={<ScaleOutlined />} onClick={() => setManualOpen((value) => !value)}>
                    {manualOpen ? 'Hide manual fallback' : 'Manual fallback'}
                  </Button>
                  {manualOpen ? (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} sx={{ mt: 0.6 }}>
                      <TextField size="small" type="number" label="Actual Weight (kg)" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} inputProps={{ step: '0.001', min: 0 }} />
                      <Button variant="outlined" color="success" disabled={busy || !actualWeight || !stationCode.trim()} onClick={submitManualWeight} sx={{ minHeight: { xs: 48, md: 'auto' } }}>Submit Stable Weight</Button>
                    </Stack>
                  ) : null}
                </Box>
              ) : null}
            </Stack>
          )}
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.1 }}>
        {resultTable('PASS', WEIGHING_RESULT.PASS, passRows)}
        {resultTable('FAILED', WEIGHING_RESULT.FAILED, failedRows)}
      </Box>

      {selectedPo ? (
        <Paper variant="outlined" sx={{ p: 1.1, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.3} justifyContent="space-between" alignItems={{ md: 'center' }}>
            <Box>
              <Typography fontWeight={950}>PO Weighing Summary</Typography>
              <Typography variant="body2" color="text.secondary">{poLabel(selectedPo)}</Typography>
            </Box>
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              <Typography variant="body2"><b>Total Qty:</b> {selectedPo.totalQty} pcs</Typography>
              <Typography variant="body2" color="success.main"><b>PASS Qty:</b> {selectedPo.passQty} pcs</Typography>
              <Typography variant="body2" color="error.main"><b>FAILED Qty:</b> {selectedPo.failedQty} pcs</Typography>
              <Typography variant="body2"><b>Scanned:</b> {processed}/{selectedPo.totalCartons} cartons</Typography>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

        </Stack>
      </OperationWorkspaceDialog>

      {!mayWeigh ? <Alert severity="info" icon={<CheckCircleOutline />}>Weight Check permission is required to operate the weighing station.</Alert> : null}
      {!queueLoading && orderId && !queue.length ? <Alert severity="info">No Shipping Schedule has been released to Carton Weight for this Order, or the selected schedule has no weighing queue.</Alert> : null}
    </Stack>
  );
}
