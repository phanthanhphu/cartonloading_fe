import { useEffect, useState } from 'react';
import { Button, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { PlayArrow, Stop, PrecisionManufacturingOutlined } from '@mui/icons-material';
import { listMyConveyorDevices, readConveyorDevice, commandConveyor } from '../services/conveyorPlcDevices';

const message = (error) => error?.response?.data?.message || error?.message || 'Device connection failed';

/** Compact operator control: one Factory, one assigned Conveyor, no technical fields. */
export default function ConveyorSimControl({ factoryCode, endAction = null, notice = '' }) {
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState('');
  const [reading, setReading] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    setDevices([]);
    setSelected('');
    setReading(null);
    setError('');
    setLoading(true);
    listMyConveyorDevices().then((rows) => {
      if (disposed) return;
      const allowed = (Array.isArray(rows) ? rows : []).filter((row) =>
        String(row.factoryCode || '').toUpperCase() === String(factoryCode || '').toUpperCase());
      setDevices(allowed);
      // Factory-level configuration: use its assigned device without a selector.
      setSelected(allowed[0]?.deviceCode || '');
    }).catch((e) => { if (!disposed) setError(message(e)); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [factoryCode]);

  useEffect(() => {
    if (!selected) return undefined;
    let cancelled = false;
    const poll = () => readConveyorDevice(selected)
      .then((result) => { if (!cancelled) { setReading(result); setError(''); } })
      .catch((e) => { if (!cancelled) { setReading(null); setError(message(e)); } });
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selected]);

  const send = async (action) => {
    if (!selected || busy || !reading) return;
    setBusy(true);
    setError('');
    try { setReading(await commandConveyor(selected, action)); }
    catch (e) { setError(message(e)); setReading(null); }
    finally { setBusy(false); }
  };

  const connected = Boolean(reading && !error && String(reading.status || '').toUpperCase().startsWith('CONNECTED'));
  const fault = Boolean(reading?.fault);
  const statusLabel = fault ? 'Fault' : connected ? 'Connected' : loading ? 'Checking...' : 'Disconnected';
  const statusColor = fault ? 'error' : connected ? 'success' : 'default';
  const statusTip = error || notice || (connected
    ? 'Connection verified by the device read. Simulator connections are not physical PLC connections.'
    : devices.length ? 'Device is not responding.' : 'No conveyor assigned to this Factory. Configure it in Device Management.');

  return <Paper variant="outlined" sx={{ px: { xs: 1, sm: 1.5 }, py: 0.65, borderRadius: 2,
    borderColor: '#DBE6F4', bgcolor: '#fff' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap" useFlexGap>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        <PrecisionManufacturingOutlined color="primary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={850}>Device</Typography>
        <Tooltip arrow title={statusTip}>
          <Chip size="small" label={statusLabel} color={statusColor} variant={connected || fault ? 'filled' : 'outlined'} />
        </Tooltip>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Button size="small" variant="contained" color="success" startIcon={<PlayArrow />}
          disabled={busy || !connected || reading.commandOn || fault}
          onClick={() => send('START')}>RUN</Button>
        <Tooltip arrow title="Web STOP only sends a device command. It does not replace an emergency stop.">
          <span>
            <Button size="small" variant="outlined" color="warning" startIcon={<Stop />}
              disabled={busy || !connected || !reading.commandOn}
              onClick={() => send('STOP')}>STOP</Button>
          </span>
        </Tooltip>
        {endAction}
      </Stack>
    </Stack>
  </Paper>;
}
