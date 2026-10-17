import { LinearProgress, Stack, Tooltip, Typography } from '@mui/material';

const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.max(0, Number(n) || 0));

/** Purchase Orders show completed carton identification, not individual item/RFID PASS scans.
 * Planned denominators come from ALL_BP; numerators come only from persisted carton identity. */
export default function PoScanProgressCell({ row, canonical, metrics }) {
  if (!row || row.identifiedQty === null || row.identifiedQty === undefined) return null;

  const totalQty = Number(row.totalQty ?? row.plannedTotalQty ?? 0);
  const totalFullCartons = metrics.reduce((sum, part) => sum + part.fullCartons, 0);
  const totalCartons = metrics.reduce((sum, part) => sum + part.cartonRatio, 0);
  const oddCount = metrics.filter((part) => part.remainderQty > 0).length;
  const oddQty = metrics.reduce((sum, part) => sum + part.remainderQty, 0);

  let current;
  let total;
  let subtitle;
  if (canonical === 'QTY') {
    current = row.identifiedQty;
    total = totalQty;
    subtitle = 'Identified / Planned pcs';
  } else if (canonical === 'ODD_RATIO') {
    current = row.identifiedCartons;
    total = totalCartons;
    subtitle = 'Identified / Total cartons';
  } else if (canonical === 'CTNS') {
    current = row.identifiedFullCartons;
    total = totalFullCartons;
    subtitle = 'Identified / Full cartons';
  } else if (canonical === 'REMAINDER') {
    if (!oddCount) return <Typography variant="body2">No odd carton</Typography>;
    current = row.identifiedRemainderQty;
    total = oddQty;
    subtitle = `${fmt(row.identifiedRemainderCartons)} / ${fmt(oddCount)} odd carton${oddCount > 1 ? 's' : ''} identified`;
  } else return null;

  // Keep this derived from the saved carton-identification counts, never from a UI timer.
  // Clamp over-scans visually so an unexpected identified quantity cannot overflow the bar.
  const identified = Math.max(0, Number(current) || 0);
  const planned = Math.max(0, Number(total) || 0);
  const progress = planned > 0 ? Math.min(100, (identified / planned) * 100) : 0;
  const overPlanned = planned > 0 && identified > planned;
  const complete = planned > 0 && identified === planned;
  const progressColor = overPlanned ? 'warning' : complete ? 'success' : 'primary';
  const progressText = planned > 0 ? `${Math.round((identified / planned) * 100)}%` : 'No planned quantity';

  return (
    <Stack spacing={0.1} sx={{ minWidth: canonical === 'REMAINDER' ? 128 : 102 }}>
      <Typography component="span" variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmt(current)} / {fmt(total)}{canonical === 'REMAINDER' ? ' pcs' : ''}
      </Typography>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {subtitle}
      </Typography>
      <Tooltip title={`${fmt(current)} / ${fmt(total)} · ${progressText}`} arrow placement="top">
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
