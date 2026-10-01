import SortableTable from 'components/SortableTable';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, InputAdornment, Paper, Stack,  TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Typography
} from '@mui/material';
import { CheckCircleOutline, QrCodeScanner, QrCodeScannerOutlined } from '@mui/icons-material';
import { CompactPageHeader } from 'components/CompactPageHeader';
import {
  assignLululemonSscc,
  confirmLululemonCartonLabel,
  lookupLululemonCartonLabel
} from '../services/lululemonService';
import LululemonOrderScope from '../components/LululemonOrderScope';

function StepBadge({ number, label, active, done }) {
  return (
    <Stack direction="row" spacing={0.7} alignItems="center" sx={{ color: done ? 'success.main' : active ? 'primary.main' : 'text.secondary' }}>
      <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, bgcolor: done ? 'success.lighter' : active ? 'primary.lighter' : '#F1F4F7', border: '1px solid', borderColor: done ? 'success.light' : active ? 'primary.light' : '#E1E8EF' }}>{done ? '✓' : number}</Box>
      <Typography variant="caption" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</Typography>
    </Stack>
  );
}

export default function CartonLoadingAssignPage() {
  const [orderId, setOrderId] = useState('');
  const [sku, setSku] = useState('');
  const [lookupSku, setLookupSku] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sscc, setSscc] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [candidatePage, setCandidatePage] = useState(0);
  const [candidateRowsPerPage, setCandidateRowsPerPage] = useState(10);
  const [qtyFilter, setQtyFilter] = useState('');
  const ssccRef = useRef(null);

  useEffect(() => {
    setSku(''); setLookupSku(''); setCandidates([]); setSelected(null); setConfirmed(false); setSscc(''); setCandidatePage(0); setQtyFilter('');
  }, [orderId]);

  const lookup = async () => {
    const value = sku.trim();
    if (!orderId || !value || busy) return;
    setBusy(true);
    try {
      const result = await lookupLululemonCartonLabel(orderId, value);
      const nextCandidates = Array.isArray(result.candidates) && result.candidates.length
        ? result.candidates
        : (result.cartons || []).map((carton) => ({ po: result.po, carton }));
      setLookupSku(result.sku || result.po?.sku || value);
      setCandidates(nextCandidates);
      setQtyFilter('');
      setCandidatePage(0);
      setSelected(nextCandidates.length === 1 ? nextCandidates[0] : null);
      setConfirmed(false); setSscc('');
      setNotice({ severity: 'info', text: result.message || `${nextCandidates.length} finished carton(s) found in this Order.` });
    } catch (error) {
      setCandidates([]); setSelected(null); setConfirmed(false);
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || 'SKU lookup failed.' });
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!orderId || !selected || busy) return;
    setBusy(true);
    try {
      await confirmLululemonCartonLabel(orderId, selected.carton.id, lookupSku);
      setConfirmed(true);
      setNotice({ severity: 'success', text: 'Label information confirmed. SSCC scanning is now unlocked.' });
      setTimeout(() => ssccRef.current?.focus(), 50);
    } catch (error) { setNotice({ severity: 'error', text: error?.response?.data?.message || error.message }); }
    finally { setBusy(false); }
  };

  const assign = async () => {
    if (!orderId || !selected || !confirmed || !sscc.trim() || busy) return;
    setBusy(true);
    try {
      const carton = await assignLululemonSscc(orderId, selected.carton.id, sscc.trim());
      setNotice({ severity: 'success', text: `SSCC ${carton.sscc18} assigned to PO ${selected.po.poNumber}, Carton ${selected.carton.cartonNo}.` });
      setSku(''); setLookupSku(''); setCandidates([]); setSelected(null); setConfirmed(false); setSscc(''); setQtyFilter('');
    } catch (error) { setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || 'SSCC assignment failed.' }); }
    finally { setBusy(false); }
  };

  const orderedCandidates = useMemo(() => [...candidates].sort((a, b) => {
    const aTime = a?.carton?.finishedAt ? new Date(a.carton.finishedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b?.carton?.finishedAt ? new Date(b.carton.finishedAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return Number(a?.carton?.cartonNo || 0) - Number(b?.carton?.cartonNo || 0);
  }), [candidates]);

  const filteredCandidates = useMemo(() => {
    const raw = String(qtyFilter || '').trim();
    if (!raw) return orderedCandidates;
    const qty = Number(raw);
    if (!Number.isFinite(qty)) return [];
    return orderedCandidates.filter((candidate) => Number(candidate?.carton?.scannedQty ?? candidate?.carton?.plannedQty) === qty);
  }, [orderedCandidates, qtyFilter]);

  const handleQtyFilter = (value) => {
    setQtyFilter(value);
    setCandidatePage(0);
    setConfirmed(false);
    setSscc('');
    const raw = String(value || '').trim();
    if (!raw) {
      setSelected(candidates.length === 1 ? candidates[0] : null);
      return;
    }
    const qty = Number(raw);
    if (!Number.isFinite(qty)) {
      setSelected(null);
      return;
    }
    const matches = orderedCandidates.filter((candidate) => Number(candidate?.carton?.scannedQty ?? candidate?.carton?.plannedQty) === qty);
    // There is no physical Carton No on the box. When several cartons have the
    // same SKU + Qty, select the oldest finished pending carton (FIFO) by default.
    setSelected(matches.length ? matches[0] : null);
  };

  const formatFinishedAt = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).replace('T', ' ') : date.toLocaleString();
  };

  const step = confirmed ? 4 : selected ? 3 : candidates.length ? 2 : 1;

  return (
    <Stack spacing={1.5}>
      <CompactPageHeader title="Carton Label & SSCC" subtitle="Verify the carton label first, then assign the unique SSCC-18." meta={<Chip size="small" label="LULULEMON" variant="outlined" sx={{ fontWeight: 700 }} />} />
      <LululemonOrderScope value={orderId} onChange={setOrderId} disabled={busy} />
      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack direction="row" spacing={{ xs: 1, md: 2.5 }} alignItems="center" sx={{ px: 1.5, py: 1.2, bgcolor: '#FBFCFE', borderBottom: '1px solid #E7EDF3', overflowX: 'auto' }}>
          <StepBadge number="1" label="Scan SKU" active={step === 1} done={step > 1} />
          <Divider flexItem orientation="vertical" />
          <StepBadge number="2" label="Choose Carton" active={step === 2} done={step > 2} />
          <Divider flexItem orientation="vertical" />
          <StepBadge number="3" label="Confirm Label" active={step === 3} done={step > 3} />
          <Divider flexItem orientation="vertical" />
          <StepBadge number="4" label="Assign SSCC" active={step === 4} done={false} />
        </Stack>

        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Scan carton label SKU</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>The system will show only cartons waiting for label assignment in the active Order.</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField
              fullWidth autoFocus placeholder="Scan SKU on Carton Loading label" value={sku}
              onChange={(e) => setSku(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }} disabled={!orderId || busy}
              InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment> }}
            />
            <Button variant="contained" startIcon={<QrCodeScanner />} onClick={lookup} disabled={!orderId || busy || !sku.trim()} sx={{ minWidth: 120 }}>Lookup</Button>
          </Stack>
        </Box>

        {!!candidates.length && <>
          <Divider />
          <Box sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1} sx={{ mb: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Find the pending carton by Unit Qty</Typography>
                <Typography variant="body2" color="text.secondary">Carton No. is system-generated only. Enter the Unit Qty shown on the Carton Loading label to narrow the pending cartons. If several cartons have the same SKU + Qty, the oldest finished carton is selected first (FIFO).</Typography>
              </Box>
              <Chip size="small" label={`${filteredCandidates.length} / ${candidates.length} candidates`} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="Search Unit Qty"
                placeholder="Example: 30"
                value={qtyFilter}
                onChange={(e) => handleQtyFilter(e.target.value.replace(/[^0-9.]/g, ''))}
                inputProps={{ inputMode: 'numeric' }}
                sx={{ width: { xs: '100%', sm: 240 } }}
              />
              {qtyFilter && filteredCandidates.length > 0 && selected && (
                <Alert severity="info" sx={{ py: 0, flex: 1 }}>
                  FIFO default: Qty {selected.carton.scannedQty ?? selected.carton.plannedQty}, finished {formatFinishedAt(selected.carton.finishedAt)}. You can select another matching row if needed.
                </Alert>
              )}
              {qtyFilter && filteredCandidates.length === 0 && (
                <Alert severity="warning" sx={{ py: 0, flex: 1 }}>No pending carton matches Unit Qty {qtyFilter} for this SKU.</Alert>
              )}
            </Stack>
            <Box sx={{ overflowX: 'auto', border: '1px solid #E7EDF3', borderRadius: 2 }}>
              <SortableTable disableRowNumber size="small"><TableHead><TableRow><TableCell>Factory</TableCell><TableCell>PO</TableCell><TableCell>SKU</TableCell><TableCell>System Carton</TableCell><TableCell>Unit Qty</TableCell><TableCell>Finished Time</TableCell><TableCell>Packing User</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>
                {filteredCandidates.slice(candidatePage * candidateRowsPerPage, candidatePage * candidateRowsPerPage + candidateRowsPerPage).map((candidate, index) => <TableRow key={candidate.carton.id} selected={selected?.carton?.id === candidate.carton.id} hover><TableCell>{candidate.po?.factoryCode || '—'}</TableCell><TableCell sx={{ fontWeight: 700 }}>{candidate.po?.poNumber || '—'}</TableCell><TableCell>{candidate.po?.sku || lookupSku}</TableCell><TableCell sx={{ fontWeight: 750 }}>Carton {candidate.carton.cartonNo}</TableCell><TableCell sx={{ fontWeight: 800 }}>{candidate.carton.scannedQty ?? candidate.carton.plannedQty}</TableCell><TableCell>{formatFinishedAt(candidate.carton.finishedAt)}</TableCell><TableCell>{candidate.carton.finishedBy || candidate.carton.packedBy || '—'}</TableCell><TableCell align="right"><Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">{qtyFilter && index === 0 && candidatePage === 0 && <Chip size="small" color="primary" variant="outlined" label="FIFO" />}<Button size="small" variant={selected?.carton?.id === candidate.carton.id ? 'contained' : 'outlined'} onClick={() => { setSelected(candidate); setConfirmed(false); setSscc(''); }}>{selected?.carton?.id === candidate.carton.id ? 'Selected' : 'Select'}</Button></Stack></TableCell></TableRow>)}
                {!filteredCandidates.length && <TableRow><TableCell colSpan={8}><Typography align="center" color="text.secondary" sx={{ py: 2.5 }}>No pending cartons match the current Unit Qty.</Typography></TableCell></TableRow>}
              </TableBody></SortableTable>
              <TablePagination component="div" count={filteredCandidates.length} page={Math.min(candidatePage, Math.max(0, Math.ceil(filteredCandidates.length / candidateRowsPerPage) - 1))} rowsPerPage={candidateRowsPerPage} onPageChange={(_, next) => setCandidatePage(next)} onRowsPerPageChange={(e) => { setCandidateRowsPerPage(Number(e.target.value)); setCandidatePage(0); }} rowsPerPageOptions={[10,25,50,100]} />
            </Box>
          </Box>
        </>}

        {selected && <>
          <Divider />
          <Box sx={{ p: { xs: 1.5, md: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5 }}>
            <Box sx={{ p: 1.5, border: '1px solid #E7EDF3', borderRadius: 2, bgcolor: '#FBFCFE' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Confirm physical label</Typography>
              <Stack spacing={0.7} sx={{ mt: 1 }}>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">PO</Typography><Typography variant="body2" fontWeight={750}>{selected.po?.poNumber}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">SKU</Typography><Typography variant="body2" fontWeight={750}>{selected.po?.sku || lookupSku}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Carton</Typography><Typography variant="body2" fontWeight={750}>{selected.carton.cartonNo}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Unit Qty</Typography><Typography variant="body2" fontWeight={750}>{selected.carton.scannedQty}</Typography></Stack>
              </Stack>
              <Button fullWidth variant="contained" color="success" startIcon={<CheckCircleOutline />} onClick={confirm} disabled={busy || confirmed} sx={{ mt: 1.5 }}>{confirmed ? 'Label confirmed' : 'Confirm label information'}</Button>
            </Box>

            <Box sx={{ p: 1.5, border: '1px solid #E7EDF3', borderRadius: 2, opacity: confirmed ? 1 : 0.55 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Assign SSCC-18</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, mb: 1 }}>Unlocked after label confirmation.</Typography>
              <TextField inputRef={ssccRef} fullWidth placeholder="Scan SSCC-18" value={sscc} onChange={(e) => setSscc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); assign(); } }} disabled={!confirmed || busy} InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color={confirmed ? 'primary' : 'disabled'} /></InputAdornment> }} />
              <Button fullWidth variant="contained" onClick={assign} disabled={!confirmed || busy || !sscc.trim()} sx={{ mt: 1 }}>Assign SSCC & Complete</Button>
            </Box>
          </Box>
        </>}
      </Paper>
    </Stack>
  );
}
