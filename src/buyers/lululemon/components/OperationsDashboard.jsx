import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl, InputLabel,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, Tab, Tooltip, Typography
} from '@mui/material';
import {
  Refresh, Inventory2Outlined, AccountTreeOutlined, FactCheckOutlined,
  QrCodeScannerOutlined, TaskAltOutlined, WarningAmberOutlined,
  ArrowForwardOutlined, FilterAltOffOutlined
} from '@mui/icons-material';
import { getLululemonOperationsDashboard } from 'services/managementService';
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
    <Card variant="outlined" sx={{ minWidth: 0, border: `1px solid ${C.line}`, borderRadius: 3, boxShadow: '0 5px 24px rgba(25,67,86,0.035)', ...sx }}>
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
    <Card variant="outlined" sx={{ minWidth: 0, borderColor: C.line, borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 17px rgba(25,67,86,0.04)' }}>
      <Box sx={{ height: 5, bgcolor: color }} />
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Stack direction="row" alignItems="start" justifyContent="space-between" mb={1}>
          <Typography sx={{ fontSize: 12.5, color: C.muted, fontWeight: 700 }}>{label}</Typography>
          <Box sx={{ color, bgcolor: `${color}16`, borderRadius: 2, width: 35, height: 35, display: 'grid', placeItems: 'center' }}>{icon}</Box>
        </Stack>
        <Typography sx={{ fontSize: { xs: 27, xl: 31 }, fontWeight: 900, letterSpacing: -1, color: C.navy, lineHeight: 1.1 }}>{fmt(value)}</Typography>
        <Typography sx={{ color: C.muted, fontSize: 11.5, minHeight: 31, mt: 1 }}>{note}</Typography>
        {typeof rate === 'number' && (
          <Box mt={0.35}>
            <Stack direction="row" justifyContent="space-between" mb={0.45}>
              <Typography sx={{ fontSize: 10.5, color: C.muted }}>Completion</Typography>
              <Typography sx={{ fontSize: 11, color, fontWeight: 800 }}>{rate}%</Typography>
            </Stack>
            <Box sx={{ bgcolor: '#edf2f5', height: 7, overflow: 'hidden', borderRadius: 10 }}>
              <Box sx={{ width: `${rate}%`, height: '100%', bgcolor: color, borderRadius: 10 }} />
            </Box>
          </Box>
        )}
      </CardContent>
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
              <Box sx={{ bgcolor: segment.color, width: 8, height: 8, borderRadius: 1 }} />
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
      <Box sx={{ bgcolor: '#ebf1f5', borderRadius: 20, height: 11, overflow: 'hidden' }}>
        <Box sx={{ bgcolor: color, borderRadius: 20, height: '100%', width: `${rate}%`, transition: 'width 200ms ease' }} />
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
          <Box sx={{ width: 10, height: 10, bgcolor: item.color, borderRadius: 0.5 }} />
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

function AlertItem({ title, value, detail, color, onClick }) {
  return <Box onClick={onClick} sx={{ border: `1px solid ${color}40`, borderLeft: `4px solid ${color}`, p: 1.25, borderRadius: 2, minWidth: 0,
    cursor: 'pointer', bgcolor: '#fff', '&:hover': { bgcolor: `${color}0c`, transform: 'translateY(-1px)' }, transition: '120ms ease' }}>
    <Typography sx={{ fontSize: 11.5, color: C.muted }}>{title}</Typography>
    <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1}>
      <Typography sx={{ fontSize: 23, fontWeight: 900, color }}>{fmt(value)}</Typography>
      <ArrowForwardOutlined sx={{ color, fontSize: 17 }} />
    </Stack>
    <Typography sx={{ fontSize: 10.5, color: C.muted }}>{detail}</Typography>
  </Box>;
}

function DataTable({ columns, rows, emptyText = 'No matching data', pageSize = 20 }) {
  const [limit, setLimit] = useState(pageSize);
  useEffect(() => { setLimit(pageSize); }, [rows, pageSize]);
  return <>
    <TableContainer sx={{ border: `1px solid ${C.line}`, borderRadius: 2, maxHeight: 490 }}>
      <Table stickyHeader size="small" sx={borderedTable}>
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
    <Stack direction="row" alignItems="center" justifyContent="space-between" mt={1}>
      <Typography variant="caption" color="text.secondary">Showing {Math.min(limit, rows.length)} / {rows.length}</Typography>
      {limit < rows.length && <Button size="small" onClick={() => setLimit(v => v + pageSize)}>Show more</Button>}
    </Stack>
  </>;
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
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [factoryFilter, setFactoryFilter] = useState('ALL');
  const [pickFilter, setPickFilter] = useState('ALL');
  const [exceptionFilter, setExceptionFilter] = useState('ALL');
  const [view, setView] = useState(0);
  const detailsAnchor = useRef(null);
  const [lastSync, setLastSync] = useState(null);

  const reload = useCallback(async () => {
    setBusy(true);
    setError('');
    try { setData(await getLululemonOperationsDashboard()); setLastSync(new Date()); }
    catch (e) { setError(e?.response?.data?.message || e.message || 'Dashboard unavailable'); }
    finally { setBusy(false); }
  }, []);
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
  const notPicked = useMemo(() => scopePos.filter(po => !po.picked).slice(0, 7), [scopePos]);
  const chartBase = Math.max(n(totals.plannedCartons), n(totals.weightPass) + n(totals.weightFailed) + weightPending,
    n(totals.rfidPass) + n(totals.rfidFailed) + n(totals.rfidNotScanned));
  const rfidOther = Math.max(0, chartBase - n(totals.rfidPass) - n(totals.rfidFailed) - n(totals.rfidNotScanned));
  const weightOther = Math.max(0, chartBase - n(totals.weightPass) - n(totals.weightFailed));
  const jumpTo = (kind) => {
    setExceptionFilter(kind);
    setPickFilter('ALL');
    setView(2);
    detailsAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const clearFilters = () => { setOrderFilter('ALL'); setFactoryFilter('ALL'); setPickFilter('ALL'); setExceptionFilter('ALL'); };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 2 }, mb: 2, borderRadius: 3, bgcolor: '#f6fafc', borderColor: C.line }}>
      <Box sx={{ p: { xs: 2, md: 2.5 }, mb: 1.75, background: `linear-gradient(112deg, ${C.tealDark}, ${C.teal} 72%, ${C.cyan})`, color: 'white', borderRadius: 3,
        position: 'relative', overflow: 'hidden', boxShadow: '0 10px 24px rgba(12,150,176,0.15)' }}>
        <Box sx={{ position: 'absolute', width: 300, height: 300, right: -90, top: -180, border: '48px solid rgba(255,255,255,0.09)', borderRadius: '50%', pointerEvents: 'none' }} />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', md: 'center' }} gap={2} sx={{ position: 'relative' }}>
          <Box>
            <Typography sx={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 800, letterSpacing: 2, opacity: 0.86 }}>LULULEMON / OPERATIONS INTELLIGENCE</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 24, md: 30 }, lineHeight: 1.2, mt: 0.65 }}>Operations Dashboard</Typography>
            <Typography sx={{ fontSize: 12.5, opacity: 0.9, mt: 0.75 }}>Order → PO Picking → Carton Weight → RFID Verification</Typography>
            {lastSync && <Typography sx={{ fontSize: 10.5, opacity: 0.8, mt: 0.7 }}>Last refreshed: {lastSync.toLocaleTimeString()}</Typography>}
          </Box>
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
            <Chip label={`${fmt(totals.orders)} Orders`} sx={{ bgcolor: '#ffffff25', color: 'white', fontWeight: 800, border: '1px solid #ffffff50' }} />
            <Chip label={`${fmt(totals.pos)} Unique PO`} sx={{ bgcolor: '#ffffff25', color: 'white', fontWeight: 800, border: '1px solid #ffffff50' }} />
            <Button size="small" variant="contained" onClick={reload} disabled={busy} startIcon={busy ? <CircularProgress size={14} /> : <Refresh />}
              sx={{ bgcolor: 'white', color: C.tealDark, fontWeight: 900, '&:hover': { bgcolor: '#e9f9fb' } }}>Refresh</Button>
          </Stack>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      <Card variant="outlined" sx={{ mb: 1.75, borderColor: C.line, borderRadius: 2.5 }}>
        <CardContent sx={{ p: '12px !important' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" gap={1.2}>
            <FormControl size="small" fullWidth sx={{ flex: 2 }}><InputLabel>Order</InputLabel>
              <Select label="Order" value={orderFilter} onChange={event => setOrderFilter(event.target.value)}>
                <MenuItem value="ALL">All Orders</MenuItem>
                {(data?.orders || []).map(o => <MenuItem key={o.orderId} value={o.orderId}>{o.orderName || o.orderId}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth><InputLabel>Factory</InputLabel>
              <Select label="Factory" value={factoryFilter} onChange={event => setFactoryFilter(event.target.value)}>
                <MenuItem value="ALL">All Factories</MenuItem>
                {(data?.factories || []).map(f => <MenuItem key={f.factoryCode} value={f.factoryCode}>{f.factoryCode}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth><InputLabel>PO Picking</InputLabel>
              <Select label="PO Picking" value={pickFilter} onChange={event => { setPickFilter(event.target.value); setExceptionFilter('ALL'); }}>
                <MenuItem value="ALL">All PO</MenuItem><MenuItem value="PICKED">Picked</MenuItem><MenuItem value="NOT_PICKED">Not Picked</MenuItem>
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" startIcon={<FilterAltOffOutlined />} onClick={clearFilters} sx={{ whiteSpace: 'nowrap' }}>Clear</Button>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(5, minmax(0,1fr))' }, mb: 1.75 }}>
        <MetricTile icon={<AccountTreeOutlined />} label="Total Unique PO" value={totals.pos} note={`${fmt(totals.notPickedPos)} PO not picked`} rate={percent(totals.pickedPos, totals.pos)} color={C.tealDark} />
        <MetricTile icon={<Inventory2Outlined />} label="Planned Cartons" value={totals.plannedCartons} note={`${fmt(totals.createdCartons)} cartons generated`} rate={percent(totals.createdCartons, totals.plannedCartons)} color={C.cyan} />
        <MetricTile icon={<FactCheckOutlined />} label="Weight PASS" value={totals.weightPass} note={`${fmt(totals.weightFailed)} FAILED · ${fmt(weightPending)} waiting`} rate={percent(totals.weightPass, chartBase)} color={C.blue} />
        <MetricTile icon={<QrCodeScannerOutlined />} label="RFID PASS" value={totals.rfidPass} note={`${fmt(totals.rfidFailed)} FAILED · ${fmt(totals.rfidNotScanned)} not scanned`} rate={percent(totals.rfidPass, chartBase)} color={C.violet} />
        <MetricTile icon={<TaskAltOutlined />} label="Final PASS" value={totals.finalPass} note="Both weight and RFID passed" rate={percent(totals.finalPass, chartBase)} color={C.teal} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 0.9fr' }, gap: 1.5, mb: 1.5 }}>
        <DashboardPanel title="Carton Quality Breakdown" subtitle="Actual PASS / FAILED / pending distributions">
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
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
          <Stack gap={2.05} py={0.5}>
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
        <DashboardPanel title="Factory Comparison" subtitle="Weight / RFID / Final PASS by F1–F7 · select a factory">
          <ComparisonChart rows={factoryChartRows} getLabel={row => row.factoryCode}
            series={[{ key: 'weightPass', label: 'Weight PASS', color: C.cyan },
              { key: 'rfidPass', label: 'RFID PASS', color: C.blue },
              { key: 'finalPass', label: 'Final PASS', color: C.tealDark }]}
            onSelect={row => { setFactoryFilter(row.factoryCode); setExceptionFilter('ALL'); setView(1); }} emptyText="No picked PO in your assigned factories" />
        </DashboardPanel>
        <DashboardPanel title="Top Orders" subtitle="Planned cartons versus Weight / Final PASS · select an Order">
          <ComparisonChart rows={topOrders} getLabel={row => row.orderName || row.orderId}
            series={[{ key: 'plannedCartons', label: 'Planned', color: C.cyan },
              { key: 'weightPass', label: 'Weight PASS', color: C.blue },
              { key: 'finalPass', label: 'Final PASS', color: C.coral }]}
            onSelect={row => { setOrderFilter(row.orderId); setExceptionFilter('ALL'); setView(0); }} emptyText="No Orders for the selected scope" />
        </DashboardPanel>
      </Box>

      <DashboardPanel title="Operational Exceptions" subtitle="Click a tile to inspect affected POs in the detail table" sx={{ mb: 1.5 }}
        end={<WarningAmberOutlined sx={{ color: C.coral }} />}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, gap: 1.2 }}>
          <AlertItem title="Unpicked PO" value={totals.notPickedPos} detail="Pending factory pickup" color={C.gold} onClick={() => jumpTo('UNPICKED')} />
          <AlertItem title="Weight FAILED" value={totals.weightFailed} detail="Failed or on hold" color={C.coral} onClick={() => jumpTo('WEIGHT_FAILED')} />
          <AlertItem title="RFID FAILED" value={totals.rfidFailed} detail="Failed RFID verification" color="#cf5265" onClick={() => jumpTo('RFID_FAILED')} />
          <AlertItem title="RFID Not Scanned" value={totals.rfidNotScanned} detail="Includes planned lazy cartons" color={C.blue} onClick={() => jumpTo('NOT_SCANNED')} />
        </Box>
        {!!notPicked.length && (
          <Box mt={1.75}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
              <Typography sx={{ fontWeight: 900, fontSize: 13, color: C.navy }}>PO waiting for Picking</Typography>
              <Button size="small" onClick={() => jumpTo('UNPICKED')} endIcon={<ArrowForwardOutlined />}>View all</Button>
            </Stack>
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              {notPicked.map(po => <Tooltip key={`${po.orderId}|${po.poNumber}`} title={`${po.orderName || po.orderId} · ${fmt(po.plannedCartons)} planned cartons`}>
                <Chip size="small" variant="outlined" onClick={() => { setOrderFilter(po.orderId); jumpTo('UNPICKED'); }}
                  label={po.poNumber} sx={{ borderColor: '#e8c587', color: C.navy, bgcolor: '#fffbf1', fontWeight: 700 }} />
              </Tooltip>)}
            </Stack>
          </Box>
        )}
      </DashboardPanel>

      <Box ref={detailsAnchor} sx={{ scrollMarginTop: 85 }}>
      <DashboardPanel title="Detailed Operations Data" subtitle="Order / Factory / unique PO / Carton — source data and traceable statuses"
        end={exceptionFilter !== 'ALL' ? <Button size="small" variant="outlined" onClick={() => setExceptionFilter('ALL')}>Clear exception filter</Button> : null}>
        <Tabs value={view} onChange={(_, value) => setView(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 1.25 }}>
          <Tab label="By Order" /><Tab label="By Factory" /><Tab label={`PO Picking (${fmt(poRows.length)})`} /><Tab label="Carton Checks" />
        </Tabs>
        {exceptionFilter !== 'ALL' && <Alert severity="info" sx={{ mb: 1 }}>
          Showing POs matching <b>{exceptionFilter.replaceAll('_', ' ')}</b>. Select an Order or Factory to narrow the result.
        </Alert>}
        {view === 0 && <DataTable columns={orderColumns} rows={orders} />}
        {view === 1 && <DataTable columns={factoryColumns} rows={factories} />}
        {view === 2 && <DataTable columns={poColumns} rows={poRows} />}
        {view === 3 && <DataTable columns={cartonColumns} rows={cartons} emptyText="No generated carton for selected PO (lazy generation). Use the PO tab for planned quantities." />}
      </DashboardPanel>
      </Box>
      <Typography sx={{ color: C.muted, fontSize: 11, mt: 1.35 }}>
        Dashboard uses saved MongoDB statuses. A PO is unique by (Order ID, PO Number). Planned cartons can exceed generated cartons.
        Weight / RFID counts refer to cartons; Picking counts refer to POs. A carton is Final PASS only after Weight PASS and RFID PASS.
        Order and Factory filters affect all KPIs and charts; PO Picking and exception filters apply to detail rows only.
        Your Factory access is enforced by the backend. No chronological trend is displayed because the V11 API does not provide time-series data.
      </Typography>
    </Paper>
  );
}
