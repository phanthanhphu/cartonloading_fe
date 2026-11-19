import { useT, useSystemMessage } from '../../../i18n/LanguageProvider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CircularProgress, FormControl, InputLabel, Tooltip,
  MenuItem, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { InfoOutlined } from '@mui/icons-material';
import { BUYER_CODE } from '../../../constants/appConstants';
import { buyerPath } from 'utils/buyerAccess';
import { getManagementDashboardSummary, getManagementDashboardOptions } from '../services/managementReports';
import { getDefaultManagementReportFilters } from '../services/managementReportDefaults';

const PALETTE = {
  navy: '#183a53', muted: '#657e8d', axis: '#355166', line: '#dbe5eb', teal: '#138a83',
  cyan: '#59b3c8', coral: '#e56f69', silver: '#dce6eb'
};
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const number = (v) => Math.max(0, Number(v || 0));
const formatDate = (value) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
const percent = (part, total) => total > 0 ? Math.min(100, Math.round((number(part) / total) * 100)) : 0;
// Keep nonzero progress visible when a small number of cartons have passed QC.
const percentLabel = (part, total) => {
  if (total <= 0) return '0%';
  const value = Math.min(100, (number(part) / total) * 100);
  return `${value > 0 && value < 1 ? value.toFixed(2) : Number(value.toFixed(1))}%`;
};
const dayMs = 86400000;
const asDay = (value) => Date.parse(`${value}T00:00:00Z`);
const toIso = (stamp) => new Date(stamp).toISOString().slice(0, 10);

const startFilters = getDefaultManagementReportFilters;
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
    <Box sx={{ p: { xs: 1.1, md: 1 }, height: '100%', boxSizing: 'border-box',
      minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={0.3} sx={{ flexShrink: 0 }}>
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
      plannedCartons: 0, finalPass: 0, rfidPass: 0, rfidFailed: 0,
      weightPass: 0, weightFailed: 0, finalFailed: 0,
      rfidChecked: 0, weightChecked: 0, finalChecked: 0,
      label: bucketLabel(date, mode)
    });
  }
  for (const point of points) {
    const day = point.shippingDate || point.date || '';
    const stamp = asDay(day);
    if (!Number.isFinite(stamp) || day < from || day > to) continue;
    const bucket = map.get(bucketStart(day, mode));
    if (!bucket) continue;
    bucket.plannedCartons += number(point.plannedCartons);
    bucket.finalPass += number(point.finalPass);
    bucket.finalFailed += number(point.finalFailed);
    bucket.rfidPass += number(point.rfidPass);
    bucket.rfidFailed += number(point.rfidFailed);
    bucket.weightPass += number(point.weightPass);
    bucket.weightFailed += number(point.weightFailed);
    bucket.rfidChecked += number(point.rfidPass) + number(point.rfidFailed);
    bucket.weightChecked += number(point.weightPass) + number(point.weightFailed);
    bucket.finalChecked += number(point.finalPass) + number(point.finalFailed);
  }
  return [...map.values()];
}

/** Previous adjacent calendar period, based on Final PASS. Never divide by zero. */
export function trendGrowth(rows, period = 'day', metric = 'finalPass') {
  // Exclude partially selected weeks/months rather than comparing unequal durations.
  const comparable = period === 'day' ? rows : rows.filter(row => row.complete);
  if (comparable.length < 2) return null;
  const previous = number(comparable[comparable.length - 2][metric]);
  const current = number(comparable[comparable.length - 1][metric]);
  return previous > 0 ? (current - previous) / previous * 100 : null;
}

function TrendChart({ rows, period, onSelect, mode = 'shipping' }) {
  const trUi = useT();
  // Match the SVG coordinate system to its actual rendered size. A fixed 900x248
  // viewBox combined with preserveAspectRatio=none stretches/squashes SVG text
  // on wide, compact dashboards (faint and distorted axis labels).
  const chartRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 900, height: 130 });
  useEffect(() => {
    const node = chartRef.current;
    if (!node) return undefined;
    const update = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width > 0 && height > 0) {
        setChartSize(prev => prev.width === width && prev.height === height ? prev : { width, height });
      }
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(node);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [rows.length]);
  if (!rows.length) return <Box sx={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', color: PALETTE.muted }}>{trUi('No shipping data')}</Box>;
  const { width, height } = chartSize;
  const l = 56; const r = 16; const t = 12; const b = 34;
  const w = Math.max(1, width - l - r); const h = Math.max(1, height - t - b);
  const production = mode === 'production';
  const series = production ? [
    { key: 'rfidChecked', label: 'RFID Checked', color: '#4078d4' },
    { key: 'weightChecked', label: 'Weight Checked', color: PALETTE.cyan },
    { key: 'finalChecked', label: 'Final Checked', color: PALETTE.teal }
  ] : [
    { key: 'plannedCartons', label: 'Planned Cartons', color: PALETTE.cyan },
    { key: 'finalPass', label: 'Final PASS', color: PALETTE.teal }
  ];
  const max = Math.max(1, ...rows.flatMap(row => series.map(item => number(row[item.key]))));
  const band = w / rows.length;
  const bar = Math.min(20, band * (production ? 0.22 : 0.28));
  // A line plot is readable for long daily ranges; do not silently omit dates.
  const dense = rows.length > 38;
  const maxLabels = Math.max(2, Math.min(14, Math.floor(w / (period === 'week' ? 84 : 66))));
  const labelEvery = Math.max(1, Math.ceil(rows.length / maxLabels));
  const coordinate = (row, index, key) => [l + band * (index + 0.5), t + h * (1 - number(row[key]) / max)];
  const pathFor = (key) => rows.map((row, i) => {
    const [x, y] = coordinate(row, i, key);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const growth = trendGrowth(rows, period, production ? 'finalChecked' : 'finalPass');
  const label = period === 'month' ? 'vs previous full month' : period === 'week' ? 'vs previous full week' : 'vs previous day';
  return <>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={0.3} sx={{ flexShrink: 0 }}>
      <Stack direction="row" gap={{ xs: 0.7, sm: 2 }} flexWrap="wrap">
        {series.map(item => <Legend key={item.key} color={item.color} title={trUi(item.label)} />)}
      </Stack>
      <Stack direction="row" gap={0.5} alignItems="center" flexShrink={0}>
        <Typography sx={{ color: growth == null ? PALETTE.muted : growth >= 0 ? PALETTE.teal : PALETTE.coral,
          fontWeight: 850, fontSize: 13 }}>
          {growth == null ? '—' : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`}
        </Typography>
        <Typography sx={{ color: PALETTE.muted, fontSize: 10.5 }}>{trUi(label)}</Typography>
      </Stack>
    </Stack>
    <Box ref={chartRef} sx={{ flex: 1, minHeight: 0, width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
        role="img" aria-label={trUi(production ? 'Production inspection trend' : 'Shipping Date: Planned Cartons and Final PASS')}>
        {Array.from({ length: 5 }, (_, idx) => {
          const level = max * idx / 4;
          const y = t + h * (1 - level / max);
          return <g key={idx}>
            <line x1={l} x2={width - r} y1={y} y2={y} stroke="#e6edf1" strokeDasharray={idx ? '3 4' : 'none'} />
            <text x={l - 10} y={y + 4} fill={PALETTE.axis} fontSize="12" fontWeight="650" textAnchor="end">{fmt(Math.round(level))}</text>
          </g>;
        })}
        {dense && series.map(item =>
          <path key={item.key} d={pathFor(item.key)} stroke={item.color} strokeWidth="2.6" fill="none" />
        )}
        {rows.map((item, index) => {
          const center = l + band * (index + 0.5);
          return <g key={item.id} onClick={onSelect ? () => onSelect(item) : undefined}
            tabIndex={onSelect ? 0 : undefined} role={onSelect ? 'button' : undefined}
            aria-label={onSelect ? `${trUi('View report')} ${item.label}` : `${item.label} inspection results`}
            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item); } } : undefined}
            style={{ cursor: onSelect ? 'pointer' : 'default', outlineOffset: 2 }}>
            <title>{`${item.label} (${item.from} → ${item.to}) · ${series.map(metric => `${trUi(metric.label)} ${fmt(item[metric.key])}`).join(' · ')}`}</title>
            <rect x={l + index * band} y={t} width={band} height={h + 13} fill="transparent" />
            {!dense && series.map((metric, seriesIndex) => {
              const count = (number(item[metric.key]) / max) * h;
              const offset = (seriesIndex - (series.length - 1) / 2) * (bar + 3);
              return <rect key={metric.key} x={center + offset - bar / 2} y={t + h - count}
                width={bar} height={count} rx="2" fill={metric.color} />;
            })}
            {(index % labelEvery === 0 || index === rows.length - 1) &&
              <text x={center} y={height - 12} textAnchor="middle" fill={PALETTE.axis} fontSize="11.5" fontWeight="650">
                {item.label}
              </text>}
          </g>;
        })}
      </svg>
    </Box>
  </>;
}

/** Always-visible summary for older cartons without inspection timestamps.
 * The per-stage bar compares inspected quantities only; do not scale it to planned
 * cartons or pretend the checks occurred on an invented date.
 */
function ProductionProgressChart({ overview }) {
  const trUi = useT();
  const planned = number(overview?.plannedCartons);
  const stages = [
    { title: 'RFID Checked', pass: number(overview?.rfidPass), fail: number(overview?.rfidFailed) },
    { title: 'Weight Checked', pass: number(overview?.weightPass), fail: number(overview?.weightFailed) },
    { title: 'Final Checked', pass: number(overview?.finalPass), fail: number(overview?.finalFailed) }
  ];
  const maxChecked = Math.max(1, ...stages.map(row => row.pass + row.fail));
  return <Stack gap={1.5} sx={{ flex: 1, justifyContent: 'center', minHeight: 0, px: { xs: 0.25, sm: 1.5 }, pb: 0.25 }}>
    <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
      <Typography sx={{ color: PALETTE.muted, fontSize: 11.5 }}>{trUi('Current QC status — no dated inspections in the selected range')}</Typography>
      <Typography sx={{ color: PALETTE.navy, fontSize: 11.5, fontWeight: 800 }}>{trUi('Planned Cartons')}: {fmt(planned)}</Typography>
    </Stack>
    {stages.map(stage => <Stack key={stage.title} direction="row" gap={1} alignItems="center" sx={{ minWidth: 0 }}>
      <Typography sx={{ minWidth: { xs: 75, sm: 116 }, color: PALETTE.navy, fontSize: 12, fontWeight: 750 }}>{trUi(stage.title)}</Typography>
      <Tooltip title={`${trUi('PASS')} ${fmt(stage.pass)} / ${trUi('FAILED')} ${fmt(stage.fail)}`}>
        <Box sx={{ height: 13, flex: 1, bgcolor: '#edf2f5', borderRadius: 1, overflow: 'hidden', display: 'flex' }}>
          <Box sx={{ bgcolor: PALETTE.teal, width: `${100 * stage.pass / maxChecked}%` }} />
          <Box sx={{ bgcolor: PALETTE.coral, width: `${100 * stage.fail / maxChecked}%` }} />
        </Box>
      </Tooltip>
      <Typography sx={{ minWidth: 125, textAlign: 'right', fontSize: 11, color: PALETTE.navy, whiteSpace: 'nowrap' }}>
        <Box component="span" sx={{ color: PALETTE.teal, fontWeight: 850 }}>{fmt(stage.pass)}</Box>
        {' / '}
        <Box component="span" sx={{ color: PALETTE.coral, fontWeight: 850 }}>{fmt(stage.fail)}</Box>
        <Box component="span" sx={{ color: PALETTE.muted }}> · {percentLabel(stage.pass, planned)}</Box>
      </Typography>
    </Stack>)}
  </Stack>;
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
          <Typography noWrap sx={{ color: PALETTE.muted, fontSize: 10.5 }}>{fmt(row.finalPass)} / {fmt(row.plannedCartons)} · {percentLabel(row.finalPass, row.plannedCartons)}</Typography>
        </Stack>
        <Tooltip title={`${trUi('Final PASS')}: ${fmt(row.finalPass)} · ${trUi('Final FAILED')}: ${fmt(row.finalFailed)} · ${trUi('Planned Cartons')}: ${fmt(row.plannedCartons)}`}>
          <Box sx={{ bgcolor: '#eaf0f4', borderRadius: '4px', height: rows.length <= 2 ? 13 : 9, mt: 0.65,
            overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
            <Box sx={{ bgcolor: PALETTE.teal, height: '100%',
              width: `${number(row.plannedCartons) ? Math.min(100, 100 * number(row.finalPass) / number(row.plannedCartons)) : 0}%` }} />
            <Box sx={{ bgcolor: PALETTE.coral, height: '100%',
              width: `${number(row.plannedCartons) ? Math.min(100, 100 * number(row.finalFailed) / number(row.plannedCartons)) : 0}%` }} />
          </Box>
        </Tooltip>
        {rows.length <= 2 && <Stack direction="row" gap={1.4} flexWrap="wrap" mt={0.65}>
          <Typography sx={{ fontSize: 10.5, color: PALETTE.muted }}>{trUi('Planned Cartons')}: <b>{fmt(row.plannedCartons)}</b></Typography>
          <Typography sx={{ fontSize: 10.5, color: PALETTE.teal }}>{trUi('Final PASS')}: <b>{fmt(row.finalPass)}</b></Typography>
          <Typography sx={{ fontSize: 10.5, color: PALETTE.coral }}>{trUi('Final FAILED')}: <b>{fmt(row.finalFailed)}</b></Typography>
        </Stack>}
      </Box>)}
    </Box>
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
      sx={{ width: { xs: 108, md: 112 }, height: { xs: 108, md: 112 }, flexShrink: 0, borderRadius: '50%',
        background: total ? `conic-gradient(${stops.join(', ')})` : '#e9eff2', display: 'grid', placeItems: 'center' }}>
      <Box sx={{ width: '74%', height: '74%', borderRadius: '50%', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <Box><Typography sx={{ fontSize: 20, color: PALETTE.navy, fontWeight: 900, lineHeight: 1.2 }}>{percentLabel(data?.finalPass, total)}</Typography>
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
  const [trendPeriod, setTrendPeriod] = useState('week');
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ factories: [], shippingDates: [], orders: [] });
  const [busy, setBusy] = useState(false);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = goodRange(draft);

  const update = (key, value) => setDraft((previous) => ({
    ...previous, [key]: value,
    // These options are dependent on the selected date interval and Factory.
    ...(['from', 'to', 'factory', 'dateBasis'].includes(key) ? { shippingDate: '', orderId: '' } : {}),
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
      getManagementDashboardOptions({ from: draft.from, to: draft.to, factory: draft.factory, dateBasis: draft.dateBasis })
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
  }, [draft.from, draft.to, draft.factory, draft.dateBasis]);

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
  const productionBuckets = useMemo(() => bucketTrend(summary?.productionTrend || [],
    applied.from, applied.to, trendPeriod),
    [summary, applied.from, applied.to, trendPeriod]);
  const hasProductionTrend = (summary?.productionTrend?.length || 0) > 0;
  const hasShippingTrend = (summary?.shippingTrend?.length || 0) > 0;
  const [chartMode, setChartMode] = useState('production');
  const activeChartMode = chartMode === 'shipping' && hasShippingTrend ? 'shipping' : 'production';
  const showDatedTrend = activeChartMode === 'shipping' ? hasShippingTrend : hasProductionTrend;
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
    p: { xs: 0.75, md: 0.85 }, boxSizing: 'border-box', minWidth: 0,
    height: 'auto', minHeight: 0,
    display: 'flex', flexDirection: 'column', gap: 0.65,
    overflow: 'visible' }}>
    <Box component="form" onSubmit={(event) => { event.preventDefault(); if (valid) setApplied({ ...draft }); }}
      sx={{ border: `1px solid ${PALETTE.line}`, borderRadius: '8px', p: { xs: 0.75, md: 0.8 },
        bgcolor: 'background.paper', flexShrink: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} mb={1}>
        <Stack direction="row" alignItems="center" gap={0.6}>
          <Typography sx={{ fontSize: { xs: 15, md: 16 }, fontWeight: 900, color: PALETTE.navy }}>{trUi('Order & Shipping Analytics')}</Typography>
          <Tooltip arrow title={trUi(applied.dateBasis === 'ALL'
            ? 'All imported POs are counted. The date window controls the Shipping Trend chart only.'
            : applied.dateBasis === 'IMPORTED'
              ? 'Order and QC metrics are filtered by import date. Shipping Trend uses this window.'
              : 'Metrics are filtered by Shipping Date.')}>
            <InfoOutlined sx={{ fontSize: 15, color: PALETTE.muted, cursor: 'help' }} />
          </Tooltip>
        </Stack>
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
        md: 'repeat(4,minmax(0,1fr))', lg: 'repeat(7,minmax(0,1fr))'
      }, columnGap: 0.65, rowGap: 1.5, alignItems: 'start',
        '& .MuiOutlinedInput-root': { minHeight: 34, fontSize: 12 },
        '& .MuiInputLabel-root': { fontSize: 12 } }}>
        <FormControl size="small" fullWidth>
          <InputLabel>{trUi('Date Basis')}</InputLabel>
          <Select label={trUi('Date Basis')} value={draft.dateBasis || 'ALL'} onChange={(event) => update('dateBasis', event.target.value)}>
            <MenuItem value="ALL">{trUi('All Import Dates')}</MenuItem>
            <MenuItem value="IMPORTED">{trUi('Imported Date')}</MenuItem>
            <MenuItem value="SHIPPING">{trUi('Shipping Date')}</MenuItem>
          </Select>
        </FormControl>
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
    {!busy && summary && (summary?.overview?.pos || 0) === 0 &&
      <Alert severity="info" sx={{ flexShrink: 0, py: 0 }}>
        {trUi('No imported POs match these filters. Check Factory report permissions and imported Orders.')}
      </Alert>}
    {busy && <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
      <CircularProgress size={13} /><Typography variant="caption">{trUi("Loading charts...")}</Typography>
    </Stack>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', sm: 'repeat(3,minmax(0,1fr))', md: 'repeat(5,minmax(0,1fr))', xl: 'repeat(9,minmax(0,1fr))' },
      gap: 0.55, flexShrink: 0 }}>
      {[
        ['Orders', summary?.overview?.orders], ['Total POs', summary?.overview?.pos],
        ['Planned Cartons', summary?.overview?.plannedCartons], ['Scheduled POs', summary?.overview?.scheduledPos],
        ['Unscheduled POs', summary?.overview?.unscheduledPos], ['RFID PASS / FAILED', `${fmt(summary?.overview?.rfidPass)} / ${fmt(summary?.overview?.rfidFailed)}`],
        ['Weight PASS / FAILED', `${fmt(summary?.overview?.weightPass)} / ${fmt(summary?.overview?.weightFailed)}`],
        ['Final PASS / FAILED', `${fmt(summary?.overview?.finalPass)} / ${fmt(summary?.overview?.finalFailed)}`],
        ['Pending Cartons', summary?.overview?.pending]
      ].map(([label, value]) => <Box key={label} sx={{ bgcolor: 'white', border: `1px solid ${PALETTE.line}`, px: 0.9, py: 0.55,
        borderRadius: 1, minWidth: 0 }}>
        <Typography title={trUi(label)} noWrap sx={{ fontSize: 10.3, color: PALETTE.muted, fontWeight: 700 }}>{trUi(label)}</Typography>
        <Typography sx={{ fontSize: { xs: 17, md: 19 }, color: PALETTE.navy, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1.35 }}>
          {typeof value === 'string' ? value : fmt(value)}</Typography>
      </Box>)}
    </Box>
    <Box sx={{ display: 'grid', flexShrink: 0, minHeight: 0,
      gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
      gridTemplateRows: { xs: '188px 150px 150px', md: '192px 160px' },
      gap: 0.7, overflow: 'visible' }}>
      <Box sx={{ gridColumn: { xs: 'auto', md: '1 / -1' }, minWidth: 0, minHeight: 0 }}>
        <BoxPanel title={trUi('Production & Shipping Charts')} headerExtra={
          <Stack direction="row" gap={0.6} alignItems="center" sx={{ minWidth: 0 }}>
            <ToggleButtonGroup size="small" exclusive value={activeChartMode}
              onChange={(_, value) => { if (value) setChartMode(value); }}
              aria-label={trUi('Chart data source')}
              sx={{ height: 26, '& .MuiToggleButton-root': { px: { xs: 0.6, sm: 1.1 },
                py: 0, fontSize: 10.5, textTransform: 'none', fontWeight: 750 } }}>
              <ToggleButton value="production">{trUi('Production')}</ToggleButton>
              <ToggleButton value="shipping" disabled={!hasShippingTrend}>{trUi('Shipping')}</ToggleButton>
            </ToggleButtonGroup>
            {showDatedTrend && <ToggleButtonGroup size="small" exclusive value={trendPeriod}
              onChange={(_, value) => { if (value) setTrendPeriod(value); }}
              aria-label={trUi('Trend period')}
              sx={{ height: 26, '& .MuiToggleButton-root': { px: { xs: 0.5, sm: 0.95 },
                py: 0, fontSize: 10.5, lineHeight: 1.2, textTransform: 'none', fontWeight: 750 } }}>
              <ToggleButton value="day" aria-label={trUi('Day')}>{trUi('Day')}</ToggleButton>
              <ToggleButton value="week" aria-label={trUi('Week')}>{trUi('Week')}</ToggleButton>
              <ToggleButton value="month" aria-label={trUi('Month')}>{trUi('Month')}</ToggleButton>
            </ToggleButtonGroup>}
          </Stack>
        }>
          {activeChartMode === 'shipping' && hasShippingTrend
            ? <TrendChart rows={buckets} period={trendPeriod} mode="shipping" onSelect={(item) => goToReport({
                dateBasis: 'SHIPPING', from: item.from, to: item.to, shippingDate: item.from === item.to ? item.from : ''
              })} />
            : hasProductionTrend
              ? <TrendChart rows={productionBuckets} period={trendPeriod} mode="production" />
              : <ProductionProgressChart overview={summary?.overview} />}
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
