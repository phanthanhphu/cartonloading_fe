import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Refresh, Search } from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import { CompactPageHeader } from 'components/CompactPageHeader';
import LululemonTableViewport from '../components/LululemonTableViewport';
import { listCartonWeightHistoryAll } from '../services/service';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Operation failed.';
const lower = (value) => String(value ?? '').trim().toLowerCase();
const normalizeResult = (value) => value === 'HOLD' ? 'FAILED' : value;

export default function WeightHistoryPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ keyword: '', orderNo: '', factory: '', shippingList: '', date: '', sscc: '' });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCartonWeightHistoryAll();
      setRows(Array.isArray(result) ? result : []);
    } catch (error) {
      setRows([]);
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const event = row?.result || {};
    if (filters.orderNo && !lower(row.orderNo).includes(lower(filters.orderNo))) return false;
    if (filters.factory && !lower(row.factoryCode).includes(lower(filters.factory))) return false;
    if (filters.shippingList && !lower(row.shippingList).includes(lower(filters.shippingList))) return false;
    if (filters.date && String(row.shippingDate || '') !== filters.date) return false;
    if (filters.sscc && !lower(event.sscc18).includes(lower(filters.sscc))) return false;
    if (filters.keyword) {
      const haystack = [row.orderNo, row.factoryCode, row.shippingList, row.shippingDate, event.poNumber, event.cartonNo, event.sscc18, event.stationCode, event.userId, event.result, event.action]
        .map(lower).join(' ');
      if (!haystack.includes(lower(filters.keyword))) return false;
    }
    return true;
  }), [rows, filters]);

  const clear = () => setFilters({ keyword: '', orderNo: '', factory: '', shippingList: '', date: '', sscc: '' });

  return (
    <Stack spacing={0.85} sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader
        dense
        title="Weight History"
        subtitle="Manage and search weighing history across Shipping Lists, Orders, factories and dates."
        actions={<Button size="small" startIcon={<Refresh />} onClick={load} disabled={loading}>Refresh</Button>}
      />

      {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 0.85, borderRadius: 2 }}>
        <Stack spacing={0.65}>
          <TextField
            size="small"
            fullWidth
            label="Search history"
            placeholder="Search PO, carton, SSCC, station, user or result..."
            value={filters.keyword}
            onChange={(e) => setFilters((current) => ({ ...current, keyword: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))', xl: 'repeat(5,minmax(140px,1fr))' }, gap: 0.75 }}>
            <TextField size="small" label="Order No." value={filters.orderNo} onChange={(e) => setFilters((current) => ({ ...current, orderNo: e.target.value }))} />
            <TextField size="small" label="Factory" value={filters.factory} onChange={(e) => setFilters((current) => ({ ...current, factory: e.target.value }))} />
            <TextField size="small" label="Shipping List" value={filters.shippingList} onChange={(e) => setFilters((current) => ({ ...current, shippingList: e.target.value }))} />
            <TextField size="small" type="date" label="Shipping Date" InputLabelProps={{ shrink: true }} value={filters.date} onChange={(e) => setFilters((current) => ({ ...current, date: e.target.value }))} />
            <TextField size="small" label="SSCC-18" value={filters.sscc} onChange={(e) => setFilters((current) => ({ ...current, sscc: e.target.value }))} />
          </Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Chip size="small" variant="outlined" label={`${filteredRows.length} / ${rows.length} record(s)`} />
            <Button size="small" onClick={clear}>Clear Filters</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2.4, overflow: 'hidden' }}>
        <LululemonTableViewport sx={{ maxHeight: 'calc(100vh - 310px)', minHeight: 360 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Order No.</TableCell>
              <TableCell>Factory</TableCell>
              <TableCell>Shipping List</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>PO</TableCell>
              <TableCell>Carton</TableCell>
              <TableCell>SSCC-18</TableCell>
              <TableCell>Qty</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Actual</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Station</TableCell>
              <TableCell>User</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filteredRows.map((row) => {
                const event = row.result || {};
                const result = normalizeResult(event.result);
                return (
                  <TableRow key={event.id || `${event.createdAt}-${event.cartonId}`} hover>
                    <TableCell>{event.createdAt || '—'}</TableCell>
                    <TableCell><Typography fontWeight={850}>{row.orderNo || '—'}</Typography></TableCell>
                    <TableCell>{row.factoryCode || '—'}</TableCell>
                    <TableCell>{row.shippingList || '—'}</TableCell>
                    <TableCell>{row.shippingDate || '—'}</TableCell>
                    <TableCell>{event.poNumber || '—'}</TableCell>
                    <TableCell>{event.cartonNo ?? '—'}</TableCell>
                    <TableCell>{event.sscc18 || '—'}</TableCell>
                    <TableCell>{event.cartonQty ?? '—'}</TableCell>
                    <TableCell>{event.expectedWeightKg ?? '—'}</TableCell>
                    <TableCell>{event.actualWeightKg ?? '—'}</TableCell>
                    <TableCell><Chip size="small" color={result === 'PASS' ? 'success' : result === 'FAILED' ? 'error' : 'default'} label={result || event.action || '—'} /></TableCell>
                    <TableCell>{event.stationCode || '—'}</TableCell>
                    <TableCell>{event.userId || '—'}</TableCell>
                  </TableRow>
                );
              })}
              {!filteredRows.length ? <TableRow><TableCell colSpan={14} align="center" sx={{ py: 5, color: 'text.secondary' }}>{loading ? 'Loading weight history...' : 'No weight history matches the current filters.'}</TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </LululemonTableViewport>
      </Paper>
    </Stack>
  );
}
