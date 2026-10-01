import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
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
  : `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;

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
  if (status === 'WAITING_WEIGHT') return 'Waiting for PLC';
  if (status === 'WEIGHT_WARNING') return 'Weight warning';
  if (status === 'COMPLETED') return 'Completed';
  return 'Ready';
};

const statusColor = (status) => {
  if (status === 'WEIGHT_WARNING') return 'warning';
  if (status === 'COMPLETED') return 'success';
  if (status === 'WAITING_WEIGHT') return 'info';
  return 'default';
};

function StatCard({ label, value, icon, color = 'primary.main', suffix = '' }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        height: '100%',
        borderRadius: 2.5,
        bgcolor: 'background.paper'
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            flexShrink: 0,
            borderRadius: 2,
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
            {Number(value || 0).toLocaleString('en-US')}{suffix}
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
  const [recentRowsPerPage, setRecentRowsPerPage] = useState(10);
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

  const waiting = transaction?.status === 'WAITING_WEIGHT';
  const completed = ['COMPLETED', 'WEIGHT_WARNING'].includes(transaction?.status);
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
      notify(getApiError(error, 'Unable to load carton loading progress.'), 'error');
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
      notify('Select an Order before submitting a QA Code.', 'warning');
      return;
    }
    if (!stationCode) {
      notify('Select a Scale Station before submitting a QA Code.', 'warning');
      return;
    }
    if (waiting) {
      notify(`Job ${transaction?.jobId} is still waiting for PLC weight.`, 'warning');
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
      notify(getApiError(error, 'Unable to process the QA Code.'), 'error');
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
          listPackingOrders(buyer.code, { page: 0, size: 100 }),
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
        notify(getApiError(error, 'Unable to load Orders or Scale Stations.'), 'error');
      } finally {
        setBusy(false);
      }
    };
    loadSetup();
  }, [buyer?.code, notify]);

  useEffect(() => {
    if (!buyer?.code || !orderId) return;
    localStorage.setItem(orderStorageKey(buyer.code), orderId);
    setTransaction((value) => (value?.status === 'WAITING_WEIGHT' && value.orderId === orderId ? value : null));
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
          notify(`Restored PLC Job ${current.jobId}.`, 'info');
        } else {
          setTransaction(null);
          focusActiveInput();
        }
      } catch (error) {
        notify(getApiError(error, 'Unable to check the current PLC Job.'), 'error');
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
    if (!buyer?.code || !transaction?.id || transaction.status !== 'WAITING_WEIGHT') return undefined;
    const timer = window.setInterval(async () => {
      try {
        const updated = await getCartonTransaction(buyer.code, transaction.id);
        setTransaction(updated);
        if (updated?.status !== 'WAITING_WEIGHT') {
          notify(`PLC weight received: ${formatWeight(updated.weightKg)}.`, updated.status === 'WEIGHT_WARNING' ? 'warning' : 'success');
          await loadOrderState();
        }
      } catch (error) {
        console.error('Unable to poll carton loading transaction', error);
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

      if (event.key === 'Enter') {
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

  if (!buyer?.code) return <Alert severity="warning">Buyer could not be identified.</Alert>;

  return (
    <Box sx={{ width: '100%', p: { xs: 1.25, md: 2.5 } }}>
      <Stack spacing={2}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.75, md: 2.25 },
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(20, 94, 168, 0.08) 0%, rgba(255,255,255,1) 48%)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.4}>
                <QrCodeScannerOutlinedIcon sx={{ color: '#145EA8', fontSize: 32 }} />
                <Typography sx={{ fontSize: { xs: '1.45rem', md: '1.8rem' }, fontWeight: 950, color: '#103B5C' }}>
                  Carton Loading – Zebra Scan & PLC Weight
                </Typography>
              </Stack>
              <Typography color="text.secondary">
                Desktop web station for {buyer.label}. Scan by Zebra USB or enter a QA Code manually; the next carton is assigned automatically.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip icon={<UsbOutlinedIcon />} label="Desktop Web" color="primary" variant="outlined" />
              <Chip
                icon={<QrCodeScannerOutlinedIcon />}
                label={ready ? `${inputMode === 'manual' ? 'Manual Input' : 'Zebra'} Ready` : waiting ? 'Input Locked' : 'Setup Required'}
                color={ready ? 'success' : waiting ? 'warning' : 'default'}
              />
              <Chip
                icon={<ScaleOutlinedIcon />}
                label={selectedStation?.online ? 'PLC Online' : 'PLC Offline'}
                color={selectedStation?.online ? 'success' : 'default'}
                variant="outlined"
              />
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} xl={9}>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                  <TuneOutlinedIcon color="primary" />
                  <Typography variant="h5" fontWeight={950}>Workstation setup</Typography>
                  <Typography variant="body2" color="text.secondary">Select once before starting the loading process.</Typography>
                </Stack>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} lg={6}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Order / WSP"
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
                      label="Scale Station"
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
                      label="Pallet / Location"
                      value={palletCode}
                      onChange={(event) => setPalletCode(event.target.value)}
                      onBlur={focusActiveInput}
                      disabled={waiting || busy}
                      placeholder="P01"
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
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
                  <Grid container spacing={1.25}>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard label="Planned cartons" value={progress.plannedCartons} icon={<Inventory2OutlinedIcon />} />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard
                        label="Completed cartons"
                        value={(progress.completedCartons || 0) + (progress.warningCartons || 0)}
                        icon={<CheckCircleOutlineOutlinedIcon />}
                        color="success.main"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard label="Remaining cartons" value={progress.remainingCartons} icon={<RefreshOutlinedIcon />} color="warning.main" />
                    </Grid>
                    <Grid item xs={12} sm={6} lg={3}>
                      <StatCard label="Order progress" value={percent.toFixed(1)} suffix="%" icon={<HistoryOutlinedIcon />} color="info.main" />
                    </Grid>
                  </Grid>
                  <LinearProgress variant="determinate" value={percent} sx={{ mt: 1.25, height: 9, borderRadius: 8 }} />
                </Paper>
              )}

              <Card
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  borderWidth: 2,
                  borderColor: waiting
                    ? 'warning.main'
                    : completed
                      ? (transaction?.status === 'WEIGHT_WARNING' ? 'warning.main' : 'success.main')
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
                      <Typography variant="h4" fontWeight={950}>QA Code input</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Choose Zebra USB for automatic scanning or Manual Input when the barcode cannot be scanned.
                      </Typography>
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
                        <UsbOutlinedIcon sx={{ mr: 0.75 }} /> Zebra USB
                      </ToggleButton>
                      <ToggleButton value="manual" sx={{ px: 2 }}>
                        <KeyboardOutlinedIcon sx={{ mr: 0.75 }} /> Manual Input
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>

                  <Divider sx={{ mb: 2 }} />

                  {!waiting && !completed && inputMode === 'zebra' && (
                    <Box>
                      <Alert severity="info" sx={{ mb: 1.5 }}>
                        Zebra must be configured as <strong>USB HID Keyboard</strong> with an <strong>Enter suffix</strong>. Scan the QA Code directly; no camera is used.
                      </Alert>
                      <TextField
                        inputRef={scannerInputRef}
                        autoFocus
                        fullWidth
                        label="Zebra USB scan input"
                        value={barcodeInput}
                        onChange={(event) => setBarcodeInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return;
                          event.preventDefault();
                          submitBarcode(event.currentTarget.value, 'zebra');
                        }}
                        disabled={!orderId || !stationCode || busy}
                        placeholder="Scan QA Code with Zebra and press Enter automatically"
                        inputProps={{ autoComplete: 'off', spellCheck: false }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <QrCodeScannerOutlinedIcon color="primary" />
                            </InputAdornment>
                          )
                        }}
                        helperText="The system automatically finds Master Data, selects the next PLANNED carton and creates a PLC weight job."
                      />
                    </Box>
                  )}

                  {!waiting && !completed && inputMode === 'manual' && (
                    <Box>
                      <Alert severity="warning" sx={{ mb: 1.5 }}>
                        Manual Input is provided for damaged or unreadable labels. Enter the complete QA Code exactly as printed on the carton.
                      </Alert>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems="flex-start">
                        <TextField
                          inputRef={manualInputRef}
                          autoFocus
                          fullWidth
                          label="Enter QA Code manually"
                          value={manualBarcodeInput}
                          onChange={(event) => setManualBarcodeInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            submitBarcode(event.currentTarget.value, 'manual');
                          }}
                          disabled={!orderId || !stationCode || busy}
                          placeholder="Example: 000007794158"
                          inputProps={{ autoComplete: 'off', spellCheck: false }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <KeyboardOutlinedIcon color="action" />
                              </InputAdornment>
                            )
                          }}
                          helperText="Press Enter or click Submit QA Code."
                        />
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={<SendOutlinedIcon />}
                          onClick={() => submitBarcode(manualBarcodeInput, 'manual')}
                          disabled={!ready || !manualBarcodeInput.trim()}
                          sx={{ minWidth: 190, height: 56, whiteSpace: 'nowrap' }}
                        >
                          Submit QA Code
                        </Button>
                      </Stack>
                    </Box>
                  )}

                  {busy && <LinearProgress sx={{ mt: 1.5, height: 8, borderRadius: 8 }} />}

                  {waiting && (
                    <Stack spacing={1.5} alignItems="center" textAlign="center" py={2}>
                      <ScaleOutlinedIcon color="warning" sx={{ fontSize: 64 }} />
                      <Box>
                        <Typography variant="h3" fontWeight={950}>Waiting for PLC weight</Typography>
                        <Typography variant="h5" fontWeight={900}>Carton No. {transaction.cartonSequence} · Job {transaction.jobId}</Typography>
                        <Typography color="text.secondary">Article {transaction.articleNumber || '—'} · Station {transaction.stationCode}</Typography>
                      </Box>
                      <Alert severity="warning" sx={{ width: '100%' }}>
                        Place this carton on the scale. Zebra scanning and manual input are locked until PLC returns a stable weight.
                      </Alert>
                      <LinearProgress sx={{ width: '100%', height: 10, borderRadius: 8 }} />
                    </Stack>
                  )}

                  {completed && (
                    <Stack spacing={1.25} alignItems="center" textAlign="center" py={2}>
                      <CheckCircleOutlineOutlinedIcon
                        color={transaction?.status === 'WEIGHT_WARNING' ? 'warning' : 'success'}
                        sx={{ fontSize: 64 }}
                      />
                      <Typography variant="h3" fontWeight={950}>{statusLabel(transaction?.status)}</Typography>
                      <Typography
                        variant="h1"
                        color={transaction?.status === 'WEIGHT_WARNING' ? 'warning.main' : 'success.main'}
                        fontWeight={950}
                      >
                        {formatWeight(transaction?.weightKg)}
                      </Typography>
                      <Typography>Carton No. {transaction?.cartonSequence} · Job {transaction?.jobId}</Typography>
                      {transaction?.warningMessage && <Alert severity="warning" sx={{ width: '100%' }}>{transaction.warningMessage}</Alert>}
                      <Typography variant="caption" color="text.secondary">
                        The workstation will return to the selected QA Code input mode automatically.
                      </Typography>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          <Grid item xs={12} xl={3}>
            <Stack spacing={2} height="100%">
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="h5" fontWeight={950} mb={0.5}>Workstation status</Typography>
                <Typography variant="body2" color="text.secondary" mb={1.25}>Current desktop web station information.</Typography>
                <Divider />
                <DetailRow label="Buyer" value={buyer.label} />
                <Divider />
                <DetailRow label="Order" value={selectedOrder?.orderName} />
                <Divider />
                <DetailRow label="Scale station" value={stationCode} />
                <Divider />
                <DetailRow
                  label="PLC connection"
                  value={selectedStation?.online ? 'Online' : 'Offline'}
                  valueColor={selectedStation?.online ? 'success.main' : 'error.main'}
                />
                <Divider />
                <DetailRow label="Input mode" value={inputMode === 'manual' ? 'Manual Input' : 'Zebra USB'} />
                <Divider />
                <DetailRow label="Pallet / Location" value={palletCode || 'Not specified'} />
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, flexGrow: 1 }}>
                <Typography variant="h5" fontWeight={950} mb={1}>Current job</Typography>
                {transaction ? (
                  <Stack spacing={1}>
                    <Chip
                      label={statusLabel(transaction.status)}
                      color={statusColor(transaction.status)}
                      sx={{ alignSelf: 'flex-start', fontWeight: 850 }}
                    />
                    <DetailRow label="Job ID" value={transaction.jobId} />
                    <Divider />
                    <DetailRow label="Carton No." value={transaction.cartonSequence} />
                    <Divider />
                    <DetailRow label="Article" value={transaction.articleNumber} />
                    <Divider />
                    <DetailRow label="QA Code" value={transaction.barcode} />
                    <Divider />
                    <DetailRow label="Weight" value={formatWeight(transaction.weightKg)} />
                  </Stack>
                ) : (
                  <Alert severity={ready ? 'success' : 'info'}>
                    {ready ? 'The workstation is ready to receive the next QA Code.' : 'Complete the workstation setup to start.'}
                  </Alert>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="h5" fontWeight={950} mb={1}>Automatic workflow</Typography>
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

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} px={2} py={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <HistoryOutlinedIcon color="primary" />
              <Typography variant="h5" fontWeight={950}>Recent scanned cartons</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">Latest records for the selected order</Typography>
          </Stack>
          <Divider />
          {recent.length === 0 ? (
            <Box p={2}>
              <Typography color="text.secondary">No scanned cartons yet.</Typography>
            </Box>
          ) : (
            <>
            <TableContainer>
              <SortableTable disableRowNumber size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 900 }}>Carton No.</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Article</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>QA Code</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Station</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 900 }} align="right">Weight</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Scanned at</TableCell>
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
            </TableContainer>
            <TablePagination component="div" count={recent.length} page={Math.min(recentPage, Math.max(0, Math.ceil(recent.length / recentRowsPerPage) - 1))} rowsPerPage={recentRowsPerPage}
              onPageChange={(_, next) => setRecentPage(next)} onRowsPerPageChange={(e) => { setRecentRowsPerPage(Number(e.target.value)); setRecentPage(0); }} rowsPerPageOptions={[10,20]} />
            </>
          )}
        </Paper>
      </Stack>

      <Snackbar
        open={notice.open}
        autoHideDuration={4500}
        onClose={() => setNotice((value) => ({ ...value, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={notice.severity}
          onClose={() => setNotice((value) => ({ ...value, open: false }))}
          sx={{ width: '100%' }}
        >
          {notice.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
