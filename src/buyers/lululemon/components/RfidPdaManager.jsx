import { isFactoryCode } from '../../../common/factory/factoryCodes';
import { getRawInventoryPreviewRows } from '../utils/trueVueEpc';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Cable, Download, PlayArrow, Refresh, Stop, ExpandMore, ExpandLess } from '@mui/icons-material';
import { getAssignedRfidReader, getRfidReaderStatus } from '../utils/assignedEquipment';
import { listRfidPdaDevices, startRfidPda, stopRfidPda, previewRfidPdaExport, releaseRfidPda } from '../services/rfidPdaDevices';

const errorMessage = (e) => e?.response?.data?.message || e?.message || 'RFID PDA command failed';
// RFID Control V2 writes XLSX asynchronously. Retry only a *missing* export,
// never a protocol, authorization, wrong-carton, or malformed-file error.
const exportNotReady = (e) => /No inventory XLSX created\/modified since this START|No NEW inventory XLSX|Inventory XLSX is still being written/i.test(errorMessage(e));
const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const EXPORT_ATTEMPTS = 12;
const EXPORT_RETRY_MS = 1500;
/** Capture controls only: calibration and default reader assignment belong on RFID Devices page. */
export default function RfidPdaManager({ orderId, poId, sscc, stationCode, factoryCode, session, onImport, onCaptureActiveChange, onSessionRenewed, onCaptureImported, compact = false }) {
  const factory = String(factoryCode || '').toUpperCase().trim();
  const [devices, setDevices] = useState([]);
  const [serial, setSerial] = useState('');
  const [phase, setPhase] = useState('IDLE');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [epcFilter, setEpcFilter] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);
  const active = session?.status === 'SCANNING' && !!orderId && !!poId && !!sscc && !!stationCode?.trim() && isFactoryCode(factory);
  const selected = devices.find((device) => device.serial === serial);
  // Preserve the XLSX EPC order, original PC prefix and per-tag COUNT for preview.
  const previewRows = useMemo(() => getRawInventoryPreviewRows(preview), [preview]);

  const payload = useMemo(() => ({ stationCode: stationCode?.trim(), sscc, sessionId: session?.id }), [stationCode, sscc, session?.id]);
  const refresh = useCallback(async () => {
    if (!orderId || !poId || !stationCode?.trim() || !isFactoryCode(factory)) { setDevices([]); setSerial(''); return; }
    const response = await listRfidPdaDevices(orderId, poId, stationCode.trim(), factory);
    const list = Array.isArray(response) ? response : [];
    setDevices(list);
    // The operator cannot pick a different reader. Admin controls the Factory
    // default. Preserve an in-flight reader for the active capture session.
    setSerial((previous) => {
      const inFlight = list.find((device) => device.serial === previous
        && device.captureSessionId === session?.id && device.capturing);
      return inFlight?.serial || getAssignedRfidReader(list)?.serial || '';
    });
  }, [orderId, poId, stationCode, factory, session?.id]);
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
    // Auto-import the latest stable XLSX immediately after STOP, without a
    // confirmation dialog. Earlier exports are not merged; unsupported EPCs
    // are submitted as invalid reads and never contribute to RFID PASS.
    // A corrupt/inconsistent Excel summary is a hard validation error instead
    // of silently importing untrustworthy data or requesting manual approval.
    const summaryMismatch = (Number(data.excelUniqueTagCount) >= 0 && Number(data.excelUniqueTagCount) !== Number(data.excelRawUniqueEpcCount))
      || (Number(data.excelTotalReadCount) >= 0 && Number(data.excelTotalReadCount) !== Number(data.reads?.length || 0))
      || Number(data.excelUniqueTagCount) < 0 || Number(data.excelTotalReadCount) < 0;
    if (summaryMismatch) {
      throw new Error(`RFID XLSX summary mismatch in ${data.filename}. Import was stopped automatically to protect carton data. ` +
        'Check the XLSX export and use Retry Load after the file is corrected.');
    }
    // RFID Control V2's COUNT column represents repeat reads of each raw tag.
    // Submit those events (valid + unsupported) so backend readCount matches
    // Excel TOTAL READ COUNT while unique EPC quantity remains deduplicated.
    const incoming = Array.isArray(data.reads) && data.reads.length
      ? data.reads : [...data.epcs, ...(data.rejectedEpcs || [])];
    setNotice(`Importing ${incoming.length} Excel read event(s) from ${data.filename}, including repeat reads and unsupported tags...`);
    const importedSession = await onImport(incoming);
    // Release the PDA FIRST. The carton can only finalize after capture is
    // fully stopped and all the accepted reads have persisted on the server.
    await releaseRfidPda(orderId, poId, serial, payload);
    setPhase('IDLE');
    setPreview(null);
    await onCaptureImported?.(importedSession);
    setNotice(`Automatically loaded latest XLSX ${data.filename}: ${data.excelRawUniqueEpcCount} raw unique tag(s), ` +
      `${data.uniqueCount} TrueVUE valid, ${(data.rejectedEpcs || []).length} invalid. ` +
      `Excel total reads: ${data.excelTotalReadCount < 0 ? 'unknown' : data.excelTotalReadCount}. ` +
      `RFID result is verified by the server.`);
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
    if (!confirmDiscard) { setConfirmDiscard(true); return; }
    operation(async () => {
      await releaseRfidPda(orderId, poId, serial, payload);
      setPhase('IDLE'); setPreview(null); setConfirmDiscard(false); setNotice('Capture discarded.');
    });
  };
  const ready = selected?.configured && selected?.online && selected?.state === 'device';
  const usedByOther = selected?.capturing && selected?.captureSessionId !== session?.id;
  const readerStatus = getRfidReaderStatus(selected);
  const readerNeedsDefault = devices.length > 1 && !devices.some((device) => device.defaultReader);
  return (
    <Box sx={{ mt: compact ? 0.3 : 1, mb: compact ? 0.3 : 1, p: compact ? 0.55 : 1.2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
      {(!compact || showTechnical) && <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" gap={0.75} alignItems="center"><Cable fontSize="small"/><Typography fontWeight={800} fontSize={13}>RFID · {factory || 'Factory unknown'}</Typography>
          <Chip size="small" variant="outlined" label={stationCode || 'Scale station'} /></Stack>
        <Button size="small" startIcon={<Refresh />} disabled={busy || phase !== 'IDLE'} onClick={() => operation(refresh)}>Refresh</Button>
      </Stack>}
      {!isFactoryCode(factory) ? <Alert severity="warning" sx={{ mt: 1 }}>Cannot identify Carton Factory. Select the assigned Factory before scanning.</Alert> : null}
      <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap" sx={{ mt: compact ? 0.2 : 0.9 }}>
        <Cable fontSize="small" color={ready ? 'success' : 'disabled'} />
        <Typography sx={{ fontSize: 13, fontWeight: 750, flex: 1 }}>
          {selected ? `RFID Reader · ${selected.label || selected.serial}` : readerNeedsDefault ? 'RFID Reader · Default not assigned' : 'RFID Reader · Not assigned'}
        </Typography>
        <Chip size="small" color={usedByOther ? 'warning' : readerStatus.color}
          label={usedByOther ? 'IN USE BY ANOTHER CARTON' : readerStatus.label} />
      </Stack>
      {readerNeedsDefault ? <Alert severity="warning" sx={{ mt: 0.5, py: 0 }}>
        Multiple readers are assigned to this Factory. Ask Admin to set the default Reader before scanning.
      </Alert> : null}
      <Stack direction="row" gap={compact ? 0.4 : 0.7} flexWrap="wrap" alignItems="center" sx={{ mt: compact ? 0.35 : 1 }}>
        <Button size="small" variant="contained" color="success" startIcon={<PlayArrow />}
          disabled={busy || !active || !ready || usedByOther || phase !== 'IDLE'} onClick={start}>START PDA</Button>
        <Button size="small" variant="outlined" color="warning" startIcon={<Stop />}
          disabled={busy || !active || phase !== 'STARTED'} onClick={stop}>STOP PDA</Button>
        <Button size="small" variant="outlined" startIcon={<Download />}
          disabled={busy || !active || !['STOPPED', 'PREVIEW'].includes(phase)} onClick={retryLoad}>Retry Load XLSX</Button>
        {(!compact || showTechnical) && <Chip size="small" variant="outlined" label={`Tap control: ${phase} (not hardware verified)`} />}
        {['STOPPED', 'PREVIEW'].includes(phase) ? <Button size="small" color="error" onClick={discard} disabled={busy}>{confirmDiscard ? 'Confirm Discard' : 'Discard'}</Button> : null}
        {confirmDiscard && <Button size="small" onClick={() => setConfirmDiscard(false)} disabled={busy}>Keep Capture</Button>}
      </Stack>
      {compact && <Button size="small" variant="text" color="inherit" sx={{ mt: 0.25, py: 0.1, minHeight: 22, fontSize: 11 }}
        endIcon={showTechnical ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        onClick={() => setShowTechnical((value) => !value)}>{showTechnical ? 'Hide reader details' : 'Show more reader / XLSX details'}</Button>}
      {(!compact || showTechnical) && (preview ? <Stack spacing={0.55} sx={{ mt: 1 }}>
        <Typography variant="body2" fontWeight={750}>{preview.filename} · {preview.excelRawUniqueEpcCount ?? '—'} raw tags · {preview.uniqueCount} valid TrueVUE</Typography>
        <Typography variant="caption" color="text.secondary">
          Excel reports {preview.excelUniqueTagCount < 0 ? '—' : preview.excelUniqueTagCount} unique / {preview.excelTotalReadCount < 0 ? '—' : preview.excelTotalReadCount} reads · {preview.rejectedEpcCells ?? 0} invalid TrueVUE · {(preview.skippedFiles || []).length} earlier candidate exports skipped
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button size="small" variant="outlined" onClick={() => setPreviewOpen(true)}>Review all {preview.excelRawUniqueEpcCount ?? preview.uniqueCount} raw tags</Button>
        </Stack>
      </Stack> : null)}
      {previewOpen && preview && <Paper variant="outlined" sx={{ mt: 1, p: 1.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>RFID Export — Review EPCs for SSCC {sscc}</Typography>
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
              <TableHead><TableRow><TableCell sx={{ width: 65 }}>STT</TableCell><TableCell>Raw EPC (Excel)</TableCell><TableCell>COUNT</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {previewRows.filter((item) => item.epc.toLowerCase().includes(epcFilter.trim().toLowerCase())).map((item, idx) => (
                  <TableRow key={item.epc} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{item.epc}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{item.count}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: item.valid ? 'success.main' : 'error.main' }}>
                      {item.valid ? 'TrueVUE' : 'Unsupported'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}><Button onClick={() => setPreviewOpen(false)}>Close Details</Button></Stack>
      </Paper>}
      {error ? <Alert severity="error" sx={{ mt: 1, py: 0 }}>{error}</Alert> : null}
      {notice && (!compact || showTechnical || busy || phase !== 'IDLE') ? <Alert severity="info" sx={{ mt: 0.4, py: 0 }}>{notice}</Alert> : null}
    </Box>
  );
}
