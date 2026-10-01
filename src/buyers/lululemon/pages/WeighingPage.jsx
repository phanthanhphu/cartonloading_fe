import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, FormControlLabel, MenuItem, Paper, Stack,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { Add, CheckCircleOutline, Refresh, Save, ScaleOutlined, Search, Undo } from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import { CompactPageHeader } from 'components/CompactPageHeader';
import StatusChip from 'components/StatusChip';
import { canAssignBarcode, canManageSales, canWeightCheck, isAdmin } from 'utils/accessControl';
import LululemonOrderScope from '../components/LululemonOrderScope';
import {
  createLululemonWeighingOrder,
  listLululemonWeightHistory,
  listLululemonWeighingEligiblePos,
  listLululemonWeighingOrders,
  lookupLululemonWeighingSscc,
  reopenLululemonWeight,
  saveLululemonWeightProfile,
  submitLululemonWeight
} from '../services/lululemonService';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Operation failed.';
const numberOrEmpty = (value) => (value === null || value === undefined ? '' : String(value));

export default function WeighingPage() {
  const [orderId, setOrderId] = useState('');
  const [eligible, setEligible] = useState([]);
  const [weighingOrders, setWeighingOrders] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedPoIds, setSelectedPoIds] = useState([]);
  const [newOrderName, setNewOrderName] = useState('');
  const [weighingOrderId, setWeighingOrderId] = useState('');
  const [sscc, setSscc] = useState('');
  const [lookup, setLookup] = useState(null);
  const [actualWeight, setActualWeight] = useState('');
  const [stationCode, setStationCode] = useState(() => localStorage.getItem('lululemon.weight.station') || 'SCALE-01');
  const [stable, setStable] = useState(true);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const mayConfigure = canManageSales();
  const mayCreate = canManageSales() || canAssignBarcode() || canWeightCheck();
  const mayWeigh = canWeightCheck();
  const admin = isAdmin();

  const loadData = useCallback(async () => {
    if (!orderId) { setEligible([]); setWeighingOrders([]); return; }
    setBusy(true); setNotice(null);
    try {
      const [poRows, orders] = await Promise.all([
        listLululemonWeighingEligiblePos(orderId),
        listLululemonWeighingOrders(orderId)
      ]);
      const safePos = Array.isArray(poRows) ? poRows : [];
      const safeOrders = Array.isArray(orders) ? orders : [];
      setEligible(safePos);
      setWeighingOrders(safeOrders);
      setProfiles(Object.fromEntries(safePos.map((row) => [row.po?.id, {
        unitWeightKg: numberOrEmpty(row.profile?.unitWeightKg),
        tareWeightKg: numberOrEmpty(row.profile?.tareWeightKg ?? 0),
        toleranceKg: numberOrEmpty(row.profile?.toleranceKg)
      }])));
      setSelectedPoIds((current) => current.filter((id) => safePos.some((row) => row.po?.id === id)));
      setWeighingOrderId((current) => safeOrders.some((row) => row.id === current) ? current : (safeOrders[0]?.id || ''));
    } catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  }, [orderId]);

  const loadHistory = useCallback(async () => {
    if (!orderId || !weighingOrderId) { setHistory([]); return; }
    try { setHistory(await listLululemonWeightHistory(orderId, weighingOrderId)); }
    catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
  }, [orderId, weighingOrderId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadHistory(); setLookup(null); setSscc(''); setActualWeight(''); }, [loadHistory]);

  const activeOrder = useMemo(() => weighingOrders.find((row) => row.id === weighingOrderId) || null, [weighingOrders, weighingOrderId]);

  const updateProfileField = (poId, key, value) => setProfiles((current) => ({
    ...current,
    [poId]: { ...(current[poId] || {}), [key]: value }
  }));

  const saveProfile = async (poId) => {
    const form = profiles[poId] || {};
    setBusy(true); setNotice(null);
    try {
      await saveLululemonWeightProfile(orderId, poId, {
        unitWeightKg: Number(form.unitWeightKg),
        tareWeightKg: Number(form.tareWeightKg || 0),
        toleranceKg: Number(form.toleranceKg)
      });
      setNotice({ severity: 'success', text: 'Weight profile saved.' });
      await loadData();
    } catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  };

  const togglePo = (poId) => setSelectedPoIds((current) => current.includes(poId) ? current.filter((id) => id !== poId) : [...current, poId]);

  const createOrder = async () => {
    if (!selectedPoIds.length) return;
    setBusy(true); setNotice(null);
    try {
      const created = await createLululemonWeighingOrder(orderId, { name: newOrderName, poIds: selectedPoIds });
      setNotice({ severity: 'success', text: `Weighing Order ${created.name} created.` });
      setSelectedPoIds([]); setNewOrderName('');
      await loadData();
      setWeighingOrderId(created.id);
    } catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  };

  const lookupSscc = async () => {
    if (!weighingOrderId || !sscc.trim()) return;
    setBusy(true); setNotice(null); setLookup(null);
    try {
      const result = await lookupLululemonWeighingSscc(orderId, weighingOrderId, sscc.trim());
      setLookup(result); setActualWeight('');
      setNotice({ severity: 'info', text: result.message || 'SSCC accepted.' });
    } catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  };

  const submitWeight = async () => {
    if (!lookup || !actualWeight || !stationCode.trim()) return;
    setBusy(true); setNotice(null);
    try {
      localStorage.setItem('lululemon.weight.station', stationCode.trim());
      const result = await submitLululemonWeight(orderId, weighingOrderId, {
        sscc: lookup.carton?.sscc18 || lookup.carton?.sscc || sscc,
        actualWeightKg: Number(actualWeight),
        stationCode: stationCode.trim(),
        stable,
        source: 'MANUAL'
      });
      setNotice({ severity: result.event?.result === 'PASS' ? 'success' : 'warning', text: result.message });
      setLookup(null); setSscc(''); setActualWeight('');
      await loadData(); await loadHistory();
    } catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  };

  const reopenWeight = async (event) => {
    const reason = window.prompt(`Reason for Re-weigh carton ${event.cartonNo}:`, 'Supervisor/Admin correction');
    if (!reason || reason.trim().length < 3) return;
    setBusy(true); setNotice(null);
    try {
      await reopenLululemonWeight(orderId, weighingOrderId, event.cartonId, reason.trim());
      setNotice({ severity: 'success', text: `Carton ${event.cartonNo} is open for Re-weigh.` });
      await loadData(); await loadHistory();
    } catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  };

  return (
    <Stack spacing={1.1} sx={{ p: { xs: 0.5, md: 1 } }}>
      <CompactPageHeader
        title="Carton Weighing"
        subtitle="Completed Carton Loading → Weighing Order → Scan SSCC-18 → stable scale weight → PASS or HOLD. Expected Gross Weight = Qty × Unit Weight + Tare."
        meta={activeOrder ? <StatusChip status={activeOrder.status} /> : null}
        actions={<Button size="small" startIcon={<Refresh />} onClick={loadData} disabled={busy}>Refresh</Button>}
      />
      <LululemonOrderScope value={orderId} onChange={(value) => { setOrderId(value); setWeighingOrderId(''); setLookup(null); }} />
      {notice ? <Alert severity={notice.severity}>{notice.text}</Alert> : null}

      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <Box sx={{ p: 1.1, borderBottom: '1px solid #E5EAF0' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }}>
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={800}>1. Completed PO Selection & Weight Standard</Typography>
              <Typography variant="caption" color="text.secondary">Only POs where every carton has completed Carton Loading and has SSCC-18 are listed.</Typography>
            </Box>
            <TextField size="small" label="Weighing Order Name" value={newOrderName} onChange={(e) => setNewOrderName(e.target.value)} sx={{ minWidth: 230 }} />
            <Button variant="contained" startIcon={<Add />} disabled={busy || !mayCreate || !selectedPoIds.length} onClick={createOrder}>Create Weighing Order</Button>
          </Stack>
        </Box>
        <TableContainer sx={{ maxHeight: 430 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow>
              <TableCell data-sortable={false}>Select</TableCell><TableCell>PO</TableCell><TableCell>Factory</TableCell><TableCell>SKU</TableCell><TableCell>Cartons</TableCell>
              <TableCell>Unit Weight kg</TableCell><TableCell>Tare kg</TableCell><TableCell>Tolerance ±kg</TableCell><TableCell>Profile</TableCell><TableCell data-sortable={false}>Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {eligible.map((row) => {
                const po = row.po || {};
                const form = profiles[po.id] || {};
                return <TableRow key={po.id} hover>
                  <TableCell><Checkbox size="small" checked={selectedPoIds.includes(po.id)} onChange={() => togglePo(po.id)} /></TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>{po.poNumber}</TableCell><TableCell>{po.factoryCode || '—'}</TableCell><TableCell>{po.sku || '—'}</TableCell><TableCell>{row.cartonCount || 0}</TableCell>
                  <TableCell><TextField size="small" type="number" value={form.unitWeightKg ?? ''} disabled={!mayConfigure} onChange={(e) => updateProfileField(po.id, 'unitWeightKg', e.target.value)} inputProps={{ step: '0.001', min: 0 }} sx={{ width: 120 }} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={form.tareWeightKg ?? ''} disabled={!mayConfigure} onChange={(e) => updateProfileField(po.id, 'tareWeightKg', e.target.value)} inputProps={{ step: '0.001', min: 0 }} sx={{ width: 110 }} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={form.toleranceKg ?? ''} disabled={!mayConfigure} onChange={(e) => updateProfileField(po.id, 'toleranceKg', e.target.value)} inputProps={{ step: '0.001', min: 0 }} sx={{ width: 120 }} /></TableCell>
                  <TableCell>{row.profile ? <Chip size="small" color="success" label="Configured" /> : <Chip size="small" color="warning" label="Required" />}</TableCell>
                  <TableCell>{mayConfigure ? <Button size="small" startIcon={<Save />} disabled={busy} onClick={() => saveProfile(po.id)}>Save</Button> : 'View only'}</TableCell>
                </TableRow>;
              })}
              {!eligible.length ? <TableRow><TableCell colSpan={10} align="center" sx={{ py: 5, color: 'text.secondary' }}>No PO is fully Ready to Ship yet.</TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </TableContainer>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 0.8 }}>2. Weighing Station</Typography>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.8} alignItems={{ lg: 'center' }}>
          <TextField select size="small" label="Weighing Order" value={weighingOrderId} onChange={(e) => setWeighingOrderId(e.target.value)} sx={{ minWidth: 280 }}>
            <MenuItem value="">Select...</MenuItem>
            {weighingOrders.map((row) => <MenuItem key={row.id} value={row.id}>{row.name} · {row.factoryCode} · {row.status}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Scan SSCC-18" value={sscc} onChange={(e) => setSscc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookupSscc()} sx={{ flex: 1, minWidth: 260 }} />
          <Button variant="contained" startIcon={<Search />} disabled={busy || !mayWeigh || !weighingOrderId || !sscc.trim()} onClick={lookupSscc}>Load Carton</Button>
        </Stack>

        {lookup ? <Box sx={{ mt: 1.2, p: 1.1, border: '1px solid #E0E7EF', borderRadius: 2, bgcolor: '#FAFCFE' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} flexWrap="wrap" useFlexGap>
            <Chip label={`PO ${lookup.po?.poNumber || '—'}`} />
            <Chip label={`SKU ${lookup.po?.sku || '—'}`} />
            <Chip label={`Carton ${lookup.carton?.cartonNo || '—'}`} />
            <Chip label={`Qty ${lookup.carton?.plannedQty || 0}`} />
            <Chip color="primary" label={`Expected ${lookup.expectedWeightKg} kg`} />
            <Chip label={`Tolerance ±${lookup.profile?.toleranceKg} kg`} />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} sx={{ mt: 1.1 }} alignItems={{ md: 'center' }}>
            <TextField size="small" type="number" label="Actual Weight (kg)" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} inputProps={{ step: '0.001', min: 0 }} sx={{ minWidth: 190 }} />
            <TextField size="small" label="Station / Device" value={stationCode} onChange={(e) => setStationCode(e.target.value)} sx={{ minWidth: 170 }} />
            <FormControlLabel control={<Checkbox checked={stable} onChange={(e) => setStable(e.target.checked)} />} label="Scale Stable" />
            <Button variant="contained" color="success" startIcon={busy ? <CircularProgress size={16} /> : <ScaleOutlined />} disabled={busy || !mayWeigh || !stable || !actualWeight || !stationCode.trim()} onClick={submitWeight}>Accept Weight</Button>
          </Stack>
        </Box> : null}
      </Paper>

      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <Box sx={{ p: 1.05, borderBottom: '1px solid #E5EAF0' }}><Typography fontWeight={800}>3. Weight History</Typography></Box>
        <TableContainer sx={{ maxHeight: 410 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow>
              <TableCell>Time</TableCell><TableCell>PO</TableCell><TableCell>Carton</TableCell><TableCell>SSCC</TableCell><TableCell>Expected</TableCell><TableCell>Actual</TableCell><TableCell>Diff</TableCell><TableCell>Tolerance</TableCell><TableCell>Result</TableCell><TableCell>Station</TableCell><TableCell>User</TableCell><TableCell data-sortable={false}>Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {history.map((event) => <TableRow key={event.id} hover>
                <TableCell>{event.createdAt || '—'}</TableCell><TableCell>{event.poNumber || '—'}</TableCell><TableCell>{event.cartonNo ?? '—'}</TableCell><TableCell>{event.sscc18 || '—'}</TableCell>
                <TableCell>{event.expectedWeightKg ?? '—'}</TableCell><TableCell>{event.actualWeightKg ?? '—'}</TableCell><TableCell>{event.differenceKg ?? '—'}</TableCell><TableCell>{event.toleranceKg ?? '—'}</TableCell>
                <TableCell><StatusChip status={event.result || event.action} /></TableCell><TableCell>{event.stationCode || '—'}</TableCell><TableCell>{event.userId || '—'}</TableCell>
                <TableCell>{admin && event.action === 'WEIGH' ? <Button size="small" startIcon={<Undo />} onClick={() => reopenWeight(event)} disabled={busy}>Re-weigh</Button> : '—'}</TableCell>
              </TableRow>)}
              {!history.length ? <TableRow><TableCell colSpan={12} align="center" sx={{ py: 5, color: 'text.secondary' }}>Select a Weighing Order to view its history.</TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </TableContainer>
      </Paper>

      {!mayWeigh ? <Alert severity="info" icon={<CheckCircleOutline />}>Weight Check permission is required to scan SSCC and accept scale readings. Sales can configure weight standards; Packing/Sales can create Weighing Orders.</Alert> : null}
    </Stack>
  );
}
