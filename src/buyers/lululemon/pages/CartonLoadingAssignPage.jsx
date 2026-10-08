import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, InputAdornment, Paper, Stack, TableBody, TableCell,
  TableHead, TablePagination, TableRow, TextField, Typography
} from '@mui/material';
import { CheckCircleOutline, QrCodeScanner, QrCodeScannerOutlined } from '@mui/icons-material';
import { CompactPageHeader } from 'components/CompactPageHeader';
import { assignSscc, confirmCartonLabel, lookupCartonLabel } from '../services/service';
import OrderScope from '../components/OrderScope';
import { APP_MESSAGES, createSsccAssignedMessage } from '../../../constants/appMessages';
import { BUYER_CODE, DEFAULT_TABLE_ROWS_PER_PAGE } from '../../../constants/appConstants';

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
  const [poNumber, setPoNumber] = useState('');
  const [sku, setSku] = useState('');
  const [lookupSku, setLookupSku] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sscc, setSscc] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
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
          ? 'Carton identity is saved. Product verification / RFID count is still required before Shipping.'
          : 'Carton is ready for the Shipping Schedule flow.'}`
      });
      setPoNumber('');
      setSku('');
      resetLookup();
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

  const visibleCandidates = orderedCandidates.slice(
    candidatePage * candidateRowsPerPage,
    candidatePage * candidateRowsPerPage + candidateRowsPerPage
  );

  const expectedQty = Number(selected?.carton?.plannedQty || 0);
  const step = confirmed ? 4 : selected ? 3 : candidates.length ? 2 : 1;

  return (
    <Stack spacing={0.9}>
      <CompactPageHeader
        dense
        title="Carton Identification & SSCC"
        subtitle="Scan PO + SKU from the carton label, confirm the system Unit Qty, then assign SSCC-18."
        meta={<Chip size="small" label={BUYER_CODE.LULULEMON} variant="outlined" sx={{ fontWeight: 700 }} />}
      />
      <OrderScope value={orderId} onChange={setOrderId} disabled={busy} />
      {notice && !assignOpen && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 1.2, py: 1.1, bgcolor: '#FBFCFE', borderBottom: '1px solid #E7EDF3', display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', md: 'repeat(4, max-content)' }, gap: { xs: 1, md: 2.5 }, alignItems: 'center' }}>
          <StepBadge number="1" label="Scan PO" active={step === 1} done={step > 1} />
          <StepBadge number="2" label="Scan SKU / Carton" active={step === 2} done={step > 2} />
          <StepBadge number="3" label="Confirm Qty" active={step === 3} done={step > 3} />
          <StepBadge number="4" label="Assign SSCC" active={step === 4} done={false} />
        </Box>

        <Box sx={{ p: { xs: 0.9, md: 1.05 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Scan the physical carton label</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            PO and SKU identify the logical PO. Unit Qty comes from the imported system plan and cannot be edited here.
          </Typography>
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
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Choose the carton shown on the physical label</Typography>
                <Typography variant="body2" color="text.secondary">
                  Match Carton No. and check the system Unit Qty. Do not type Unit Qty manually.
                </Typography>
              </Box>
              <Chip size="small" label={`${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`} />
            </Stack>

            <Box sx={{ border: '1px solid #E7EDF3', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <LululemonTableViewport viewportHeight="clamp(240px, 34vh, 350px)" sx={{ border: 0, borderRadius: 0 }}>
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
        subtitle={selected ? `PO ${selected.po?.poNumber || '—'} · SKU ${selected.po?.sku || lookupSku || '—'}` : 'Carton identification workspace'}
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
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Check this value against the physical carton label.</Typography>
                </Box>
                <Alert severity={confirmed ? 'success' : 'info'} sx={{ mt: 1 }}>
                  {confirmed
                    ? `SKU ${selected.po?.sku || lookupSku} is assigned to all ${expectedQty} logical item slots. Items are still PENDING until the later RFID verification step.`
                    : `Confirming will automatically apply SKU ${selected.po?.sku || lookupSku} to all ${expectedQty || '—'} logical item slots. It will not mark the items as PASS.`}
                </Alert>
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, mb: 1 }}>
                  SSCC scanning is unlocked only after the system Unit Qty is confirmed.
                </Typography>
                <TextField
                  inputRef={ssccRef}
                  fullWidth
                  placeholder="Scan SSCC-18"
                  value={sscc}
                  onChange={(e) => setSscc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); assign(); } }}
                  disabled={!confirmed || busy}
                  InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color={confirmed ? 'primary' : 'disabled'} /></InputAdornment> }}
                />
                <Button fullWidth variant="contained" onClick={assign} disabled={!confirmed || busy || !sscc.trim()} sx={{ mt: 1, minHeight: { xs: 52, md: 'auto' } }}>
                  Save Carton Identity
                </Button>
                <Alert severity="info" sx={{ mt: 1 }}>
                  Assigning SSCC here identifies the carton only. If Packing/RFID verification is not complete, the carton is not released to Shipping yet.
                </Alert>
              </Box>
            </Box>
          </Stack>
        ) : null}
      </OperationWorkspaceDialog>
    </Stack>
  );
}
