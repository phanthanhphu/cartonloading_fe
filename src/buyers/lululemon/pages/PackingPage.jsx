import { useSafeAppBack } from 'utils/appBackNavigation';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Divider, InputAdornment, MenuItem, Paper, Stack, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { ArrowBackRounded, ArrowForwardRounded, CheckCircleOutline, LocalShippingOutlined, QrCodeScanner, QrCodeScannerOutlined, Refresh, Search } from '@mui/icons-material';
import { CompactPageHeader } from '../components/LululemonPageHeader';
import { useNavigate, useParams } from 'react-router-dom';
import { buyerPath } from 'utils/buyerAccess';
import StatusChip from '../components/StatusChip';
import OrderScope from '../components/OrderScope';
import { assignSscc, confirmCartonLabel, confirmCartonQuantity, getPo, listCartonItems, listAllPos } from '../services/service';
import { APP_MESSAGES } from '../../../constants/appMessages';
import { BUYER_CODE, PACKING_DONE_STATUSES, COMMON_FILTER, DEFAULT_TABLE_ROWS_PER_PAGE, ITEM_STATUS, RFID_STATUS } from '../../../constants/appConstants';

function RfidStatusChip({ status }) {
  const value = String(status || '').trim().toUpperCase();
  if (!value) return <Chip size="small" label="Not ready" variant="outlined" sx={{ fontWeight: 750, minWidth: 96 }} />;
  const label = value === RFID_STATUS.WAITING_RFID ? 'Waiting RFID' : value === RFID_STATUS.VERIFIED ? 'RFID Verified' : value === RFID_STATUS.FAILED ? 'RFID Failed' : value.replaceAll('_', ' ');
  const color = value === RFID_STATUS.VERIFIED ? 'success' : value === RFID_STATUS.FAILED ? 'error' : 'warning';
  return <Chip size="small" label={label} color={color} sx={{ fontWeight: 750, minWidth: 96 }} />;
}

function Metric({ label, value, hint }) {
  return (
    <Box sx={{ minWidth: 70 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1, fontSize: '0.68rem' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.92rem', lineHeight: 1.2, fontWeight: 780, color: '#20364D', whiteSpace: 'nowrap' }}>{value}</Typography>
      {hint ? <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem', lineHeight: 1 }}>{hint}</Typography> : null}
    </Box>
  );
}

export default function PackingPage() {
  const navigate = useNavigate();
  const goBack = useSafeAppBack();
  const { orderId: routeOrderId, poId: routePoId } = useParams();
  const isPoDetailPage = Boolean(routeOrderId && routePoId);
  const [orderId, setOrderId] = useState(routeOrderId || '');
  const [pos, setPos] = useState([]);
  const [poSearch, setPoSearch] = useState('');
  const [poFactory, setPoFactory] = useState('ALL');
  const [poStatus, setPoStatus] = useState('ALL');
  const [poPage, setPoPage] = useState(0);
  const [poRowsPerPage, setPoRowsPerPage] = useState(10);
  const [poId, setPoId] = useState(routePoId || '');
  const [detail, setDetail] = useState(null);
  const [cartonId, setCartonId] = useState('');
  const [items, setItems] = useState([]);
  const [packingOpen, setPackingOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [itemPage, setItemPage] = useState(0);
  const [itemRowsPerPage, setItemRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
  const [cartonKeyword, setCartonKeyword] = useState('');
  const [cartonFilter, setCartonFilter] = useState(COMMON_FILTER.OPEN);
  const [cartonPage, setCartonPage] = useState(0);
  const [cartonRowsPerPage, setCartonRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
  const [identitySku, setIdentitySku] = useState('');
  const [qtyConfirmed, setQtyConfirmed] = useState(false);
  const [identitySscc, setIdentitySscc] = useState('');
  const [identityBusy, setIdentityBusy] = useState(false);
  const skuRef = useRef(null);
  const ssccRef = useRef(null);

  const loadPos = useCallback(async () => {
    if (!orderId) { setPos([]); return; }
    try { setPos(await listAllPos(orderId)); }
    catch (error) { setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.LOAD_PO_FAILED }); }
  }, [orderId]);

  const loadDetail = useCallback(async (targetPoId = poId) => {
    if (!orderId || !targetPoId) { setDetail(null); return; }
    const value = await getPo(orderId, targetPoId);
    setDetail(value);
    const currentExists = value.cartons?.some((row) => row.id === cartonId);
    if (!currentExists) {
      const next = value.cartons?.find((row) => !PACKING_DONE_STATUSES.includes(row.status)) || value.cartons?.[0];
      setCartonId(next?.id || '');
    }
  }, [orderId, poId, cartonId]);

  const loadItems = useCallback(async () => {
    if (!orderId || !cartonId) { setItems([]); return; }
    try { setItems(await listCartonItems(orderId, cartonId)); setItemPage(0); }
    catch { setItems([]); }
  }, [orderId, cartonId]);

  useEffect(() => {
    setPoId(isPoDetailPage ? routePoId : ''); setDetail(null); setCartonId(''); setItems([]); setPackingOpen(false);
    setIdentitySku(''); setQtyConfirmed(false); setIdentitySscc('');
    setCartonPage(0); setCartonKeyword(''); setCartonFilter(COMMON_FILTER.OPEN);
    setPoSearch(''); setPoFactory('ALL'); setPoStatus('ALL'); setPoPage(0);
    if (!isPoDetailPage) loadPos();
  }, [orderId, loadPos, isPoDetailPage, routePoId]);
  useEffect(() => { loadDetail().catch((error) => setNotice({ severity: 'error', text: error?.response?.data?.message || error.message })); }, [poId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadItems(); }, [cartonId, loadItems]);
  useEffect(() => {
    const current = detail?.cartons?.find((row) => row.id === cartonId);
    setIdentitySku(current?.labelConfirmedSku || '');
    setQtyConfirmed(Boolean(current?.qtyConfirmedAt || current?.labelConfirmedAt));
    setIdentitySscc(current?.sscc18 || current?.sscc || '');
  }, [cartonId, detail]);

  const carton = useMemo(() => detail?.cartons?.find((row) => row.id === cartonId) || null, [detail, cartonId]);
  const po = detail?.po;
  // SSCC + confirmed carton-label SKU completes identity; RFID verification occurs later.
  const isIdentified = (row) => Boolean(row?.labelConfirmedAt && (row?.sscc18 || row?.sscc));
  const remainingIdentityCartons = useMemo(() => (detail?.cartons || [])
    .filter((row) => !isIdentified(row))
    .sort((a, b) => Number(a.cartonNo || 0) - Number(b.cartonNo || 0)), [detail]);
  const nextIdentityCarton = remainingIdentityCartons.find((row) => Number(row.cartonNo || 0) > Number(carton?.cartonNo || 0))
    || remainingIdentityCartons[0]
    || null;

  const poFactoryOptions = useMemo(() => [...new Set(pos.map((row) => row.factoryCode).filter(Boolean))].sort(), [pos]);
  const poStatusOptions = useMemo(() => [...new Set(pos.map((row) => row.status).filter(Boolean))].sort(), [pos]);
  const filteredPos = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    return pos.filter((row) => {
      if (poFactory !== 'ALL' && row.factoryCode !== poFactory) return false;
      if (poStatus !== 'ALL' && row.status !== poStatus) return false;
      if (!q) return true;
      return [row.poNumber, row.sku, row.masterPo, row.styleNumber, row.style,
        row.color, row.size, row.factoryCode].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [pos, poSearch, poFactory, poStatus]);
  const pagedPos = useMemo(() => filteredPos.slice(poPage * poRowsPerPage, (poPage + 1) * poRowsPerPage),
    [filteredPos, poPage, poRowsPerPage]);
  useEffect(() => { setPoPage(0); }, [orderId, poSearch, poFactory, poStatus]);
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(filteredPos.length / poRowsPerPage) - 1);
    if (poPage > lastPage) setPoPage(lastPage);
  }, [filteredPos.length, poRowsPerPage, poPage]);

  const openPo = (id) => {
    if (!orderId || !id) return;
    navigate(buyerPath(BUYER_CODE.LULULEMON, `packing/pos/${encodeURIComponent(orderId)}/${encodeURIComponent(id)}`));
  };

  const cartonStats = useMemo(() => {
    const rows = detail?.cartons || [];
    const completed = rows.filter((row) => PACKING_DONE_STATUSES.includes(row.status)).length;
    return { total: rows.length, completed, open: Math.max(0, rows.length - completed) };
  }, [detail]);

  const filteredCartons = useMemo(() => {
    const q = cartonKeyword.trim().toLowerCase();
    return (detail?.cartons || []).filter((row) => {
      const done = PACKING_DONE_STATUSES.includes(row.status);
      if (cartonFilter === COMMON_FILTER.OPEN && done) return false;
      if (cartonFilter === COMMON_FILTER.DONE && !done) return false;
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

  const openCarton = (row) => {
    setCartonId(row.id);
    setIdentitySku(row.labelConfirmedSku || '');
    setQtyConfirmed(Boolean(row.qtyConfirmedAt || row.labelConfirmedAt));
    setIdentitySscc(row.sscc18 || row.sscc || '');
    setPackingOpen(true);
    setNotice(null);
    setTimeout(() => {
      if (!(row.sscc18 || row.sscc)) ssccRef.current?.focus();
      else if ((row.qtyConfirmedAt || row.labelConfirmedAt) && !row.labelConfirmedAt) skuRef.current?.focus();
    }, 50);
  };

  const assignCartonSscc = async () => {
    const ssccValue = identitySscc.trim();
    if (!orderId || !carton || !ssccValue || identityBusy) return;
    setIdentityBusy(true);
    try {
      await assignSscc(orderId, carton.id, ssccValue);
      await loadDetail(poId);
      setNotice({
        severity: 'success',
        text: `SSCC ${ssccValue} assigned to Carton ${carton.cartonNo}. Confirm the system Unit Qty next.`
      });
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.SSCC_ASSIGNMENT_FAILED });
    } finally {
      setIdentityBusy(false);
    }
  };

  const confirmSystemQty = async () => {
    const assignedSscc = carton?.sscc18 || carton?.sscc || identitySscc.trim();
    if (!orderId || !carton || !assignedSscc || qtyConfirmed || identityBusy) return;
    setIdentityBusy(true);
    try {
      await confirmCartonQuantity(orderId, carton.id);
      await loadDetail(poId);
      setQtyConfirmed(true);
      setNotice({
        severity: 'success',
        text: `System Unit Qty ${Number(carton.plannedQty || 0)} confirmed. Scan SKU on the carton label to apply it to the carton and all logical item slots.`
      });
      setTimeout(() => skuRef.current?.focus(), 50);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message });
    } finally {
      setIdentityBusy(false);
    }
  };

  const confirmCartonIdentity = async () => {
    const skuValue = identitySku.trim();
    const assignedSscc = carton?.sscc18 || carton?.sscc || identitySscc.trim();
    if (!orderId || !carton || !assignedSscc || !qtyConfirmed || !skuValue || identityBusy) return;
    setIdentityBusy(true);
    try {
      await confirmCartonLabel(orderId, carton.id, skuValue);
      await loadDetail(poId);
      await loadItems();
      setNotice({
        severity: 'success',
        text: `Carton ${carton.cartonNo} identified successfully. SKU ${skuValue} was applied to all ${Number(carton.plannedQty || 0)} logical item slots. Item status is IDENTIFIED; RFID status is WAITING RFID.`
      });
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message });
    } finally {
      setIdentityBusy(false);
    }
  };


  return (
    <Stack className="lululemon-compact-v16" spacing={0.9}>
      <CompactPageHeader
        dense
        title={isPoDetailPage ? 'Purchase Order Packing' : 'Packing Operations'}
        actions={
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackRounded />}
              onClick={goBack}
            >
              Back
            </Button>
            <Button size="small" startIcon={<LocalShippingOutlined />} onClick={() => navigate(`${buyerPath(BUYER_CODE.LULULEMON, 'shipping')}${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ''}`)}>Shipping</Button>
            <Tooltip title="Refresh current PO"><span><Button size="small" startIcon={<Refresh />} onClick={refresh} disabled={!poId}>Refresh</Button></span></Tooltip>
          </Stack>
        }
      />

      {!isPoDetailPage ? (
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2.5, borderColor: '#DDE6EF' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.8}
          alignItems={{ md: 'center' }} sx={{ px: 1, py: 0.85, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box>
            <Typography fontWeight={950}>Purchase Orders for Packing</Typography>
            <Typography variant="caption" color="text.secondary">Choose an Order, then Open a PO to identify its cartons.</Typography>
          </Box>
          <Stack direction="row" spacing={0.7} alignItems="center">
            <Chip size="small" variant="outlined" label={`${filteredPos.length} POs`} />
            <Button size="small" startIcon={<Refresh />} onClick={loadPos} disabled={!orderId}>Refresh</Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.75} alignItems={{ lg: 'center' }} sx={{ p: 1 }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <OrderScope value={orderId} onChange={setOrderId} embedded compact />
          </Box>
          <TextField size="small" placeholder="Search PO, SKU, style, color..." value={poSearch}
            onChange={(event) => setPoSearch(event.target.value)} sx={{ flex: 1, minWidth: 190 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
          <TextField size="small" select label="Factory" value={poFactory} onChange={(event) => setPoFactory(event.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="ALL">All factories</MenuItem>
            {poFactoryOptions.map((factory) => <MenuItem key={factory} value={factory}>{factory}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="PO Status" value={poStatus} onChange={(event) => setPoStatus(event.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="ALL">All statuses</MenuItem>
            {poStatusOptions.map((status) => <MenuItem key={status} value={status}>{status.replaceAll('_', ' ')}</MenuItem>)}
          </TextField>
          <Button size="small" color="inherit"
            disabled={!poSearch && poFactory === 'ALL' && poStatus === 'ALL'}
            onClick={() => { setPoSearch(''); setPoFactory('ALL'); setPoStatus('ALL'); }}>Clear</Button>
        </Stack>

        <LululemonTableViewport sx={{ border: 0, borderRadius: 0 }}>
          <SortableTable size="small" stickyHeader rowNumberStart={poPage * poRowsPerPage}>
            <TableHead><TableRow>
              <TableCell>PO</TableCell>
              <TableCell>Factory</TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>Style / Color / Size</TableCell>
              <TableCell>Status</TableCell>
              <TableCell data-sortable={false} align="right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {pagedPos.map((row) => (
                <TableRow key={row.id} hover selected={row.id === poId} sx={{ cursor: 'pointer' }} onDoubleClick={() => openPo(row.id)}>
                  <TableCell sx={{ fontWeight: 900 }}>{row.poNumber || '—'}</TableCell>
                  <TableCell>{row.factoryCode || '—'}</TableCell>
                  <TableCell>{row.sku || 'Not identified'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>{row.styleNumber || row.style || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.color || '—'} · Size {row.size || '—'}</Typography>
                  </TableCell>
                  <TableCell><StatusChip status={row.status} /></TableCell>
                  <TableCell align="right"><Button size="small" variant="outlined" onClick={() => openPo(row.id)}>Open</Button></TableCell>
                </TableRow>
              ))}
              {!pagedPos.length ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                {orderId ? 'No Purchase Orders match the current filters.' : 'Select an Order to view its Purchase Orders.'}
              </TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </LululemonTableViewport>
        <TablePagination component="div" count={filteredPos.length} page={poPage}
          onPageChange={(_, next) => setPoPage(next)} rowsPerPage={poRowsPerPage}
          onRowsPerPageChange={(event) => { setPoRowsPerPage(Number(event.target.value)); setPoPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]} showFirstButton showLastButton
          sx={{ borderTop: '1px solid', borderColor: 'divider' }} />

        {po ? (
          <Stack direction="row" spacing={1.05} flexWrap="wrap" useFlexGap alignItems="center"
            sx={{ px: 1, py: 0.65, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
            <Typography fontWeight={900}>Selected PO {po.poNumber || '—'}</Typography>
            <Metric label="Factory" value={po.factoryCode || '—'} />
            <Metric label="SKU" value={po.sku || 'Not assigned'} />
            <Metric label="Cartons" value={cartonStats.total} hint={`${cartonStats.completed} completed`} />
            <Box sx={{ ml: { lg: 'auto' } }}><StatusChip status={po.status} /></Box>
          </Stack>
        ) : null}
      </Paper>
      ) : (
        <Paper variant="outlined" sx={{ px: 1.25, py: 1, borderRadius: 2.5, borderColor: '#DDE6EF' }}>
          <Stack direction="row" spacing={1.05} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography fontWeight={900}>PO {po?.poNumber || 'Loading...'}</Typography>
            {po ? (
              <>
                <Metric label="Factory" value={po.factoryCode || '—'} />
                <Metric label="SKU" value={po.sku || 'Not assigned'} />
                <Metric label="Cartons" value={cartonStats.total} hint={`${cartonStats.completed} completed`} />
                <Box sx={{ ml: { lg: 'auto' } }}><StatusChip status={po.status} /></Box>
              </>
            ) : null}
          </Stack>
        </Paper>
      )}

      {notice && !packingOpen && <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ borderRadius: 2 }}>{notice.text}</Alert>}

      {isPoDetailPage && detail ? (
        <Box>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 1, py: 0.8, borderBottom: '1px solid #E7EDF3', bgcolor: '#FBFCFE' }}>
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
                sx={{ mt: 0.55 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.45 }}>
                {[[COMMON_FILTER.OPEN, `Open ${cartonStats.open}`], [COMMON_FILTER.ALL, `All ${cartonStats.total}`], [COMMON_FILTER.DONE, `Done ${cartonStats.completed}`]].map(([key, label]) => (
                  <Button key={key} size="small" variant={cartonFilter === key ? 'contained' : 'text'} onClick={() => setCartonFilter(key)} sx={{ minWidth: 0, px: 1.1 }}>{label}</Button>
                ))}
              </Stack>
            </Box>

            <LululemonTableViewport sx={{ border: 0, borderRadius: 0 }}>
              <SortableTable stickyHeader size="small" rowNumberStart={cartonPage * cartonRowsPerPage} sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Carton No.</TableCell>
                    <TableCell align="right">Unit Qty</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell>SSCC-18</TableCell>
                    <TableCell>Identity</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Verification</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedCartons.map((row) => {
                    const done = PACKING_DONE_STATUSES.includes(row.status);
                    const cartonSku = row.labelConfirmedSku || 'Not identified';
                    const sscc = row.sscc18 || row.sscc || null;
                    const qtyIsConfirmed = Boolean(row.qtyConfirmedAt || row.labelConfirmedAt);
                    const identified = Boolean(row.labelConfirmedAt && sscc);
                    const identityLabel = identified
                      ? 'IDENTIFIED'
                      : qtyIsConfirmed && sscc
                        ? 'QTY CONFIRMED'
                        : sscc
                          ? 'SSCC ASSIGNED'
                          : row.labelConfirmedAt
                            ? 'WAITING SSCC'
                            : 'PENDING ID';
                    return (
                      <TableRow
                        key={row.id}
                        hover
                        selected={row.id === cartonId}
                        onDoubleClick={() => openCarton(row)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ fontWeight: 850 }}>Carton {row.cartonNo}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 850 }}>{Number(row.plannedQty || 0)}</TableCell>
                        <TableCell sx={{ fontWeight: cartonSku === 'Not identified' ? 500 : 750 }}>{cartonSku}</TableCell>
                        <TableCell>{sscc || 'Not assigned'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant={identified ? 'filled' : 'outlined'}
                            color={identified ? 'success' : 'default'}
                            label={identityLabel}
                          />
                        </TableCell>
                        <TableCell><StatusChip status={row.status} /></TableCell>
                        <TableCell>{done ? 'Completed' : 'Waiting RFID'}</TableCell>
                        <TableCell align="right">
                          <Button size="small" variant={identified ? 'outlined' : 'contained'} onClick={() => openCarton(row)}>
                            {identified ? 'View' : 'Identify'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!pagedCartons.length ? (
                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No cartons match this view.</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </SortableTable>
            </LululemonTableViewport>
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

        </Box>
      ) : null}

      <OperationWorkspaceDialog
        open={Boolean(carton && packingOpen)}
        onClose={() => setPackingOpen(false)}
        title={carton ? `Carton Identification · Carton ${carton.cartonNo}` : 'Carton Identification'}
        subtitle={po ? `PO ${po.poNumber || '—'} · ${po.styleNumber || po.style || '—'}` : ''}
        actions={carton ? <StatusChip status={carton.status} /> : null}
      >
        {carton ? (
        <Stack spacing={0.9}>
          {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ borderRadius: 2 }}>{notice.text}</Alert> : null}
              <Paper variant="outlined" sx={{ p: { xs: 1, md: 1.2 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>Identify this carton</Typography>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                  <TextField
                    inputRef={ssccRef}
                    fullWidth
                    label="1. SSCC-18"
                    placeholder="Scan GS1 (00) barcode (20 digits) or SSCC-18"
                    value={identitySscc}
                    onChange={(e) => setIdentitySscc(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); assignCartonSscc(); } }}
                    disabled={identityBusy || Boolean(carton.sscc18 || carton.sscc)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment> }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<QrCodeScanner />}
                    onClick={assignCartonSscc}
                    disabled={identityBusy || !identitySscc.trim() || Boolean(carton.sscc18 || carton.sscc)}
                    sx={{ minWidth: { md: 190 }, minHeight: 42 }}
                  >
                    {carton.sscc18 || carton.sscc ? 'SSCC Assigned' : 'Assign SSCC'}
                  </Button>
                </Stack>

                <Divider sx={{ my: 1.2 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(180px,.6fr) minmax(0,1fr)' }, gap: 1, alignItems: 'start' }}>
                  <Box sx={{ minHeight: 56, px: 1.25, py: 0.7, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: '#F8FAFC' }}>
                    <Typography variant="caption" color="text.secondary">2. SYSTEM UNIT QTY</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, lineHeight: 1.1 }}>{Number(carton.plannedQty || 0)}</Typography>
                  </Box>
                  <Stack spacing={0.75}>
                    <Button
                      fullWidth
                      variant={qtyConfirmed ? 'outlined' : 'contained'}
                      color="success"
                      startIcon={<CheckCircleOutline />}
                      onClick={confirmSystemQty}
                      disabled={identityBusy || qtyConfirmed || !Boolean(carton.sscc18 || carton.sscc) || Number(carton.plannedQty || 0) <= 0}
                      sx={{ minHeight: 42 }}
                    >
                      {qtyConfirmed ? `Qty ${Number(carton.plannedQty || 0)} Confirmed` : `Confirm Qty ${Number(carton.plannedQty || 0)}`}
                    </Button>
                  </Stack>
                </Box>

                <Divider sx={{ my: 1.2 }} />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                  <TextField
                    inputRef={skuRef}
                    fullWidth
                    label="3. SKU on carton label"
                    placeholder="Scan SKU barcode"
                    value={identitySku}
                    onChange={(e) => setIdentitySku(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmCartonIdentity(); } }}
                    disabled={identityBusy || !qtyConfirmed || Boolean(carton.labelConfirmedAt)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerOutlined color="primary" /></InputAdornment> }}
                  />
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleOutline />}
                    onClick={confirmCartonIdentity}
                    disabled={identityBusy || !qtyConfirmed || !identitySku.trim() || Boolean(carton.labelConfirmedAt)}
                    sx={{ minWidth: { md: 220 }, minHeight: 42 }}
                  >
                    {carton.labelConfirmedAt ? 'SKU Applied' : 'Apply SKU & Identify'}
                  </Button>
                </Stack>
                {isIdentified(carton) ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 1.2, p: 1, borderRadius: 1.5, bgcolor: 'success.lighter', border: '1px solid', borderColor: 'success.light' }}>
                    <Box>
                      <Typography fontWeight={850} color="success.main">Carton {carton.cartonNo} identified</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {nextIdentityCarton ? `${remainingIdentityCartons.length} carton(s) left to identify in this PO.` : 'All cartons in this PO have been identified.'}
                      </Typography>
                    </Box>
                    {nextIdentityCarton ? (
                      <Button variant="contained" disabled={identityBusy} endIcon={<ArrowForwardRounded />} onClick={() => openCarton(nextIdentityCarton)} sx={{ flexShrink: 0 }}>
                        Next Carton {nextIdentityCarton.cartonNo}
                      </Button>
                    ) : null}
                  </Stack>
                ) : null}
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 1, md: 1.15 } }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={0.8}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Active carton</Typography>
                    <Typography variant="h3" sx={{ mt: 0.25, fontSize: { xs: '1.15rem', md: '1.28rem' }, fontWeight: 750 }}>Carton {carton.cartonNo}</Typography>
                  </Box>
                  <StatusChip status={carton.status} />
                </Stack>

                <Box sx={{ mt: 0.75, p: 0.9, borderRadius: 1.6, bgcolor: '#F7F9FC', border: '1px solid #E7EDF3' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
                    <Metric label="Expected Qty" value={Number(carton.plannedQty || 0)} />
                    <Metric label="Expected SKU" value={carton.labelConfirmedSku || 'Not identified'} />
                    <Metric label="SSCC-18" value={carton.sscc18 || carton.sscc || 'Not assigned'} />
                    <Metric label="Verification" value={PACKING_DONE_STATUSES.includes(carton.status) ? 'Completed' : 'Waiting RFID'} />
                  </Box>
                </Box>

                <Divider sx={{ my: 0.9 }} />

              </Paper>

              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box sx={{ px: 1, py: 0.75, bgcolor: '#FBFCFE', borderBottom: '1px solid #E7EDF3' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Item Assignment</Typography>
                    </Box>
                    <Chip size="small" label={`${items.length} rows`} />
                  </Stack>
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <LululemonTableViewport viewportHeight="clamp(240px, calc(100dvh - 490px), 560px)" sx={{ border: 0, borderRadius: 0 }}>
                    <SortableTable size="small" rowNumberStart={itemPage * itemRowsPerPage}>
                      <TableHead><TableRow><TableCell>#</TableCell><TableCell>Item Status</TableCell><TableCell>Expected SKU</TableCell><TableCell>RFID Status</TableCell></TableRow></TableHead>
                      <TableBody>
                        {items.slice(itemPage * itemRowsPerPage, itemPage * itemRowsPerPage + itemRowsPerPage).map((item) => {
                          const itemStatus = item.status === ITEM_STATUS.PENDING && item.expectedSku ? ITEM_STATUS.IDENTIFIED : item.status;
                          const rfidStatus = item.rfidStatus || (itemStatus === ITEM_STATUS.IDENTIFIED ? RFID_STATUS.WAITING_RFID : null);
                          return (
                            <TableRow key={item.id} hover>
                              <TableCell>{item.itemNo}</TableCell>
                              <TableCell><StatusChip status={itemStatus} /></TableCell>
                              <TableCell>{item.expectedSku || item.scannedSku || '—'}</TableCell>
                              <TableCell><RfidStatusChip status={rfidStatus} /></TableCell>
                            </TableRow>
                          );
                        })}
                        {!items.length ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No item slots are available for this carton.</TableCell></TableRow> : null}
                      </TableBody>
                    </SortableTable>
                  </LululemonTableViewport>
                </Box>
                <Stack spacing={0.65} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
                  {items.slice(itemPage * itemRowsPerPage, itemPage * itemRowsPerPage + itemRowsPerPage).map((item) => (
                    <Paper key={item.id} variant="outlined" sx={{ p: 0.85, borderRadius: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={900}>Item {item.itemNo}</Typography>
                          <Typography variant="body2" fontWeight={800} noWrap>{item.expectedSku || item.scannedSku || 'SKU not assigned'}</Typography>
                        </Box>
                        <Stack spacing={0.35} alignItems="flex-end">
                          <StatusChip status={item.status === ITEM_STATUS.PENDING && item.expectedSku ? ITEM_STATUS.IDENTIFIED : item.status} />
                          <RfidStatusChip status={item.rfidStatus || ((item.status === ITEM_STATUS.IDENTIFIED || (item.status === ITEM_STATUS.PENDING && item.expectedSku)) ? RFID_STATUS.WAITING_RFID : null)} />
                        </Stack>
                      </Stack>

                    </Paper>
                  ))}
                  {!items.length ? <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No item slots are available for this carton.</Typography> : null}
                </Stack>
                <TablePagination component="div" count={items.length} page={Math.min(itemPage, Math.max(0, Math.ceil(items.length / itemRowsPerPage) - 1))} rowsPerPage={itemRowsPerPage} onPageChange={(_, next) => setItemPage(next)} onRowsPerPageChange={(e) => { setItemRowsPerPage(Number(e.target.value)); setItemPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} />
              </Paper>
        </Stack>
        ) : null}
      </OperationWorkspaceDialog>
    </Stack>
  );
}
