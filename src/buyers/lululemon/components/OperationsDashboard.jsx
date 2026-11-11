import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, Tab, Tooltip, Typography
} from '@mui/material';
import {
  Refresh, Inventory2Outlined, AccountTreeOutlined, FactCheckOutlined,
  QrCodeScannerOutlined, TaskAltOutlined, InfoOutlined,
  FilterAltOffOutlined
} from '@mui/icons-material';
import { getLululemonOperationsDashboard } from 'services/managementService';
import { useSelectedFactory } from 'utils/factorySelection';
import { BUYER_CODE } from '../../../constants/appConstants';
import { filterScopedPos, dashboardTotals, dashboardOrders, dashboardFactories } from '../services/dashboardSelectors';

// Keep the V11 backend as the source of truth. No hard-coded production metrics.
const C = {
  teal: '#20abc1', tealDark: '#087f96', cyan: '#63c6d6', blue: '#4078d4',
  navy: '#183a53', coral: '#e97168', gold: '#eba943', violet: '#8067c8',
  pale: '#eaf7fa', line: '#dce7ed', muted: '#63798b'
};
const fmt = value => Number(value || 0).toLocaleString();
const n = value => Math.max(0, Number(value || 0));
const percent = (a, total) => total > 0 ? Math.min(100, Math.round(100 * n(a) / total)) : 0;
const short = (value, max = 15) => {
  const text = String(value || '—');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const statusColor = value => {
  if (['PASS', 'FINAL_PASS', 'PICKED'].includes(value)) return 'success';
  if (['FAILED', 'RFID_HOLD', 'WEIGHT_FAILED', 'NOT_PICKED', 'HOLD'].includes(value)) return 'error';
  return 'default';
};
const borderedTable = { '& th, & td': { borderRight: '1px solid', borderBottom: '1px solid', borderColor: '#dce7ed', whiteSpace: 'nowrap' } };

function Status({ value }) {
  return <Chip size="small" variant="outlined" color={statusColor(value)} label={value || 'PENDING'} />;
}

function DashboardPanel({ title, subtitle, end, children, sx = {} }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 0, border: `1px solid ${C.line}`, borderRadius: '4px', boxShadow: '0 5px 24px rgba(25,67,86,0.035)', ...sx }}>
      <CardContent sx={{ p: { xs: 1.5, md: 2.25 }, '&:last-child': { pb: { xs: 1.5, md: 2.25 } } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1.5} mb={2}>
          <Box minWidth={0}>
            <Typography sx={{ color: C.navy, fontWeight: 900, fontSize: 16 }}>{title}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          {end}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function MetricTile({ icon, label, value, note, color, rate }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', minWidth: 0, borderColor: C.line, borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(25,67,86,0.025)', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 1.5, py: 1.1, borderTop: `3px solid ${color}` }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.75}>
          <Typography sx={{ fontSize: 11.5, color: C.muted, fontWeight: 750 }} noWrap>{label}</Typography>
          <Box sx={{ color, display: 'flex', '& svg': { fontSize: 19 } }}>{icon}</Box>
        </Stack>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={0.75}>
          <Typography sx={{ fontSize: { md: 23, xl: 27 }, fontWeight: 900, color: C.navy, letterSpacing: -0.6, lineHeight: 1.25 }}>{fmt(value)}</Typography>
          {typeof rate === 'number' && <Typography sx={{ fontSize: 11, color, fontWeight: 800, whiteSpace: 'nowrap' }}>{rate}%</Typography>}
        </Stack>
        <Tooltip title={note || ''} arrow placement="bottom">
          <Typography sx={{ fontSize: 10.5, color: C.muted, mt: 'auto', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{note}</Typography>
        </Tooltip>
        {typeof rate === 'number' && <Box sx={{ mt: 0.65, height: 4, bgcolor: '#edf2f5', borderRadius: '4px', overflow: 'hidden' }}>
          <Box sx={{ width: `${rate}%`, bgcolor: color, height: '100%' }} />
        </Box>}
      </Box>
    </Card>
  );
}

// SVG donut: every segment is derived from the selected Order/Factory, no mock values.
function Donut({ title, segments, total, centerLabel }) {
  const radius = 61;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = segments.map((segment, index) => {
    const length = total > 0 ? circumference * n(segment.value) / total : 0;
    const arc = { ...segment, offset, length, index };
    offset += length;
    return arc;
  });
  return (
    <Box sx={{ flex: '1 1 225px', minWidth: 0 }}>
      <Typography align="center" sx={{ fontSize: 13, color: C.navy, fontWeight: 800, mb: 0.5 }}>{title}</Typography>
      <Box sx={{ width: '100%', maxWidth: 230, mx: 'auto' }}>
        <svg viewBox="0 0 230 205" width="100%" role="img" aria-label={`${title}: ${segments.map(s => `${s.label} ${fmt(s.value)}`).join(', ')}`}>
          <g transform="translate(115 95) rotate(-90)">
            <circle r={radius} fill="none" stroke="#edf2f5" strokeWidth="23" />
            {arcs.map(arc => arc.length > 0 && (
              <circle key={arc.index} r={radius} fill="none" stroke={arc.color} strokeWidth="23"
                strokeDasharray={`${arc.length} ${circumference}`} strokeDashoffset={-arc.offset}>
                <title>{arc.label}: {fmt(arc.value)} ({percent(arc.value, total)}%)</title>
              </circle>
            ))}
          </g>
          <text x="115" y="88" textAnchor="middle" fontSize="30" fill={C.navy} fontWeight="900">{percent(segments[0]?.value, total)}%</text>
          <text x="115" y="109" textAnchor="middle" fontSize="12" fill={C.muted}>{centerLabel}</text>
          <text x="115" y="176" textAnchor="middle" fontSize="11" fill={C.muted}>{fmt(total)} planned/recorded</text>
        </svg>
      </Box>
      <Stack direction="row" justifyContent="center" flexWrap="wrap" gap={0.75} mt={-1}>
        {segments.map(segment => (
          <Tooltip key={segment.label} title={`${segment.label}: ${fmt(segment.value)}`}>
            <Stack direction="row" alignItems="center" gap={0.4}>
              <Box sx={{ bgcolor: segment.color, width: 8, height: 8, borderRadius: '4px' }} />
              <Typography sx={{ color: C.muted, fontSize: 10.5 }}>{segment.label} {fmt(segment.value)}</Typography>
            </Stack>
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}

function ProcessLane({ label, done, total, color, description, onClick }) {
  const rate = percent(done, total);
  return (
    <Box onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { opacity: 0.85 } : undefined }}>
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="baseline" mb={0.6}>
        <Typography sx={{ fontWeight: 800, color: C.navy, fontSize: 13 }}>{label}</Typography>
        <Typography sx={{ color: C.muted, fontSize: 11.5 }}>{fmt(done)}/{fmt(total)} · <Box component="span" fontWeight={900} color={color}>{rate}%</Box></Typography>
      </Stack>
      <Box sx={{ bgcolor: '#ebf1f5', borderRadius: '4px', height: 11, overflow: 'hidden' }}>
        <Box sx={{ bgcolor: color, borderRadius: '4px', height: '100%', width: `${rate}%`, transition: 'width 200ms ease' }} />
      </Box>
      <Typography sx={{ color: C.muted, fontSize: 10.5, mt: 0.4 }}>{description}</Typography>
    </Box>
  );
}

// Real SVG grouped vertical bar chart; bars support a click-through to the filtered table.
function ComparisonChart({ rows, series, getLabel, onSelect, emptyText }) {
  if (!rows.length) return <Typography variant="body2" color="text.secondary">{emptyText || 'No data for this selection'}</Typography>;
  const width = 760;
  const height = 290;
  const margin = { left: 50, right: 15, top: 22, bottom: 62 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxVal = Math.max(1, ...rows.flatMap(row => series.map(metric => n(row[metric.key]))));
  const top = maxVal * 1.12;
  const band = chartW / rows.length;
  const groupW = Math.min(74, band * 0.73);
  const barW = Math.max(5, Math.min(21, groupW / series.length - 3));
  const actualW = series.length * barW + (series.length - 1) * 3;
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 0.75 }}>
        {series.map(item => <Stack direction="row" alignItems="center" gap={0.5} key={item.key}>
          <Box sx={{ width: 10, height: 10, bgcolor: item.color, borderRadius: '4px' }} />
          <Typography sx={{ fontSize: 11, color: C.muted }}>{item.label}</Typography>
        </Stack>)}
      </Box>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Comparison chart: ${series.map(s => s.label).join(', ')}`}>
        {Array.from({ length: 5 }, (_, index) => {
          const tick = top * index / 4;
          const y = margin.top + chartH - (tick / top) * chartH;
          return <g key={index}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#e7edf1" strokeDasharray={index === 0 ? 'none' : '4 4'} />
            <text x={margin.left - 10} y={y + 4} fontSize="11" fill={C.muted} textAnchor="end">{Math.round(tick).toLocaleString()}</text>
          </g>;
        })}
        {rows.map((row, index) => {
          const baseX = margin.left + index * band + (band - actualW) / 2;
          const label = String(getLabel(row));
          return <g key={`${index}-${label}`} onClick={() => onSelect?.(row)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <rect x={margin.left + index * band} y={margin.top} width={band} height={chartH + 20} fill="transparent" />
            {series.map((metric, sIndex) => {
              const value = n(row[metric.key]);
              const barH = Math.min(chartH, (value / top) * chartH);
              return <rect key={metric.key} x={baseX + sIndex * (barW + 3)} y={margin.top + chartH - barH}
                width={barW} height={barH} rx="2" fill={metric.color}>
                <title>{label} · {metric.label}: {fmt(value)}</title>
              </rect>;
            })}
            <text x={margin.left + index * band + band / 2} y={margin.top + chartH + 18}
              textAnchor="middle" fontSize="11" fill={C.navy} fontWeight="700">{short(label, Math.max(6, Math.floor(band / 8)))}</text>
            <text x={margin.left + index * band + band / 2} y={margin.top + chartH + 34}
              textAnchor="middle" fontSize="10" fill={C.muted}>{onSelect ? 'View details' : ''}</text>
          </g>;
        })}
      </svg>
    </Box>
  );
}

// Keep the page stationary; large datasets scroll inside the table, not the browser window.
function DataTable({ columns, rows, emptyText = 'No matching data', pageSize = 20 }) {
  const [limit, setLimit] = useState(pageSize);
  useEffect(() => { setLimit(pageSize); }, [rows, pageSize]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: { xs: 'auto', md: '100%' } }}>
      <TableContainer sx={{ border: `1px solid ${C.line}`, borderRadius: '4px', flex: '1 1 0', minHeight: 0,
        maxHeight: { xs: 440, md: 'none' }, overflow: 'auto', bgcolor: 'white' }}>
        <Table stickyHeader size="small" sx={{ ...borderedTable, '& th': { fontSize: 11.5, fontWeight: 800, color: C.navy, bgcolor: '#f4f8fb', py: 0.85 },
          '& td': { fontSize: 12, py: 0.8 }, '& .MuiTableRow-root:hover td': { bgcolor: '#f3fafc' } }}>
          <TableHead><TableRow><TableCell>STT</TableCell>{columns.map(c => <TableCell key={c.key}>{c.label}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.slice(0, limit).map((row, index) => <TableRow hover key={`${row.orderId || ''}-${row.poNumber || ''}-${row.cartonNo || ''}-${index}`}>
              <TableCell>{index + 1}</TableCell>
              {columns.map(c => <TableCell key={c.key}>{c.render ? c.render(row) : row[c.key] ?? '—'}</TableCell>)}
            </TableRow>)}
            {!rows.length && <TableRow><TableCell align="center" colSpan={columns.length + 1}>{emptyText}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexShrink: 0, minHeight: 29, pt: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: C.muted }}>Showing {Math.min(limit, rows.length)} / {rows.length}</Typography>
        {limit < rows.length && <Button size="small" onClick={() => setLimit(v => v + pageSize)} sx={{ py: 0, minHeight: 25 }}>Show more</Button>}
      </Stack>
    </Box>
  );
}

const orderColumns = [
  { key: 'orderName', label: 'Order' }, { key: 'pos', label: 'PO' }, { key: 'pickedPos', label: 'Picked' },
  { key: 'notPickedPos', label: 'Not Picked' }, { key: 'plannedCartons', label: 'Planned Cartons' },
  { key: 'createdCartons', label: 'Created Cartons' }, { key: 'weightPass', label: 'Weight PASS' },
  { key: 'weightFailed', label: 'Weight FAILED' }, { key: 'weightPending', label: 'Waiting Weight' },
  { key: 'rfidPass', label: 'RFID PASS' }, { key: 'rfidFailed', label: 'RFID FAILED' },
  { key: 'rfidNotScanned', label: 'RFID Not Scanned' }, { key: 'finalPass', label: 'Final PASS' }
];
const factoryColumns = [
  { key: 'factoryCode', label: 'Factory' }, { key: 'pickedPos', label: 'Picked PO' },
  { key: 'pickedPoNumbers', label: 'PO Numbers', render: r => r.pickedPoNumbers?.length ?
    <Typography variant="caption" sx={{ display: 'block', minWidth: 160, maxWidth: 360, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{r.pickedPoNumbers.join(', ')}</Typography> : '—' },
  { key: 'plannedCartons', label: 'Planned Cartons' }, { key: 'createdCartons', label: 'Created Cartons' },
  { key: 'identifiedCartons', label: 'SSCC Assigned' }, { key: 'weightPass', label: 'Weight PASS' },
  { key: 'weightFailed', label: 'Weight FAILED' }, { key: 'weightPending', label: 'Waiting Weight' },
  { key: 'rfidPass', label: 'RFID PASS' }, { key: 'rfidFailed', label: 'RFID FAILED' },
  { key: 'rfidNotScanned', label: 'RFID Not Scanned' }, { key: 'finalPass', label: 'Final PASS' }
];
const poColumns = [
  { key: 'orderName', label: 'Order' }, { key: 'poNumber', label: 'PO Number' },
  { key: 'factoryCode', label: 'Factory', render: r => r.factoryCode || 'Unassigned' },
  { key: 'pickStatus', label: 'Pick', render: r => <Status value={r.pickStatus} /> },
  { key: 'pickedBy', label: 'Picked By' }, { key: 'sourceRows', label: 'ALL_BP Lines' },
  { key: 'plannedCartons', label: 'Planned Cartons' }, { key: 'createdCartons', label: 'Created Cartons' },
  { key: 'identifiedCartons', label: 'SSCC Assigned' }, { key: 'weightPass', label: 'Weight PASS' },
  { key: 'weightFailed', label: 'Weight FAILED' }, { key: 'rfidPass', label: 'RFID PASS' },
  { key: 'rfidFailed', label: 'RFID FAILED' }, { key: 'rfidNotScanned', label: 'RFID Not Scanned' },
  { key: 'finalPass', label: 'Final PASS' }
];
const cartonColumns = [
  { key: 'poNumber', label: 'PO Number' }, { key: 'factoryCode', label: 'Factory' },
  { key: 'cartonNo', label: 'Carton No' }, { key: 'sscc18', label: 'SSCC' },
  { key: 'plannedQty', label: 'Qty' }, { key: 'weightStatus', label: 'Weight', render: r => <Status value={r.weightStatus} /> },
  { key: 'rfidStatus', label: 'RFID', render: r => <Status value={r.rfidStatus} /> },
  { key: 'rfidAttempted', label: 'Scan Attempted', render: r => r.rfidAttempted ? 'Yes' : 'No' },
  { key: 'finalCheckStatus', label: 'Final', render: r => <Status value={r.finalCheckStatus} /> }
];

export default function OperationsDashboard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const [orderFilter, setOrderFilter] = useState('ALL');
  const { factoryCode: selectedFactory, loading: factoryLoading } = useSelectedFactory(BUYER_CODE.LULULEMON);
  const [factoryFilter, setFactoryFilter] = useState('');
  const [pickFilter, setPickFilter] = useState('ALL');
  const [exceptionFilter, setExceptionFilter] = useState('ALL');
  const [lastSync, setLastSync] = useState(null);

  const reload = useCallback(async () => {
    if (factoryLoading || !selectedFactory) { setData(null); setBusy(false); return; }
    setBusy(true);
    setData(null); // never leave totals from previous Factory visible
    setError('');
    setFactoryFilter(selectedFactory);
    setOrderFilter('ALL');
    try { setData(await getLululemonOperationsDashboard()); setLastSync(new Date()); }
    catch (e) { setError(e?.response?.data?.message || e.message || 'Dashboard unavailable'); }
    finally { setBusy(false); }
  }, [factoryLoading, selectedFactory]);
  useEffect(() => { reload(); }, [reload]);

  // V11 selectors use one unique PO per (Order ID, PO Number), never count ALL_BP source rows as POs.
  const scopePos = useMemo(() => filterScopedPos(data?.pos, orderFilter, factoryFilter), [data, orderFilter, factoryFilter]);
  const totals = useMemo(() => dashboardTotals(scopePos), [scopePos]);
  const orders = useMemo(() => dashboardOrders(scopePos, data?.orders), [scopePos, data]);
  const factories = useMemo(() => dashboardFactories(scopePos, data?.factories, factoryFilter), [scopePos, data, factoryFilter]);
  const weightPending = useMemo(() => scopePos.reduce((sum, po) => sum + n(po.weightPending), 0), [scopePos]);
  const poRows = useMemo(() => scopePos.filter(po =>
    (pickFilter === 'ALL' || (pickFilter === 'PICKED' ? po.picked : !po.picked)) &&
    (exceptionFilter === 'ALL' ||
      (exceptionFilter === 'UNPICKED' && !po.picked) ||
      (exceptionFilter === 'WEIGHT_FAILED' && n(po.weightFailed) > 0) ||
      (exceptionFilter === 'RFID_FAILED' && n(po.rfidFailed) > 0) ||
      (exceptionFilter === 'NOT_SCANNED' && n(po.rfidNotScanned) > 0))
  ), [scopePos, pickFilter, exceptionFilter]);
  const selectedPairs = useMemo(() => new Set(poRows.map(po => `${po.orderId}|${po.poNumber}`)), [poRows]);
  const cartons = useMemo(() => (data?.cartons || []).filter(c => selectedPairs.has(`${c.orderId}|${c.poNumber}`)), [data, selectedPairs]);
  const topOrders = useMemo(() => [...orders].sort((a, b) => n(b.plannedCartons) - n(a.plannedCartons)).slice(0, 6), [orders]);
  const factoryChartRows = useMemo(() => factories.filter(f => f.pickedPos || f.plannedCartons).slice(0, 7), [factories]);
  const chartBase = Math.max(n(totals.plannedCartons), n(totals.weightPass) + n(totals.weightFailed) + weightPending,
    n(totals.rfidPass) + n(totals.rfidFailed) + n(totals.rfidNotScanned));
  const rfidOther = Math.max(0, chartBase - n(totals.rfidPass) - n(totals.rfidFailed) - n(totals.rfidNotScanned));
  const weightOther = Math.max(0, chartBase - n(totals.weightPass) - n(totals.weightFailed));
  const jumpTo = (kind) => {
    setExceptionFilter(kind);
    setPickFilter('ALL');
  };
  const clearFilters = () => { setOrderFilter('ALL'); setFactoryFilter(selectedFactory); setPickFilter('ALL'); setExceptionFilter('ALL'); };

  const helpText = `Dashboard uses saved MongoDB statuses. PO is unique by (Order ID, PO Number).
    Planned cartons may exceed generated cartons. Weight / RFID count cartons; Picking counts POs.
    Final PASS requires Weight PASS and RFID PASS. Order and Factory filters affect all metrics;
    PO Picking and exception filters apply to detail rows only. Factory access is enforced by the backend.`;

  return (
    <Paper variant="outlined" sx={{ height: { xs: 'auto', md: '100%' }, minHeight: 0,
      display: 'flex', flexDirection: 'column', gap: 1, p: { xs: 1, md: 1.25 }, mb: 0,
      overflow: { xs: 'visible', md: 'hidden' }, borderRadius: '4px', bgcolor: '#f6fafc', borderColor: C.line }}>
      {/* One compact header replaces the oversized hero; global header still owns Factory switching. */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between" gap={1} sx={{ flexShrink: 0, px: { xs: 0.25, md: 0.5 }, py: 0.25 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography sx={{ color: C.navy, fontWeight: 900, fontSize: { xs: 18, md: 21 }, lineHeight: 1.25 }}>Operations Dashboard</Typography>
            <Tooltip title={helpText} arrow><InfoOutlined sx={{ color: C.muted, fontSize: 18, cursor: 'help' }} /></Tooltip>
          </Stack>
          <Typography sx={{ fontSize: 11, color: C.muted }}>
            Lululemon · {selectedFactory || 'Select a factory'} · {fmt(totals.orders)} Orders · {fmt(totals.pos)} unique PO
            {lastSync ? ` · Updated ${lastSync.toLocaleTimeString()}` : ''}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={reload} disabled={busy || factoryLoading}
          startIcon={busy ? <CircularProgress size={14} /> : <Refresh />} sx={{ fontWeight: 800, minHeight: 32, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          Refresh
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ flexShrink: 0, py: 0 }}>{error}</Alert>}
      {!factoryLoading && !selectedFactory && !error && <Alert severity="info" sx={{ flexShrink: 0, py: 0 }}>Choose a Factory in the main header to view its data.</Alert>}

      {/* The three selectors share one line on desktop; avoid additional filter cards. */}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="center" sx={{ flexShrink: 0 }}>
        <FormControl size="small" fullWidth sx={{ flex: 1.5, minWidth: 0 }}><InputLabel>Order</InputLabel>
          <Select label="Order" value={orderFilter} onChange={event => setOrderFilter(event.target.value)}>
            <MenuItem value="ALL">All Orders</MenuItem>
            {(data?.orders || []).map(o => <MenuItem key={o.orderId} value={o.orderId}>{o.orderName || o.orderId}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth sx={{ flex: 1, minWidth: 0 }}><InputLabel>Factory</InputLabel>
          <Select label="Factory" value={selectedFactory || ''} disabled>
            {selectedFactory && <MenuItem value={selectedFactory}>{selectedFactory}</MenuItem>}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth sx={{ flex: 1, minWidth: 0 }}><InputLabel>PO Picking</InputLabel>
          <Select label="PO Picking" value={pickFilter} onChange={event => { setPickFilter(event.target.value); setExceptionFilter('ALL'); }}>
            <MenuItem value="ALL">All PO</MenuItem><MenuItem value="PICKED">Picked</MenuItem><MenuItem value="NOT_PICKED">Not Picked</MenuItem>
          </Select>
        </FormControl>
        <Button size="small" variant="outlined" startIcon={<FilterAltOffOutlined />} onClick={clearFilters}
          sx={{ whiteSpace: 'nowrap', height: 40, flexShrink: 0 }}>Clear</Button>
      </Stack>

      <Box sx={{ display: 'grid', flexShrink: 0, gap: 1, gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(3, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' } }}>
        <MetricTile icon={<AccountTreeOutlined />} label="Total Unique PO" value={totals.pos} note={`${fmt(totals.notPickedPos)} PO not picked`} rate={percent(totals.pickedPos, totals.pos)} color={C.tealDark} />
        <MetricTile icon={<Inventory2Outlined />} label="Planned Cartons" value={totals.plannedCartons} note={`${fmt(totals.createdCartons)} cartons generated`} rate={percent(totals.createdCartons, totals.plannedCartons)} color={C.cyan} />
        <MetricTile icon={<FactCheckOutlined />} label="Weight PASS" value={totals.weightPass} note={`${fmt(totals.weightFailed)} FAILED · ${fmt(weightPending)} waiting`} rate={percent(totals.weightPass, chartBase)} color={C.blue} />
        <MetricTile icon={<QrCodeScannerOutlined />} label="RFID PASS" value={totals.rfidPass} note={`${fmt(totals.rfidFailed)} FAILED · ${fmt(totals.rfidNotScanned)} not scanned`} rate={percent(totals.rfidPass, chartBase)} color={C.violet} />
        <MetricTile icon={<TaskAltOutlined />} label="Final PASS" value={totals.finalPass} note="Both weight and RFID passed" rate={percent(totals.finalPass, chartBase)} color={C.teal} />
      </Box>

      {/* Chart-first one-page dashboard: keep KPI + charts, remove detail tables. */}
      <Card variant="outlined" sx={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column',
        borderColor: C.line, borderRadius: '4px', boxShadow: 'none', overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between" gap={0.6} sx={{ px: 1.5, pt: 1.1, pb: 0.6, flexShrink: 0 }}>
          <Box>
            <Typography sx={{ color: C.navy, fontSize: 15, fontWeight: 900 }}>Operations Insights</Typography>
            <Typography sx={{ color: C.muted, fontSize: 10.5 }}>Visual summary by Order and Factory</Typography>
          </Box>
          {exceptionFilter !== 'ALL' && <Button size="small" variant="outlined" onClick={() => setExceptionFilter('ALL')}>
            Clear {exceptionFilter.replaceAll('_', ' ').toLowerCase()} filter
          </Button>}
        </Stack>
        {exceptionFilter !== 'ALL' && <Alert severity="info" sx={{ mx: 1.5, mb: 0.8, py: 0, flexShrink: 0, '& .MuiAlert-message': { py: 0.5 } }}>
          Metrics and charts are filtered by {exceptionFilter.replaceAll('_', ' ').toLowerCase()}.
        </Alert>}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', px: 1.25, pb: 0.8 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.1, mb: 1.1 }}>
            <DashboardPanel title="Carton Quality Breakdown" subtitle="Actual PASS / FAILED / pending distributions">
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <Donut title="Weight Check" total={chartBase} centerLabel="Weight PASS" segments={[
                  { label: 'PASS', value: n(totals.weightPass), color: C.teal },
                  { label: 'FAILED / HOLD', value: n(totals.weightFailed), color: C.coral },
                  { label: 'Waiting', value: weightOther, color: '#dfe7ed' }
                ]}/>
                <Donut title="RFID Verification" total={chartBase} centerLabel="RFID PASS" segments={[
                  { label: 'PASS', value: n(totals.rfidPass), color: C.teal },
                  { label: 'FAILED', value: n(totals.rfidFailed), color: C.coral },
                  { label: 'Not scanned', value: n(totals.rfidNotScanned), color: C.gold },
                  { label: 'Other / in progress', value: rfidOther, color: '#dfe7ed' }
                ]}/>
              </Stack>
            </DashboardPanel>
            <DashboardPanel title="Operations Flow" subtitle="PO count for Picking; carton count for subsequent steps">
              <Stack gap={1.35} py={0.25}>
                <ProcessLane label="1 · PO Picking" done={totals.pickedPos} total={totals.pos} color={C.tealDark}
                  description={`${fmt(totals.notPickedPos)} PO waiting for Factory pickup`} onClick={() => jumpTo('UNPICKED')} />
                <ProcessLane label="2 · Carton Identified" done={scopePos.reduce((s, p) => s + n(p.identifiedCartons), 0)} total={chartBase} color={C.cyan}
                  description="Assigned SSCC (planned carton denominator)" />
                <ProcessLane label="3 · Weight PASS" done={totals.weightPass} total={chartBase} color={C.blue}
                  description={`${fmt(totals.weightFailed)} FAILED / HOLD`} onClick={() => jumpTo('WEIGHT_FAILED')} />
                <ProcessLane label="4 · RFID PASS" done={totals.rfidPass} total={chartBase} color={C.violet}
                  description={`${fmt(totals.rfidNotScanned)} not scanned`} onClick={() => jumpTo('NOT_SCANNED')} />
                <ProcessLane label="5 · Final PASS" done={totals.finalPass} total={chartBase} color={C.teal}
                  description="All required checks passed" />
              </Stack>
            </DashboardPanel>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 1.1 }}>
            <DashboardPanel title="Factory Comparison" subtitle="Weight / RFID / Final PASS by active Factory">
              <ComparisonChart rows={factoryChartRows} getLabel={row => row.factoryCode}
                series={[{ key: 'weightPass', label: 'Weight PASS', color: C.cyan },
                  { key: 'rfidPass', label: 'RFID PASS', color: C.blue },
                  { key: 'finalPass', label: 'Final PASS', color: C.tealDark }]}
                emptyText="No picked PO in your assigned factories" />
            </DashboardPanel>
            <DashboardPanel title="Top Orders" subtitle="Planned cartons versus Weight / Final PASS">
              <ComparisonChart rows={topOrders} getLabel={row => row.orderName || row.orderId}
                series={[{ key: 'plannedCartons', label: 'Planned', color: C.cyan },
                  { key: 'weightPass', label: 'Weight PASS', color: C.blue },
                  { key: 'finalPass', label: 'Final PASS', color: C.coral }]}
                emptyText="No Orders for the selected scope" />
            </DashboardPanel>
          </Box>
        </Box>
      </Card>
    </Paper>
  );
}
