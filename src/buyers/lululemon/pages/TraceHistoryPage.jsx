import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Paper, Stack, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography
} from '@mui/material';
import { Refresh, Search, Undo, LinkOff, RestartAlt } from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import { CompactPageHeader } from 'components/CompactPageHeader';
import StatusChip from 'components/StatusChip';
import { isAdmin } from 'utils/accessControl';
import OrderScope from '../components/OrderScope';
import {
  reopenCarton,
  resetPoSku,
  traceWorkflow,
  unassignSscc
} from '../services/service';
import { APP_MESSAGES, createReopenCartonReasonMessage, createReopenCartonSuccessMessage, createResetSkuReasonMessage, createResetSkuSuccessMessage, createUnassignSsccReasonMessage, createUnassignSsccSuccessMessage } from '../../../constants/appMessages';
import { CARTON_STATUS, ITEM_STATUS, WEIGHING_RESULT } from '../../../constants/appConstants';

const errorText = (error) => error?.response?.data?.message || error?.message || APP_MESSAGES.OPERATION_FAILED;

const displayWeightResult = (value) => {
  const normalized = value === 'HOLD' ? WEIGHING_RESULT.FAILED : value;
  return [WEIGHING_RESULT.PASS, WEIGHING_RESULT.FAILED].includes(normalized) ? normalized : null;
};

export default function TraceHistoryPage() {
  const [orderId, setOrderId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const admin = isAdmin();

  const runSearch = async () => {
    if (!orderId || !keyword.trim()) return;
    setBusy(true); setNotice(null);
    try {
      const data = await traceWorkflow(orderId, keyword.trim());
      setRows(Array.isArray(data) ? data : []);
      setSelected((Array.isArray(data) && data.length) ? data[0] : null);
      if (!data?.length) setNotice({ severity: 'info', text: APP_MESSAGES.TRACE_NO_MATCH });
    } catch (error) {
      setRows([]); setSelected(null); setNotice({ severity: 'error', text: errorText(error) });
    } finally { setBusy(false); }
  };

  const reason = (message) => {
    const value = window.prompt(message, APP_MESSAGES.DEFAULT_CORRECTION_REASON);
    return value && value.trim().length >= 3 ? value.trim() : null;
  };

  const runException = async (callback, promptText, successText) => {
    const why = reason(promptText);
    if (!why) return;
    setBusy(true); setNotice(null);
    try {
      await callback(why);
      setNotice({ severity: 'success', text: successText });
      await runSearch();
    } catch (error) { setNotice({ severity: 'error', text: errorText(error) }); }
    finally { setBusy(false); }
  };

  const totals = useMemo(() => ({
    cartons: rows.length,
    items: rows.reduce((sum, row) => sum + Number(row?.items?.length || 0), 0),
    events: rows.reduce((sum, row) => sum + Number(row?.events?.length || 0), 0),
    weights: rows.reduce((sum, row) => sum + Number(row?.weightEvents?.length || 0), 0)
  }), [rows]);

  return (
    <Stack spacing={0.85} sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader
        dense
        title="Trace & History"
        subtitle="Search by PO, SKU, Carton ID or SSCC and trace the carton back to every product scan and exception event."
        meta={<Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap><Chip size="small" label={`${totals.cartons} cartons`} /><Chip size="small" label={`${totals.items} items`} /><Chip size="small" label={`${totals.events} scan events`} /><Chip size="small" label={`${totals.weights} weight events`} /></Stack>}
      />
      <OrderScope value={orderId} onChange={(value) => { setOrderId(value); setRows([]); setSelected(null); }} />
      {notice ? <Alert severity={notice.severity}>{notice.text}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 0.8, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
          <TextField
            size="small" fullWidth label="PO / SKU / Carton ID / SSCC"
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Example: 20719905 or 000160072730 or SSCC-18"
          />
          <Button variant="contained" startIcon={<Search />} disabled={busy || !orderId || !keyword.trim()} onClick={runSearch} sx={{ minHeight: { xs: 48, sm: 'auto' } }}>Search</Button>
          <Button variant="outlined" startIcon={<Refresh />} disabled={busy || !orderId || !keyword.trim()} onClick={runSearch} sx={{ minHeight: { xs: 48, sm: 'auto' } }}>Refresh</Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport sx={{ maxHeight: 430 }}>
            <SortableTable stickyHeader size="small">
              <TableHead><TableRow>
                <TableCell>PO</TableCell><TableCell>Factory</TableCell><TableCell>SKU</TableCell><TableCell>Carton</TableCell>
                <TableCell>Qty</TableCell><TableCell>Status</TableCell><TableCell>SSCC-18</TableCell><TableCell>Weight</TableCell>
                <TableCell>Scans</TableCell><TableCell>Events</TableCell><TableCell data-sortable={false}>Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {rows.map((row) => {
                  const po = row.po || {};
                  const carton = row.carton || {};
                  return (
                    <TableRow key={`${po.id || 'po'}-${carton.id || 'none'}`} hover selected={selected === row} onClick={() => setSelected(row)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ fontWeight: 750 }}>{po.poNumber || '—'}</TableCell><TableCell>{po.factoryCode || '—'}</TableCell><TableCell>{po.sku || '—'}</TableCell><TableCell>{carton.cartonNo ?? '—'}</TableCell><TableCell>{carton.plannedQty != null ? `${carton.scannedQty || 0}/${carton.plannedQty}` : '—'}</TableCell><TableCell><StatusChip status={carton.status || po.status} /></TableCell><TableCell>{carton.sscc18 || carton.sscc || '—'}</TableCell><TableCell>{displayWeightResult(carton.weightStatus) ? <StatusChip status={displayWeightResult(carton.weightStatus)} /> : '—'}</TableCell><TableCell>{row.items?.filter((item) => item.status === ITEM_STATUS.PASS).length || 0}</TableCell><TableCell>{row.events?.length || 0}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {admin ? <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                          {po.sku ? <Button size="small" color="warning" startIcon={<RestartAlt />} disabled={busy} onClick={() => runException((why) => resetPoSku(orderId, po.id, why), createResetSkuReasonMessage(po.poNumber), createResetSkuSuccessMessage(po.poNumber))}>Reset SKU</Button> : null}
                          {carton.id && [CARTON_STATUS.FINISHED, CARTON_STATUS.LABEL_CONFIRMED].includes(carton.status) && !carton.sscc18 ? <Button size="small" startIcon={<Undo />} disabled={busy} onClick={() => runException((why) => reopenCarton(orderId, carton.id, why), createReopenCartonReasonMessage(carton.cartonNo), createReopenCartonSuccessMessage(carton.cartonNo))}>Re-open</Button> : null}
                          {carton.id && (carton.sscc18 || carton.sscc) ? <Button size="small" color="error" startIcon={<LinkOff />} disabled={busy} onClick={() => runException((why) => unassignSscc(orderId, carton.id, why), createUnassignSsccReasonMessage(carton.cartonNo), createUnassignSsccSuccessMessage(carton.cartonNo))}>Unassign SSCC</Button> : null}
                        </Stack> : 'View only'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!rows.length ? <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>Search to view trace history.</TableCell></TableRow> : null}
              </TableBody>
            </SortableTable>
          </LululemonTableViewport>
        </Box>
        <Stack spacing={0.75} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
          {rows.map((row) => {
            const po = row.po || {};
            const carton = row.carton || {};
            const isSelected = selected === row;
            return (
              <Paper key={`${po.id || 'po'}-${carton.id || 'none'}`} variant="outlined" onClick={() => setSelected(row)} sx={{ p: 1, borderRadius: 1.7, borderColor: isSelected ? 'primary.main' : 'divider', bgcolor: isSelected ? 'primary.lighter' : 'background.paper' }}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                  <Box sx={{ minWidth: 0 }}><Typography fontWeight={950}>PO {po.poNumber || '—'} · Carton {carton.cartonNo ?? '—'}</Typography><Typography variant="body2" fontWeight={850}>SKU {po.sku || '—'} · Factory {po.factoryCode || '—'}</Typography></Box>
                  <StatusChip status={carton.status || po.status} />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.45, wordBreak: 'break-all' }}>SSCC {carton.sscc18 || carton.sscc || '—'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0.55, mt: 0.7 }}>
                  <Box><Typography variant="caption" color="text.secondary">Qty</Typography><Typography fontWeight={900}>{carton.plannedQty != null ? `${carton.scannedQty || 0}/${carton.plannedQty}` : '—'}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Scans</Typography><Typography fontWeight={900}>{row.items?.filter((item) => item.status === ITEM_STATUS.PASS).length || 0}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Events</Typography><Typography fontWeight={900}>{row.events?.length || 0}</Typography></Box>
                </Box>
                {displayWeightResult(carton.weightStatus) ? <Box sx={{ mt: 0.65 }}><StatusChip status={displayWeightResult(carton.weightStatus)} /></Box> : null}
                {admin ? <Stack direction="column" spacing={0.6} onClick={(e) => e.stopPropagation()} sx={{ mt: 0.8 }}>
                  {po.sku ? <Button fullWidth color="warning" variant="outlined" startIcon={<RestartAlt />} disabled={busy} onClick={() => runException((why) => resetPoSku(orderId, po.id, why), createResetSkuReasonMessage(po.poNumber), createResetSkuSuccessMessage(po.poNumber))} sx={{ minHeight: 44 }}>Reset SKU</Button> : null}
                  {carton.id && [CARTON_STATUS.FINISHED, CARTON_STATUS.LABEL_CONFIRMED].includes(carton.status) && !carton.sscc18 ? <Button fullWidth variant="outlined" startIcon={<Undo />} disabled={busy} onClick={() => runException((why) => reopenCarton(orderId, carton.id, why), createReopenCartonReasonMessage(carton.cartonNo), createReopenCartonSuccessMessage(carton.cartonNo))} sx={{ minHeight: 44 }}>Re-open carton</Button> : null}
                  {carton.id && (carton.sscc18 || carton.sscc) ? <Button fullWidth color="error" variant="outlined" startIcon={<LinkOff />} disabled={busy} onClick={() => runException((why) => unassignSscc(orderId, carton.id, why), createUnassignSsccReasonMessage(carton.cartonNo), createUnassignSsccSuccessMessage(carton.cartonNo))} sx={{ minHeight: 44 }}>Unassign SSCC</Button> : null}
                </Stack> : null}
              </Paper>
            );
          })}
          {!rows.length ? <Typography align="center" color="text.secondary" sx={{ py: 4 }}>Search to view trace history.</Typography> : null}
        </Stack>
      </Paper>

      {selected ? <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Trace detail · PO {selected.po?.poNumber || '—'} · Carton {selected.carton?.cartonNo || '—'}</Typography>
        <Divider sx={{ my: 1 }} />

        <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 0.5 }}>Item Assignment / Scan History</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>Item</TableCell><TableCell>Status</TableCell><TableCell>Assigned SKU</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead><TableBody>{(selected.items || []).map((item) => <TableRow key={item.id}><TableCell>{item.itemNo}</TableCell><TableCell><StatusChip status={item.status} /></TableCell><TableCell>{item.expectedSku || item.scannedSku || '—'}</TableCell><TableCell>{item.scannedBy || '—'}</TableCell><TableCell>{item.scannedAt || '—'}</TableCell></TableRow>)}{!selected.items?.length ? <TableRow><TableCell colSpan={5} align="center">No generated/scanned items.</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.items || []).map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 0.75, borderRadius: 1.4 }}><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={900}>Item {item.itemNo}</Typography><Typography variant="body2">SKU {item.expectedSku || item.scannedSku || '—'}</Typography></Box><StatusChip status={item.status} /></Stack><Typography variant="caption" color="text.secondary">{item.scannedBy || '—'} · {item.scannedAt || '—'}</Typography></Paper>)}
          {!selected.items?.length ? <Typography variant="body2" color="text.secondary">No generated/scanned items.</Typography> : null}
        </Stack>

        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>Scan / Exception Events</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>Type</TableCell><TableCell>Result</TableCell><TableCell>Raw</TableCell><TableCell>Message</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead><TableBody>{(selected.events || []).map((event) => <TableRow key={event.id}><TableCell>{event.scanType || '—'}</TableCell><TableCell>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : '—'}</TableCell><TableCell>{event.rawValue || event.raw || '—'}</TableCell><TableCell>{event.message || '—'}</TableCell><TableCell>{event.actor || '—'}</TableCell><TableCell>{event.createdAt || '—'}</TableCell></TableRow>)}{!selected.events?.length ? <TableRow><TableCell colSpan={6} align="center">No scan events.</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.events || []).map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 0.75, borderRadius: 1.4 }}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography fontWeight={900}>{event.scanType || 'EVENT'}</Typography>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : null}</Stack><Typography variant="body2" sx={{ mt: 0.25 }}>{event.message || '—'}</Typography><Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{event.rawValue || event.raw || '—'} · {event.actor || '—'} · {event.createdAt || '—'}</Typography></Paper>)}
          {!selected.events?.length ? <Typography variant="body2" color="text.secondary">No scan events.</Typography> : null}
        </Stack>

        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>Weighing History</Typography>
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <LululemonTableViewport sx={{ maxHeight: 280 }}><SortableTable stickyHeader size="small"><TableHead><TableRow><TableCell>Action</TableCell><TableCell>Result</TableCell><TableCell>Expected kg</TableCell><TableCell>Actual kg</TableCell><TableCell>Difference kg</TableCell><TableCell>Tolerance kg</TableCell><TableCell>Station</TableCell><TableCell>Source</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead><TableBody>{(selected.weightEvents || []).map((event) => <TableRow key={event.id}><TableCell>{event.action || '—'}</TableCell><TableCell>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : '—'}</TableCell><TableCell>{event.expectedWeightKg ?? '—'}</TableCell><TableCell>{event.actualWeightKg ?? '—'}</TableCell><TableCell>{event.differenceKg ?? '—'}</TableCell><TableCell>{event.toleranceKg ?? '—'}</TableCell><TableCell>{event.stationCode || '—'}</TableCell><TableCell>{event.source || '—'}</TableCell><TableCell>{event.userId || '—'}</TableCell><TableCell>{event.createdAt || '—'}</TableCell></TableRow>)}{!selected.weightEvents?.length ? <TableRow><TableCell colSpan={10} align="center">No weighing events.</TableCell></TableRow> : null}</TableBody></SortableTable></LululemonTableViewport>
        </Box>
        <Stack spacing={0.55} sx={{ display: { xs: 'flex', md: 'none' } }}>
          {(selected.weightEvents || []).map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 0.75, borderRadius: 1.4 }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={900}>{event.action || 'WEIGHT'}</Typography>{displayWeightResult(event.result) ? <StatusChip status={displayWeightResult(event.result)} /> : null}</Stack><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0.5, mt: 0.5 }}><Box><Typography variant="caption" color="text.secondary">Expected</Typography><Typography fontWeight={850}>{event.expectedWeightKg ?? '—'}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Actual</Typography><Typography fontWeight={850}>{event.actualWeightKg ?? '—'}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Diff</Typography><Typography fontWeight={850}>{event.differenceKg ?? '—'}</Typography></Box></Box><Typography variant="caption" color="text.secondary">Station {event.stationCode || '—'} · {event.userId || '—'} · {event.createdAt || '—'}</Typography></Paper>)}
          {!selected.weightEvents?.length ? <Typography variant="body2" color="text.secondary">No weighing events.</Typography> : null}
        </Stack>
      </Paper> : null}
    </Stack>
  );
}
