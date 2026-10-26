import { Box, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';

const asQty = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
const fmt = (value) => Math.round(asQty(value)).toLocaleString('en-US');

/** The PO-level read-only counters are based on current persisted Carton inspections.
 * - Cartons: BOTH RFID PASS and Weight PASS on the same carton.
 * - RFID: cartons with current RFID PASS.
 * - Weight: cartons with current Weight PASS.
 * Planned cartons absent from MongoDB still count in the denominator.
 * Does not change the business PASS logic, the ALL_BP carton plan or EPC validation.
 */
export default function PoInspectionProgressCell({ row }) {
  const inspection = row?.inspectionProgress;
  const finalCount = row?.completedCartons;
  // Avoid showing misleading zeros when the browser has been updated but the API has not.
  if (!inspection || finalCount === null || finalCount === undefined) {
    return (
      <Tooltip title="Inspection counters unavailable. Deploy the updated backend together with the frontend.">
        <Typography variant="caption" color="text.secondary">Progress unavailable</Typography>
      </Tooltip>
    );
  }

  const planned = asQty(inspection.plannedCartons ?? row?.plannedCartons ?? row?.cartonCount);
  const lines = [
    {
      name: 'Cartons', passed: asQty(finalCount), failed: null,
      title: 'Cartons completed: current RFID PASS and Weight PASS for the same carton.'
    },
    {
      name: 'RFID', passed: asQty(inspection.rfidPassedCartons),
      failed: asQty(inspection.rfidFailedCartons), title: 'Cartons with RFID PASS.'
    },
    {
      name: 'Weight', passed: asQty(inspection.weightPassedCartons),
      failed: asQty(inspection.weightFailedCartons), title: 'Cartons with Weight PASS.'
    }
  ];

  return (
    <Stack spacing={0.55} sx={{ minWidth: 210, py: 0.25 }}>
      {lines.map(({ name, passed, failed, title }) => {
        const full = planned > 0 && passed === planned;
        const hasFailure = failed !== null && failed > 0;
        const color = full ? 'success' : hasFailure ? 'error' : passed > 0 ? 'info' : 'inherit';
        const details = `${title} ${fmt(passed)} / ${fmt(planned)} planned cartons${failed !== null ? ` · ${fmt(failed)} FAILED` : ''}.`;
        return (
          <Tooltip key={name} title={details} arrow placement="top">
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} sx={{ mb: 0.1 }}>
                <Typography component="span" variant="caption" fontWeight={700} color="text.secondary" sx={{ lineHeight: 1.15 }}>
                  {name}
                </Typography>
                <Typography component="span" variant="caption" fontWeight={800} color={full ? 'success.main' : hasFailure ? 'error.main' : 'text.primary'} sx={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
                  {fmt(passed)} / {fmt(planned)}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={planned > 0 ? Math.min(100, (passed / planned) * 100) : 0}
                color={color === 'inherit' ? 'primary' : color}
                aria-label={`${name}: ${fmt(passed)} of ${fmt(planned)} cartons passed`}
                sx={{ height: 4, borderRadius: 99, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { borderRadius: 99 } }}
              />
            </Box>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
