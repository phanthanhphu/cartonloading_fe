import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import {
  ArrowBackOutlined,
  CheckCircleOutline,
  KeyboardOutlined,
  QrCodeScannerOutlined,
  RefreshOutlined,
  ScaleOutlined,
  WarningAmberOutlined
} from '@mui/icons-material';

import {
  getCartonTransaction,
  getCurrentStationTransaction,
  listCartonsForItem,
  listScaleStations,
  scanAssignedFactoryBarcode,
  submitManualWeight
} from 'buyers/es/services/cartonLoadingService';
import TableFilterBar from 'components/TableFilterBar';
import { getPackingOrder } from 'buyers/es/services/packingListService';
import { getBuyerBySlug } from 'utils/buyerAccess';

const FINAL_STATUSES = ['COMPLETED', 'WEIGHT_WARNING'];

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const stationStorageKey = (buyerCode) => `orderScan.station.${buyerCode}`;
const palletStorageKey = (buyerCode) => `orderScan.pallet.${buyerCode}`;
const modeStorageKey = (buyerCode) => `orderScan.mode.${buyerCode}`;

const readStorage = (key, fallback = '') => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value || '');
  } catch {
    // Local storage can be unavailable in restricted browser sessions.
  }
};

const weightMeta = (value) => {
  const status = String(value || 'NOT_WEIGHED').toUpperCase();
  if (status === 'OK') return { label: 'OK', color: 'success' };
  if (status === 'UNDER') return { label: 'Underweight', color: 'error' };
  if (status === 'OVER') return { label: 'Overweight', color: 'warning' };
  if (status === 'NO_STANDARD') return { label: 'No standard', color: 'info' };
  return { label: 'Not weighed', color: 'default' };
};

const scanMeta = (value) => {
  const status = String(value || 'PLANNED').toUpperCase();
  if (status === 'COMPLETED') return { label: 'Completed', color: 'success' };
  if (status === 'WEIGHT_WARNING') return { label: 'Weight warning', color: 'warning' };
  if (status === 'WAITING_WEIGHT') return { label: 'Waiting for weight', color: 'info' };
  if (status === 'CANCELLED') return { label: 'Cancelled', color: 'default' };
  return { label: 'Not scanned', color: 'default' };
};

const kg = (value) => value == null
  ? '—'
  : `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;

export default function CartonItemDetailPage() {
  const { buyerSlug, orderId, masterLineId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const buyer = getBuyerBySlug(buyerSlug);
  const scanInputRef = useRef(null);

  const routedTransaction = location.state?.activeTransaction;
  const [order, setOrder] = useState(null);
  const [rows, setRows] = useState([]);
  const [tablePage, setTablePage] = useState(0);
  const [tableRowsPerPage, setTableRowsPerPage] = useState(25);
  const [stations, setStations] = useState([]);
  const [stationCode, setStationCode] = useState(() => (
    location.state?.stationCode
    || (buyer?.code ? readStorage(stationStorageKey(buyer.code)) : '')
  ));
  const [palletCode, setPalletCode] = useState(() => (
    location.state?.palletCode
    || (buyer?.code ? readStorage(palletStorageKey(buyer.code), 'P01') : 'P01')
  ));
  const [scanInputMode, setScanInputMode] = useState(() => (
    location.state?.inputMode
    || (buyer?.code ? readStorage(modeStorageKey(buyer.code), 'ZEBRA') : 'ZEBRA')
  ));
  const [weightMode, setWeightMode] = useState(routedTransaction?.stationCode ? 'PLC' : 'MANUAL');
  const [barcode, setBarcode] = useState('');
  const [manualWeight, setManualWeight] = useState('');
  const [manualReason, setManualReason] = useState('Manual test / PLC unavailable');
  const [activeTransaction, setActiveTransaction] = useState(
    routedTransaction?.masterLineId === masterLineId ? routedTransaction : null
  );
  const [filters, setFilters] = useState({ factoryBarcode: '', itemKey: '', poNumber: '', articleNumber: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [weightSubmitting, setWeightSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const focusScanner = useCallback(() => {
    window.setTimeout(() => scanInputRef.current?.focus(), 100);
  }, []);

  const loadRows = useCallback(async ({ showLoading = true } = {}) => {
    if (!buyer?.code || !orderId || !masterLineId) return;
    if (showLoading) setLoading(true);
    try {
      const [orderData, itemRows] = await Promise.all([
        getPackingOrder(buyer.code, orderId),
        listCartonsForItem(buyer.code, orderId, masterLineId)
      ]);
      const normalizedRows = Array.isArray(itemRows) ? itemRows : [];
      const waitingRow = normalizedRows.find((row) => row.status === 'WAITING_WEIGHT'
        && (stationCode ? row.stationCode === stationCode : !row.stationCode));

      setOrder(orderData);
      setRows(normalizedRows);

      // Recover a waiting child after refresh, direct navigation, or manual-mode scanning.
      // Manual children have no Scale Station, so getCurrentStationTransaction cannot find them.
      setActiveTransaction((current) => {
        if (waitingRow) {
          return {
            ...current,
            ...waitingRow,
            masterLineId: waitingRow.masterLineId || masterLineId,
            plannedCartons: waitingRow.plannedCartons || normalizedRows.length
          };
        }
        if (current?.status === 'WAITING_WEIGHT') return null;
        return current;
      });

      if (waitingRow) {
        setWeightMode(waitingRow.stationCode ? 'PLC' : 'MANUAL');
        setError('');
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to load the carton list.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [buyer?.code, orderId, masterLineId, stationCode]);

  const loadStations = useCallback(async () => {
    try {
      const data = await listScaleStations(true);
      const activeStations = Array.isArray(data) ? data : [];
      setStations(activeStations);
      setStationCode((current) => {
        if (!current) return '';
        if (activeStations.some((station) => station.stationCode === current)) return current;
        return '';
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to load Scale Stations.'));
    }
  }, []);

  useEffect(() => {
    setError('');
    setNotice('');
    const nextTransaction = routedTransaction?.masterLineId === masterLineId ? routedTransaction : null;
    setActiveTransaction(nextTransaction);
    setWeightMode(nextTransaction?.stationCode ? 'PLC' : 'MANUAL');
    setBarcode('');
    setManualWeight('');
    loadRows();
  }, [masterLineId, routedTransaction, loadRows]);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  useEffect(() => {
    if (!buyer?.code) return;
    writeStorage(stationStorageKey(buyer.code), stationCode);
  }, [buyer?.code, stationCode]);

  useEffect(() => {
    if (!buyer?.code) return;
    writeStorage(palletStorageKey(buyer.code), palletCode);
  }, [buyer?.code, palletCode]);

  useEffect(() => {
    if (!buyer?.code) return;
    writeStorage(modeStorageKey(buyer.code), scanInputMode);
  }, [buyer?.code, scanInputMode]);

  useEffect(() => {
    if (!buyer?.code || !stationCode || activeTransaction?.status === 'WAITING_WEIGHT') return;
    let cancelled = false;
    getCurrentStationTransaction(buyer.code, stationCode)
      .then((transaction) => {
        if (!cancelled && transaction?.masterLineId === masterLineId) {
          setActiveTransaction(transaction);
        }
      })
      .catch(() => {
        // No active station job is a valid state.
      });
    return () => { cancelled = true; };
  }, [buyer?.code, stationCode, masterLineId, activeTransaction?.status]);

  useEffect(() => {
    if (!buyer?.code || !activeTransaction?.id || activeTransaction.status !== 'WAITING_WEIGHT') return undefined;

    let cancelled = false;
    const checkWeight = async () => {
      try {
        const latest = await getCartonTransaction(buyer.code, activeTransaction.id);
        if (cancelled || !latest) return;
        setActiveTransaction(latest);
        if (latest.status !== 'WAITING_WEIGHT') {
          setNotice(`Carton ${latest.cartonNumber ?? latest.cartonSequence} completed with ${kg(latest.weightKg)} from ${latest.weightSource || 'weight input'}. Scan the next assigned Factory Barcode when the station is ready.`);
          await loadRows({ showLoading: false });
          setManualWeight('');
        }
      } catch {
        // Keep polling; a transient network error should not cancel the weighing workflow.
      }
    };

    const timer = window.setInterval(checkWeight, 1200);
    checkWeight();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [buyer?.code, activeTransaction?.id, activeTransaction?.status, loadRows]);

  const waitingForWeight = activeTransaction?.status === 'WAITING_WEIGHT';

  useEffect(() => {
    if (!loading && !scanSubmitting && !waitingForWeight && scanInputMode === 'ZEBRA') {
      focusScanner();
    }
  }, [loading, scanSubmitting, waitingForWeight, scanInputMode, focusScanner]);

  const filtered = useMemo(() => rows.filter((row) => {
    const match = (value, filter) => !filter || String(value || '').toUpperCase().includes(String(filter).trim().toUpperCase());
    const matchStatus = !filters.status || row.status === filters.status || row.weightStatus === filters.status;
    return matchStatus
      && match(row.factoryBarcode, filters.factoryBarcode)
      && match(row.itemKey, filters.itemKey)
      && match(row.poNumber, filters.poNumber)
      && match(row.articleNumber, filters.articleNumber);
  }), [rows, filters]);

  const first = rows[0] || {};
  const completed = rows.filter((row) => FINAL_STATUSES.includes(row.status)).length;
  const waiting = rows.filter((row) => row.status === 'WAITING_WEIGHT').length;
  const warnings = rows.filter((row) => ['UNDER', 'OVER'].includes(row.weightStatus)).length;
  const readyAssigned = rows.filter((row) => row.status === 'PLANNED' && row.factoryBarcode).length;

  const submitScan = async () => {
    const code = barcode.trim();
    if (!buyer?.code || scanSubmitting) return;
    if (waitingForWeight) {
      setError(`Carton ${activeTransaction.cartonCode || activeTransaction.cartonSequence} is still waiting for weight. Complete it before scanning another carton.`);
      return;
    }
    if (!code) {
      setError('Scan or enter an assigned Factory Barcode.');
      focusScanner();
      return;
    }

    setScanSubmitting(true);
    setError('');
    setNotice('');
    try {
      const transaction = await scanAssignedFactoryBarcode(buyer.code, orderId, {
        stationCode: stationCode || null,
        factoryBarcode: code,
        palletCode: palletCode.trim() || null,
        scanId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        manualMode: !stationCode
      });
      setBarcode('');
      setActiveTransaction(transaction);
      setWeightMode(transaction.stationCode ? 'PLC' : 'MANUAL');
      setNotice(`Factory Barcode ${transaction.factoryBarcode || code} identified ${transaction.cartonCode || `Carton ${transaction.cartonNumber ?? transaction.cartonSequence}`}. The carton is waiting for weight.`);

      if (transaction.masterLineId !== masterLineId) {
        navigate(`/buyers/${buyer.slug}/orders/${orderId}/items/${transaction.masterLineId}`, {
          state: {
            activeTransaction: transaction,
            stationCode,
            palletCode,
            inputMode: scanInputMode,
            scannedBarcode: code
          }
        });
        return;
      }
      await loadRows({ showLoading: false });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to scan the Factory Barcode.'));
      focusScanner();
    } finally {
      setScanSubmitting(false);
    }
  };

  const submitWeightManually = async () => {
    if (!buyer?.code || !activeTransaction?.id || weightSubmitting) return;
    const value = Number(manualWeight);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid weight greater than 0 kg.');
      return;
    }
    setWeightSubmitting(true);
    setError('');
    try {
      const completedTransaction = await submitManualWeight(buyer.code, activeTransaction.id, {
        weightKg: value,
        reason: manualReason.trim() || 'Manual weight input'
      });
      setActiveTransaction(completedTransaction);
      setNotice(`Carton ${completedTransaction.cartonNumber ?? completedTransaction.cartonSequence} completed manually with ${kg(completedTransaction.weightKg)}. Scan the next assigned Factory Barcode when the station is ready.`);
      setManualWeight('');
      await loadRows({ showLoading: false });
      focusScanner();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to save the manual weight.'));
    } finally {
      setWeightSubmitting(false);
    }
  };

  if (!buyer) return <Alert severity="warning">Buyer could not be identified.</Alert>;

  const currentSequence = activeTransaction?.cartonSequence;
  const plannedCartons = activeTransaction?.plannedCartons || rows.length;

  return (
    <Box sx={{ p: { xs: 1.25, md: 2.5 }, width: '100%' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} mb={1.5}>
        <Box>
          <Button
            size="small"
            startIcon={<ArrowBackOutlined />}
            onClick={() => navigate(`/buyers/${buyer.slug}/orders/${orderId}`)}
            sx={{ mb: 0.35, textTransform: 'none' }}
          >
            Back to Order
          </Button>
          <Typography sx={{ fontSize: { xs: '1.45rem', md: '1.8rem' }, fontWeight: 950, color: '#103B5C' }}>
            Carton Factory Barcode &amp; Weight
          </Typography>
          <Typography color="text.secondary">
            {buyer.label} · {order?.orderName || 'Order'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={() => loadRows()} disabled={loading} sx={{ textTransform: 'none' }}>
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerOutlined />}
            onClick={() => navigate(`/buyers/${buyer.slug}/orders/${orderId}/scan`)}
            sx={{ textTransform: 'none', bgcolor: '#103B5C' }}
          >
            Scan Another Carton
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.25 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1.25 }}>{notice}</Alert>}

      <Paper
        variant="outlined"
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 1.25,
          mb: 1.25,
          borderRadius: 2,
          bgcolor: '#FFFFFF'
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 950, color: '#103B5C' }}>Matched parent item</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              Supplier {first.supplierNumber || '—'} · PO {first.poNumber || '—'} · Article {first.articleNumber || '—'} · Size {first.size || '—'} · Color {first.color || '—'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
            <Chip label={`Total ${rows.length}`} color="primary" />
            <Chip label={`Completed ${completed}`} color="success" variant="outlined" />
            <Chip label={`Waiting ${waiting}`} color="info" variant="outlined" />
            <Chip label={`Assigned ready ${readyAssigned}`} color={readyAssigned ? 'warning' : 'success'} variant="outlined" />
          </Stack>
        </Stack>
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.5, md: 2 },
          mb: 1.25,
          borderRadius: 2,
          borderWidth: 2,
          borderColor: waitingForWeight ? 'info.main' : '#D7E0EA',
          boxShadow: waitingForWeight ? '0 8px 24px rgba(14, 165, 233, 0.08)' : 'none'
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ md: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 950, color: '#103B5C' }}>
                Scan assigned Factory Barcode
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Each Factory Barcode identifies one exact carton already mapped from Master Data. Zebra USB starts lookup automatically after Enter.
              </Typography>
            </Box>
            <Chip
              icon={waitingForWeight ? <ScaleOutlined /> : <CheckCircleOutline />}
              label={waitingForWeight ? `Locked — Carton #${currentSequence} is waiting for weight` : 'Ready to scan'}
              color={waitingForWeight ? 'info' : 'success'}
              variant={waitingForWeight ? 'filled' : 'outlined'}
              sx={{ fontWeight: 850 }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2} alignItems={{ lg: 'center' }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', lg: 260 } }}>
              <InputLabel id="item-scan-station-label">Scale Station</InputLabel>
              <Select
                labelId="item-scan-station-label"
                value={stationCode}
                label="Scale Station"
                onChange={(event) => setStationCode(event.target.value)}
                disabled={waitingForWeight}
              >
                <MenuItem value=""><em>Manual weight only — no PLC station</em></MenuItem>
                {stations.map((station) => (
                  <MenuItem key={station.stationCode} value={station.stationCode}>
                    {station.stationName || station.stationCode} ({station.stationCode})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Pallet / Location"
              value={palletCode}
              onChange={(event) => setPalletCode(event.target.value)}
              disabled={waitingForWeight}
              sx={{ minWidth: { xs: '100%', lg: 240 } }}
            />
            <ToggleButtonGroup
              exclusive
              size="small"
              value={scanInputMode}
              onChange={(_, value) => value && setScanInputMode(value)}
              disabled={waitingForWeight}
            >
              <ToggleButton value="ZEBRA"><QrCodeScannerOutlined sx={{ mr: 0.5 }} /> Zebra USB</ToggleButton>
              <ToggleButton value="MANUAL"><KeyboardOutlined sx={{ mr: 0.5 }} /> Manual input</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              inputRef={scanInputRef}
              fullWidth
              size="medium"
              label={scanInputMode === 'ZEBRA' ? 'Scan assigned Factory Barcode' : 'Enter Factory Barcode manually'}
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && scanInputMode === 'ZEBRA') {
                  event.preventDefault();
                  submitScan();
                }
              }}
              disabled={waitingForWeight || scanSubmitting}
              autoComplete="off"
              placeholder={scanInputMode === 'ZEBRA'
                ? 'Scan the Factory Use Only label. Zebra Enter identifies the exact assigned carton.'
                : 'Type or paste the Factory Barcode, then click Identify Carton.'}
              sx={{
                '& .MuiInputBase-root': { minHeight: 54, fontSize: '1rem' }
              }}
            />
            <Button
              variant="contained"
              size="large"
              startIcon={scanSubmitting ? <CircularProgress size={18} color="inherit" /> : <QrCodeScannerOutlined />}
              onClick={submitScan}
              disabled={waitingForWeight || scanSubmitting || !barcode.trim()}
              sx={{ minWidth: { xs: '100%', md: 205 }, minHeight: 54, textTransform: 'none', bgcolor: '#103B5C', fontWeight: 900 }}
            >
              {scanSubmitting ? 'Identifying...' : 'Identify Carton'}
            </Button>
          </Stack>

          {activeTransaction?.status === 'WAITING_WEIGHT' ? (
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 1.5, md: 2 },
                borderRadius: 2,
                bgcolor: '#F0F9FF',
                borderColor: '#7DD3FC'
              }}
            >
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }}>
                  <Box
                    sx={{
                      width: 84,
                      height: 84,
                      borderRadius: 2,
                      bgcolor: '#0EA5E9',
                      color: '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.9 }}>CURRENT</Typography>
                    <Typography sx={{ fontSize: '1.6rem', lineHeight: 1.1, fontWeight: 950 }}>#{currentSequence}</Typography>
                    <Typography variant="caption">of {plannedCartons}</Typography>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ fontSize: '1.2rem', fontWeight: 950, color: '#103B5C' }}>
                        Waiting for weight
                      </Typography>
                      <Chip size="small" label="Scan locked" color="info" />
                    </Stack>
                    <Typography sx={{ mt: 0.35, fontWeight: 950, color: 'success.dark', wordBreak: 'break-word' }}>
                      Factory Barcode: {activeTransaction.factoryBarcode || activeTransaction.barcode || '—'}
                    </Typography>
                    <Typography sx={{ mt: 0.2, fontWeight: 850, wordBreak: 'break-word' }}>
                      Carton: {activeTransaction.cartonCode || activeTransaction.itemKey || '—'} · CTN No.: {activeTransaction.cartonNumber ?? '—'} · Qty: {activeTransaction.cartonPcs ?? activeTransaction.qtyPerCarton ?? '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      PO {activeTransaction.poNumber || '—'} · Article {activeTransaction.articleNumber || '—'} · Color {activeTransaction.color || '—'} · Size {activeTransaction.size || '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Job {activeTransaction.jobId || '—'} · Station {activeTransaction.stationCode || 'Manual weight'} · Pallet {activeTransaction.palletCode || palletCode || '—'}
                    </Typography>
                  </Box>

                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={weightMode}
                    onChange={(_, value) => value && setWeightMode(value)}
                  >
                    <ToggleButton value="PLC" disabled={!activeTransaction.stationCode}><ScaleOutlined sx={{ mr: 0.5 }} /> PLC automatic</ToggleButton>
                    <ToggleButton value="MANUAL"><KeyboardOutlined sx={{ mr: 0.5 }} /> Manual weight</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                {weightMode === 'PLC' && activeTransaction.stationCode && (
                  <Alert severity="info">
                    Waiting for PLC to send a stable weight for Job {activeTransaction.jobId}. The page checks the result automatically.
                  </Alert>
                )}

                {!activeTransaction.stationCode && (
                  <Alert severity="warning">
                    This carton has no Scale Station. PLC input is unavailable; enter the actual weight manually below.
                  </Alert>
                )}

                {weightMode === 'MANUAL' && (
                  <Box sx={{ p: { xs: 1.25, md: 1.5 }, borderRadius: 2, bgcolor: '#FFFFFF', border: '1px solid #BAE6FD' }}>
                    <Typography sx={{ mb: 1.1, fontWeight: 950, color: '#103B5C' }}>Manual weight entry</Typography>
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} alignItems="stretch">
                      <TextField
                        autoFocus
                        type="number"
                        label="Actual Weight (kg)"
                        value={manualWeight}
                        onChange={(event) => setManualWeight(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && manualWeight) {
                            event.preventDefault();
                            submitWeightManually();
                          }
                        }}
                        inputProps={{ min: 0, step: '0.001' }}
                        sx={{
                          minWidth: { xs: '100%', lg: 280 },
                          '& .MuiInputBase-root': { minHeight: 56, fontSize: '1.05rem', fontWeight: 850 }
                        }}
                      />
                      <TextField
                        fullWidth
                        label="Reason (optional)"
                        value={manualReason}
                        onChange={(event) => setManualReason(event.target.value)}
                        placeholder="Example: PLC unavailable / test weight"
                        sx={{ '& .MuiInputBase-root': { minHeight: 56 } }}
                      />
                      <Button
                        variant="contained"
                        color="warning"
                        size="large"
                        startIcon={weightSubmitting ? <CircularProgress size={18} color="inherit" /> : <ScaleOutlined />}
                        onClick={submitWeightManually}
                        disabled={weightSubmitting || !manualWeight}
                        sx={{ minWidth: { xs: '100%', lg: 210 }, minHeight: 56, textTransform: 'none', fontWeight: 950 }}
                      >
                        {weightSubmitting ? 'Saving...' : 'Confirm Weight'}
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                      Confirming the weight completes only this carton. Scan the next carton's assigned Factory Barcode for the next job.
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          ) : activeTransaction ? (
            <Alert severity="success" icon={<CheckCircleOutline />}>
              Carton #{activeTransaction.cartonNumber ?? activeTransaction.cartonSequence} is completed at {kg(activeTransaction.weightKg)}. The station is ready; scan the next carton's assigned Factory Barcode.
            </Alert>
          ) : (
            <Alert severity="info">
              Ready to scan an assigned Factory Barcode. Each code identifies one exact physical carton; the system never selects the next carton by sequence.
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25, mb: 1.25, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <TableFilterBar
              fields={[
                { key: 'factoryBarcode', label: 'Factory Barcode' },
                { key: 'itemKey', label: 'Item Key' },
                { key: 'poNumber', label: 'PO No.' },
                { key: 'articleNumber', label: 'Article' },
                { key: 'status', label: 'Status', options: [
                  { value: 'PLANNED', label: 'Not scanned' },
                  { value: 'WAITING_WEIGHT', label: 'Waiting for weight' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'WEIGHT_WARNING', label: 'Weight warning' },
                  { value: 'UNDER', label: 'Underweight' },
                  { value: 'OVER', label: 'Overweight' },
                  { value: 'OK', label: 'OK' }
                ] }
              ]}
              values={filters}
              onChange={(key, value) => { setFilters((current) => ({ ...current, [key]: value })); setTablePage(0); }}
              onClear={() => { setFilters({ factoryBarcode: '', itemKey: '', poNumber: '', articleNumber: '', status: '' }); setTablePage(0); }}
            />
          </Box>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
            Showing {filtered.length.toLocaleString('en-US')} of {rows.length.toLocaleString('en-US')} cartons
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ minHeight: 420, overflowX: 'auto' }}>
          <SortableTable disableRowNumber size="medium" sx={{ minWidth: 1430 }}>
            <TableHead>
              <TableRow>
                {['Carton', 'CTN No.', 'Qty', 'Factory Barcode', 'Item Key', 'Scan Status', 'Expected', 'Actual', 'Difference', 'Weight Status', 'Source', 'Station', 'Updated By'].map((label) => (
                  <TableCell key={label} sx={{ bgcolor: '#F8FAFC', fontWeight: 950, fontSize: '0.78rem', whiteSpace: 'nowrap', borderBottom: '2px solid #E2E8F0' }}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={13} align="center" sx={{ py: 8 }}><CircularProgress size={34} /></TableCell></TableRow>
              ) : filtered.length ? filtered.slice(tablePage * tableRowsPerPage, tablePage * tableRowsPerPage + tableRowsPerPage).map((row) => {
                const scan = scanMeta(row.status);
                const weight = weightMeta(row.weightStatus);
                const isActive = activeTransaction?.id === row.id;
                return (
                  <TableRow
                    key={row.id || row.itemKey}
                    hover
                    selected={isActive}
                    sx={{
                      '&.Mui-selected': {
                        bgcolor: '#DDF4FF',
                        '&:hover': { bgcolor: '#D1EEFC' }
                      }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 950, whiteSpace: 'nowrap' }}>
                      #{row.cartonSequence ?? row.itemSequence ?? '—'}
                      {isActive && <Chip size="small" label="Current" color="info" sx={{ ml: 0.8 }} />}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{row.cartonNumber ?? '—'}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{row.cartonPcs ?? row.qtyPerCarton ?? '—'}</TableCell>
                    <TableCell sx={{ fontWeight: row.factoryBarcode ? 950 : 400, whiteSpace: 'nowrap', color: row.factoryBarcode ? 'success.dark' : 'text.secondary' }}>{row.factoryBarcode || 'Unassigned'}</TableCell>
                    <TableCell sx={{ fontWeight: 900, color: '#103B5C', whiteSpace: 'nowrap' }}>{row.itemKey || row.cartonCode || '—'}</TableCell>
                    <TableCell><Chip size="small" label={scan.label} color={scan.color} variant="outlined" /></TableCell>
                    <TableCell>{kg(row.expectedWeightKg)}</TableCell>
                    <TableCell sx={{ fontWeight: row.weightKg != null ? 950 : 400 }}>{kg(row.weightKg)}</TableCell>
                    <TableCell>{row.weightDifferenceKg == null ? '—' : kg(row.weightDifferenceKg)}</TableCell>
                    <TableCell><Chip size="small" label={weight.label} color={weight.color} /></TableCell>
                    <TableCell>{row.weightSource || '—'}</TableCell>
                    <TableCell>{row.stationCode || '—'}</TableCell>
                    <TableCell>{row.weighedBy || row.scannedBy || '—'}</TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={13} align="center" sx={{ py: 8, color: 'text.secondary' }}>No matching data.</TableCell></TableRow>
              )}
            </TableBody>
          </SortableTable>
        </TableContainer>
        <Box sx={{ p: 1.25, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            The Factory Barcode is a one-to-one carton ID. The backend opens only the carton mapped to the scanned code; it never chooses another carton by sequence.
          </Typography>
          <Typography variant="caption" fontWeight={850}>{filtered.length.toLocaleString('en-US')} rows</Typography>
        </Box>
      </Paper>

      {warnings > 0 && (
        <Alert severity="warning" icon={<WarningAmberOutlined />} sx={{ mt: 1.25 }}>
          This item has {warnings} carton weight warning(s). Review the expected weight and tolerance.
        </Alert>
      )}
    </Box>
  );
}
