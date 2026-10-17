import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Cable, Download, PlayArrow, Refresh, Stop } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { isAdmin } from 'utils/accessControl';
import { listRfidPdaDevices, startRfidPda, stopRfidPda, previewRfidPdaExport, releaseRfidPda } from '../services/rfidPdaDevices';

const errorMessage = (e) => e?.response?.data?.message || e?.message || 'RFID PDA command failed';
// RFID Control V2 writes XLSX asynchronously. Retry only a *missing* export,
// never a protocol, authorization, wrong-carton, or malformed-file error.
const exportNotReady = (e) => /No inventory XLSX created\/modified since this START|No NEW inventory XLSX|Inventory XLSX is still being written/i.test(errorMessage(e));
const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const EXPORT_ATTEMPTS = 12;
const EXPORT_RETRY_MS = 1500;
/** Capture controls only: calibration and default reader assignment belong on RFID Devices page. */
export default function RfidPdaManager({ orderId, poId, sscc, stationCode, factoryCode, session, onImport, onCaptureActiveChange, onSessionRenewed }) {
  const factory = String(factoryCode || '').toUpperCase().trim();
  const [devices, setDevices] = useState([]);
  const [serial, setSerial] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [epcFilter, setEpcFilter] = useState('');
  const active = session?.status === 'SCANNING' && !!orderId && !!poId && !!sscc && !!stationCode?.trim() && /^F[1-7]$/.test(factory);
  const selected = devices.find((device) => device.serial === serial);
  const payload = useMemo(() => ({ stationCode: stationCode?.trim(), sscc, sessionId: session?.id }), [stationCode, sscc, session?.id]);
  const refresh = useCallback(async () => {
    if (!orderId || !poId || !stationCode?.trim() || !/^F[1-7]$/.test(factory)) { setDevices([]); setSerial(''); return; }
    const response = await listRfidPdaDevices(orderId, poId, stationCode.trim(), factory);
    const list = Array.isArray(response) ? response : [];
    setDevices(list);
    setSerial((previous) => list.some((x) => x.serial === previous) ? previous
      : list.find((x) => x.defaultReader)?.serial || list.find((x) => x.online && x.configured)?.serial || list[0]?.serial || '');
  }, [orderId, poId, stationCode, factory]);
  // Every new carton/factory starts with the centrally assigned default reader.
  // A PDA START may renew sessionId for the same carton: do not reset the PDA
  // control state back to IDLE when that happens.
  useEffect(() => { setSerial(''); setPhase('IDLE'); setPreview(null); setError(''); setNotice(''); }, [factory, sscc]);
  useEffect(() => { refresh().catch((e) => setError(errorMessage(e))); }, [refresh]);
  useEffect(() => { onCaptureActiveChange?.(phase !== 'IDLE'); }, [phase, onCaptureActiveChange]);
  useEffect(() => {
    if (selected && session?.id && selected.captureSessionId === session.id && ['STARTED', 'STOPPED'].includes(selected.capturePhase))
      setPhase(selected.capturePhase);
  }, [selected?.serial, selected?.capturePhase, selected?.captureSessionId, session?.id]);

  const operation = async (fn) => { setBusy(true); setError(''); setNotice(''); try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  const start = () => operation(async () => {
    const started = await startRfidPda(orderId, poId, serial, payload);
    setPreview(null); setPhase('STARTED');
    if (started?.sessionId && started.sessionId !== session?.id) {
      // Pull the new empty session from backend; clearing only React state would
      // leave the old EPCs in MongoDB and cause the next STOP to accumulate them.
      await onSessionRenewed?.(started.sessionId);
    }
    await refresh();
    setNotice('New scan started. Previous EPCs were archived; this capture has an empty EPC list.');
  });
  // STOP is a single user operation: stop the PDA, wait for its new export,
  // validate that the file belongs to this capture, submit all EPC batches,
  // then release the PDA. If any step fails the capture stays reserved so a
  // safe retry can use the SAME XLSX/session (backend idempotency is preserved).
  const loadStoppedCapture = async () => {
    let data;
    for (let attempt = 0; attempt < EXPORT_ATTEMPTS; attempt += 1) {
      setNotice(`Waiting for new PDA XLSX (${attempt + 1}/${EXPORT_ATTEMPTS})...`);
      try {
        data = await previewRfidPdaExport(orderId, poId, serial, payload);
        break;
      } catch (e) {
        if (!exportNotReady(e)) throw e;
        if (attempt === EXPORT_ATTEMPTS - 1) {
          throw new Error('No new or modified XLSX for this START yet. Export on the PDA, then press Retry Load. Older unchanged files are ignored.');
        }
        await delay(EXPORT_RETRY_MS);
      }
    }
    if (data.serial !== serial || data.sessionId !== session?.id || !Array.isArray(data.epcs) || !data.epcs.length)
      throw new Error('PDA XLSX does not match the active RFID carton session. No EPC was imported.');
    setPreview(data);
    setPhase('PREVIEW');
    // Only the latest export is read. Multiple candidates or rejected EPCs
    // require operator approval; never combine earlier exports with this one.
    const mismatchedSummary = (Number(data.excelUniqueTagCount) >= 0 && Number(data.excelUniqueTagCount) !== Number(data.excelRawUniqueEpcCount))
      || (Number(data.excelTotalReadCount) >= 0 && Number(data.excelTotalReadCount) !== Number(data.reads?.length || 0))
      || Number(data.excelUniqueTagCount) < 0 || Number(data.excelTotalReadCount) < 0;
    if ((data.sourceFileCount || 1) > 1 || Number(data.rejectedEpcCells || 0) > 0 || mismatchedSummary) {
      const accepted = window.confirm(
        `RFID export needs review before import.\n` +
        `Latest file: ${data.filename}; other newer/modified candidates: ${(data.skippedFiles || []).length}.\n` +
        `Excel UNIQUE TAG COUNT: ${data.excelUniqueTagCount < 0 ? '?' : data.excelUniqueTagCount}; ` +
        `raw unique tags: ${data.excelRawUniqueEpcCount}; TrueVUE: ${data.uniqueCount}; ` +
        `non-TrueVUE: ${data.rejectedEpcCells ?? '?'}.\n\n` +
        `Only the latest XLSX will be used. Invalid tags will be sent as invalid reads so RFID cannot falsely PASS. ` +
        `${mismatchedSummary ? 'WARNING: Excel summary does not match parsed rows (or summary is missing).\n' : ''}` +
        `Review the file carefully. Import this capture?`
      );
      if (!accepted) {
        setNotice('Import paused for review. Reader reservation remains active. Review source XLSX, then Retry Load or Discard.');
        return;
      }
    }
    // RFID Control V2's COUNT column represents repeat reads of each raw tag.
    // Submit those events (valid + unsupported) so backend readCount matches
    // Excel TOTAL READ COUNT while unique EPC quantity remains deduplicated.
    const incoming = Array.isArray(data.reads) && data.reads.length
      ? data.reads : [...data.epcs, ...(data.rejectedEpcs || [])];
    setNotice(`Importing ${incoming.length} Excel read event(s) from ${data.filename}, including repeat reads and unsupported tags...`);
    await onImport(incoming);
    // Only release after /reads confirmed every batch; never finish RFID here.
    await releaseRfidPda(orderId, poId, serial, payload);
    setPhase('IDLE');
    setPreview(null);
    setNotice(`Loaded latest XLSX ${data.filename}: ${data.excelRawUniqueEpcCount} raw unique tag(s), ` +
      `${data.uniqueCount} TrueVUE valid, ${(data.rejectedEpcs || []).length} invalid. ` +
      `Excel total reads: ${data.excelTotalReadCount < 0 ? 'unknown' : data.excelTotalReadCount}. ` +
      `Review quantity/SKU before Finish RFID.`);
    await refresh();
  };
  const stop = () => operation(async () => {
    await stopRfidPda(orderId, poId, serial, payload);
    setPhase('STOPPED');
    await loadStoppedCapture();
  });
  // Recovery only; normal users NEVER need Preview / Load buttons.
  const retryLoad = () => operation(loadStoppedCapture);
  const discard = () => {
    if (!window.confirm('Confirm PDA Inventory is STOPPED. Discard this capture without importing EPCs?')) return;
    operation(async () => { await releaseRfidPda(orderId, poId, serial, payload); setPhase('IDLE'); setPreview(null); setNotice('Capture discarded.'); });
  };
  const ready = selected?.configured && selected?.online && selected?.state === 'device';
  const usedByOther = selected?.capturing && selected?.captureSessionId !== session?.id;
  return (
    <Box sx={{ mt: 1, mb: 1, p: 1.2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" gap={0.75} alignItems="center"><Cable fontSize="small"/><Typography fontWeight={800} fontSize={13}>RFID · {factory || 'Factory unknown'}</Typography>
          <Chip size="small" variant="outlined" label={stationCode || 'Scale station'} /></Stack>
        <Button size="small" startIcon={<Refresh />} disabled={busy || phase !== 'IDLE'} onClick={() => operation(refresh)}>Refresh</Button>
      </Stack>
      {!/^F[1-7]$/.test(factory) ? <Alert severity="warning" sx={{ mt: 1 }}>Cannot identify Carton Factory. Select the correct Shipping before scanning.</Alert> : null}
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.9 }}>
        {devices.length > 1 ? (
          <TextField size="small" select label="RFID reader for this carton" value={serial}
            onChange={(e) => { setSerial(e.target.value); setError(''); setNotice(''); }}
            disabled={busy || phase !== 'IDLE'} sx={{ flex: '1 1 240px' }}>
            {devices.map((d) => <MenuItem key={d.serial} value={d.serial}>{d.label || d.serial}{d.defaultReader ? ' · Default' : ''} — {d.online ? 'Connected' : 'Offline'}</MenuItem>)}
          </TextField>
        ) : <Typography sx={{ fontSize: 13, fontWeight: 750, flex: 1 }}>{selected ? `${selected.label || selected.serial}${selected.defaultReader ? ' · Default' : ''}` : 'No RFID reader assigned'}</Typography>}
        <Chip size="small" color={usedByOther ? 'warning' : ready ? 'success' : 'default'}
          label={usedByOther ? 'IN USE' : ready ? 'ADB CONNECTED' : 'ADB NOT READY'} />
        {isAdmin() && <Button size="small" component={RouterLink} to="/buyers/lululemon/rfid-devices">Manage devices</Button>}
      </Stack>
      <Stack direction="row" gap={0.7} flexWrap="wrap" alignItems="center" sx={{ mt: 1 }}>
        <Button size="small" variant="contained" color="success" startIcon={<PlayArrow />}
          disabled={busy || !active || !ready || usedByOther || phase !== 'IDLE'} onClick={start}>START PDA</Button>
        <Button size="small" variant="outlined" color="warning" startIcon={<Stop />}
          disabled={busy || !active || phase !== 'STARTED'} onClick={stop}>STOP PDA</Button>
        <Button size="small" variant="outlined" startIcon={<Download />}
          disabled={busy || !active || !['STOPPED', 'PREVIEW'].includes(phase)} onClick={retryLoad}>Retry Load XLSX</Button>
        <Chip size="small" variant="outlined" label={`Tap control: ${phase} (not hardware verified)`} />
        {['STOPPED', 'PREVIEW'].includes(phase) ? <Button size="small" color="error" onClick={discard} disabled={busy}>Discard</Button> : null}
      </Stack>
      {preview ? <Stack spacing={0.55} sx={{ mt: 1 }}>
        <Typography variant="body2" fontWeight={750}>{preview.filename} · {preview.excelRawUniqueEpcCount ?? '—'} raw tags · {preview.uniqueCount} valid TrueVUE</Typography>
        <Typography variant="caption" color="text.secondary">
          Excel reports {preview.excelUniqueTagCount < 0 ? '—' : preview.excelUniqueTagCount} unique / {preview.excelTotalReadCount < 0 ? '—' : preview.excelTotalReadCount} reads · {preview.rejectedEpcCells ?? 0} invalid TrueVUE · {(preview.skippedFiles || []).length} earlier candidate exports skipped
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button size="small" variant="outlined" onClick={() => setPreviewOpen(true)}>Review all {preview.uniqueCount} EPCs</Button>
          <Typography variant="caption" color="text.secondary">This is a recovery preview; Retry Load will submit the same data safely.</Typography>
        </Stack>
      </Stack> : null}
      <Dialog open={previewOpen && Boolean(preview)} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>RFID Export — Review EPCs for SSCC {sscc}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>This is a PDA export preview, NOT a verified RFID PASS. Verify the file belongs to this carton before importing.</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Capture START on PDA: {preview?.captureStartedAtEpochSecond ? new Date(preview.captureStartedAtEpochSecond * 1000).toLocaleString() : '—'}.
            Excel reports unique tags {preview?.excelUniqueTagCount < 0 ? '—' : preview?.excelUniqueTagCount}, total reads {preview?.excelTotalReadCount < 0 ? '—' : preview?.excelTotalReadCount}.
            Parsed raw unique tags {preview?.excelRawUniqueEpcCount ?? '—'}; valid TrueVUE {preview?.uniqueCount ?? '—'}; invalid {preview?.rejectedEpcCells ?? '—'}.
          </Typography>
          {(preview?.sourceFiles || []).map((f) => (
            <Typography key={f.filename} variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
              XLSX: {f.filename} · PDA modified {new Date(f.modifiedAtEpochSecond * 1000).toLocaleString()} · EPC-shaped {f.candidateCells} · valid {f.validCells} · duplicate {f.duplicateCells} · invalid {f.rejectedEpcCells}
            </Typography>
          ))}
          {!!(preview?.skippedFiles || []).length && <Alert severity="warning" sx={{ mb: 1 }}>
            Older XLSX snapshots not merged: {(preview?.skippedFiles || []).join(', ')}
          </Alert>}
          {!!(preview?.rejectedEpcs || []).length && <Alert severity="warning" sx={{ mb: 1 }}>
            Unsupported/non-TrueVUE raw EPCs (recorded as invalid, not silently discarded): {(preview?.rejectedEpcs || []).join(', ')}
          </Alert>}
          <TextField size="small" fullWidth label="Search EPC" value={epcFilter} onChange={(event) => setEpcFilter(event.target.value)} sx={{ mb: 1 }}/>
          <TableContainer sx={{ maxHeight: 380, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader aria-label="RFID PDA export EPC list">
              <TableHead><TableRow><TableCell sx={{ width: 65 }}>STT</TableCell><TableCell>EPC</TableCell></TableRow></TableHead>
              <TableBody>
                {(preview?.epcs || []).filter((epc) => epc.toLowerCase().includes(epcFilter.trim().toLowerCase())).map((epc, idx) => (
                  <TableRow key={epc} hover><TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{epc}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions><Button onClick={() => setPreviewOpen(false)}>Close</Button></DialogActions>
      </Dialog>
      {error ? <Alert severity="error" sx={{ mt: 1, py: 0 }}>{error}</Alert> : null}
      {notice ? <Alert severity="info" sx={{ mt: 1, py: 0 }}>{notice}</Alert> : null}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        A new START renews the carton attempt if previous reads exist. STOP reads only the latest stable XLSX modified since START; older snapshots are not merged. Excel raw tags, valid TrueVUE and invalid tags are shown separately. Finish RFID still validates SKU and quantity.
      </Typography>
    </Box>
  );
}
