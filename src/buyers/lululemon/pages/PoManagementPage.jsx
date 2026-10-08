import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import PoScanProgressCell from '../components/PoScanProgressCell';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider, LinearProgress, ListItemText, Menu, MenuItem,
  Paper, Stack,  TableBody, TableCell, TableHead, TablePagination,
  TableRow, Typography
} from '@mui/material';
import { Refresh, UploadFile, ViewColumn } from '@mui/icons-material';
import { CompactPageHeader, CompactStat, CompactToolbar } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { canManageSales } from 'utils/accessControl';
import StatusChip from '../components/StatusChip';
import OrderScope from '../components/OrderScope';
import { importAllBp, listAllPos } from '../services/service';
import { APP_MESSAGES, createAllBpImportDetailMessage } from '../../../constants/appMessages';

import { ALL_BP_FORMULA_KEYS, ALL_BP_KNOWN_HEADERS, ALL_BP_SOURCE_ALIAS, ALL_BP_UI_LABELS, PURCHASE_ORDER_STATUS_OPTIONS, DEFAULT_TABLE_ROWS_PER_PAGE, EXCEL_FILE_ACCEPT, BUYER_CODE, BUYER_LABEL } from '../../../constants/appConstants';
import { PO_COLUMN_STORAGE_KEY, PO_DEFAULT_COLUMN_KEYS, PO_SYSTEM_COLUMNS } from './poManagementConfig';
const normalize = (value) => String(value || '').trim().toLowerCase();
const headerKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '');



const canonicalSourceKey = (label) => {
  const normalized = headerKey(label);
  return ALL_BP_SOURCE_ALIAS[normalized] || `RAW_${normalized || 'COLUMN'}`;
};


const canonicalRowEntry = (sourceRow, canonical) => Object.entries(sourceRow || {})
  .find(([label]) => canonicalSourceKey(label) === canonical);

const canonicalRowValue = (sourceRow, canonical) => canonicalRowEntry(sourceRow, canonical)?.[1] ?? '';


const calculatedCartonMetrics = (row) => {
  const metrics = [];
  const sourceRows = Array.isArray(row?.allBpRows) ? row.allBpRows : [];

  for (const sourceRow of sourceRows) {
    const qty = Number(String(canonicalRowValue(sourceRow, 'QTY') ?? '').replace(/,/g, '').trim());
    const pcs = Number(String(canonicalRowValue(sourceRow, 'PCS_CTN') ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(qty) || !Number.isFinite(pcs) || qty <= 0 || pcs <= 0) continue;
    const quotient = qty / pcs;
    const fullCartons = Math.floor(quotient);
    metrics.push({
      // ALL_BP column "lẻ" is =Q'ty/Pcs/ctn and is formatted with 0 decimals in Excel.
      cartonRatio: Math.ceil(quotient),
      fullCartons,
      remainderQty: qty - (fullCartons * pcs)
    });
  }

  if (!metrics.length) {
    const qty = Number(row?.totalQty ?? row?.plannedTotalQty ?? 0);
    const pcs = Number(row?.qtyPerCarton ?? row?.pcsPerCarton ?? 0);
    if (Number.isFinite(qty) && Number.isFinite(pcs) && qty > 0 && pcs > 0) {
      const quotient = qty / pcs;
      const fullCartons = Math.floor(quotient);
      metrics.push({
        cartonRatio: Math.ceil(quotient),
        fullCartons,
        remainderQty: qty - (fullCartons * pcs)
      });
    }
  }
  return metrics;
};



const sourceValues = (row, canonical) => {
  const values = [];
  for (const sourceRow of Array.isArray(row.allBpRows) ? row.allBpRows : []) {
    for (const [label, value] of Object.entries(sourceRow || {})) {
      if (canonicalSourceKey(label) !== canonical) continue;
      const text = String(value ?? '').trim();
      if (text) values.push(text);
    }
  }
  return values;
};

const uniqueSourceValues = (row, canonical) => [...new Set(sourceValues(row, canonical))];

const summedSourceNumber = (row, canonical) => {
  const values = sourceValues(row, canonical);
  if (!values.length) return null;
  const numbers = values.map((item) => Number(String(item).replace(/,/g, '')));
  if (numbers.some((item) => !Number.isFinite(item))) return null;
  return numbers.reduce((sum, item) => sum + item, 0);
};

const sourceValue = (row, canonical) => {
  // Record-level calculated values stay readable when exact business-key rows are merged.
  if (canonical === 'PO') return row.poNumber || '—';
  if (canonical === 'STYLE') return row.styleNumber || row.style || '—';
  if (canonical === 'QTY') return row.totalQty ?? row.plannedTotalQty ?? '—';
  if (canonical === 'PCS_CTN') {
    const values = uniqueSourceValues(row, canonical);
    return values.length > 1 ? values.join(' | ') : (row.qtyPerCarton ?? row.pcsPerCarton ?? values[0] ?? '—');
  }
  if (canonical === 'ODD_RATIO') {
    const metrics = calculatedCartonMetrics(row);
    return metrics.length ? metrics.map((item) => item.cartonRatio).join(' | ') : '—';
  }
  if (canonical === 'CTNS') {
    const metrics = calculatedCartonMetrics(row);
    if (metrics.length) return metrics.reduce((sum, item) => sum + item.fullCartons, 0);
    const total = summedSourceNumber(row, canonical);
    return total == null ? '—' : total;
  }
  if (canonical === 'REMAINDER') {
    const metrics = calculatedCartonMetrics(row);
    return metrics.length ? metrics.reduce((sum, item) => sum + item.remainderQty, 0) : '—';
  }

  const values = uniqueSourceValues(row, canonical);
  if (ALL_BP_FORMULA_KEYS.includes(canonical)) return values.length ? values.join(' | ') : '—';
  if (values.length) return values.join(' | ');

  const fallbacks = {
    DC_CODE: row.dcCode,
    DESTINATION: row.destination,
    CHANNEL: row.channel,
    MASTER_PO: row.masterPo,
    PACKING_PLAN: row.packingPlan,
    SALES_ORDER_PTS: row.salesOrderPts,
    DESCRIPTION: row.description,
    COLOR: row.color,
    SIZE: row.size,
    SHIP_MODE: row.shipMode,
    SEASON: row.season,
    FWD: row.fwd,
    CARTON_BOX_SIZE: row.cartonBoxSize,
    NW: row.netWeight,
    GW: row.grossWeight
  };
  return fallbacks[canonical] ?? '—';
};

const loadSavedColumns = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PO_COLUMN_STORAGE_KEY));
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
};

export default function PoManagementPage() {
  const [orderId, setOrderId] = useState('');
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ factoryCode: '', poNumber: '', style: '', sku: '', exFtyDate: '', status: '' });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(loadSavedColumns);
  const fileRef = useRef(null);
  const sales = canManageSales();

  const load = useCallback(async () => {
    if (!orderId) { setRows([]); return; }
    setLoading(true);
    try {
      setRows(await listAllPos(orderId));
    } catch (error) {
      setMessage({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.LOAD_PURCHASE_ORDERS_FAILED });
    } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [orderId, filters]);

  const filteredRows = useMemo(() => rows.filter((row) => (
    (!filters.factoryCode || normalize(row.factoryCode).includes(normalize(filters.factoryCode))) &&
    (!filters.poNumber || normalize(row.poNumber).includes(normalize(filters.poNumber))) &&
    (!filters.style || normalize(row.styleNumber || row.style).includes(normalize(filters.style))) &&
    (!filters.sku || normalize(row.sku).includes(normalize(filters.sku))) &&
    (!filters.exFtyDate || String(row.exFtyDate || '').slice(0, 10) === filters.exFtyDate) &&
    (!filters.status || normalize(row.status) === normalize(filters.status))
  )), [rows, filters]);

  const pagedRows = useMemo(
    () => filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredRows, page, rowsPerPage]
  );

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / rowsPerPage) - 1);
    setPage((current) => Math.min(current, maxPage));
  }, [filteredRows.length, rowsPerPage]);

  const totals = useMemo(() => ({
    po: rows.length,
    cartons: rows.reduce((sum, row) => sum + Number(row.cartonCount ?? row.plannedCartons ?? 0), 0),
    qty: rows.reduce((sum, row) => sum + Number(row.totalQty ?? row.plannedTotalQty ?? 0), 0)
  }), [rows]);

  const sourceColumns = useMemo(() => {
    const columns = new Map();
    ALL_BP_KNOWN_HEADERS.forEach((label) => {
      const canonical = canonicalSourceKey(label);
      columns.set(canonical, { key: `src:${canonical}`, canonical, label: ALL_BP_UI_LABELS[canonical] || label, group: 'ALL_BP', minWidth: canonical === 'ODD_RATIO' || canonical === 'REMAINDER' ? 130 : 120 });
    });
    const detectedFromFile = new Set();
    rows.forEach((row) => {
      (row.allBpHeaders || []).forEach((label) => {
        const canonical = canonicalSourceKey(label);
        if (!canonical || detectedFromFile.has(canonical)) return;
        columns.set(canonical, { key: `src:${canonical}`, canonical, label: ALL_BP_UI_LABELS[canonical] || label, group: 'ALL_BP', minWidth: canonical === 'ODD_RATIO' || canonical === 'REMAINDER' ? 130 : 120 });
        detectedFromFile.add(canonical);
      });
      (row.allBpRows || []).forEach((sourceRow) => {
        Object.keys(sourceRow || {}).forEach((label) => {
          const canonical = canonicalSourceKey(label);
          if (!canonical || detectedFromFile.has(canonical)) return;
          columns.set(canonical, { key: `src:${canonical}`, canonical, label: ALL_BP_UI_LABELS[canonical] || label, group: 'ALL_BP', minWidth: canonical === 'ODD_RATIO' || canonical === 'REMAINDER' ? 130 : 120 });
          detectedFromFile.add(canonical);
        });
      });
    });
    return Array.from(columns.values());
  }, [rows]);

  const allColumns = useMemo(() => [...PO_SYSTEM_COLUMNS, ...sourceColumns], [sourceColumns]);
  const allColumnSignature = useMemo(() => allColumns.map((column) => column.key).join('|'), [allColumns]);

  useEffect(() => {
    if (!allColumns.length) return;
    setVisibleColumnKeys((current) => {
      const available = new Set(allColumns.map((column) => column.key));
      const defaults = PO_DEFAULT_COLUMN_KEYS.filter((key) => available.has(key));
      if (current === null) return defaults;
      const valid = current.filter((key) => available.has(key));
      const next = valid.length ? [...valid] : [...defaults];

      // Existing browsers may have saved the old column set in localStorage. Add the
      // newly-required carton calculation columns without resetting the other choices.
      ['src:ODD_RATIO', 'src:REMAINDER'].forEach((key) => {
        if (!available.has(key) || next.includes(key)) return;
        const anchor = key === 'src:ODD_RATIO' ? next.indexOf('src:PCS_CTN') : next.indexOf('src:CTNS');
        next.splice(anchor >= 0 ? anchor + 1 : next.length, 0, key);
      });
      return next;
    });
    // Signature changes only when available columns change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allColumnSignature]);

  useEffect(() => {
    if (!Array.isArray(visibleColumnKeys)) return;
    localStorage.setItem(PO_COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  const visibleColumns = useMemo(() => {
    const selected = new Set(visibleColumnKeys || PO_DEFAULT_COLUMN_KEYS);
    return allColumns.filter((column) => selected.has(column.key));
  }, [allColumns, visibleColumnKeys]);

  const toggleColumn = (key) => {
    setVisibleColumnKeys((current) => {
      const selected = new Set(current || PO_DEFAULT_COLUMN_KEYS);
      if (selected.has(key)) {
        if (selected.size <= 1) return Array.from(selected);
        selected.delete(key);
      } else {
        selected.add(key);
      }
      return Array.from(selected);
    });
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !orderId) return;
    setLoading(true); setImporting(true); setImportProgress(0);
    try {
      const result = await importAllBp(orderId, file, true, BUYER_CODE.LULULEMON, (progressEvent) => {
        const total = Number(progressEvent?.total || 0);
        const loaded = Number(progressEvent?.loaded || 0);
        const percent = total > 0
          ? Math.round((loaded * 100) / total)
          : Math.round(Number(progressEvent?.progress || 0) * 100);
        if (Number.isFinite(percent)) setImportProgress(Math.max(0, Math.min(100, percent)));
      });
      setImportProgress(100);
      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      setMessage({
        severity: warnings.length ? 'warning' : 'success',
        text: createAllBpImportDetailMessage(result.createdPos, result.updatedPos, result.createdCartons, result.createdItems, warnings)
      });
      await load();
    } catch (error) {
      setMessage({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.ALL_BP_IMPORT_FAILED });
    } finally { setLoading(false); setImporting(false); setImportProgress(0); }
  };

  const renderColumnCell = (row, column) => {
    if (column.status) return <StatusChip status={row.status} />;
    if (column.key === 'sys:sku') {
      return row.sku || <Typography color="warning.main" variant="body2">Not assigned</Typography>;
    }
    if (column.key.startsWith('src:')) {
      if (['QTY', 'ODD_RATIO', 'CTNS', 'REMAINDER'].includes(column.canonical) && row.identifiedQty !== undefined) {
        return <PoScanProgressCell row={row} canonical={column.canonical} metrics={calculatedCartonMetrics(row)} />;
      }
      return sourceValue(row, column.canonical);
    }
    return column.value?.(row) ?? '—';
  };

  const tableColSpan = Math.max(1, visibleColumns.length);

  return (
    <Stack spacing={0.9}>
      <CompactPageHeader
        dense
        title={`${BUYER_LABEL[BUYER_CODE.LULULEMON]} · PO Master Data`}
        subtitle="ALL_BP data for the selected Order. All source columns are saved; choose which columns to show on the table."
        actions={(<>
          <Button size="small" startIcon={<Refresh />} onClick={load} disabled={loading || !orderId}>Refresh</Button>
          {sales && (
            <>
              <Button
                size="small"
                variant="contained"
                startIcon={importing ? <CircularProgress size={15} thickness={5} /> : <UploadFile />}
                onClick={() => fileRef.current?.click()}
                disabled={loading || !orderId}
              >
                {importing ? (importProgress < 100 ? `Uploading ${importProgress}%` : 'Processing file...') : 'Import ALL_BP'}
              </Button>
              {importing ? (
                <Box sx={{ width: 190, minWidth: 150 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={700}>
                      {importProgress < 100 ? 'Uploading ALL_BP' : 'Processing ALL_BP'}
                    </Typography>
                    <Typography variant="caption" fontWeight={800}>{importProgress}%</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={importProgress} />
                </Box>
              ) : null}
            </>
          )}
          <input ref={fileRef} hidden type="file" accept={EXCEL_FILE_ACCEPT} onChange={upload} />
        </>)}
      />

      <OrderScope value={orderId} onChange={setOrderId} disabled={loading} />
      {message && <Alert severity={message.severity} onClose={() => setMessage(null)}>{message.text}</Alert>}

      <CompactToolbar>
        <CompactStat label="PO" value={totals.po} />
        <CompactStat label="Cartons" value={totals.cartons} />
        <CompactStat label="Planned Items" value={totals.qty} />
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<ViewColumn />}
          onClick={(event) => setColumnMenuAnchor(event.currentTarget)}
        >
          Columns {visibleColumns.length}/{allColumns.length}
        </Button>
        <Menu
          anchorEl={columnMenuAnchor}
          open={Boolean(columnMenuAnchor)}
          onClose={() => setColumnMenuAnchor(null)}
          PaperProps={{ sx: { maxHeight: 520, minWidth: 300 } }}
        >
          <MenuItem onClick={() => setVisibleColumnKeys(PO_DEFAULT_COLUMN_KEYS.filter((key) => allColumns.some((column) => column.key === key)))}>
            Default columns
          </MenuItem>
          <MenuItem onClick={() => setVisibleColumnKeys(allColumns.map((column) => column.key))}>
            Show all {allColumns.length} columns
          </MenuItem>
          <Divider />
          {allColumns.map((column) => (
            <MenuItem key={column.key} dense onClick={() => toggleColumn(column.key)}>
              <Checkbox size="small" checked={visibleColumns.some((item) => item.key === column.key)} />
              <ListItemText primary={column.label} secondary={column.group} />
            </MenuItem>
          ))}
        </Menu>
      </CompactToolbar>

      <TableFilterBar
        fields={[
          { key: 'factoryCode', label: 'Factory' },
          { key: 'poNumber', label: 'PO No.' },
          { key: 'style', label: 'Style' },
          { key: 'sku', label: 'SKU' },
          { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' },
          { key: 'status', label: 'Status', options: PURCHASE_ORDER_STATUS_OPTIONS }
        ]}
        values={filters}
        onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
        onClear={() => setFilters({ factoryCode: '', poNumber: '', style: '', sku: '', exFtyDate: '', status: '' })}
        disabled={!orderId}
      />

      <LululemonTableViewport component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <SortableTable size="small" stickyHeader rowNumberStart={page * rowsPerPage} sx={{ minWidth: Math.max(900, visibleColumns.length * 125) + 64 }}>
          <TableHead>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableCell key={column.key} sx={{ fontWeight: 800, minWidth: column.minWidth || 110, whiteSpace: 'nowrap' }}>
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && !rows.length ? (
              <TableRow><TableCell colSpan={tableColSpan} align="center" sx={{ py: 5 }}><CircularProgress size={28} /></TableCell></TableRow>
            ) : pagedRows.map((row) => (
              <TableRow key={row.id} hover>
                {visibleColumns.map((column) => (
                  <TableCell key={column.key} sx={{ whiteSpace: 'nowrap', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {renderColumnCell(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!loading && orderId && !filteredRows.length && (
              <TableRow><TableCell colSpan={tableColSpan} align="center" sx={{ py: 5 }}>No PO found in this Order.</TableCell></TableRow>
            )}
            {!orderId && (
              <TableRow><TableCell colSpan={tableColSpan} align="center" sx={{ py: 5 }}>Select an Order first.</TableCell></TableRow>
            )}
          </TableBody>
        </SortableTable>
      </LululemonTableViewport>
      <TablePagination
        component="div"
        count={filteredRows.length}
        page={Math.min(page, Math.max(0, Math.ceil(filteredRows.length / rowsPerPage) - 1))}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, next) => setPage(next)}
        onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Stack>
  );
}
