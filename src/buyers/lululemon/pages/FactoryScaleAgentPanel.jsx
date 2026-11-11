import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { discoverPcPorts, listPcAgents, registerPcAgent, revokePcAgent } from '../services/factoryPcAgents';

const errorText = (e) => e?.response?.data?.message || e?.message || 'Could not contact Factory PC Agent';

/** One Windows Agent per PC, multiple COM ports; configuration stays in Web + MongoDB. */
export default function FactoryScaleAgentPanel({ factoryCode, selectedAgentId = '', selectedPort = '',
  onSelectAgent, onSelectPort, readOnly = false, showHelp = false }) {
  const [pcs, setPcs] = useState([]);
  const [ports, setPorts] = useState([]);
  const [pcName, setPcName] = useState('');
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const refresh = useCallback(async () => {
    if (!factoryCode) return;
    try {
      const data = await listPcAgents(factoryCode);
      setPcs(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) { setError(errorText(e)); }
  }, [factoryCode]);
  useEffect(() => {
    setPcs([]); setPorts([]); setSecret(null); setError('');
    void refresh();
  }, [refresh]);
  useEffect(() => { setPorts([]); }, [selectedAgentId]);
  const current = pcs.find((p) => p.agentId === selectedAgentId);

  const register = async () => {
    if (!pcName.trim() || busy || readOnly) return;
    setBusy(true); setError(''); setSecret(null);
    try {
      const value = await registerPcAgent(factoryCode, pcName.trim());
      setSecret(value);
      setPcName('');
      await refresh();
      onSelectAgent?.(value.agentId);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const discover = async () => {
    if (!selectedAgentId || busy) return;
    setBusy(true); setError('');
    try {
      const value = await discoverPcPorts(factoryCode, selectedAgentId);
      setPorts(Array.isArray(value?.ports) ? value.ports : []);
    } catch (e) { setPorts([]); setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!current || busy || readOnly || !window.confirm(`Revoke ${current.displayName}? This PC will disconnect; its device config is NOT deleted.`)) return;
    setBusy(true); setError('');
    try {
      await revokePcAgent(factoryCode, selectedAgentId);
      onSelectAgent?.(''); onSelectPort?.('');
      await refresh();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  return <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '4px', border: '1px solid', borderColor: 'divider' }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
      <Box>
        <Typography variant="subtitle2" fontWeight={800}>Factory PC Agents · {factoryCode}</Typography>
        {showHelp && <Typography variant="caption" color="text.secondary">Install one Agent per Windows PC. Configure PLC/Scale COM here on Web.</Typography>}
      </Box>
      <Button size="small" variant="outlined" onClick={refresh} disabled={busy}>Refresh PCs</Button>
    </Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mt: 1.5 }}>
      <TextField select size="small" fullWidth label="Windows PC / Agent" value={pcs.some(p => p.agentId === selectedAgentId) ? selectedAgentId : ''}
        disabled={busy || readOnly} onChange={(e) => { onSelectAgent?.(e.target.value); onSelectPort?.(''); }}>
        <MenuItem value="">Select PC…</MenuItem>
        {pcs.map((p) => <MenuItem key={p.agentId} value={p.agentId}>{p.displayName} · {p.online ? 'Online' : 'Offline'}</MenuItem>)}
      </TextField>
      <Button variant="outlined" size="small" disabled={busy || !selectedAgentId} onClick={discover}>Detect COM Ports</Button>
    </Stack>
    {selectedAgentId && <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
      <Chip size="small" color={current?.online ? 'success' : 'default'} label={current?.online ? 'PC Agent Online' : 'PC Agent Offline'} />
      {showHelp && <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>Agent ID: {selectedAgentId}</Typography>}
    </Stack>}
    {ports.length > 0 && <TextField select size="small" fullWidth label="Detected COM port on selected PC" sx={{ mt: 1.5 }}
      value={ports.includes(selectedPort) ? selectedPort : ''} disabled={busy || readOnly}
      onChange={(e) => onSelectPort?.(e.target.value)}>
      <MenuItem value="">Select COM port…</MenuItem>
      {ports.map((port) => <MenuItem key={port} value={port}>{port}</MenuItem>)}
    </TextField>}
    {showHelp && selectedAgentId && ports.length === 0 && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
      Use Detect COM Ports while PC Agent is Online; COM can still be entered manually if Windows detection fails.
    </Typography>}
    {!readOnly && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }}>
      <TextField size="small" fullWidth label="Register PC name" value={pcName} disabled={busy || readOnly}
        placeholder="e.g. F3-Weight-PC-01" onChange={(e) => setPcName(e.target.value)} />
      <Button variant="outlined" size="small" disabled={!pcName.trim() || busy || readOnly} onClick={register}>Add PC Agent</Button>
      <Button variant="outlined" color="warning" size="small" disabled={!current || busy || readOnly} onClick={revoke}>Revoke PC</Button>
    </Stack>}
    {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    {secret && <Alert severity="warning" sx={{ mt: 1.5 }}>
      <Typography variant="body2" fontWeight={700}>One-time PC pairing credentials (IT only)</Typography>
      <Typography variant="caption">Enter Server URL + Factory + Agent ID + Token once in the Windows Agent installer. COM port is NOT configured there. Do not post token in chat/screenshots.</Typography>
      <TextField size="small" fullWidth label="Agent ID" value={secret.agentId} sx={{ mt: 1 }} InputProps={{ readOnly: true }} />
      <TextField size="small" fullWidth label="One-time Token" value={secret.token} sx={{ mt: 1 }} InputProps={{ readOnly: true }} />
      <Button size="small" onClick={() => setSecret(null)}>Hide token</Button>
    </Alert>}
    {showHelp && <Alert severity="info" sx={{ mt: 1.5 }}>
      Device assignment: select PC → Detect COM → choose port → Test PLC Connection → Save. Agent Online does not mean PLC Connected. Currently PC Agent supports read-only Delta PLC Scale, not Conveyor motor controls or RFID protocols.
    </Alert>}
  </Box>;
}
