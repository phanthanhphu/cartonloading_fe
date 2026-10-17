import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  CheckCircleOutline,
  ErrorOutline,
  GppGood,
  QrCodeScannerOutlined,
  Refresh,
  Search,
  Sensors,
  Stop,
  TaskAlt,
  Undo,
  ArrowBackRounded,
  DeleteForeverOutlined,
  ChevronRightRounded
} from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { CompactPageHeader } from '../components/LululemonPageHeader';
import StatusChip from 'components/StatusChip';
import CartonRfidPanel from '../components/CartonRfidPanel';
import { getFinalCartonStatus } from '../utils/finalCartonStatus';
import { CONVEYOR_POSITION, requestConveyorPosition } from '../services/conveyorAdapter';
import { canWeighFactory, canManageSales, canWeightCheck, getWeighingFactoryPermissions, isAdmin } from 'utils/accessControl';
import { listCartonItems } from '../services/packing';
import { getLululemonTestCleanupStatus, purgeLululemonTestOrder } from '../services/testCleanup';
import { getManagedOrder, listManagedOrders } from 'services/managementService';
import {
  completeWeighingPo,
  getCartonRfidSession,
  startCartonRfidSession,
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
  BUYER_CODE,
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
const normalizedSscc = (raw) => {
  let code = String(raw || '').trim().replace(/^\]C1|^\]d2/, '').replace(/^\(00\)/, '');
  code = code.replace(/[^0-9]/g, '');
  if (/^00[0-9]{18}$/.test(code)) code = code.slice(2);
  return /^[0-9]{18}$/.test(code) ? code : '';
};
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
  const { search } = useLocation();
  const selectedFactory = new URLSearchParams(search).get('factory')?.toUpperCase() || '';
  const [orderId, setOrderId] = useState('');
  const [level, setLevel] = useState('shipping'); // shipping -> pos -> cartons (inspection only)
  const [managedOrders, setManagedOrders] = useState([]);
  const [listPage, setListPage] = useState(0);
  const [listRowsPerPage, setListRowsPerPage] = useState(10);
  const [activeStationPoIds, setActiveStationPoIds] = useState([]);
  const [openedCartonId, setOpenedCartonId] = useState('');
  const [itemsCartonId, setItemsCartonId] = useState('');
  const [cartonItems, setCartonItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [cleanupEnabled, setCleanupEnabled] = useState(false);
  const [cleanupOrder, setCleanupOrder] = useState(null);
  const [cleanupConfirmation, setCleanupConfirmation] = useState('');
  const [selectedOrderName, setSelectedOrderName] = useState('');
  const [queue, setQueue] = useState([]);
  const [shippingSchedules, setShippingSchedules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentFiltersOpen, setAssignmentFiltersOpen] = useState(false);
  const [assignmentFilters, setAssignmentFilters] = useState({ orderNo: '', factory: '', shippingList: '', shippingDate: '' });
  const [findSscc, setFindSscc] = useState('');
  const [pendingTarget, setPendingTarget] = useState(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [poOptions, setPoOptions] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [running, setRunning] = useState(false);
  const [conveyorPosition, setConveyorPosition] = useState(CONVEYOR_POSITION.IDLE);
  const [weighingOpen, setWeighingOpen] = useState(false);
  const [confirmCompletionOpen, setConfirmCompletionOpen] = useState(false);
  const [sscc, setSscc] = useState('');
  const [lookup, setLookup] = useState(null);
  const [lookupStartedAt, setLookupStartedAt] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [rfidResult, setRfidResult] = useState(null);
  const [actualWeight, setActualWeight] = useState('');
  const [stationCode, setStationCode] = useState(
    () => localStorage.getItem(STORAGE_KEY.WEIGHING_STATION_SSCC) || DEFAULT_SCALE_STATION
  );
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const scanRef = useRef(null);
  const resultTimerRef = useRef(null);
  // One automatic RFID handoff per persisted weight event (PLC may report repeatedly).
  const handoffAttemptKeyRef = useRef(null);
  const [handoffError, setHandoffError] = useState('');

  const mayWeigh = canWeightCheck();
  const admin = isAdmin();
  const unrestrictedFactoryView = admin || canManageSales();
  const userFactories = useMemo(() => getWeighingFactoryPermissions(), []);
  const factoryScopeLabel = unrestrictedFactoryView ? 'ALL FACTORIES' : (userFactories.length ? userFactories.join(', ') : 'NO FACTORY ASSIGNED');

  const filteredAssignments = useMemo(() => {
    const lower = (value) => String(value || '').trim().toLowerCase();
    const orderKey = lower(assignmentFilters.orderNo);
    const factoryKey = lower(assignmentFilters.factory);
    const shippingKey = lower(assignmentFilters.shippingList);
    const dateKey = String(assignmentFilters.shippingDate || '').trim();
    return assignments.filter((row) => {
      if (selectedFactory && lower(row.factoryCode) !== lower(selectedFactory)) return false;
      if (orderKey && !lower(row.orderNo).includes(orderKey)) return false;
      if (factoryKey && !lower(row.factoryCode).includes(factoryKey)) return false;
      if (shippingKey && !`${lower(row.shippingName)} ${lower(row.shippingList)} ${lower(row.orderNo)}`.includes(shippingKey)) return false;
      if (dateKey && String(row.shippingDate || '') !== dateKey) return false;
      return true;
    });
  }, [assignments, assignmentFilters, selectedFactory]);

  const shippingGroups = useMemo(() => {
    const groups = new Map();
    filteredAssignments.forEach((row) => {
      if (!row.shippingScheduleId || !row.orderId) return;
      const key = `${row.orderId}:${row.shippingScheduleId}`;
      if (!groups.has(key)) groups.set(key, { ...row, cartons: [], poKeys: new Set() });
      const group = groups.get(key);
      group.cartons.push(row);
      group.poKeys.add(row.poId);
    });
    return [...groups.values()].sort((a, b) =>
      String(b.shippingDate || '').localeCompare(String(a.shippingDate || '')) ||
      String(a.shippingName || a.shippingList || '').localeCompare(String(b.shippingName || b.shippingList || ''))
    );
  }, [filteredAssignments]);

  const orderPoGroups = useMemo(() => {
    const groups = new Map();
    assignments.filter((row) => row.orderId === orderId && row.shippingScheduleId === selectedScheduleId).forEach((row) => {
      if (!groups.has(row.poId)) groups.set(row.poId, { ...row, cartons: [] });
      groups.get(row.poId).cartons.push(row);
    });
    return [...groups.values()].sort((a, b) => String(a.poNumber).localeCompare(String(b.poNumber)));
  }, [assignments, orderId, selectedScheduleId]);

  const selectedCartonAssignments = useMemo(() => assignments.filter((row) =>
    row.orderId === orderId && row.shippingScheduleId === selectedScheduleId && row.poId === selectedPoId
  ).sort((a, b) => Number(a.cartonNo || 0) - Number(b.cartonNo || 0)),
  [assignments, orderId, selectedScheduleId, selectedPoId]);

  const displayedList = level === 'shipping' ? shippingGroups : level === 'pos' ? orderPoGroups : selectedCartonAssignments;
  const safeListPage = Math.min(listPage, Math.max(0, Math.ceil(displayedList.length / listRowsPerPage) - 1));
  const pagedList = displayedList.slice(safeListPage * listRowsPerPage, (safeListPage + 1) * listRowsPerPage);
  useEffect(() => { setListPage(0); }, [level, orderId, selectedScheduleId, listRowsPerPage, assignmentFilters.shippingList]);

  const loadManagedOrders = useCallback(async () => {
    const all = [];
    try {
      for (let page = 0; page < 60; page += 1) {
        const data = await listManagedOrders(BUYER_CODE.LULULEMON, { page, size: 100 });
        all.push(...(data?.content || []));
        if (data?.last || !(data?.content || []).length || page + 1 >= Number(data?.totalPages || 0)) break;
      }
      setManagedOrders(all);
      return all;
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      return [];
    }
  }, []);

  const openShippingFromList = (row) => {
    setOrderId(row.orderId);
    setSelectedScheduleId(row.shippingScheduleId);
    setSelectedPoId('');
    setLevel('pos');
  };

  const openPoFromList = (row) => {
    setItemsCartonId('');
    setCartonItems([]);
    setOpenedCartonId('');
    setSelectedPoId(row.poId);
    setLevel('cartons');
  };

  const toggleCartonItems = async (row) => {
    if (itemsCartonId === row.cartonId) { setItemsCartonId(''); return; }
    setItemsCartonId(row.cartonId);
    setCartonItems([]);
    setItemsLoading(true);
    try {
      const rows = await listCartonItems(row.orderId, row.cartonId);
      setCartonItems(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setNotice({ severity: 'error', text: `Cannot load carton items: ${errorText(error)}` });
    } finally {
      setItemsLoading(false);
    }
  };

  // Carton-level RFID review/rescan must be reachable from the carton table,
  // even when Weight has already passed. Do not touch the stored weight PASS.
  // Backend enforces buyer/factory access and only permits FAILED or ongoing
  // SCANNING sessions; PASS needs supervisor's existing /reopen permission.
  const openCartonWorkspace = async (row) => {
    if (running || busy || !mayWeigh || !isPass(row.weightStatus) || row.rfidStatus === 'PASS') return;
    const targetSscc = row.sscc18 || row.sscc;
    if (!targetSscc || !row.poId || !orderId) {
      setNotice({ severity: 'error', text: 'Cannot rescan: carton is missing SSCC or PO.' });
      return;
    }
    setBusy(true);
    try {
      const result = await lookupWeighingSsccForPo(orderId, row.poId, targetSscc);
      if (result?.carton?.id !== row.cartonId || result?.po?.id !== row.poId ||
          !isPass(result?.carton?.weightStatus)) {
        throw new Error('Carton/PO mismatch or saved Weight PASS missing. Refresh the Shipping before rescan.');
      }
      const previous = await getCartonRfidSession(orderId, row.poId, targetSscc);
      if (previous?.status === 'PASS') throw new Error('RFID already PASS. Supervisor reopening is required.');
      const active = previous?.status === 'SCANNING' ? previous
        : await startCartonRfidSession(orderId, row.poId, { sscc: targetSscc, stationCode: stationCode.trim() });
      const events = await listWeightHistory(orderId, result.weighingOrder?.id);
      const savedPass = (Array.isArray(events) ? events : []).find((event) =>
        event.cartonId === row.cartonId && event.action === WEIGHT_ACTION.WEIGH && isPass(event.result));
      clearActiveCarton(false);
      setSelectedPoId(row.poId);
      setOpenedCartonId(row.cartonId);
      setLookup(result);
      setLookupStartedAt(0);
      setLastResult(savedPass ? { ...savedPass, result: WEIGHING_RESULT.PASS } : null);
      setRfidResult(active);
      setConveyorPosition(CONVEYOR_POSITION.RFID);
      setWeighingOpen(true);
      setNotice({ severity: 'info', text: `RFID ${previous?.status === 'FAILED' ? 'rescan' : 'review'} opened for Carton ${row.cartonNo}. Saved Weight PASS is retained.` });
    } catch (error) {
      setNotice({ severity: 'error', text: `Cannot open RFID rescan: ${errorText(error)}` });
    } finally {
      setBusy(false);
    }
  };

  const removeTestOrder = async () => {
    if (!admin || !cleanupEnabled || !cleanupOrder || busy) return;
    const required = `DELETE ${cleanupOrder.orderNo}`;
    if (cleanupConfirmation !== required) return;
    setBusy(true);
    try {
      await purgeLululemonTestOrder(cleanupOrder.id, cleanupConfirmation);
      if (orderId === cleanupOrder.id) {
        setOrderId('');
        setSelectedScheduleId('');
        setSelectedPoId('');
        setLevel('shipping');
        setWeighingOpen(false);
      }
      setCleanupOrder(null);
      setCleanupConfirmation('');
      setNotice({ severity: 'success', text: `TEST cleanup succeeded for ${cleanupOrder.orderNo}. Audit log retained.` });
      await Promise.all([loadManagedOrders(), loadAssignments()]);
    } catch (error) {
      setNotice({ severity: 'error', text: `TEST cleanup failed: ${errorText(error)}` });
    } finally {
      setBusy(false);
    }
  };

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
    setRfidResult(null);
    setSscc('');
    setActualWeight('');
    setHandoffError('');
    handoffAttemptKeyRef.current = null;
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

  const findAssignmentBySscc = async () => {
    const code = findSscc.trim();
    if (!code || busy || !mayWeigh) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await lookupCartonWeightSscc(code);
      const schedule = result?.shippingSchedule || {};
      // A multi-Factory user must switch to the correct Packing Factory tab
      // before scanning a carton assigned to another permitted Factory.
      if (selectedFactory && String(schedule.factoryCode || '').toUpperCase() !== selectedFactory) {
        setNotice({ severity: 'warning', text: `This carton belongs to ${schedule.factoryCode || 'another Factory'}. Switch to its Packing Factory tab before weighing.` });
        return;
      }
      const order = result?.order || {};
      const po = result?.po || {};
      setPendingTarget({ orderId: order.id, scheduleId: schedule.id, poId: po.id });
      setOrderId(order.id || '');
      setSelectedScheduleId(schedule.id || '');
      setLevel('pos');
      setAssignmentFilters({ orderNo: '', factory: '', shippingList: '', shippingDate: '' });
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
        .filter((row) => canWeighFactory(row?.schedule?.factoryCode))
        .filter((row) => !selectedFactory || String(row?.schedule?.factoryCode || "").toUpperCase() === selectedFactory);
      setShippingSchedules(safe);
      setSelectedScheduleId((current) => safe.some((row) => row?.schedule?.id === current) ? current : (safe[0]?.schedule?.id || ''));
      return safe;
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      return [];
    }
  }, [orderId, selectedFactory]);

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
            rfidPassCartons: cartons.filter((carton) => carton.rfidStatus === 'PASS').length,
            rfidFailedCartons: cartons.filter((carton) => carton.rfidStatus === 'FAILED').length,
            rfidRemainingCartons: cartons.filter((carton) => carton.rfidStatus !== 'PASS').length,
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

  const handleRfidSessionChange = useCallback((result) => {
    setRfidResult(result);
    if (result?.status === 'PASS' || result?.status === 'FAILED') {
      // The final tables join the persisted weight event with the carton RFID status.
      // Refresh both sources when the reader finishes, including after a rescan.
      loadQueue();
      loadAssignments();
    }
  }, [loadQueue, loadAssignments]);

  // Keep watching the durable SSCC-bound session while the unified
  // workstation dialog is closed. While open, CartonRfidPanel polls directly.
  useEffect(() => {
    const currentSscc = lookup?.carton?.sscc18 || lookup?.carton?.sscc;
    if (!currentSscc || !rfidResult?.id || rfidResult?.status !== 'SCANNING' || weighingOpen || !orderId || !selectedPoId) return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const latest = await getCartonRfidSession(orderId, selectedPoId, currentSscc);
        if (cancelled || !latest || latest.sscc18 !== currentSscc) return;
        setRfidResult((previous) => previous?.id === latest.id && previous?.status === latest.status ? previous : latest);
        if (latest.status === 'PASS' || latest.status === 'FAILED') await Promise.all([loadQueue(), loadAssignments()]);
      } catch { /* A lost network response must never finalize a carton. */ }
    };
    check();
    const timer = window.setInterval(check, 1200);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [lookup, rfidResult?.id, rfidResult?.status, weighingOpen, orderId, selectedPoId, loadQueue, loadAssignments]);

  useEffect(() => { loadAssignments(); loadManagedOrders(); }, [loadAssignments, loadManagedOrders]);

  useEffect(() => {
    if (!admin || !managedOrders.length) { setCleanupEnabled(false); return undefined; }
    let active = true;
    getLululemonTestCleanupStatus(managedOrders[0].id)
      .then((result) => { if (active) setCleanupEnabled(result?.enabled === true); })
      .catch(() => { if (active) setCleanupEnabled(false); });
    return () => { active = false; };
  }, [admin, managedOrders]);

  // Retrieve the business-facing Order number/name for the station header and
  // result records. Never show an invented Order number if metadata is missing.
  useEffect(() => {
    setSelectedOrderName('');
    if (!orderId) return undefined;
    let active = true;
    getManagedOrder(BUYER_CODE.LULULEMON, orderId)
      .then((order) => {
        if (active) setSelectedOrderName(String(order?.orderName || '').trim());
      })
      .catch(() => {
        // The assignment list can still supply the Order label if the metadata request fails.
      });
    return () => { active = false; };
  }, [orderId]);


  useEffect(() => {
    setRunning(false);
    setConveyorPosition(CONVEYOR_POSITION.IDLE);
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
    setConveyorPosition(CONVEYOR_POSITION.IDLE);
    setWeighingOpen(false);
    setSelectedPoId('');
    clearActiveCarton(false);
    loadQueue();
  }, [selectedScheduleId, loadQueue, clearActiveCarton]);

  useEffect(() => {
    if (!running) {
      setConveyorPosition(CONVEYOR_POSITION.IDLE);
      clearActiveCarton(false);
    }
    loadHistory();
  }, [selectedPoId, loadHistory, clearActiveCarton]);

  useEffect(() => {
    if (running && selectedPoId && !lookup) focusScanner();
  }, [running, selectedPoId, lookup, focusScanner]);

  useEffect(() => () => {
    if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
  }, []);

  // Preserve actionable errors/warnings. Transient confirmations do not occupy
  // the operator's workspace indefinitely.
  useEffect(() => {
    if (!notice || !['info', 'success'].includes(notice.severity)) return undefined;
    const timer = window.setTimeout(() => {
      setNotice((current) => current === notice ? null : current);
    }, 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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

        // Keep the carton active until RFID has also been verified.
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

  // FINAL comes from two persisted facts on the same carton: Weight PASS and RFID PASS.
  // The RFID step is started automatically when stable Weight PASS is saved.
  useEffect(() => {
    if (!lookup || normalizeResult(lastResult?.result || lookup?.carton?.weightStatus) !== WEIGHING_RESULT.PASS || rfidResult?.status !== 'PASS') return undefined;
    if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
    setConveyorPosition(CONVEYOR_POSITION.DONE);
    resultTimerRef.current = window.setTimeout(async () => {
      const cartonNo = lookup.carton?.cartonNo ?? '—';
      clearActiveCarton(false);
      setNotice({ severity: 'success', text: `FINAL PASS — carton ${cartonNo}: Weight and RFID verified.` });
      if (!running) return;
      try {
        await requestConveyorPosition(CONVEYOR_POSITION.WEIGHT, { orderId, poId: selectedPoId, stationCode: stationCode.trim() });
        setConveyorPosition(CONVEYOR_POSITION.WEIGHT);
        setWeighingOpen(true);
        focusScanner();
      } catch (error) {
        setConveyorPosition(CONVEYOR_POSITION.INFEED);
        setNotice({ severity: 'error', text: `Unable to prepare SCALE for the next carton: ${errorText(error)}` });
      }
    }, 1800);
    return () => { if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current); };
  }, [lastResult?.result, rfidResult?.status, lookup, running, clearActiveCarton, focusScanner, orderId, selectedPoId, stationCode]);

  // An RFID failure changes only the virtual position/status; saved weight remains intact.
  useEffect(() => {
    if (lookup && rfidResult?.status === 'FAILED') setConveyorPosition(CONVEYOR_POSITION.HOLD);
  }, [lookup, rfidResult?.status]);

  // Automatically hand off an SSCC-bound carton when the backend has persisted
  // Weight PASS. The command adapter simulates position now; a PLC implementation
  // must acknowledge arrival at the RFID sensor before resolving this request.
  const transferToRfid = useCallback(async () => {
    const activeSscc = lookup?.carton?.sscc18 || lookup?.carton?.sscc;
    if (!lookup || busy || !mayWeigh || !running || !orderId || !selectedPoId || !activeSscc) return;
    if (lastResult?.cartonId !== lookup.carton?.id || normalizeResult(lastResult?.result) !== WEIGHING_RESULT.PASS) return;
    setBusy(true);
    setHandoffError('');
    try {
      await requestConveyorPosition(CONVEYOR_POSITION.RFID, { orderId, poId: selectedPoId, sscc: activeSscc, stationCode });
      // Reuse an existing durable session; never restart a PASS session or
      // reset an existing SCANNING session if the PLC sends duplicate readings.
      const previous = await getCartonRfidSession(orderId, selectedPoId, activeSscc);
      const session = previous && ['SCANNING', 'PASS', 'FAILED'].includes(previous.status)
        ? previous
        : await startCartonRfidSession(orderId, selectedPoId, { sscc: activeSscc, stationCode });
      setRfidResult(session);
      setConveyorPosition(session.status === 'FAILED' ? CONVEYOR_POSITION.HOLD : session.status === 'PASS' ? CONVEYOR_POSITION.DONE : CONVEYOR_POSITION.RFID);
      setWeighingOpen(true);
      setNotice({ severity: session.status === 'FAILED' ? 'warning' : 'info',
        text: `Weight PASS saved for carton ${lookup.carton?.cartonNo ?? '—'}. Automatic handoff to RFID ${session.status === 'SCANNING' ? 'started' : `found ${session.status}`}. Virtual movement only; manually move the carton until the physical conveyor is installed.` });
    } catch (error) {
      setConveyorPosition(CONVEYOR_POSITION.WEIGHT);
      setHandoffError(errorText(error));
      setNotice({ severity: 'error', text: `Automatic RFID handoff failed: ${errorText(error)}. Weight PASS is saved; retry without re-weighing.` });
    } finally {
      setBusy(false);
    }
  }, [lookup, busy, mayWeigh, running, orderId, selectedPoId, lastResult, stationCode]);

  // The button START arms the sequence. When a *persisted* stable Weight PASS
  // arrives from PLC (or Submit Manual), this effect takes over without WEIGHT/RFID buttons.
  useEffect(() => {
    if (!running || busy || !lookup?.carton?.id || !lastResult?.cartonId) return;
    if (lookup.carton.id !== lastResult.cartonId) return; // never use another carton's weight
    if (normalizeResult(lastResult.result) !== WEIGHING_RESULT.PASS) return;
    if (rfidResult?.status === 'PASS' || rfidResult?.status === 'FAILED') return;
    if (conveyorPosition !== CONVEYOR_POSITION.WEIGHT || handoffError) return;
    const key = `${orderId}:${lookup.carton.id}:${lastResult.id || lastResult.createdAt || lastResult.actualWeightKg}`;
    if (handoffAttemptKeyRef.current === key) return;
    handoffAttemptKeyRef.current = key;
    transferToRfid();
  }, [running, busy, lookup, lastResult, orderId, conveyorPosition, rfidResult?.status, handoffError, transferToRfid]);

  // FAILED stable weight is persisted, but must not silently advance to RFID.
  useEffect(() => {
    if (running && lookup?.carton?.id && lookup.carton.id === lastResult?.cartonId
        && normalizeResult(lastResult?.result) === WEIGHING_RESULT.FAILED) {
      setConveyorPosition(CONVEYOR_POSITION.WEIGHT_HOLD);
    }
  }, [running, lookup?.carton?.id, lastResult?.cartonId, lastResult?.result]);

  // Leave a failed RFID carton on HOLD and bring the virtual SCALE back for
  // another carton, without deleting its persisted weight or RFID failure.
  const holdRfidAndContinue = async () => {
    if (!running || busy || !lookup || rfidResult?.status !== 'FAILED') return;
    if (!window.confirm('Keep this carton in RFID HOLD and continue? Its weight PASS and RFID failure will remain saved.')) return;
    setBusy(true);
    try {
      await requestConveyorPosition(CONVEYOR_POSITION.WEIGHT, { orderId, poId: selectedPoId, stationCode: stationCode.trim() });
      const previousCartonNo = lookup.carton?.cartonNo;
      clearActiveCarton(false);
      setConveyorPosition(CONVEYOR_POSITION.WEIGHT);
      setNotice({ severity: 'warning', text: `Carton ${previousCartonNo ?? '—'} remains RFID HOLD. Ready to scan the next carton.` });
      await Promise.all([loadQueue(), loadAssignments()]);
      focusScanner();
    } catch (error) {
      setNotice({ severity: 'error', text: `Unable to prepare the next carton: ${errorText(error)}` });
    } finally {
      setBusy(false);
    }
  };

  const retryRfidHandoff = () => {
    setHandoffError('');
    handoffAttemptKeyRef.current = null;
  };

  // One START for the whole Shipping List: each PO keeps its own backend session,
  // while the operator uses one SSCC scanner and the PO is resolved automatically.
  const startStation = async () => {
    if (!orderId || !selectedScheduleId || busy || !mayWeigh || !stationCode.trim() || running) return;
    const jobs = poOptions.filter((po) => po.totalCartons > 0 && po.po?.weighingSessionStatus !== 'COMPLETED' && (po.remainingCartons > 0 || po.failedCartons > 0 || po.rfidRemainingCartons > 0));
    if (!jobs.length) {
      setNotice({ severity: 'info', text: 'This Shipping List has no POs waiting for weighing or RFID review.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    const started = [];
    try {
      localStorage.setItem(STORAGE_KEY.WEIGHING_STATION_SSCC, stationCode.trim());
      for (const job of jobs) {
        await startWeighingPo(orderId, job.poId, stationCode.trim());
        started.push(job.poId);
      }
      await requestConveyorPosition(CONVEYOR_POSITION.INFEED, { orderId, poId: jobs[0].poId, stationCode: stationCode.trim() });
      await requestConveyorPosition(CONVEYOR_POSITION.WEIGHT, { orderId, poId: jobs[0].poId, stationCode: stationCode.trim() });
      setActiveStationPoIds(started);
      setSelectedPoId(jobs[0].poId);
      clearActiveCarton(false);
      setConveyorPosition(CONVEYOR_POSITION.WEIGHT);
      setRunning(true);
      setWeighingOpen(true);
      setNotice({ severity: 'success', text: `Shipping ${selectedSchedule?.schedule?.shippingName || selectedSchedule?.schedule?.scheduleNo || ''} started. Scan any assigned carton SSCC; its PO is selected automatically.` });
      await Promise.all([loadQueue(), loadAssignments()]);
      focusScanner();
    } catch (error) {
      // A partial START must not leave newly armed PO sessions silently running.
      await Promise.allSettled(started.map((poId) => stopWeighingPo(orderId, poId)));
      setActiveStationPoIds([]);
      setRunning(false);
      setNotice({ severity: 'error', text: `Shipping List START failed: ${errorText(error)}` });
    } finally {
      setBusy(false);
    }
  };

  const stopStation = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
      const responses = await Promise.allSettled(activeStationPoIds.map((poId) => stopWeighingPo(orderId, poId)));
      const failedStops = responses.filter((result) => result.status === 'rejected').length;
      setActiveStationPoIds([]);
      setRunning(false);
      setConveyorPosition(CONVEYOR_POSITION.IDLE);
      setWeighingOpen(false);
      clearActiveCarton(false);
      setNotice({ severity: failedStops ? 'warning' : 'info', text: failedStops
        ? `STOP sent, but ${failedStops} PO session(s) could not be confirmed stopped. Refresh before restarting.`
        : 'Shipping List station stopped.' });
      await Promise.all([loadQueue(), loadAssignments()]);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const completePo = async (confirmedRfidExceptions = false) => {
    if (!selectedPo || busy) return;
    if (selectedPo.remainingCartons > 0) {
      setNotice({ severity: 'warning', text: `${selectedPo.remainingCartons} carton(s) have not been weighed yet.` });
      return;
    }
    if (selectedPo.failedCartons > 0) {
      setNotice({ severity: 'error', text: `${selectedPo.failedCartons} carton(s) are FAILED. Resolve them before completing the PO.` });
      return;
    }
    if (selectedPo.rfidRemainingCartons > 0 && !confirmedRfidExceptions) {
      setConfirmCompletionOpen(true);
      return;
    }
    setConfirmCompletionOpen(false);
    setBusy(true);
    try {
      const completedPo = await completeWeighingPo(orderId, selectedPo.poId);
      const rfidReview = completedPo?.rfidReviewStatus || (selectedPo.rfidFailedCartons > 0 ? 'ISSUES' : selectedPo.rfidRemainingCartons > 0 ? 'PENDING' : 'PASS');
      const remainingPoIds = activeStationPoIds.filter((id) => id !== selectedPo.poId);
      setActiveStationPoIds(remainingPoIds);
      setRunning(remainingPoIds.length > 0);
      setConveyorPosition(remainingPoIds.length ? CONVEYOR_POSITION.WEIGHT : CONVEYOR_POSITION.IDLE);
      setWeighingOpen(remainingPoIds.length > 0);
      clearActiveCarton(false);
      if (remainingPoIds.length) setSelectedPoId(remainingPoIds[0]);
      setNotice({
        severity: rfidReview === 'PASS' ? 'success' : 'warning',
        text: `PO ${selectedPo.po?.poNumber || ''}: weight completed (${selectedPo.passCartons}/${selectedPo.totalCartons} cartons PASS). RFID ${rfidReview === 'PASS' ? 'VERIFIED' : rfidReview === 'ISSUES' ? 'ISSUES – review required' : 'PENDING – not yet verified'}.${remainingPoIds.length ? ' Shipping List remains running for the other POs.' : ' Shipping List weighing finished.'}`
      });
      await Promise.all([loadQueue(), loadAssignments()]);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const scanSscc = async () => {
    const value = normalizedSscc(sscc);
    if (!(running || poSessionCompleted) || !orderId || !selectedScheduleId || busy || !mayWeigh || lookup) return;
    if (!value) {
      setNotice({ severity: 'warning', text: 'Invalid SSCC. Scan an 18-digit SSCC or a GS1 (00) barcode.' });
      return;
    }
    if (!poSessionCompleted && conveyorPosition !== CONVEYOR_POSITION.WEIGHT) {
      setNotice({ severity: 'warning', text: 'The SCALE station is not ready. STOP and START again before scanning SSCC.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    setLastResult(null);
    try {
      const assigned = assignments.find((item) => item.orderId === orderId && item.shippingScheduleId === selectedScheduleId && item.sscc18 === value);
      if (!assigned) throw new Error('SSCC is not assigned to the selected Shipping List. Check the carton or change Shipping List.');
      const targetPoId = assigned.poId;
      const targetPoCompleted = poOptions.find((row) => row.poId === targetPoId)?.po?.weighingSessionStatus === 'COMPLETED';
      if (!activeStationPoIds.includes(targetPoId) && !targetPoCompleted) throw new Error('This PO is not running. STOP and START the Shipping List again after refreshing assignments.');
      const result = await lookupWeighingSsccForPo(orderId, targetPoId, value);
      if (result?.po?.id !== targetPoId) throw new Error('SSCC and PO do not match. Recheck Shipping List assignments.');
      setSelectedPoId(targetPoId);
      setLookup(result);
      setRfidResult(null);
      setLookupStartedAt(targetPoCompleted ? 0 : Date.now());
      setActualWeight('');
      setNotice({ severity: 'info', text: result.message || APP_MESSAGES.SSCC_ACCEPTED });
      const savedWeightEvents = await loadHistory(result.weighingOrder?.id);
      // Scanning an already-weighed carton must reuse its persisted PASS event.
      // Never ask the operator to weigh it again just to finish RFID.
      if (!targetPoCompleted && normalizeResult(result.carton?.weightStatus) === WEIGHING_RESULT.PASS) {
        const savedPass = savedWeightEvents.find((event) => event.cartonId === result.carton?.id
          && event.action === WEIGHT_ACTION.WEIGH && normalizeResult(event.result) === WEIGHING_RESULT.PASS);
        if (savedPass) {
          setLookupStartedAt(0);
          setLastResult({ ...savedPass, result: WEIGHING_RESULT.PASS });
        } else {
          setLookupStartedAt(0);
          setNotice({ severity: 'warning', text: 'Weight is marked PASS but the persisted weight event was not found. Refresh history before starting RFID.' });
        }
      }
      // Review RFID on an already completed WEIGHT PO in this same workspace.
      // This does not create a new weight event or overwrite the saved PASS.
      if (targetPoCompleted && normalizeResult(result.carton?.weightStatus) === WEIGHING_RESULT.PASS) {
        const activeSscc = result.carton?.sscc18 || result.carton?.sscc;
        const previous = await getCartonRfidSession(orderId, targetPoId, activeSscc);
        if (previous?.status === 'PASS') {
          setRfidResult(previous);
          setNotice({ severity: 'success', text: 'This carton already passed both Weight and RFID.' });
          return;
        }
        await requestConveyorPosition(CONVEYOR_POSITION.RFID, { orderId, poId: targetPoId, sscc: activeSscc, stationCode });
        const session = previous && ['SCANNING', 'FAILED'].includes(previous.status)
          ? previous
          : await startCartonRfidSession(orderId, targetPoId, { sscc: activeSscc, stationCode });
        setRfidResult(session);
        setConveyorPosition(session.status === 'FAILED' ? CONVEYOR_POSITION.HOLD : CONVEYOR_POSITION.RFID);
        setWeighingOpen(true);
      }
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
    const enteredKg = Number(actualWeight);
    if (!running || !mayWeigh || !lookup || !weighingOrderId || activeResult || busy || !stationCode.trim()) return;
    if (!Number.isFinite(enteredKg) || enteredKg < 0.001) {
      setNotice({ severity: 'warning', text: 'Enter a manual weight greater than zero (minimum 0.001 kg).' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      localStorage.setItem(STORAGE_KEY.WEIGHING_STATION_SSCC, stationCode.trim());
      const result = await submitWeightApi(orderId, weighingOrderId, {
        sscc: lookup.carton?.sscc18 || lookup.carton?.sscc || sscc,
        actualWeightKg: enteredKg,
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
      // Combined PASS is evaluated by the shared RFID/weight effect below.
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

  // These two tables show the FINAL carton outcome, not a weight-only outcome.
  // SCANNING / PENDING is not a failure and must not appear in the PASS table.
  // Join each latest persisted weight event with the RFID status of the SAME carton.
  const finalDecisionEvents = useMemo(() => {
    const cartonById = new Map();
    (selectedPo?.cartons || []).forEach((carton) => cartonById.set(carton.id, carton));
    selectedCartonAssignments.forEach((carton) => cartonById.set(carton.cartonId, carton));
    return decisionEvents.map((event) => {
      const currentSessionStatus = lookup?.carton?.id === event.cartonId ? rfidResult?.status : null;
      const persistedRfidStatus = cartonById.get(event.cartonId)?.rfidStatus;
      const rfidStatus = String(currentSessionStatus || persistedRfidStatus || 'PENDING').toUpperCase();
      const weightResult = normalizeResult(event.result);
      return {
        ...event,
        weightResult,
        rfidStatus,
        finalStatus: getFinalCartonStatus(weightResult, rfidStatus)
      };
    });
  }, [decisionEvents, selectedPo?.cartons, selectedCartonAssignments, lookup?.carton?.id, rfidResult?.status]);

  const passRows = useMemo(
    () => finalDecisionEvents.filter((event) => event.finalStatus === 'PASS'),
    [finalDecisionEvents]
  );
  const failedRows = useMemo(
    () => finalDecisionEvents.filter((event) => event.finalStatus === 'FAILED'),
    [finalDecisionEvents]
  );
  const pendingFinalCount = finalDecisionEvents.filter((event) => event.finalStatus === 'PENDING').length;

  const expected = Number(lookup?.expectedWeightKg);
  const tolerance = Number(lookup?.profile?.toleranceKg);
  const minWeight = Number.isFinite(expected) && Number.isFinite(tolerance) ? expected - tolerance : null;
  const maxWeight = Number.isFinite(expected) && Number.isFinite(tolerance) ? expected + tolerance : null;
  const actual = lastResult?.actualWeightKg ?? lookup?.carton?.actualWeightKg;
  const activeResult = normalizeResult(lastResult?.result || lookup?.carton?.weightStatus);
  const processed = selectedPo ? selectedPo.passCartons + selectedPo.failedCartons : 0;
  const poSessionCompleted = selectedPo?.po?.weighingSessionStatus === 'COMPLETED';
  const canComplete = Boolean(selectedPo && !poSessionCompleted && selectedPo.totalCartons > 0 && selectedPo.remainingCartons === 0 && selectedPo.failedCartons === 0);
  const poRfidReview = selectedPo?.rfidFailedCartons > 0 ? 'ISSUES' : selectedPo?.rfidRemainingCartons > 0 ? 'PENDING' : 'PASS';
  const poCompletionStatus = poSessionCompleted
    ? `WEIGHT COMPLETE · RFID ${poRfidReview === 'PASS' ? 'VERIFIED' : poRfidReview}`
    : null;

  const stationState = poSessionCompleted
    ? poCompletionStatus
    : activeResult === WEIGHING_RESULT.PASS && rfidResult?.status === 'PASS'
      ? 'FINAL PASS'
      : activeResult === WEIGHING_RESULT.PASS && rfidResult?.status !== 'PASS'
        ? `WEIGHT PASS · RFID ${rfidResult?.status === 'FAILED' ? 'HOLD' : rfidResult?.status === 'SCANNING' ? 'SCANNING' : 'PENDING'}`
      : activeResult
    ? activeResult
    : lookup
      ? 'WAITING FOR STABLE WEIGHT'
      : running
        ? 'RUNNING'
        : 'STOPPED';

  const orderDisplay = selectedOrderName || assignments.find((row) => row.orderId === orderId)?.orderNo || orderId || '—';
  const poDisplay = selectedPo?.po?.poNumber || '—';

  const resultTable = (title, result, rows) => {
    const failed = result === WEIGHING_RESULT.FAILED;
    const qty = rows.reduce((sum, row) => sum + num(row.cartonQty), 0);
    const rowCount = rows.length;

    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
        <Box sx={{ px: 1.15, py: 0.85, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" spacing={0.7} alignItems="center" sx={{ minWidth: 0 }}>
              {failed ? <ErrorOutline color="error" /> : <CheckCircleOutline color="success" />}
              <Typography noWrap fontWeight={950} color={failed ? 'error.main' : 'success.main'}>{title}</Typography>
            </Stack>
            <Chip size="small" variant="outlined" color={rowCount ? failed ? 'error' : 'success' : 'default'} label={`${rowCount} carton(s) · ${qty} pcs`} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
            Order <b>{orderDisplay}</b> · PO <b>{poDisplay}</b>
          </Typography>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport paginate viewportHeight="265px" sx={{ border: 0, borderRadius: 0 }}>
            <SortableTable stickyHeader size="small" sx={{ minWidth: 875 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 130 }}>Order / PO</TableCell>
                  <TableCell sx={{ minWidth: 175 }}>Carton / SSCC</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Target kg</TableCell>
                  <TableCell>Actual kg</TableCell>
                  <TableCell>Diff kg</TableCell>
                  <TableCell>Weight</TableCell>
                  <TableCell>RFID</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Time / Station</TableCell>
                  <TableCell data-sortable={false}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((event) => (
                  <TableRow key={event.id || `${event.cartonId}-${event.createdAt}`} hover>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 850 }} noWrap title={`Order ${orderDisplay}`}>{orderDisplay}</Typography>
                      <Typography variant="caption" color="text.secondary">PO {event.poNumber || poDisplay}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={800} variant="caption" sx={{ display: 'block' }}>Carton {event.cartonNo ?? '—'}</Typography>
                      <Typography color="text.secondary" variant="caption" noWrap sx={{ display: 'block', maxWidth: 170 }} title={event.sscc18 || ''}>{event.sscc18 || '—'}</Typography>
                    </TableCell>
                    <TableCell>{event.cartonQty ?? '—'}</TableCell>
                    <TableCell>{event.expectedWeightKg ?? '—'}</TableCell>
                    <TableCell>{event.actualWeightKg ?? '—'}</TableCell>
                    <TableCell>{event.differenceKg ?? '—'}</TableCell>
                    <TableCell><Chip size="small" color={event.weightResult === 'PASS' ? 'success' : 'error'} label={event.weightResult} /></TableCell>
                    <TableCell><Chip size="small" color={event.rfidStatus === 'PASS' ? 'success' : event.rfidStatus === 'FAILED' ? 'error' : 'default'} label={event.rfidStatus === 'PENDING' && event.weightResult === 'FAILED' ? 'NOT SCANNED' : event.rfidStatus} /></TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: 'block' }}>{event.createdAt || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{event.stationCode || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.4}>
                        {failed && mayWeigh && event.weightResult === WEIGHING_RESULT.PASS && event.rfidStatus === 'FAILED' ? (
                          <Button size="small" variant="outlined" color="warning" startIcon={<Refresh />}
                            disabled={busy || running} onClick={() => openCartonWorkspace({
                              ...event, poId: selectedPoId, weightStatus: 'PASS', sscc18: event.sscc18,
                              rfidStatus: 'FAILED'
                            })}>Rescan RFID</Button>
                        ) : null}
                        {admin && failed && event.weightResult === WEIGHING_RESULT.FAILED ? (
                          <Button size="small" variant="outlined" color="warning" startIcon={<Undo />}
                            onClick={() => reopenWeight(event)} disabled={busy || running}>Re-weigh</Button>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!rowCount ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 2.5, color: 'text.secondary' }}>
                      {failed ? 'No cartons have failed Weight or RFID.' : 'No cartons have passed both Weight and RFID.'}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </SortableTable>
          </LululemonTableViewport>
        </Box>
        <Stack spacing={0.65} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.8, minHeight: 82 }}>
          {rows.map((event) => (
            <Paper key={event.id || `${event.cartonId}-${event.createdAt}`} variant="outlined" sx={{ p: 0.95, borderRadius: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" fontWeight={850}>Order {orderDisplay} · PO {event.poNumber || poDisplay}</Typography>
                  <Typography fontWeight={900}>Carton {event.cartonNo ?? '—'}</Typography>
                </Box>
                <Chip size="small" color={failed ? 'error' : 'success'} label={failed ? 'FINAL FAILED' : 'FINAL PASS'} />
              </Stack>
              <Typography variant="caption" sx={{ display: 'block', wordBreak: 'break-all' }} color="text.secondary">SSCC {event.sscc18 || '—'}</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                <Chip size="small" color={event.weightResult === 'PASS' ? 'success' : 'error'} label={`Weight ${event.weightResult}`} />
                <Chip size="small" color={event.rfidStatus === 'PASS' ? 'success' : event.rfidStatus === 'FAILED' ? 'error' : 'default'} label={`RFID ${event.rfidStatus === 'PENDING' && event.weightResult === 'FAILED' ? 'NOT SCANNED' : event.rfidStatus}`} />
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 0.5, mt: 0.7 }}>
                {[[ 'Qty', event.cartonQty ], [ 'Target', event.expectedWeightKg ], [ 'Actual', event.actualWeightKg ], [ 'Diff', event.differenceKg ]].map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography fontWeight={900}>{value ?? '—'}</Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">{event.createdAt || '—'} · {event.stationCode || '—'}</Typography>
              {failed && (mayWeigh || admin) ? (
                <Stack direction="row" spacing={0.7} sx={{ mt: 0.8 }}>
                  {mayWeigh && event.weightResult === WEIGHING_RESULT.PASS && event.rfidStatus === 'FAILED' ? (
                    <Button fullWidth size="small" color="warning" variant="outlined" startIcon={<Refresh />}
                      onClick={() => openCartonWorkspace({ ...event, poId: selectedPoId,
                        weightStatus: 'PASS', sscc18: event.sscc18, rfidStatus: 'FAILED' })}
                      disabled={busy || running}>Rescan RFID</Button>
                  ) : null}
                  {admin && event.weightResult === WEIGHING_RESULT.FAILED ? (
                    <Button fullWidth size="small" variant="outlined" startIcon={<Undo />}
                      onClick={() => reopenWeight(event)} disabled={busy || running}>Re-weigh</Button>
                  ) : null}
                </Stack>
              ) : null}
            </Paper>
          ))}
          {!rowCount ? <Typography align="center" color="text.secondary" variant="caption" sx={{ py: 2 }}>No {failed ? 'final failed' : 'final passed'} cartons yet for this Order / PO.</Typography> : null}
        </Stack>
      </Paper>
    );
  };

  return (
    <Stack className="lululemon-compact-v16" spacing={0.85} sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader
        dense
        title="Carton Weight"
        actions={<Button size="small" startIcon={<Refresh />} onClick={() => { loadAssignments(); loadSchedules(); loadQueue(); loadHistory(); }} disabled={queueLoading || busy}>Refresh</Button>}
      />

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1} sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {level !== 'shipping' ? <IconButton size="small" aria-label="Back" onClick={() => {
              if (level === 'cartons') { setLevel('pos'); setWeighingOpen(false); }
              else { setLevel('shipping'); setSelectedPoId(''); setSelectedScheduleId(''); setOrderId(''); }
            }}><ArrowBackRounded /></IconButton> : null}
            <Typography fontWeight={900}>
              {level === 'shipping' ? 'Shipping to Weigh' : level === 'pos'
                ? `${selectedSchedule?.schedule?.shippingName || selectedSchedule?.schedule?.scheduleNo || 'Shipping'} · Purchase Orders`
                : `Shipping ${selectedSchedule?.schedule?.shippingName || selectedSchedule?.schedule?.scheduleNo || '—'} · PO ${poDisplay} · Cartons`}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.7} alignItems="center">
            <Chip size="small" variant="outlined" label={level === 'shipping' ? `${shippingGroups.length} Shipping` : level === 'pos' ? `${orderPoGroups.length} POs` : `${selectedCartonAssignments.length} Cartons`} />
            {level === 'pos' ? (
              <Button size="small" variant="contained" onClick={startStation} disabled={busy || queueLoading || running || !mayWeigh || !selectedScheduleId || !poOptions.some((job) => job.totalCartons > 0 && job.po?.weighingSessionStatus !== 'COMPLETED')}>START Shipping</Button>
            ) : null}
            <Button size="small" startIcon={<Refresh />} disabled={busy || assignmentLoading} onClick={() => { loadManagedOrders(); loadAssignments(); if (orderId) { loadSchedules(); loadQueue(); } }}>Refresh</Button>
          </Stack>
        </Stack>

        {level === 'shipping' ? (
          <>
            <Box sx={{ p: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                <TextField size="small" label="Search Shipping" placeholder="Shipping name or code" value={assignmentFilters.shippingList}
                  onChange={(e) => setAssignmentFilters((previous) => ({ ...previous, shippingList: e.target.value }))} sx={{ flex: 1 }} />
                <TextField size="small" label="Find carton by SSCC" placeholder="Scan SSCC-18, then Enter" value={findSscc}
                  onChange={(e) => setFindSscc(e.target.value.replace(/\s+/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); findAssignmentBySscc(); } }}
                  disabled={busy || !mayWeigh} sx={{ flex: 1.2 }} />
                <Button variant="outlined" size="small" onClick={findAssignmentBySscc} disabled={!findSscc.trim() || busy || !mayWeigh}>Find SSCC</Button>
              </Stack>
            </Box>
            <LululemonTableViewport>
              <SortableTable stickyHeader size="small">
                <TableHead><TableRow><TableCell>Shipping Name</TableCell><TableCell>Factory</TableCell><TableCell>Shipping Date</TableCell><TableCell>POs</TableCell><TableCell>Cartons</TableCell><TableCell>Weight PASS</TableCell><TableCell>RFID Pending</TableCell><TableCell data-sortable={false} align="right">Action</TableCell></TableRow></TableHead>
                <TableBody>
                  {pagedList.map((row) => <TableRow key={`${row.orderId}:${row.shippingScheduleId}`} hover>
                    <TableCell><Typography fontWeight={900}>{row.shippingName || row.shippingList || '—'}</Typography>
                      {row.shippingName ? <Typography variant="caption" color="text.secondary">{row.shippingList}</Typography> : null}</TableCell>
                    <TableCell>{row.factoryCode || '—'}</TableCell>
                    <TableCell>{row.shippingDate || '—'}</TableCell>
                    <TableCell>{row.poKeys.size}</TableCell>
                    <TableCell>{row.cartons.length}</TableCell>
                    <TableCell><Typography color="success.main" fontWeight={850}>{row.cartons.filter((c) => isPass(c.weightStatus)).length}</Typography></TableCell>
                    <TableCell>{row.cartons.filter((c) => c.rfidStatus !== 'PASS').length}</TableCell>
                    <TableCell align="right"><Stack direction="row" spacing={0.65} justifyContent="flex-end">
                      <Button size="small" variant="outlined" endIcon={<ChevronRightRounded />} onClick={() => openShippingFromList(row)}>Open</Button>
                      {admin && cleanupEnabled ? <Button size="small" color="error" variant="outlined" startIcon={<DeleteForeverOutlined />}
                        onClick={() => { setCleanupOrder({ id: row.orderId, orderNo: row.orderNo || row.orderId }); setCleanupConfirmation(''); }}>
                        Remove Order Test Data</Button> : null}
                    </Stack></TableCell>
                  </TableRow>)}
                  {!shippingGroups.length ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No Shipping assigned to Carton Weight.</TableCell></TableRow> : null}
                </TableBody>
              </SortableTable>
            </LululemonTableViewport>
          </>
        ) : level === 'pos' ? (
          <LululemonTableViewport>
            <SortableTable stickyHeader size="small">
              <TableHead><TableRow><TableCell>PO</TableCell><TableCell>Shipping / Factory</TableCell><TableCell>Style / Color / Size</TableCell><TableCell>SKU</TableCell><TableCell>Cartons</TableCell><TableCell>Weight PASS</TableCell><TableCell>RFID Pending</TableCell><TableCell data-sortable={false} align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {pagedList.map((row) => (
                  <TableRow hover key={`${row.shippingScheduleId}:${row.poId}`}>
                    <TableCell><Typography fontWeight={900}>{row.poNumber}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={850}>{row.shippingName || row.shippingList || '—'}</Typography><Typography variant="caption" color="text.secondary">{row.factoryCode || '—'} · {row.shippingDate || '—'}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={850}>{row.style || '—'}</Typography><Typography variant="caption" color="text.secondary">{row.color || '—'} · {row.size || '—'}</Typography></TableCell>
                    <TableCell>{row.sku || '—'}</TableCell>
                    <TableCell>{row.cartons.length}</TableCell>
                    <TableCell>{row.cartons.filter((item) => isPass(item.weightStatus)).length}</TableCell>
                    <TableCell>{row.cartons.filter((item) => item.rfidStatus !== 'PASS').length}</TableCell>
                    <TableCell align="right"><Button size="small" variant="outlined" endIcon={<ChevronRightRounded />} onClick={() => openPoFromList(row)}>Open</Button></TableCell>
                  </TableRow>
                ))}
                {!orderPoGroups.length ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}>No POs have been released to the weighing station for this Shipping.</TableCell></TableRow> : null}
              </TableBody>
            </SortableTable>
          </LululemonTableViewport>
        ) : (
          <LululemonTableViewport>
            <Table stickyHeader size="small">
              <TableHead><TableRow><TableCell>Carton</TableCell><TableCell>SSCC-18</TableCell><TableCell>SKU / Style</TableCell><TableCell>Qty</TableCell><TableCell>Weight</TableCell><TableCell>RFID</TableCell><TableCell data-sortable={false} align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {pagedList.map((row) => (
                  <Fragment key={row.cartonId}>
                    <TableRow hover onClick={() => toggleCartonItems(row)} sx={{ cursor: 'pointer' }}>
                      <TableCell><Typography fontWeight={900}>Carton {row.cartonNo ?? '—'}</Typography></TableCell>
                      <TableCell>{row.sscc18 || '—'}</TableCell>
                      <TableCell><Typography variant="body2" fontWeight={800}>{row.sku || '—'}</Typography><Typography variant="caption" color="text.secondary">{row.style || '—'} · {row.color || '—'}</Typography></TableCell>
                      <TableCell>{row.cartonQty ?? row.plannedQty ?? '—'}</TableCell>
                      <TableCell><Chip size="small" color={isPass(row.weightStatus) ? 'success' : isFailed(row.weightStatus) ? 'error' : 'default'} label={row.weightStatus || 'WAITING'} /></TableCell>
                      <TableCell><Chip size="small" color={row.rfidStatus === 'PASS' ? 'success' : row.rfidStatus === 'FAILED' ? 'error' : 'default'} label={row.rfidStatus || 'PENDING'} /></TableCell>
                      <TableCell align="right"><Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button size="small" variant="text" onClick={(event) => { event.stopPropagation(); toggleCartonItems(row); }}>{itemsCartonId === row.cartonId ? 'Hide Items' : 'Items'}</Button>
                        {mayWeigh && isPass(row.weightStatus) && row.rfidStatus !== 'PASS' ? (
                          <Button size="small" variant="outlined" color={row.rfidStatus === 'FAILED' ? 'warning' : 'primary'}
                            startIcon={row.rfidStatus === 'FAILED' ? <Refresh /> : undefined}
                            disabled={busy || running} title={running ? 'Stop the active Shipping station before rescan.' : undefined}
                            onClick={(event) => { event.stopPropagation(); openCartonWorkspace(row); }}>
                            {row.rfidStatus === 'FAILED' ? 'Rescan RFID' : 'Open RFID'}
                          </Button>
                        ) : null}
                        {admin && isFailed(row.weightStatus) ? (
                          <Button size="small" variant="outlined" color="warning" startIcon={<Undo />}
                            disabled={busy || running} title={running ? 'Stop the active Shipping station before re-weigh.' : undefined}
                            onClick={(event) => { event.stopPropagation(); reopenWeight({
                              cartonId: row.cartonId, cartonNo: row.cartonNo,
                              weighingOrderId: poOptions.find((po) => po.poId === row.poId)?.weighingOrder?.id
                            }); }}>Re-weigh</Button>
                        ) : null}
                      </Stack></TableCell>
                    </TableRow>
                    {itemsCartonId === row.cartonId ? (
                      <TableRow key={`${row.cartonId}-items`}><TableCell colSpan={7} sx={{ p: 1, bgcolor: 'action.hover' }}>
                        <Typography fontWeight={850} variant="subtitle2" sx={{ mb: 0.5 }}>Carton {row.cartonNo} · Items</Typography>
                        {itemsLoading ? <CircularProgress size={18} /> : cartonItems.length ? (
                          <Stack spacing={0.3}>
                            {cartonItems.map((item, index) => <Stack key={item.id || index} direction="row" spacing={2} sx={{ px: 1, py: 0.5, bgcolor: 'background.paper', borderRadius: 1 }}>
                              <Typography variant="caption" fontWeight={850} sx={{ minWidth: 60 }}>Item {item.itemNo ?? index + 1}</Typography>
                              <Typography variant="caption">SKU {item.expectedSku || item.scannedSku || '—'}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.status || 'WAITING'}</Typography>
                              <Typography variant="caption" color={item.rfidStatus === 'PASS' ? 'success.main' : 'text.secondary'}>RFID {item.rfidStatus || 'PENDING'}</Typography>
                              {item.rfidEpc ? <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>EPC {item.rfidEpc}</Typography> : null}
                            </Stack>)}
                          </Stack>
                        ) : <Typography variant="caption" color="text.secondary">No item slots for this carton.</Typography>}
                      </TableCell></TableRow>
                    ) : null}
                  </Fragment>
                ))}
                {!selectedCartonAssignments.length ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}>{queueLoading ? 'Loading cartons...' : 'No assigned cartons under this PO.'}</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </LululemonTableViewport>
        )}
        <TablePagination component="div" count={displayedList.length} page={safeListPage} rowsPerPage={listRowsPerPage}
          onPageChange={(_, next) => setListPage(next)} onRowsPerPageChange={(event) => { setListRowsPerPage(Number(event.target.value)); setListPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Rows per page:" />
      </Paper>

      {level === 'pos' ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
          <TextField label="Scale station" size="small" value={stationCode} disabled={running} onChange={(event) => setStationCode(event.target.value)} sx={{ width: 190 }} />
          <Typography variant="caption" color="text.secondary">Press START once for this Shipping, then scan any assigned SSCC. The matching PO is selected automatically.</Typography>
        </Stack>
      ) : null}
      {notice && !weighingOpen ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

      {level === 'cartons' ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
          Use Items to inspect a carton. Return to the Shipping PO screen to press START and process its cartons automatically.
        </Typography>
      ) : null}

      <OperationWorkspaceDialog
        open={weighingOpen}
        allowMaximize
        onClose={() => setWeighingOpen(false)}
        disableClose={running}
        title={`Carton Weighing · ${selectedSchedule?.schedule?.shippingName || selectedSchedule?.schedule?.scheduleNo || 'Shipping'}`}
        subtitle={`Order ${orderDisplay} · Active PO ${poDisplay} · Factory ${selectedSchedule?.schedule?.factoryCode || '—'} · ${selectedSchedule?.schedule?.exFtyDate || '—'} · Station ${stationCode || '—'}`}
        actions={(
          <>
            <Chip
              size="small"
              icon={<Sensors />}
              label={stationState}
              color={poSessionCompleted ? (poRfidReview === 'PASS' ? 'success' : 'warning') : activeResult === WEIGHING_RESULT.FAILED || rfidResult?.status === 'FAILED' ? 'error' : activeResult === WEIGHING_RESULT.PASS && rfidResult?.status !== 'PASS' ? 'warning' : activeResult === WEIGHING_RESULT.PASS ? 'success' : running ? 'info' : 'default'}
            />
            {poSessionCompleted && poRfidReview !== 'PASS' ? <Chip size="small" color="warning" label="RFID Review" /> : null}
            {running ? <Button size="small" color="error" variant="contained" startIcon={<Stop />} onClick={stopStation} disabled={busy}>STOP</Button> : null}
            <Button size="small" variant="outlined" startIcon={<TaskAlt />} onClick={() => completePo()} disabled={!canComplete || busy}>
              {poSessionCompleted ? 'WEIGHT COMPLETED' : selectedPo?.rfidRemainingCartons > 0 ? 'COMPLETE WEIGHT' : 'COMPLETE'}
            </Button>
          </>
        )}
      >
        <Stack spacing={0.9} className="lululemon-compact-v16">
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap" aria-label="Automatic workflow progress">
            <Chip size="small" label="1 · WEIGHT" color={activeResult === WEIGHING_RESULT.PASS ? 'success' : activeResult === WEIGHING_RESULT.FAILED ? 'error' : running && conveyorPosition === CONVEYOR_POSITION.WEIGHT ? 'primary' : 'default'} variant={activeResult ? 'filled' : 'outlined'} />
            <Typography variant="caption" color="text.disabled">→</Typography>
            <Chip size="small" label="2 · SCAN RFID" color={rfidResult?.status === 'PASS' ? 'success' : rfidResult?.status === 'FAILED' ? 'error' : rfidResult?.status === 'SCANNING' ? 'info' : 'default'} variant={rfidResult ? 'filled' : 'outlined'} />
            <Typography variant="caption" color="text.disabled">→</Typography>
            <Chip size="small" label="FINAL" color={activeResult === WEIGHING_RESULT.PASS && rfidResult?.status === 'PASS' ? 'success' : 'default'} variant={activeResult === WEIGHING_RESULT.PASS && rfidResult?.status === 'PASS' ? 'filled' : 'outlined'} />
            <Typography variant="caption" color="text.secondary" sx={{ ml: { md: 'auto' } }}>Automatic transition after saved Weight PASS · SIMULATION</Typography>
          </Stack>
          {!running ? <Stack direction="row" spacing={1} alignItems="center">
            <TextField size="small" label="Station" value={stationCode} onChange={(e) => setStationCode(e.target.value)}
              onBlur={() => localStorage.setItem(STORAGE_KEY.WEIGHING_STATION_SSCC, stationCode.trim())} sx={{ width: 165 }} />
            <Typography variant="caption" color="text.secondary">'Press START on the Shipping List, then scan an SSCC.'</Typography>
          </Stack> : null}
          {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 0.9, md: 1.05 } }}>
          <TextField
            inputRef={scanRef}
            fullWidth
            label="Carton SSCC-18"
            InputLabelProps={{ shrink: true }}
            placeholder={!running && !poSessionCompleted ? 'Press START before scanning' : lookup ? 'Carton active' : poSessionCompleted ? 'Scan SSCC to review RFID' : conveyorPosition !== CONVEYOR_POSITION.WEIGHT ? 'Wait for SCALE position' : 'Scan GS1 (00) barcode or SSCC-18, then Enter'}
            value={sscc}
            onChange={(e) => setSscc(e.target.value.replace(/\s+/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                scanSscc();
              }
            }}
            disabled={(!running && !poSessionCompleted) || (!poSessionCompleted && conveyorPosition !== CONVEYOR_POSITION.WEIGHT) || !selectedPoId || busy || !mayWeigh || Boolean(lookup)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color={(running || poSessionCompleted) && !lookup ? 'primary' : 'disabled'} /></InputAdornment>,
              sx: { fontSize: 22, fontWeight: 850, letterSpacing: 1.1 }
            }}
            sx={{ mt: 0.35, '& .MuiOutlinedInput-root': { minHeight: { xs: 52, md: 46 } } }}
          />

          <Divider sx={{ my: 0.65 }} />

          {lookup ? (
            <Stack direction="row" alignItems="center" spacing={1.2} flexWrap="wrap" useFlexGap sx={{ mb: 0.8, px: 0.75, py: 0.6, bgcolor: 'action.hover', borderRadius: 1.3 }}>
              <Typography variant="caption">Carton <b>{lookup.carton?.cartonNo ?? '—'}</b></Typography>
              <Typography variant="caption">Qty <b>{cartonQty(lookup.carton)}</b></Typography>
              <Typography variant="caption">SKU <b>{lookup.po?.sku || lookup.carton?.labelConfirmedSku || '—'}</b></Typography>
              <Typography variant="caption" color="text.secondary">{lookup.po?.style || ''} {lookup.po?.color || ''}</Typography>
            </Stack>
          ) : null}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '0.95fr 1.05fr' }, gap: 1.05, alignItems: 'stretch' }}>
            <Box sx={{ p: 1.05, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', minWidth: 0 }}>
              <Stack spacing={1.05}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" fontWeight={950}>1. Weight</Typography>
                  <Chip size="small" color={activeResult === WEIGHING_RESULT.PASS ? 'success' : activeResult === WEIGHING_RESULT.FAILED ? 'error' : 'default'}
                    label={activeResult === WEIGHING_RESULT.PASS ? 'PASS · SAVED' : activeResult === WEIGHING_RESULT.FAILED ? 'FAILED · SAVED' : lookup ? 'WAITING FOR PLC' : 'WAITING FOR SSCC'} />
                </Stack>

                <Box sx={{ p: 1.1, border: '1px solid', borderColor: 'divider', borderRadius: 1.8, bgcolor: 'background.paper' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={800}>TARGET WEIGHT</Typography>
                      <Typography sx={{ fontSize: 22, fontWeight: 950, lineHeight: 1.2 }}>{lookup ? `${kg(expected)} kg` : '—'}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={800}>ALLOWED RANGE</Typography>
                      <Typography fontWeight={850} fontSize={13}>{lookup && minWeight != null && maxWeight != null ? `${kg(minWeight)}–${kg(maxWeight)} kg` : '—'}</Typography>
                    </Box>
                  </Stack>
                </Box>

                <Box sx={{ p: 1.3, border: '2px solid', borderColor: activeResult === WEIGHING_RESULT.PASS ? 'success.main' : activeResult === WEIGHING_RESULT.FAILED ? 'error.main' : 'primary.light', borderRadius: 2, textAlign: 'center', bgcolor: activeResult === WEIGHING_RESULT.PASS ? 'success.lighter' : activeResult === WEIGHING_RESULT.FAILED ? 'error.lighter' : 'background.paper' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={950}>ACTUAL WEIGHT</Typography>
                  <Typography sx={{ fontSize: { xs: 58, md: 72 }, lineHeight: 0.98, fontWeight: 950, letterSpacing: -2, my: 0.7 }}>
                    {lookup && actual != null ? kg(actual, 3) : '—'}
                  </Typography>
                  <Typography variant="h6" fontWeight={900}>KG</Typography>
                  {activeResult ? (
                    <Chip sx={{ mt: 0.8, fontSize: 17, fontWeight: 950, px: 1.2 }} icon={activeResult === WEIGHING_RESULT.PASS ? <CheckCircleOutline /> : <ErrorOutline />}
                      color={activeResult === WEIGHING_RESULT.PASS ? 'success' : 'error'} label={activeResult} />
                  ) : lookup ? (
                    <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.8} sx={{ mt: 0.8 }}>
                      <CircularProgress size={17} />
                      <Typography fontWeight={850} color="primary.main">Waiting for stable PLC reading</Typography>
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Scan a carton SSCC above to begin weighing.
                    </Typography>
                  )}
                </Box>

                {lookup && !activeResult ? (
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                    <Typography variant="caption" fontWeight={850} color="text.secondary">MANUAL WEIGHT (KG)</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} sx={{ mt: 0.5 }}>
                      <TextField fullWidth size="small" type="number" placeholder="e.g. 0.390" aria-label="Enter manual carton weight in kilograms"
                        value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} inputProps={{ step: '0.001', min: 0.001, inputMode: 'decimal' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                        error={actualWeight.trim() !== '' && (!Number.isFinite(Number(actualWeight)) || Number(actualWeight) < 0.001)}
                        disabled={!running || !mayWeigh || busy} sx={{ minWidth: 0 }} />
                      <Button variant="contained" color="primary" onClick={submitManualWeight}
                        disabled={!running || !mayWeigh || busy || !stationCode.trim() || !actualWeight.trim() || !Number.isFinite(Number(actualWeight)) || Number(actualWeight) < 0.001}
                        sx={{ whiteSpace: 'nowrap', minHeight: 40, px: 2.2 }}>Submit Manual</Button>
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Box>

            <Box sx={{ p: 1.05, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default', minWidth: 0 }}>
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Typography variant="subtitle2" fontWeight={950}>2. Scan RFID</Typography>
                  <Chip size="small" color={rfidResult?.status === 'PASS' ? 'success' : rfidResult?.status === 'FAILED' ? 'error' : rfidResult?.status === 'SCANNING' ? 'info' : 'default'}
                    label={rfidResult?.status === 'PASS' ? 'RFID PASS' : rfidResult?.status === 'FAILED' ? 'RFID HOLD' : rfidResult?.status === 'SCANNING' ? 'SCANNING' : activeResult === WEIGHING_RESULT.PASS ? 'STARTING RFID' : 'WAITING FOR WEIGHT'} />
                </Stack>
                {!lookup ? (
                  <Box sx={{ py: 6, textAlign: 'center', borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <QrCodeScannerOutlined color="disabled" sx={{ fontSize: 30, mb: 0.7 }} />
                    <Typography fontWeight={850} color="text.secondary">Waiting for carton</Typography>
                    <Typography variant="caption" color="text.secondary">RFID will start automatically after the weight is saved as PASS.</Typography>
                  </Box>
                ) : activeResult === WEIGHING_RESULT.FAILED ? (
                  <Alert severity="error">Weight FAILED. This carton is held at SCALE; RFID cannot begin.</Alert>
                ) : activeResult !== WEIGHING_RESULT.PASS ? (
                  <Box sx={{ py: 5.5, textAlign: 'center', borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <CircularProgress size={24} />
                    <Typography fontWeight={850} sx={{ mt: 1 }}>Waiting for Weight PASS</Typography>
                    <Typography variant="caption" color="text.secondary">Once the PLC sends a stable result, the system saves it and activates RFID here.</Typography>
                  </Box>
                ) : (
                  <>
                    {handoffError ? (
                      <Alert severity="error" action={<Button size="small" color="inherit" onClick={retryRfidHandoff} disabled={busy}>Retry</Button>}>
                        Cannot start RFID: {handoffError}. Saved weight is retained.
                      </Alert>
                    ) : null}
                    {rfidResult?.id ? (
                      <>
                        <CartonRfidPanel key={lookup.carton?.id} orderId={orderId} poId={selectedPoId} carton={lookup.carton}
                          stationCode={stationCode}
                          factoryCode={lookup.carton?.factoryCode || selectedSchedule?.schedule?.factoryCode || selectedFactory}
                          admin={admin} onSessionChange={handleRfidSessionChange} />
                        {rfidResult.status === 'PASS' ? (
                          <Alert severity="success" sx={{ py: 0.35 }}>FINAL PASS · Weight and RFID have both passed. Preparing the next carton.</Alert>
                        ) : null}
                        {rfidResult.status === 'FAILED' && running ? (
                          <Button size="small" color="warning" variant="outlined" disabled={busy} onClick={holdRfidAndContinue}>
                            Hold RFID failed · Next carton
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <Box sx={{ py: 5.5, textAlign: 'center', borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', bgcolor: 'background.paper' }}>
                        <CircularProgress size={24} />
                        <Typography fontWeight={850} sx={{ mt: 1 }}>Activating RFID station…</Typography>
                        <Typography variant="caption" color="text.secondary">Saved Weight PASS · automatic handoff in progress.</Typography>
                      </Box>
                    )}
                  </>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Paper>

      {pendingFinalCount > 0 ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5 }}>
          <Chip size="small" color="warning" variant="outlined" label={`${pendingFinalCount} carton(s) awaiting final RFID result`} />
          <Typography variant="caption" color="text.secondary">Saved Weight PASS with RFID SCANNING / PENDING is not FINAL PASS or FINAL FAILED.</Typography>
        </Stack>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.1 }}>
        {resultTable('3. FINAL PASS', WEIGHING_RESULT.PASS, passRows)}
        {resultTable('4. FINAL FAILED', WEIGHING_RESULT.FAILED, failedRows)}
      </Box>



        </Stack>
      </OperationWorkspaceDialog>

      <Dialog open={Boolean(cleanupOrder)} onClose={() => !busy && setCleanupOrder(null)} maxWidth="sm" fullWidth>
        <DialogTitle color="error.main">Remove All · TEST DATA ONLY</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 1.5 }}>
            Permanently delete the selected Order, all POs, Cartons, Items, Shipping, Weight, RFID and Checking data.
            Only use on an isolated TEST database. This action cannot be undone.
          </Alert>
          <Typography sx={{ mb: 1 }}>Selected Order: <b>{cleanupOrder?.orderNo}</b></Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Type <b>DELETE {cleanupOrder?.orderNo}</b> to confirm.
          </Typography>
          <TextField fullWidth size="small" label="Confirmation" value={cleanupConfirmation} onChange={(e) => setCleanupConfirmation(e.target.value)} autoComplete="off" />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => { setCleanupOrder(null); setCleanupConfirmation(''); }}>Cancel</Button>
          <Button color="error" variant="contained" disabled={busy || !cleanupOrder || cleanupConfirmation !== `DELETE ${cleanupOrder.orderNo}`}
            onClick={removeTestOrder}>Permanently Remove All</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmCompletionOpen} onClose={() => !busy && setConfirmCompletionOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Complete weight with RFID exceptions?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            All cartons have passed weight, but RFID verification is not fully complete.
          </Typography>
          <Alert severity="warning">
            {selectedPo?.rfidFailedCartons || 0} RFID FAILED · {Math.max(0, (selectedPo?.rfidRemainingCartons || 0) - (selectedPo?.rfidFailedCartons || 0))} RFID PENDING.
            The PO will be marked <b>WEIGHT COMPLETED</b> with a separate RFID review status.
          </Alert>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            This does not mark RFID as PASS. RFID issues remain available for review or rescan.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirmCompletionOpen(false)}>Keep checking</Button>
          <Button color="warning" variant="contained" disabled={busy} onClick={() => completePo(true)}>
            Complete weight
          </Button>
        </DialogActions>
      </Dialog>

      {!mayWeigh ? <Alert severity="info" icon={<CheckCircleOutline />}>Weight Check permission is required to operate the weighing station.</Alert> : null}
      {!queueLoading && orderId && !queue.length ? <Alert severity="info">No cartons ready for weighing in this Shipping Schedule.</Alert> : null}
    </Stack>
  );
}
