import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Divider, InputAdornment,
  LinearProgress, Paper, Stack,  TableBody, TableCell, TableHead,
  TablePagination, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import {
  ArrowBackRounded, ArrowForwardRounded, CheckCircleOutline, DoneAll, Inventory2Outlined, LocalPrintshopOutlined, QrCodeScannerOutlined, Refresh, Search,
  Undo
} from '@mui/icons-material';
import { CompactPageHeader } from 'components/CompactPageHeader';
import { useNavigate } from 'react-router-dom';
import LululemonStatusChip from '../components/LululemonStatusChip';
import LululemonOrderScope from '../components/LululemonOrderScope';
import {
  finishLululemonCarton,
  getLululemonPo,
  listLululemonCartonItems,
  listAllLululemonPos,
  scanLululemonProduct,
  undoLastLululemonScan
} from '../services/lululemonService';

const DONE_STATUSES = ['FINISHED', 'LABEL_CONFIRMED', 'READY_TO_SHIP'];
const clampPct = (value) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

function Metric({ label, value, hint }) {
  return (
    <Box sx={{ minWidth: 92 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.15 }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.08rem', lineHeight: 1.35, fontWeight: 750, color: '#20364D' }}>{value}</Typography>
      {hint ? <Typography variant="caption" color="text.secondary">{hint}</Typography> : null}
    </Box>
  );
}

export default function PackingPage() {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState('');
  const [pos, setPos] = useState([]);
  const [poId, setPoId] = useState('');
  const [detail, setDetail] = useState(null);
  const [cartonId, setCartonId] = useState('');
  const [items, setItems] = useState([]);
  const [sku, setSku] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [itemPage, setItemPage] = useState(0);
  const [itemRowsPerPage, setItemRowsPerPage] = useState(10);
  const [cartonKeyword, setCartonKeyword] = useState('');
  const [cartonFilter, setCartonFilter] = useState('OPEN');
  const [cartonPage, setCartonPage] = useState(0);
  const [cartonRowsPerPage, setCartonRowsPerPage] = useState(10);
  const scanRef = useRef(null);

  const loadPos = useCallback(async () => {
    if (!orderId) { setPos([]); return; }
    try { setPos(await listAllLululemonPos(orderId)); }
    catch (error) { setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || 'Unable to load PO.' }); }
  }, [orderId]);

  const loadDetail = useCallback(async (targetPoId = poId) => {
    if (!orderId || !targetPoId) { setDetail(null); return; }
    const value = await getLululemonPo(orderId, targetPoId);
    setDetail(value);
    const currentExists = value.cartons?.some((row) => row.id === cartonId);
    if (!currentExists) {
      const next = value.cartons?.find((row) => !DONE_STATUSES.includes(row.status)) || value.cartons?.[0];
      setCartonId(next?.id || '');
    }
  }, [orderId, poId, cartonId]);

  const loadItems = useCallback(async () => {
    if (!orderId || !cartonId) { setItems([]); return; }
    try { setItems(await listLululemonCartonItems(orderId, cartonId)); setItemPage(0); }
    catch { setItems([]); }
  }, [orderId, cartonId]);

  useEffect(() => {
    setPoId(''); setDetail(null); setCartonId(''); setItems([]); setSku('');
    setCartonPage(0); setCartonKeyword(''); setCartonFilter('OPEN');
    loadPos();
  }, [orderId, loadPos]);
  useEffect(() => { loadDetail().catch((error) => setNotice({ severity: 'error', text: error?.response?.data?.message || error.message })); }, [poId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadItems(); setTimeout(() => scanRef.current?.focus(), 50); }, [cartonId, loadItems]);

  const carton = useMemo(() => detail?.cartons?.find((row) => row.id === cartonId) || null, [detail, cartonId]);
  const po = detail?.po;
  const full = carton && Number(carton.scannedQty || 0) === Number(carton.plannedQty || 0);
  const locked = carton && DONE_STATUSES.includes(carton.status);
  const cartonPct = carton ? clampPct((Number(carton.scannedQty || 0) / Math.max(1, Number(carton.plannedQty || 0))) * 100) : 0;

  const cartonStats = useMemo(() => {
    const rows = detail?.cartons || [];
    const completed = rows.filter((row) => DONE_STATUSES.includes(row.status)).length;
    const inProgress = rows.filter((row) => Number(row.scannedQty || 0) > 0 && !DONE_STATUSES.includes(row.status)).length;
    return { total: rows.length, completed, open: Math.max(0, rows.length - completed), inProgress };
  }, [detail]);

  const filteredCartons = useMemo(() => {
    const q = cartonKeyword.trim().toLowerCase();
    return (detail?.cartons || []).filter((row) => {
      const done = DONE_STATUSES.includes(row.status);
      if (cartonFilter === 'OPEN' && done) return false;
      if (cartonFilter === 'DONE' && !done) return false;
      if (q && !String(row.cartonNo ?? '').toLowerCase().includes(q) && !String(row.status ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [detail, cartonFilter, cartonKeyword]);

  const pagedCartons = useMemo(
    () => filteredCartons.slice(cartonPage * cartonRowsPerPage, cartonPage * cartonRowsPerPage + cartonRowsPerPage),
    [filteredCartons, cartonPage, cartonRowsPerPage]
  );

  useEffect(() => { setCartonPage(0); }, [cartonFilter, cartonKeyword, poId]);

  const refresh = async () => {
    if (!orderId || !poId) return;
    await loadDetail(poId);
    await loadItems();
  };

  const doScan = async () => {
    const value = sku.trim();
    if (!orderId || !cartonId || !value || busy) return;
    setBusy(true);
    try {
      const result = await scanLululemonProduct(orderId, cartonId, value);
      setNotice({ severity: 'success', text: result.skuAssignedNow ? `SKU ${value} assigned to PO ${result.po?.poNumber}.` : (result.message || `SKU ${value} accepted.`) });
      setSku(''); await refresh(); setTimeout(() => scanRef.current?.focus(), 50);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || 'Scan rejected.' });
      setSku(''); setTimeout(() => scanRef.current?.focus(), 50);
    } finally { setBusy(false); }
  };

  const undo = async () => {
    if (!orderId || !cartonId || busy) return;
    setBusy(true);
    try { await undoLastLululemonScan(orderId, cartonId); setNotice({ severity: 'info', text: 'Last scan removed.' }); await refresh(); }
    catch (error) { setNotice({ severity: 'error', text: error?.response?.data?.message || error.message }); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    if (!orderId || !cartonId || busy) return;
    setBusy(true);
    try {
      await finishLululemonCarton(orderId, cartonId);
      const value = await getLululemonPo(orderId, poId);
      setDetail(value);
      const next = value.cartons?.find((row) => !DONE_STATUSES.includes(row.status));
      if (next) setCartonId(next.id);
      setNotice({ severity: 'success', text: next ? `Carton ${carton.cartonNo} finished. Carton ${next.cartonNo} is ready.` : 'All cartons for this PO are finished.' });
    } catch (error) { setNotice({ severity: 'error', text: error?.response?.data?.message || error.message }); }
    finally { setBusy(false); }
  };

  return (
    <Stack spacing={1.5}>
      <CompactPageHeader
        title="Packing Operations"
        subtitle="Work one PO and one carton at a time. Scan feedback and carton progress stay visible in the active workspace."
        meta={<Chip size="small" label="LULULEMON" variant="outlined" sx={{ fontWeight: 700 }} />}
        actions={
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackRounded />}
              onClick={() => navigate(orderId ? `/buyers/lululemon/orders/${orderId}` : '/buyers/lululemon/orders')}
            >
              Back
            </Button>
            <Button size="small" startIcon={<LocalPrintshopOutlined />} onClick={() => navigate('/buyers/lululemon/print-requests')}>PO Handoff</Button>
            <Tooltip title="Refresh current PO"><span><Button size="small" startIcon={<Refresh />} onClick={refresh} disabled={!poId || busy}>Refresh</Button></span></Tooltip>
          </Stack>
        }
      />

      <Paper
        variant="outlined"
        sx={{
          overflow: 'hidden',
          borderRadius: 2.5,
          borderColor: '#DDE6EF',
          boxShadow: '0 3px 14px rgba(30, 55, 80, 0.045)'
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={{ xs: 1, lg: 1.25 }}
          alignItems={{ lg: 'stretch' }}
          sx={{ p: 1.25, bgcolor: '#FBFCFE' }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.65 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: '#EAF1FF', color: '#2F6FED', fontSize: '0.72rem', fontWeight: 900 }}>1</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 850, letterSpacing: '.04em', color: '#38506A', lineHeight: 1.1 }}>ORDER</Typography>
                <Typography variant="caption" color="text.secondary">Select the work order for this packing session</Typography>
              </Box>
            </Stack>
            <LululemonOrderScope value={orderId} onChange={setOrderId} disabled={busy} embedded compact />
          </Box>

          <Box sx={{ display: { xs: 'none', lg: 'grid' }, placeItems: 'center', px: 0.25, color: '#A0AEC0' }}>
            <ArrowForwardRounded fontSize="small" />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.65 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: orderId ? '#EAF1FF' : '#F1F4F7', color: orderId ? '#2F6FED' : '#8B99A8', fontSize: '0.72rem', fontWeight: 900 }}>2</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 850, letterSpacing: '.04em', color: '#38506A', lineHeight: 1.1 }}>PURCHASE ORDER</Typography>
                <Typography variant="caption" color="text.secondary">Choose a PO to open its carton queue</Typography>
              </Box>
            </Stack>
            <Autocomplete
              size="small"
              fullWidth
              disabled={!orderId}
              options={pos}
              value={pos.find((row) => row.id === poId) || null}
              onChange={(_, row) => { setPoId(row?.id || ''); setCartonId(''); }}
              getOptionLabel={(row) => [row.poNumber, row.factoryCode, row.styleNumber || row.style, row.sku].filter(Boolean).join(' ')}
              isOptionEqualToValue={(option, selected) => option.id === selected.id}
              autoHighlight
              openOnFocus
              clearOnEscape
              noOptionsText="No matching Purchase Orders"
              renderOption={(props, row) => (
                <Box component="li" {...props} key={row.id} sx={{ alignItems: 'flex-start !important', py: '8px !important' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={800}>PO {row.poNumber}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.factoryCode || 'No factory'} · {row.styleNumber || row.style || 'No style'} · {row.sku ? `SKU ${row.sku}` : 'SKU pending'}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search Purchase Order"
                  sx={{
                    bgcolor: '#FFFFFF',
                    borderRadius: 1.8,
                    '& .MuiOutlinedInput-root': { py: '1px !important' }
                  }}
                />
              )}
            />
          </Box>
        </Stack>

        {po ? (
          <Stack
            direction="row"
            spacing={1.6}
            flexWrap="wrap"
            useFlexGap
            alignItems="center"
            sx={{ px: 1.4, py: 0.9, borderTop: '1px solid #E7EDF3', bgcolor: '#FFFFFF' }}
          >
            <Metric label="Factory" value={po.factoryCode || '—'} />
            <Metric label="Style" value={po.styleNumber || po.style || '—'} />
            <Metric label="PO SKU" value={po.sku || 'Not assigned'} />
            <Metric label="Cartons" value={cartonStats.total} hint={`${cartonStats.completed} completed`} />
            <Box sx={{ ml: { lg: 'auto' } }}><LululemonStatusChip status={po.status} /></Box>
          </Stack>
        ) : null}
      </Paper>

      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ borderRadius: 2 }}>{notice.text}</Alert>}
      {orderId && !poId && <Alert severity="info" sx={{ borderRadius: 2 }}>Select a Purchase Order to load its carton queue.</Alert>}

      {detail ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' }, gap: 1.5, alignItems: 'start' }}>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid #E7EDF3', bgcolor: '#FBFCFE' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Carton Queue</Typography>
                  <Typography variant="caption" color="text.secondary">{cartonStats.open} open · {cartonStats.completed} completed</Typography>
                </Box>
                <Chip size="small" label={`${cartonStats.total} total`} />
              </Stack>
              <TextField
                size="small"
                fullWidth
                placeholder="Find carton..."
                value={cartonKeyword}
                onChange={(e) => setCartonKeyword(e.target.value)}
                sx={{ mt: 1 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                {[['OPEN', `Open ${cartonStats.open}`], ['ALL', `All ${cartonStats.total}`], ['DONE', `Done ${cartonStats.completed}`]].map(([key, label]) => (
                  <Button key={key} size="small" variant={cartonFilter === key ? 'contained' : 'text'} onClick={() => setCartonFilter(key)} sx={{ minWidth: 0, px: 1.1 }}>{label}</Button>
                ))}
              </Stack>
            </Box>

            <Stack spacing={0.5} sx={{ p: 0.75 }}>
              {pagedCartons.map((row) => {
                const selected = row.id === cartonId;
                const done = DONE_STATUSES.includes(row.status);
                const scanned = Number(row.scannedQty || 0);
                const target = Number(row.plannedQty || 0);
                const pct = clampPct((scanned / Math.max(1, target)) * 100);
                return (
                  <Box
                    key={row.id}
                    component="button"
                    type="button"
                    onClick={() => setCartonId(row.id)}
                    sx={{
                      width: '100%', textAlign: 'left', border: selected ? '1px solid #2F6FED' : '1px solid transparent',
                      bgcolor: selected ? '#F2F6FF' : '#FFFFFF', borderRadius: 1.5, p: 1, cursor: 'pointer',
                      color: 'inherit', font: 'inherit', transition: 'all .15s ease',
                      '&:hover': { bgcolor: selected ? '#EEF4FF' : '#F7F9FC', borderColor: selected ? '#2F6FED' : '#E1E8EF' }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
                        {done ? <CheckCircleOutline sx={{ fontSize: 18, color: 'success.main' }} /> : <Inventory2Outlined sx={{ fontSize: 18, color: selected ? 'primary.main' : 'text.secondary' }} />}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 750 }}>Carton {row.cartonNo}</Typography>
                          <Typography variant="caption" color="text.secondary">{scanned}/{target} items</Typography>
                        </Box>
                      </Stack>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: done ? 'success.main' : 'text.secondary' }}>{Math.round(pct)}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={pct} color={done ? 'success' : 'primary'} sx={{ mt: 0.7, height: 4, borderRadius: 99 }} />
                  </Box>
                );
              })}
              {!pagedCartons.length ? <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No cartons match this view.</Typography> : null}
            </Stack>
            <TablePagination
              component="div"
              count={filteredCartons.length}
              page={Math.min(cartonPage, Math.max(0, Math.ceil(filteredCartons.length / cartonRowsPerPage) - 1))}
              rowsPerPage={cartonRowsPerPage}
              onPageChange={(_, next) => setCartonPage(next)}
              onRowsPerPageChange={(e) => { setCartonRowsPerPage(Number(e.target.value)); setCartonPage(0); }}
              rowsPerPageOptions={[10, 20, 50]}
              labelRowsPerPage="Rows"
            />
          </Paper>

          {carton ? (
            <Stack spacing={1.5}>
              <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Active carton</Typography>
                    <Typography variant="h3" sx={{ mt: 0.25, fontSize: { xs: '1.35rem', md: '1.6rem' }, fontWeight: 750 }}>Carton {carton.cartonNo}</Typography>
                  </Box>
                  <LululemonStatusChip status={carton.status} />
                </Stack>

                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: '#F7F9FC', border: '1px solid #E7EDF3' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                        <Typography variant="body2" color="text.secondary">Packing progress</Typography>
                        <Typography sx={{ fontWeight: 800 }}>{Number(carton.scannedQty || 0)} / {Number(carton.plannedQty || 0)} items</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={cartonPct} color={full ? 'success' : 'primary'} sx={{ mt: 0.8, height: 9, borderRadius: 99 }} />
                    </Box>
                    <Box sx={{ minWidth: 74, textAlign: { sm: 'right' } }}>
                      <Typography sx={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1 }}>{Math.round(cartonPct)}%</Typography>
                    </Box>
                  </Stack>
                </Box>

                <Divider sx={{ my: 1.75 }} />

                <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Scan product</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Keep the cursor here and scan continuously. Invalid SKU will not increase quantity.</Typography>
                <TextField
                  inputRef={scanRef}
                  fullWidth
                  disabled={busy || locked || full}
                  placeholder={po?.sku ? `Expected SKU: ${po.sku}` : 'Scan first product SKU to assign the PO SKU'}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doScan(); } }}
                  inputProps={{ autoComplete: 'off' }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment> }}
                  sx={{ '& .MuiOutlinedInput-root': { minHeight: 58, bgcolor: '#FFFFFF' }, '& input': { fontSize: '1rem', fontWeight: 700 } }}
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mt: 1.25 }}>
                  <Button onClick={undo} startIcon={<Undo />} disabled={busy || locked || !Number(carton.scannedQty || 0)} color="secondary">Undo last scan</Button>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {busy ? <CircularProgress size={22} /> : null}
                    <Button onClick={finish} variant="contained" color="success" startIcon={<DoneAll />} disabled={busy || locked || !full}>Finish carton</Button>
                  </Stack>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box sx={{ px: 1.5, py: 1.1, bgcolor: '#FBFCFE', borderBottom: '1px solid #E7EDF3' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Scan History</Typography>
                      <Typography variant="caption" color="text.secondary">Items generated for the active carton</Typography>
                    </Box>
                    <Chip size="small" label={`${items.length} rows`} />
                  </Stack>
                </Box>
                <Box sx={{ overflowX: 'auto' }}>
                  <SortableTable size="small" rowNumberStart={itemPage * itemRowsPerPage}>
                    <TableHead><TableRow><TableCell>#</TableCell><TableCell>Status</TableCell><TableCell>Scanned SKU</TableCell><TableCell>Scanned By</TableCell><TableCell>Time</TableCell></TableRow></TableHead>
                    <TableBody>
                      {items.slice(itemPage * itemRowsPerPage, itemPage * itemRowsPerPage + itemRowsPerPage).map((item) => (
                        <TableRow key={item.id} hover><TableCell>{item.itemNo}</TableCell><TableCell><LululemonStatusChip status={item.status} /></TableCell><TableCell>{item.scannedSku || '—'}</TableCell><TableCell>{item.scannedBy || '—'}</TableCell><TableCell>{item.scannedAt || '—'}</TableCell></TableRow>
                      ))}
                      {!items.length ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No scans yet for this carton.</TableCell></TableRow> : null}
                    </TableBody>
                  </SortableTable>
                </Box>
                <TablePagination component="div" count={items.length} page={Math.min(itemPage, Math.max(0, Math.ceil(items.length / itemRowsPerPage) - 1))} rowsPerPage={itemRowsPerPage} onPageChange={(_, next) => setItemPage(next)} onRowsPerPageChange={(e) => { setItemRowsPerPage(Number(e.target.value)); setItemPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
              </Paper>
            </Stack>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}
