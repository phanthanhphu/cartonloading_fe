import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Paper,
  Stack,
  
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ArrowBackRounded,
  CalendarMonthRounded,
  CheckRounded,
  ClearRounded,
  Refresh,
  UploadFile
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { CompactPageHeader } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { importLululemonShipping, listAllLululemonPos, updateLululemonExFty } from '../services/lululemonService';
import LululemonStatusChip from '../components/LululemonStatusChip';
import LululemonOrderScope from '../components/LululemonOrderScope';

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function ShippingPage() {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState({ poNumber: '', factoryCode: '', styleNumber: '', sku: '', exFtyDate: '', status: '' });
  const [exFtyDate, setExFtyDate] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!orderId) {
      setRows([]);
      return;
    }
    try {
      setRows(await listAllLululemonPos(orderId));
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message });
    }
  }, [orderId]);

  useEffect(() => {
    setSelected(new Set());
    setFilters({ poNumber: '', factoryCode: '', styleNumber: '', sku: '', exFtyDate: '', status: '' });
    setPage(0);
    load();
  }, [load]);

  const filteredRows = useMemo(() => rows.filter((row) => (
    (!filters.poNumber || normalize(row.poNumber).includes(normalize(filters.poNumber))) &&
    (!filters.factoryCode || normalize(row.factoryCode).includes(normalize(filters.factoryCode))) &&
    (!filters.styleNumber || normalize(row.styleNumber).includes(normalize(filters.styleNumber))) &&
    (!filters.sku || normalize(row.sku).includes(normalize(filters.sku))) &&
    (!filters.exFtyDate || String(row.exFtyDate || '').slice(0, 10) === filters.exFtyDate) &&
    (!filters.status || normalize(row.status) === normalize(filters.status))
  )), [rows, filters]);

  const pageRows = useMemo(
    () => filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredRows, page, rowsPerPage]
  );

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.id)), [rows, selected]);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selected.has(row.id));
  const somePageSelected = pageRows.some((row) => selected.has(row.id));

  const toggleOne = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allPageSelected) pageRows.forEach((row) => next.delete(row.id));
      else pageRows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !orderId) return;
    setBusy(true);
    try {
      const result = await importLululemonShipping(orderId, file);
      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      setNotice({
        severity: warnings.length ? 'warning' : 'success',
        text: `Shipping List imported. ${result.updatedPos || 0} PO updated.${warnings.length ? ` ${warnings.length} note(s): ${warnings.join(' | ')}` : ''}`
      });
      await load();
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || 'Shipping List import failed.' });
    } finally {
      setBusy(false);
    }
  };

  const applyDate = async () => {
    if (!orderId || !exFtyDate || !selectedRows.length || busy) return;
    setBusy(true);
    try {
      let updated = 0;
      const failed = [];
      const chunkSize = 8;
      for (let index = 0; index < selectedRows.length; index += chunkSize) {
        const chunk = selectedRows.slice(index, index + chunkSize);
        const results = await Promise.allSettled(
          chunk.map((row) => updateLululemonExFty(orderId, row.poNumber, exFtyDate))
        );
        results.forEach((result, resultIndex) => {
          if (result.status === 'fulfilled') updated += 1;
          else failed.push(chunk[resultIndex].poNumber);
        });
      }
      await load();
      setSelected(new Set());
      setNotice({
        severity: failed.length ? 'warning' : 'success',
        text: failed.length
          ? `${updated} PO updated to ${exFtyDate}. Failed: ${failed.join(', ')}`
          : `${updated} PO updated to Ex-Factory Date ${exFtyDate}.`
      });
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.25}>
      <CompactPageHeader
        title="Shipping & Ex-Factory"
        subtitle="Choose one Order, set the Ex-Factory Date once, then select the POs that should receive it."
        meta={<Chip size="small" label="LULULEMON" variant="outlined" sx={{ fontWeight: 700 }} />}
        actions={(
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackRounded />}
              onClick={() => navigate(orderId ? `/buyers/lululemon/orders/${orderId}` : '/buyers/lululemon/orders')}
            >
              Back
            </Button>
            <Tooltip title="Reload Purchase Orders">
              <span><Button size="small" startIcon={<Refresh />} onClick={load} disabled={busy || !orderId}>Refresh</Button></span>
            </Tooltip>
            <Button size="small" startIcon={<UploadFile />} onClick={() => fileRef.current?.click()} disabled={busy || !orderId}>
              Import Shipping List
            </Button>
            <input ref={fileRef} hidden type="file" accept=".xlsx,.xls" onChange={upload} />
          </>
        )}
      />

      <Paper
        variant="outlined"
        sx={{ borderRadius: 2.5, borderColor: '#DDE6EF', overflow: 'hidden', boxShadow: '0 3px 14px rgba(30, 55, 80, 0.04)' }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} sx={{ p: 1.25, bgcolor: '#FBFCFE' }}>
          <Box sx={{ flex: 1.35, minWidth: 0 }}>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.65 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: '#EAF1FF', color: '#2F6FED', fontSize: '0.72rem', fontWeight: 900 }}>1</Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 850, letterSpacing: '.04em', color: '#38506A', lineHeight: 1.1 }}>ORDER</Typography>
                <Typography variant="caption" color="text.secondary">Choose the Order that contains the Purchase Orders</Typography>
              </Box>
            </Stack>
            <LululemonOrderScope value={orderId} onChange={setOrderId} disabled={busy} embedded compact />
          </Box>

          <Box sx={{ width: { xs: '100%', lg: 260 }, flexShrink: 0 }}>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.65 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: '#EAF1FF', color: '#2F6FED', fontSize: '0.72rem', fontWeight: 900 }}>2</Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 850, letterSpacing: '.04em', color: '#38506A', lineHeight: 1.1 }}>EX-FACTORY DATE</Typography>
                <Typography variant="caption" color="text.secondary">Set the date once for selected POs</Typography>
              </Box>
            </Stack>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={exFtyDate}
              onChange={(event) => setExFtyDate(event.target.value)}
              disabled={busy || !orderId}
              InputProps={{ startAdornment: <CalendarMonthRounded sx={{ mr: 0.8, fontSize: 18, color: '#6B7F93' }} /> }}
            />
          </Box>
        </Stack>

        <Divider />

        <Stack spacing={0.8} sx={{ p: 1.1 }}>
          <TableFilterBar
            fields={[
              { key: 'poNumber', label: 'PO No.' },
              { key: 'factoryCode', label: 'Factory' },
              { key: 'styleNumber', label: 'Style' },
              { key: 'sku', label: 'SKU' },
              { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' },
              { key: 'status', label: 'Status', options: ['NOT_STARTED', 'PACKING', 'WAITING_EX_FTY', 'WAITING_LABEL', 'WAITING_SSCC', 'READY_TO_SHIP'] }
            ]}
            values={filters}
            onChange={(key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(0); }}
            onClear={() => { setFilters({ poNumber: '', factoryCode: '', styleNumber: '', sku: '', exFtyDate: '', status: '' }); setPage(0); }}
            disabled={!orderId}
          />
          <Stack direction="row" spacing={0.8} justifyContent="flex-end" alignItems="center">
          <Chip size="small" label={`${selected.size} selected`} sx={{ fontWeight: 750 }} />
          <Button
            size="small"
            startIcon={<ClearRounded />}
            onClick={() => setSelected(new Set())}
            disabled={!selected.size || busy}
          >
            Clear
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckRounded />}
            onClick={applyDate}
            disabled={busy || !orderId || !exFtyDate || !selected.size}
            sx={{ minWidth: 170 }}
          >
            Apply Date to POs
          </Button>
          </Stack>
        </Stack>
      </Paper>

      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, borderColor: '#DDE6EF' }}>
        <SortableTable size="small" rowNumberStart={page * rowsPerPage}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allPageSelected}
                  indeterminate={!allPageSelected && somePageSelected}
                  onChange={togglePage}
                  disabled={!pageRows.length || busy}
                  inputProps={{ 'aria-label': 'Select visible POs' }}
                />
              </TableCell>
              {['Purchase Order', 'Factory', 'Style', 'SKU', 'Current Ex-Factory', 'Status'].map((heading) => (
                <TableCell key={heading} sx={{ fontWeight: 800 }}>{heading}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => {
              const checked = selected.has(row.id);
              return (
                <TableRow key={row.id} hover selected={checked} onClick={() => !busy && toggleOne(row.id)} sx={{ cursor: busy ? 'default' : 'pointer' }}>
                  <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                    <Checkbox size="small" checked={checked} onChange={() => toggleOne(row.id)} disabled={busy} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#20364D' }}>{row.poNumber}</TableCell>
                  <TableCell>{row.factoryCode || '—'}</TableCell>
                  <TableCell>{row.styleNumber || '—'}</TableCell>
                  <TableCell>{row.sku || 'Not assigned'}</TableCell>
                  <TableCell>
                    {row.exFtyDate ? <Chip size="small" label={row.exFtyDate} variant="outlined" /> : <Typography variant="caption" color="text.secondary">Not set</Typography>}
                  </TableCell>
                  <TableCell><LululemonStatusChip status={row.status} /></TableCell>
                </TableRow>
              );
            })}
            {!orderId && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>Select an Order first.</TableCell></TableRow>}
            {orderId && !filteredRows.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}>{rows.length ? 'No PO matches your search.' : 'No Purchase Order found in this Order.'}</TableCell></TableRow>}
          </TableBody>
        </SortableTable>
        <TablePagination
          component="div"
          count={filteredRows.length}
          page={Math.min(page, Math.max(0, Math.ceil(filteredRows.length / rowsPerPage) - 1))}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
    </Stack>
  );
}
