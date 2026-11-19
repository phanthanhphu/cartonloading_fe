import { useT } from '../../../i18n/LanguageProvider';
import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import { CheckCircleOutline, QrCodeScanner, Refresh, ScaleOutlined, SensorsOutlined } from '@mui/icons-material';
import CartonRfidPanel from '../components/CartonRfidPanel';
import { getProcessingSummary, endProcessingPo, identifyProcessingCarton, saveProcessingManualWeight } from '../services/cartonProcessing';
import { listMyScalePlcDevices } from '../services/scalePlcDevices';
import { getFinalCartonStatus } from '../utils/finalCartonStatus';
import { BUYER_CODE, FINAL_INSPECTION_RESULT, RFID_CHECK_RESULT, WEIGHING_RESULT, KEYBOARD_KEY } from '../../../constants/appConstants';
import { useSelectedFactory } from 'utils/factorySelection';

const messageOf = (err) => err?.response?.data?.message || err?.message || 'Request failed.';
const isFinished = (status) => status === RFID_CHECK_RESULT.PASS || status === RFID_CHECK_RESULT.FAILED;
const numberText = (value) => (value === undefined || value === null || !Number.isFinite(Number(value))) ? '—' : Number(value).toFixed(3);

/** Inline per-Carton workspace based on the original PO carton list / weight UI.
 * Order > PO > select Carton row -> assign SSCC & confirm SKU -> RFID -> manual Weight.
 * No conveyor, Shipping, PO Picking, wizard screen, or blocking scan modal.
 */
export default function CartonProcessingPage({ orderId = '', poId = '', poNumber = '', carton, grossWeightKg, initialSscc = '', onCartonSaved, onClose }) {
  const trUi = useT();
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
  useAutoDismissFeedback(error, setError, '', 'error');
  const [note, setNote] = useState('');
  useAutoDismissFeedback(note, setNote, '', 'info');
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
  const markNext = async () => {
    if (busy) return;
    if (summary?.end) {
      setBusy(true); setError('');
      try {
        // Explicit PO END, not merely closing a carton detail window.
        await endProcessingPo(orderId, poId);
      } catch (error) {
        setError(messageOf(error));
        await refreshSummary().catch(() => {});
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setActive(null); setSaved(null); setRfid(null); setScan({ sscc: '', sku: '' });
    setActualWeightKg(''); setError(''); setNote('');
    onCartonSaved?.(); onClose?.();
  };
  if (!cartonId) return null;
  return <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, borderRadius: '4px', borderColor: 'primary.light' }}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1} sx={{ mb: 1.5 }}>
      <Box><Typography fontWeight={900} variant="h6">{trUi("Carton ")}{carton.cartonNo}{trUi(" · Assign SSCC / RFID / Weight")}</Typography>
        <Typography variant="body2" color="text.secondary">PO {poNumber}{trUi(" · Factory ")}{factoryCode || '—'}{trUi(" · Process this selected Carton only")}</Typography></Box>
      <Stack direction="row" gap={1} alignItems="center">
        <Button variant="outlined" size="small" startIcon={<Refresh/>} onClick={() => refreshSummary().catch((e) => setError(messageOf(e)))}>{trUi("Refresh")}</Button>
        <Button size="small" onClick={onClose}>{trUi("Close")}</Button>
      </Stack>
    </Stack>
    <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
      <Chip color="primary" variant="outlined" label={trUi("Expected Qty: {0} pcs", plannedQty)} />
      <Chip variant="outlined" label={trUi("Expected Weight: {0} kg", numberText(expected))} />
      <Chip variant="outlined" label={`Allowed: ${numberText(allowedMin)} – ${numberText(allowedMax)} kg`} />
      <Chip variant="outlined" label={`SSCC: ${active?.carton?.sscc18 || carton.cartonIdentity || trUi("Not assigned")}`} />
      <Chip variant="outlined" color={rfidStatus === RFID_CHECK_RESULT.PASS ? 'success' : rfidStatus === RFID_CHECK_RESULT.FAILED ? 'error' : 'default'} label={`RFID: ${rfidStatus || 'PENDING'}`} />
      <Chip variant="outlined" color={weightStatus === WEIGHING_RESULT.PASS ? 'success' : weightStatus === WEIGHING_RESULT.FAILED ? 'error' : 'default'} label={`Weight: ${weightStatus || 'PENDING'}`} />
    </Stack>
    <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
      {assignedScaleStations.length ? <TextField select SelectProps={{ native: true }} size="small"
        label={trUi("Assigned Scale Station")} value={stationCode} onChange={(e) => setStationCode(e.target.value)}
        disabled={Boolean(active)} sx={{ minWidth: 215 }}>
        <option value="">{trUi("Select assigned Station")}</option>
        {assignedScaleStations.map((item) => <option key={item.stationCode} value={item.stationCode}>{item.stationCode}</option>)}
      </TextField> : <TextField label={trUi("Station Code")} size="small" placeholder={trUi("Assigned station / test station")}
        value={stationCode} onChange={(e) => setStationCode(e.target.value)}
        disabled={Boolean(active)} sx={{ minWidth: 215 }}/>} 
      <Typography variant="caption" color="text.secondary">{trUi("Choose your assigned station before starting RFID. It stays fixed through Weight.")}</Typography>
    </Stack>
    {Boolean(carton.weightStatus) && !active && <Alert severity="info" sx={{ mb: 1 }}>{trUi("This carton already has a saved Weight result (")}{carton.weightStatus}{trUi("). To scan again, an authorized supervisor must reopen the record in History. Existing results are kept.")}</Alert>}
    {(factoryError || error) && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{factoryError || error}</Alert>}
    {note && <Alert severity="info" sx={{ mb: 1 }} onClose={() => setNote('')}>{note}</Alert>}
    {!active ? <Box sx={{ maxWidth: 700 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}><QrCodeScanner sx={{ verticalAlign: 'middle', mr: 0.8 }}/>{trUi("1. Scan / Assign SSCC + SKU")}</Typography>
      <Stack spacing={1}>
        <TextField inputRef={ssccRef} autoFocus size="small" label={trUi("SSCC-18 (or GS1 (00) barcode)")} value={scan.sscc}
          onChange={(e) => setScan((s) => ({ ...s, sscc: e.target.value }))}
          onKeyDown={(e) => { if (e.key === KEYBOARD_KEY.ENTER) { e.preventDefault(); skuRef.current?.focus(); } }}/>
        <TextField inputRef={skuRef} size="small" label={trUi("SKU on carton label")} value={scan.sku}
          onChange={(e) => setScan((s) => ({ ...s, sku: e.target.value }))}
          onKeyDown={(e) => { if (e.key === KEYBOARD_KEY.ENTER) { e.preventDefault(); identify(); } }}/>
        <Button variant="contained" onClick={identify} disabled={busy || factoryLoading || !stationCode.trim() || Boolean(carton.weightStatus) || !factoryCode || !scan.sscc.trim() || !scan.sku.trim()}>
          {carton.cartonIdentity ? trUi("Confirm SSCC + SKU") : trUi("Assign SSCC + Confirm SKU")}</Button>
        <Typography variant="caption" color="text.secondary">{trUi("Selected Carton ")}{carton.cartonNo}{trUi(" has Qty ")}{plannedQty}{trUi(". SSCC will only be assigned to this row, never another FIFO carton. Already-assigned SSCCs are verified; duplicates across POs are rejected.")}</Typography>
      </Stack>
    </Box> : <Stack spacing={1.5}>
      <Divider/>
      <Box>
        <Typography fontWeight={800} sx={{ mb: 1 }}><SensorsOutlined sx={{ verticalAlign: 'middle', mr: 0.8 }}/>{trUi("2. RFID Scan")}</Typography>
        <CartonRfidPanel key={active.carton.id} orderId={active.carton.orderId} poId={active.carton.poId}
          carton={active.carton} factoryCode={factoryCode} stationCode={stationCode.trim()} onSessionChange={setRfid}/>
      </Box>
      <Divider/>
      <Box>
        <Typography fontWeight={800} sx={{ mb: 1 }}><ScaleOutlined sx={{ verticalAlign: 'middle', mr: 0.8 }}/>{trUi("3. Weight — Manual Save")}</Typography>
        {rfid?.status === RFID_CHECK_RESULT.FAILED && <Alert severity="warning" sx={{ mb: 1 }}>{trUi("RFID FAILED. Weight may be recorded, but Final PASS requires RFID PASS and Weight PASS.")}</Alert>}
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
          <Chip label={`Expected: ${numberText(expected)} kg`} />
          <Chip label={`Min: ${numberText(allowedMin)} kg`} />
          <Chip label={`Max: ${numberText(allowedMax)} kg`} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
<Chip label={trUi("Scale station: {0}", stationCode || "—")} variant="outlined"/>
          <TextField label={trUi("Actual Weight (kg)")} size="small" type="number" value={actualWeightKg}
            disabled={Boolean(saved)} onChange={(e) => setActualWeightKg(e.target.value)} inputProps={{ min: 0, step: 0.001 }}/>
          <Button variant="contained" onClick={saveWeight} disabled={busy || !isFinished(rfid?.status) || Boolean(saved) || !(Number(actualWeightKg) > 0) || !stationCode.trim()}>{trUi("\n            Save Weight")}</Button>
          {saved && <Chip color={saved.carton.weightStatus === WEIGHING_RESULT.PASS ? 'success' : 'error'} label={`Weight ${saved.carton.weightStatus}`}/>}
        </Stack>
        {!isFinished(rfid?.status) && <Typography variant="caption" color="text.secondary">{trUi("Finish RFID scan before entering Weight result. PLC auto-save is not enabled.")}</Typography>}
        {saved && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{trUi("\n          Expected ")}{numberText(saved.event.expectedWeightKg)}{trUi(" kg ±")}{numberText(saved.event.toleranceKg)}{trUi(" kg · Actual ")}{numberText(saved.event.actualWeightKg)} kg</Typography>}
      </Box>
      {saved && <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '4px' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
          <Box><Typography fontWeight={900}>{trUi("FINAL ")}{finalStatus === FINAL_INSPECTION_RESULT.PASS ? 'PASS' : trUi("FAILED / HOLD")}</Typography>
            <Typography variant="caption" color="text.secondary">{trUi("Processed ")}{summary?.processed ?? '—'}/{summary?.total ?? '—'}{trUi(" · Remaining ")}{summary?.remaining ?? '—'}{trUi(" · RFID and Weight must both PASS.")}</Typography></Box>
          <Button variant="contained" startIcon={<CheckCircleOutline/>} onClick={markNext} disabled={busy}>{busy ? 'Saving…' : summary?.end ? trUi("END · Back to Carton List") : trUi("Next Carton · Back to List")}</Button>
        </Stack>
      </Paper>}
    </Stack>}
  </Paper>;
}
