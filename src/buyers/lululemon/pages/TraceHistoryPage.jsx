import { useT, useSystemMessage } from '../../../i18n/LanguageProvider';
import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, MenuItem, Paper, Stack, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography, Checkbox, FormControlLabel } from '@mui/material';
import TablePagination from 'components/LocalizedTablePagination';
import { Visibility, Refresh, Search, Close, Tune, ViewColumn } from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import { managementStackSx, managementPanelSx, managementTableViewportSx } from 'components/ManagementViewportStyles';
import { CompactPageHeader } from '../components/LululemonPageHeader';
import StatusChip from 'components/StatusChip';
import OrderScope from '../components/OrderScope';
import { getUniqueInvalidEpcRows } from '../utils/trueVueEpc';
import { listCartonHistory, listCartonHistoryFilters, getCartonHistoryDetail } from '../services/service';
import { APP_MESSAGES } from '../../../constants/appMessages';
import { WEIGHING_RESULT, ORGANIZATION_REALTIME as RT, KEYBOARD_KEY, DEFAULT_TABLE_PAGE_SIZE, BUYER_CODE } from '../../../constants/appConstants';
import { subscribeOrganizationChanges } from '../../../common/realtime/organizationSocket';
import { useSelectedFactory } from 'utils/factorySelection';

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
function Check({ status }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  return status && status !== 'PENDING'
    ? <StatusChip status={status} /> : <Chip size="small" variant="outlined" label={trUi('Pending')} />;
}

export default function TraceHistoryPage() {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [orderId, setOrderId] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [extraColumns, setExtraColumns] = useState([]);
  const [applied, setApplied] = useState(emptyFilters);
  const [options, setOptions] = useState(emptyOptions);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_TABLE_PAGE_SIZE);
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
  const currentSearch = useRef({ orderId, applied, page, rowsPerPage });
  const socketReloadRef = useRef(null);
  currentSearch.current = { orderId, applied, page, rowsPerPage };

  const load = useCallback(async (search, silent = false) => {
    if (!search.orderId) { setRows([]); setTotal(0); return; }
    const request = ++requestRef.current;
    if (!silent) setBusy(true);
    try {
      const data = await listCartonHistory(search.orderId, search.applied, search.page, search.rowsPerPage);
      if (request !== requestRef.current) return;
      const nextTotal = Math.max(0, Number(data?.totalElements || 0));
      const lastPage = Math.max(0, Math.ceil(nextTotal / search.rowsPerPage) - 1);
      // A scan may disappear from the last page while the History screen is open.
      // Refetch the last valid page rather than leaving a blank, out-of-range page.
      if (search.page > lastPage) {
        setTotal(nextTotal);
        setPage(lastPage);
        return;
      }
      setRows(data?.content || []);
      setTotal(nextTotal);
    } catch (error) {
      if (request === requestRef.current) {
        if (!silent) setRows([]);
        setNotice({ severity: 'error', text: errorText(error) });
      }
    } finally { if (request === requestRef.current) setBusy(false); }
  }, []);

  useEffect(() => { load({ orderId, applied, page, rowsPerPage }); }, [orderId, applied, page, rowsPerPage, load]);
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
      setNotice({ severity: 'error', text: trUi("Date From cannot be later than Date To.") });
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
      <MenuItem value="">{trUi("All")}</MenuItem>
      {(values || []).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
    </TextField>
  );
  const handleRowsPerPageChange = (event) => {
    const nextSize = Number(event.target.value);
    if (![10, 25, 50, 100].includes(nextSize)) return;
    setPage(0);
    setRowsPerPage(nextSize);
  };
  const totalPages = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, totalPages - 1);

  return (
    <Stack spacing={1} className="lululemon-compact-v16" sx={{
      p: { xs: 0.25, md: 0.5 },
      ...managementStackSx,
      // On phones the history is a card list, so do not constrain its height.
      flex: { xs: 'initial', md: '1 1 0%' }
    }}>
      <CompactPageHeader dense title={trUi("Carton History")}
        meta={<Chip size="small" label={trUi("{0} completed cartons", total)} />} />
      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{trSystem(notice.text)}</Alert>}
      <Paper variant="outlined" sx={{
        borderRadius: '4px', p: 1, flexShrink: 0, minWidth: 0,
        // Never clip the order selector's floating label or popup.
        // Scroll only the optional extended filter rows on short desktops.
        overflow: 'visible'
      }}>
        <OrderScope embedded compact value={orderId} onChange={chooseOrder} />
        <Box sx={{
          minWidth: 0, pt: 1.25, px: 0.25, pb: 0.5,
          maxHeight: { md: showMoreFilters ? 'min(30dvh, 290px)' : 'none' },
          overflowY: { xs: 'visible', md: showMoreFilters ? 'auto' : 'visible' },
          overflowX: 'hidden',
          '@media (max-height: 570px)': { maxHeight: 'none', overflowY: 'visible' }
        }}>
        <Stack direction="row" flexWrap="wrap" columnGap={1} rowGap={2.5} sx={{ mt: 1.25, minWidth: 0 }}>
          <TextField size="small" type="date" label={trUi("Date From (weighed)")} InputLabelProps={{ shrink: true }}
            value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} sx={{ flex: '1 1 170px', minWidth: 0 }} />
          <TextField size="small" type="date" label={trUi("Date To (weighed)")} InputLabelProps={{ shrink: true }}
            value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} sx={{ flex: '1 1 170px', minWidth: 0 }} />
          {chooser(trUi("Final Status"), 'status', ['PASS', 'FAILED'])}
          <TextField size="small" label={trUi("SSCC / SKU / Carton / PO")} value={filters.keyword}
            onChange={(e) => setFilter('keyword', e.target.value)} onKeyDown={(e) => e.key === KEYBOARD_KEY.ENTER && search()}
            sx={{ flex: '2 1 220px', minWidth: 0 }} />
        </Stack>
        {showMoreFilters && <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
          {chooser('Master PO', 'masterPo', options.masterPos)}
          {chooser('PO', 'poNumber', options.poNumbers)}
          {chooser(trUi("Packing Plan"), 'packingPlan', options.packingPlans)}
          {chooser('SO (PTS)', 'salesOrderPts', options.salesOrderPts)}
          {chooser('RFID', 'rfidStatus', ['PASS', 'FAILED'])}
          {chooser('Weight', 'weightStatus', ['PASS', 'FAILED'])}
          <TextField size="small" label={trUi("Scanned by")} value={filters.scannedBy}
            onChange={(e) => setFilter('scannedBy', e.target.value)} sx={{ flex: '1 1 160px' }} />
          <TextField size="small" label={trUi("Weighed by")} value={filters.weighedBy}
            onChange={(e) => setFilter('weighedBy', e.target.value)} sx={{ flex: '1 1 160px' }} />
        </Stack>}
        </Box>
        <Stack direction="row" justifyContent="space-between" flexWrap="wrap" useFlexGap gap={1} sx={{ mt: 1, flexShrink: 0, minWidth: 0 }}>
          <Button startIcon={<Tune />} variant="text" onClick={() => setShowMoreFilters((old) => !old)}>
            {showMoreFilters ? trUi("Show Less Filters") : trUi("Show More Filters")}
          </Button>
          <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
          <Button startIcon={<Search />} variant="contained" disabled={!orderId || busy} onClick={search}>{trUi("Search")}</Button>
          <Button startIcon={<Refresh />} variant="outlined" disabled={!orderId || busy} onClick={refresh}>{trUi("Refresh")}</Button>
          </Stack>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{
        borderRadius: '4px',
        ...managementPanelSx,
        display: { xs: 'block', md: 'flex' },
        flex: { xs: 'initial', md: '1 1 0%' },
        minHeight: { xs: 0, md: 0 },
        overflow: { xs: 'visible', md: 'hidden' },
        '@media (max-height: 570px)': { flex: '0 0 auto', minHeight: 'auto', overflow: 'visible' }
      }}>
        <Stack direction="row" justifyContent="flex-end" sx={{ p: 0.7, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Button size="small" variant="outlined" startIcon={<ViewColumn />} onClick={() => setShowColumnChooser((old) => !old)}>{trUi("Customize Columns")}</Button>
        </Stack>
        {showColumnChooser && <Stack direction="row" flexWrap="wrap" gap={1} sx={{
          px: 1, py: 0.5, flexShrink: 0,
          maxHeight: { md: 'min(120px, 16dvh)' }, overflowY: { md: 'auto' }
        }}>
          {OPTIONAL_HISTORY_COLUMNS.map((column) => <FormControlLabel key={column.key}
            control={<Checkbox size="small" checked={extraColumns.includes(column.key)}
              onChange={(e) => setExtraColumns((current) => e.target.checked ? [...current, column.key] : current.filter((key) => key !== column.key))} />}
            label={trUi(column.label)} />)}
        </Stack>}
        <Box sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column', flex: '1 1 0%', minHeight: 0, minWidth: 0
        }}>
        <LululemonTableViewport fillAvailableHeight sx={{ border: 0, ...managementTableViewportSx }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow>
              {['Factory', 'Order', 'Master PO', 'PO', 'Packing Plan', 'SO (PTS)', 'SSCC-18', 'SKU',
                'RFID', 'Weight', 'Status', ...OPTIONAL_HISTORY_COLUMNS.filter((column) => extraColumns.includes(column.key)).map((column) => column.label)].map((column) => <TableCell key={column}>{trUi(column)}</TableCell>)}
              <TableCell data-sortable={false}>{trUi("Detail")}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {rows.map((row) => <TableRow key={row.cartonId} hover>
                <TableCell>{row.factoryCode || '—'}</TableCell>
                <TableCell>{row.orderName || '—'}</TableCell>
                <TableCell>{row.masterPo || '—'}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{row.poNumber || '—'}</TableCell>
                <TableCell>{row.packingPlan || '—'}</TableCell>
                <TableCell>{row.salesOrderPts || '—'}</TableCell>
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
                  <Tooltip title={trUi("View full Scan / RFID / Weight history")}>
                    <IconButton aria-label={trUi("View history of carton {0}", row.cartonNo)} color="primary"
                      disabled={detailBusy} size="small" onClick={() => openDetail(row)}><Visibility /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>)}
              {!rows.length && <TableRow><TableCell colSpan={12 + extraColumns.length} align="center" sx={{ py: 4 }}>
                {busy ? trUi("Loading history…") : trUi("No completed RFID + Weight cartons match these filters.")}
              </TableCell></TableRow>}
            </TableBody>
          </SortableTable>
        </LululemonTableViewport>
        </Box>
        <Stack spacing={0.8} sx={{ display: { xs: 'flex', md: 'none' }, p: 1 }}>
          {rows.map((row) => <Paper key={row.cartonId} variant="outlined" sx={{ p: 1, borderRadius: '4px' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography fontWeight={800}>{row.orderName || '—'}{trUi(" · PO ")}{row.poNumber || '—'}</Typography>
              <Tooltip title={trUi("View carton history")}><IconButton color="primary" aria-label={trUi("View history")}
                onClick={() => openDetail(row)}><Visibility /></IconButton></Tooltip>
            </Stack>
            <Typography variant="body2">{trUi("Factory ")}{row.factoryCode || '—'}{trUi(" · Carton ")}{row.cartonNo ?? '—'}{trUi(" · SKU ")}{row.sku || '—'}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{trUi("SSCC-18: ")}{row.sscc18 || '—'}</Typography>
            <Typography variant="caption" color="text.secondary">{trUi("Master PO: ")}{row.masterPo || '—'}{trUi(" · Packing Plan: ")}{row.packingPlan || '—'}{trUi(" · SO (PTS): ")}{row.salesOrderPts || '—'}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.8 }}>
              <Check status={row.rfidStatus} /><Check status={displayWeightResult(row.weightStatus)} /><Check status={row.status} />
            </Stack>
            {extraColumns.includes('scannedBy') && <Typography variant="caption" sx={{ display: 'block' }}>{trUi("Scanned: ")}{row.scannedBy || '—'}</Typography>}
            {extraColumns.includes('scanTime') && <Typography variant="caption" sx={{ display: 'block' }}>{trUi("Scan Time: ")}{timeText(row.scanTime)}</Typography>}
            {extraColumns.includes('weighedBy') && <Typography variant="caption" sx={{ display: 'block' }}>{trUi("Weighed: ")}{row.weighedBy || '—'}</Typography>}
            {extraColumns.includes('weightTime') && <Typography variant="caption" sx={{ display: 'block' }}>{trUi("Weight Time: ")}{timeText(row.weightTime)}</Typography>}
          </Paper>)}
          {!rows.length && <Typography variant="body2" align="center" color="text.secondary" sx={{ py: 3 }}>
            {busy ? trUi("Loading history…") : trUi("No completed RFID + Weight cartons match these filters.")}
          </Typography>}
        </Stack>
        {/* Match User Management. The API supplies one page; never paginate the current rows again. */}
        <TablePagination
          component="div"
          count={total}
          page={safePage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_, nextPage) => { if (!busy && orderId) setPage(nextPage); }}
          onRowsPerPageChange={handleRowsPerPageChange}
          labelRowsPerPage="Rows per page:"
          sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Paper>
      <Dialog open={Boolean(selectedRow)} onClose={closeDetail} fullWidth maxWidth="xl" scroll="paper">
        <DialogTitle sx={{ pb: 0.6 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={800}>{trUi("Carton Detail")}</Typography>
            <IconButton aria-label={trUi("Close detail")} onClick={closeDetail}><Close /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedRow && <Paper variant="outlined" sx={{ p: 1, mb: 1, borderRadius: '4px' }}>
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
              <Typography variant="body2">{trUi("RFID: ")}<Check status={selectedRow.rfidStatus} /></Typography>
              <Typography variant="body2">{trUi("Weight: ")}<Check status={displayWeightResult(selectedRow.weightStatus)} /></Typography>
              <Typography variant="body2">{trUi("Final: ")}<Check status={selectedRow.status} /></Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>{trUi("\n              SSCC scanned by: ")}{selected?.carton?.ssccAssignedBy || '—'} · {timeText(selected?.carton?.ssccAssignedAt)}
              {' · '}{trUi(" SKU/Qty confirmed by: ")}{selected?.carton?.qtyConfirmedBy || '—'} · {timeText(selected?.carton?.qtyConfirmedAt)}
            </Typography>
          </Paper>}
          {detailBusy && <Typography color="text.secondary">{trUi("Loading detailed history…")}</Typography>}
      {selected ? <Paper variant="outlined" sx={{ p: 0.9, borderRadius: '4px' }}>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 0.5 }}>{trUi("RFID Scan History")}</Typography>
        <LululemonTableViewport pageScroll={false} paginate sx={{ maxHeight: 300 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow><TableCell>{trUi("Start time")}</TableCell><TableCell>{trUi("End time")}</TableCell><TableCell>{trUi("Status")}</TableCell><TableCell>{trUi("Expected / Unique EPC")}</TableCell><TableCell>{trUi("Total reads")}</TableCell><TableCell>{trUi("Reason / Invalid EPC")}</TableCell><TableCell>{trUi("Station")}</TableCell><TableCell>{trUi("User")}</TableCell></TableRow></TableHead>
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
                    <Box component="summary" sx={{ color: 'primary.main', cursor: 'pointer' }}>{trUi("View ")}{session.epcs.length}{trUi(" EPCs")}</Box>
                    <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{session.epcs.join('\n')}</Typography>
                  </Box> : null}</TableCell>
                <TableCell>{session.finishedBy || session.startedBy || '—'}</TableCell>
              </TableRow>)}
              {!(selected.rfidSessions || []).some(isActualRfidScan) && <TableRow><TableCell colSpan={8} align="center">{trUi("No RFID scan attempts saved for this carton.")}</TableCell></TableRow>}
            </TableBody>
          </SortableTable>
        </LululemonTableViewport>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>{trUi("Weight Check History")}</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport pageScroll={false} paginate sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>{trUi("Action")}</TableCell><TableCell>{trUi("Result")}</TableCell><TableCell>{trUi("Expected kg")}</TableCell><TableCell>{trUi("Actual kg")}</TableCell><TableCell>{trUi("Difference kg")}</TableCell><TableCell>{trUi("Tolerance kg")}</TableCell><TableCell>{trUi("Station")}</TableCell><TableCell>{trUi("Source")}</TableCell><TableCell>{trUi("User")}</TableCell><TableCell>{trUi("Time")}</TableCell></TableRow></TableHead><TableBody>{(selected.weightEvents || []).map((event) => <TableRow key={event.id}><TableCell>{event.action || '—'}</TableCell><TableCell>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : '—'}</TableCell><TableCell>{event.expectedWeightKg ?? '—'}</TableCell><TableCell>{event.actualWeightKg ?? '—'}</TableCell><TableCell>{event.differenceKg ?? '—'}</TableCell><TableCell>{event.toleranceKg ?? '—'}</TableCell><TableCell>{event.stationCode || '—'}</TableCell><TableCell>{event.source || '—'}</TableCell><TableCell>{event.userId || '—'}</TableCell><TableCell>{timeText(event.createdAt)}</TableCell></TableRow>)}{!selected.weightEvents?.length ? <TableRow><TableCell colSpan={10} align="center">{trUi("No weighing events.")}</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.weightEvents || []).map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 0.75, borderRadius: '4px' }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={900}>{event.action || 'WEIGHT'}</Typography>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : null}</Stack><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0.5, mt: 0.5 }}><Box><Typography variant="caption" color="text.secondary">{trUi("Expected")}</Typography><Typography fontWeight={850}>{event.expectedWeightKg ?? '—'}</Typography></Box><Box><Typography variant="caption" color="text.secondary">{trUi("Actual")}</Typography><Typography fontWeight={850}>{event.actualWeightKg ?? '—'}</Typography></Box><Box><Typography variant="caption" color="text.secondary">{trUi("Diff")}</Typography><Typography fontWeight={850}>{event.differenceKg ?? '—'}</Typography></Box></Box><Typography variant="caption" color="text.secondary">{trUi("Station ")}{event.stationCode || '—'} · {event.userId || '—'} · {timeText(event.createdAt)}</Typography></Paper>)}
          {!selected.weightEvents?.length ? <Typography variant="body2" color="text.secondary">{trUi("No weighing events.")}</Typography> : null}
        </Stack>
        <Box component="details" sx={{ mt: 1.5, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: '4px' }}>
          <Box component="summary" sx={{ cursor: 'pointer', fontWeight: 700, color: 'text.secondary' }}>{trUi("\n            Additional barcode / item activity (")}{selected.events?.length || 0}{trUi(" events, ")}{selected.items?.length || 0}{trUi(" items)\n          ")}</Box>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>{trUi("Barcode Item Assignment / Scan Events")}</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport pageScroll={false} paginate sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>{trUi("Item")}</TableCell><TableCell>{trUi("Status")}</TableCell><TableCell>{trUi("Assigned SKU")}</TableCell><TableCell>{trUi("User")}</TableCell><TableCell>{trUi("Time")}</TableCell></TableRow></TableHead><TableBody>{(selected.items || []).map((item) => <TableRow key={item.id}><TableCell>{item.itemNo}</TableCell><TableCell><StatusChip status={item.status} /></TableCell><TableCell>{item.expectedSku || item.scannedSku || '—'}</TableCell><TableCell>{item.scannedBy || '—'}</TableCell><TableCell>{timeText(item.scannedAt)}</TableCell></TableRow>)}{!selected.items?.length ? <TableRow><TableCell colSpan={5} align="center">{trUi("No generated/scanned items.")}</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.items || []).map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 0.75, borderRadius: '4px' }}><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={900}>{trUi("Item ")}{item.itemNo}</Typography><Typography variant="body2">SKU {item.expectedSku || item.scannedSku || '—'}</Typography></Box><StatusChip status={item.status} /></Stack><Typography variant="caption" color="text.secondary">{item.scannedBy || '—'} · {timeText(item.scannedAt)}</Typography></Paper>)}
          {!selected.items?.length ? <Typography variant="body2" color="text.secondary">{trUi("No generated/scanned items.")}</Typography> : null}
        </Stack>

        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>{trUi("Scan / Exception Events")}</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport pageScroll={false} paginate sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>{trUi("Type")}</TableCell><TableCell>{trUi("Result")}</TableCell><TableCell>{trUi("Raw")}</TableCell><TableCell>{trUi("Message")}</TableCell><TableCell>{trUi("User")}</TableCell><TableCell>{trUi("Time")}</TableCell></TableRow></TableHead><TableBody>{(selected.events || []).map((event) => <TableRow key={event.id}><TableCell>{event.scanType || '—'}</TableCell><TableCell>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : '—'}</TableCell><TableCell>{event.rawValue || event.raw || '—'}</TableCell><TableCell>{event.message || '—'}</TableCell><TableCell>{event.actor || '—'}</TableCell><TableCell>{timeText(event.createdAt)}</TableCell></TableRow>)}{!selected.events?.length ? <TableRow><TableCell colSpan={6} align="center">{trUi("No scan events.")}</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.events || []).map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 0.75, borderRadius: '4px' }}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={900}>{event.scanType || 'EVENT'}</Typography>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : null}</Stack><Typography variant="body2" sx={{ mt: 0.25 }}>{event.message || '—'}</Typography><Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{event.rawValue || event.raw || '—'} · {event.actor || '—'} · {timeText(event.createdAt)}</Typography></Paper>)}
          {!selected.events?.length ? <Typography variant="body2" color="text.secondary">{trUi("No scan events.")}</Typography> : null}
        </Stack>

          {(selected.rfidSessions || []).some((session) => session.status === 'REOPENED') && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2" fontWeight={750}>{trUi("RFID Re-open / Recall Audit")}</Typography>
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
        <DialogActions><Button onClick={closeDetail}>{trUi("Close")}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
