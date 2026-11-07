import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
import { enrollScaleAgent, getScaleAgentStatus } from '../services/scalePlcAgents';

const errorText = (e) => e?.response?.data?.message || e?.message || 'Could not contact Factory Agent service';

/** Admin-only one-time Local Agent enrollment. Tokens are NEVER saved to localStorage or displayed again. */
export default function FactoryScaleAgentPanel({ factoryCode }) {
  const [info, setInfo] = useState(null);
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!factoryCode) return;
    try { setInfo(await getScaleAgentStatus(factoryCode)); setError(''); }
    catch (e) { setError(errorText(e)); }
  }, [factoryCode]);
  useEffect(() => { setInfo(null); setSecret(null); refresh(); }, [refresh]);
  const enroll = async () => {
    if (!factoryCode || busy) return;
    if (info?.registered && !window.confirm(`Rotate Local Agent credentials for ${factoryCode}? The old Factory Agent will be disconnected immediately.`)) return;
    setBusy(true); setError(''); setSecret(null);
    try {
      const created = await enrollScaleAgent(factoryCode);
      setSecret(created);
      await refresh();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  return <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
      <Box>
        <Typography variant="subtitle2" fontWeight={800}>Factory Local PLC Agent · {factoryCode}</Typography>
        <Typography variant="caption" color="text.secondary">Agent runs on the Factory PC connected to the USB PLC, not on Linux Server.</Typography>
      </Box>
      <Chip size="small" color={info?.online ? 'success' : 'default'}
        label={!info ? 'Status unknown' : info.online ? 'Agent Online' : info.registered ? 'Agent Offline' : 'Not registered'}/>
    </Stack>
    {info?.agentId && <Typography variant="body2" sx={{ mt: 1 }}>Agent ID: <strong>{info.agentId}</strong></Typography>}
    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
      <Button size="small" variant="outlined" disabled={busy} onClick={refresh}>Refresh Agent Status</Button>
      <Button size="small" variant="outlined" color={info?.registered ? 'warning' : 'primary'} disabled={busy} onClick={enroll}>
        {busy ? 'Working…' : info?.registered ? 'Rotate Agent Key' : 'Register Agent'}
      </Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    {secret && <Alert severity="warning" sx={{ mt: 1.5 }}>
      <Typography variant="body2" fontWeight={800}>Copy these credentials into agent.properties on the Factory PC NOW.</Typography>
      <Typography variant="caption">The token is shown only once. Never paste it into chat, screenshots or source control.</Typography>
      <TextField sx={{ mt: 1 }} fullWidth size="small" label="Agent ID" value={secret.agentId || ''} InputProps={{ readOnly: true }} />
      <TextField sx={{ mt: 1 }} fullWidth size="small" label="One-time Agent Token" value={secret.token || ''} InputProps={{ readOnly: true }} />
      <Button size="small" sx={{ mt: 1 }} onClick={() => setSecret(null)}>I have saved the token (hide)</Button>
    </Alert>}
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
      Run Java 17 Factory Agent with HTTPS, Factory ID, Agent ID/key and an allowed COM port. A connected Agent does not necessarily mean the PLC or weighing indicator is connected.
    </Typography>
  </Box>;
}
