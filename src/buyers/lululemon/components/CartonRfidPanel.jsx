import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Collapse, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { ExpandLess, ExpandMore, QrCodeScannerOutlined, Refresh, Sensors } from '@mui/icons-material';
import {
  getCartonRfidSession,
  startCartonRfidSession,
  submitCartonRfidReads,
  finishCartonRfidSession,
  reopenCartonRfidSession
} from '../services/weighing';
import { decodeTrueVueEpc, getUniqueEpcRows } from '../utils/trueVueEpc';
import RfidPdaManager from './RfidPdaManager';

const messageOf = (error) => error?.response?.data?.message || error?.message || 'RFID request failed.';
const statusColor = (status) => status === 'PASS' ? 'success' : status === 'FAILED' ? 'error' : status === 'SCANNING' ? 'info' : 'default';
const splitReads = (value) => String(value || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
const miniLabel = { fontSize: 11, lineHeight: 1.15, color: 'text.secondary' };
const miniValue = { fontSize: 15, fontWeight: 850, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' };

const statCircleSx = (mode) => ({
  width: 56,
  height: 56,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontSize: 21,
  fontWeight: 950,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
  border: '2px solid',
  ...(mode === 'dark' ? { bgcolor: '#111827', borderColor: '#111827', color: '#ffffff' } : {}),
  ...(mode === 'success' ? { bgcolor: '#16a34a', borderColor: '#16a34a', color: '#ffffff' } : {}),
  ...(mode === 'error' ? { bgcolor: '#dc2626', borderColor: '#dc2626', color: '#ffffff' } : {}),
});

/**
 * Compact Lululemon RFID carton test: a single EPC entry on Enter, or optional batch paste.
 * Reader Bridge later POSTs the same /reads API; the backend is the authority on dedupe / PASS.
 */
export default function CartonRfidPanel({ orderId, poId, carton, stationCode, factoryCode, onSessionChange, admin = false }) {
  const [session, setSession] = useState(null);
  const [singleEpc, setSingleEpc] = useState('');
  const [batchEpcs, setBatchEpcs] = useState('');
  const [batchOpen, setBatchOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deviceCapturing, setDeviceCapturing] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const currentSessionId = useRef(null);
  const sscc = carton?.sscc18 || carton?.sscc || '';

  const publish = useCallback((result) => {
    currentSessionId.current = result?.id || null;
    setSession(result);
    onSessionChange?.(result || null);
  }, [onSessionChange]);

  useEffect(() => {
    if (!orderId || !poId || !sscc) return undefined;
    let cancelled = false;
    currentSessionId.current = null;
    setSession(null); setSingleEpc(''); setBatchEpcs(''); setError(''); setNote('');
    (async () => {
      try {
        let result = await getCartonRfidSession(orderId, poId, sscc);
        if (!result || result.status === 'REOPENED') {
          result = await startCartonRfidSession(orderId, poId, { sscc, stationCode });
        }
        if (!cancelled) publish(result);
      } catch (e) {
        if (!cancelled) setError(messageOf(e));
      }
    })();
    return () => { cancelled = true; };
  }, [orderId, poId, sscc, stationCode, publish]);

  useEffect(() => {
    if (session?.status !== 'SCANNING' || !orderId || !poId || !sscc) return undefined;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const latest = await getCartonRfidSession(orderId, poId, sscc);
        // Catch a restarted session after an interrupted PDA START response.
        if (!cancelled && latest?.status === 'SCANNING' && latest?.stationCode === stationCode) publish(latest);
      } catch { /* Preserve results during a short network interruption. */ }
    }, 1200);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [session?.status, orderId, poId, sscc, publish]);

  const expectedSku = carton?.labelConfirmedSku || session?.expectedSku || '—';
  const expectedQty = Number(session?.expectedQty ?? carton?.plannedQty ?? 0);
  const rows = useMemo(() => getUniqueEpcRows(session?.epcs, expectedSku, session?.wrongSkuEpcs, session?.crossCartonEpcs),
    [session?.epcs, session?.wrongSkuEpcs, session?.crossCartonEpcs, expectedSku]);
  const matched = rows.filter((x) => x.status === 'MATCH').length;
  const wrong = rows.filter((x) => x.status === 'WRONG_SKU').length;
  const cross = rows.filter((x) => x.status === 'DUPLICATE_CARTON').length;
  const invalid = session?.invalidReads?.length || 0;
  const missing = Math.max(0, expectedQty - matched);
  const singlePreview = useMemo(() => singleEpc.trim() ? decodeTrueVueEpc(singleEpc.trim()) : null, [singleEpc]);

  const submitReads = async (input, clearInput) => {
    if (!session?.id || session.status !== 'SCANNING' || busy) return;
    const epcs = splitReads(input);
    if (!epcs.length) return;
    setBusy(true); setError(''); setNote('');
    try {
      const result = await submitCartonRfidReads(orderId, poId, sscc, { sessionId: session.id, epcs });
      publish(result);
      clearInput();
      const before = session.epcs?.length || 0;
      const added = Math.max(0, (result.epcs?.length || 0) - before);
      const duplicated = epcs.length - added - Math.max(0, (result.invalidReads?.length || 0) - (session.invalidReads?.length || 0));
      setNote(`Received ${epcs.length} read(s); added ${added} new unique EPC(s)${duplicated > 0 ? `; ${duplicated} duplicate read(s) did not increase item quantity` : ''}.`);
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };

  // Deterministic batch idempotency key survives a retry or lost HTTP response.
  // Backend still validates EPC, carton session and cross-carton duplicates.
  const batchImportId = (values, batchIndex) => {
    const input = `${session?.id || ''}|${batchIndex}|${values.join('|')}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619) >>> 0;
    return `pda.${session?.id || 'session'}.${batchIndex}.${hash.toString(16)}`.slice(0, 160);
  };

  // Existing /reads API remains the single source of truth. Split into safe <=500 EPC batches.
  const importPdaReads = async (epcs) => {
    if (!session?.id || session.status !== 'SCANNING') throw new Error('RFID carton is not scanning.');
    if (busy) throw new Error('Another RFID operation is running.');
    let latest = session;
    let completed = 0;
    try {
      for (let i = 0; i < epcs.length; i += 500) {
        const batch = epcs.slice(i, i + 500);
        latest = await submitCartonRfidReads(orderId, poId, sscc, {
          sessionId: session.id, epcs: batch, importId: batchImportId(batch, i / 500)
        });
        completed = Math.min(epcs.length, i + 500);
        publish(latest);
        setNote(`Importing PDA EPCs: ${completed} / ${epcs.length} processed`);
      }
      setNote(`${epcs.length} EPC(s) received from PDA XLSX; review SKU/count then Finish RFID.`);
      return latest;
    } catch (error) {
      // Earlier chunks may have been committed. Refresh the server's authoritative
      // deduplicated EPC list before allowing a retry; do not release the PDA here.
      try {
        const actual = await getCartonRfidSession(orderId, poId, sscc);
        if (actual?.id === session.id) publish(actual);
      } catch { /* Show primary batch error regardless of a second network failure. */ }
      setNote(`Partial import (${completed}/${epcs.length} submitted). Retry the same XLSX after reconnecting; EPCs are deduplicated by the backend.`);
      throw error;
    }
  };

  const renewPdaSession = async (newSessionId) => {
    const actual = await getCartonRfidSession(orderId, poId, sscc);
    if (!actual || actual.id !== newSessionId || actual.status !== 'SCANNING') {
      throw new Error('PDA START opened a new session, but it could not be synchronized. Refresh the page before STOP.');
    }
    publish(actual);
    setSingleEpc(''); setBatchEpcs(''); setBatchOpen(false);
    setDetailsOpen(false); setNote('New PDA scan: EPC table and count reset to zero; prior scan archived.');
  };

  const finish = async () => {
    if (!session?.id || session.status !== 'SCANNING') return;
    setBusy(true); setError('');
    try { publish(await finishCartonRfidSession(orderId, poId, sscc, session.id)); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };

  const restart = async () => {
    setBusy(true); setError(''); setNote('');
    try { publish(await startCartonRfidSession(orderId, poId, { sscc, stationCode })); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };

  const reopen = async () => {
    const reason = window.prompt('Supervisor reason for reopening RFID inspection:');
    if (!reason?.trim()) return;
    setBusy(true); setError('');
    try {
      await reopenCartonRfidSession(orderId, poId, sscc, reason.trim());
      publish(await startCartonRfidSession(orderId, poId, { sscc, stationCode }));
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };

  const groups = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.sku || 'UNKNOWN';
      const current = map.get(key) || { sku: key, qty: 0, wrong: 0 };
      current.qty += 1;
      if (row.status !== 'MATCH') current.wrong += 1;
      map.set(key, current);
    }
    return [...map.values()];
  }, [rows]);

  return (
    <Box sx={{ px: 0.1, py: 0.3 }}>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.6}>
        <Chip size="small" color={statusColor(session?.status)} icon={<Sensors />} label={session?.status || 'CONNECTING'} sx={{ height: 22 }} />
      </Stack>

      <Box sx={{ mt: 0.65, p: 0.9, borderRadius: 1.5, bgcolor: 'action.hover' }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.1}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.25}>
            <Typography sx={miniLabel}>SKU</Typography>
            <Typography sx={{ ...miniValue, color: 'text.primary' }}>{expectedSku}</Typography>
          </Stack>

          <Stack direction="row" spacing={1.4} flexWrap="wrap" useFlexGap>
            {[
              { label: 'Expected', value: expectedQty || 0, mode: 'dark' },
              { label: 'Matched', value: matched, mode: 'success' },
              { label: 'Wrong SKU', value: wrong, mode: 'error' }
            ].map((item) => (
              <Stack key={item.label} spacing={0.45} alignItems="center" sx={{ minWidth: 74 }}>
                <Box sx={statCircleSx(item.mode)}>{item.value}</Box>
                <Typography sx={{ ...miniLabel, color: item.mode === 'success' ? 'success.main' : item.mode === 'error' ? 'error.main' : 'text.secondary', fontWeight: 800 }}>
                  {item.label}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {missing > 0 ? <Chip label={`${missing} missing`} color="warning" size="small" variant="outlined" /> : null}
          {matched > expectedQty && expectedQty > 0 ? (
            <Typography variant="caption" color="warning.dark" fontWeight={800}>
              {matched - expectedQty} extra matching EPC(s)
            </Typography>
          ) : null}
        </Stack>
      </Box>

      <RfidPdaManager orderId={orderId} poId={poId} sscc={sscc}
        stationCode={stationCode} factoryCode={factoryCode} session={session} onImport={importPdaReads}
        onCaptureActiveChange={setDeviceCapturing} onSessionRenewed={renewPdaSession} />

      {session?.status === 'SCANNING' ? (
        <Box sx={{ mt: 0.8 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.65} alignItems={{ sm: 'center' }}>
            <TextField autoFocus size="small" fullWidth value={singleEpc} onChange={(event) => setSingleEpc(event.target.value)}
              label="Enter EPC (press Enter to add)" placeholder="30003BD000002626CB52BC5B017E"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submitReads(singleEpc, () => setSingleEpc(''));
                }
              }}
              inputProps={{ autoComplete: 'off', spellCheck: false }}
              sx={{ flex: 1, minWidth: 0, '& input': { fontFamily: 'monospace', fontSize: 13 } }} />
            <Stack direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
              <Button size="small" variant="outlined" startIcon={<QrCodeScannerOutlined />} disabled={busy || !singleEpc.trim()}
                onClick={() => submitReads(singleEpc, () => setSingleEpc(''))}>Add EPC</Button>
              <Button size="small" variant="contained" onClick={finish} disabled={busy || deviceCapturing}>Finish RFID</Button>
            </Stack>
          </Stack>
          {singlePreview && (
            <Typography variant="caption" color={singlePreview.error ? 'warning.main' : 'text.secondary'} sx={{ display: 'block', mt: 0.35 }}>
              {singlePreview.error ? singlePreview.error : `Preview: SKU ${singlePreview.productCode.padStart(12, '0')} · Serial ${singlePreview.serialNumber} (press Enter to submit)`}
            </Typography>
          )}
          {import.meta.env.DEV ? <Button size="small" color="inherit" onClick={() => setBatchOpen((x) => !x)}
            endIcon={batchOpen ? <ExpandLess /> : <ExpandMore />} sx={{ textTransform: 'none', px: 0.5, mt: 0.3, fontSize: 12 }}>
            Paste Multiple EPCs (Test)
          </Button> : null}
          {import.meta.env.DEV ? <Collapse in={batchOpen} unmountOnExit>
            <Stack spacing={0.6} sx={{ mt: 0.4 }}>
              <TextField multiline rows={3} fullWidth size="small" value={batchEpcs}
                onChange={(event) => setBatchEpcs(event.target.value)}
                placeholder="One EPC per line (24 HEX or 28 HEX with PC)"
                inputProps={{ spellCheck: false }} sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 12 } }} />
              <Box>
                <Button size="small" variant="outlined" disabled={busy || !batchEpcs.trim()}
                  onClick={() => submitReads(batchEpcs, () => setBatchEpcs(''))}>Add All EPCs</Button>
              </Box>
            </Stack>
          </Collapse> : null}
        </Box>
      ) : null}

      {session?.status === 'FAILED' && (
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mt: 0.8 }}>
          <Typography variant="caption" color="error.main">{session.reason || 'RFID check failed.'}</Typography>
          <Button size="small" startIcon={<Refresh />} variant="outlined" onClick={restart} disabled={busy}>Rescan Carton</Button>
        </Stack>
      )}
      {session?.status === 'PASS' && (
        <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.6 }}>
          RFID PASS · {matched}/{expectedQty} matching item(s).
        </Typography>
      )}
      {admin && session?.status === 'PASS' && (
        <Button size="small" color="warning" onClick={reopen} disabled={busy}>Supervisor: reopen RFID</Button>
      )}
      {(invalid > 0 || cross > 0) && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.4 }}>
          {invalid ? `${invalid} non-TrueVUE read(s). ` : ''}{cross ? `${cross} EPC(s) already verified in another carton.` : ''}
        </Typography>
      )}
      {error && <Alert severity="error" sx={{ mt: 0.6, py: 0 }}>{error}</Alert>}
      {note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>{note}</Typography>}

      {!!rows.length && (
        <Box sx={{ mt: 0.7, borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
            <Typography variant="caption" color="text.secondary">
              {rows.length} unique EPC(s) · {session?.readCount ?? 0} read(s)
            </Typography>
            <Button size="small" color="inherit" onClick={() => setDetailsOpen((x) => !x)}
              endIcon={detailsOpen ? <ExpandLess /> : <ExpandMore />}
              sx={{ fontSize: 11, textTransform: 'none', minWidth: 0, px: 0.5 }}>
              {detailsOpen ? 'Collapse' : 'EPC Details'}
            </Button>
          </Stack>
          <Collapse in={detailsOpen} unmountOnExit>
            <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap" sx={{ mt: 0.55, mb: 0.35 }}>
              {groups.map(({ sku, qty, wrong: issues }) => (
                <Chip key={sku} size="small" variant="outlined" color={issues ? 'error' : 'success'} label={`${sku}: ${qty}`} sx={{ height: 21, fontSize: 11 }} />
              ))}
            </Stack>
            <TableContainer sx={{ mt: 0.45, maxHeight: 220, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" stickyHeader aria-label="RFID EPC scan results">
                <TableHead><TableRow>
                  <TableCell sx={{ width: 54 }}>STT</TableCell>
                  <TableCell>Unique EPC</TableCell>
                  <TableCell>Decoded SKU</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.epc || row.raw} hover>
                      <TableCell sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{index + 1}</TableCell>
                      <TableCell><Tooltip title={row.epc || row.raw} arrow>
                        <Typography noWrap sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 360 }}>{row.epc || row.raw}</Typography>
                      </Tooltip></TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, color: row.status === 'MATCH' ? 'success.main' : 'error.main' }}>
                        {row.sku || '—'}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, color: row.status === 'MATCH' ? 'success.main' : 'error.main' }}>
                        {row.status === 'MATCH' ? 'Matched' : row.status === 'WRONG_SKU' ? 'Wrong SKU' : row.status === 'DUPLICATE_CARTON' ? 'Duplicate in Another Carton' : 'Invalid EPC'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary">Repeated reads of the same EPC count as one item per session; Total Reads is tracked separately.</Typography>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}
