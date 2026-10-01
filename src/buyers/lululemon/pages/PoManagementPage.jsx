import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider, ListItemText, Menu, MenuItem,
  Paper, Stack,  TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, Typography
} from '@mui/material';
import { Refresh, UploadFile, ViewColumn } from '@mui/icons-material';
import { CompactPageHeader, CompactStat, CompactToolbar } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { canManageSales } from 'utils/accessControl';
import LululemonStatusChip from '../components/LululemonStatusChip';
import LululemonOrderScope from '../components/LululemonOrderScope';
import { importAllBp, listAllLululemonPos } from '../services/lululemonService';

const COLUMN_STORAGE_KEY = 'lululemon.po-master.visible-columns.v2';
const normalize = (value) => String(value || '').trim().toLowerCase();
const headerKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '');

// Current ALL_BP columns. New/unknown columns are appended automatically from allBpRows.
const KNOWN_ALL_BP_HEADERS = [
  'HOD (Hand over date)', 'SGS testing', 'GB testing', 'BV inspection', 'DC Code', 'Destination', 'Chanel',
  'Master PO', 'PO', 'Packing Plan', 'SO (PTS)', 'Style#', 'Description', 'Color description', "Q'ty", 'Pcs/ctn',
  'lẻ', 'Ctns', 'Dư', 'Remark', 'FOB Price', 'Care & Content Label', 'China Inspection Tag', 'FOB Amount',
  'Total FOB+Prcie Tag', 'FOB Fty Price', 'FOB Fty Amount', 'Ship mode', 'Season', 'DP%', 'MPR NUMBER',
  'FWD', 'Carton Box Size', 'NW', 'GW', 'Remark 2'
];

const SOURCE_ALIAS = {
  HOD: 'HOD', HODHANDOVERDATE: 'HOD', HANDOVERDATE: 'HOD',
  SGSTESTING: 'SGS_TESTING', SGSTEST: 'SGS_TESTING',
  GBTESTING: 'GB_TESTING', GBTEST: 'GB_TESTING',
  BVINSPECTION: 'BV_INSPECTION', BVINSPECT: 'BV_INSPECTION',
  DCCODE: 'DC_CODE', DC: 'DC_CODE',
  DESTINATION: 'DESTINATION', DEST: 'DESTINATION',
  CHANEL: 'CHANNEL', CHANNEL: 'CHANNEL',
  MASTERPO: 'MASTER_PO',
  PO: 'PO', PONO: 'PO', PONUMBER: 'PO', PURCHASEORDER: 'PO',
  PACKINGPLAN: 'PACKING_PLAN', PACKINGPLANNO: 'PACKING_PLAN',
  SOPTS: 'SALES_ORDER_PTS', SO: 'SALES_ORDER_PTS', SALESORDERPTS: 'SALES_ORDER_PTS', SALESORDER: 'SALES_ORDER_PTS',
  STYLE: 'STYLE', STYLENO: 'STYLE', STYLENUMBER: 'STYLE',
  DESCRIPTION: 'DESCRIPTION', DESC: 'DESCRIPTION',
  COLORDESCRIPTION: 'COLOR', COLOR: 'COLOR', COLOURDESCRIPTION: 'COLOR', COLOUR: 'COLOR',
  QTY: 'QTY', QTYTOTAL: 'QTY', TOTALQTY: 'QTY', QUANTITY: 'QTY', ORDERQTY: 'QTY',
  PCSCTN: 'PCS_CTN', PCSPERCTN: 'PCS_CTN', PCSPERCARTON: 'PCS_CTN', QTYPERCTN: 'PCS_CTN', PCSCTNS: 'PCS_CTN', UNITQTY: 'PCS_CTN',
  LE: 'ODD_RATIO',
  CTNS: 'CTNS', CARTONS: 'CTNS', CARTONQTY: 'CTNS', TOTALCARTONS: 'CTNS',
  DU: 'REMAINDER', REMAINDER: 'REMAINDER', REMAINDERQTY: 'REMAINDER', BALANCEQTY: 'REMAINDER', ODDPCS: 'REMAINDER',
  REMARK: 'REMARK',
  FOBPRICE: 'FOB_PRICE',
  CARECONTENTLABEL: 'CARE_CONTENT_LABEL', CAREANDCONTENTLABEL: 'CARE_CONTENT_LABEL',
  CHINAINSPECTIONTAG: 'CHINA_INSPECTION_TAG',
  FOBAMOUNT: 'FOB_AMOUNT',
  TOTALFOBPRCIETAG: 'TOTAL_FOB_PRICE_TAG', TOTALFOBPRICETAG: 'TOTAL_FOB_PRICE_TAG',
  FOBFTYPRICE: 'FOB_FTY_PRICE', FOBFACTORYPRICE: 'FOB_FTY_PRICE',
  FOBFTYAMOUNT: 'FOB_FTY_AMOUNT', FOBFACTORYAMOUNT: 'FOB_FTY_AMOUNT',
  SHIPMODE: 'SHIP_MODE', SHIPPINGMODE: 'SHIP_MODE',
  SEASON: 'SEASON',
  DP: 'DP_PERCENT', DPPERCENT: 'DP_PERCENT',
  MPRNUMBER: 'MPR_NUMBER', MPRNO: 'MPR_NUMBER', MPR: 'MPR_NUMBER',
  FWD: 'FWD', FORWARDER: 'FWD',
  CARTONBOXSIZE: 'CARTON_BOX_SIZE', CARTONSIZE: 'CARTON_BOX_SIZE', BOXSIZE: 'CARTON_BOX_SIZE',
  NW: 'NW', NETWEIGHT: 'NW', NETWEIGHTKG: 'NW',
  GW: 'GW', GROSSWEIGHT: 'GW', GROSSWEIGHTKG: 'GW',
  REMARK2: 'REMARK_2', REMARK02: 'REMARK_2'
};

const canonicalSourceKey = (label) => {
  const normalized = headerKey(label);
  return SOURCE_ALIAS[normalized] || `RAW_${normalized || 'COLUMN'}`;
};

const ALL_BP_FORMULA_KEYS = new Set([
  'ODD_RATIO', 'CTNS', 'REMAINDER', 'FOB_AMOUNT', 'TOTAL_FOB_PRICE_TAG', 'FOB_FTY_PRICE', 'FOB_FTY_AMOUNT'
]);

const SYSTEM_COLUMNS = [
  { key: 'sys:factory', label: 'Factory', group: 'System', minWidth: 100, value: (row) => row.factoryCode || '—' },
  { key: 'sys:sku', label: 'SKU', group: 'System', minWidth: 145, value: (row) => row.sku || '' },
  { key: 'sys:exFtyDate', label: 'Ex-fty Date', group: 'System', minWidth: 115, value: (row) => row.exFtyDate || '—' },
  { key: 'sys:status', label: 'Status', group: 'System', minWidth: 130, status: true }
];

const DEFAULT_COLUMN_KEYS = [
  'sys:factory', 'src:PO', 'src:STYLE', 'src:DESTINATION', 'src:QTY', 'src:PCS_CTN', 'src:CTNS',
  'src:SHIP_MODE', 'sys:sku', 'sys:exFtyDate', 'sys:status'
];

const uniqueSourceValues = (row, canonical) => {
  const values = [];
  for (const sourceRow of Array.isArray(row.allBpRows) ? row.allBpRows : []) {
    for (const [label, value] of Object.entries(sourceRow || {})) {
      if (canonicalSourceKey(label) !== canonical) continue;
      const text = String(value ?? '').trim();
      if (text && !values.includes(text)) values.push(text);
    }
  }
  return values;
};

const sourceValue = (row, canonical) => {
  // PO-level calculated values stay readable when one PO spans more than one ALL_BP row.
  if (canonical === 'PO') return row.poNumber || '—';
  if (canonical === 'STYLE') return row.styleNumber || row.style || '—';
  if (canonical === 'QTY') return row.totalQty ?? row.plannedTotalQty ?? '—';
  if (canonical === 'PCS_CTN') return row.qtyPerCarton ?? row.pcsPerCarton ?? '—';

  const values = uniqueSourceValues(row, canonical);
  if (ALL_BP_FORMULA_KEYS.has(canonical)) return values.length ? values.join(' | ') : '—';
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
    const saved = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY));
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
  const [message, setMessage] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(loadSavedColumns);
  const fileRef = useRef(null);
  const sales = canManageSales();

  const load = useCallback(async () => {
    if (!orderId) { setRows([]); return; }
    setLoading(true);
    try {
      setRows(await listAllLululemonPos(orderId));
    } catch (error) {
      setMessage({ severity: 'error', text: error?.response?.data?.message || error.message || 'Unable to load LULULEMON PO.' });
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
    KNOWN_ALL_BP_HEADERS.forEach((label) => {
      const canonical = canonicalSourceKey(label);
      columns.set(canonical, { key: `src:${canonical}`, canonical, label, group: 'ALL_BP', minWidth: 120 });
    });
    const detectedFromFile = new Set();
    rows.forEach((row) => {
      (row.allBpHeaders || []).forEach((label) => {
        const canonical = canonicalSourceKey(label);
        if (!canonical || detectedFromFile.has(canonical)) return;
        columns.set(canonical, { key: `src:${canonical}`, canonical, label, group: 'ALL_BP', minWidth: 120 });
        detectedFromFile.add(canonical);
      });
      (row.allBpRows || []).forEach((sourceRow) => {
        Object.keys(sourceRow || {}).forEach((label) => {
          const canonical = canonicalSourceKey(label);
          if (!canonical || detectedFromFile.has(canonical)) return;
          columns.set(canonical, { key: `src:${canonical}`, canonical, label, group: 'ALL_BP', minWidth: 120 });
          detectedFromFile.add(canonical);
        });
      });
    });
    return Array.from(columns.values());
  }, [rows]);

  const allColumns = useMemo(() => [...SYSTEM_COLUMNS, ...sourceColumns], [sourceColumns]);
  const allColumnSignature = useMemo(() => allColumns.map((column) => column.key).join('|'), [allColumns]);

  useEffect(() => {
    if (!allColumns.length) return;
    setVisibleColumnKeys((current) => {
      if (current === null) return DEFAULT_COLUMN_KEYS.filter((key) => allColumns.some((column) => column.key === key));
      const valid = current.filter((key) => allColumns.some((column) => column.key === key));
      return valid.length ? valid : DEFAULT_COLUMN_KEYS.filter((key) => allColumns.some((column) => column.key === key));
    });
    // Signature changes only when available columns change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allColumnSignature]);

  useEffect(() => {
    if (!Array.isArray(visibleColumnKeys)) return;
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumnKeys));
  }, [visibleColumnKeys]);

  const visibleColumns = useMemo(() => {
    const selected = new Set(visibleColumnKeys || DEFAULT_COLUMN_KEYS);
    return allColumns.filter((column) => selected.has(column.key));
  }, [allColumns, visibleColumnKeys]);

  const toggleColumn = (key) => {
    setVisibleColumnKeys((current) => {
      const selected = new Set(current || DEFAULT_COLUMN_KEYS);
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
    setLoading(true);
    try {
      const result = await importAllBp(orderId, file, true);
      const warnings = Array.isArray(result.warnings) ? result.warnings : [];
      setMessage({
        severity: warnings.length ? 'warning' : 'success',
        text: `ALL_BP imported into this Order: ${result.createdPos || 0} PO, ${result.updatedPos || 0} updated, ${result.createdCartons || 0} cartons, ${result.createdItems || 0} item rows.${warnings.length ? ` ${warnings.length} note(s): ${warnings.join(' | ')}` : ''}`
      });
      await load();
    } catch (error) {
      setMessage({ severity: 'error', text: error?.response?.data?.message || error.message || 'ALL_BP import failed.' });
    } finally { setLoading(false); }
  };

  const renderColumnCell = (row, column) => {
    if (column.status) return <LululemonStatusChip status={row.status} />;
    if (column.key === 'sys:sku') {
      return row.sku || <Typography color="warning.main" variant="body2">Not assigned</Typography>;
    }
    if (column.key.startsWith('src:')) return sourceValue(row, column.canonical);
    return column.value?.(row) ?? '—';
  };

  const tableColSpan = Math.max(1, visibleColumns.length);

  return (
    <Stack spacing={1.5}>
      <CompactPageHeader
        title="LULULEMON · PO Master Data"
        subtitle="ALL_BP data for the selected Order. All source columns are saved; choose which columns to show on the table."
        actions={(<>
          <Button size="small" startIcon={<Refresh />} onClick={load} disabled={loading || !orderId}>Refresh</Button>
          {sales && <Button size="small" variant="contained" startIcon={<UploadFile />} onClick={() => fileRef.current?.click()} disabled={loading || !orderId}>Import ALL_BP</Button>}
          <input ref={fileRef} hidden type="file" accept=".xlsx,.xls" onChange={upload} />
        </>)}
      />

      <LululemonOrderScope value={orderId} onChange={setOrderId} disabled={loading} />
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
          <MenuItem onClick={() => setVisibleColumnKeys(DEFAULT_COLUMN_KEYS.filter((key) => allColumns.some((column) => column.key === key)))}>
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
          { key: 'status', label: 'Status', options: ['NOT_STARTED', 'PACKING', 'WAITING_EX_FTY', 'WAITING_LABEL', 'WAITING_SSCC', 'READY_TO_SHIP'] }
        ]}
        values={filters}
        onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
        onClear={() => setFilters({ factoryCode: '', poNumber: '', style: '', sku: '', exFtyDate: '', status: '' })}
        disabled={!orderId}
      />

      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
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
