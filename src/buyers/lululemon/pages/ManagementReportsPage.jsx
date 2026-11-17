import { useT, useSystemMessage } from '../../../i18n/LanguageProvider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import TablePagination from 'components/LocalizedTablePagination';
import {
  CalendarMonthOutlined, Close, DownloadOutlined, FactoryOutlined, FileDownloadOutlined,
  Inventory2Outlined, ManageSearchOutlined, Refresh, SearchOutlined, SummarizeOutlined,
  TaskAltOutlined, VisibilityOutlined
} from '@mui/icons-material';
import { getManagementReport, getManagementPoDetail, exportManagementReport, exportManagementPo, getManagementCartonHistory, getManagementDashboardOptions } from '../services/managementReports';
import { canExportManagementReports } from 'utils/accessControl';

const today = new Date();
const dateStr = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const INITIAL = { from: dateStr(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateStr(today), factory: '', shippingDate: '', orderId: '', status: '' };
// Allow chart clicks on Dashboard to open a pre-filtered report.
const initialFromLocation = (search) => {
  const query = new URLSearchParams(search || '');
  const candidate = { ...INITIAL };
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const key of ['from', 'to']) {
    const value = query.get(key);
    if (value && iso.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))) candidate[key] = value;
  }
  if (candidate.from > candidate.to) return { ...INITIAL };
  const maxTo = new Date(`${candidate.from}T00:00:00Z`);
  maxTo.setUTCFullYear(maxTo.getUTCFullYear() + 1);
  if (Date.parse(`${candidate.to}T00:00:00Z`) > maxTo.getTime()) return { ...INITIAL };
  for (const key of ['factory', 'shippingDate', 'orderId']) {
    const value = query.get(key);
    if (value && value.length <= 128) candidate[key] = value;
  }
  const status = query.get('status');
  if (['COMPLETED', 'IN_PROGRESS', 'ISSUES'].includes(status)) candidate.status = status;
  return candidate;
};
const format = (value) => Number(value || 0).toLocaleString('en-US');
const displayDate = (value) => { const s = String(value || ''); return /^\d{4}-\d\d-\d\d$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : (s || '—'); };
const errorText = (e) => e?.response?.data?.message || e?.response?.data?.detail || e?.message || 'Unable to load report.';
/** The export API returns a Blob even for JSON error responses (axios responseType: 'blob').
 * Decode the error JSON so managers see the server's real validation message.
 */
const exportErrorText = async (error) => {
  const body = error?.response?.data;
  if (body && typeof body.text === 'function') {
    try {
      const raw = await body.text();
      if (raw) {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        if (parsed) return parsed.message || parsed.detail || parsed.error || errorText(error);
        return raw.slice(0, 300);
      }
    } catch { /* Fall back to the generic network error. */ }
  }
  return errorText(error);
};
const ratio = (pass, total) => !total ? 0 : Math.min(100, Math.round((Number(pass || 0) / total) * 100));
const cardSx = { borderColor: '#dbe5eb', borderRadius: '6px', boxShadow: 'none' };
const canExport = canExportManagementReports;
const statusColor = (value) => ({ PASS: 'success', COMPLETED: 'success', SUBMITTED: 'info', FAILED: 'error', ISSUES: 'error', REOPENED: 'warning' }[value] || 'default');

function Status({ value, fallback = 'PENDING' }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  return <Chip size="small" color={statusColor(value)} variant="outlined" label={trUi(value || fallback)} sx={{ fontWeight: 700, height: 23 }} />;
}
function Kpi({ label, value, icon: Icon, note }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  return <Card variant="outlined" sx={{ ...cardSx, minWidth: 0, height: '100%' }}><CardContent sx={{ p: 1.6, '&:last-child': { pb: 1.6 } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="caption" color="text.secondary" fontWeight={650}>{trUi(label)}</Typography><Icon sx={{ color: '#4a93a5', fontSize: 19 }} /></Stack>
    <Typography sx={{ fontSize: 25, fontWeight: 900, color: '#183a53', fontVariantNumeric: 'tabular-nums' }}>{format(value)}</Typography>
    {note ? <Typography variant="caption" color="text.secondary">{note}</Typography> : null}
  </CardContent></Card>;
}
function TableEmpty({ columns, message = 'No matching data' }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  return <TableRow><TableCell colSpan={columns} align="center" sx={{ py: 5, color: 'text.secondary' }}>{trUi(message)}</TableCell></TableRow>;
}
function SectionTitle({ children, caption }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  return <Stack mb={1}><Typography fontWeight={850} color="#183a53">{children}</Typography>{caption ? <Typography variant="caption" color="text.secondary">{trUi(caption)}</Typography> : null}</Stack>;
}

function PoDetailsDialog({ row, filters, onClose }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedCarton, setSelectedCarton] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [exportingPo, setExportingPo] = useState(false);
  const exportPo = async () => {
    if (!row || exportingPo || !canExport()) return;
    setExportingPo(true); setError('');
    try {
      const response = await exportManagementPo(row.poId, { ...filters, shippingDate: row.shippingDate });
      const href = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = href;
      anchor.download = `PO_${String(row.poNumber || row.poId).replace(/[^A-Za-z0-9_-]/g, '_')}_Carton_Details_${row.shippingDate}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) { setError(await exportErrorText(e)); }
    finally { setExportingPo(false); }
  };
  useEffect(() => { setPage(0); setData(null); setSelectedCarton(null); setHistory(null); setDetailTab(0); }, [row?.poId, row?.shippingDate]);
  useEffect(() => {
    if (!row) return undefined;
    let active = true;
    setBusy(true); setError('');
    // Use exactly the applied report scope, not unsaved filter edits.
    getManagementPoDetail(row.poId, { ...filters, shippingDate: row.shippingDate }, page, size)
      .then((value) => { if (active) setData(value); })
      .catch((e) => { if (active) setError(errorText(e)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [row?.poId, row?.shippingDate, filters, page, size]);
  const openCarton = async (carton) => {
    setSelectedCarton(carton); setHistory(null); setHistoryBusy(true); setDetailTab(0);
    try { setHistory(await getManagementCartonHistory(row.poId, carton.cartonId, { ...filters, shippingDate: row.shippingDate })); }
    catch (e) { setHistory({ loadError: errorText(e) }); }
    finally { setHistoryBusy(false); }
  };
  return <Dialog
    open={Boolean(row)}
    onClose={onClose}
    aria-labelledby="management-po-dialog-title"
    scroll="paper"
    maxWidth={false}
    PaperProps={{
      sx: {
        width: { xs: 'calc(100vw - 16px)', sm: 'min(1120px, calc(100vw - 48px))' },
        maxWidth: 'none',
        height: { xs: 'calc(100dvh - 16px)', sm: 'min(88vh, 900px)' },
        maxHeight: 'calc(100dvh - 16px)',
        m: { xs: 1, sm: 2 },
        borderRadius: { xs: 1.5, sm: 2.5 },
        bgcolor: '#f7fafc',
        overflow: 'hidden'
      }
    }}
  >
    {row ? <Stack sx={{ height: '100%', minHeight: 0, minWidth: 0 }}>
      <Paper square elevation={0} sx={{ px: { xs: 1.5, sm: 2.5 }, py: 2, borderBottom: '1px solid #dbe5eb', flexShrink: 0 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
          <Box sx={{ minWidth: 0 }}><Typography id="management-po-dialog-title" fontSize={19} fontWeight={900} color="#183a53">{trUi("PO Details · ")}{row.poNumber || row.poId}</Typography>
            <Typography variant="caption" color="text.secondary">{row.orderName} · {row.factoryCode}{trUi(" · Shipping ")}{displayDate(row.shippingDate)}{trUi(" · Read only")}</Typography></Box>
          <Stack direction="row" gap={1} alignItems="center" flexShrink={0}>
            {canExport() && <Button onClick={exportPo} disabled={exportingPo} startIcon={<DownloadOutlined/>} size="small" variant="outlined">{trUi("Export Carton Details")}</Button>}
            <Button onClick={onClose} startIcon={<Close />} size="small" color="inherit">{trUi("Close")}</Button>
          </Stack>
        </Stack>
      </Paper>
      <Box sx={{ overflowY: 'auto', overflowX: 'hidden', p: { xs: 1.25, md: 2 }, flex: 1, minHeight: 0, minWidth: 0 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{trSystem(error)}</Alert>}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, ...cardSx }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' }, gap: 2 }}>
            {[
              ['Order', row.orderName], ['Factory', row.factoryCode], ['Shipping Date', displayDate(row.shippingDate)],
              ['Shipping Status', row.shippingStatus], ['Master PO', row.masterPo], ['Style', row.style],
              ['SKU', row.sku], ['Destination', row.destination], ['Channel', row.channel], ['DC Code', row.dcCode]
            ].map(([name, value]) => <Box key={name} sx={{ minWidth: 0 }}><Typography variant="caption" color="text.secondary">{trUi(name)}</Typography><Typography fontSize={13} fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{value || '—'}</Typography></Box>)}
          </Box>
          <Divider sx={{ my: 2 }}/>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            {[['Planned CTN', row.plannedCartons], ['RFID PASS', row.rfidPass], ['RFID FAILED', row.rfidFailed], ['Weight PASS', row.weightPass], ['Weight FAILED', row.weightFailed], ['Final PASS', row.finalPass], ['Final FAILED', row.finalFailed], ['Pending', row.pending]].map(([name, value]) =>
              <Box key={name} sx={{ minWidth: 86 }}><Typography variant="caption" color="text.secondary">{trUi(name)}</Typography><Typography fontWeight={850}>{format(value)}</Typography></Box>)}
          </Stack>
          <Box sx={{ mt: 1.5, height: 8, borderRadius: 10, bgcolor: '#e4edf0', overflow: 'hidden' }}><Box sx={{ width: `${ratio(row.finalPass, row.plannedCartons)}%`, height: '100%', bgcolor: '#168c78' }}/></Box>
          <Typography variant="caption" color="text.secondary">{trUi("Final PASS / Planned cartons · ")}{ratio(row.finalPass, row.plannedCartons)}%</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, ...cardSx }}>
          <SectionTitle caption={trUi('Click a carton to inspect its saved RFID/Weight attempts and activity history.')}>{trUi("Carton Details")}</SectionTitle>
          <TableContainer sx={{ maxHeight: 440 }}><Table stickyHeader size="small">
            <TableHead><TableRow>{['Carton', 'SSCC-18', 'Qty', 'RFID', 'Weight', 'Final', 'Actual (kg)', 'Actions'].map(label => <TableCell key={label} sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{trUi(label)}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {busy ? <TableEmpty columns={8} message={trUi('Loading cartons...')}/> : (data?.cartons || []).map((c) => <TableRow hover key={c.cartonId} selected={selectedCarton?.cartonId === c.cartonId}>
                <TableCell>{c.cartonNo ?? '—'}</TableCell><TableCell>{c.sscc18 || '—'}</TableCell><TableCell>{c.plannedQty ?? '—'}</TableCell>
                <TableCell><Status value={c.rfidStatus}/></TableCell><TableCell><Status value={c.weightStatus}/></TableCell><TableCell><Status value={c.finalStatus}/></TableCell>
                <TableCell>{c.actualWeightKg || '—'}</TableCell><TableCell><Button size="small" onClick={() => openCarton(c)} startIcon={<VisibilityOutlined fontSize="small"/>}>{trUi("History")}</Button></TableCell>
              </TableRow>)}
              {!busy && !data?.cartons?.length && <TableEmpty columns={8} message={trUi('No generated cartons for this PO.')}/>}
            </TableBody>
          </Table></TableContainer>
          <TablePagination component="div" count={data?.totalCartons ?? 0} page={page} rowsPerPage={size} rowsPerPageOptions={[10,25,50,100]}
            onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}/>
        </Paper>
        {selectedCarton && <Paper variant="outlined" sx={{ p: 1.75, ...cardSx }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography fontWeight={900} color="#183a53">{trUi("Carton ")}{selectedCarton.cartonNo} · {selectedCarton.sscc18 || 'No SSCC'}</Typography>
            <Button color="inherit" size="small" onClick={() => { setSelectedCarton(null); setHistory(null); }}>{trUi("Hide")}</Button>
          </Stack>
          <Tabs value={detailTab} onChange={(_, value) => setDetailTab(value)} sx={{ mb: 1 }}><Tab label={trUi("RFID Attempts")}/><Tab label={trUi("Weight Events")}/><Tab label={trUi("Other Activity")}/></Tabs>
          {historyBusy ? <Box p={3} textAlign="center"><CircularProgress size={24}/></Box> : history?.loadError ? <Alert severity="warning">{history.loadError}</Alert> :
            <TableContainer sx={{ maxHeight: 280 }}><Table stickyHeader size="small"><TableBody>
              {detailTab === 0 && (history?.rfidSessions || []).map((session, idx) => <TableRow key={session.id || idx}><TableCell>{session.status || '—'}</TableCell><TableCell>{session.result || session.verificationResult || '—'}</TableCell><TableCell>{session.startedAt || session.finishedAt || '—'}</TableCell><TableCell>{session.reason || '—'}</TableCell></TableRow>)}
              {detailTab === 1 && (history?.weightEvents || []).map((item, idx) => <TableRow key={item.id || idx}><TableCell>{item.action || 'WEIGHT'}</TableCell><TableCell>{item.result || '—'}</TableCell><TableCell>{item.actualWeightKg ?? '—'} kg</TableCell><TableCell>{item.userId || '—'}</TableCell><TableCell>{item.createdAt || '—'}</TableCell></TableRow>)}
              {detailTab === 2 && (history?.events || []).map((item, idx) => <TableRow key={item.id || idx}><TableCell>{item.scanType || 'ACTIVITY'}</TableCell><TableCell>{item.result || '—'}</TableCell><TableCell>{item.message || '—'}</TableCell><TableCell>{item.createdAt || '—'}</TableCell></TableRow>)}
              {!((detailTab === 0 ? history?.rfidSessions : detailTab === 1 ? history?.weightEvents : history?.events) || []).length && <TableEmpty columns={5} message={trUi('No saved history for this carton.')}/>}
            </TableBody></Table></TableContainer>}
        </Paper>}
      </Box>
    </Stack> : null}
  </Dialog>;
}

export default function ManagementReportsPage() {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const location = useLocation();
  const [draft, setDraft] = useState(() => initialFromLocation(location.search));
  const [applied, setApplied] = useState(() => initialFromLocation(location.search));
  useEffect(() => {
    if (!location.search) return;
    const next = initialFromLocation(location.search);
    setDraft(next);
    setApplied(next);
  }, [location.search]);
  const [report, setReport] = useState(null);
  const [options, setOptions] = useState({ factories: [], shippingDates: [], orders: [] });
  const [groupBy, setGroupBy] = useState('po');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [selectedPo, setSelectedPo] = useState(null);

  const valid = Boolean(draft.from && draft.to && draft.from <= draft.to
    && Number.isFinite(new Date(`${draft.from}T00:00:00`).getTime())
    && new Date(`${draft.to}T00:00:00`) <= new Date(new Date(`${draft.from}T00:00:00`).setFullYear(Number(draft.from.slice(0, 4)) + 1)));

  const update = (key, value) => setDraft((previous) => ({
    ...previous, [key]: value,
    ...(['factory', 'from', 'to'].includes(key) ? { orderId: '', shippingDate: '' } : {}),
    ...(key === 'orderId' ? { shippingDate: '' } : {})
  }));

  const reload = useCallback(async (filters, nextPage, nextSize) => {
    setBusy(true); setError('');
    try {
      const result = await getManagementReport(filters, nextPage, nextSize);
      setReport(result);
    } catch (e) { setReport(null); setError(errorText(e)); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { reload(applied, page, size); }, [applied, page, size, reload]);
  // Share the same dependent Factory -> Order -> Shipping options as Dashboard.
  // The lightweight endpoint applies the report permission even for ADMIN.
  useEffect(() => {
    if (!valid) { setOptions({ factories: [], shippingDates: [], orders: [] }); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      getManagementDashboardOptions({ from: draft.from, to: draft.to, factory: draft.factory, orderId: draft.orderId })
        .then((value) => { if (alive) setOptions(value || { factories: [], shippingDates: [], orders: [] }); })
        .catch(() => { if (alive) setOptions({ factories: [], shippingDates: [], orders: [] }); });
    }, 200);
    return () => { alive = false; clearTimeout(timer); };
  }, [valid, draft.from, draft.to, draft.factory, draft.orderId]);

  const apply = (event) => {
    event?.preventDefault();
    if (!valid) return;
    setPage(0);
    setSelectedPo(null);
    setApplied({ ...draft });
  };
  const reset = () => {
    setDraft(INITIAL);
    setPage(0);
    setSelectedPo(null);
    setApplied({ ...INITIAL });
  };
  const doExport = async () => {
    if (!canExport() || exporting) return;
    setExporting(true); setError('');
    try {
      const response = await exportManagementReport(applied);
      const href = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `Shipping_Order_Report_${applied.from.replaceAll('-', '')}_${applied.to.replaceAll('-', '')}.xlsx`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (e) { setError(await exportErrorText(e)); }
    finally { setExporting(false); }
  };

  const totals = report?.totals || {};
  const rows = report?.pos || [];
  const filtersSummary = useMemo(() => [
    `${displayDate(applied.from)} – ${displayDate(applied.to)}`,
    applied.factory || 'All Factories',
    applied.orderId ? (options.orders || []).find(o => o.orderId === applied.orderId)?.orderName || applied.orderId : 'All Orders',
    applied.shippingDate ? displayDate(applied.shippingDate) : 'All Shipping'
  ].join(' · '), [applied, options.orders]);
  const optionsFor = (key) => key === 'orderId'
    ? (options.orders || []).map(item => ({ value: item.orderId, label: item.orderName }))
    : key === 'factory'
      ? (options.factories || []).map(value => ({ value, label: value }))
      : (options.shippingDates || []).map(value => ({ value, label: displayDate(value) }));
  const combo = (name, key, labelAll) => <FormControl fullWidth size="small">
    <InputLabel>{trUi(name)}</InputLabel>
    <Select label={trUi(name)} value={draft[key]} onChange={(event) => update(key, event.target.value)}>
      <MenuItem value="">{trUi(labelAll)}</MenuItem>
      {optionsFor(key).map(item => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
    </Select>
  </FormControl>;

  // A summary row is a navigation shortcut: it applies its scope, then opens the same PO table.
  // Keep the change explicit in both draft and applied filters, so Export uses exactly the visible scope.
  const viewFactoryPos = (factoryCode) => {
    const next = { ...applied, factory: factoryCode, shippingDate: '', orderId: '' };
    setDraft(next); setApplied(next); setPage(0); setSelectedPo(null); setGroupBy('po');
  };
  const viewShippingPos = (item) => {
    const next = { ...applied, factory: item.factoryCode, shippingDate: item.shippingDate, orderId: item.orderId || '' };
    setDraft(next); setApplied(next); setPage(0); setSelectedPo(null); setGroupBy('po');
  };

  const headerCellSx = { fontWeight: 800, whiteSpace: 'nowrap', fontSize: 12, bgcolor: '#f7fafc', color: '#36546b' };
  const tableCellSx = { whiteSpace: 'nowrap', fontSize: 12.5 };

  return <Stack gap={1.75} sx={{ p: { xs: 1, md: 1.5 }, pb: 4, minWidth: 0 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1}>
      <Box>
        <Typography fontSize={22} fontWeight={900} color="#183a53">{trUi("Reports")}</Typography>
        <Typography variant="caption" color="text.secondary">{trUi("LULULEMON · Shipping & Order Performance")}</Typography>
      </Box>
      <Stack direction="row" gap={1} alignItems="center">
        <Button variant="outlined" color="inherit" size="small" startIcon={<Refresh/>} disabled={busy} onClick={() => reload(applied, page, size)}>{trUi("Refresh")}</Button>
        {canExport() && <Button variant="contained" size="small" startIcon={exporting ? <CircularProgress size={15} color="inherit"/> : <FileDownloadOutlined/>} disabled={exporting || busy || !report} onClick={doExport}>{trUi("Export Excel")}</Button>}
      </Stack>
    </Stack>

    <Paper variant="outlined" component="form" onSubmit={apply} sx={{ ...cardSx, px: { xs: 1.5, md: 2 }, py: 1.75 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={1.75}>
        <ManageSearchOutlined color="primary" fontSize="small" />
        <Typography fontWeight={850} color="#183a53">{trUi("Report Filters")}</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))', md: 'repeat(3,minmax(0,1fr))', lg: 'repeat(6,minmax(0,1fr))' }, columnGap: 1.25, rowGap: 2.5, alignItems: 'start' }}>
        <TextField fullWidth size="small" type="date" label={trUi("Date From")} value={draft.from} onChange={(event) => update('from', event.target.value)} InputLabelProps={{ shrink: true }} required error={!valid}/>
        <TextField fullWidth size="small" type="date" label={trUi("Date To")} value={draft.to} onChange={(event) => update('to', event.target.value)} InputLabelProps={{ shrink: true }} required error={!valid}/>
        {combo('Factory', 'factory', trUi("All Factories"))}
        {combo('Order', 'orderId', trUi("All Orders"))}
        {combo('Shipping', 'shippingDate', trUi("All Shipping Dates"))}
        <FormControl fullWidth size="small">
          <InputLabel>{trUi("Status")}</InputLabel>
          <Select value={draft.status} label={trUi("Status")} onChange={(event) => update('status', event.target.value)}>
            <MenuItem value="">{trUi("All Status")}</MenuItem>
            {['COMPLETED', 'IN_PROGRESS', 'ISSUES'].map(value => <MenuItem key={value} value={value}>{trUi(value)}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1} mt={1.25}>
        {!valid ? <Typography variant="caption" color="error">{trUi("Invalid date range.")}</Typography> : <Box />}
        <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ flexShrink: 0 }}>
          <Button type="button" variant="text" color="inherit" onClick={reset}>{trUi("Reset")}</Button>
          <Button type="submit" variant="contained" disabled={!valid || busy} startIcon={<SearchOutlined/>} sx={{ px: 2.25 }}>{trUi("Apply Filters")}</Button>
        </Stack>
      </Stack>
    </Paper>

    {error && <Alert severity="error" onClose={() => setError('')}>{trSystem(error)}</Alert>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', sm: 'repeat(3,minmax(0,1fr))', xl: 'repeat(6,minmax(0,1fr))' }, gap: 1 }}>
      <Kpi label={trUi("Orders")} value={totals.orders} icon={SummarizeOutlined}/>
      <Kpi label={trUi("Factories")} value={totals.factories} icon={FactoryOutlined}/>
      <Kpi label={trUi("Shipping Days")} value={totals.shippingDays} icon={CalendarMonthOutlined}/>
      <Kpi label={trUi("PO Assignments")} value={totals.poAssignments} icon={ManageSearchOutlined} note={`${format(totals.uniquePos)} unique PO`}/>
      <Kpi label={trUi("Planned Cartons")} value={totals.plannedCartons} icon={Inventory2Outlined}/>
      <Kpi label={trUi("Final PASS")} value={totals.finalPass} icon={TaskAltOutlined} note={`${ratio(totals.finalPass, totals.plannedCartons)}% planned`}/>
    </Box>

    <Paper variant="outlined" sx={{ ...cardSx, px: 2, py: 1.25 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0, flexWrap: 'wrap' }}>
          <Typography fontSize={12} fontWeight={800} color="#36546b">{trUi("Carton Progress")}</Typography>
          <Typography fontSize={12} color="text.secondary">{trUi("Final PASS ")}{format(totals.finalPass)} / {format(totals.plannedCartons)} ({ratio(totals.finalPass, totals.plannedCartons)}%)</Typography>
          <Box sx={{ height: 7, bgcolor: '#e9f0f2', width: { xs: '100%', sm: 150, md: 210 }, maxWidth: '100%', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${ratio(totals.finalPass, totals.plannedCartons)}%`, bgcolor: '#159f93' }}/>
          </Box>
        </Stack>
        <Stack direction="row" gap={2.5} flexWrap="wrap">
          <Typography variant="caption" color="error.main" fontWeight={700}>{trUi("Final FAILED: ")}{format(totals.finalFailed)}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{trUi("Pending: ")}{format(totals.pending)}</Typography>
        </Stack>
      </Stack>
    </Paper>

    <Paper variant="outlined" sx={{ ...cardSx, overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.25} px={2} py={1.75}>
        <Box>
          <Typography color="#183a53" fontWeight={850}>{trUi("Shipping & Order Report")}</Typography>
          <Typography variant="caption" color="text.secondary">{filtersSummary}</Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 210 } }}>
          <InputLabel>{trUi("Group By")}</InputLabel>
          <Select label={trUi("Group By")} value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
            <MenuItem value="po">{trUi("Orders & PO")}</MenuItem>
            <MenuItem value="shipping">{trUi("Shipping Date")}</MenuItem>
            <MenuItem value="factory">{trUi("Factory")}</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Divider/>
      {busy && <Stack direction="row" alignItems="center" gap={1} px={2} py={1}><CircularProgress size={16}/><Typography variant="caption">{trUi("Loading report...")}</Typography></Stack>}

      {groupBy === 'factory' && <TableContainer sx={{ maxHeight: 600 }}>
        <Table size="small" stickyHeader>
          <TableHead><TableRow>{['Factory','PO Assignments','Planned CTN','Final PASS','Final FAILED','Pending','Completion','Actions'].map(label => <TableCell key={label} sx={headerCellSx}>{trUi(label)}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {(report?.factories || []).map(item => <TableRow hover key={item.factoryCode}>
              <TableCell sx={tableCellSx}><Typography fontSize={13} fontWeight={800}>{item.factoryCode}</Typography></TableCell>
              <TableCell sx={tableCellSx}>{format(item.pos)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.plannedCartons)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.finalPass)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.finalFailed)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.pending)}</TableCell>
              <TableCell sx={tableCellSx}>{ratio(item.finalPass, item.plannedCartons)}%</TableCell>
              <TableCell sx={tableCellSx}><Button size="small" onClick={() => viewFactoryPos(item.factoryCode)} startIcon={<VisibilityOutlined fontSize="small"/>}>{trUi("View POs")}</Button></TableCell>
            </TableRow>)}
            {!busy && !report?.factories?.length && <TableEmpty columns={8}/>}
          </TableBody>
        </Table>
      </TableContainer>}

      {groupBy === 'shipping' && <TableContainer sx={{ maxHeight: 600 }}>
        <Table size="small" stickyHeader>
          <TableHead><TableRow>{['Shipping Date','Factory','Order','Shipping Status','POs','Planned CTN','Final PASS','Final FAILED','Pending','Actions'].map(label => <TableCell key={label} sx={headerCellSx}>{trUi(label)}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {(report?.shippingDays || []).map((item, index) => <TableRow hover key={`${item.shippingDate}/${item.factoryCode}/${item.orderId || index}`}>
              <TableCell sx={tableCellSx}>{displayDate(item.shippingDate)}</TableCell>
              <TableCell sx={tableCellSx}>{item.factoryCode}</TableCell>
              <TableCell sx={tableCellSx}>{item.orderName}</TableCell>
              <TableCell sx={tableCellSx}><Status value={item.shippingStatus}/></TableCell>
              <TableCell sx={tableCellSx}>{format(item.pos)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.plannedCartons)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.finalPass)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.finalFailed)}</TableCell>
              <TableCell sx={tableCellSx}>{format(item.pending)}</TableCell>
              <TableCell sx={tableCellSx}><Button size="small" onClick={() => viewShippingPos(item)} startIcon={<VisibilityOutlined fontSize="small"/>}>{trUi("View POs")}</Button></TableCell>
            </TableRow>)}
            {!busy && !report?.shippingDays?.length && <TableEmpty columns={10}/>}
          </TableBody>
        </Table>
      </TableContainer>}

      {groupBy === 'po' && <>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead><TableRow>{['Shipping Date','Factory','Order','PO','Master PO','Planned CTN','Final PASS','FAILED','Pending','Status','Actions'].map(label => <TableCell key={label} sx={headerCellSx}>{trUi(label)}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {rows.map(item => <TableRow key={`${item.shippingDate}/${item.factoryCode}/${item.poId}`} hover>
                <TableCell sx={tableCellSx}>{displayDate(item.shippingDate)}</TableCell>
                <TableCell sx={tableCellSx}>{item.factoryCode}</TableCell>
                <TableCell sx={tableCellSx}>{item.orderName}</TableCell>
                <TableCell sx={tableCellSx}><Button size="small" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }} onClick={() => setSelectedPo(item)}>{item.poNumber || item.poId}</Button></TableCell>
                <TableCell sx={tableCellSx}>{item.masterPo || '—'}</TableCell>
                <TableCell sx={tableCellSx}>{format(item.plannedCartons)}</TableCell>
                <TableCell sx={tableCellSx}>{format(item.finalPass)}</TableCell>
                <TableCell sx={tableCellSx}>{format(item.finalFailed)}</TableCell>
                <TableCell sx={tableCellSx}>{format(item.pending)}</TableCell>
                <TableCell sx={tableCellSx}><Status value={item.status}/></TableCell>
                <TableCell sx={tableCellSx}><Tooltip title={trUi("Open PO Details popup")}><Button size="small" variant="outlined" onClick={() => setSelectedPo(item)} startIcon={<VisibilityOutlined fontSize="small"/>}>{trUi("View")}</Button></Tooltip></TableCell>
              </TableRow>)}
              {!busy && !rows.length && <TableEmpty columns={11}/>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={report?.totalRows || 0} page={page} rowsPerPage={size} rowsPerPageOptions={[10,25,50,100]}
          onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}/>
      </>}
    </Paper>

    <PoDetailsDialog row={selectedPo} filters={applied} onClose={() => setSelectedPo(null)}/>
  </Stack>;
}
