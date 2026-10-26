import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { CheckCircleOutline, QrCodeScanner, Refresh, ScaleOutlined, SensorsOutlined } from '@mui/icons-material';
import CartonRfidPanel from '../components/CartonRfidPanel';
import { getProcessingSummary, identifyProcessingCarton, saveProcessingManualWeight } from '../services/cartonProcessing';
import { listMyScalePlcDevices } from '../services/scalePlcDevices';
import { getFinalCartonStatus } from '../utils/finalCartonStatus';
import { BUYER_CODE } from '../../../constants/appConstants';
import { useSelectedFactory } from 'utils/factorySelection';

const messageOf = (err) => err?.response?.data?.message || err?.message || 'Request failed.';
const isFinished = (status) => status === 'PASS' || status === 'FAILED';
const numberText = (value) => (value === undefined || value === null || !Number.isFinite(Number(value))) ? '—' : Number(value).toFixed(3);

/** Inline per-Carton workspace based on the original PO carton list / weight UI.
 * Order > PO > select Carton row -> assign SSCC & confirm SKU -> RFID -> manual Weight.
 * No conveyor, Shipping, PO Picking, wizard screen, or blocking scan modal.
 */
export default function CartonProcessingPage({ orderId = '', poId = '', poNumber = '', carton, grossWeightKg, initialSscc = '', onCartonSaved, onClose }) {
  const { factoryCode, loading: factoryLoading, error: factoryError } = useSelectedFactory(BUYER_CODE.LULULEMON);
  const [summary, setSummary] = useState(null);
  const [scan, setScan] = useState({ sscc: '', sku: '' });
  const [active, setActive] = useState(null);
  const [rfid, setRfid] = useState(null);
  const [stationCode, setStationCode] = useState('');
  const [assignedScaleStations, setAssignedScaleStations] = useState([]);
  const [actualWeightKg, setActualWeightKg] = useState('');
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const skuRef = useRef(null);
  const ssccRef = useRef(null);
  const cartonId = carton?.id || '';
  const plannedQty = Number(active?.carton?.plannedQty ?? carton?.plannedQty ?? 0);
  const grossPerPiece = grossWeightKg == null || grossWeightKg === '' ? NaN : Number(grossWeightKg);
  const expected = Number.isFinite(grossPerPiece) && grossPerPiece > 0 && plannedQty > 0 ? grossPerPiece * plannedQty : null;
  const allowedMin = expected == null ? null : Math.max(0, expected - grossPerPiece);
  const allowedMax = expected == null ? null : expected + grossPerPiece;
  const weightStatus = saved?.carton?.weightStatus ?? active?.carton?.weightStatus ?? carton?.weightStatus;
  const rfidStatus = rfid?.status ?? active?.carton?.rfidStatus ?? carton?.rfidStatus;
  const finalStatus = (isFinished(weightStatus) && isFinished(rfidStatus)) ? getFinalCartonStatus(weightStatus, rfidStatus) : null;

  const refreshSummary = useCallback(async () => {
    if (!factoryCode) return;
    const result = await getProcessingSummary(factoryCode, orderId, poId);
    setSummary(result);
  }, [factoryCode, orderId, poId]);

  // Choosing a different row must reset every transient RFID and Weight field.
  useEffect(() => {
    setScan({ sscc: '', sku: '' }); setActive(null); setRfid(null);
    setSaved(null); setActualWeightKg(''); setNote(''); setError('');
    const prefetchedSscc = initialSscc?.trim() || carton?.cartonIdentity?.trim() || '';
    if (prefetchedSscc) {
      setScan((previous) => ({ ...previous, sscc: prefetchedSscc }));
      window.requestAnimationFrame(() => skuRef.current?.focus());
    } else {
      window.requestAnimationFrame(() => ssccRef.current?.focus());
    }
  }, [cartonId]);
  useEffect(() => { if (!factoryLoading && factoryCode) refreshSummary().catch((e) => setError(messageOf(e))); }, [refreshSummary, factoryLoading, factoryCode]);
  useEffect(() => {
    if (factoryLoading || !factoryCode) return undefined;
    let cancelled = false;
    listMyScalePlcDevices().then((devices) => {
      if (cancelled) return;
      const matching = (Array.isArray(devices) ? devices : []).filter((d) =>
        String(d.factoryCode || '').toUpperCase() === String(factoryCode).toUpperCase());
      setAssignedScaleStations(matching);
      if (matching.length === 1) setStationCode(matching[0].stationCode || '');
    }).catch(() => { if (!cancelled) setAssignedScaleStations([]); });
    return () => { cancelled = true; };
  }, [factoryLoading, factoryCode]);

  const identify = async () => {
    if (busy || !cartonId || !stationCode.trim() || !scan.sscc.trim() || !scan.sku.trim() || !factoryCode || carton.weightStatus) return;
    setBusy(true); setError(''); setNote('');
    try {
      const result = await identifyProcessingCarton({ sscc: scan.sscc.trim(), sku: scan.sku.trim(), factoryCode,
        orderId, poId, cartonId });
      if (result?.carton?.id !== cartonId) throw new Error('Backend identified a different Carton than the selected row. Processing stopped.');
      setActive(result); setRfid(null); setSaved(null); setActualWeightKg('');
      setNote(`Carton ${result.carton.cartonNo} confirmed. Scan RFID, then record Weight.`);
      onCartonSaved?.(); // Refresh its SSCC in the PO table after assignment.
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  const saveWeight = async () => {
    if (!active || !isFinished(rfid?.status) || busy || saved) return;
    setBusy(true); setError('');
    try {
      const result = await saveProcessingManualWeight({ sscc: active.carton.sscc18,
        stationCode: stationCode.trim(), actualWeightKg: Number(actualWeightKg) });
      setSaved(result);
      setNote(`Carton saved · RFID ${rfid.status}, Weight ${result.carton.weightStatus}.`);
      await refreshSummary();
      onCartonSaved?.();
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  const markNext = () => {
    setActive(null); setSaved(null); setRfid(null); setScan({ sscc: '', sku: '' });
    setActualWeightKg(''); setError(''); setNote('');
    onCartonSaved?.(); onClose?.();
  };
  if (!cartonId) return null;
  return <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, borderColor: 'primary.light' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1} sx={{ mb: 1.5 }}>
      <Box><Typography fontWeight={900} variant="h6">Carton {carton.cartonNo} · Assign SSCC / RFID / Weight</Typography>
        <Typography variant="body2" color="text.secondary">PO {poNumber} · Factory {factoryCode || '—'} · Process this selected Carton only</Typography></Box>
      <Stack direction="row" gap={1} alignItems="center">
        <Button variant="outlined" size="small" startIcon={<Refresh/>} onClick={() => refreshSummary().catch((e) => setError(messageOf(e)))}>Refresh</Button>
        <Button size="small" onClick={onClose}>Close</Button>
      </Stack>
    </Stack>
    <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
      <Chip color="primary" variant="outlined" label={`Expected Qty: ${plannedQty} pcs`} />
      <Chip variant="outlined" label={`Expected Weight: ${numberText(expected)} kg`} />
      <Chip variant="outlined" label={`Allowed: ${numberText(allowedMin)} – ${numberText(allowedMax)} kg`} />
      <Chip variant="outlined" label={`SSCC: ${active?.carton?.sscc18 || carton.cartonIdentity || 'Not assigned'}`} />
      <Chip variant="outlined" color={rfidStatus === 'PASS' ? 'success' : rfidStatus === 'FAILED' ? 'error' : 'default'} label={`RFID: ${rfidStatus || 'PENDING'}`} />
      <Chip variant="outlined" color={weightStatus === 'PASS' ? 'success' : weightStatus === 'FAILED' ? 'error' : 'default'} label={`Weight: ${weightStatus || 'PENDING'}`} />
    </Stack>
    <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
      {assignedScaleStations.length ? <TextField select SelectProps={{ native: true }} size="small"
        label="Assigned Scale Station" value={stationCode} onChange={(e) => setStationCode(e.target.value)}
        disabled={Boolean(active)} sx={{ minWidth: 215 }}>
        <option value="">Select assigned Station</option>
        {assignedScaleStations.map((item) => <option key={item.stationCode} value={item.stationCode}>{item.stationCode}</option>)}
      </TextField> : <TextField label="Station Code" size="small" placeholder="Assigned station / test station"
        value={stationCode} onChange={(e) => setStationCode(e.target.value)}
        disabled={Boolean(active)} sx={{ minWidth: 215 }}/>} 
      <Typography variant="caption" color="text.secondary">Choose your assigned station before starting RFID. It stays fixed through Weight.</Typography>
    </Stack>
    {Boolean(carton.weightStatus) && !active && <Alert severity="info" sx={{ mb: 1 }}>This carton already has a saved Weight result ({carton.weightStatus}). To scan again, an authorized supervisor must reopen the record in History. Existing results are kept.</Alert>}
    {(factoryError || error) && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{factoryError || error}</Alert>}
    {note && <Alert severity="info" sx={{ mb: 1 }} onClose={() => setNote('')}>{note}</Alert>}
    {!active ? <Box sx={{ maxWidth: 700 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}><QrCodeScanner sx={{ verticalAlign: 'middle', mr: 0.8 }}/>1. Scan / Assign SSCC + SKU</Typography>
      <Stack spacing={1}>
        <TextField inputRef={ssccRef} autoFocus size="small" label="SSCC-18 (or GS1 (00) barcode)" value={scan.sscc}
          onChange={(e) => setScan((s) => ({ ...s, sscc: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); skuRef.current?.focus(); } }}/>
        <TextField inputRef={skuRef} size="small" label="SKU on carton label" value={scan.sku}
          onChange={(e) => setScan((s) => ({ ...s, sku: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); identify(); } }}/>
        <Button variant="contained" onClick={identify} disabled={busy || factoryLoading || !stationCode.trim() || Boolean(carton.weightStatus) || !factoryCode || !scan.sscc.trim() || !scan.sku.trim()}>
          {carton.cartonIdentity ? 'Confirm SSCC + SKU' : 'Assign SSCC + Confirm SKU'}</Button>
        <Typography variant="caption" color="text.secondary">Selected Carton {carton.cartonNo} has Qty {plannedQty}. SSCC will only be assigned to this row, never another FIFO carton. Already-assigned SSCCs are verified; duplicates across POs are rejected.</Typography>
      </Stack>
    </Box> : <Stack spacing={1.5}>
      <Divider/>
      <Box>
        <Typography fontWeight={800} sx={{ mb: 1 }}><SensorsOutlined sx={{ verticalAlign: 'middle', mr: 0.8 }}/>2. RFID Scan</Typography>
        <CartonRfidPanel key={active.carton.id} orderId={active.carton.orderId} poId={active.carton.poId}
          carton={active.carton} factoryCode={factoryCode} stationCode={stationCode.trim()} onSessionChange={setRfid}/>
      </Box>
      <Divider/>
      <Box>
        <Typography fontWeight={800} sx={{ mb: 1 }}><ScaleOutlined sx={{ verticalAlign: 'middle', mr: 0.8 }}/>3. Weight — Manual Save</Typography>
        {rfid?.status === 'FAILED' && <Alert severity="warning" sx={{ mb: 1 }}>RFID FAILED. Weight may be recorded, but Final PASS requires RFID PASS and Weight PASS.</Alert>}
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
          <Chip label={`Expected: ${numberText(expected)} kg`} />
          <Chip label={`Min: ${numberText(allowedMin)} kg`} />
          <Chip label={`Max: ${numberText(allowedMax)} kg`} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
<Chip label={`Scale station: ${stationCode || "—"}`} variant="outlined"/>
          <TextField label="Actual Weight (kg)" size="small" type="number" value={actualWeightKg}
            disabled={Boolean(saved)} onChange={(e) => setActualWeightKg(e.target.value)} inputProps={{ min: 0, step: 0.001 }}/>
          <Button variant="contained" onClick={saveWeight} disabled={busy || !isFinished(rfid?.status) || Boolean(saved) || !(Number(actualWeightKg) > 0) || !stationCode.trim()}>
            Save Weight</Button>
          {saved && <Chip color={saved.carton.weightStatus === 'PASS' ? 'success' : 'error'} label={`Weight ${saved.carton.weightStatus}`}/>}
        </Stack>
        {!isFinished(rfid?.status) && <Typography variant="caption" color="text.secondary">Finish RFID scan before entering Weight result. PLC auto-save is not enabled.</Typography>}
        {saved && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Expected {numberText(saved.event.expectedWeightKg)} kg ±{numberText(saved.event.toleranceKg)} kg · Actual {numberText(saved.event.actualWeightKg)} kg</Typography>}
      </Box>
      {saved && <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
          <Box><Typography fontWeight={900}>FINAL {finalStatus === 'PASS' ? 'PASS' : 'FAILED / HOLD'}</Typography>
            <Typography variant="caption" color="text.secondary">Processed {summary?.processed ?? '—'}/{summary?.total ?? '—'} · Remaining {summary?.remaining ?? '—'} · RFID and Weight must both PASS.</Typography></Box>
          <Button variant="contained" startIcon={<CheckCircleOutline/>} onClick={markNext}>{summary?.end ? 'END · Back to Carton List' : 'Next Carton · Back to List'}</Button>
        </Stack>
      </Paper>}
    </Stack>}
  </Paper>;
}
