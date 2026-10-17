import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, InputAdornment, Paper, Stack, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Typography
} from '@mui/material';
import { ArrowForwardRounded, CheckCircleOutline, QrCodeScanner, QrCodeScannerOutlined } from '@mui/icons-material';
import { CompactPageHeader } from '../components/LululemonPageHeader';
import { assignSscc, confirmCartonLabel, lookupCartonLabel } from '../services/service';
import OrderScope from '../components/OrderScope';
import { APP_MESSAGES, createSsccAssignedMessage } from '../../../constants/appMessages';
import { BUYER_CODE, DEFAULT_TABLE_ROWS_PER_PAGE } from '../../../constants/appConstants';

export default function CartonLoadingAssignPage() {
  const [orderId, setOrderId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [sku, setSku] = useState('');
  const [lookupSku, setLookupSku] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sscc, setSscc] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignmentDone, setAssignmentDone] = useState(false);
  const [notice, setNotice] = useState(null);
  const [candidatePage, setCandidatePage] = useState(0);
  const [candidateRowsPerPage, setCandidateRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
  const skuRef = useRef(null);
  const ssccRef = useRef(null);

  const resetLookup = () => {
    setLookupSku('');
    setCandidates([]);
    setSelected(null);
    setConfirmed(false);
    setSscc('');
    setAssignmentDone(false);
    setCandidatePage(0);
    setAssignOpen(false);
  };

  useEffect(() => {
    setPoNumber('');
    setSku('');
    resetLookup();
  }, [orderId]);

  const lookup = async () => {
    const poValue = poNumber.trim();
    const skuValue = sku.trim();
    if (!orderId || !poValue || !skuValue || busy) return;
    setBusy(true);
    try {
      const result = await lookupCartonLabel(orderId, poValue, skuValue);
      const nextCandidates = Array.isArray(result.candidates) && result.candidates.length
        ? result.candidates
        : (result.cartons || []).map((carton) => ({ po: result.po, carton }));
      setLookupSku(result.sku || skuValue);
      setCandidates(nextCandidates);
      setCandidatePage(0);
      setSelected(nextCandidates.length === 1 ? nextCandidates[0] : null);
      setAssignOpen(nextCandidates.length === 1);
      setConfirmed(false);
      setSscc('');
      setAssignmentDone(false);
      setNotice({
        severity: 'info',
        text: result.message || `Found ${nextCandidates.length} carton(s). Select the Carton No. shown on the physical label and confirm the system Unit Qty.`
      });
    } catch (error) {
      resetLookup();
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.SKU_LOOKUP_FAILED });
    } finally {
      setBusy(false);
    }
  };

  const chooseCarton = (candidate) => {
    setSelected(candidate);
    setConfirmed(Boolean(candidate?.carton?.labelConfirmedAt));
    setSscc('');
    setAssignmentDone(false);
    setAssignOpen(true);
  };

  const confirm = async () => {
    if (!orderId || !selected || busy) return;
    setBusy(true);
    try {
      const carton = await confirmCartonLabel(orderId, selected.carton.id, lookupSku);
      setSelected((current) => current ? {
        ...current,
        po: { ...current.po, sku: lookupSku },
        carton: { ...current.carton, ...carton }
      } : current);
      setConfirmed(true);
      setNotice({
        severity: 'success',
        text: `Qty ${expectedQty} confirmed. SKU ${lookupSku} was applied automatically to all ${expectedQty} logical item slot${expectedQty === 1 ? '' : 's'}. Product verification remains pending; scan SSCC-18 to save the carton identity.`
      });
      setTimeout(() => ssccRef.current?.focus(), 50);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message });
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!orderId || !selected || !confirmed || !sscc.trim() || busy) return;
    setBusy(true);
    try {
      const assignedPo = selected.po;
      const carton = await assignSscc(orderId, selected.carton.id, sscc.trim());
      const waitingForProductVerification = carton.status !== 'READY_TO_SHIP';
      setNotice({
        severity: 'success',
        text: `${createSsccAssignedMessage(carton.sscc18, assignedPo.poNumber, selected.carton.cartonNo)} ${waitingForProductVerification
          ? 'Carton identity is saved. Weight and RFID verification will be performed at Carton Weight; they are not required to assign this carton.'
          : 'Carton is ready for Carton Weight; weight and RFID will be checked there.'}`
      });
      // Keep this PO/SKU and the dialog open for the next unassigned carton.
      // Do not mark a carton assigned locally until the backend confirms success.
      setSelected((current) => current ? { ...current, carton: { ...current.carton, ...carton } } : current);
      setCandidates((current) => current.map((candidate) => candidate.carton.id === carton.id
        ? { ...candidate, carton: { ...candidate.carton, ...carton } }
        : candidate));
      setAssignmentDone(true);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.SSCC_ASSIGNMENT_FAILED });
    } finally {
      setBusy(false);
    }
  };

  const orderedCandidates = useMemo(() => [...candidates].sort((a, b) => {
    const poCompare = String(a?.po?.poNumber || '').localeCompare(String(b?.po?.poNumber || ''));
    if (poCompare !== 0) return poCompare;
    return Number(a?.carton?.cartonNo || 0) - Number(b?.carton?.cartonNo || 0);
  }), [candidates]);

  // Carton numbers determine the next unassigned carton within this exact PO.
  // A repeated PO number in another logical PO must never leak into this queue.
  const samePo = (candidate, current) => Boolean(current) && (
    candidate?.po?.id && current?.po?.id
      ? candidate.po.id === current.po.id
      : candidate?.po?.poNumber === current?.po?.poNumber
  );
  const remainingInPo = orderedCandidates.filter((candidate) =>
    samePo(candidate, selected) && !(candidate.carton.sscc18 || candidate.carton.sscc)
  );
  const currentCartonNo = Number(selected?.carton?.cartonNo || 0);
  const nextCandidate = remainingInPo.find((candidate) => Number(candidate.carton.cartonNo || 0) > currentCartonNo)
    || remainingInPo[0]
    || null;

  const goToNextCarton = async () => {
    if (!assignmentDone || !selected || !nextCandidate || busy) return;
    setBusy(true);
    try {
      // Read a fresh queue so a carton assigned from another station is not reopened.
      const result = await lookupCartonLabel(orderId, poNumber.trim(), sku.trim());
      const fresh = Array.isArray(result.candidates) && result.candidates.length
        ? result.candidates
        : (result.cartons || []).map((carton) => ({ po: result.po, carton }));
      setCandidates(fresh);
      const pending = fresh
        .filter((candidate) => samePo(candidate, selected) && !(candidate.carton.sscc18 || candidate.carton.sscc))
        .sort((a, b) => Number(a.carton.cartonNo || 0) - Number(b.carton.cartonNo || 0));
      const next = pending.find((candidate) => Number(candidate.carton.cartonNo || 0) > currentCartonNo)
        || pending[0];
      if (!next) {
        setNotice({ severity: 'info', text: 'All cartons in this PO have been assigned. You can close this window.' });
        return;
      }
      setSelected(next);
      setConfirmed(Boolean(next.carton.labelConfirmedAt));
      setSscc('');
      setAssignmentDone(false);
      setNotice(null);
      const index = fresh.findIndex((candidate) => candidate.carton.id === next.carton.id);
      if (index >= 0) setCandidatePage(Math.floor(index / candidateRowsPerPage));
      if (next.carton.labelConfirmedAt) setTimeout(() => ssccRef.current?.focus(), 50);
    } catch (error) {
      setNotice({ severity: 'warning', text: error?.response?.data?.message || error.message || 'Cannot load the next carton. Refresh this PO.' });
    } finally {
      setBusy(false);
    }
  };

  const visibleCandidates = orderedCandidates.slice(
    candidatePage * candidateRowsPerPage,
    candidatePage * candidateRowsPerPage + candidateRowsPerPage
  );

  const expectedQty = Number(selected?.carton?.plannedQty || 0);
  const step = confirmed ? 4 : selected ? 3 : candidates.length ? 2 : 1;

  return (
    <Stack spacing={0.9} className="lululemon-compact-v16">
      <CompactPageHeader
        dense
        title="Carton Identification & SSCC"
        meta={<Stack direction="row" spacing={0.5} alignItems="center">
          <Chip size="small" color="primary" variant="outlined" label={['', 'PO / SKU', 'Carton', 'Quantity', 'SSCC'][step]} />
        </Stack>}
      />

      {notice && !assignOpen && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 0.9, md: 1.05 } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} gap={0.75} sx={{ mb: 0.75 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Find Carton</Typography>
            <Box sx={{ width: { xs: '100%', lg: 390 }, maxWidth: '100%' }}>
              <OrderScope value={orderId} onChange={setOrderId} disabled={busy} embedded compact />
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              fullWidth
              autoFocus
              label="PO"
              placeholder="Scan / enter PO number"
              value={poNumber}
              onChange={(e) => { setPoNumber(e.target.value); resetLookup(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  skuRef.current?.focus();
                }
              }}
              disabled={!orderId || busy}
              InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment> }}
            />
            <TextField
              inputRef={skuRef}
              fullWidth
              label="SKU"
              placeholder="Scan SKU barcode"
              value={sku}
              onChange={(e) => { setSku(e.target.value); resetLookup(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }}
              disabled={!orderId || busy}
              InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment> }}
            />
            <Button
              variant="contained"
              startIcon={<QrCodeScanner />}
              onClick={lookup}
              disabled={!orderId || busy || !poNumber.trim() || !sku.trim()}
              sx={{ minWidth: 130, minHeight: { xs: 50, md: 'auto' } }}
            >
              Find Carton
            </Button>
          </Stack>
        </Box>

        {!!candidates.length && <>
          <Divider />
          <Box sx={{ p: { xs: 0.9, md: 1.05 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Matching Cartons</Typography>
              <Chip size="small" label={`${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`} />
            </Stack>

            <Box sx={{ border: '1px solid #E7EDF3', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <LululemonTableViewport viewportHeight="clamp(280px, calc(100dvh - 410px), 780px)" sx={{ border: 0, borderRadius: 0 }}>
                  <SortableTable disableRowNumber size="small">
                    <TableHead><TableRow>
                      <TableCell>Factory</TableCell><TableCell>PO</TableCell><TableCell>Style</TableCell><TableCell>Color</TableCell><TableCell>Size</TableCell>
                      <TableCell>SKU</TableCell><TableCell>Carton No.</TableCell><TableCell>System Unit Qty</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {visibleCandidates.map((candidate) => {
                        const isSelected = selected?.carton?.id === candidate.carton.id;
                        return <TableRow key={candidate.carton.id} selected={isSelected} hover>
                          <TableCell>{candidate.po?.factoryCode || '—'}</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>{candidate.po?.poNumber || '—'}</TableCell>
                          <TableCell>{candidate.po?.style || candidate.po?.styleNumber || '—'}</TableCell>
                          <TableCell>{candidate.po?.color || '—'}</TableCell>
                          <TableCell>{candidate.po?.size || '—'}</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>{candidate.po?.sku || lookupSku}</TableCell>
                          <TableCell sx={{ fontWeight: 900 }}>Carton {candidate.carton.cartonNo}</TableCell>
                          <TableCell sx={{ fontWeight: 950 }}>{candidate.carton.plannedQty ?? '—'}</TableCell>
                          <TableCell>{candidate.carton.status || '—'}</TableCell>
                          <TableCell align="right"><Button size="small" variant={isSelected ? 'contained' : 'outlined'} onClick={() => chooseCarton(candidate)}>{isSelected ? 'Selected' : 'Select'}</Button></TableCell>
                        </TableRow>;
                      })}
                    </TableBody>
                  </SortableTable>
                </LululemonTableViewport>
              </Box>

              <Stack spacing={0.75} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
                {visibleCandidates.map((candidate) => {
                  const isSelected = selected?.carton?.id === candidate.carton.id;
                  return (
                    <Paper key={candidate.carton.id} variant="outlined" sx={{ p: 1, borderRadius: 1.7, borderColor: isSelected ? 'primary.main' : 'divider', bgcolor: isSelected ? 'primary.lighter' : 'background.paper' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={950}>Carton {candidate.carton.cartonNo}</Typography>
                          <Typography variant="body2" fontWeight={850}>PO {candidate.po?.poNumber || '—'} · SKU {candidate.po?.sku || lookupSku}</Typography>
                          <Typography variant="caption" color="text.secondary">Style {candidate.po?.style || candidate.po?.styleNumber || '—'} · Color {candidate.po?.color || '—'} · Size {candidate.po?.size || '—'}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography variant="caption" color="text.secondary">System Qty</Typography>
                          <Typography variant="h5" fontWeight={950}>{candidate.carton.plannedQty ?? '—'}</Typography>
                        </Box>
                      </Stack>
                      <Button fullWidth variant={isSelected ? 'contained' : 'outlined'} onClick={() => chooseCarton(candidate)} sx={{ mt: 0.8, minHeight: 48 }}>
                        {isSelected ? 'Continue' : 'Select carton'}
                      </Button>
                    </Paper>
                  );
                })}
              </Stack>

              <TablePagination
                component="div"
                count={orderedCandidates.length}
                page={Math.min(candidatePage, Math.max(0, Math.ceil(orderedCandidates.length / candidateRowsPerPage) - 1))}
                rowsPerPage={candidateRowsPerPage}
                onPageChange={(_, next) => setCandidatePage(next)}
                onRowsPerPageChange={(e) => { setCandidateRowsPerPage(Number(e.target.value)); setCandidatePage(0); }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </Box>
          </Box>
        </>}
      </Paper>

      <OperationWorkspaceDialog
        open={Boolean(selected && assignOpen)}
        onClose={() => setAssignOpen(false)}
        disableClose={busy}
        title={selected ? `Identify Carton ${selected.carton.cartonNo}` : 'Identify Carton'}
        subtitle={selected ? `PO ${selected.po?.poNumber || '—'} · SKU ${selected.po?.sku || lookupSku || '—'}` : ''}
        maxWidth="md"
      >
        {selected ? (
          <Stack spacing={0.8}>
            {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
            <Box sx={{ p: { xs: 1.5, md: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 0.9 }}>
              <Box sx={{ p: 1.1, border: '1px solid #E7EDF3', borderRadius: 2, bgcolor: '#FBFCFE' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Confirm system Unit Qty</Typography>
                <Stack spacing={0.7} sx={{ mt: 1 }}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">PO</Typography><Typography variant="body2" fontWeight={800}>{selected.po?.poNumber}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">SKU</Typography><Typography variant="body2" fontWeight={800}>{selected.po?.sku || lookupSku}</Typography></Stack>
                  {[['Style', selected.po?.style || selected.po?.styleNumber], ['Color', selected.po?.color], ['Size', selected.po?.size]].map(([label, val]) => (
                    <Stack key={label} direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={800}>{val || '—'}</Typography></Stack>
                  ))}
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Carton No.</Typography><Typography variant="body2" fontWeight={800}>{selected.carton.cartonNo}</Typography></Stack>
                </Stack>
                <Box sx={{ mt: 1.2, p: 1.4, textAlign: 'center', borderRadius: 2, bgcolor: 'primary.lighter', border: '1px solid', borderColor: 'primary.light' }}>
                  <Typography variant="caption" color="text.secondary">SYSTEM UNIT QTY · READ ONLY</Typography>
                  <Typography variant="h2" sx={{ fontWeight: 950, lineHeight: 1.05 }}>{expectedQty || '—'}</Typography>
                </Box>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleOutline />}
                  onClick={confirm}
                  disabled={busy || confirmed || expectedQty <= 0}
                  sx={{ mt: 1.5, minHeight: { xs: 52, md: 'auto' } }}
                >
                  {confirmed ? `Qty ${expectedQty} confirmed` : `Confirm Qty ${expectedQty || ''}`}
                </Button>
              </Box>

              <Box sx={{ p: 1.1, border: '1px solid #E7EDF3', borderRadius: 2, opacity: confirmed ? 1 : 0.55 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Assign SSCC-18</Typography>
                <TextField
                  inputRef={ssccRef}
                  fullWidth
                  placeholder="Scan GS1 (00) barcode (20 digits) or SSCC-18"
                  value={sscc}
                  onChange={(e) => setSscc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); assign(); } }}
                  disabled={!confirmed || busy || assignmentDone || Boolean(selected.carton.sscc18 || selected.carton.sscc)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color={confirmed ? 'primary' : 'disabled'} /></InputAdornment> }}
                />
                <Button fullWidth variant="contained" onClick={assign} disabled={!confirmed || busy || !sscc.trim() || assignmentDone || Boolean(selected.carton.sscc18 || selected.carton.sscc)} sx={{ mt: 1, minHeight: { xs: 52, md: 'auto' } }}>
                  {assignmentDone ? 'Identity Saved' : 'Save Carton Identity'}
                </Button>
              </Box>
            </Box>
            {assignmentDone ? (
              <Box sx={{ mx: { xs: 1.5, md: 2 }, mb: 1.5, p: 1.2, border: '1px solid', borderColor: 'success.light', borderRadius: 2, bgcolor: 'background.paper' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                  <Box>
                    <Typography fontWeight={850} color="success.main">Carton {selected.carton.cartonNo} assigned successfully</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {nextCandidate ? `${remainingInPo.length} carton(s) left in this PO.` : 'All cartons in this PO have been assigned.'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.7}>
                    {nextCandidate ? (
                      <Button variant="contained" color="primary" endIcon={<ArrowForwardRounded />} disabled={busy} onClick={goToNextCarton}>
                        Next Carton {nextCandidate.carton.cartonNo}
                      </Button>
                    ) : null}
                    <Button variant="outlined" onClick={() => setAssignOpen(false)} disabled={busy}>Done</Button>
                  </Stack>
                </Stack>
              </Box>
            ) : null}
          </Stack>
        ) : null}
      </OperationWorkspaceDialog>
    </Stack>
  );
}
