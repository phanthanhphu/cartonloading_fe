import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Typography
} from '@mui/material';
import {
  ArrowBackOutlined,
  CheckCircleOutlineOutlined,
  QrCodeScannerOutlined,
  ScaleOutlined,
  WarningAmberOutlined
} from '@mui/icons-material';

import {
  getCartonProgress,
  listCartonPlan,
  listScaleStations,
  scanAssignedFactoryBarcode
} from 'buyers/es/services/cartonLoadingService';
import { getPackingOrder } from 'buyers/es/services/packingListService';
import { getBuyerBySlug } from 'utils/buyerAccess';

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const stationStorageKey = (buyerCode) => `orderScan.station.${buyerCode}`;
const palletStorageKey = (buyerCode) => `orderScan.pallet.${buyerCode}`;

const readStorage = (key, fallback = '') => {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
};
const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value || ''); } catch { /* restricted browser */ }
};

export default function OrderScanPage() {
  const { buyerSlug, orderId } = useParams();
  const navigate = useNavigate();
  const buyer = getBuyerBySlug(buyerSlug);
  const scanInputRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [stations, setStations] = useState([]);
  const [progress, setProgress] = useState(null);
  const [passPage, setPassPage] = useState({ content: [], totalElements: 0 });
  const [failPage, setFailPage] = useState({ content: [], totalElements: 0 });
  const [passTablePage, setPassTablePage] = useState(0);
  const [passRowsPerPage, setPassRowsPerPage] = useState(25);
  const [failTablePage, setFailTablePage] = useState(0);
  const [failRowsPerPage, setFailRowsPerPage] = useState(25);
  const [stationCode, setStationCode] = useState(() => buyer?.code ? readStorage(stationStorageKey(buyer.code)) : '');
  const [palletCode, setPalletCode] = useState(() => buyer?.code ? readStorage(palletStorageKey(buyer.code), 'P01') : 'P01');
  const [factoryBarcode, setFactoryBarcode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const focusScanner = useCallback(() => {
    window.setTimeout(() => scanInputRef.current?.focus(), 80);
  }, []);

  const loadSetup = useCallback(async () => {
    if (!buyer?.code || !orderId) return;
    setLoading(true);
    setError('');
    try {
      const [orderData, stationData, progressData, passData, failData] = await Promise.all([
        getPackingOrder(buyer.code, orderId),
        listScaleStations(true),
        getCartonProgress(buyer.code, orderId),
        listCartonPlan(buyer.code, orderId, { status: 'COMPLETED', page: passTablePage, size: passRowsPerPage }),
        listCartonPlan(buyer.code, orderId, { status: 'WEIGHT_WARNING', page: failTablePage, size: failRowsPerPage })
      ]);
      const activeStations = Array.isArray(stationData) ? stationData : [];
      setOrder(orderData);
      setStations(activeStations);
      setProgress(progressData);
      setPassPage(passData || { content: [], totalElements: 0 });
      setFailPage(failData || { content: [], totalElements: 0 });
      setStationCode((current) => {
        if (current && activeStations.some((station) => station.stationCode === current)) return current;
        return activeStations[0]?.stationCode || '';
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to load the selected Order scan setup.'));
    } finally {
      setLoading(false);
      focusScanner();
    }
  }, [buyer?.code, orderId, focusScanner, passTablePage, passRowsPerPage, failTablePage, failRowsPerPage]);

  useEffect(() => { loadSetup(); }, [loadSetup]);
  useEffect(() => { if (buyer?.code) writeStorage(stationStorageKey(buyer.code), stationCode); }, [buyer?.code, stationCode]);
  useEffect(() => { if (buyer?.code) writeStorage(palletStorageKey(buyer.code), palletCode); }, [buyer?.code, palletCode]);
  useEffect(() => { if (!submitting) focusScanner(); }, [submitting, focusScanner]);

  const scanBarcode = async () => {
    const code = factoryBarcode.trim();
    if (!buyer?.code || !orderId || submitting) return;
    const weightStarted = String(order?.weightStatus || 'NOT_STARTED') !== 'NOT_STARTED';
    if (order?.assignmentStatus !== 'COMPLETED' && !weightStarted) {
      setError('Weight Check can start only after Barcode Assignment reaches 100%.');
      return;
    }
    if (!code) {
      setError('Scan or enter a Factory Barcode.');
      focusScanner();
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const transaction = await scanAssignedFactoryBarcode(buyer.code, orderId, {
        stationCode: stationCode || null,
        factoryBarcode: code,
        palletCode: palletCode.trim() || null,
        scanId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        manualMode: !stationCode
      });
      setFactoryBarcode('');
      navigate(`/buyers/${buyer.slug}/orders/${orderId}/items/${transaction.masterLineId}`, {
        state: {
          activeTransaction: transaction,
          stationCode,
          palletCode,
          scannedBarcode: code
        }
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to identify the carton from this Factory Barcode.'));
      focusScanner();
    } finally {
      setSubmitting(false);
    }
  };

  if (!buyer) return <Alert severity="warning">Buyer could not be identified.</Alert>;

  const planned = Number(progress?.plannedCartons ?? order?.plannedCartonCount ?? 0);
  const weighed = Number(progress?.completedCartons || 0) + Number(progress?.warningCartons || 0);
  const remaining = Number(progress?.remainingCartons ?? order?.notWeighedCartonCount ?? 0);
  const pass = Number(order?.passWeightCartonCount || 0);
  const fail = Number(order?.failWeightCartonCount || 0);
  const assignmentReady = order?.assignmentStatus === 'COMPLETED' && planned > 0;
  const weightStarted = String(order?.weightStatus || 'NOT_STARTED') !== 'NOT_STARTED' || weighed > 0;
  const weightStageReady = planned > 0 && (assignmentReady || weightStarted);
  const passRows = Array.isArray(passPage?.content) ? passPage.content : [];
  const failRows = Array.isArray(failPage?.content) ? failPage.content : [];
  const formatKg = (value) => value == null || value === ''
    ? '—'
    : `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
  const formatDiff = (value) => {
    if (value == null || value === '') return '—';
    const number = Number(value);
    const prefix = number > 0 ? '+' : '';
    return `${prefix}${number.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
  };

  const ResultTable = ({ type, rows, total, page, rowsPerPage, onPageChange, onRowsPerPageChange }) => {
    const isPass = type === 'PASS';
    const tone = isPass ? '#15803D' : '#DC2626';
    const soft = isPass ? '#F0FDF4' : '#FEF2F2';
    const Icon = isPass ? CheckCircleOutlineOutlined : WarningAmberOutlined;
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: isPass ? '#BBF7D0' : '#FECACA', minWidth: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 1.5, py: 1.05, bgcolor: soft, borderBottom: `1px solid ${isPass ? '#BBF7D0' : '#FECACA'}` }}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Icon sx={{ color: tone, fontSize: 21 }} />
            <Typography sx={{ color: tone, fontWeight: 900, fontSize: '0.9rem' }}>{isPass ? 'PASS CARTONS' : 'FAIL CARTONS'}</Typography>
          </Stack>
          <Typography sx={{ color: tone, fontWeight: 900, fontSize: '0.82rem' }}>TOTAL {Number(total || 0).toLocaleString()}</Typography>
        </Stack>
        <TableContainer sx={{ maxHeight: 255 }}>
          <SortableTable disableRowNumber stickyHeader size="small" sx={{ minWidth: 820, '& th, & td': { border: '1px solid #E2E8F0', px: 0.8, py: 0.65, fontSize: '0.69rem' }, '& th': { bgcolor: '#F8FAFC', color: '#40566E', fontWeight: 800 } }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 45 }}>No.</TableCell>
                <TableCell>Carton</TableCell>
                <TableCell>Barcode</TableCell>
                <TableCell>Style</TableCell>
                <TableCell>Color</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Expected</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Difference</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!rows.length ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3.25, color: '#94A3B8', fontWeight: 650 }}>No {type} cartons yet.</TableCell></TableRow>
              ) : rows.map((row, index) => (
                <TableRow key={row.id || `${type}-${index}`} sx={{ '&:hover': { bgcolor: soft } }}>
                  <TableCell align="center">{page * rowsPerPage + index + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#173B63', whiteSpace: 'nowrap' }}>{row.cartonNumber ?? row.cartonCode ?? row.orderCartonSequence ?? '—'}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 800, whiteSpace: 'nowrap' }}>{row.factoryBarcode || row.barcode || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 145, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.style || row.styleNumber || '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.color || '—'}</TableCell>
                  <TableCell align="right">{row.cartonPcs ?? row.qtyPerCarton ?? '—'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatKg(row.expectedWeightKg)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, color: tone, whiteSpace: 'nowrap' }}>{formatKg(row.weightKg)}</TableCell>
                  <TableCell align="right" sx={{ color: isPass ? '#50677E' : tone, fontWeight: isPass ? 650 : 900, whiteSpace: 'nowrap' }}>{formatDiff(row.weightDifferenceKg)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SortableTable>
        </TableContainer>
        <TablePagination component="div" count={Number(total || 0)} page={page} rowsPerPage={rowsPerPage}
          onPageChange={(_, next) => onPageChange(next)} onRowsPerPageChange={(e) => onRowsPerPageChange(Number(e.target.value))}
          rowsPerPageOptions={[10,25,50,100]} />
      </Paper>
    );
  };

  return (
    <Box sx={{ p: { xs: 0.55, md: 0.8 }, width: '100%', maxWidth: 1560, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} spacing={0.7} mb={0.75}>
        <Stack direction="row" spacing={0.55} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button size="small" startIcon={<ArrowBackOutlined />} onClick={() => navigate(`/buyers/${buyer.slug}/orders/${orderId}`)} sx={{ minWidth: 0, px: 0.7, textTransform: 'none' }}>Back</Button>
          <Typography sx={{ fontSize: '0.83rem', fontWeight: 800, color: '#173B63' }}>{order?.orderName || 'Order'}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={`Assign ${String(order?.assignmentStatus || 'NOT_STARTED').replaceAll('_', ' ')} · ${Number(order?.assignedCartonCount || 0).toLocaleString()}/${planned.toLocaleString()}`}
            color={assignmentReady ? 'success' : order?.assignmentStatus === 'IN_PROGRESS' ? 'warning' : 'default'}
            variant="outlined"
            sx={{ height: 28, fontWeight: 750 }}
          />
          <Chip size="small" label={`Weighed ${weighed.toLocaleString()}/${planned.toLocaleString()}`} color="primary" variant="outlined" sx={{ height: 28, fontWeight: 750 }} />
          <Chip size="small" label={`PASS ${pass.toLocaleString()}`} color="success" variant="outlined" sx={{ height: 28, fontWeight: 750 }} />
          <Chip size="small" label={`FAIL ${fail.toLocaleString()}`} color={fail > 0 ? 'error' : 'default'} variant="outlined" sx={{ height: 28, fontWeight: 750 }} />
          <Chip size="small" label={`Remaining ${remaining.toLocaleString()}`} color="warning" variant="outlined" sx={{ height: 28, fontWeight: 750 }} />
        </Stack>
      </Stack>

      {loading ? (
        <Paper variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 2 }}><CircularProgress /></Paper>
      ) : !weightStageReady ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Alert severity="warning" sx={{ py: 0.25, '& .MuiAlert-message': { py: 0.35, fontSize: '0.78rem' } }}>
            Weight Check is available only after Barcode Assignment reaches 100%.
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mt: 1.1 }}>
            <Typography sx={{ color: '#173B63', fontWeight: 800, fontSize: '0.8rem' }}>
              Assignment: {Number(order?.assignedCartonCount || 0).toLocaleString()} / {planned.toLocaleString()} cartons
            </Typography>
            <Button size="small" variant="contained" onClick={() => navigate(`/buyers/${buyer.slug}/orders/${orderId}`)} sx={{ textTransform: 'none' }}>Back to Order</Button>
          </Stack>
        </Paper>
      ) : (
        <Stack spacing={0.85}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1, md: 1.2 },
              borderRadius: 2,
              borderColor: '#DCE5EF',
              boxShadow: '0 5px 18px rgba(16, 59, 92, 0.04)',
              bgcolor: '#FFFFFF'
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={0.7} sx={{ mb: 0.85 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <QrCodeScannerOutlined sx={{ color: '#103B5C', fontSize: 20 }} />
                <Typography sx={{ color: '#173B63', fontWeight: 850, fontSize: '0.9rem' }}>Weight Check Operator</Typography>
              </Stack>
              <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                {!stationCode && <Chip size="small" icon={<ScaleOutlined />} label="MANUAL MODE" color="info" variant="outlined" sx={{ height: 25, fontWeight: 750 }} />}
                {!assignmentReady && weightStarted && <Chip size="small" icon={<WarningAmberOutlined />} label="BARCODE CORRECTION ACTIVE" color="warning" variant="outlined" sx={{ height: 25, fontWeight: 750 }} />}
              </Stack>
            </Stack>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 0.8,
                  py: 0,
                  minHeight: 34,
                  alignItems: 'center',
                  '& .MuiAlert-icon': { py: 0.55 },
                  '& .MuiAlert-message': { py: 0.45, fontSize: '0.75rem', fontWeight: 650 }
                }}
              >
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, .85fr) minmax(180px, .65fr) minmax(420px, 2.5fr) auto' }, gap: 0.75, alignItems: 'start' }}>
              <FormControl size="small" fullWidth>
                <InputLabel id="factory-scan-station-label">Scale Station</InputLabel>
                <Select
                  labelId="factory-scan-station-label"
                  value={stationCode}
                  label="Scale Station"
                  onChange={(event) => setStationCode(event.target.value)}
                  sx={{ minHeight: 46, fontWeight: 700 }}
                >
                  <MenuItem value=""><em>Manual test — no PLC station</em></MenuItem>
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
                placeholder="P01"
                sx={{ '& .MuiInputBase-root': { minHeight: 46, fontWeight: 700 } }}
              />

              <TextField
                inputRef={scanInputRef}
                autoFocus
                fullWidth
                size="small"
                label="Scan Factory Barcode"
                value={factoryBarcode}
                onChange={(event) => setFactoryBarcode(event.target.value.replace(/\s/g, ''))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    scanBarcode();
                  }
                }}
                disabled={submitting || !weightStageReady}
                autoComplete="off"
                placeholder="Example: 26002000025429"
                sx={{
                  '& .MuiInputBase-root': { minHeight: 46 },
                  '& input': { fontSize: { xs: '1rem', md: '1.08rem' }, fontWeight: 900, letterSpacing: 0.8, py: 1.1 }
                }}
              />

              <Button
                variant="contained"
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <QrCodeScannerOutlined />}
                onClick={scanBarcode}
                disabled={submitting || !weightStageReady || !factoryBarcode.trim()}
                sx={{
                  minWidth: { xs: '100%', md: 175 },
                  minHeight: 46,
                  px: 2,
                  fontWeight: 850,
                  textTransform: 'none',
                  bgcolor: '#103B5C',
                  whiteSpace: 'nowrap'
                }}
              >
                {submitting ? 'Identifying...' : 'Identify Carton'}
              </Button>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.6} sx={{ mt: 0.7 }}>
              {!assignmentReady && weightStarted && (
                <Typography sx={{ color: '#A15C00', fontSize: '0.68rem', fontWeight: 650 }}>
                  ⚠ Correction active: assigned, unweighed cartons may continue; corrected cartons must be reassigned before scanning.
                </Typography>
              )}
              {!stationCode && (
                <Typography sx={{ color: '#24758A', fontSize: '0.68rem', fontWeight: 650 }}>
                  Manual mode: identify by Factory Barcode, then enter actual weight manually.
                </Typography>
              )}
              <Typography sx={{ color: '#7B8CA0', fontSize: '0.68rem', fontWeight: 600, ml: { md: 'auto !important' } }}>
                Scanner Enter identifies the carton automatically.
              </Typography>
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 0.85 }}>
            <ResultTable type="PASS" rows={passRows} total={passPage?.totalElements ?? pass} page={passTablePage} rowsPerPage={passRowsPerPage} onPageChange={setPassTablePage} onRowsPerPageChange={(v) => { setPassRowsPerPage(v); setPassTablePage(0); }} />
            <ResultTable type="FAIL" rows={failRows} total={failPage?.totalElements ?? fail} page={failTablePage} rowsPerPage={failRowsPerPage} onPageChange={setFailTablePage} onRowsPerPageChange={(v) => { setFailRowsPerPage(v); setFailTablePage(0); }} />
          </Box>
        </Stack>
      )}
    </Box>
  );
}
