import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, MenuItem, Paper, Stack, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography, Checkbox, FormControlLabel
} from '@mui/material';
import { Visibility, Refresh, Search, Close, Tune, ViewColumn } from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import { CompactPageHeader } from '../components/LululemonPageHeader';
import StatusChip from 'components/StatusChip';
import OrderScope from '../components/OrderScope';
import { getUniqueInvalidEpcRows } from '../utils/trueVueEpc';
import { listCartonHistory, listCartonHistoryFilters, getCartonHistoryDetail } from '../services/service';
import { APP_MESSAGES } from '../../../constants/appMessages';
import { WEIGHING_RESULT, ORGANIZATION_REALTIME as RT } from '../../../constants/appConstants';
import { subscribeOrganizationChanges } from '../../../common/realtime/organizationSocket';
import { useSelectedFactory } from 'utils/factorySelection';
import { BUYER_CODE } from '../../../constants/appConstants';

const emptyFilters = { masterPo: '', poNumber: '', packingPlan: '', salesOrderPts: '', keyword: '', scannedBy: '', weighedBy: '', status: '', rfidStatus: '', weightStatus: '', dateFrom: '', dateTo: '' };
const emptyOptions = { masterPos: [], poNumbers: [], packingPlans: [], salesOrderPts: [] };
const OPTIONAL_HISTORY_COLUMNS = [
  { key: 'scannedBy', label: 'Scanned By' },
  { key: 'weighedBy', label: 'Weighed By' },
  { key: 'scanTime', label: 'Scan Time' },
  { key: 'weightTime', label: 'Weight Time' }
];
const errorText = (error) => error?.response?.data?.message || error?.message || APP_MESSAGES.OPERATION_FAILED;
const timeText = (date) => {
  if (!date) return '—';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toLocaleString('vi-VN', { hour12: false });
};
const displayWeightResult = (value) => {
  const normalized = value === WEIGHING_RESULT.HOLD ? WEIGHING_RESULT.FAILED : value;
  return [WEIGHING_RESULT.PASS, WEIGHING_RESULT.FAILED].includes(normalized) ? normalized : null;
};
const isActualRfidScan = (session) => session?.status !== 'REOPENED';
// Historical sessions retain their original reason string. Show unsupported
// unique tags in Wrong SKU even for scans saved before this UI update.
const rfidReasonText = (session) => {
  const unsupported = getUniqueInvalidEpcRows(session?.invalidReads).length;
  const wrongDecoded = new Set(session?.wrongSkuEpcs || []);
  const totalWrong = wrongDecoded.size + unsupported;
  const reason = session?.reason || '';
  const wrongSummary = totalWrong > 0 && !/Wrong SKU:/i.test(reason)
    ? `Wrong SKU: ${totalWrong} (incl. ${unsupported} unsupported)` : '';
  const invalidReadDetail = session?.invalidReads?.length > 0 && !/Invalid\/unsupported EPC reads:/i.test(reason)
    ? `Unsupported reads: ${session.invalidReads.length}` : '';
  return [reason, wrongSummary, invalidReadDetail].filter(Boolean).join(' · ') || '—';
};
const Check = ({ status }) => status && status !== 'PENDING'
  ? <StatusChip status={status} /> : <Chip size="small" variant="outlined" label="Pending" />;

export default function TraceHistoryPage() {
  const [orderId, setOrderId] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [extraColumns, setExtraColumns] = useState([]);
  const [applied, setApplied] = useState(emptyFilters);
  const [options, setOptions] = useState(emptyOptions);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  useAutoDismissFeedback(notice, setNotice, null, 'success');
  const { factoryCode } = useSelectedFactory(BUYER_CODE.LULULEMON);
  const requestRef = useRef(0);
  const currentSearch = useRef({ orderId, applied, page });
  const socketReloadRef = useRef(null);
  currentSearch.current = { orderId, applied, page };

  const load = useCallback(async (search, silent = false) => {
    if (!search.orderId) { setRows([]); setTotal(0); return; }
    const request = ++requestRef.current;
    if (!silent) setBusy(true);
    try {
      const data = await listCartonHistory(search.orderId, search.applied, search.page, 50);
      if (request !== requestRef.current) return;
      setRows(data?.content || []);
      setTotal(Number(data?.totalElements || 0));
    } catch (error) {
      if (request === requestRef.current) {
        if (!silent) setRows([]);
        setNotice({ severity: 'error', text: errorText(error) });
      }
    } finally { if (request === requestRef.current) setBusy(false); }
  }, []);

  useEffect(() => { load({ orderId, applied, page }); }, [orderId, applied, page, load]);
  useEffect(() => {
    let active = true;
    setOptions(emptyOptions);
    if (orderId) listCartonHistoryFilters(orderId)
      .then((data) => { if (active) setOptions(data || emptyOptions); })
      .catch((error) => { if (active) setNotice({ severity: 'error', text: errorText(error) }); });
    return () => { active = false; };
  }, [orderId]);

  // One shared WebSocket subscription. No intervals or reconnect-triggered HTTP polling.
  useEffect(() => {
    if (!factoryCode) return undefined;
    const module = `${RT.HISTORY}:${factoryCode}`;
    const unsubscribe = subscribeOrganizationChanges(module, (event) => {
      if (event?.module !== module) return;
      // Burst of physical scans -> at most one quiet list refresh after the last event.
      if (socketReloadRef.current) clearTimeout(socketReloadRef.current);
      socketReloadRef.current = setTimeout(() => {
        socketReloadRef.current = null;
        const snapshot = currentSearch.current;
        if (snapshot.orderId) load(snapshot, true);
      }, 900);
    });
    return () => {
      unsubscribe();
      if (socketReloadRef.current) clearTimeout(socketReloadRef.current);
      socketReloadRef.current = null;
    };
  }, [load, factoryCode]);

  const search = () => {
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setNotice({ severity: 'error', text: 'Date From cannot be later than Date To.' });
      return;
    }
    setPage(0); setApplied({ ...filters });
  };
  const refresh = () => load(currentSearch.current);
  const chooseOrder = (next) => {
    setOrderId(next); setFilters(emptyFilters); setApplied(emptyFilters);
    setPage(0); setRows([]); setTotal(0); setSelected(null); setSelectedRow(null);
  };
  const openDetail = async (row) => {
    setSelectedRow(row); setSelected(null); setDetailBusy(true);
    try { setSelected(await getCartonHistoryDetail(orderId, row.cartonId)); }
    catch (error) { setNotice({ severity: 'error', text: errorText(error) }); setSelectedRow(null); }
    finally { setDetailBusy(false); }
  };
  const closeDetail = () => { setSelectedRow(null); setSelected(null); };
  const setFilter = (key, value) => setFilters((old) => ({ ...old, [key]: value }));
  const chooser = (label, key, values) => (
    <TextField select size="small" label={label} value={filters[key]} onChange={(event) => setFilter(key, event.target.value)}
      sx={{ flex: '1 1 145px', minWidth: 125 }}>
      <MenuItem value="">All</MenuItem>
      {(values || []).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
    </TextField>
  );
  const totalPages = Math.ceil(total / 50);

  return (
    <Stack spacing={1} className="lululemon-compact-v16" sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader dense title="Completed Carton History"
        meta={<Stack direction="row" spacing={0.7}><Chip size="small" label={`${total} completed cartons`} /><Chip size="small" label="Factory scoped" /></Stack>} />
      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      <Paper variant="outlined" sx={{ borderRadius: 2, p: 1 }}>
        <OrderScope embedded compact value={orderId} onChange={chooseOrder} />
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          <TextField size="small" type="date" label="Date From (weighed)" InputLabelProps={{ shrink: true }}
            value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} sx={{ flex: '1 1 170px' }} />
          <TextField size="small" type="date" label="Date To (weighed)" InputLabelProps={{ shrink: true }}
            value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} sx={{ flex: '1 1 170px' }} />
          {chooser('Final Status', 'status', ['PASS', 'FAILED'])}
          <TextField size="small" label="SSCC / SKU / Carton / PO" value={filters.keyword}
            onChange={(e) => setFilter('keyword', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
            sx={{ flex: '2 1 220px' }} />
        </Stack>
        {showMoreFilters && <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          {chooser('Master PO', 'masterPo', options.masterPos)}
          {chooser('PO', 'poNumber', options.poNumbers)}
          {chooser('Packing Plan', 'packingPlan', options.packingPlans)}
          {chooser('SO (PTS)', 'salesOrderPts', options.salesOrderPts)}
          {chooser('RFID', 'rfidStatus', ['PASS', 'FAILED'])}
          {chooser('Weight', 'weightStatus', ['PASS', 'FAILED'])}
          <TextField size="small" label="Scanned by" value={filters.scannedBy}
            onChange={(e) => setFilter('scannedBy', e.target.value)} sx={{ flex: '1 1 160px' }} />
          <TextField size="small" label="Weighed by" value={filters.weighedBy}
            onChange={(e) => setFilter('weighedBy', e.target.value)} sx={{ flex: '1 1 160px' }} />
        </Stack>}
        <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          <Button startIcon={<Tune />} variant="text" onClick={() => setShowMoreFilters((old) => !old)}>
            {showMoreFilters ? 'Show Less Filters' : 'Show More Filters'}
          </Button>
          <Stack direction="row" gap={1}>
          <Button startIcon={<Search />} variant="contained" disabled={!orderId || busy} onClick={search}>Search</Button>
          <Button startIcon={<Refresh />} variant="outlined" disabled={!orderId || busy} onClick={refresh}>Refresh</Button>
          </Stack>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Stack direction="row" justifyContent="flex-end" sx={{ p: 0.7, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button size="small" variant="outlined" startIcon={<ViewColumn />} onClick={() => setShowColumnChooser((old) => !old)}>
            Customize Columns
          </Button>
        </Stack>
        {showColumnChooser && <Stack direction="row" flexWrap="wrap" gap={1} sx={{ px: 1, py: 0.5 }}>
          {OPTIONAL_HISTORY_COLUMNS.map((column) => <FormControlLabel key={column.key}
            control={<Checkbox size="small" checked={extraColumns.includes(column.key)}
              onChange={(e) => setExtraColumns((current) => e.target.checked ? [...current, column.key] : current.filter((key) => key !== column.key))} />}
            label={column.label} />)}
        </Stack>}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <LululemonTableViewport sx={{ border: 0 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow>
              {['Factory', 'Order', 'Master PO', 'PO', 'Packing Plan', 'SO (PTS)', 'Carton', 'SSCC-18', 'SKU',
                'RFID', 'Weight', 'Status', ...OPTIONAL_HISTORY_COLUMNS.filter((column) => extraColumns.includes(column.key)).map((column) => column.label)].map((column) => <TableCell key={column}>{column}</TableCell>)}
              <TableCell data-sortable={false}>Detail</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.map((row) => <TableRow key={row.cartonId} hover>
                <TableCell>{row.factoryCode || '—'}</TableCell>
                <TableCell>{row.orderName || '—'}</TableCell>
                <TableCell>{row.masterPo || '—'}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{row.poNumber || '—'}</TableCell>
                <TableCell>{row.packingPlan || '—'}</TableCell>
                <TableCell>{row.salesOrderPts || '—'}</TableCell>
                <TableCell>{row.cartonNo ?? '—'}</TableCell>
                <TableCell>{row.sscc18 || '—'}</TableCell>
                <TableCell>{row.sku || '—'}</TableCell>
                <TableCell><Check status={row.rfidStatus} /></TableCell>
                <TableCell><Check status={displayWeightResult(row.weightStatus)} /></TableCell>
                <TableCell><Check status={row.status} /></TableCell>
                {extraColumns.includes('scannedBy') && <TableCell>{row.scannedBy || '—'}</TableCell>}
                {extraColumns.includes('weighedBy') && <TableCell>{row.weighedBy || '—'}</TableCell>}
                {extraColumns.includes('scanTime') && <TableCell sx={{ whiteSpace: 'nowrap' }}>{timeText(row.scanTime)}</TableCell>}
                {extraColumns.includes('weightTime') && <TableCell sx={{ whiteSpace: 'nowrap' }}>{timeText(row.weightTime)}</TableCell>}
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="View full Scan / RFID / Weight history">
                    <IconButton aria-label={`View history of carton ${row.cartonNo}`} color="primary"
                      disabled={detailBusy} size="small" onClick={() => openDetail(row)}><Visibility /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>)}
              {!rows.length && <TableRow><TableCell colSpan={13 + extraColumns.length} align="center" sx={{ py: 4 }}>
                {busy ? 'Loading history…' : 'No completed RFID + Weight cartons match these filters.'}
              </TableCell></TableRow>}
            </TableBody>
          </SortableTable>
        </LululemonTableViewport>
        </Box>
        <Stack spacing={0.8} sx={{ display: { xs: 'flex', md: 'none' }, p: 1 }}>
          {rows.map((row) => <Paper key={row.cartonId} variant="outlined" sx={{ p: 1, borderRadius: 1.8 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography fontWeight={800}>{row.orderName || '—'} · PO {row.poNumber || '—'}</Typography>
              <Tooltip title="View carton history"><IconButton color="primary" aria-label="View history"
                onClick={() => openDetail(row)}><Visibility /></IconButton></Tooltip>
            </Stack>
            <Typography variant="body2">Factory {row.factoryCode || '—'} · Carton {row.cartonNo ?? '—'} · SKU {row.sku || '—'}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>SSCC-18: {row.sscc18 || '—'}</Typography>
            <Typography variant="caption" color="text.secondary">Master PO: {row.masterPo || '—'} · Packing Plan: {row.packingPlan || '—'} · SO (PTS): {row.salesOrderPts || '—'}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.8 }}>
              <Check status={row.rfidStatus} /><Check status={displayWeightResult(row.weightStatus)} /><Check status={row.status} />
            </Stack>
            {extraColumns.includes('scannedBy') && <Typography variant="caption" sx={{ display: 'block' }}>Scanned: {row.scannedBy || '—'}</Typography>}
            {extraColumns.includes('scanTime') && <Typography variant="caption" sx={{ display: 'block' }}>Scan Time: {timeText(row.scanTime)}</Typography>}
            {extraColumns.includes('weighedBy') && <Typography variant="caption" sx={{ display: 'block' }}>Weighed: {row.weighedBy || '—'}</Typography>}
            {extraColumns.includes('weightTime') && <Typography variant="caption" sx={{ display: 'block' }}>Weight Time: {timeText(row.weightTime)}</Typography>}
          </Paper>)}
          {!rows.length && <Typography variant="body2" align="center" color="text.secondary" sx={{ py: 3 }}>
            {busy ? 'Loading history…' : 'No completed RFID + Weight cartons match these filters.'}
          </Typography>}
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1 }}>
          <Typography variant="caption" color="text.secondary">Page {page + 1} of {Math.max(1, totalPages)} · {total} cartons</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={busy || page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="small" disabled={busy || page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </Stack>
        </Stack>
      </Paper>
      <Dialog open={Boolean(selectedRow)} onClose={closeDetail} fullWidth maxWidth="xl" scroll="paper">
        <DialogTitle sx={{ pb: 0.6 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={800}>Carton Detail</Typography>
            <IconButton aria-label="Close detail" onClick={closeDetail}><Close /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRow && <Paper variant="outlined" sx={{ p: 1, mb: 1, borderRadius: 2 }}>
            <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mb: 1 }}>
              {Object.entries({ Factory: selectedRow.factoryCode, Order: selectedRow.orderName,
                'Master PO': selectedRow.masterPo, PO: selectedRow.poNumber,
                'Packing Plan': selectedRow.packingPlan, 'SO (PTS)': selectedRow.salesOrderPts,
                'SSCC-18': selectedRow.sscc18, SKU: selectedRow.sku,
                Carton: selectedRow.cartonNo, 'Planned Qty': selectedRow.plannedQty }).map(([title, value]) => <Box key={title} sx={{ minWidth: 110 }}>
                <Typography variant="caption" color="text.secondary">{title}</Typography>
                <Typography variant="body2" fontWeight={700}>{value ?? '—'}</Typography>
              </Box>)}
            </Stack>
            <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
              <Typography variant="body2">RFID: <Check status={selectedRow.rfidStatus} /></Typography>
              <Typography variant="body2">Weight: <Check status={displayWeightResult(selectedRow.weightStatus)} /></Typography>
              <Typography variant="body2">Final: <Check status={selectedRow.status} /></Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>
              SSCC scanned by: {selected?.carton?.ssccAssignedBy || '—'} · {timeText(selected?.carton?.ssccAssignedAt)}
              {' · '} SKU/Qty confirmed by: {selected?.carton?.qtyConfirmedBy || '—'} · {timeText(selected?.carton?.qtyConfirmedAt)}
            </Typography>
          </Paper>}
          {detailBusy && <Typography color="text.secondary">Loading detailed history…</Typography>}
      {selected ? <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 0.5 }}>RFID Scan History</Typography>
        <LululemonTableViewport paginate sx={{ maxHeight: 300 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow><TableCell>Start time</TableCell><TableCell>End time</TableCell><TableCell>Status</TableCell><TableCell>Expected / Unique EPC</TableCell><TableCell>Total reads</TableCell><TableCell>Reason / Invalid EPC</TableCell><TableCell>Station</TableCell><TableCell>User</TableCell></TableRow></TableHead>
            <TableBody>
              {(selected.rfidSessions || []).filter(isActualRfidScan).map((session) => <TableRow key={session.id}>
                <TableCell>{timeText(session.startedAt)}</TableCell>
                <TableCell>{timeText(session.finishedAt)}</TableCell>
                <TableCell><StatusChip status={session.status} /></TableCell>
                <TableCell>{session.expectedQty ?? '—'} / {session.actualQty ?? session.epcs?.length ?? 0}</TableCell>
                <TableCell>{session.readCount ?? 0}</TableCell>
                <TableCell>{rfidReasonText(session)}</TableCell>
                <TableCell>{session.stationCode || '—'}
                  {session.epcs?.length ? <Box component="details" sx={{ mt: 0.4, maxWidth: 240 }}>
                    <Box component="summary" sx={{ color: 'primary.main', cursor: 'pointer' }}>View {session.epcs.length} EPCs</Box>
                    <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{session.epcs.join('\n')}</Typography>
                  </Box> : null}</TableCell>
                <TableCell>{session.finishedBy || session.startedBy || '—'}</TableCell>
              </TableRow>)}
              {!(selected.rfidSessions || []).some(isActualRfidScan) && <TableRow><TableCell colSpan={8} align="center">No RFID scan attempts saved for this carton.</TableCell></TableRow>}
            </TableBody>
          </SortableTable>
        </LululemonTableViewport>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>Weight Check History</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport paginate sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>Action</TableCell><TableCell>Result</TableCell><TableCell>Expected kg</TableCell><TableCell>Actual kg</TableCell><TableCell>Difference kg</TableCell><TableCell>Tolerance kg</TableCell><TableCell>Station</TableCell><TableCell>Source</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead><TableBody>{(selected.weightEvents || []).map((event) => <TableRow key={event.id}><TableCell>{event.action || '—'}</TableCell><TableCell>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : '—'}</TableCell><TableCell>{event.expectedWeightKg ?? '—'}</TableCell><TableCell>{event.actualWeightKg ?? '—'}</TableCell><TableCell>{event.differenceKg ?? '—'}</TableCell><TableCell>{event.toleranceKg ?? '—'}</TableCell><TableCell>{event.stationCode || '—'}</TableCell><TableCell>{event.source || '—'}</TableCell><TableCell>{event.userId || '—'}</TableCell><TableCell>{timeText(event.createdAt)}</TableCell></TableRow>)}{!selected.weightEvents?.length ? <TableRow><TableCell colSpan={10} align="center">No weighing events.</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.weightEvents || []).map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 0.75, borderRadius: 1.4 }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={900}>{event.action || 'WEIGHT'}</Typography>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : null}</Stack><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0.5, mt: 0.5 }}><Box><Typography variant="caption" color="text.secondary">Expected</Typography><Typography fontWeight={850}>{event.expectedWeightKg ?? '—'}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Actual</Typography><Typography fontWeight={850}>{event.actualWeightKg ?? '—'}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Diff</Typography><Typography fontWeight={850}>{event.differenceKg ?? '—'}</Typography></Box></Box><Typography variant="caption" color="text.secondary">Station {event.stationCode || '—'} · {event.userId || '—'} · {timeText(event.createdAt)}</Typography></Paper>)}
          {!selected.weightEvents?.length ? <Typography variant="body2" color="text.secondary">No weighing events.</Typography> : null}
        </Stack>
        <Box component="details" sx={{ mt: 1.5, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
          <Box component="summary" sx={{ cursor: 'pointer', fontWeight: 700, color: 'text.secondary' }}>
            Additional barcode / item activity ({selected.events?.length || 0} events, {selected.items?.length || 0} items)
          </Box>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>Barcode Item Assignment / Scan Events</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport paginate sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>Item</TableCell><TableCell>Status</TableCell><TableCell>Assigned SKU</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead><TableBody>{(selected.items || []).map((item) => <TableRow key={item.id}><TableCell>{item.itemNo}</TableCell><TableCell><StatusChip status={item.status} /></TableCell><TableCell>{item.expectedSku || item.scannedSku || '—'}</TableCell><TableCell>{item.scannedBy || '—'}</TableCell><TableCell>{timeText(item.scannedAt)}</TableCell></TableRow>)}{!selected.items?.length ? <TableRow><TableCell colSpan={5} align="center">No generated/scanned items.</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.items || []).map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 0.75, borderRadius: 1.4 }}><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={900}>Item {item.itemNo}</Typography><Typography variant="body2">SKU {item.expectedSku || item.scannedSku || '—'}</Typography></Box><StatusChip status={item.status} /></Stack><Typography variant="caption" color="text.secondary">{item.scannedBy || '—'} · {timeText(item.scannedAt)}</Typography></Paper>)}
          {!selected.items?.length ? <Typography variant="body2" color="text.secondary">No generated/scanned items.</Typography> : null}
        </Stack>

        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>Scan / Exception Events</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport paginate sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>Type</TableCell><TableCell>Result</TableCell><TableCell>Raw</TableCell><TableCell>Message</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead><TableBody>{(selected.events || []).map((event) => <TableRow key={event.id}><TableCell>{event.scanType || '—'}</TableCell><TableCell>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : '—'}</TableCell><TableCell>{event.rawValue || event.raw || '—'}</TableCell><TableCell>{event.message || '—'}</TableCell><TableCell>{event.actor || '—'}</TableCell><TableCell>{timeText(event.createdAt)}</TableCell></TableRow>)}{!selected.events?.length ? <TableRow><TableCell colSpan={6} align="center">No scan events.</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.events || []).map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 0.75, borderRadius: 1.4 }}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={900}>{event.scanType || 'EVENT'}</Typography>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : null}</Stack><Typography variant="body2" sx={{ mt: 0.25 }}>{event.message || '—'}</Typography><Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{event.rawValue || event.raw || '—'} · {event.actor || '—'} · {timeText(event.createdAt)}</Typography></Paper>)}
          {!selected.events?.length ? <Typography variant="body2" color="text.secondary">No scan events.</Typography> : null}
        </Stack>

          {(selected.rfidSessions || []).some((session) => session.status === 'REOPENED') && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" fontWeight={750}>RFID Re-open / Recall Audit</Typography>
              {(selected.rfidSessions || []).filter((session) => session.status === 'REOPENED').map((event) => (
                <Typography key={event.id || event.startedAt} variant="body2" color="text.secondary">
                  {timeText(event.startedAt)} · {event.startedBy || event.finishedBy || '—'} · {event.reason || 'Re-opened'}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      </Paper> : null}

        </DialogContent>
        <DialogActions><Button onClick={closeDetail}>Close</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
