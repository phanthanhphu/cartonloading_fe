import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { Inventory2Outlined, PlayArrow, Stop } from '@mui/icons-material';
import { CONVEYOR_POSITION } from '../services/conveyorAdapter';

const labels = {
  [CONVEYOR_POSITION.IDLE]: 'STOPPED',
  [CONVEYOR_POSITION.INFEED]: 'STARTING · INFEED',
  [CONVEYOR_POSITION.WEIGHT]: 'WEIGHING · WAITING FOR PLC',
  [CONVEYOR_POSITION.WEIGHT_HOLD]: 'WEIGHT FAILED · HOLD',
  [CONVEYOR_POSITION.RFID]: 'SCANNING RFID',
  [CONVEYOR_POSITION.HOLD]: 'RFID HOLD',
  [CONVEYOR_POSITION.DONE]: 'FINAL PASS'
};

/** START is the only routine conveyor action. The displayed position is simulated,
 *  not a real motor/cylinder/sensor acknowledgement. STOP remains accessible.
 */
export default function ConveyorControlPanel({
  position, running, busy, startDisabled, onStart, onStop, compact = false,
  cartonNo, weightStatus, rfidStatus
}) {
  const current = position || CONVEYOR_POSITION.IDLE;
  const atWeight = [CONVEYOR_POSITION.WEIGHT, CONVEYOR_POSITION.WEIGHT_HOLD].includes(current);
  const atRfid = [CONVEYOR_POSITION.RFID, CONVEYOR_POSITION.HOLD, CONVEYOR_POSITION.DONE].includes(current);
  const markerAt = current === CONVEYOR_POSITION.INFEED ? '16.67%' : atWeight ? '50%' : atRfid ? '83.33%' : null;
  const stateColor = [CONVEYOR_POSITION.HOLD, CONVEYOR_POSITION.WEIGHT_HOLD].includes(current)
    ? 'error' : current === CONVEYOR_POSITION.DONE ? 'success' : running ? 'info' : 'default';

  const description = current === CONVEYOR_POSITION.IDLE
    ? 'Press START once. Scan SSCC; a saved Weight PASS activates RFID in the same workspace.'
    : current === CONVEYOR_POSITION.INFEED
      ? 'Starting the station and moving virtually to the scale…'
      : current === CONVEYOR_POSITION.WEIGHT
        ? `Carton ${cartonNo ?? '—'} · ${weightStatus || 'Scan SSCC and wait for stable weight'} · auto-transfer on saved Weight PASS`
        : current === CONVEYOR_POSITION.WEIGHT_HOLD
          ? 'Weight FAILED: carton held at SCALE. Review/Re-weigh; RFID will not start.'
          : current === CONVEYOR_POSITION.RFID
            ? `Carton ${cartonNo ?? '—'} · RFID ${rfidStatus || 'SCANNING'} · use RFID reader or console`
            : current === CONVEYOR_POSITION.HOLD
              ? 'RFID HOLD: saved Weight PASS is retained. Review/re-scan EPCs.'
              : 'Final PASS saved; preparing the next carton in the same workspace.';

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, px: compact ? 1 : 1.25, py: compact ? 0.8 : 1, bgcolor: 'background.paper' }}>
      <Stack spacing={compact ? 0.7 : 1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight={950}>Automatic Conveyor</Typography>
            <Chip size="small" variant="outlined" color="primary" label="SIMULATION" sx={{ height: 21, fontWeight: 800 }} />
          </Stack>
          <Chip size="small" color={stateColor} label={labels[current] || current} />
        </Stack>
        <Box aria-label={`Simulated position: ${labels[current] || current}`}
          sx={{ position: 'relative', height: compact ? 47 : 52, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'action.hover', overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', top: 15, left: '10%', right: '10%', height: 4, borderRadius: 2, bgcolor: 'divider' }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', height: '100%', pt: 3.4 }}>
            {['INFEED', 'SCALE', 'RFID'].map((label) => (
              <Typography key={label} align="center" sx={{ fontSize: 10, fontWeight: 850, color: 'text.secondary' }}>{label}</Typography>
            ))}
          </Box>
          {markerAt && (
            <Box sx={{ position: 'absolute', top: 3, left: markerAt, transform: 'translateX(-50%)', transition: 'left 650ms ease', borderRadius: 1,
              bgcolor: [CONVEYOR_POSITION.HOLD, CONVEYOR_POSITION.WEIGHT_HOLD].includes(current) ? 'error.main' : current === CONVEYOR_POSITION.DONE ? 'success.main' : 'primary.main',
              color: 'primary.contrastText', width: 27, height: 26, display: 'grid', placeItems: 'center', boxShadow: 1 }}>
              <Inventory2Outlined sx={{ fontSize: 18 }} />
            </Box>
          )}
        </Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button variant="contained" size="small" startIcon={<PlayArrow />} onClick={onStart}
            disabled={busy || startDisabled} sx={{ height: 39, fontWeight: 900, minWidth: 120 }}>
            START
          </Button>
          <Button variant="outlined" size="small" color="error" startIcon={<Stop />}
            disabled={!running || busy} onClick={onStop} sx={{ height: 39, fontWeight: 900, minWidth: 100 }}>
            STOP
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0, flex: 1 }}>
            {description}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
