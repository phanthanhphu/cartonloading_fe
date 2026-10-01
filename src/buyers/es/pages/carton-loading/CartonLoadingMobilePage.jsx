import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ScaleOutlinedIcon from '@mui/icons-material/ScaleOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';

import { getActiveBuyer } from 'utils/buyerAccess';
import { listPackingOrders } from 'buyers/es/services/packingListService';
import { getApiError } from 'utils/apiError';
import {
  completePlannedCartonManually,
  getCartonProgress,
  getCartonTransaction,
  getCurrentStationTransaction,
  listCartonsForItem,
  listScaleStations,
  lookupGeneratedCartonItems,
  scanPlannedCarton,
  submitManualWeight
} from 'buyers/es/services/cartonLoadingService';

const formatWeight = (value) => value == null
  ? '—'
  : `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`;
const stationStorageKey = (buyerCode) => `cartonLoading.station.${buyerCode || 'default'}`;
const orderStorageKey = (buyerCode) => `cartonLoading.order.${buyerCode || 'default'}`;
const modeStorageKey = (buyerCode) => `cartonLoading.weightMode.${buyerCode || 'default'}`;

const statusMeta = (status) => {
  if (status === 'COMPLETED') return { label: 'Weighed', color: 'success' };
  if (status === 'WEIGHT_WARNING') return { label: 'Weight warning', color: 'error' };
  if (status === 'WAITING_WEIGHT') return { label: 'Waiting for PLC', color: 'warning' };
  return { label: 'Not scanned', color: 'default' };
};

const weightMeta = (status) => {
  if (status === 'OK') return { label: 'OK', color: 'success' };
  if (status === 'UNDER') return { label: 'Underweight', color: 'error' };
  if (status === 'OVER') return { label: 'Overweight', color: 'warning' };
  if (status === 'NO_STANDARD') return { label: 'No standard', color: 'info' };
  return { label: 'Not weighed', color: 'default' };
};

function StatCard({ label, value, icon, color = 'primary.main' }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.1, height: '100%', borderRadius: 2 }}>
      <Stack direction="row" spacing={0.8} alignItems="center">
        <Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: `${color}14`, color, display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h5" fontWeight={950}>{Number(value || 0).toLocaleString('en-US')}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function MasterItemCard({ item, selected, disabled, onClick }) {
  const done = Number(item.completedCartons || 0);
  const total = Number(item.plannedCartons || 0);
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper'
      }}
    >
      <CardActionArea disabled={disabled} onClick={() => onClick(item)}>
        <CardContent sx={{ p: 1.4, '&:last-child': { pb: 1.4 } }}>
          <Stack spacing={0.8}>
            <Stack direction="row" justifyContent="space-between" spacing={1}>
              <Box minWidth={0}>
                <Typography fontWeight={950} color="primary.main">Article {item.articleNumber || '—'}</Typography>
                <Typography variant="body2" fontWeight={800} noWrap>Size {item.size || '—'} · {item.color || '—'}</Typography>
              </Box>
              <Chip size="small" color={done >= total && total > 0 ? 'success' : 'primary'} label={`${done}/${total}`} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Supplier {item.supplierNumber || '—'} · PO {item.poNumber || '—'} · Qty {item.qtyPerCarton ?? '—'} · Remaining {Number(item.notScannedCartons || 0)}
            </Typography>
            <Typography variant="caption" color="primary.main" fontWeight={800} noWrap>
              {item.firstItemKey || '—'} → {item.lastItemKey || '—'}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ChildCartonCard({ carton, disabled, onClick }) {
  const status = statusMeta(carton.status);
  const weight = weightMeta(carton.weightStatus);
  const canSelect = carton.status === 'PLANNED' && !disabled;
  const source = carton.weightSource || (carton.manualReason ? 'MANUAL' : (carton.weightKg != null ? 'PLC' : null));
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        height: '100%',
        borderColor: carton.status === 'WAITING_WEIGHT' ? 'warning.main' : carton.status === 'COMPLETED' ? 'success.light' : 'divider'
      }}
    >
      <CardActionArea disabled={!canSelect} onClick={() => onClick(carton)} sx={{ height: '100%' }}>
        <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
          <Stack spacing={0.7}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.5}>
              <Typography variant="h5" fontWeight={950}>No. {carton.cartonSequence ?? carton.itemSequence}</Typography>
              <Chip size="small" label={status.label} color={status.color} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {carton.itemKey || carton.cartonCode || '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No. {carton.cartonSequence ?? carton.itemSequence}/{carton.plannedCartons ?? carton.itemTotal} · {carton.cartonPcs ?? carton.qtyPerCarton ?? '—'} PCS
            </Typography>
            {carton.weightKg != null && (
              <Box>
                <Typography fontWeight={950} color="success.main">{formatWeight(carton.weightKg)}</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={weight.label} color={weight.color} />
                  <Typography variant="caption" color="text.secondary">Source: {source === 'MANUAL' ? 'Manual' : 'PLC'}</Typography>
                </Stack>
                {carton.expectedWeightKg != null && <Typography variant="caption" color="text.secondary">Standard {formatWeight(carton.expectedWeightKg)} · Difference {formatWeight(carton.weightDifferenceKg)}</Typography>}
              </Box>
            )}
            {carton.status === 'PLANNED' && <Typography variant="caption" fontWeight={800} color="primary.main">Tap to scan/weigh</Typography>}
            {carton.status === 'WAITING_WEIGHT' && <Typography variant="caption" color="warning.main">Job {carton.jobId}</Typography>}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function CartonLoadingMobilePage() {
  const buyer = getActiveBuyer();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorTimerRef = useRef(null);
  const lookupLockedRef = useRef(false);

  const [orders, setOrders] = useState([]);
  const [stations, setStations] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [palletCode, setPalletCode] = useState('');
  const [weightMode, setWeightMode] = useState('PLC');

  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [matchedItems, setMatchedItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [childCartons, setChildCartons] = useState([]);
  const [progress, setProgress] = useState(null);

  const [selectedCarton, setSelectedCarton] = useState(null);
  const [plcConfirmOpen, setPlcConfirmOpen] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualContext, setManualContext] = useState('PLANNED');
  const [manualWeight, setManualWeight] = useState('');
  const [manualReason, setManualReason] = useState('Manual entry required by operation');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('Place the QR/barcode inside the frame');
  const [busy, setBusy] = useState(false);
  const [childLoading, setChildLoading] = useState(false);
  const [notice, setNotice] = useState({ open: false, severity: 'success', message: '' });

  const notify = useCallback((message, severity = 'success') => setNotice({ open: true, severity, message }), []);
  const selectedStation = useMemo(() => stations.find((item) => item.stationCode === stationCode), [stations, stationCode]);
  const waiting = transaction?.status === 'WAITING_WEIGHT';
  const completed = ['COMPLETED', 'WEIGHT_WARNING'].includes(transaction?.status);
  const percent = progress?.plannedCartons > 0
    ? Math.min(100, ((Number(progress.completedCartons || 0) + Number(progress.warningCartons || 0)) / Number(progress.plannedCartons)) * 100)
    : 0;

  const stopCamera = useCallback(() => {
    if (detectorTimerRef.current) window.clearInterval(detectorTimerRef.current);
    detectorTimerRef.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const loadProgress = useCallback(async () => {
    if (!buyer?.code || !orderId) return;
    try {
      setProgress(await getCartonProgress(buyer.code, orderId));
    } catch (error) {
      notify(getApiError(error, 'Unable to load item progress.'), 'error');
    }
  }, [buyer?.code, notify, orderId]);

  const loadChildren = useCallback(async (item) => {
    if (!buyer?.code || !orderId || !item?.masterLineId) {
      setChildCartons([]);
      return;
    }
    setChildLoading(true);
    try {
      const rows = await listCartonsForItem(buyer.code, orderId, item.masterLineId);
      setChildCartons(Array.isArray(rows) ? rows : []);
    } catch (error) {
      notify(getApiError(error, 'Unable to load the child item list.'), 'error');
      setChildCartons([]);
    } finally {
      setChildLoading(false);
    }
  }, [buyer?.code, notify, orderId]);

  const selectItem = useCallback(async (item) => {
    setSelectedItem(item);
    await loadChildren(item);
  }, [loadChildren]);

  const performLookup = useCallback(async (rawValue, options = {}) => {
    const value = String(rawValue || '').trim();
    if (!value || !buyer?.code || !orderId || lookupLockedRef.current) return;
    lookupLockedRef.current = true;
    setBusy(true);
    try {
      const result = await lookupGeneratedCartonItems(buyer.code, orderId, value);
      if (!result?.matched) {
        setScannedBarcode('');
        setMatchedItems([]);
        setSelectedItem(null);
        setChildCartons([]);
        notify(result?.message || 'No matching item was found in the WSP data.', 'error');
        return;
      }
      const items = Array.isArray(result.items) ? result.items : [];
      setScannedBarcode(value);
      setBarcodeInput(value);
      setMatchedItems(items);

      const preferredMasterLineId = options.preferredMasterLineId || selectedItem?.masterLineId;
      const preferred = items.find((item) => item.masterLineId === preferredMasterLineId);
      const nextItem = preferred || (items.length === 1 ? items[0] : null);
      if (nextItem) {
        setSelectedItem(nextItem);
        await loadChildren(nextItem);
      } else {
        setSelectedItem(null);
        setChildCartons([]);
      }
      stopCamera();
      notify(items.length === 1 ? `Article ${items[0].articleNumber} found. Select child item 1–${items[0].plannedCartons}.` : `${items.length} items use the same Article. Select the correct Size/Color.`, 'success');
    } catch (error) {
      notify(getApiError(error, 'Unable to match the barcode with the Order data.'), 'error');
    } finally {
      lookupLockedRef.current = false;
      setBusy(false);
    }
  }, [buyer?.code, loadChildren, notify, orderId, selectedItem?.masterLineId, stopCamera]);

  const refreshMatchedData = useCallback(async () => {
    await loadProgress();
    if (scannedBarcode) {
      await performLookup(scannedBarcode, { preferredMasterLineId: selectedItem?.masterLineId });
    }
  }, [loadProgress, performLookup, scannedBarcode, selectedItem?.masterLineId]);

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
        const savedMode = localStorage.getItem(modeStorageKey(buyer.code));
        setOrderId(orderRows.some((row) => row.id === queryOrder) ? queryOrder
          : orderRows.some((row) => row.id === savedOrder) ? savedOrder : (orderRows[0]?.id || ''));
        setStationCode(stationRows.some((row) => row.stationCode === queryStation) ? queryStation
          : stationRows.some((row) => row.stationCode === savedStation) ? savedStation : (stationRows[0]?.stationCode || ''));
        setWeightMode(savedMode === 'MANUAL' ? 'MANUAL' : 'PLC');
      } catch (error) {
        notify(getApiError(error, 'Unable to load the Order or scale stations.'), 'error');
      } finally {
        setBusy(false);
      }
    };
    loadSetup();
  }, [buyer?.code, notify]);

  useEffect(() => {
    if (!buyer?.code || !orderId) return;
    localStorage.setItem(orderStorageKey(buyer.code), orderId);
    setBarcodeInput('');
    setScannedBarcode('');
    setMatchedItems([]);
    setSelectedItem(null);
    setChildCartons([]);
    setTransaction(null);
    loadProgress();
  }, [buyer?.code, loadProgress, orderId]);

  useEffect(() => {
    if (!buyer?.code || !stationCode) return;
    localStorage.setItem(stationStorageKey(buyer.code), stationCode);
    const resume = async () => {
      try {
        const current = await getCurrentStationTransaction(buyer.code, stationCode);
        if (current?.id) {
          setTransaction(current);
          if (current.orderId && current.orderId !== orderId) setOrderId(current.orderId);
          setScannedBarcode(current.barcode || '');
          setBarcodeInput(current.barcode || '');
          notify(`Restored Job ${current.jobId}, which is waiting for PLC.`, 'info');
        }
      } catch (error) {
        notify(getApiError(error, 'Unable to check the waiting Job.'), 'error');
      }
    };
    resume();
  }, [buyer?.code, notify, stationCode]); // orderId intentionally omitted

  useEffect(() => {
    if (!buyer?.code) return;
    localStorage.setItem(modeStorageKey(buyer.code), weightMode);
  }, [buyer?.code, weightMode]);

  useEffect(() => {
    if (!buyer?.code || !transaction?.id || transaction.status !== 'WAITING_WEIGHT') return undefined;
    const timer = window.setInterval(async () => {
      try {
        const updated = await getCartonTransaction(buyer.code, transaction.id);
        setTransaction(updated);
        if (updated?.status !== 'WAITING_WEIGHT') {
          notify(`PLC submitted weight ${formatWeight(updated.weightKg)}.`, 'success');
          await refreshMatchedData();
        }
      } catch (error) {
        console.error('Unable to poll carton transaction', error);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [buyer?.code, notify, refreshMatchedData, transaction?.id, transaction?.status]);

  const chooseChild = (carton) => {
    if (waiting) {
      notify(`Station ${stationCode} already has Job ${transaction?.jobId} waiting for PLC.`, 'warning');
      return;
    }
    if (!stationCode) {
      notify('Select a scale station first.', 'warning');
      return;
    }
    if (!scannedBarcode) {
      notify('Scan the item label first.', 'warning');
      return;
    }
    setSelectedCarton(carton);
    if (weightMode === 'MANUAL') {
      setManualContext('PLANNED');
      setManualWeight('');
      setManualReason('Manual entry required by operation');
      setManualOpen(true);
    } else {
      setPlcConfirmOpen(true);
    }
  };

  const startPlcJob = async () => {
    if (!selectedCarton?.id) return;
    setBusy(true);
    try {
      const created = await scanPlannedCarton(buyer.code, orderId, selectedCarton.id, {
        stationCode,
        barcode: scannedBarcode,
        palletCode: palletCode.trim() || null
      });
      setPlcConfirmOpen(false);
      setSelectedCarton(null);
      setTransaction(created);
      notify(`Child item #${created.cartonSequence} was assigned to Job ${created.jobId}. Waiting for PLC.`, 'info');
      await refreshMatchedData();
    } catch (error) {
      notify(getApiError(error, 'Unable to create a Job waiting for PLC.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openWaitingManual = () => {
    setManualContext('WAITING');
    setManualWeight('');
    setManualReason('PLC/Gateway is temporarily unavailable');
    setManualOpen(true);
  };

  const submitManual = async () => {
    if (!manualWeight || !manualReason.trim()) return;
    setBusy(true);
    try {
      let updated;
      if (manualContext === 'WAITING') {
        if (!transaction?.id) return;
        updated = await submitManualWeight(buyer.code, transaction.id, {
          weightKg: Number(manualWeight),
          reason: manualReason.trim()
        });
      } else {
        if (!selectedCarton?.id) return;
        updated = await completePlannedCartonManually(buyer.code, orderId, selectedCarton.id, {
          stationCode,
          barcode: scannedBarcode,
          palletCode: palletCode.trim() || null,
          weightKg: Number(manualWeight),
          reason: manualReason.trim()
        });
      }
      setTransaction(updated);
      setSelectedCarton(null);
      setManualOpen(false);
      setManualWeight('');
      notify(`Saved child item #${updated.cartonSequence}: ${formatWeight(updated.weightKg)} by manual entry.`, 'success');
      await refreshMatchedData();
    } catch (error) {
      notify(getApiError(error, 'Unable to save the manual weight.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const startCamera = useCallback(async () => {
    if (!orderId) {
      notify('Select an Order first.', 'warning');
      return;
    }
    if (!window.BarcodeDetector) {
      notify('This browser does not support BarcodeDetector. Use a Bluetooth scanner or enter the code manually.', 'warning');
      return;
    }
    try {
      setCameraMessage('Scan the label to find the Order Item');
      setCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      window.setTimeout(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'itf'] });
        detectorTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || lookupLockedRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes?.[0]?.rawValue;
            if (raw) performLookup(raw);
          } catch (error) {
            console.debug('Barcode frame skipped', error);
          }
        }, 450);
      }, 120);
    } catch (error) {
      stopCamera();
      notify(error?.name === 'NotAllowedError' ? 'Camera permission was not granted.' : 'Unable to open the camera. Mobile camera access usually requires HTTPS.', 'error');
    }
  }, [notify, orderId, performLookup, stopCamera]);

  const resetScan = () => {
    if (waiting) return;
    setBarcodeInput('');
    setScannedBarcode('');
    setMatchedItems([]);
    setSelectedItem(null);
    setChildCartons([]);
  };

  if (!buyer?.code) return <Alert severity="warning">Buyer could not be identified.</Alert>;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', pb: 9, px: { xs: 0.5, sm: 1 } }}>
      <Stack spacing={1.4}>
        <Paper elevation={0} sx={{ p: { xs: 1.3, sm: 2 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} mb={1.3}>
            <Box minWidth={0}>
              <Typography variant="h4" fontWeight={950}>Item Scan & Weight</Typography>
              <Typography color="text.secondary" variant="body2">{buyer.label} · Scan the QR to retrieve information, then select a child item by No.</Typography>
            </Box>
            <Chip icon={<ScaleOutlinedIcon />} label={selectedStation?.online ? 'PLC Online' : 'PLC Offline'} color={selectedStation?.online ? 'success' : 'default'} />
          </Stack>

          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth size="small" label="Order / WSP" value={orderId} onChange={(event) => setOrderId(event.target.value)} disabled={waiting || busy}>
                {orders.map((order) => <MenuItem key={order.id} value={order.id}>{order.orderName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField select fullWidth size="small" label="Scale Station" value={stationCode} onChange={(event) => setStationCode(event.target.value)} disabled={waiting || busy}>
                {stations.map((station) => <MenuItem key={station.stationCode} value={station.stationCode}>{station.stationCode}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="Pallet/Location" value={palletCode} onChange={(event) => setPalletCode(event.target.value)} disabled={waiting || busy} placeholder="P01" InputProps={{ startAdornment: <WarehouseOutlinedIcon sx={{ mr: 1, color: 'text.secondary' }} /> }} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 1.3 }} />
          <Typography variant="caption" color="text.secondary" fontWeight={800}>WEIGHT INPUT MODE</Typography>
          <ToggleButtonGroup
            fullWidth
            exclusive
            value={weightMode}
            onChange={(_, value) => value && setWeightMode(value)}
            disabled={waiting || busy}
            sx={{ mt: 0.7 }}
          >
            <ToggleButton value="PLC" sx={{ py: 1, fontWeight: 900 }}><ScaleOutlinedIcon sx={{ mr: 0.7 }} /> PLC (default)</ToggleButton>
            <ToggleButton value="MANUAL" sx={{ py: 1, fontWeight: 900 }}><KeyboardOutlinedIcon sx={{ mr: 0.7 }} /> Manual</ToggleButton>
          </ToggleButtonGroup>
        </Paper>

        {progress && (
          <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 3 }}>
            <Grid container spacing={0.8}>
              <Grid item xs={4}><StatCard label="Planned" value={progress.plannedCartons} icon={<Inventory2OutlinedIcon />} /></Grid>
              <Grid item xs={4}><StatCard label="Weighed" value={(progress.completedCartons || 0) + (progress.warningCartons || 0)} icon={<CheckCircleOutlineOutlinedIcon />} color="success.main" /></Grid>
              <Grid item xs={4}><StatCard label="Remaining" value={progress.remainingCartons} icon={<RefreshOutlinedIcon />} color="warning.main" /></Grid>
            </Grid>
            <Box mt={1}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="caption">Progress</Typography><Typography variant="caption" fontWeight={900}>{percent.toFixed(1)}%</Typography></Stack>
              <LinearProgress variant="determinate" value={percent} sx={{ mt: 0.4, height: 8, borderRadius: 9 }} />
            </Box>
          </Paper>
        )}

        {waiting && (
          <Card variant="outlined" sx={{ borderRadius: 3, borderWidth: 2, borderColor: 'warning.main' }}>
            <CardContent>
              <Stack spacing={1.2} alignItems="center" textAlign="center">
                <ScaleOutlinedIcon color="warning" sx={{ fontSize: 52 }} />
                <Box>
                  <Typography variant="h4" fontWeight={950}>Waiting for PLC</Typography>
                  <Typography>{transaction.itemKey || transaction.cartonCode} · Job {transaction.jobId}</Typography>
                  <Typography color="text.secondary">Article {transaction.articleNumber} · Station {transaction.stationCode}</Typography>
                </Box>
                <Alert severity="warning" sx={{ width: '100%' }}>Place the item on the scale. The Gateway will submit the weight to this Job.</Alert>
                <LinearProgress sx={{ width: '100%', height: 8, borderRadius: 8 }} />
                <Button variant="outlined" startIcon={<KeyboardOutlinedIcon />} onClick={openWaitingManual}>PLC unavailable — switch to manual entry</Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {completed && (
          <Card variant="outlined" sx={{ borderRadius: 3, borderWidth: 2, borderColor: 'success.main' }}>
            <CardContent>
              <Stack spacing={1} alignItems="center" textAlign="center">
                <CheckCircleOutlineOutlinedIcon color="success" sx={{ fontSize: 54 }} />
                <Typography variant="h4" fontWeight={950}>Completed {transaction.itemKey || transaction.cartonCode}</Typography>
                <Typography variant="h2" color="success.main" fontWeight={950}>{formatWeight(transaction.weightKg)}</Typography>
                <Stack direction="row" spacing={0.7}>
                  <Chip label={`Source: ${transaction.weightSource === 'MANUAL' || transaction.manualReason ? 'Manual' : 'PLC'}`} color="success" variant="outlined" />
                  <Chip label={weightMeta(transaction.weightStatus).label} color={weightMeta(transaction.weightStatus).color} />
                </Stack>
                {transaction.warningMessage && <Alert severity="warning" sx={{ width: '100%' }}>{transaction.warningMessage}</Alert>}
                <Button fullWidth variant="contained" onClick={() => setTransaction(null)}>Close Result</Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Paper variant="outlined" sx={{ p: 1.3, borderRadius: 3 }}>
          <Stack spacing={1.1}>
            <Box>
              <Typography fontWeight={950}>1. Scan QR / Item Code</Typography>
              <Typography variant="caption" color="text.secondary">The QR is matched by e.s. PO, e.s. Article No., and Quantity. Supplier No. is retrieved from the Order data or additionally validated when included in the QR. Physical cartons 1–N are generated from Master Total ctns; Qty Per Ctn is only the planned quantity inside each carton.</Typography>
            </Box>
            <TextField
              id="carton-item-barcode"
              fullWidth
              label="QR / Item Barcode"
              value={barcodeInput}
              onChange={(event) => setBarcodeInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); performLookup(barcodeInput); } }}
              disabled={waiting || busy}
              placeholder="Example 0000000000008589132-0000000040-0001571490-00000000000000000000"
              inputProps={{ autoComplete: 'off', inputMode: 'text' }}
            />
            <Stack direction="row" spacing={1}>
              <Button fullWidth variant="contained" size="large" startIcon={<QrCodeScannerOutlinedIcon />} onClick={() => performLookup(barcodeInput)} disabled={waiting || busy || !barcodeInput.trim()}>
                {busy ? 'Matching...' : 'Get Item Information'}
              </Button>
              <Button variant="outlined" size="large" startIcon={<CameraAltOutlinedIcon />} onClick={startCamera} disabled={waiting || busy}>Camera</Button>
            </Stack>
            {scannedBarcode && (
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Chip color="success" label={`Scanned: ${scannedBarcode}`} />
                <Button size="small" onClick={resetScan} disabled={waiting}>Change Code</Button>
              </Stack>
            )}
          </Stack>
        </Paper>

        {!progress?.plannedCartons && !busy && (
          <Alert severity="info">No Carton Master rows are available. Prepare Order Items, verify Master Total ctns, then generate one row per physical carton.</Alert>
        )}

        {matchedItems.length > 0 && (
          <Paper variant="outlined" sx={{ p: 1.3, borderRadius: 3 }}>
            <Stack spacing={1.1}>
              <Box>
                <Typography fontWeight={950}>2. Select the Correct Item</Typography>
                <Typography variant="caption" color="text.secondary">When the same Article appears with multiple Size/Color values, select the item that matches the label.</Typography>
              </Box>
              <Grid container spacing={1}>
                {matchedItems.map((item) => (
                  <Grid item xs={12} sm={6} key={item.masterLineId}>
                    <MasterItemCard item={item} selected={selectedItem?.masterLineId === item.masterLineId} disabled={waiting || busy} onClick={selectItem} />
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Paper>
        )}

        {selectedItem && (
          <Paper variant="outlined" sx={{ p: 1.3, borderRadius: 3 }}>
            <Stack spacing={1.2}>
              <Box>
                <Typography fontWeight={950}>3. Select Child Item 1–{selectedItem.plannedCartons}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Article {selectedItem.articleNumber} · Size {selectedItem.size || '—'} · {selectedItem.color || '—'} · Mode {weightMode === 'PLC' ? 'PLC' : 'Manual'}
                </Typography>
              </Box>
              {childLoading ? <Box textAlign="center" py={3}><CircularProgress /></Box> : (
                <Grid container spacing={1}>
                  {childCartons.map((carton) => (
                    <Grid item xs={6} sm={4} md={3} key={carton.id}>
                      <ChildCartonCard carton={carton} disabled={waiting || busy} onClick={chooseChild} />
                    </Grid>
                  ))}
                </Grid>
              )}
              {!childLoading && childCartons.length === 0 && <Alert severity="warning">This item has no physical cartons. Regenerate Carton Master from Master Total ctns.</Alert>}
            </Stack>
          </Paper>
        )}
      </Stack>

      <Dialog open={plcConfirmOpen} onClose={() => !busy && setPlcConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 950 }}>Confirm Item for PLC</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Alert severity="info">Item {selectedCarton?.itemKey || selectedCarton?.cartonCode} will be assigned to station <strong>{stationCode}</strong>.</Alert>
            <Typography>Article: <strong>{selectedCarton?.articleNumber}</strong></Typography>
            <Typography>Scanned barcode: <strong>{scannedBarcode}</strong></Typography>
            <Typography>After confirmation, place the item on the scale and wait for PLC to submit the weight.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlcConfirmOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" startIcon={<ScaleOutlinedIcon />} onClick={startPlcJob} disabled={busy}>{busy ? 'Creating Job...' : 'Confirm and Wait for PLC'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manualOpen} onClose={() => !busy && setManualOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 950 }}>Enter Weight Manually</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="warning">
              {manualContext === 'WAITING'
                ? `Replace the PLC result for Job ${transaction?.jobId}.`
                : `Item ${selectedCarton?.itemKey || selectedCarton?.cartonCode} will be completed using the manually entered weight.`}
            </Alert>
            <TextField
              autoFocus
              fullWidth
              type="number"
              inputProps={{ step: '0.001', min: '0.001', inputMode: 'decimal' }}
              label="Weight (kg)"
              value={manualWeight}
              onChange={(event) => setManualWeight(event.target.value)}
            />
            <TextField fullWidth multiline minRows={2} label="Manual Entry Reason" value={manualReason} onChange={(event) => setManualReason(event.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" startIcon={<CheckCircleOutlineOutlinedIcon />} onClick={submitManual} disabled={busy || !manualWeight || !manualReason.trim()}>
            {busy ? 'Saving...' : 'Confirm Weight'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cameraOpen} onClose={stopCamera} fullScreen>
        <Box sx={{ bgcolor: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, color: '#fff' }}>
            <Typography fontWeight={800}>{cameraMessage}</Typography>
            <Button color="inherit" startIcon={<CloseOutlinedIcon />} onClick={stopCamera}>Close</Button>
          </Stack>
          <Box sx={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <Box sx={{ position: 'absolute', width: '82%', height: 190, border: '3px solid #fff', borderRadius: 3, boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
          </Box>
        </Box>
      </Dialog>

      <Snackbar open={notice.open} autoHideDuration={4500} onClose={() => setNotice((value) => ({ ...value, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={notice.severity} onClose={() => setNotice((value) => ({ ...value, open: false }))} sx={{ width: '100%' }}>{notice.message}</Alert>
      </Snackbar>
    </Box>
  );
}
