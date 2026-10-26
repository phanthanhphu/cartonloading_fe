import { LinearProgress, Stack, Tooltip, Typography } from '@mui/material';

const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.max(0, Number(n) || 0));

/** Four PO bars count only cartons with BOTH current RFID PASS and Weight PASS.
 * Planned denominators come from ALL_BP; numerators come from persisted carton inspections. */
export default function PoScanProgressCell({ row, canonical, metrics }) {
  // Never substitute uninspected ALL_BP planned numbers for progress when running
  // against an older backend. A missing field means data is unavailable, not zero.
  if (!row || row.completedQty === null || row.completedQty === undefined) {
    return <Tooltip title="Completion data unavailable. Deploy the matching LULULEMON backend and refresh."><Typography variant="caption" color="text.secondary">— / —</Typography></Tooltip>;
  }

  const totalQty = Number(row.totalQty ?? row.plannedTotalQty ?? 0);
  const totalFullCartons = metrics.reduce((sum, part) => sum + part.fullCartons, 0);
  const totalCartons = metrics.reduce((sum, part) => sum + part.cartonRatio, 0);
  const oddCount = metrics.filter((part) => part.remainderQty > 0).length;
  const oddQty = metrics.reduce((sum, part) => sum + part.remainderQty, 0);

  let current;
  let total;
  let subtitle;
  if (canonical === 'QTY') {
    current = row.completedQty;
    total = totalQty;
    subtitle = 'Completed / Planned pcs';
  } else if (canonical === 'ODD_RATIO') {
    current = row.completedCartons;
    total = totalCartons;
    subtitle = 'Completed / Total cartons';
  } else if (canonical === 'CTNS') {
    current = row.completedFullCartons;
    total = totalFullCartons;
    subtitle = 'Completed / Full cartons';
  } else if (canonical === 'REMAINDER') {
    if (!oddCount) return <Typography variant="body2">No odd carton</Typography>;
    current = row.completedRemainderQty;
    total = oddQty;
    subtitle = `${fmt(row.completedRemainderCartons)} / ${fmt(oddCount)} odd carton${oddCount > 1 ? 's' : ''} completed`;
  } else return null;

  // A recalled/FAILED inspection removes its carton immediately on the next refresh.
  // Clamp unexpected over-planned data visually, never change the persisted numbers.
  const completed = Math.max(0, Number(current) || 0);
  const planned = Math.max(0, Number(total) || 0);
  const progress = planned > 0 ? Math.min(100, (completed / planned) * 100) : 0;
  const overPlanned = planned > 0 && completed > planned;
  const complete = planned > 0 && completed === planned;
  const progressColor = overPlanned ? 'warning' : complete ? 'success' : 'primary';
  const progressText = planned > 0 ? `${Math.round((completed / planned) * 100)}%` : 'No planned quantity';

  return (
    <Stack spacing={0.1} sx={{ minWidth: canonical === 'REMAINDER' ? 128 : 102 }}>
      <Typography component="span" variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmt(current)} / {fmt(total)}{canonical === 'REMAINDER' ? ' pcs' : ''}
      </Typography>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {subtitle}
      </Typography>
      <Tooltip title={`${fmt(current)} / ${fmt(total)} · ${progressText} · RFID PASS + Weight PASS required`} arrow placement="top">
        <LinearProgress
          variant="determinate"
          value={progress}
          color={progressColor}
          aria-label={`${subtitle}: ${progressText}`}
          sx={{
            height: 5,
            width: '100%',
            maxWidth: 160,
            borderRadius: 99,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { borderRadius: 99, transition: 'transform 300ms ease' }
          }}
        />
      </Tooltip>
    </Stack>
  );
}
