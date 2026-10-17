import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  InputAdornment,
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography
} from '@mui/material';
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  ClearRounded,
  DeleteOutlineRounded,
  Refresh,
  Search,
  TuneRounded
} from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import { CompactPageHeader } from '../components/LululemonPageHeader';
import { canAccessAssignedFactory, canManageSales, getFactoryPermissions } from 'utils/accessControl';
import OrderScope from '../components/OrderScope';
import { listShippingSchedules, removeShippingSchedule } from '../services/service';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Operation failed.';
const normalize = (v) => String(v ?? '').trim();
const scheduleStatusLabel = (schedule = {}) => schedule.status === 'COMPLETED' && schedule.rfidReviewStatus
  ? `WEIGHT COMPLETE · RFID ${schedule.rfidReviewStatus === 'PASS' ? 'VERIFIED' : schedule.rfidReviewStatus}`
  : schedule.status || '—';
const statusColor = (status, review) => status === 'COMPLETED'
  ? (review && review !== 'PASS' ? 'warning' : 'success')
  : status === 'SENT_TO_WEIGHT' ? 'primary' : status === 'REVIEWED' ? 'info' : 'default';

function MultiFilter({ label, options, value, onChange, disabled }) {
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={2}
      size="small"
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      disabled={disabled}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox size="small" checked={selected} sx={{ mr: 0.5, p: 0.25 }} />
          <Typography variant="body2">{option}</Typography>
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? '' : 'All'} />}
    />
  );
}

export default function ScheduleReviewPage() {
  const navigate = useNavigate();
  const { buyerSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sales = canManageSales();
  const userFactories = useMemo(() => getFactoryPermissions(), []);
  const [orderId, setOrderId] = useState(() => searchParams.get('orderId') || '');
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [factories, setFactories] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [readiness, setReadiness] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = useCallback(async () => {
    if (!orderId) {
      setRows([]);
      return;
    }
    setBusy(true);
    try {
      const result = await listShippingSchedules(orderId);
      const safe = Array.isArray(result) ? result : [];
      setRows(sales ? safe : safe.filter((row) => canAccessAssignedFactory(row?.schedule?.factoryCode)));
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [orderId, sales]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (orderId) next.set('orderId', orderId); else next.delete('orderId');
    setSearchParams(next, { replace: true });
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const factoryOptions = useMemo(() => [...new Set(rows.map((row) => normalize(row?.schedule?.factoryCode)).filter(Boolean))].sort(), [rows]);
  const statusOptions = useMemo(() => [...new Set(rows.map((row) => normalize(row?.schedule?.status)).filter(Boolean))].sort(), [rows]);

  const filteredRows = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      const schedule = row?.schedule || {};
      if (tokens.length) {
        const haystack = [schedule.shippingName, schedule.scheduleNo, schedule.factoryCode, schedule.exFtyDate, schedule.status, schedule.createdBy]
          .filter(Boolean).join(' ').toLowerCase();
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }
      if (factories.length && !factories.includes(normalize(schedule.factoryCode))) return false;
      if (statuses.length && !statuses.includes(normalize(schedule.status))) return false;
      if (readiness.length) {
        const readyValue = row.readyToSendToWeight ? 'READY' : 'NOT READY';
        if (!readiness.includes(readyValue)) return false;
      }
      if (dateFrom && schedule.exFtyDate && schedule.exFtyDate < dateFrom) return false;
      if (dateTo && schedule.exFtyDate && schedule.exFtyDate > dateTo) return false;
      return true;
    });
  }, [rows, search, factories, statuses, readiness, dateFrom, dateTo]);

  const pagedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [orderId, search, factories, statuses, readiness, dateFrom, dateTo]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [filteredRows.length, page, rowsPerPage]);

  const clearFilters = () => {
    setSearch('');
    setFactories([]);
    setStatuses([]);
    setReadiness([]);
    setDateFrom('');
    setDateTo('');
  };

  const openSchedule = (scheduleId) => {
    navigate(`/buyers/${buyerSlug}/shipping/review/${encodeURIComponent(scheduleId)}?orderId=${encodeURIComponent(orderId)}`);
  };

  const canRemoveSchedule = (schedule = {}) => sales
    && !schedule.weighingOrderId
    && !schedule.sentToWeightAt
    && ['PLANNED', 'REVIEWED'].includes(schedule.status);

  const removeSchedule = async (event, schedule) => {
    event?.stopPropagation?.();
    if (!orderId || !schedule?.id || !canRemoveSchedule(schedule) || busy) return;
    const confirmed = window.confirm(`Remove Shipping ${schedule.shippingName || schedule.scheduleNo || ''}?\n\nPacking scan, Carton, SKU and SSCC data will be kept.`);
    if (!confirmed) return;

    setBusy(true);
    setNotice(null);
    try {
      await removeShippingSchedule(orderId, schedule.id);
      setNotice({ severity: 'success', text: `${schedule.scheduleNo || 'Shipping Schedule'} removed. Packing scan, Carton, SKU and SSCC data were kept.` });
      const result = await listShippingSchedules(orderId);
      const safe = Array.isArray(result) ? result : [];
      setRows(sales ? safe : safe.filter((row) => canAccessAssignedFactory(row?.schedule?.factoryCode)));
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const factoryScope = sales ? 'All Factories' : (userFactories.length ? userFactories.join(', ') : 'No Factory assigned');

  return (
    <Stack className="lululemon-compact-v16" spacing={0.85} sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader
        dense
        title="Shipping"
        actions={(
          <Stack direction="row" spacing={0.6}>
            <Button size="small" variant="outlined" startIcon={<ArrowBackRounded />} onClick={() => navigate(`/buyers/${buyerSlug}/shipping${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ''}`)}>Back</Button>
            <Button size="small" startIcon={<Refresh />} onClick={load} disabled={!orderId || busy}>Refresh</Button>
          </Stack>
        )}
      />


      {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 0.9, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#FBFCFE' }}>
        <Stack spacing={0.7}>
          <Box sx={{ maxWidth: { xs: '100%', md: 460 } }}><OrderScope value={orderId} onChange={setOrderId} disabled={busy} embedded compact /></Box>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={0.8}>
            <Box>
              <Typography fontWeight={950}>Shipping Lists for Packing</Typography>
              <Typography variant="caption" color="text.secondary">Factory: {factoryScope}</Typography>
            </Box>
            <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
              <Chip size="small" variant="outlined" label={`${filteredRows.length} / ${rows.length} shown`} />
              <Chip size="small" color="success" variant="outlined" label={`${rows.filter((row) => row.readyToSendToWeight).length} ready`} />
              <Button size="small" startIcon={<TuneRounded fontSize="small" />} variant={filtersOpen || factories.length || statuses.length || readiness.length || dateFrom || dateTo ? 'outlined' : 'text'} onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
                Filters{factories.length + statuses.length + readiness.length + Number(Boolean(dateFrom)) + Number(Boolean(dateTo)) ? ` (${factories.length + statuses.length + readiness.length + Number(Boolean(dateFrom)) + Number(Boolean(dateTo))})` : ''}
              </Button>
            </Stack>
          </Stack>

          <TextField
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Shipping Name, code, Factory, date or status..."
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />

          <Collapse in={filtersOpen} unmountOnExit>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0,1fr))', xl: 'repeat(5, minmax(150px,1fr))' }, gap: 0.8, pt: 0.35 }}>
              <MultiFilter label="Factory" options={factoryOptions} value={factories} onChange={setFactories} disabled={busy} />
              <MultiFilter label="Status" options={statusOptions} value={statuses} onChange={setStatuses} disabled={busy} />
              <MultiFilter label="Readiness" options={['READY', 'NOT READY']} value={readiness} onChange={setReadiness} disabled={busy} />
              <TextField size="small" type="date" label="Shipping Date From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <TextField size="small" type="date" label="Shipping Date To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Box>
          </Collapse>

          <Stack direction="row" justifyContent="flex-end">
            <Button size="small" startIcon={<ClearRounded />} onClick={clearFilters} disabled={!search && !factories.length && !statuses.length && !readiness.length && !dateFrom && !dateTo}>Clear Filters</Button>
          </Stack>
        </Stack>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport sx={{ border: 0, borderRadius: 0 }}>
            <SortableTable size="small">
              <TableHead><TableRow>
                <TableCell>Shipping Name</TableCell>
                <TableCell>Factory</TableCell>
                <TableCell>Shipping Date</TableCell>
                <TableCell>PO Ready</TableCell>
                <TableCell>SSCC</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell data-sortable={false} align="right">Action</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {pagedRows.map((row) => {
                  const schedule = row.schedule || {};
                  return (
                    <TableRow key={schedule.id} hover sx={{ cursor: 'pointer' }} onClick={() => openSchedule(schedule.id)}>
                      <TableCell><Typography fontWeight={950}>{schedule.shippingName || schedule.scheduleNo}</Typography>
                        {schedule.shippingName ? <Typography variant="caption" color="text.secondary">{schedule.scheduleNo}</Typography> : null}</TableCell>
                      <TableCell><Chip size="small" color="primary" variant="outlined" label={schedule.factoryCode || '—'} /></TableCell>
                      <TableCell>{schedule.exFtyDate || '—'}</TableCell>
                      <TableCell><Typography fontWeight={850}>{row.readyPos}/{row.totalPos}</Typography></TableCell>
                      <TableCell>{row.ssccAssignedCartons}/{row.totalCartons}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={850}>{row.passCartons} PASS</Typography>
                        <Typography variant="caption" color={row.failedCartons > 0 ? 'error.main' : 'text.secondary'}>{row.failedCartons} FAILED</Typography>
                      </TableCell>
                      <TableCell><Chip size="small" color={statusColor(schedule.status, schedule.rfidReviewStatus)} label={scheduleStatusLabel(schedule)} /></TableCell>
                      <TableCell>{schedule.createdBy || '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button size="small" variant="outlined" endIcon={<ArrowForwardRounded />} onClick={(e) => { e.stopPropagation(); openSchedule(schedule.id); }}>Open</Button>
                          {canRemoveSchedule(schedule) ? (
                            <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} disabled={busy} onClick={(e) => removeSchedule(e, schedule)}>Remove</Button>
                          ) : null}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filteredRows.length ? <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}><Typography fontWeight={850}>{orderId ? 'No Shipping Schedule matches the current filters.' : 'Select an Order first.'}</Typography></TableCell></TableRow> : null}
              </TableBody>
            </SortableTable>
          </LululemonTableViewport>
        </Box>
        <Stack spacing={0.75} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
          {pagedRows.map((row) => {
            const schedule = row.schedule || {};
            return (
              <Paper key={schedule.id} variant="outlined" sx={{ p: 1, borderRadius: 1.8 }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={950}>{schedule.shippingName || schedule.scheduleNo || '—'}</Typography>
                    <Typography variant="body2" fontWeight={800}>{schedule.factoryCode || '—'} · {schedule.exFtyDate || '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">Created by {schedule.createdBy || '—'}</Typography>
                  </Box>
                  <Chip size="small" color={statusColor(schedule.status, schedule.rfidReviewStatus)} label={scheduleStatusLabel(schedule)} />
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 0.65, mt: 0.9 }}>
                  <Box sx={{ p: 0.7, bgcolor: 'background.default', borderRadius: 1.2 }}><Typography variant="caption" color="text.secondary">PO Ready</Typography><Typography fontWeight={950}>{row.readyPos}/{row.totalPos}</Typography></Box>
                  <Box sx={{ p: 0.7, bgcolor: 'background.default', borderRadius: 1.2 }}><Typography variant="caption" color="text.secondary">SSCC</Typography><Typography fontWeight={950}>{row.ssccAssignedCartons}/{row.totalCartons}</Typography></Box>
                  <Box sx={{ p: 0.7, bgcolor: 'background.default', borderRadius: 1.2 }}><Typography variant="caption" color="text.secondary">Weight</Typography><Typography fontWeight={950} color={row.failedCartons > 0 ? 'error.main' : 'success.main'}>{row.passCartons}/{row.totalCartons}</Typography></Box>
                </Box>
                <Stack direction="row" spacing={0.7} sx={{ mt: 0.9 }}>
                  <Button fullWidth variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => openSchedule(schedule.id)} sx={{ minHeight: 48 }}>Open</Button>
                  {canRemoveSchedule(schedule) ? <Button fullWidth color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} disabled={busy} onClick={(e) => removeSchedule(e, schedule)} sx={{ minHeight: 48 }}>Remove</Button> : null}
                </Stack>
              </Paper>
            );
          })}
          {!filteredRows.length ? <Typography fontWeight={850} align="center" color="text.secondary" sx={{ py: 4 }}>{orderId ? 'No Shipping Schedule matches the current filters.' : 'Select an Order first.'}</Typography> : null}
        </Stack>
        <TablePagination
          component="div"
          count={filteredRows.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100]}
          labelRowsPerPage="Rows per page"
          showFirstButton
          showLastButton
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Paper>
    </Stack>
  );
}
