import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, IconButton, ListItemText,
  Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import { Add, ArrowBack, DeleteOutline, FileDownloadOutlined, Refresh, ViewColumnOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { BUYER_CODE, ALL_BP_KNOWN_HEADERS, ALL_BP_RETIRED_KEYS, ALL_BP_UI_LABELS,
  ALL_BP_IMPORTANT_SOURCE_ORDER, DEFAULT_TABLE_ROWS_PER_PAGE, WORKSPACE_SYSTEM_COLUMN_DEFINITIONS,
  WORKSPACE_DEFAULT_COLUMN_KEYS } from '../../../constants/appConstants';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import StatusChip from 'components/StatusChip';
import PoInspectionProgressCell from '../components/PoInspectionProgressCell';
import PoScanProgressCell from '../components/PoScanProgressCell';
import { calculatedCartonMetrics, canonicalSourceKey, sourceValue, value } from '../domain/allBpWorkspace';
import { canManageShipping } from 'utils/accessControl';
import { useSelectedFactory } from 'utils/factorySelection';
import { exportPoShippingDayExcel, getPoShippingDay, listPoShippingDayPos,
  removePoFromShippingDay } from '../services/shipping';
import ShippingSchedulePoPicker from '../components/ShippingSchedulePoPicker';
import ShippingScheduleExportDialog from '../components/ShippingScheduleExportDialog';

const errText = (e, fallback) => e?.response?.data?.message || e?.message || fallback;
const humanDate = (date) => String(date || '').split('-').reverse().join('/');
const emptyFilters = () => ({ poNumber: '', factory: '', style: '', sku: '', destination: '', status: '', inspectionStatus: '', exFtyDate: '' });
// Preferences in Schedule details are independent: never rewrite All POs' column choices.
const DETAIL_COLUMN_KEY = 'lululemon_shipping_schedule_detail_columns_v1';
const loadSelectedColumns = () => {
  try {
    const keys = JSON.parse(localStorage.getItem(DETAIL_COLUMN_KEY));
    return Array.isArray(keys) ? keys : null;
  } catch { return null; }
};
const initialTable = () => ({ rows: [], page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE, count: 0, loading: false });
const systemColumns = WORKSPACE_SYSTEM_COLUMN_DEFINITIONS.map((column) => ({
  ...column,
  render: (row) => {
    if (column.key === '__stt') return value(row.__stt);
    if (column.key === 'sys:factory') return value(row.factoryCode);
    if (column.key === 'sys:sku') return value(row.sku);
    if (column.key === 'sys:exFtyDate') return value(row.exFtyDate);
    if (column.key === 'sys:status') return <StatusChip status={row.status || 'READY'} />;
    return '—';
  }
}));

/** One Shipping Date, on a dedicated page, with the same read-only PO metrics as All POs. */
export default function ShippingScheduleDetailPage() {
  const { buyerSlug, orderId, day } = useParams();
  const navigate = useNavigate();
  const { factoryCode, loading: factoryLoading } = useSelectedFactory(BUYER_CODE.LULULEMON);
  const writable = canManageShipping();
  const backPath = `/buyers/${buyerSlug}/orders/${orderId}?tab=shipping-schedules`;
  const [detail, setDetail] = useState(null);
  const editable = writable && Boolean(detail) && !detail.submitted;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [removing, setRemoving] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportError, setExportError] = useState('');
  const [adding, setAdding] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [table, setTable] = useState(initialTable);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(loadSelectedColumns);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const knownDates = useMemo(() => [day], [day]);
  const tableRequest = useRef(0);
  const headerRequest = useRef(0);
  const pagination = useRef({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const loadHeader = useCallback(async () => {
    const token = ++headerRequest.current;
    if (factoryLoading || !factoryCode) { setDetail(null); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const data = await getPoShippingDay(orderId, day, factoryCode);
      if (token === headerRequest.current) setDetail(data);
    } catch (e) {
      if (token === headerRequest.current) {
        setError(errText(e, 'Unable to load this Shipping Schedule.'));
        setDetail(null);
      }
    } finally { if (token === headerRequest.current) setLoading(false); }
  }, [orderId, day, factoryCode, factoryLoading]);

  // Refresh the lock when a page stays open across a Vietnam Shipping Date midnight.
  useEffect(() => {
    if (!factoryCode || factoryLoading) return undefined;
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const [year, month, date] = today.split('-').map(Number);
    const nextMidnight = Date.UTC(year, month - 1, date, 17, 0, 1);
    const timer = window.setTimeout(() => loadHeader(), Math.max(1000, nextMidnight - Date.now()));
    return () => window.clearTimeout(timer);
  }, [loadHeader, detail?.submitted, factoryCode, factoryLoading]);

  useEffect(() => {
    loadHeader();
    return () => { headerRequest.current += 1; };
  }, [loadHeader]);

  const loadTable = useCallback(async (page = 0, size = pagination.current.size) => {
    const token = ++tableRequest.current;
    if (factoryLoading || !factoryCode || !day || !orderId) {
      setTable((current) => ({ ...current, rows: [], count: 0, loading: false })); return;
    }
    const safePage = Math.max(0, page);
    const safeSize = Math.max(1, size);
    pagination.current = { page: safePage, size: safeSize };
    setTable((current) => ({ ...current, page: safePage, size: safeSize, loading: true }));
    try {
      const result = await listPoShippingDayPos(orderId, day, factoryCode, {
        poNumber: debouncedFilters.poNumber,
        factoryFilter: debouncedFilters.factory,
        style: debouncedFilters.style,
        sku: debouncedFilters.sku,
        destination: debouncedFilters.destination,
        status: debouncedFilters.status,
        inspectionStatus: debouncedFilters.inspectionStatus,
        exFtyDate: debouncedFilters.exFtyDate
      }, safePage, safeSize);
      if (token !== tableRequest.current) return;
      const rows = (result?.content || []).map((row, index) => ({ ...row, __stt: safePage * safeSize + index + 1 }));
      setTable({ rows, page: safePage, size: safeSize, count: Number(result?.totalElements || 0), loading: false });
    } catch (e) {
      if (token === tableRequest.current) {
        setError(errText(e, 'Unable to load PO table for this Shipping Schedule.'));
        setTable((current) => ({ ...current, rows: [], count: 0, loading: false }));
      }
    }
  }, [orderId, day, factoryCode, factoryLoading, debouncedFilters]);

  useEffect(() => {
    loadTable(0, pagination.current.size);
    return () => { tableRequest.current += 1; };
  }, [loadTable]);

  const sourceColumns = useMemo(() => {
    const seen = new Set();
    const headers = [];
    const add = (label) => {
      const clean = String(label || '').trim();
      if (!clean || seen.has(clean) || ALL_BP_RETIRED_KEYS.includes(canonicalSourceKey(clean))) return;
      seen.add(clean); headers.push(clean);
    };
    table.rows.forEach((row) => {
      (Array.isArray(row.allBpHeaders) ? row.allBpHeaders : []).forEach(add);
      (Array.isArray(row.allBpRows) ? row.allBpRows : []).forEach((sourceRow) => Object.keys(sourceRow || {}).forEach(add));
    });
    ALL_BP_KNOWN_HEADERS.forEach(add);
    const byCanonical = new Map();
    headers.forEach((label, index) => {
      const canonical = canonicalSourceKey(label);
      if (byCanonical.has(canonical)) return;
      byCanonical.set(canonical, {
        key: `src:${canonical}`, canonical, group: 'ALL_BP', sourceIndex: index,
        label: ALL_BP_UI_LABELS[canonical] || label,
        minWidth: canonical === 'DESCRIPTION' ? 200 : canonical === 'COLOR' ? 145 : ['ODD_RATIO', 'REMAINDER'].includes(canonical) ? 125 : 115,
        render: (row) => ['QTY', 'ODD_RATIO', 'CTNS', 'REMAINDER'].includes(canonical)
          ? <PoScanProgressCell row={row} canonical={canonical} metrics={calculatedCartonMetrics(row)} />
          : sourceValue(row, canonical)
      });
    });
    const priorities = new Map(ALL_BP_IMPORTANT_SOURCE_ORDER.map((key, index) => [key, index]));
    return Array.from(byCanonical.values()).sort((a, b) => {
      const left = priorities.has(a.canonical) ? priorities.get(a.canonical) : 1000 + a.sourceIndex;
      const right = priorities.has(b.canonical) ? priorities.get(b.canonical) : 1000 + b.sourceIndex;
      return left - right;
    });
  }, [table.rows]);

  const allWorkflowColumns = useMemo(() => {
    const remainingSystem = systemColumns.slice(1);
    const columns = [systemColumns[0]];
    sourceColumns.forEach((column) => {
      columns.push(column);
      if (column.canonical === 'MASTER_PO') columns.push(remainingSystem[0]);
    });
    if (!columns.some((column) => column.key === 'sys:factory')) columns.splice(1, 0, remainingSystem[0]);
    columns.push(...remainingSystem.slice(1));
    return columns;
  }, [sourceColumns]);

  const availableColumns = useMemo(() => new Set(allWorkflowColumns.map((column) => column.key)), [allWorkflowColumns]);
  const availableSignature = useMemo(() => allWorkflowColumns.map((column) => column.key).join('|'), [allWorkflowColumns]);
  useEffect(() => {
    setVisibleColumnKeys((current) => {
      const defaults = WORKSPACE_DEFAULT_COLUMN_KEYS.filter((key) => availableColumns.has(key));
      if (!Array.isArray(current)) return defaults;
      const valid = current.filter((key) => availableColumns.has(key));
      const next = valid.length ? [...valid] : [...defaults];
      ['src:ODD_RATIO', 'src:REMAINDER'].forEach((key) => {
        if (!availableColumns.has(key) || next.includes(key)) return;
        const anchor = key === 'src:ODD_RATIO' ? next.indexOf('src:PCS_CTN') : next.indexOf('src:CTNS');
        next.splice(anchor < 0 ? next.length : anchor + 1, 0, key);
      });
      return current.length === next.length && current.every((key, index) => key === next[index]) ? current : next;
    });
  }, [availableColumns, availableSignature]);
  useEffect(() => {
    if (Array.isArray(visibleColumnKeys)) localStorage.setItem(DETAIL_COLUMN_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  const remove = async (po) => {
    if (!editable || !po?.id || removing) return;
    if (!window.confirm(`Remove PO ${po.poNumber || po.id} from Shipping Schedule ${humanDate(day)} only? Original PO and cartons will not be deleted.`)) return;
    setRemoving(po.id); setError(''); setSuccess('');
    try {
      const result = await removePoFromShippingDay(orderId, day, po.id, factoryCode);
      if (!(result?.pos || []).length) {
        navigate(backPath, { replace: true });
        return;
      }
      setDetail(result);
      // Remove refreshes ONLY this date's table; original POs/Cartons remain untouched.
      await loadTable(table.rows.length === 1 && table.page > 0 ? table.page - 1 : table.page, table.size);
      setSuccess(`PO ${po.poNumber || po.id} removed from this Shipping Schedule only. Original PO kept.`);
    } catch (e) {
      setError(errText(e, 'Unable to remove PO from this Shipping Schedule.'));
      await loadHeader();
    } finally { setRemoving(''); }
  };

  const exportExcel = async (selectedColumns) => {
    if (exporting || !detail?.pos?.length || !Array.isArray(selectedColumns) || !selectedColumns.length) return;
    setExporting(true); setError(''); setExportError('');
    try {
      const response = await exportPoShippingDayExcel(orderId, day, factoryCode, BUYER_CODE.LULULEMON, selectedColumns);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = `Shipping_${day}_${factoryCode}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      setExportDialogOpen(false);
    } catch (e) {
      const message = errText(e, 'Unable to export Shipping Schedule Excel.');
      setError(message);
      setExportError(message);
    } finally { setExporting(false); }
  };

  const selected = new Set(Array.isArray(visibleColumnKeys) ? visibleColumnKeys : WORKSPACE_DEFAULT_COLUMN_KEYS);
  const columns = [
    { key: '__inspection', label: 'Carton / RFID / Weight', minWidth: 228,
      render: (row) => <PoInspectionProgressCell row={row} /> },
    ...allWorkflowColumns.filter((column) => selected.has(column.key)),
    { key: 'plannedShippingDate', label: 'Scheduled Ship Date', minWidth: 155,
      render: (row) => row.plannedShippingDate
        ? <Chip size="small" color="primary" variant="outlined" label={row.plannedShippingDate} />
        : <Typography variant="caption" color="text.secondary">Not scheduled</Typography> },
    ...(editable ? [{ key: '__remove', label: 'Actions', minWidth: 105, render: (row) =>
      <Tooltip title="Remove from this Shipping Schedule only. Keep original PO and cartons."><span>
        <IconButton size="small" color="error" disabled={Boolean(removing)} onClick={() => remove(row)}
          aria-label={`Remove PO ${row.poNumber} from Shipping Schedule`}>
          {removing === row.id ? <CircularProgress size={18} /> : <DeleteOutline fontSize="small" />}
        </IconButton>
      </span></Tooltip> }] : [])
  ];
  const toggleColumn = (key) => setVisibleColumnKeys((current) => {
    const next = new Set(Array.isArray(current) ? current : WORKSPACE_DEFAULT_COLUMN_KEYS);
    if (next.has(key)) { if (next.size > 1) next.delete(key); }
    else next.add(key);
    return [...next];
  });
  const refresh = async () => {
    await Promise.all([loadHeader(), loadTable(pagination.current.page, pagination.current.size)]);
  };

  return <Box sx={{ p: { xs: 1, md: 1.5 } }}><Stack gap={1.25}>
    <Stack direction={{ xs: 'column', lg: 'row' }} alignItems={{ lg: 'center' }} justifyContent="space-between" gap={1}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate(backPath)}>Shipping Schedules</Button>
        <Box><Typography variant="h5" fontWeight={850}>Shipping Schedule – {humanDate(day)}</Typography>
          <Typography variant="caption" color="text.secondary">Factory {factoryCode || '—'} · {detail?.pos?.length ?? '…'} POs</Typography>
          {detail && <Chip size="small" color={detail.submitted ? 'success' : 'default'}
            label={detail.submitted ? (detail.autoSubmitted ? 'Submitted (Auto) · Read-only' : 'Submitted · Read-only')
              : detail.reopened ? 'Unsubmitted · Editable' : 'Draft · Editable'} /> }
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} useFlexGap flexWrap="wrap">
        <Button size="small" startIcon={loading || table.loading ? <CircularProgress size={15} /> : <Refresh />}
          disabled={loading || table.loading} onClick={refresh}>Refresh</Button>
        {editable && <Button size="small" variant="outlined" startIcon={<Add />}
          disabled={!detail || Boolean(removing)} onClick={() => setAdding(true)}>Add PO</Button>}
        <Button size="small" variant="outlined" startIcon={<ViewColumnOutlined />}
          onClick={(e) => setColumnMenuAnchor(e.currentTarget)} aria-label="Customize Shipping Schedule PO table columns">
          Columns {allWorkflowColumns.filter((c) => selected.has(c.key)).length}/{allWorkflowColumns.length}
        </Button>
        <Button size="small" variant="contained"
          startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadOutlined />}
          disabled={exporting || !detail?.pos?.length} onClick={() => { setExportError(''); setExportDialogOpen(true); }}>Export Excel</Button>
      </Stack>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
    <ManagementTable
      title="POs in this Shipping Schedule"
      filterBar={<TableFilterBar fields={[
        { key: 'poNumber', label: 'PO No.' },
        { key: 'factory', label: 'Factory' },
        { key: 'style', label: 'Style' },
        { key: 'sku', label: 'SKU' },
        { key: 'destination', label: 'Destination' },
        { key: 'status', label: 'Workflow Status' },
        { key: 'inspectionStatus', label: 'Inspection Progress', options: [
          { value: 'COMPLETED', label: 'Completed' }, { value: 'INCOMPLETE', label: 'Incomplete' },
          { value: 'IMPORTING', label: 'Importing' }, { value: 'NOT_STARTED', label: 'Imported / Not Started' }
        ] },
        { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' }
      ]} values={filters} onChange={(key, nextValue) => setFilters((current) => ({ ...current, [key]: nextValue }))}
        onClear={() => setFilters(emptyFilters())} />}
      {...table} rowsPerPage={table.size}
      getRowId={(row) => row.id || row.key}
      onPageChange={(nextPage) => loadTable(nextPage, pagination.current.size)}
      onRowsPerPageChange={(size) => loadTable(0, size)}
      columns={columns}
      emptyText="No POs in this Shipping Schedule match the current filters."
    />
    <Menu anchorEl={columnMenuAnchor} open={Boolean(columnMenuAnchor)}
      onClose={() => setColumnMenuAnchor(null)} PaperProps={{ sx: { width: 330, maxHeight: 520 } }}>
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography fontWeight={800}>Customize Columns</Typography>
        <Typography variant="caption" color="text.secondary">Choose which columns are shown in this Shipping Schedule PO table.</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" onClick={() => setVisibleColumnKeys(WORKSPACE_DEFAULT_COLUMN_KEYS.filter((key) => availableColumns.has(key)))}>Default</Button>
          <Button size="small" onClick={() => setVisibleColumnKeys(allWorkflowColumns.map((column) => column.key))}>Show All</Button>
        </Stack>
      </Box>
      <Divider />
      {allWorkflowColumns.map((column) => <MenuItem key={column.key} dense onClick={() => toggleColumn(column.key)}>
        <Checkbox size="small" checked={selected.has(column.key)} />
        <ListItemText primary={column.label} secondary={column.group === 'ALL_BP' ? 'ALL_BP' : 'System'} />
      </MenuItem>)}
    </Menu>
    <ShippingScheduleExportDialog open={exportDialogOpen} exporting={exporting} error={exportError}
      onClose={() => setExportDialogOpen(false)} onExport={exportExcel} />
    <ShippingSchedulePoPicker open={adding && editable} orderId={orderId} factoryCode={factoryCode}
      lockedDate date={day} knownDates={knownDates} onClose={() => setAdding(false)}
      onSaved={async (date, result) => {
        setAdding(false);
        await Promise.all([loadHeader(), loadTable(0, pagination.current.size)]);
        setSuccess(`Added ${result?.scheduledCount ?? 0} PO(s) to Shipping Schedule ${humanDate(date)}.`);
      }} />
  </Stack></Box>;
}
