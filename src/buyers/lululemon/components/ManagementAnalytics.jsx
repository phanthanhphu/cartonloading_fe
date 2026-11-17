import { useT, useSystemMessage } from '../../../i18n/LanguageProvider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CircularProgress, FormControl, InputLabel,
  MenuItem, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { BUYER_CODE } from '../../../constants/appConstants';
import { buyerPath } from 'utils/buyerAccess';
import { getManagementDashboardSummary, getManagementDashboardOptions } from '../services/managementReports';

const PALETTE = {
  navy: '#183a53', muted: '#657e8d', line: '#dbe5eb', teal: '#138a83',
  cyan: '#59b3c8', coral: '#e56f69', silver: '#dce6eb'
};
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const number = (v) => Math.max(0, Number(v || 0));
const formatDate = (value) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
const percent = (part, total) => total > 0 ? Math.min(100, Math.round((number(part) / total) * 100)) : 0;
const dayMs = 86400000;
const asDay = (value) => Date.parse(`${value}T00:00:00Z`);
const toIso = (stamp) => new Date(stamp).toISOString().slice(0, 10);

// Vietnam-local dates remain stable even if the browser runs in a different time zone.
function localToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value: text }) => [type, text]));
  return `${value.year}-${value.month}-${value.day}`;
}
function startFilters() {
  const to = localToday();
  return { from: `${to.slice(0, 8)}01`, to, factory: '', shippingDate: '', orderId: '', status: '' };
}
const goodRange = (f) => {
  const fromMs = asDay(f.from || '');
  const toMs = asDay(f.to || '');
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toIso(fromMs) !== f.from || toIso(toMs) !== f.to || fromMs > toMs) return false;
  const anniversary = new Date(`${f.from}T00:00:00Z`);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  return toMs <= anniversary.getTime();
};

function BoxPanel({ title, headerExtra, children, sx = {} }) {
  return <Card variant="outlined" sx={{ minWidth: 0, minHeight: 0, height: '100%',
    borderColor: PALETTE.line, borderRadius: '8px', boxShadow: 'none', ...sx }}>
    <Box sx={{ p: { xs: 1.25, md: 1.15 }, height: '100%', boxSizing: 'border-box',
      minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={0.4} sx={{ flexShrink: 0 }}>
        <Typography sx={{ color: PALETTE.navy, fontSize: 13, fontWeight: 850 }}>{title}</Typography>
        {headerExtra}
      </Stack>
      {children}
    </Box>
  </Card>;
}

/** Calendar-accurate Day / ISO Week (Monday-Sunday) / Month aggregation.
 * Uses the exact daily Shipping Date totals returned by the authorized Reports API.
 * Zero-activity periods between the selected dates are retained, so growth never
 * compares nonadjacent weeks/months. All date calculations are UTC date-only.
 */
const validPeriod = (value) => ['day', 'week', 'month'].includes(value) ? value : 'day';
function bucketStart(isoDate, mode) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (mode === 'week') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (mode === 'month') date.setUTCDate(1);
  return toIso(date.getTime());
}
function nextBucket(isoDate, mode) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (mode === 'month') date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + (mode === 'week' ? 7 : 1));
  return toIso(date.getTime());
}
function isoWeek(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / dayMs + 1) / 7);
  return `W${String(week).padStart(2, '0')}/${String(date.getUTCFullYear()).slice(-2)}`;
}
function bucketLabel(bucket, mode) {
  if (mode === 'month') return `${bucket.slice(5, 7)}/${bucket.slice(0, 4)}`;
  if (mode === 'week') return isoWeek(bucket);
  return formatDate(bucket);
}
export function bucketTrend(points = [], from = '', to = '', period = 'day') {
  if (!goodRange({ from, to }) || !points.length) return [];
  const mode = validPeriod(period);
  const map = new Map();
  // Fill every calendar period in the requested range, including zero periods.
  for (let date = bucketStart(from, mode); date <= to; date = nextBucket(date, mode)) {
    const next = nextBucket(date, mode);
    const ending = toIso(asDay(next) - dayMs);
    map.set(date, {
      id: date, from: date < from ? from : date, to: ending > to ? to : ending,
      complete: date >= from && ending <= to,
      plannedCartons: 0, finalPass: 0, label: bucketLabel(date, mode)
    });
  }
  for (const point of points) {
    const day = point.shippingDate || '';
    const stamp = asDay(day);
    if (!Number.isFinite(stamp) || day < from || day > to) continue;
    const bucket = map.get(bucketStart(day, mode));
    if (!bucket) continue;
    bucket.plannedCartons += number(point.plannedCartons);
    bucket.finalPass += number(point.finalPass);
  }
  return [...map.values()];
}

/** Previous adjacent calendar period, based on Final PASS. Never divide by zero. */
export function trendGrowth(rows, period = 'day') {
  // Exclude partially selected weeks/months rather than comparing unequal durations.
  const comparable = period === 'day' ? rows : rows.filter(row => row.complete);
  if (comparable.length < 2) return null;
  const previous = number(comparable[comparable.length - 2].finalPass);
  const current = number(comparable[comparable.length - 1].finalPass);
  return previous > 0 ? (current - previous) / previous * 100 : null;
}

function TrendChart({ rows, period, onSelect }) {
  const trUi = useT();
  if (!rows.length) return <Box sx={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', color: PALETTE.muted }}>{trUi('No shipping data')}</Box>;
  const width = 900; const height = 248;
  const l = 53; const r = 8; const t = 20; const b = 48;
  const w = width - l - r; const h = height - t - b;
  const max = Math.max(1, ...rows.flatMap(row => [number(row.plannedCartons), number(row.finalPass)]));
  const band = w / rows.length;
  const bar = Math.min(20, band * 0.28);
  // A line plot is readable for long daily ranges; do not silently omit dates.
  const dense = rows.length > 38;
  const labelEvery = Math.max(1, Math.ceil(rows.length / (period === 'week' ? 11 : 13)));
  const coordinate = (row, index, key) => [l + band * (index + 0.5), t + h * (1 - number(row[key]) / max)];
  const pathFor = (key) => rows.map((row, i) => {
    const [x, y] = coordinate(row, i, key);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const growth = trendGrowth(rows, period);
  const label = period === 'month' ? 'vs previous full month' : period === 'week' ? 'vs previous full week' : 'vs previous day';
  return <>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={0.3} sx={{ flexShrink: 0 }}>
      <Stack direction="row" gap={{ xs: 1, sm: 2 }}>
        <Legend color={PALETTE.cyan} title={trUi('Planned Cartons')} />
        <Legend color={PALETTE.teal} title={trUi('Final PASS')} />
      </Stack>
      <Stack direction="row" gap={0.5} alignItems="center" flexShrink={0}>
        <Typography sx={{ color: growth == null ? PALETTE.muted : growth >= 0 ? PALETTE.teal : PALETTE.coral,
          fontWeight: 850, fontSize: 13 }}>
          {growth == null ? '—' : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`}
        </Typography>
        <Typography sx={{ color: PALETTE.muted, fontSize: 10.5 }}>{trUi(label)}</Typography>
      </Stack>
    </Stack>
    <Box sx={{ flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none"
        role="img" aria-label={trUi('Shipping Date: Planned Cartons and Final PASS')}>
        {Array.from({ length: 5 }, (_, idx) => {
          const level = max * idx / 4;
          const y = t + h * (1 - level / max);
          return <g key={idx}>
            <line x1={l} x2={width - r} y1={y} y2={y} stroke="#e6edf1" strokeDasharray={idx ? '3 4' : 'none'} />
            <text x={l - 7} y={y + 3} fill={PALETTE.muted} fontSize="11" textAnchor="end">{fmt(Math.round(level))}</text>
          </g>;
        })}
        {dense && <>
          <path d={pathFor('plannedCartons')} stroke={PALETTE.cyan} strokeWidth="2.6" fill="none" />
          <path d={pathFor('finalPass')} stroke={PALETTE.teal} strokeWidth="2.6" fill="none" />
        </>}
        {rows.map((item, index) => {
          const center = l + band * (index + 0.5);
          const planned = (number(item.plannedCartons) / max) * h;
          const passed = (number(item.finalPass) / max) * h;
          return <g key={item.id} onClick={() => onSelect(item)} tabIndex={0} role="button"
            aria-label={`${trUi('View report')} ${item.label}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item); } }}
            style={{ cursor: 'pointer', outlineOffset: 2 }}>
            <title>{`${item.label} (${item.from} → ${item.to}) · ${trUi('Planned Cartons')} ${fmt(item.plannedCartons)} · ${trUi('Final PASS')} ${fmt(item.finalPass)}`}</title>
            <rect x={l + index * band} y={t} width={band} height={h + 13} fill="transparent" />
            {!dense && <>
              <rect x={center - bar - 2} y={t + h - planned} width={bar} height={planned} rx="2" fill={PALETTE.cyan} />
              <rect x={center + 2} y={t + h - passed} width={bar} height={passed} rx="2" fill={PALETTE.teal} />
            </>}
            {(index % labelEvery === 0 || index === rows.length - 1) &&
              <text x={center} y={height - 24} textAnchor="middle" fill={PALETTE.muted} fontSize={rows.length > 14 ? 9 : 11}>
                {item.label}
              </text>}
          </g>;
        })}
      </svg>
    </Box>
  </>;
}

function Legend({ color, title }) {
  return <Stack direction="row" alignItems="center" gap={0.55}>
    <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color }} />
    <Typography sx={{ fontSize: 11, color: PALETTE.muted }}>{title}</Typography>
  </Stack>;
}

function FactoriesChart({ rows, onSelect }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  if (!rows.length) return <Box sx={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', color: PALETTE.muted }}>{trUi("No factory data")}</Box>;
  const max = Math.max(1, ...rows.map(row => number(row.plannedCartons)));
  // Use columns instead of a nested scrollbar. All permitted Factories stay visible.
  const columns = rows.length > 12 ? 3 : rows.length > 5 ? 2 : 1;
  return <Stack sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }} gap={0.5}>
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`,
      gridTemplateRows: `repeat(${Math.ceil(rows.length / columns)}, minmax(0,1fr))`,
      columnGap: 1.5, rowGap: 0.35, flex: 1, minHeight: 0 }}>
      {rows.map(row => <Box key={row.factoryCode} onClick={() => onSelect(row.factoryCode)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(row.factoryCode); }}
        sx={{ cursor: 'pointer', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', '&:hover': { bgcolor: 'action.hover' }, px: 0.25, borderRadius: 1 }}>
        <Stack direction="row" justifyContent="space-between" gap={0.5} alignItems="center">
          <Typography sx={{ color: PALETTE.navy, fontWeight: 780, fontSize: 11.5 }}>{row.factoryCode}</Typography>
          <Typography noWrap sx={{ color: PALETTE.muted, fontSize: 10.5 }}>{fmt(row.finalPass)} / {fmt(row.plannedCartons)} · {percent(row.finalPass, row.plannedCartons)}%</Typography>
        </Stack>
        <Box sx={{ bgcolor: '#eef3f5', borderRadius: '3px', height: 8, mt: 0.25,
          position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <Box sx={{ bgcolor: PALETTE.cyan, height: '100%', width: `${Math.min(100, 100 * number(row.plannedCartons) / max)}%` }} />
          <Box sx={{ bgcolor: PALETTE.teal, height: '100%', width: `${Math.min(100, 100 * number(row.finalPass) / max)}%`, position: 'absolute', top: 0 }} />
        </Box>
      </Box>)}
    </Box>
    <Stack direction="row" gap={2} sx={{ flexShrink: 0 }}>
      <Legend color={PALETTE.cyan} title={trUi("Planned CTN")} />
      <Legend color={PALETTE.teal} title={trUi("Final PASS")} />
    </Stack>
  </Stack>;
}

function QcChart({ data }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const segments = [
    { title: trUi("Final PASS"), count: number(data?.finalPass), color: PALETTE.teal },
    { title: trUi("Final FAILED"), count: number(data?.finalFailed), color: PALETTE.coral },
    { title: trUi("Pending"), count: number(data?.pending), color: PALETTE.silver }
  ];
  const total = segments.reduce((acc, seg) => acc + seg.count, 0);
  let angle = 0;
  const stops = segments.map(seg => {
    const next = angle + (total ? seg.count / total * 100 : 0);
    const stop = `${seg.color} ${angle.toFixed(4)}% ${next.toFixed(4)}%`;
    angle = next;
    return stop;
  });
  return <Stack direction={{ xs: 'row', sm: 'column', md: 'row' }} gap={1.5} alignItems="center" justifyContent="center" sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
    <Box role="img" aria-label={segments.map(s => `${s.title}: ${fmt(s.count)}`).join(', ')}
      sx={{ width: { xs: 128, md: 'clamp(96px, 11vh, 148px)' }, height: { xs: 128, md: 'clamp(96px, 11vh, 148px)' }, flexShrink: 0, borderRadius: '50%',
        background: total ? `conic-gradient(${stops.join(', ')})` : '#e9eff2', display: 'grid', placeItems: 'center' }}>
      <Box sx={{ width: '74%', height: '74%', borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Box><Typography sx={{ fontSize: 24, color: PALETTE.navy, fontWeight: 900, lineHeight: 1.2 }}>{percent(data?.finalPass, total)}%</Typography>
          <Typography sx={{ fontSize: 10.5, color: PALETTE.muted }}>{trUi("Final PASS")}</Typography></Box>
      </Box>
    </Box>
    <Stack spacing={0.65} sx={{ minWidth: 0 }}>
      {segments.map(seg => <Stack key={seg.title} direction="row" alignItems="center" gap={0.6}>
        <Box sx={{ bgcolor: seg.color, width: 10, height: 10, borderRadius: '2px', flexShrink: 0 }} />
        <Typography sx={{ color: PALETTE.muted, fontSize: 11.5, minWidth: 85 }}>{trUi(seg.title)}</Typography>
        <Typography sx={{ color: PALETTE.navy, fontSize: 12, fontWeight: 800 }}>{fmt(seg.count)}</Typography>
      </Stack>)}
    </Stack>
  </Stack>;
}

/** LULULEMON management Dashboard: six Report filters and exactly three charts.
 * All authorization and aggregation are checked by ManagementReportService.
 */
export default function ManagementAnalytics() {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(startFilters);
  const [applied, setApplied] = useState(startFilters);
  const [trendPeriod, setTrendPeriod] = useState('day');
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ factories: [], shippingDates: [], orders: [] });
  const [busy, setBusy] = useState(false);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = goodRange(draft);

  const update = (key, value) => setDraft((previous) => ({
    ...previous, [key]: value,
    // These options are dependent on the selected date interval and Factory.
    ...(['from', 'to', 'factory'].includes(key) ? { shippingDate: '', orderId: '' } : {}),
    ...(key === 'orderId' ? { shippingDate: '' } : {})
  }));

  const reload = useCallback(async (filters) => {
    setBusy(true);
    setError('');
    try {
      const result = await getManagementDashboardSummary(filters);
      setSummary(result);
    } catch (err) {
      setSummary(null);
      setError(err?.response?.data?.message || err?.message || 'Unable to load charts.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { reload(applied); }, [applied, reload]);

  // Lightweight PO/date metadata, not carton details, is used for dropdown options.
  // Requests cannot bypass Option 1 / 2 or read a Factory outside their grant.
  useEffect(() => {
    if (!goodRange(draft)) {
      setOptions({ factories: [], shippingDates: [], orders: [] });
      setOptionsBusy(false);
      return undefined;
    }
    let alive = true;
    setOptionsBusy(true);
    const timer = setTimeout(() => {
      getManagementDashboardOptions({ from: draft.from, to: draft.to, factory: draft.factory, orderId: draft.orderId })
        .then((result) => {
          if (alive) setOptions({
            factories: result?.factories || [],
            shippingDates: result?.shippingDates || [],
            orders: result?.orders || []
          });
        })
        .catch((err) => {
          if (!alive) return;
          setOptions({ factories: [], shippingDates: [], orders: [] });
          setError(err?.response?.data?.message || err?.message || 'Unable to load filter options.');
        })
        .finally(() => { if (alive) setOptionsBusy(false); });
    }, 200);
    return () => { alive = false; clearTimeout(timer); };
  }, [draft.from, draft.to, draft.factory, draft.orderId]);

  const goToReport = (extra = {}) => {
    const merged = { ...applied, ...extra };
    const query = new URLSearchParams();
    Object.entries(merged).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, value);
    });
    navigate(`${buyerPath(BUYER_CODE.LULULEMON, 'management-reports')}?${query.toString()}`);
  };

  const buckets = useMemo(() => bucketTrend(summary?.shippingTrend || [],
    applied.shippingDate || applied.from, applied.shippingDate || applied.to, trendPeriod),
    [summary, applied.from, applied.to, applied.shippingDate, trendPeriod]);
  const factories = useMemo(() => [...(summary?.factoryPerformance || [])]
    .sort((a, b) => number(b.plannedCartons) - number(a.plannedCartons)), [summary]);

  const select = (name, field, choices, allLabel) => <FormControl fullWidth size="small" sx={{ minWidth: 0 }}>
    <InputLabel>{trUi(name)}</InputLabel>
    <Select label={trUi(name)} value={draft[field]} onChange={(event) => update(field, event.target.value)}
      disabled={optionsBusy && field === 'shippingDate'}>
      <MenuItem value="">{trUi(allLabel)}</MenuItem>
      {choices.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </Select>
  </FormControl>;

  return <Box sx={{ bgcolor: '#f7fafc', border: `1px solid ${PALETTE.line}`, borderRadius: '8px',
    p: { xs: 1.25, md: 1 }, boxSizing: 'border-box', minWidth: 0,
    height: { xs: 'auto', md: '100%' }, minHeight: 0,
    display: 'flex', flexDirection: 'column', gap: { xs: 1.25, md: 0.8 },
    overflow: { xs: 'visible', md: 'hidden' } }}>
    <Box component="form" onSubmit={(event) => { event.preventDefault(); if (valid) setApplied({ ...draft }); }}
      sx={{ border: `1px solid ${PALETTE.line}`, borderRadius: '8px', p: { xs: 1, md: 0.85 },
        bgcolor: 'background.paper', flexShrink: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={2.25}>
        <Typography sx={{ fontSize: { xs: 17, md: 18 }, fontWeight: 900, color: PALETTE.navy }}>{trUi("\n          Shipping Analytics\n        ")}</Typography>
        <Stack direction="row" gap={0.65} alignItems="center">
          {optionsBusy && <CircularProgress size={13} />}
          <Button type="button" size="small" color="inherit" disabled={busy}
            sx={{ minWidth: 54, px: 1 }}
            onClick={() => { const defaults = startFilters(); setDraft(defaults); setApplied(defaults); }}>{trUi("\n            Reset\n          ")}</Button>
          <Button type="submit" size="small" variant="contained" disabled={!valid || busy}
            sx={{ minWidth: 95, px: 1 }}>{trUi("\n            Apply\n          ")}</Button>
        </Stack>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: {
        xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))',
        md: 'repeat(3,minmax(0,1fr))', lg: 'repeat(6,minmax(0,1fr))'
      }, columnGap: 0.9, rowGap: 2.5, alignItems: 'start',
        '& .MuiOutlinedInput-root': { minHeight: 38 } }}>
        <TextField fullWidth size="small" type="date" label={trUi("Date From")} value={draft.from}
          InputLabelProps={{ shrink: true }} onChange={(event) => update('from', event.target.value)} />
        <TextField fullWidth size="small" type="date" label={trUi("Date To")} value={draft.to}
          InputLabelProps={{ shrink: true }} onChange={(event) => update('to', event.target.value)} />
        {select('Factory', 'factory', (options.factories || []).map(value => ({ value, label: value })), trUi("All Factories"))}
        {select('Order', 'orderId', (options.orders || []).map(item =>
          ({ value: item.orderId, label: item.orderName || item.orderId })), trUi("All Orders"))}
        {select('Shipping', 'shippingDate', (options.shippingDates || []).map(value =>
          ({ value, label: `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}` })), trUi("All Shipping Dates"))}
        {select('Status', 'status', [
          { value: 'COMPLETED', label: trUi("COMPLETED") },
          { value: 'IN_PROGRESS', label: trUi("IN_PROGRESS") },
          { value: 'ISSUES', label: trUi("ISSUES") }
        ], trUi("All Status"))}
      </Box>
    </Box>
    {!valid && <Alert severity="warning" sx={{ flexShrink: 0, py: 0 }}>{trUi("Invalid date range.")}</Alert>}
    {error && <Alert severity="error" sx={{ flexShrink: 0, py: 0 }}>{trSystem(error)}</Alert>}
    {busy && <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
      <CircularProgress size={13} /><Typography variant="caption">{trUi("Loading charts...")}</Typography>
    </Stack>}
    <Box sx={{ display: 'grid', flex: 1, minHeight: { xs: 'auto', md: 0 },
      gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
      gridTemplateRows: { xs: '220px 215px 215px', md: 'minmax(0,1.07fr) minmax(0,1fr)' },
      gap: 0.8, overflow: 'hidden' }}>
      <Box sx={{ gridColumn: { xs: 'auto', md: '1 / -1' }, minWidth: 0, minHeight: 0 }}>
        <BoxPanel title={trUi('Shipping & Carton Trend')} headerExtra={
          <ToggleButtonGroup size="small" exclusive value={trendPeriod}
            onChange={(_, value) => { if (value) setTrendPeriod(value); }}
            aria-label={trUi('Trend period')}
            sx={{ height: 26, '& .MuiToggleButton-root': { px: { xs: 0.65, sm: 1.2 },
              py: 0, fontSize: 10.5, lineHeight: 1.2, textTransform: 'none', fontWeight: 750 } }}>
            <ToggleButton value="day" aria-label={trUi('Day')}>{trUi('Day')}</ToggleButton>
            <ToggleButton value="week" aria-label={trUi('Week')}>{trUi('Week')}</ToggleButton>
            <ToggleButton value="month" aria-label={trUi('Month')}>{trUi('Month')}</ToggleButton>
          </ToggleButtonGroup>
        }>
          <TrendChart rows={buckets} period={trendPeriod} onSelect={(item) => goToReport({
            from: item.from, to: item.to, shippingDate: item.from === item.to ? item.from : ''
          })}/>
        </BoxPanel>
      </Box>
      <Box sx={{ minWidth: 0, minHeight: 0 }}>
        <BoxPanel title={trUi("Factory Performance")}>
          <FactoriesChart rows={factories} onSelect={(factory) => goToReport({ factory })}/>
        </BoxPanel>
      </Box>
      <Box sx={{ minWidth: 0, minHeight: 0 }}>
        <BoxPanel title={trUi("Carton QC Status")}><QcChart data={summary?.qcStatus}/></BoxPanel>
      </Box>
    </Box>
  </Box>;
}
