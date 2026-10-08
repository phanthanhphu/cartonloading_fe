import SortableTable from 'components/SortableTable';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Chip, CircularProgress, MenuItem, Paper, Stack,  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getPackingShipment, getPackingCartons, scanPackingShipment, completePackingCarton } from 'buyers/es/services/shipmentService';
import { listScaleStations, getCartonTransaction, getCurrentStationTransaction } from 'buyers/es/services/cartonLoadingService';
import { weightResult } from 'buyers/es/domain/workflow';
import { BARCODE_CARTON_STATUS, INSPECTION_RESULT, OPERATION_ROUTE, SCALE_WEIGHT_STATUS, SHIPMENT_STATUS, DEFAULT_TABLE_PAGE_SIZE } from '../../../../constants/appConstants';
import { APP_MESSAGES, createShipmentReadOnlyMessage } from '../../../../constants/appMessages';
const message = (e) => e?.response?.data?.message || e.message || APP_MESSAGES.COMPLETE_OPERATION_FAILED;
export default function PackingShipmentExecutionPage() {
  const { buyerSlug, shipmentId } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const [plan, setPlan] = useState(null);
  const [stations, setStations] = useState([]);
  const [station, setStation] = useState('');
  const [barcode, setBarcode] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [transaction, setTransaction] = useState(null);
  const lastTransaction = useRef(null);
  const attempt = useRef(null);
  const scanner = useRef(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [stationBlocked, setStationBlocked] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    listScaleStations(true).then((rows) => { if (active) setStations(Array.isArray(rows) ? rows : rows.content || []); })
      .catch((e) => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    lastTransaction.current = null; attempt.current = null; setTransaction(null); setPlan(null); setPage(0); setBarcode(''); setError('');
  }, [buyer?.code, shipmentId]);
  useEffect(() => {
    if (!buyer?.code || busy) return undefined;
    let active = true, inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [nextPlan, cartons, current, last] = await Promise.all([
          getPackingShipment(buyer.code, shipmentId), getPackingCartons(buyer.code, shipmentId, { page, size: DEFAULT_TABLE_PAGE_SIZE }),
          station ? getCurrentStationTransaction(buyer.code, station) : Promise.resolve(null),
          lastTransaction.current ? getCartonTransaction(buyer.code, lastTransaction.current) : Promise.resolve(null)
        ]);
        if (!active) return;
        setPlan(nextPlan); setData(cartons); setPollError('');
        setStationBlocked(Boolean(current && current.shipmentId !== shipmentId));
        if (current?.shipmentId === shipmentId) { lastTransaction.current = current.id; setTransaction(current); }
        else if (last?.shipmentId === shipmentId) setTransaction(last);
      } catch (e) { if (active) setPollError(message(e)); }
      finally { inFlight = false; if (active) setLoading(false); }
    };
    setLoading(true); poll(); const timer = window.setInterval(poll, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [buyer?.code, shipmentId, station, page, busy, revision]);

  const pending = transaction?.status === BARCODE_CARTON_STATUS.WAITING_WEIGHT;
  const canScan = plan?.status === SHIPMENT_STATUS.PLANNED && Boolean(station) && !pending && !stationBlocked && !pollError && !busy && !loading;
  useEffect(() => { if (canScan) scanner.current?.focus(); }, [canScan]);
  const scan = async (e) => {
    e.preventDefault(); const code = barcode.trim();
    if (!canScan || !code || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    if (attempt.current?.barcode !== code) attempt.current = { barcode: code, id: globalThis.crypto?.randomUUID?.() || `scan-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    try {
      const row = await scanPackingShipment(buyer.code, shipmentId, { stationCode: station, factoryBarcode: code, scanId: attempt.current.id, manualMode: false });
      lastTransaction.current = row.id; setTransaction(row); setBarcode(''); attempt.current = null;
    } catch (e) { setError(message(e)); }
    finally { submitting.current = false; setBusy(false); scanner.current?.focus(); }
  };
  const complete = async (row) => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try { const result = await completePackingCarton(buyer.code, shipmentId, row.id); if (lastTransaction.current === row.id) setTransaction(result); setRevision((n) => n + 1); }
    catch (e) { setError(message(e)); }
    finally { submitting.current = false; setBusy(false); }
  };
  const result = weightResult(transaction);
  return <Stack spacing={2}>
    <Button component={Link} to={OPERATION_ROUTE.PACKING_SHIPMENTS} sx={{ alignSelf: 'flex-start' }}>← Shipment Plans</Button>
    <Typography variant="h4">Packing · {plan?.shipmentNo || 'Shipment Weight Check'}</Typography>
    <Typography color="text.secondary">{plan ? `${plan.plannedDate} · ${plan.destination} · ${buyer?.label}` : 'Loading shipment plan…'}</Typography>
    {(error || pollError) && <Alert severity="error">{error || pollError}</Alert>}
    {plan && plan.status !== SHIPMENT_STATUS.PLANNED && <Alert severity="info">{createShipmentReadOnlyMessage(plan.status)}</Alert>}
    {stationBlocked && <Alert severity="warning">{APP_MESSAGES.SCALE_STATION_OTHER_SHIPMENT}</Alert>}
    <Paper variant="outlined" sx={{ p: 2 }}><Stack component="form" spacing={2} onSubmit={scan}>
      <TextField select label="PLC Scale Station" value={station} disabled={busy || pending} onChange={(e) => { setStation(e.target.value); attempt.current = null; }}>
        <MenuItem value="">Select Scale Station</MenuItem>{stations.map((row) => <MenuItem key={row.stationCode} value={row.stationCode}>{row.stationName || row.stationCode} · {row.stationCode}</MenuItem>)}
      </TextField>
      <TextField inputRef={scanner} label="Scan Assigned Factory Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value.replace(/\s/g, ''))} disabled={!canScan} autoComplete="off" helperText={APP_MESSAGES.PACKING_SHIPMENT_SCAN_HELPER} />
      <Button type="submit" variant="contained" disabled={!canScan || !barcode.trim()}>Scan & Wait for PLC Weight</Button>
      {(loading || busy) && <CircularProgress size={20} />}
    </Stack></Paper>
    {transaction && <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={1} aria-live="polite">
      <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h5">{transaction.factoryBarcode}</Typography><Chip label={result.label} color={result.color} /></Stack>
      <Typography>PO: {transaction.poNumber || '—'} · Product: {transaction.articleNumber || '—'} · {transaction.color || '—'} / {transaction.size || '—'}</Typography>
      <Typography>Packed Quantity: {transaction.assignedQuantity ?? '—'} · Expected: {transaction.expectedWeightKg ?? '—'} kg · Actual: {transaction.weightKg ?? '—'} kg</Typography>
      {pending && <Typography>Waiting for the PLC weight. Do not scan the next carton yet.</Typography>}
      {transaction.weightStatus === SCALE_WEIGHT_STATUS.NO_STANDARD && <Alert severity="warning">{APP_MESSAGES.NO_EXPECTED_WEIGHT_AVAILABLE}</Alert>}
      {result.label === INSPECTION_RESULT.FAIL && <Alert severity="error">{APP_MESSAGES.CARTON_WEIGHT_CHECK_FAILED}</Alert>}
    </Stack></Paper>}
    <Typography variant="h5">Physical Cartons in this Shipment</Typography>
    <TableContainer component={Paper}><SortableTable size="small" rowNumberStart={page * DEFAULT_TABLE_PAGE_SIZE}><TableHead><TableRow>
      {['Barcode', 'PO / Product', 'Color / Size', 'Quantity', 'Expected / Actual (kg)', 'Result', 'Completion'].map((label) => <TableCell key={label}>{label}</TableCell>)}
    </TableRow></TableHead><TableBody>
      {!loading && !data.content.length && <TableRow><TableCell colSpan={7}>No physical cartons are included in this shipment.</TableCell></TableRow>}
      {data.content.map((row) => { const outcome = weightResult(row); return <TableRow key={row.id}>
        <TableCell>{row.factoryBarcode}</TableCell><TableCell>{row.poNumber}<br />{row.articleNumber}</TableCell><TableCell>{row.color} / {row.size}</TableCell>
        <TableCell>{row.assignedQuantity}</TableCell><TableCell>{row.expectedWeightKg ?? '—'} / {row.weightKg ?? '—'}</TableCell><TableCell><Chip size="small" label={outcome.label} color={outcome.color} /></TableCell>
        <TableCell>{row.completedAt ? 'Completed' : row.inspectionPassed && row.status === BARCODE_CARTON_STATUS.COMPLETED && <Button disabled={busy || loading || Boolean(pollError) || plan?.status !== SHIPMENT_STATUS.PLANNED} onClick={() => complete(row)}>Complete Carton</Button>}</TableCell>
      </TableRow>; })}
    </TableBody></SortableTable></TableContainer>
    <TablePagination component="div" count={data.totalElements} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, next) => setPage(next)} />
  </Stack>;
}
