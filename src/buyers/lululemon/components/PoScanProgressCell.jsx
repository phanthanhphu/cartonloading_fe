import { Stack, Typography } from '@mui/material';

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

  return (
    <Stack spacing={0.1} sx={{ minWidth: canonical === 'REMAINDER' ? 128 : 102 }}>
      <Typography component="span" variant="body2" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {fmt(current)} / {fmt(total)}{canonical === 'REMAINDER' ? ' pcs' : ''}
      </Typography>
      <Typography component="span" variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {subtitle}
      </Typography>
    </Stack>
  );
}
