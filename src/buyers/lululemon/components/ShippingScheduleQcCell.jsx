import { useT } from '../../../i18n/LanguageProvider';
import { Box, Button, Stack, Typography } from '@mui/material';

const count = (v) => Number(v || 0).toLocaleString('en-US');
/** Compact read-only QC counters, shown ONLY inside Shipping Schedule PO rows. */
export default function ShippingScheduleQcCell({ summary, onDetails, scanDate, loading }) {
  const trUi = useT();
  if (!summary) return <Typography variant="caption" color="text.secondary">{loading ? 'QC loading…' : 'QC unavailable'}</Typography>;
  const total = count(summary.plannedCartons);
  const totalItems = count(summary.plannedItems);
  const open = (issue) => (event) => { event.stopPropagation(); onDetails?.(issue); };
  const button = { minWidth: 0, p: 0, lineHeight: 1.15, textTransform: 'none', fontSize: 11, fontWeight: 750 };
  return <Stack spacing={0.3} sx={{ minWidth: 255, py: 0.15 }}>
    <Stack direction="row" spacing={0.6} alignItems="center" justifyContent="space-between">
      <Typography variant="caption" fontWeight={650}>{trUi("Completed")}</Typography>
      <Button sx={button} onClick={open('INCOMPLETE')}>{count(summary.completedCartons)} / {total}</Button>
    </Stack>
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
      <Typography variant="caption" fontWeight={650}>{trUi("SSCC Assigned")}</Typography>
      <Button color={summary.ssccAssigned < summary.plannedCartons ? 'warning' : 'success'} sx={button} onClick={open('SSCC_MISSING')}>
        {count(summary.ssccAssigned)} / {total}
      </Button>
    </Stack>
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
      <Typography variant="caption" fontWeight={650}>{trUi("SKU Items Assigned")}</Typography>
      <Button color={summary.assignedItems < summary.plannedItems ? 'warning' : 'success'} sx={button} onClick={open('SKU_MISSING')}>
        {count(summary.assignedItems)} / {totalItems}
      </Button>
    </Stack>
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
      <Typography variant="caption" fontWeight={650}>RFID</Typography>
      <Stack direction="row" spacing={0.7} alignItems="center">
        <Button color="success" sx={button} onClick={open('PASS')}>{trUi("PASS ")}{count(summary.rfidPass)}</Button>
        <Button color="error" sx={button} onClick={open('FAILED')}>{trUi("FAIL ")}{count(summary.rfidFailed)}</Button>
        <Button sx={button} onClick={open('NOT_SCANNED')}>{trUi("Not ")}{count(summary.rfidNotScanned)}</Button>
      </Stack>
    </Stack>
    {scanDate && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{trUi("Scans on ")}{scanDate}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{trUi("\n        PASS ")}{count(summary.scanDayPassAttempts)}{trUi(" · FAIL ")}{count(summary.scanDayFailedAttempts)}
      </Typography>
    </Box>}
  </Stack>;
}
