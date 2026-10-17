import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, Collapse, Dialog, IconButton,
  DialogActions, DialogContent, DialogTitle, Divider, Menu, MenuItem,
  Paper, Stack, Tab, Table, TableBody, TableCell, TableHead,
  TablePagination, TableRow, Tabs, TextField, Tooltip, Typography
} from '@mui/material';
import { CheckCircleOutline, Clear, ExpandLess, ExpandMore, FilterAlt, Refresh, Search, ViewColumn } from '@mui/icons-material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import OrderScope from '../components/OrderScope';
import LululemonTableViewport from '../components/LululemonTableViewport';
import { listAllPos } from '../services/purchaseOrders';
import { listPoPicks, pickPo, unpickPo, poPickHistory } from '../services/poPicking';
import { canAssignBarcode, getFactoryPermissions, isAdmin, readStoredUser } from 'utils/accessControl';
import { augmentPoRows, eligiblePoNumbers,
  optionValues, poColumns, sourceValue, pickListView, pickedPoSearchMatches, groupPoNumberRows, norm } from '../domain/poPickingView';

const ALL_FACTORIES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];
const FILTER_FIELDS = [
  { key: 'factory', label: 'Factory', get: (r) => r.factoryCode },
  { key: 'pickedBy', label: 'Picked by', get: (r) => r.pickedBy },
  { key: 'poStatus', label: 'PO Status', get: (r) => r.status },
  { key: 'style', label: 'Style', get: (r) => r.styleNumber || r.style },
  { key: 'sku', label: 'SKU', get: (r) => r.sku },
  { key: 'destination', label: 'Destination', get: (r) => r.destination },
  { key: 'exFty', label: 'Ex-Factory', get: (r) => String(r.exFtyDate || '').slice(0, 10) },
  { key: 'shipMode', label: 'Ship Mode', get: (r) => r.shipMode },
  { key: 'masterPo', label: 'Master PO', get: (r) => r.masterPo },
  { key: 'color', label: 'Color', get: (r) => r.color },
  { key: 'season', label: 'Season', get: (r) => r.season },
  { key: 'dcCode', label: 'DC Code', get: (r) => r.dcCode }
];
const errorText = (e) => e?.response?.data?.message || e?.message || 'Operation failed';
const factoryStorageKey = (email) => `lululemon.po-picking.factory.${email || 'anonymous'}`;
const PICKING_COLUMN_KEY = 'lululemon.po-picking.visible-columns';
const emptyFilters = () => ({});
// A compact operational default; users can still choose any ALL_BP column.
const COMPACT_PO_COLUMNS = ['src:PO', 'src:MASTER_PO', 'src:STYLE', 'sys:sku', 'src:DESTINATION', 'sys:exFtyDate', 'sys:factory', 'sys:status'];
const UI_STATE_KEY = 'lululemon.po-picking.ui.v15';
const LEGACY_UI_STATE_KEY = 'lululemon.po-picking.ui.v14';
const readUiState = () => {
  try {
    const current = sessionStorage.getItem(UI_STATE_KEY);
    const state = JSON.parse(current || sessionStorage.getItem(LEGACY_UI_STATE_KEY) || 'null');
    if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
    // Keep PO search/tab preferences from V14; open the compact UI collapsed on upgrade.
    return { ...state, showAdvanced: current ? Boolean(state.showAdvanced) : false };
  } catch { return {}; }
};

function MultiValueFilter({ field, rows, choices, onChange }) {
  const options = useMemo(() => optionValues(rows, field.get), [rows, field]);
  return (
    <Autocomplete
      multiple disableCloseOnSelect size="small" options={options}
      value={(choices || []).filter((x) => options.includes(x))}
      onChange={(_, selected) => onChange(field.key, selected)}
      limitTags={1} noOptionsText="No values"
      renderInput={(params) => <TextField {...params} label={field.label} placeholder={choices?.length ? '' : 'All'} />}
      sx={{ minWidth: 0, width: '100%', maxWidth: '100%', '& .MuiAutocomplete-tag': { maxWidth: '60%' } }}
    />
  );
}

/** PO Picking shows one selectable PO; original ALL_BP rows remain accessible under Details. */
export default function PoPickingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { buyerSlug } = useParams();
  const [uiInitial] = useState(readUiState);
  const [orderId, setOrderId] = useState(() => new URLSearchParams(window.location.search).get('orderId') || '');
  const [pos, setPos] = useState([]);
  const [claims, setClaims] = useState([]);
  const [filter, setFilter] = useState(() => uiInitial.filter || 'ALL');
  const [view, setView] = useState(() => ['POOL', 'FACTORY', 'LOOKUP'].includes(uiInitial.view) ? uiInitial.view : 'POOL'); // shared, selected Factory, or global lookup
  const [poNumbers, setPoNumbers] = useState(() => uiInitial.poNumbers || '');
  const [multi, setMulti] = useState(() => uiInitial.multi && typeof uiInitial.multi === 'object' ? uiInitial.multi : emptyFilters());
  const [expandedPos, setExpandedPos] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(uiInitial.showAdvanced));
  const [checked, setChecked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState(null);
  const [unpickTarget, setUnpickTarget] = useState(null);
  const [unpickReason, setUnpickReason] = useState('');
  const [unpickError, setUnpickError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(() => [10, 25, 50, 100].includes(uiInitial.rowsPerPage) ? uiInitial.rowsPerPage : 25);
  // Preserve harmless view/filter preferences when navigating away and back.
  useEffect(() => {
    try { sessionStorage.setItem(UI_STATE_KEY, JSON.stringify({ view, filter, poNumbers, multi, showAdvanced, rowsPerPage })); }
    catch { /* Session storage may be unavailable. */ }
  }, [view, filter, poNumbers, multi, showAdvanced, rowsPerPage]);
  const [columnAnchor, setColumnAnchor] = useState(null);
  const tableHostRef = useRef(null);
  const [columns, setColumns] = useState(() => {
    try { const stored = JSON.parse(localStorage.getItem(PICKING_COLUMN_KEY) || 'null'); return Array.isArray(stored) ? stored : null; }
    catch { return null; }
  });

  const user = readStoredUser();
  const myEmail = String(user?.email || '').trim().toLowerCase();
  const admin = isAdmin();
  const packing = canAssignBarcode();
  // Use packing permissions, NOT weighing permissions. An F2 packing user never
  // has to select F2 manually; if multiple factories are granted, tabs set context.
  const grantedFactories = admin ? ALL_FACTORIES : getFactoryPermissions().filter((f) => ALL_FACTORIES.includes(f));
  const factoryFromUrl = new URLSearchParams(location.search).get('factory')?.toUpperCase() || '';
  const savedFactory = localStorage.getItem(factoryStorageKey(myEmail)) || '';
  const activeFactory = grantedFactories.includes(factoryFromUrl) ? factoryFromUrl
    : grantedFactories.includes(savedFactory) ? savedFactory : grantedFactories[0] || '';

  const changeWorkingOrder = (nextOrderId) => {
    if (nextOrderId === orderId) return;
    setOrderId(nextOrderId);
    setPoNumbers('');
    setFilter('ALL');
    setMulti(emptyFilters());
    setChecked([]);
    const params = new URLSearchParams(location.search);
    if (nextOrderId) params.set('orderId', nextOrderId); else params.delete('orderId');
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
  };
  // Browser navigation and direct links must restore the correct Order scope.
  useEffect(() => {
    const urlOrder = new URLSearchParams(location.search).get('orderId') || '';
    setOrderId((previous) => urlOrder || previous);
  }, [location.search]);

  const switchFactory = (next) => {
    if (!grantedFactories.includes(next)) return;
    localStorage.setItem(factoryStorageKey(myEmail), next);
    const params = new URLSearchParams(location.search);
    params.set('factory', next);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
  };

  const load = useCallback(async () => {
    if (!orderId) { setPos([]); setClaims([]); return; }
    setLoading(true);
    try {
      const [pickList, fullPoList] = await Promise.all([listPoPicks(orderId), listAllPos(orderId)]);
      setClaims(pickList);
      setPos(fullPoList);
    } catch (e) { setMessage({ type: 'error', text: errorText(e) }); }
    finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setChecked([]); setPage(0); setExpandedPos([]); }, [orderId, activeFactory, view, filter, poNumbers, multi]);
  // A previously horizontally scrolled table must not reopen half-way across
  // its columns after switching between Shared, Factory and Lookup.
  useEffect(() => {
    const viewport = tableHostRef.current?.querySelector('.MuiTableContainer-root');
    if (viewport) viewport.scrollLeft = 0;
  }, [orderId, activeFactory, view]);

  const rows = useMemo(() => augmentPoRows(pos, claims), [pos, claims]);
  // The shared list must NEVER contain a claimed PO. Factory list shows PO
  // claimed by that Factory; lookup is the only general view of every PO.
  const visible = useMemo(() => pickListView(rows, {
    view, activeFactory, filter, poNumbers, multi, myEmail
  }), [rows, view, activeFactory, filter, poNumbers, multi, myEmail]);
  // A Packing searching a PO in the shared list gets the owner information
  // even though that PO is intentionally absent from the unpicked table.
  const assignedSearchResults = useMemo(() => pickedPoSearchMatches(rows, {
    view, poNumbers
  }), [rows, view, poNumbers]);
  // Pagination and selection are by PO Number rather than by repeated ALL_BP lines.
  const poGroups = useMemo(() => groupPoNumberRows(visible), [visible]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(poGroups.length / rowsPerPage) - 1));
  const paged = useMemo(() => poGroups.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage), [poGroups, safePage, rowsPerPage]);
  const availablePo = useMemo(() => view === 'POOL' && packing
    ? eligiblePoNumbers(rows, activeFactory, visible) : [], [view, visible, rows, activeFactory, packing]);
  const availableSet = useMemo(() => new Set(availablePo), [availablePo]);
  const allColumns = useMemo(() => poColumns(rows), [rows]);
  const visibleColumns = useMemo(() => {
    const selected = new Set(columns ?? COMPACT_PO_COLUMNS);
    const priority = ['src:PO', 'src:MASTER_PO', 'src:STYLE', 'sys:sku', 'src:DESTINATION', 'sys:exFtyDate', 'sys:factory', 'sys:status'];
    return allColumns.filter((col) => col.key === 'src:PO' || selected.has(col.key)).sort((a, b) => {
      const i = priority.indexOf(a.key);
      const j = priority.indexOf(b.key);
      return (i < 0 ? priority.length : i) - (j < 0 ? priority.length : j);
    });
  }, [allColumns, columns]);
  // PO Number is the permanent row identifier, never hidden even if an old
  // localStorage column preference deselected it.
  const detailColumns = visibleColumns.filter((col) => col.key !== 'src:PO');
  const detailWidths = useMemo(() => detailColumns.map((col) => {
    const label = String(col.label || '').toLowerCase();
    if (label.includes('description') || label.includes('destination')) return 215;
    if (label.includes('style')) return 178;
    if (label.includes('sku')) return 164;
    return Math.max(138, Number(col.minWidth) || 138);
  }), [detailColumns]);
  // Explicit table column widths are important: a large number of ALL_BP
  // fields previously made the browser compress/overlay the Assignment column.
  const tableWidth = 52 + 54 + 250 + detailWidths.reduce((sum, width) => sum + width, 0) + 216;
  const orderGroups = useMemo(() => groupPoNumberRows(rows), [rows]);
  const orderTotal = orderGroups.length;
  const orderPicked = orderGroups.filter((group) => group.lines.some((line) => line.pickStatus !== 'UNPICKED')).length;
  const orderUnpicked = orderTotal - orderPicked;
  const pickedCount = orderPicked;
  const factoryPickedCount = useMemo(() => claims.filter((r) => r.pickStatus === 'ACTIVE' && norm(r.factoryCode) === norm(activeFactory)).length, [claims, activeFactory]);
  const advancedCount = (poNumbers.trim() ? 1 : 0) + (filter !== 'ALL' ? 1 : 0) + Object.values(multi).filter((values) => values?.length).length;
  const filteredPoCount = poGroups.length;

  const setMultiField = (key, value) => setMulti((previous) => ({ ...previous, [key]: value }));
  const resetFilters = () => { setPoNumbers(''); setFilter('ALL'); setMulti(emptyFilters()); };
  const toggleColumn = (key) => setColumns((old) => {
    const set = new Set(old ?? DEFAULT_PICKING_COLUMNS);
    if (key === 'src:PO') return old;
    if (set.has(key) && set.size > 1) set.delete(key);
    else set.add(key);
    const values = [...set]; localStorage.setItem(PICKING_COLUMN_KEY, JSON.stringify(values));
    return values;
  });
  const updateColumns = (values) => { setColumns(values); localStorage.setItem(PICKING_COLUMN_KEY, JSON.stringify(values)); };
  const toggle = (po) => setChecked((previous) => previous.includes(po) ? previous.filter((p) => p !== po) : [...previous, po]);

  const pickSelected = async () => {
    if (!packing || !activeFactory || !checked.length || working) return;
    // Revalidate the visible selected set, then let BE enforce true concurrent ownership.
    const current = checked.filter((po) => availableSet.has(po));
    if (!current.length) return;
    setWorking(true);
    try {
      const results = await Promise.allSettled(current.map((po) => pickPo(orderId, po, activeFactory)));
      const failed = results.filter((r) => r.status === 'rejected');
      setChecked([]);
      setMessage({ type: failed.length ? 'warning' : 'success', text: `${results.length - failed.length} PO picked for ${activeFactory}. ${failed.length} failed.${failed.length ? ` ${errorText(failed[0].reason)}` : ''}` });
      await load();
    } finally { setWorking(false); }
  };
  const pickSingle = async (po) => {
    if (!packing || !orderId || !activeFactory || working || !availableSet.has(po)) return;
    setWorking(true);
    try {
      await pickPo(orderId, po, activeFactory);
      setChecked((previous) => previous.filter((value) => value !== po));
      setMessage({ type: 'success', text: `PO ${po} picked for ${activeFactory}.` });
      await load();
    } catch (e) { setMessage({ type: 'error', text: errorText(e) }); }
    finally { setWorking(false); }
  };
  const showHistory = async (po) => {
    try { setHistory({ po, rows: await poPickHistory(orderId, po) }); }
    catch (e) { setMessage({ type: 'error', text: errorText(e) }); }
  };
  const requestUnpick = (row) => {
    setUnpickTarget({
      poNumber: row.poNumber, pickedBy: row.pickedBy,
      factoryCode: row.factoryCode, pickStatus: row.pickStatus
    });
    setUnpickReason('');
    setUnpickError('');
  };
  const releasingSomeoneElsesPo = Boolean(unpickTarget && norm(unpickTarget.pickedBy) !== norm(myEmail));
  const release = async () => {
    if (!unpickTarget || working || (releasingSomeoneElsesPo && !unpickReason.trim())) return;
    setWorking(true);
    setUnpickError('');
    try {
      await unpickPo(orderId, unpickTarget.poNumber, unpickReason.trim());
      setMessage({ type: 'success', text: `PO ${unpickTarget.poNumber} returned to the shared unpicked list.` });
      setUnpickTarget(null);
      setUnpickReason('');
      await load();
    } catch (e) { setUnpickError(errorText(e)); }
    finally { setWorking(false); }
  };

  const renderCell = (row, col) => {
    if (col.key === 'sys:factory') return row.factoryCode || '—';
    if (col.key === 'sys:status') return <Chip size="small" label={row.status || '—'} variant="outlined" />;
    if (col.key.startsWith('src:')) return sourceValue(row, col.canonical);
    return col.value?.(row) ?? '—';
  };
  const toggleDetails = (poNumber) => setExpandedPos((old) => old.includes(poNumber)
    ? old.filter((number) => number !== poNumber) : [...old, poNumber]);
  // If one PO Number has several source rows, show all their distinct values
  // in its summary rather than silently taking values from the first line.
  const displayGroupCell = (group, col) => {
    const unique = [...new Set(group.lines.map((line) => {
      if (col.key === 'sys:factory') return line.factoryCode || '—';
      if (col.key === 'sys:status') return line.status || '—';
      return String(col.key.startsWith('src:') ? sourceValue(line, col.canonical) : col.value?.(line) ?? '—');
    }))];
    if (unique.length === 1 && col.key === 'sys:status') {
      return <Chip size="small" label={unique[0]} variant="outlined" />;
    }
    const text = unique.join(' | ');
    return <Tooltip title={text}><Typography variant="body2" noWrap sx={{ fontSize: 'inherit' }}>{text}</Typography></Tooltip>;
  };
  const activeFilters = poNumbers || filter !== 'ALL' || Object.values(multi).some((v) => v?.length);
  const viewHelp = view === 'POOL'
    ? 'PO picked by a Factory will automatically leave this shared list.'
    : view === 'FACTORY'
      ? `Only PO assigned to Packing ${activeFactory || '—'} are displayed here.`
      : 'Find any PO, check its current owner and Unpick when permitted.';
  const viewTitle = view === 'POOL' ? 'Available PO' : view === 'FACTORY' ? `Packing ${activeFactory} PO` : 'All PO lookup';
  const tabLabel = (title, count) => <Stack direction="row" spacing={0.8} alignItems="center">
    <span>{title}</span>
    <Box component="span" sx={{ px: 0.8, py: 0.2, borderRadius: 2, bgcolor: '#EDF2F7', color: '#475569', fontSize: 11, fontWeight: 700, lineHeight: 1.5 }}>{count}</Box>
  </Stack>;
  return (
    <Stack spacing={1.25} sx={{ p: { xs: 1, md: 2 }, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* Compact page heading: primary action is selecting the active Order. */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.6} sx={{ px: 0.3, py: 0.1 }}>
        <Typography variant="h5" fontWeight={850} sx={{ lineHeight: 1.15 }}>PO Picking</Typography>
        <Typography variant="caption" color="text.secondary">LULULEMON · Purchase Order Management</Typography>
      </Stack>

      {message && <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ py: 0.2 }}>{message.text}</Alert>}
      {packing && grantedFactories.length === 0 && !admin && (
        <Alert severity="warning">Your Packing account has no assigned Factory. Contact Admin before picking PO.</Alert>
      )}

      {/* One compact workspace: Order + KPIs + PO tabs + Factory context. */}
      <Paper variant="outlined" sx={{ width: '100%', minWidth: 0, borderRadius: 2.5, borderColor: '#DCE5F0', overflow: 'hidden' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' }, gap: { xs: 1, md: 2 }, alignItems: 'center', py: { xs: 1, md: 1.1 }, px: { xs: 1.2, md: 1.7 }, bgcolor: '#F4F8FE' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={850} sx={{ color: '#1D4E85', whiteSpace: 'nowrap', minWidth: 104 }}>Working Order</Typography>
            <Box sx={{ flex: 1, minWidth: { xs: 0, sm: 285 } }}>
              <OrderScope value={orderId} onChange={changeWorkingOrder} embedded compact />
            </Box>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
            {[
              { label: 'Total PO', value: orderTotal, color: '#214678' },
              { label: 'Picked', value: orderPicked, color: '#087F70' },
              { label: 'Unpicked', value: orderUnpicked, color: '#AC5D16' }
            ].map((stat) => <Stack key={stat.label} direction="row" spacing={0.75} alignItems="center"
              sx={{ bgcolor: '#FFF', border: '1px solid #DCE5F0', borderRadius: 1.5, py: 0.65, px: 1.1, whiteSpace: 'nowrap' }}>
              <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
              <Typography variant="subtitle2" fontWeight={900} sx={{ color: stat.color }}>{orderId ? stat.value.toLocaleString() : '—'}</Typography>
            </Stack>)}
          </Stack>
        </Box>
        <Divider />
        <Stack direction={{ xs: 'column', lg: 'row' }} alignItems={{ lg: 'center' }} gap={{ xs: 0.8, lg: 1.5 }}
          sx={{ px: { xs: 1.1, md: 1.7 }, py: 0.6, minWidth: 0 }}>
          <Tabs value={view} onChange={(_, next) => { setView(next); if (next !== 'LOOKUP') setFilter('ALL'); }}
            variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile
            sx={{ minHeight: 37, flexShrink: 1, minWidth: 0, bgcolor: '#F1F5F9', borderRadius: 1.5, p: 0.3,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': { minHeight: 32, borderRadius: 1.1, textTransform: 'none', minWidth: 0,
                fontSize: 12, fontWeight: 800, px: { xs: 0.9, sm: 1.5 }, mx: 0.15 },
              '& .Mui-selected': { bgcolor: '#FFF', color: '#1D4ED8', boxShadow: '0 1px 4px rgba(24,42,71,0.13)' } }}>
            <Tab value="POOL" label={tabLabel('Shared · Unpicked', orderUnpicked)} />
            {packing && <Tab value="FACTORY" label={tabLabel('My Factory', factoryPickedCount)} />}
            <Tab value="LOOKUP" label={tabLabel('All PO', orderTotal)} />
          </Tabs>
          {packing && Boolean(activeFactory) && <Stack direction="row" alignItems="center" gap={0.8} flexWrap="wrap" sx={{ ml: { lg: 'auto' }, flexShrink: 0 }}>
            <Typography variant="caption" fontWeight={800} sx={{ color: '#475569', whiteSpace: 'nowrap' }}>Factory</Typography>
            {grantedFactories.length === 1
              ? <Chip label={activeFactory} color="primary" size="small" variant="outlined" sx={{ fontWeight: 800 }} />
              : grantedFactories.map((f) => <Button key={f} size="small" aria-pressed={activeFactory === f}
                  variant={activeFactory === f ? 'contained' : 'outlined'} onClick={() => switchFactory(f)}
                  sx={{ minWidth: 37, height: 30, px: 0.8, borderRadius: 1.2, fontWeight: 800, fontSize: 12 }}>{f}</Button>)}
          </Stack>}
        </Stack>
      </Paper>

      {/* One-line search with actions: advanced filters only consume space on demand. */}
      <Paper variant="outlined" sx={{ width: '100%', minWidth: 0, borderRadius: 2.5, borderColor: '#E1E7EF', p: { xs: 1, md: 1.2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={0.6} sx={{ mb: 0.8 }}>
          <Typography variant="subtitle2" fontWeight={850}>Search & Filters</Typography>
          <Stack direction="row" alignItems="center" gap={0.35} flexWrap="wrap">
            {advancedCount > 0 && <Chip size="small" label={`${advancedCount} active`} color="primary" variant="outlined" />}
            <Button size="small" variant="text" startIcon={<Refresh />} onClick={load} disabled={loading || working || !orderId}>Refresh</Button>
            <Button size="small" color="inherit" startIcon={<Clear />} disabled={!advancedCount} onClick={resetFilters}>Reset</Button>
            <Button size="small" startIcon={<FilterAlt />} onClick={() => setShowAdvanced((x) => !x)} aria-expanded={showAdvanced}>
              {showAdvanced ? 'Less Filters' : 'More Filters'}
            </Button>
          </Stack>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2.2fr) repeat(2, minmax(0, 1fr))' }, gap: 0.85, '& > *': { minWidth: 0 } }}>
          <TextField size="small" label="PO Numbers (Multiple)" value={poNumbers}
            onChange={(e) => setPoNumbers(e.target.value)} fullWidth
            placeholder="Search PO numbers, separated by commas" inputProps={{ 'aria-label': 'Search multiple PO numbers' }}
            InputProps={{ startAdornment: <Search fontSize="small" sx={{ color: '#64748B', mr: 0.7 }} /> }} />
          <MultiValueFilter field={FILTER_FIELDS.find((field) => field.key === 'poStatus')} rows={rows}
            choices={multi.poStatus} onChange={setMultiField} />
          <MultiValueFilter field={FILTER_FIELDS.find((field) => field.key === 'factory')} rows={rows}
            choices={multi.factory} onChange={setMultiField} />
        </Box>
        <Collapse in={showAdvanced} unmountOnExit>
          <Divider sx={{ my: 1.1 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 0.85, '& > *': { minWidth: 0 } }}>
            {view === 'LOOKUP' && <TextField select size="small" label="Pick status" value={filter} onChange={(e) => setFilter(e.target.value)}>
              {[['ALL', 'All PO'], ['UNPICKED', 'Not picked'], ['PICKED', 'Already picked'], ['MINE', 'Picked by me'], ['OTHERS', 'Picked by others']]
                .map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>}
            {FILTER_FIELDS.filter((field) => !['poStatus', 'factory'].includes(field.key)).map((field) =>
              <MultiValueFilter key={field.key} field={field} rows={rows} choices={multi[field.key]} onChange={setMultiField} />)}
          </Box>
        </Collapse>
      </Paper>

      {/* Cross-Factory lookup warning is only displayed for relevant searches. */}
      {assignedSearchResults.length > 0 && <Alert severity="warning" sx={{ borderRadius: 2, py: 0.5 }}>
        <Typography fontWeight={750} variant="body2">Already picked by another Packing</Typography>
        <Stack spacing={0.6} sx={{ mt: 0.7 }}>
          {assignedSearchResults.slice(0, 8).map((row) => <Stack key={row.poNumber} direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }} spacing={1} sx={{ py: 0.4 }}>
            <Typography variant="body2" fontWeight={750} sx={{ minWidth: 110 }}>{row.poNumber}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {row.factoryCode || '—'} · {row.pickedBy || '—'}
            </Typography>
            <Stack direction="row" spacing={0.6}>
              <Button size="small" onClick={() => { setView('LOOKUP'); setPoNumbers(row.poNumber); setShowAdvanced(true); }}>View PO</Button>
              {packing && row.pickStatus === 'ACTIVE' && <Button size="small" variant="outlined" color="warning"
                disabled={working} onClick={() => requestUnpick(row)}>Unpick</Button>}
              {row.pickStatus === 'LEGACY_PICKED' && <Typography variant="caption" color="text.secondary">Contact Admin</Typography>}
            </Stack>
          </Stack>)}
          {assignedSearchResults.length > 8 && <Typography variant="caption">Showing 8 of {assignedSearchResults.length} results. Search a specific PO to narrow down.</Typography>}
        </Stack>
      </Alert>}

      {/* Results and actions in one compact surface. */}
      <Paper variant="outlined" sx={{ width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', borderRadius: 2.5, borderColor: '#E1E7EF', overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between"
          spacing={1} sx={{ px: { xs: 1.3, md: 1.8 }, py: 1.1 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1" fontWeight={800}>{viewTitle}</Typography>
              <Typography variant="body2" color="text.secondary">{filteredPoCount} PO · {visible.length} source rows</Typography>
              {checked.length > 0 && <Chip size="small" color="primary" label={`${checked.length} selected`} />}
            </Stack>
            <Typography variant="caption" color="text.secondary">{viewHelp}</Typography>
          </Box>
          <Stack direction="row" spacing={0.7} alignItems="center" useFlexGap flexWrap="wrap" sx={{ flexShrink: 0 }}>
            <Button size="small" color="inherit" variant="outlined" startIcon={<ViewColumn />} onClick={(e) => setColumnAnchor(e.currentTarget)}>
              Columns ({visibleColumns.length})
            </Button>
            {packing && view === 'POOL' && <Button size="small" variant="contained" startIcon={<CheckCircleOutline />}
              disabled={!checked.length || !orderId || !activeFactory || working} onClick={pickSelected}>
              Pick {checked.length} PO {activeFactory ? `→ ${activeFactory}` : ''}
            </Button>}
          </Stack>
        </Stack>
        <Menu anchorEl={columnAnchor} open={Boolean(columnAnchor)} onClose={() => setColumnAnchor(null)} PaperProps={{ sx: { maxHeight: 460, width: 280 } }}>
          <MenuItem onClick={() => { updateColumns([...COMPACT_PO_COLUMNS]); setColumnAnchor(null); }}>Recommended compact columns</MenuItem>
          <MenuItem onClick={() => updateColumns(allColumns.map((col) => col.key))}>Show all ALL_BP columns</MenuItem>
          <Divider />
          {allColumns.map((col) => <MenuItem dense key={col.key} onClick={() => toggleColumn(col.key)}>
            <Checkbox size="small" disabled={col.key === 'src:PO'} checked={visibleColumns.some((item) => item.key === col.key)} />
            <Typography variant="body2" noWrap>{col.label}</Typography>
          </MenuItem>)}
        </Menu>
        <Divider />
        {/* Checkbox + STT + PO identifier stay fixed horizontally. Previously PO
            was laid over the independently scrolling Assignment column, which
            clipped the Picked badge and owner name after horizontal scroll. */}
        <Box ref={tableHostRef} sx={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          <LululemonTableViewport sx={{ width: '100%', maxWidth: '100%', minWidth: 0,
            overflowX: 'auto', overflowY: 'auto', maxHeight: { xs: 480, md: 'calc(100dvh - 235px)' }, boxSizing: 'border-box',
            border: 0, borderRadius: 0, scrollbarGutter: 'auto' }}>
            <Table className="po-picking-main-table" size="small" stickyHeader sx={{ width: tableWidth, minWidth: '100%',
              '--po-pick-checkbox': { xs: '44px', md: '52px' },
              '--po-pick-stt': { xs: '45px', md: '54px' },
              '--po-pick-number': { xs: '184px', md: '250px' },
              tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0,
              '& .MuiTableCell-root': { boxSizing: 'border-box', overflow: 'hidden' },
              '& .MuiTableCell-head': { bgcolor: '#F7F9FC', color: '#475569', fontWeight: 800,
                fontSize: 12.5, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis' },
              '& .MuiTableCell-body': { py: 0.75, borderColor: '#D6E0EA', fontSize: 12.5 } }}>
              <colgroup>
                <col style={{ width: "var(--po-pick-checkbox)" }} />
                <col style={{ width: "var(--po-pick-stt)" }} />
                <col style={{ width: "var(--po-pick-number)" }} />
                {detailWidths.map((width, i) => <col key={detailColumns[i].key} style={{ width }} />)}
                <col style={{ width: 216 }} />
              </colgroup>
              <TableHead><TableRow>
                <TableCell padding="checkbox" sx={{ width: 'var(--po-pick-checkbox)', minWidth: 'var(--po-pick-checkbox)', maxWidth: 'var(--po-pick-checkbox)',
                  position: 'sticky', left: 0, zIndex: '6 !important', bgcolor: '#F7F9FC !important',
                  boxShadow: '1px 0 0 #E2E8F0' }}>
                  <Checkbox disabled={view !== 'POOL' || !packing || !availablePo.length || working}
                    checked={!!availablePo.length && availablePo.every((po) => checked.includes(po))}
                    indeterminate={checked.length > 0 && checked.length < availablePo.length}
                    onChange={(e) => setChecked(e.target.checked ? availablePo : [])} />
                </TableCell>
                <TableCell sx={{ width: 'var(--po-pick-stt)', minWidth: 'var(--po-pick-stt)', maxWidth: 'var(--po-pick-stt)',
                  position: 'sticky', left: 'var(--po-pick-checkbox)', zIndex: '6 !important', textAlign: 'center', bgcolor: '#F7F9FC !important',
                  boxShadow: '1px 0 0 #E2E8F0' }}>STT</TableCell>
                <TableCell sx={{ width: 'var(--po-pick-number)', minWidth: 'var(--po-pick-number)', maxWidth: 'var(--po-pick-number)',
                  position: 'sticky', left: 'calc(var(--po-pick-checkbox) + var(--po-pick-stt))', zIndex: '6 !important', bgcolor: '#F7F9FC !important',
                  boxShadow: '2px 0 0 #DDE6F0' }}>PO Number / Assignment</TableCell>
                {detailColumns.map((col, i) => <TableCell key={col.key} sx={{ width: detailWidths[i],
                  minWidth: detailWidths[i], maxWidth: detailWidths[i] }}>{col.label}</TableCell>)}
                <TableCell sx={{ width: 216, minWidth: 216, maxWidth: 216 }}>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {paged.map((group, index) => {
                  const row = group.lines[0];
                  const expanded = expandedPos.includes(group.poNumber);
                  const available = view === 'POOL' && packing && availableSet.has(group.poNumber);
                  const canRelease = row.pickStatus === 'ACTIVE' && (admin || packing);
                  const pinnedBg = index % 2 ? '#F8FAFD' : '#FFF';
                  return <Fragment key={group.poNumber}>
                    <TableRow key={`${group.poNumber}-main`} hover sx={{ bgcolor: pinnedBg }}>
                      <TableCell padding="checkbox" sx={{ position: 'sticky', left: 0, zIndex: 2,
                        width: 'var(--po-pick-checkbox)', minWidth: 'var(--po-pick-checkbox)', maxWidth: 'var(--po-pick-checkbox)', bgcolor: pinnedBg,
                        boxShadow: '1px 0 0 #D5DEE9' }}>
                        <Checkbox checked={checked.includes(group.poNumber)}
                          disabled={!available || working} onChange={() => toggle(group.poNumber)} />
                      </TableCell>
                      <TableCell sx={{ position: 'sticky', left: 'var(--po-pick-checkbox)', zIndex: 2, bgcolor: pinnedBg,
                        width: 'var(--po-pick-stt)', minWidth: 'var(--po-pick-stt)', maxWidth: 'var(--po-pick-stt)', textAlign: 'center',
                        fontWeight: 800, color: 'text.secondary', boxShadow: '1px 0 0 #D5DEE9' }}>
                        {safePage * rowsPerPage + index + 1}
                      </TableCell>
                      <TableCell sx={{ position: 'sticky', left: 'calc(var(--po-pick-checkbox) + var(--po-pick-stt))', zIndex: 2, bgcolor: pinnedBg,
                        width: 'var(--po-pick-number)', minWidth: 'var(--po-pick-number)', maxWidth: 'var(--po-pick-number)',
                        boxShadow: '2px 0 0 #D5DEE9' }}>
                        <Stack spacing={0.25} sx={{ minWidth: 0, maxWidth: '100%' }}>
                          <Stack direction="row" alignItems="center" spacing={0.55} sx={{ minWidth: 0 }}>
                            {group.lines.length > 1 && <Tooltip title={`${group.lines.length} ALL_BP source rows · ${expanded ? 'Hide' : 'Show'} details`}>
                              <IconButton size="small" aria-label={`${expanded ? 'Collapse' : 'Expand'} PO ${group.poNumber}`}
                                aria-expanded={expanded} onClick={() => toggleDetails(group.poNumber)}
                                sx={{ p: 0.15, ml: -0.4, width: 25, height: 25 }}>
                                {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                              </IconButton>
                            </Tooltip>}
                            <Typography variant="body2" sx={{ fontWeight: 850, color: '#214678',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {group.poNumber}
                            </Typography>
                            {group.lines.length > 1 && <Typography variant="caption" sx={{ flexShrink: 0, color: 'text.secondary', fontSize: 10.5 }}>
                              ({group.lines.length} lines)
                            </Typography>}
                            <Chip size="small" color={row.pickStatus === 'ACTIVE' ? 'success' : 'default'}
                              label={row.pickStatus === 'ACTIVE' ? 'Picked' : row.pickStatus === 'UNPICKED' ? 'Unpicked' : row.pickStatus === 'LEGACY_PICKED' ? 'Assigned' : row.pickStatus}
                              sx={{ ml: 'auto !important', height: 20, fontSize: 10, fontWeight: 750,
                                flexShrink: 0, '& .MuiChip-label': { px: 0.7 } }} />
                          </Stack>
                          {row.pickStatus !== 'UNPICKED' && <Tooltip title={`${row.pickedBy || '—'} · ${row.pickedAt || '—'}`}>
                            <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontSize: 11 }}>
                              {row.factoryCode || '—'} · {row.pickedBy || '—'}
                            </Typography>
                          </Tooltip>}
                        </Stack>
                      </TableCell>
                      {detailColumns.map((col, i) => <TableCell key={col.key} sx={{ width: detailWidths[i],
                        minWidth: detailWidths[i], maxWidth: detailWidths[i], whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {displayGroupCell(group, col)}
                      </TableCell>)}
                      <TableCell sx={{ width: 216, minWidth: 216, maxWidth: 216 }}>
                        <Stack direction="row" spacing={0.2} alignItems="center">
                          {available && <Button size="small" color="primary" variant="outlined" disabled={working}
                            onClick={() => pickSingle(group.poNumber)}>Pick</Button>}
                          <Button size="small" sx={{ minWidth: 0, px: 0.6 }} onClick={() => showHistory(group.poNumber)}>History</Button>
                          {canRelease && <Button size="small" sx={{ minWidth: 0, px: 0.6 }} color="warning"
                            disabled={working} onClick={() => requestUnpick(row)}>Unpick</Button>}
                        </Stack>
                      </TableCell>
                    </TableRow>
                    {group.lines.length > 1 && expanded && <TableRow key={`${group.poNumber}-details`}>
                      <TableCell colSpan={detailColumns.length + 4} sx={{ p: '0 !important', bgcolor: '#F1F6FD' }}>
                        <Box sx={{ p: 1.4, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={800} sx={{ mb: 0.8 }}>
                            PO {group.poNumber}: {group.lines.length} ALL_BP source rows (one Pick applies to the entire PO)
                          </Typography>
                          <Table size="small" aria-label={`ALL_BP rows for PO ${group.poNumber}`}
                            sx={{ width: 115 + detailWidths.reduce((sum, width) => sum + width, 0),
                              minWidth: '100%', tableLayout: 'fixed', bgcolor: '#FFF' }}>
                            <colgroup>
                              <col style={{ width: 115 }} />
                              {detailWidths.map((width, i) => <col key={detailColumns[i].key} style={{ width }} />)}
                            </colgroup>
                            <TableHead><TableRow>
                              <TableCell sx={{ width: 115 }}>ALL_BP row</TableCell>
                              {detailColumns.map((col) => <TableCell key={col.key} sx={{ minWidth: 100 }}>{col.label}</TableCell>)}
                            </TableRow></TableHead>
                            <TableBody>
                              {group.lines.map((line, lineIndex) => <TableRow key={`${line.id || group.poNumber}-${lineIndex}`}>
                                <TableCell sx={{ fontWeight: 750 }}>Row {lineIndex + 1}</TableCell>
                                {detailColumns.map((col) => <TableCell key={col.key} sx={{ overflowWrap: 'anywhere' }}>
                                  {renderCell(line, col)}
                                </TableCell>)}
                              </TableRow>)}
                            </TableBody>
                          </Table>
                        </Box>
                      </TableCell>
                    </TableRow>}
                  </Fragment>;
                })}
                {!loading && orderId && visible.length === 0 && <TableRow>
                  <TableCell align="center" colSpan={detailColumns.length + 4}>
                    <Box sx={{ py: 4, px: 2 }}>
                      <Typography variant="subtitle1" fontWeight={800}>
                        {!rows.length ? 'No PO available in this Order' : activeFilters ? 'No PO matches the current filters'
                          : view === 'FACTORY' ? `No PO assigned to ${activeFactory}`
                            : view === 'POOL' ? 'No unpicked PO available' : 'No PO in this list'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                        {!rows.length ? 'Sales/Admin must import PO data into this Order first.'
                          : activeFilters ? 'Try removing a filter or searching another PO Number.'
                            : view === 'FACTORY' ? 'Pick a PO from Shared · Unpicked, or switch Factory.'
                              : view === 'POOL' ? 'All PO may already be claimed by Packing.' : 'Select a different list to continue.'}
                      </Typography>
                      {Boolean(activeFilters) && <Button size="small" sx={{ mt: 1.5 }} onClick={resetFilters}>Reset filters</Button>}
                    </Box>
                  </TableCell>
                </TableRow>}
                {!orderId && <TableRow><TableCell align="center" colSpan={detailColumns.length + 4}>Select an Order first.</TableCell></TableRow>}
                {loading && !rows.length && <TableRow><TableCell align="center" colSpan={detailColumns.length + 4}>Loading PO details...</TableCell></TableRow>}
              </TableBody>
            </Table>
          </LululemonTableViewport>
        </Box>
        <TablePagination component="div" count={poGroups.length} page={safePage}
          rowsPerPage={rowsPerPage} onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50, 100]} sx={{ maxWidth: '100%', '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', justifyContent: 'flex-end' } }} />
      </Paper>
      <Dialog open={Boolean(unpickTarget)} onClose={() => !working && setUnpickTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Unpick PO {unpickTarget?.poNumber}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2">
              This PO is currently assigned to <strong>{unpickTarget?.factoryCode || '—'}</strong> by <strong>{unpickTarget?.pickedBy || '—'}</strong>.
              If the PO has not started Packing or Weighing, Unpick will return it to the shared list for other Packing users.
            </Typography>
            {releasingSomeoneElsesPo && <Alert severity="warning">
              You are unpicking a PO belonging to another Packing. Your account, the previous owner, the Factory and the reason will be recorded.
            </Alert>}
            <TextField label={releasingSomeoneElsesPo ? 'Reason (required)' : 'Reason (optional)'}
              fullWidth size="small" multiline minRows={2} value={unpickReason} onChange={(e) => setUnpickReason(e.target.value)}
              inputProps={{ maxLength: 500 }} placeholder="Why does this PO need to be returned to the shared list?" />
            {unpickError && <Alert severity="error">{unpickError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnpickTarget(null)} disabled={working}>Cancel</Button>
          <Button color="warning" variant="contained" disabled={working || (releasingSomeoneElsesPo && !unpickReason.trim())}
            onClick={release}>Confirm Unpick</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(history)} onClose={() => setHistory(null)} maxWidth="sm" fullWidth>
        <DialogTitle>PO {history?.po} – Pick History</DialogTitle>
        <DialogContent>
          {history?.rows?.length ? history.rows.map((event) => <Typography key={event.id} variant="body2" sx={{ py: 0.5 }}>
            {event.createdAt} · {event.action} · {event.factoryCode} · {event.actor}
            {event.previousPickedBy ? ` · Previous: ${event.previousPickedBy}` : ''}
            {event.reason ? ` · Reason: ${event.reason}` : ''}
          </Typography>) : <Typography>No history</Typography>}
        </DialogContent>
      </Dialog>
      <Typography variant="caption" color="text.secondary">Any authorized Packing user may Unpick another Packing's PO with a reason, only before operational activity. Backend validates permissions, active claims and carton/weight safety.</Typography>
    </Stack>
  );
}
