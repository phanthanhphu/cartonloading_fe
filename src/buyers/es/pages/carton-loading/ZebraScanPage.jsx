import { useT, useSystemMessage } from '../../../../i18n/LanguageProvider';
import StandardTableViewport from 'components/StandardTableViewport';
import { BARCODE_CARTON_STATUS, DEFAULT_TABLE_ROWS_PER_PAGE, LOOKUP_PAGE_SIZE, DEFAULT_PALLET_CODE, FORMAT_LOCALE, KEYBOARD_KEY } from '../../../../constants/appConstants';
import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Grid, InputAdornment, LinearProgress, MenuItem, Paper, Snackbar, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import TablePagination from 'components/LocalizedTablePagination';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import UsbOutlinedIcon from '@mui/icons-material/UsbOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { APP_MESSAGES, createJobWaitingMessage, createPlcWeightReceivedMessage, createRestoredPlcJobMessage } from '../../../../constants/appMessages';

import { getActiveBuyer } from 'utils/buyerAccess';
import { listPackingOrders } from 'buyers/es/services/packingListService';
import { getApiError } from 'utils/apiError';
import {
  getCartonProgress,
  getCartonTransaction,
  getCurrentStationTransaction,
  getRecentCartonTransactions,
  listScaleStations,
  scanNextCarton
} from 'buyers/es/services/cartonLoadingService';

const stationStorageKey = (buyerCode) => `zebraScan.station.${buyerCode || 'default'}`;
const orderStorageKey = (buyerCode) => `zebraScan.order.${buyerCode || 'default'}`;
const palletStorageKey = (buyerCode) => `zebraScan.pallet.${buyerCode || 'default'}`;
const inputModeStorageKey = (buyerCode) => `zebraScan.inputMode.${buyerCode || 'default'}`;

const formatWeight = (value) => value == null
  ? '—'
  : `${Number(value).toLocaleString(FORMAT_LOCALE.EN_US, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const createScanId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `ZEBRA-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const statusLabel = (status) => {
  if (status === BARCODE_CARTON_STATUS.WAITING_WEIGHT) return 'Waiting for PLC';
  if (status === BARCODE_CARTON_STATUS.WEIGHT_WARNING) return 'Weight warning';
  if (status === BARCODE_CARTON_STATUS.COMPLETED) return 'Completed';
  return 'Ready';
};

const statusColor = (status) => {
  if (status === BARCODE_CARTON_STATUS.WEIGHT_WARNING) return 'warning';
  if (status === BARCODE_CARTON_STATUS.COMPLETED) return 'success';
  if (status === BARCODE_CARTON_STATUS.WAITING_WEIGHT) return 'info';
  return 'default';
};

function StatCard({ label, value, icon, color = 'primary.main', suffix = '' }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        height: '100%',
        borderRadius: '4px',
        bgcolor: 'background.paper'
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            flexShrink: 0,
            borderRadius: '4px',
            bgcolor: `${color}14`,
            color,
            display: 'grid',
            placeItems: 'center'
          }}
        >
          {icon}
        </Box>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h4" fontWeight={950} lineHeight={1.1}>
            {Number(value || 0).toLocaleString(FORMAT_LOCALE.EN_US)}{suffix}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function DetailRow({ label, value, valueColor = 'text.primary' }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} py={0.85}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={850} color={valueColor} textAlign="right">{value || '—'}</Typography>
    </Stack>
  );
}

export default function ZebraScanPage() {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const buyer = getActiveBuyer();
  const scannerInputRef = useRef(null);
  const manualInputRef = useRef(null);
  const submitLockedRef = useRef(false);
  const resetTimerRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [stations, setStations] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [palletCode, setPalletCode] = useState('');
  const [inputMode, setInputMode] = useState('zebra');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [progress, setProgress] = useState(null);
  const [recent, setRecent] = useState([]);
  const [recentPage, setRecentPage] = useState(0);
  const [recentRowsPerPage, setRecentRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ open: false, severity: 'success', message: '' });

  const notify = useCallback((message, severity = 'success') => {
    setNotice({ open: true, severity, message });
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === orderId),
    [orderId, orders]
  );

  const selectedStation = useMemo(
    () => stations.find((station) => station.stationCode === stationCode),
    [stations, stationCode]
  );

  const waiting = transaction?.status === BARCODE_CARTON_STATUS.WAITING_WEIGHT;
  const completed = [BARCODE_CARTON_STATUS.COMPLETED, BARCODE_CARTON_STATUS.WEIGHT_WARNING].includes(transaction?.status);
  const ready = Boolean(orderId && stationCode && !busy && !waiting && !completed);
  const percent = progress?.plannedCartons > 0
    ? Math.min(100, ((Number(progress.completedCartons || 0) + Number(progress.warningCartons || 0)) / Number(progress.plannedCartons)) * 100)
    : 0;

  const focusActiveInput = useCallback(() => {
    if (!orderId || !stationCode || busy || waiting || completed) return;
    window.setTimeout(() => {
      if (inputMode === 'manual') manualInputRef.current?.focus();
      else scannerInputRef.current?.focus();
    }, 80);
  }, [busy, completed, inputMode, orderId, stationCode, waiting]);

  const loadOrderState = useCallback(async () => {
    if (!buyer?.code || !orderId) return;
    try {
      const [progressData, recentData] = await Promise.all([
        getCartonProgress(buyer.code, orderId),
        getRecentCartonTransactions(buyer.code, orderId)
      ]);
      setProgress(progressData);
      setRecent(Array.isArray(recentData) ? recentData : []);
      setRecentPage(0);
    } catch (error) {
      notify(getApiError(error, APP_MESSAGES.LOAD_CARTON_PROGRESS_FAILED), 'error');
    }
  }, [buyer?.code, notify, orderId]);

  const clearCompletedResult = useCallback(() => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
    setTransaction(null);
    setBarcodeInput('');
    setManualBarcodeInput('');
    focusActiveInput();
  }, [focusActiveInput]);

  const submitBarcode = useCallback(async (rawValue, source = 'zebra') => {
    const barcode = String(rawValue || '').trim();
    if (!barcode || submitLockedRef.current) return;
    if (!orderId) {
      notify(APP_MESSAGES.SELECT_ORDER_QA, 'warning');
      return;
    }
    if (!stationCode) {
      notify(APP_MESSAGES.SELECT_SCALE_STATION_QA, 'warning');
      return;
    }
    if (waiting) {
      notify(createJobWaitingMessage(transaction?.jobId), 'warning');
      return;
    }

    submitLockedRef.current = true;
    setBusy(true);
    try {
      const created = await scanNextCarton(buyer.code, orderId, {
        stationCode,
        barcode,
        palletCode: palletCode.trim() || null,
        scanId: createScanId()
      });
      setBarcodeInput('');
      setManualBarcodeInput('');
      setTransaction(created);
      notify(
        `${source === 'manual' ? 'Manual QA Code' : 'Zebra scan'} accepted. Carton No. ${created.cartonSequence} assigned to PLC Job ${created.jobId}.`,
        'success'
      );
      await loadOrderState();
    } catch (error) {
      setBarcodeInput('');
      if (source !== 'manual') setManualBarcodeInput('');
      notify(getApiError(error, APP_MESSAGES.QA_PROCESS_FAILED), 'error');
      window.setTimeout(() => {
        if (source === 'manual') manualInputRef.current?.focus();
        else scannerInputRef.current?.focus();
      }, 100);
    } finally {
      submitLockedRef.current = false;
      setBusy(false);
    }
  }, [buyer?.code, loadOrderState, notify, orderId, palletCode, stationCode, transaction?.jobId, waiting]);

  useEffect(() => {
    const loadSetup = async () => {
      if (!buyer?.code) return;
      setBusy(true);
      try {
        const [orderData, stationData] = await Promise.all([
          listPackingOrders(buyer.code, { page: 0, size: LOOKUP_PAGE_SIZE }),
          listScaleStations(true)
        ]);
        const orderRows = Array.isArray(orderData?.content) ? orderData.content : [];
        const stationRows = Array.isArray(stationData) ? stationData : [];
        setOrders(orderRows);
        setStations(stationRows);

        const query = new URLSearchParams(window.location.search);
        const queryOrder = query.get('order');
        const queryStation = query.get('station');
        const savedOrder = localStorage.getItem(orderStorageKey(buyer.code));
        const savedStation = localStorage.getItem(stationStorageKey(buyer.code));
        const savedPallet = localStorage.getItem(palletStorageKey(buyer.code));
        const savedInputMode = localStorage.getItem(inputModeStorageKey(buyer.code));

        setOrderId(orderRows.some((row) => row.id === queryOrder) ? queryOrder
          : orderRows.some((row) => row.id === savedOrder) ? savedOrder : (orderRows[0]?.id || ''));
        setStationCode(stationRows.some((row) => row.stationCode === queryStation) ? queryStation
          : stationRows.some((row) => row.stationCode === savedStation) ? savedStation : (stationRows[0]?.stationCode || ''));
        setPalletCode(savedPallet || '');
        setInputMode(savedInputMode === 'manual' ? 'manual' : 'zebra');
      } catch (error) {
        notify(getApiError(error, APP_MESSAGES.LOAD_ORDERS_SCALE_STATIONS_FAILED), 'error');
      } finally {
        setBusy(false);
      }
    };
    loadSetup();
  }, [buyer?.code, notify]);

  useEffect(() => {
    if (!buyer?.code || !orderId) return;
    localStorage.setItem(orderStorageKey(buyer.code), orderId);
    setTransaction((value) => (value?.status === BARCODE_CARTON_STATUS.WAITING_WEIGHT && value.orderId === orderId ? value : null));
    setBarcodeInput('');
    setManualBarcodeInput('');
    loadOrderState();
  }, [buyer?.code, loadOrderState, orderId]);

  useEffect(() => {
    if (!buyer?.code || !stationCode) return;
    localStorage.setItem(stationStorageKey(buyer.code), stationCode);
    const restoreWaitingJob = async () => {
      try {
        const current = await getCurrentStationTransaction(buyer.code, stationCode);
        if (current?.id) {
          setTransaction(current);
          if (current.orderId && current.orderId !== orderId) setOrderId(current.orderId);
          notify(createRestoredPlcJobMessage(current.jobId), 'info');
        } else {
          setTransaction(null);
          focusActiveInput();
        }
      } catch (error) {
        notify(getApiError(error, APP_MESSAGES.CHECK_PLC_JOB_FAILED), 'error');
      }
    };
    restoreWaitingJob();
  }, [buyer?.code, focusActiveInput, notify, stationCode]); // A restored Job can switch the selected Order.

  useEffect(() => {
    if (!buyer?.code) return;
    localStorage.setItem(palletStorageKey(buyer.code), palletCode);
  }, [buyer?.code, palletCode]);

  useEffect(() => {
    if (!buyer?.code) return;
    localStorage.setItem(inputModeStorageKey(buyer.code), inputMode);
    setBarcodeInput('');
    setManualBarcodeInput('');
    focusActiveInput();
  }, [buyer?.code, focusActiveInput, inputMode]);

  useEffect(() => {
    focusActiveInput();
  }, [focusActiveInput]);

  useEffect(() => {
    if (!buyer?.code || !transaction?.id || transaction.status !== BARCODE_CARTON_STATUS.WAITING_WEIGHT) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const updated = await getCartonTransaction(buyer.code, transaction.id);
        setTransaction(updated);
        if (updated?.status !== BARCODE_CARTON_STATUS.WAITING_WEIGHT) {
          notify(createPlcWeightReceivedMessage(formatWeight(updated.weightKg)), updated.status === BARCODE_CARTON_STATUS.WEIGHT_WARNING ? 'warning' : 'success');
          await loadOrderState();
        }
      } catch (error) {
        console.error(trUi("Unable to poll carton loading transaction"), error);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [buyer?.code, loadOrderState, notify, transaction?.id, transaction?.status]);

  useEffect(() => {
    if (!completed) return undefined;
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(clearCompletedResult, 3500);
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    };
  }, [clearCompletedResult, completed]);

  useEffect(() => () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
  }, []);

  /*
   * Zebra is configured as USB HID Keyboard. In Zebra mode, the dedicated input normally keeps focus.
   * This fallback also accepts a fast scanner sequence when focus is on a non-input area of the page.
   */
  useEffect(() => {
    if (inputMode !== 'zebra') return undefined;

    let buffer = '';
    let lastKeyAt = 0;
    const handleGlobalKeyDown = (event) => {
      if (!ready || event.ctrlKey || event.altKey || event.metaKey) return;
      if (document.activeElement === scannerInputRef.current) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const now = Date.now();
      if (now - lastKeyAt > 180) buffer = '';
      lastKeyAt = now;

      if (event.key === KEYBOARD_KEY.ENTER) {
        const code = buffer.trim();
        buffer = '';
        if (code) {
          event.preventDefault();
          submitBarcode(code, 'zebra');
        }
        return;
      }
      if (event.key.length === 1) buffer += event.key;
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [inputMode, ready, submitBarcode]);

  if (!buyer?.code) return <Alert severity="warning">{APP_MESSAGES.BUYER_NOT_IDENTIFIED}</Alert>;

  return (
    <Box sx={{ width: '100%', p: { xs: 1.25, md: 2.5 } }}>
      <Stack spacing={2}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.75, md: 2.25 },
            borderRadius: '4px',
            background: 'linear-gradient(135deg, rgba(20, 94, 168, 0.08) 0%, rgba(255,255,255,1) 48%)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.4}>
                <QrCodeScannerOutlinedIcon sx={{ color: '#145EA8', fontSize: 32 }} />
                <Typography sx={{ fontSize: { xs: '1.45rem', md: '1.8rem' }, fontWeight: 950, color: '#103B5C' }}>{trUi("\n                  Carton Loading – Zebra Scan & PLC Weight\n                ")}</Typography>
              </Stack>
              <Typography color="text.secondary">{trUi("\n                Desktop web station for ")}{buyer.label}{trUi(". Scan by Zebra USB or enter a QA Code manually; the next carton is assigned automatically.\n              ")}</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip icon={<UsbOutlinedIcon />} label={trUi("Desktop Web")} color="primary" variant="outlined" />
              <Chip
                icon={<QrCodeScannerOutlinedIcon />}
                label={ready ? `${inputMode === 'manual' ? trUi("Manual Input") : 'Zebra'} Ready` : waiting ? trUi("Input Locked") : trUi("Setup Required")}
                color={ready ? 'success' : waiting ? 'warning' : 'default'}
              />
              <Chip
                icon={<ScaleOutlinedIcon />}
                label={selectedStation?.online ? trUi("PLC Online") : trUi("PLC Offline")}
                color={selectedStation?.online ? 'success' : 'default'}
                variant="outlined"
              />
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} xl={9}>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: '4px' }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                  <TuneOutlinedIcon color="primary" />
                  <Typography variant="h5" fontWeight={950}>{trUi("Workstation setup")}</Typography>
                  <Typography variant="body2" color="text.secondary">{trUi("Select once before starting the loading process.")}</Typography>
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} lg={6}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={trUi("Order / WSP")}
                      value={orderId}
                      onChange={(event) => {
                        setOrderId(event.target.value);
                        focusActiveInput();
                      }}
                      disabled={waiting || busy}
                    >
                      {orders.map((order) => <MenuItem key={order.id} value={order.id}>{order.orderName}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} lg={3}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={trUi("Scale Station")}
                      value={stationCode}
                      onChange={(event) => {
                        setStationCode(event.target.value);
                        focusActiveInput();
                      }}
                      disabled={waiting || busy}
                    >
                      {stations.map((station) => <MenuItem key={station.stationCode} value={station.stationCode}>{station.stationCode}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} lg={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label={trUi("Pallet / Location")}
                      value={palletCode}
                      onChange={(event) => setPalletCode(event.target.value)}
                      onBlur={focusActiveInput}
                      disabled={waiting || busy}
                      placeholder={DEFAULT_PALLET_CODE}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <WarehouseOutlinedIcon color="action" />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                </Grid>
              </Paper>

              {progress && (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '4px' }}>
                  <Grid container spacing={1.25}>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard label={trUi("Planned cartons")} value={progress.plannedCartons} icon={<Inventory2OutlinedIcon />} />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard
                        label={trUi("Completed cartons")}
                        value={(progress.completedCartons || 0) + (progress.warningCartons || 0)}
                        icon={<CheckCircleOutlineOutlinedIcon />}
                        color="success.main"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard label={trUi("Remaining cartons")} value={progress.remainingCartons} icon={<RefreshOutlinedIcon />} color="warning.main" />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard label={trUi("Order progress")} value={percent.toFixed(1)} suffix="%" icon={<HistoryOutlinedIcon />} color="info.main" />
                    </Grid>
                  </Grid>
                  <LinearProgress variant="determinate" value={percent} sx={{ mt: 1.25, height: 9, borderRadius: '4px' }} />
                </Paper>
              )}

              <Card
                variant="outlined"
                sx={{
                  borderRadius: '4px',
                  borderWidth: 2,
                  borderColor: waiting
                    ? 'warning.main'
                    : completed
                      ? (transaction?.status === BARCODE_CARTON_STATUS.WEIGHT_WARNING ? 'warning.main' : 'success.main')
                      : 'primary.main'
                }}
              >
                <CardContent sx={{ p: { xs: 1.75, md: 2.5 } }}>
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ md: 'center' }}
                    spacing={1.25}
                    mb={2}
                  >
                    <Box>
                      <Typography variant="h4" fontWeight={950}>{trUi("QA Code input")}</Typography>
                      <Typography variant="body2" color="text.secondary">{trUi("\n                        Choose Zebra USB for automatic scanning or Manual Input when the barcode cannot be scanned.\n                      ")}</Typography>
                    </Box>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      color="primary"
                      value={inputMode}
                      onChange={(_event, nextMode) => {
                        if (!nextMode) return;
                        setInputMode(nextMode);
                      }}
                      disabled={waiting || busy || completed}
                    >
                      <ToggleButton value="zebra" sx={{ px: 2 }}>
                        <UsbOutlinedIcon sx={{ mr: 0.75 }} />{trUi(" Zebra USB\n                      ")}</ToggleButton>
                      <ToggleButton value="manual" sx={{ px: 2 }}>
                        <KeyboardOutlinedIcon sx={{ mr: 0.75 }} />{trUi(" Manual Input\n                      ")}</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>

                  <Divider sx={{ mb: 2 }} />

                  {!waiting && !completed && inputMode === 'zebra' && (
                    <Box>
                      <Alert severity="info" sx={{ mb: 1.5 }}>{trUi("\n                        Zebra must be configured as ")}<strong>{trUi("USB HID Keyboard")}</strong>{trUi(" with an ")}<strong>{trUi("Enter suffix")}</strong>{trUi(". Scan the QA Code directly; no camera is used.\n                      ")}</Alert>
                      <TextField
                        inputRef={scannerInputRef}
                        autoFocus
                        fullWidth
                        label={trUi("Zebra USB scan input")}
                        value={barcodeInput}
                        onChange={(event) => setBarcodeInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== KEYBOARD_KEY.ENTER) return;
                          event.preventDefault();
                          submitBarcode(event.currentTarget.value, 'zebra');
                        }}
                        disabled={!orderId || !stationCode || busy}
                        placeholder={trUi("Scan QA Code with Zebra and press Enter automatically")}
                        inputProps={{ autoComplete: 'off', spellCheck: false }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <QrCodeScannerOutlinedIcon color="primary" />
                            </InputAdornment>
                          )
                        }}
                        helperText={APP_MESSAGES.ZEBRA_AUTO_JOB_HELPER}
                      />
                    </Box>
                  )}

                  {!waiting && !completed && inputMode === 'manual' && (
                    <Box>
                      <Alert severity="warning" sx={{ mb: 1.5 }}>{trUi("\n                        Manual Input is provided for damaged or unreadable labels. Enter the complete QA Code exactly as printed on the carton.\n                      ")}</Alert>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="flex-start">
                        <TextField
                          inputRef={manualInputRef}
                          autoFocus
                          fullWidth
                          label={trUi("Enter QA Code manually")}
                          value={manualBarcodeInput}
                          onChange={(event) => setManualBarcodeInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== KEYBOARD_KEY.ENTER) return;
                            event.preventDefault();
                            submitBarcode(event.currentTarget.value, 'manual');
                          }}
                          disabled={!orderId || !stationCode || busy}
                          placeholder={trUi("Example: 000007794158")}
                          inputProps={{ autoComplete: 'off', spellCheck: false }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <KeyboardOutlinedIcon color="action" />
                              </InputAdornment>
                            )
                          }}
                          helperText={APP_MESSAGES.ZEBRA_QA_SUBMIT_HELPER}
                        />
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={<SendOutlinedIcon />}
                          onClick={() => submitBarcode(manualBarcodeInput, 'manual')}
                          disabled={!ready || !manualBarcodeInput.trim()}
                          sx={{ minWidth: 190, height: 56, whiteSpace: 'nowrap' }}
                        >{trUi("\n                          Submit QA Code\n                        ")}</Button>
                      </Stack>
                    </Box>
                  )}

                  {busy && <LinearProgress sx={{ mt: 1.5, height: 8, borderRadius: '4px' }} />}

                  {waiting && (
                    <Stack spacing={1.5} alignItems="center" textAlign="center" py={2}>
                      <ScaleOutlinedIcon color="warning" sx={{ fontSize: 64 }} />
                      <Box>
                        <Typography variant="h3" fontWeight={950}>{trUi("Waiting for PLC weight")}</Typography>
                        <Typography variant="h5" fontWeight={900}>{trUi("Carton No. ")}{transaction.cartonSequence}{trUi(" · Job ")}{transaction.jobId}</Typography>
                        <Typography color="text.secondary">{trUi("Article ")}{transaction.articleNumber || '—'}{trUi(" · Station ")}{transaction.stationCode}</Typography>
                      </Box>
                      <Alert severity="warning" sx={{ width: '100%' }}>{trUi("\n                        Place this carton on the scale. Zebra scanning and manual input are locked until PLC returns a stable weight.\n                      ")}</Alert>
                      <LinearProgress sx={{ width: '100%', height: 10, borderRadius: '4px' }} />
                    </Stack>
                  )}

                  {completed && (
                    <Stack spacing={1.25} alignItems="center" textAlign="center" py={2}>
                      <CheckCircleOutlineOutlinedIcon
                        color={transaction?.status === BARCODE_CARTON_STATUS.WEIGHT_WARNING ? 'warning' : 'success'}
                        sx={{ fontSize: 64 }}
                      />
                      <Typography variant="h3" fontWeight={950}>{statusLabel(transaction?.status)}</Typography>
                      <Typography
                        variant="h1"
                        color={transaction?.status === BARCODE_CARTON_STATUS.WEIGHT_WARNING ? 'warning.main' : 'success.main'}
                        fontWeight={950}
                      >
                        {formatWeight(transaction?.weightKg)}
                      </Typography>
                      <Typography>{trUi("Carton No. ")}{transaction?.cartonSequence}{trUi(" · Job ")}{transaction?.jobId}</Typography>
                      {transaction?.warningMessage && <Alert severity="warning" sx={{ width: '100%' }}>{transaction.warningMessage}</Alert>}
                      <Typography variant="caption" color="text.secondary">{trUi("\n                        The workstation will return to the selected QA Code input mode automatically.\n                      ")}</Typography>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          <Grid item xs={12} xl={3}>
            <Stack spacing={2} height="100%">
              <Paper variant="outlined" sx={{ p: 2, borderRadius: '4px' }}>
                <Typography variant="h5" fontWeight={950} mb={0.5}>{trUi("Workstation status")}</Typography>
                <Typography variant="body2" color="text.secondary" mb={1.25}>{trUi("Current desktop web station information.")}</Typography>
                <Divider />
                <DetailRow label={trUi("Buyer")} value={buyer.label} />
                <Divider />
                <DetailRow label={trUi("Order")} value={selectedOrder?.orderName} />
                <Divider />
                <DetailRow label={trUi("Scale station")} value={stationCode} />
                <Divider />
                <DetailRow
                  label={trUi("PLC connection")}
                  value={selectedStation?.online ? 'Online' : 'Offline'}
                  valueColor={selectedStation?.online ? 'success.main' : 'error.main'}
                />
                <Divider />
                <DetailRow label={trUi("Input mode")} value={inputMode === 'manual' ? 'Manual Input' : 'Zebra USB'} />
                <Divider />
                <DetailRow label={trUi("Pallet / Location")} value={palletCode || 'Not specified'} />
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: '4px', flexGrow: 1 }}>
                <Typography variant="h5" fontWeight={950} mb={1}>{trUi("Current job")}</Typography>
                {transaction ? (
                  <Stack spacing={1}>
                    <Chip
                      label={statusLabel(transaction.status)}
                      color={statusColor(transaction.status)}
                      sx={{ alignSelf: 'flex-start', fontWeight: 850 }}
                    />
                    <DetailRow label={trUi("Job ID")} value={transaction.jobId} />
                    <Divider />
                    <DetailRow label={trUi("Carton No.")} value={transaction.cartonSequence} />
                    <Divider />
                    <DetailRow label={trUi("Article")} value={transaction.articleNumber} />
                    <Divider />
                    <DetailRow label={trUi("QA Code")} value={transaction.barcode} />
                    <Divider />
                    <DetailRow label={trUi("Weight")} value={formatWeight(transaction.weightKg)} />
                  </Stack>
                ) : (
                  <Alert severity={ready ? 'success' : 'info'}>
                    {ready ? trUi("The workstation is ready to receive the next QA Code.") : trUi("Complete the workstation setup to start.")}
                  </Alert>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: '4px' }}>
                <Typography variant="h5" fontWeight={950} mb={1}>{trUi("Automatic workflow")}</Typography>
                <Stack spacing={1}>
                  {[
                    '1. Receive QA Code',
                    '2. Find Master Data',
                    '3. Select next PLANNED carton',
                    '4. Create PLC weight job',
                    '5. Receive stable weight',
                    '6. Complete and continue'
                  ].map((step) => (
                    <Typography key={step} variant="body2" color="text.secondary">{step}</Typography>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Grid>
        </Grid>

        <Paper variant="outlined" sx={{ borderRadius: '4px', overflow: 'hidden' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} px={2} py={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <HistoryOutlinedIcon color="primary" />
              <Typography variant="h5" fontWeight={950}>{trUi("Recent scanned cartons")}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">{trUi("Latest records for the selected order")}</Typography>
          </Stack>
          <Divider />
          {recent.length === 0 ? (
            <Box p={2}>
              <Typography color="text.secondary">{trUi("No scanned cartons yet.")}</Typography>
            </Box>
          ) : (
            <>
            <StandardTableViewport>
              <SortableTable disableRowNumber size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 900 }}>{trUi("Carton No.")}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{trUi("Article")}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{trUi("QA Code")}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{trUi("Station")}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{trUi("Status")}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }} align="right">{trUi("Weight")}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{trUi("Scanned at")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recent.slice(recentPage * recentRowsPerPage, recentPage * recentRowsPerPage + recentRowsPerPage).map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ fontWeight: 850 }}>{row.cartonSequence ?? '—'}</TableCell>
                      <TableCell>{row.articleNumber || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 260, wordBreak: 'break-all' }}>{row.barcode || '—'}</TableCell>
                      <TableCell>{row.stationCode || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={statusLabel(row.status)} color={statusColor(row.status)} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 850 }}>{formatWeight(row.weightKg)}</TableCell>
                      <TableCell>{formatDateTime(row.scannedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </SortableTable>
            </StandardTableViewport>
            <TablePagination component="div" count={recent.length} page={Math.min(recentPage, Math.max(0, Math.ceil(recent.length / recentRowsPerPage) - 1))} rowsPerPage={recentRowsPerPage}
              onPageChange={(_, next) => setRecentPage(next)} onRowsPerPageChange={(e) => { setRecentRowsPerPage(Number(e.target.value)); setRecentPage(0); }} rowsPerPageOptions={[10,20]} />
            </>
          )}
        </Paper>
      </Stack>

      <Snackbar
        open={notice.open}
        autoHideDuration={5000}
        onClose={() => setNotice((value) => ({ ...value, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={notice.severity}
          onClose={() => setNotice((value) => ({ ...value, open: false }))}
          sx={{ width: '100%' }}
        >
          {trSystem(notice.message)}
        </Alert>
      </Snackbar>
    </Box>
  );
}
