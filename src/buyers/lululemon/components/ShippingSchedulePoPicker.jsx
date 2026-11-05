import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, ListItemText, Menu, MenuItem, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TextField, Typography
} from '@mui/material';
import { LocalShippingOutlined, ViewColumnOutlined } from '@mui/icons-material';
import { BUYER_CODE, ALL_BP_KNOWN_HEADERS, ALL_BP_RETIRED_KEYS, ALL_BP_SOURCE_ALIAS,
  PURCHASE_ORDER_STATUS_OPTIONS } from '../../../constants/appConstants';
import TableFilterBar from 'components/TableFilterBar';
import { listManagedPos } from 'services/managementService';
import { getPoShippingDay, schedulePoShippingDate } from '../services/shipping';

const errText = (e, fallback) => e?.response?.data?.message || e?.message || fallback;
const cleanId = (row) => row.id || row.key;
const firstPage = () => ({ rows: [], count: 0, page: 0, size: 25, loading: false });
const initialFilters = () => ({ poNumber: '', masterPo: '', style: '', description: '', color: '', qty: '',
  sku: '', destination: '', exFtyDate: '', status: '' });
const FILTER_FIELDS = [
  { key: 'poNumber', label: 'PO' },
  { key: 'masterPo', label: 'Master PO' },
  { key: 'style', label: 'Style' },
  { key: 'description', label: 'Description' },
  { key: 'color', label: 'Color description' },
  { key: 'qty', label: "Q'ty" },
  { key: 'sku', label: 'SKU' },
  { key: 'destination', label: 'Destination' },
  { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' },
  { key: 'status', label: 'Status', options: PURCHASE_ORDER_STATUS_OPTIONS }
];
const DEFAULT_COLUMN_KEYS = ['DC_CODE', 'CHANNEL', 'MASTER_PO', 'PO', 'PACKING_PLAN',
  'STYLE', 'DESCRIPTION', 'COLOR'];
const STORAGE_KEY = 'lululemon.shippingSchedulePoPicker.columns.v1';
const SELECT_COLUMN_WIDTH = 64;
const HEADER_LABELS = {
  DC_CODE: 'DC Code', CHANNEL: 'Chanel', MASTER_PO: 'Master PO', PO: 'PO',
  PACKING_PLAN: 'Packing Plan', STYLE: 'Style', DESCRIPTION: 'Description',
  COLOR: 'Color description', QTY: "Q'ty", PCS_CTN: 'Pcs/ctn',
  ODD_RATIO: 'lẻ', CTNS: 'Ctns', REMAINDER: 'Dư'
};
const HEADER_WIDTHS = {
  DC_CODE: 100, CHANNEL: 105, MASTER_PO: 125, PO: 130, PACKING_PLAN: 145,
  STYLE: 160, DESCRIPTION: 310, COLOR: 220, QTY: 100, PCS_CTN: 110,
  ODD_RATIO: 95, CTNS: 95, REMAINDER: 95
};
const SYSTEM_COLUMNS = [
  { key: 'sys:factory', title: 'Factory', group: 'System', minWidth: 100, value: (row) => row.factoryCode },
  { key: 'sys:sku', title: 'SKU', group: 'System', minWidth: 145, value: (row) => row.sku },
  { key: 'sys:exFtyDate', title: 'Ex-Factory', group: 'System', minWidth: 125, value: (row) => row.exFtyDate },
  { key: 'sys:status', title: 'Status', group: 'System', minWidth: 135, value: (row) => row.status }
];

const headerKey = (value) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
const canonicalSourceKey = (label) => {
  const normalized = headerKey(label);
  return ALL_BP_SOURCE_ALIAS[normalized] || `RAW_${normalized || 'COLUMN'}`;
};
const sourceRowEntry = (sourceRow, canonical) => Object.entries(sourceRow || {})
  .find(([label]) => canonicalSourceKey(label) === canonical);
const sourceValues = (row, canonical) => (Array.isArray(row?.allBpRows) ? row.allBpRows : [])
  .flatMap((sourceRow) => {
    const value = sourceRowEntry(sourceRow, canonical)?.[1];
    return String(value ?? '').trim() ? [String(value).trim()] : [];
  });
const uniqueSourceValues = (row, canonical) => [...new Set(sourceValues(row, canonical))];
const sourceNumber = (sourceRow, canonical) => {
  const value = sourceRowEntry(sourceRow, canonical)?.[1];
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

// Same ALL_BP calculation as All POs: lẻ=CEIL(Q'ty/Pcs/ctn), Ctns=FLOOR,
// Dư=Q'ty-(Ctns*Pcs/ctn). Preserve separate source lines before aggregating.
const cartonMetrics = (row) => {
  const metrics = [];
  for (const sourceRow of Array.isArray(row?.allBpRows) ? row.allBpRows : []) {
    const qty = sourceNumber(sourceRow, 'QTY');
    const pcs = sourceNumber(sourceRow, 'PCS_CTN');
    if (qty == null || pcs == null || qty <= 0 || pcs <= 0) continue;
    const fullCartons = Math.floor(qty / pcs);
    metrics.push({ ratio: Math.ceil(qty / pcs), fullCartons, remainder: qty - fullCartons * pcs });
  }
  if (!metrics.length) {
    const qty = Number(row?.totalQty ?? row?.plannedTotalQty ?? 0);
    const pcs = Number(row?.qtyPerCarton ?? row?.pcsPerCarton ?? 0);
    if (Number.isFinite(qty) && Number.isFinite(pcs) && qty > 0 && pcs > 0) {
      const fullCartons = Math.floor(qty / pcs);
      metrics.push({ ratio: Math.ceil(qty / pcs), fullCartons, remainder: qty - fullCartons * pcs });
    }
  }
  return metrics;
};

const sourceValue = (row, canonical) => {
  if (canonical === 'PO') return row.poNumber;
  if (canonical === 'STYLE') return row.styleNumber || row.style;
  if (canonical === 'QTY') return row.totalQty ?? row.plannedTotalQty;
  if (canonical === 'PCS_CTN') {
    const values = uniqueSourceValues(row, canonical);
    return values.length > 1 ? values.join(' | ') : (row.qtyPerCarton ?? row.pcsPerCarton ?? values[0]);
  }
  if (canonical === 'ODD_RATIO') {
    const metrics = cartonMetrics(row);
    return metrics.length ? metrics.map((entry) => entry.ratio).join(' | ') : null;
  }
  if (canonical === 'CTNS') {
    const metrics = cartonMetrics(row);
    if (metrics.length) return metrics.reduce((total, entry) => total + entry.fullCartons, 0);
    const values = sourceValues(row, canonical);
    if (!values.length) return null;
    const numbers = values.map((value) => Number(value.replace(/,/g, '')));
    return numbers.every(Number.isFinite) ? numbers.reduce((sum, value) => sum + value, 0) : null;
  }
  if (canonical === 'REMAINDER') {
    const metrics = cartonMetrics(row);
    return metrics.length ? metrics.reduce((total, entry) => total + entry.remainder, 0) : null;
  }
  const values = uniqueSourceValues(row, canonical);
  if (values.length) return values.join(' | ');
  const fallbacks = {
    DC_CODE: row.dcCode, CHANNEL: row.channel, MASTER_PO: row.masterPo,
    PACKING_PLAN: row.packingPlan, DESCRIPTION: row.description, COLOR: row.color,
    DESTINATION: row.destination, SALES_ORDER_PTS: row.salesOrderPts,
    SHIP_MODE: row.shipMode, SEASON: row.season, FWD: row.fwd,
    CARTON_BOX_SIZE: row.cartonBoxSize, NW: row.netWeightKg, GW: row.grossWeightKg
  };
  return fallbacks[canonical];
};

const newColumn = (canonical, label) => ({
  key: `src:${canonical}`, canonical, title: HEADER_LABELS[canonical] || label,
  group: 'ALL_BP', minWidth: HEADER_WIDTHS[canonical] || 135
});
const knownColumns = (() => {
  const columns = new Map();
  const add = (label) => {
    const canonical = canonicalSourceKey(label);
    if (ALL_BP_RETIRED_KEYS.includes(canonical) || columns.has(canonical)) return;
    columns.set(canonical, newColumn(canonical, label));
  };
  DEFAULT_COLUMN_KEYS.forEach((key) => add(HEADER_LABELS[key]));
  ALL_BP_KNOWN_HEADERS.forEach(add);
  return [...columns.values(), ...SYSTEM_COLUMNS];
})();
const savedColumns = () => {
  try {
    const selected = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return Array.isArray(selected) && selected.length && selected.every((key) => typeof key === 'string')
      ? selected : DEFAULT_COLUMN_KEYS.map((key) => `src:${key}`);
  } catch {
    return DEFAULT_COLUMN_KEYS.map((key) => `src:${key}`);
  }
};

/** Server-side paged PO picker. Selection survives search, column changes and page changes. */
export default function ShippingSchedulePoPicker({ open, orderId, factoryCode, date = '', lockedDate = false,
  knownDates = [], onClose, onSaved }) {
  const [shippingDate, setShippingDate] = useState(date || '');
  const [selected, setSelected] = useState([]);
  const [existing, setExisting] = useState([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState({ search: '', filters: initialFilters() });
  const [candidates, setCandidates] = useState(firstPage);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(savedColumns);
  const [discoveredColumns, setDiscoveredColumns] = useState([]);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const existingRef = useRef(0);
  const knownDatesKey = knownDates.join(',');

  useEffect(() => {
    if (!open) { requestRef.current += 1; existingRef.current += 1; return; }
    setShippingDate(date || ''); setSelected([]); setSearch(''); setFilters(initialFilters());
    setQuery({ search: '', filters: initialFilters() }); setCandidates(firstPage());
    setExisting([]); setFiltersOpen(false); setError(''); setDiscoveredColumns([]);
    setColumnMenuAnchor(null);
  }, [open, date, factoryCode, orderId]);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumnKeys)); } catch { /* optional persistence */ }
  }, [visibleColumnKeys]);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => setQuery({ search: search.trim(), filters }), 300);
    return () => window.clearTimeout(id);
  }, [open, search, filters]);

  useEffect(() => {
    if (!open) return undefined;
    const token = ++existingRef.current;
    setExisting([]); setSelected([]);
    setCheckingExisting(Boolean(shippingDate && knownDates.includes(shippingDate)));
    if (!shippingDate || !knownDates.includes(shippingDate)) return undefined;
    getPoShippingDay(orderId, shippingDate, factoryCode).then((result) => {
      if (token === existingRef.current) setExisting((result.pos || []).map((po) => po.id));
    }).catch((e) => {
      if (token === existingRef.current) setError(errText(e, 'Unable to check existing Shipping Date POs.'));
    }).finally(() => {
      if (token === existingRef.current) setCheckingExisting(false);
    });
    return () => { existingRef.current += 1; };
  }, [open, shippingDate, orderId, factoryCode, knownDatesKey]);

  const loadCandidates = useCallback(async (page = 0, size = rowsPerPage) => {
    if (!open || !orderId || !factoryCode) return;
    const token = ++requestRef.current;
    setCandidates((previous) => ({ ...previous, page, size, loading: true }));
    try {
      const result = await listManagedPos(BUYER_CODE.LULULEMON, orderId, {
        search: query.search, ...query.filters, factory: factoryCode, shippingScheduled: false, page, size
      });
      if (requestRef.current !== token) return;
      const rows = result?.content || [];
      setCandidates({ rows, count: Number(result?.totalElements || 0), page, size, loading: false });
      setDiscoveredColumns((previous) => {
        const seen = new Set([...knownColumns, ...previous].map((column) => column.key));
        const additional = [];
        const include = (label) => {
          const canonical = canonicalSourceKey(label);
          const column = newColumn(canonical, label);
          if (!ALL_BP_RETIRED_KEYS.includes(canonical) && !seen.has(column.key)) {
            seen.add(column.key); additional.push(column);
          }
        };
        rows.forEach((row) => {
          (row.allBpHeaders || []).forEach(include);
          (row.allBpRows || []).forEach((sourceRow) => Object.keys(sourceRow || {}).forEach(include));
        });
        return additional.length ? [...previous, ...additional] : previous;
      });
    } catch (e) {
      if (requestRef.current !== token) return;
      setError(errText(e, 'Unable to load POs.'));
      setCandidates((previous) => ({ ...previous, loading: false }));
    }
  }, [open, orderId, factoryCode, query, rowsPerPage]);

  useEffect(() => {
    if (open) loadCandidates(0, rowsPerPage);
    return () => { requestRef.current += 1; };
  }, [open, loadCandidates, rowsPerPage]);

  const allColumns = useMemo(() => [...knownColumns, ...discoveredColumns], [discoveredColumns]);
  const visibleColumns = useMemo(() => {
    const selectedKeys = new Set(visibleColumnKeys);
    const result = allColumns.filter((column) => selectedKeys.has(column.key));
    return result.length ? result : allColumns.filter((column) => DEFAULT_COLUMN_KEYS.some((key) => column.key === `src:${key}`));
  }, [allColumns, visibleColumnKeys]);
  const visibleCount = visibleColumns.length;
  const tableMinWidth = useMemo(() => Math.max(950,
    visibleColumns.reduce((sum, column) => sum + column.minWidth, SELECT_COLUMN_WIDTH)), [visibleColumns]);
  const toggleColumn = (key) => setVisibleColumnKeys((current) => {
    const next = new Set(current);
    if (next.has(key)) { if (next.size > 1) next.delete(key); }
    else next.add(key);
    return [...next];
  });

  const existingSet = useMemo(() => new Set(existing), [existing]);
  const selectedIds = useMemo(() => new Set(selected.map((po) => po.id)), [selected]);
  const selectableRows = candidates.rows.filter((row) => cleanId(row) && !existingSet.has(cleanId(row)));
  const selectedOnPage = selectableRows.filter((row) => selectedIds.has(cleanId(row))).length;
  const allSelected = Boolean(selectableRows.length && selectedOnPage === selectableRows.length);
  const toggle = (row) => {
    const id = cleanId(row);
    if (!id || existingSet.has(id)) return;
    setSelected((current) => current.some((po) => po.id === id)
      ? current.filter((po) => po.id !== id)
      : current.length >= 200 ? current : [...current, { id, poNumber: row.poNumber }]);
  };
  const togglePage = () => {
    const ids = new Set(selectableRows.map(cleanId));
    if (allSelected) setSelected((previous) => previous.filter((po) => !ids.has(po.id)));
    else setSelected((previous) => {
      const already = new Set(previous.map((po) => po.id));
      const addition = selectableRows.filter((row) => !already.has(cleanId(row)))
        .slice(0, Math.max(0, 200 - previous.length))
        .map((row) => ({ id: cleanId(row), poNumber: row.poNumber }));
      return [...previous, ...addition];
    });
  };

  const save = async () => {
    if (saving || checkingExisting || !shippingDate || !selected.length) return;
    setSaving(true); setError('');
    try {
      const result = await schedulePoShippingDate(orderId, {
        shippingDate, poIds: selected.map((po) => po.id)
      });
      await onSaved(shippingDate, result);
    } catch (e) {
      setError(errText(e, 'Save failed. Review the selected POs and try again.'));
      await loadCandidates(candidates.page, candidates.size);
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={() => { if (!saving) onClose(); }} fullWidth maxWidth={false}
    PaperProps={{ sx: { width: 'min(1520px, 98vw)', height: 'min(825px, 94dvh)', maxWidth: 'none',
      maxHeight: '94dvh', display: 'flex', flexDirection: 'column' } }}>
    <DialogTitle sx={{ fontWeight: 850, py: 1.5 }}>
      {lockedDate ? 'Add POs to Shipping Schedule' : 'New Shipping Schedule'}
    </DialogTitle>
    <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1,
      minHeight: 0, flex: 1, overflow: 'hidden', px: { xs: 1.5, md: 2 }, py: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
        <TextField label="Shipping Date" size="small" type="date" required value={shippingDate}
          disabled={lockedDate || saving} onChange={(e) => setShippingDate(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={{ minWidth: 195 }} />
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Select POs not yet assigned to any Shipping Schedule in this Order.
        </Typography>
        <Chip size="small" variant="outlined" label={`${selected.length} selected · Max 200`} />
      </Stack>
      {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <TextField size="small" label="Search POs" placeholder="PO, Master PO, Style, SKU…"
          sx={{ minWidth: 220, flex: '1 1 300px' }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant={filtersOpen ? 'contained' : 'outlined'} size="small"
          onClick={() => setFiltersOpen((value) => !value)}>
          Filters{Object.values(filters).some((value) => String(value).trim()) ? ' · Active' : ''}
        </Button>
        <Button variant="outlined" size="small" startIcon={<ViewColumnOutlined />}
          onClick={(event) => setColumnMenuAnchor(event.currentTarget)}>
          Columns {visibleCount}/{allColumns.length}
        </Button>
        <Menu anchorEl={columnMenuAnchor} open={Boolean(columnMenuAnchor)} onClose={() => setColumnMenuAnchor(null)}
          PaperProps={{ sx: { maxHeight: 490, minWidth: 275 } }}>
          <MenuItem onClick={() => setVisibleColumnKeys(DEFAULT_COLUMN_KEYS.map((key) => `src:${key}`))}>
            Default columns (8)
          </MenuItem>
          <MenuItem onClick={() => setVisibleColumnKeys(allColumns.map((column) => column.key))}>
            Show all {allColumns.length} columns
          </MenuItem>
          <Divider />
          {allColumns.map((column) => <MenuItem key={column.key} dense onClick={() => toggleColumn(column.key)}>
            <Checkbox size="small" checked={visibleColumns.some((item) => item.key === column.key)} />
            <ListItemText primary={column.title} secondary={column.group} />
          </MenuItem>)}
        </Menu>
      </Stack>
      {filtersOpen ? <Box sx={{ p: 1, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <TableFilterBar fields={FILTER_FIELDS} values={filters}
          onChange={(key, value) => setFilters((previous) => ({ ...previous, [key]: value }))}
          onClear={() => { setFilters(initialFilters()); setSearch(''); }} />
      </Box> : null}
      <TableContainer sx={{ flex: '1 1 auto', minHeight: 145, overflow: 'auto',
        border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
        <Table stickyHeader size="small" sx={{ minWidth: tableMinWidth, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: SELECT_COLUMN_WIDTH }} />
            {visibleColumns.map((column) => <col key={column.key} style={{ width: column.minWidth }} />)}
          </colgroup>
          <TableHead><TableRow>
            <TableCell padding="none" align="center" sx={{ width: SELECT_COLUMN_WIDTH,
              minWidth: SELECT_COLUMN_WIDTH, maxWidth: SELECT_COLUMN_WIDTH,
              padding: '0 !important', boxSizing: 'border-box' }}>
              <Checkbox size="small" sx={{ padding: '6px' }} checked={allSelected}
                indeterminate={selectedOnPage > 0 && !allSelected}
                disabled={checkingExisting || !selectableRows.length || candidates.loading}
                onChange={togglePage} inputProps={{ 'aria-label': 'Select POs on current page' }} />
            </TableCell>
            {visibleColumns.map((column) => <TableCell key={column.key}
              sx={{ fontWeight: 800, minWidth: column.minWidth, width: column.minWidth, whiteSpace: 'nowrap' }}>
              {column.title}
            </TableCell>)}
          </TableRow></TableHead>
          <TableBody>
            {candidates.loading ? <TableRow><TableCell colSpan={visibleCount + 1} align="center">
              <CircularProgress size={22} />
            </TableCell></TableRow> : candidates.rows.map((row) => {
              const id = cleanId(row); const excluded = existingSet.has(id);
              return <TableRow key={id} hover selected={selectedIds.has(id)}
                onClick={() => { if (!checkingExisting && !excluded) toggle(row); }}
                sx={{ cursor: excluded ? 'default' : 'pointer' }}>
                <TableCell padding="none" align="center" sx={{ width: SELECT_COLUMN_WIDTH,
                  minWidth: SELECT_COLUMN_WIDTH, maxWidth: SELECT_COLUMN_WIDTH,
                  padding: '0 !important', boxSizing: 'border-box' }}>
                  <Checkbox size="small" sx={{ padding: '6px' }} checked={selectedIds.has(id)}
                  disabled={excluded || checkingExisting || (!selectedIds.has(id) && selected.length >= 200)}
                  onChange={() => toggle(row)} onClick={(e) => e.stopPropagation()}
                  inputProps={{ 'aria-label': excluded ? 'Already in this Shipping Date' : `Select ${row.poNumber}` }} />
                </TableCell>
                {visibleColumns.map((column) => {
                  const value = column.canonical ? sourceValue(row, column.canonical) : column.value(row);
                  const text = String(value ?? '—');
                  return <TableCell key={column.key} title={text}
                    sx={{ width: column.minWidth, maxWidth: column.minWidth, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {text}{excluded && column.canonical === 'PO' ? ' · Already added' : ''}
                  </TableCell>;
                })}
              </TableRow>;
            })}
            {!candidates.loading && !candidates.rows.length ? <TableRow>
              <TableCell colSpan={visibleCount + 1} align="center" sx={{ py: 3 }}>No POs found.</TableCell>
            </TableRow> : null}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={candidates.count} page={candidates.page} rowsPerPage={candidates.size}
        rowsPerPageOptions={[10, 25, 50, 100]}
        sx={{ flexShrink: 0, '.MuiTablePagination-toolbar': { minHeight: 40 } }}
        onPageChange={(_, page) => loadCandidates(page, candidates.size)}
        onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))} />
      {selected.length ? <Stack direction="row" flexWrap="wrap" gap={0.5}
        sx={{ flex: '0 0 auto', maxHeight: 57, overflowY: 'auto' }}>
        {selected.map((po) => <Chip key={po.id} size="small" label={po.poNumber || po.id}
          onDelete={() => setSelected((current) => current.filter((item) => item.id !== po.id))} />)}
      </Stack> : null}
    </DialogContent>
    <DialogActions sx={{ p: 1.5, flexShrink: 0 }}>
      <Button disabled={saving} onClick={onClose}>Cancel</Button>
      <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <LocalShippingOutlined />}
        disabled={saving || checkingExisting || !shippingDate || !selected.length} onClick={save}>
        {saving ? 'Saving…' : `Save (${selected.length} PO${selected.length === 1 ? '' : 's'})`}
      </Button>
    </DialogActions>
  </Dialog>;
}
