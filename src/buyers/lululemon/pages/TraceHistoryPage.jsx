import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Paper, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography
} from '@mui/material';
import { Refresh, Search, Undo, LinkOff, RestartAlt } from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import { CompactPageHeader } from 'components/CompactPageHeader';
import StatusChip from 'components/StatusChip';
import { isAdmin } from 'utils/accessControl';
import LululemonOrderScope from '../components/LululemonOrderScope';
import {
  reopenLululemonCarton,
  resetLululemonPoSku,
  traceLululemon,
  unassignLululemonSscc
} from '../services/lululemonService';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Operation failed.';

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
      const data = await traceLululemon(orderId, keyword.trim());
      setRows(Array.isArray(data) ? data : []);
      setSelected((Array.isArray(data) && data.length) ? data[0] : null);
      if (!data?.length) setNotice({ severity: 'info', text: 'No PO / SKU / Carton / SSCC matched this Order.' });
    } catch (error) {
      setRows([]); setSelected(null); setNotice({ severity: 'error', text: errorText(error) });
    } finally { setBusy(false); }
  };

  const reason = (message) => {
    const value = window.prompt(message, 'Correction requested by Supervisor/Admin');
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
    <Stack spacing={1.1} sx={{ p: { xs: 0.5, md: 1 } }}>
      <CompactPageHeader
        title="Trace & History"
        subtitle="Search by PO, SKU, Carton ID or SSCC and trace the carton back to every product scan and exception event."
        meta={<Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap><Chip size="small" label={`${totals.cartons} cartons`} /><Chip size="small" label={`${totals.items} items`} /><Chip size="small" label={`${totals.events} scan events`} /><Chip size="small" label={`${totals.weights} weight events`} /></Stack>}
      />
      <LululemonOrderScope value={orderId} onChange={(value) => { setOrderId(value); setRows([]); setSelected(null); }} />
      {notice ? <Alert severity={notice.severity}>{notice.text}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 1.1, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
          <TextField
            size="small" fullWidth label="PO / SKU / Carton ID / SSCC"
            value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Example: 20719905 or 000160072730 or SSCC-18"
          />
          <Button variant="contained" startIcon={<Search />} disabled={busy || !orderId || !keyword.trim()} onClick={runSearch}>Search</Button>
          <Button variant="outlined" startIcon={<Refresh />} disabled={busy || !orderId || !keyword.trim()} onClick={runSearch}>Refresh</Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <TableContainer sx={{ maxHeight: 430 }}>
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
                    <TableCell sx={{ fontWeight: 750 }}>{po.poNumber || '—'}</TableCell>
                    <TableCell>{po.factoryCode || '—'}</TableCell>
                    <TableCell>{po.sku || '—'}</TableCell>
                    <TableCell>{carton.cartonNo ?? '—'}</TableCell>
                    <TableCell>{carton.plannedQty != null ? `${carton.scannedQty || 0}/${carton.plannedQty}` : '—'}</TableCell>
                    <TableCell><StatusChip status={carton.status || po.status} /></TableCell>
                    <TableCell>{carton.sscc18 || carton.sscc || '—'}</TableCell>
                    <TableCell>{carton.weightStatus ? <StatusChip status={carton.weightStatus} /> : '—'}</TableCell>
                    <TableCell>{row.items?.filter((item) => item.status === 'PASS').length || 0}</TableCell>
                    <TableCell>{row.events?.length || 0}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {admin ? <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                        {po.sku ? <Button size="small" color="warning" startIcon={<RestartAlt />} disabled={busy} onClick={() => runException(
                          (why) => resetLululemonPoSku(orderId, po.id, why),
                          `Reason for resetting SKU of PO ${po.poNumber}:`,
                          `PO ${po.poNumber} SKU and unfinalized scans were reset.`
                        )}>Reset SKU</Button> : null}
                        {carton.id && ['FINISHED', 'LABEL_CONFIRMED'].includes(carton.status) && !carton.sscc18 ? <Button size="small" startIcon={<Undo />} disabled={busy} onClick={() => runException(
                          (why) => reopenLululemonCarton(orderId, carton.id, why),
                          `Reason for re-opening carton ${carton.cartonNo}:`,
                          `Carton ${carton.cartonNo} re-opened.`
                        )}>Re-open</Button> : null}
                        {carton.id && (carton.sscc18 || carton.sscc) ? <Button size="small" color="error" startIcon={<LinkOff />} disabled={busy} onClick={() => runException(
                          (why) => unassignLululemonSscc(orderId, carton.id, why),
                          `Reason for unassigning SSCC from carton ${carton.cartonNo}:`,
                          `SSCC was unassigned from carton ${carton.cartonNo}.`
                        )}>Unassign SSCC</Button> : null}
                      </Stack> : 'View only'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length ? <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>Search to view trace history.</TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </TableContainer>
      </Paper>

      {selected ? <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={800}>Trace detail · PO {selected.po?.poNumber || '—'} · Carton {selected.carton?.cartonNo || '—'}</Typography>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 0.5 }}>Item Scan History</Typography>
        <TableContainer sx={{ maxHeight: 280 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow><TableCell>Item</TableCell><TableCell>Status</TableCell><TableCell>SKU</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead>
            <TableBody>
              {(selected.items || []).map((item) => <TableRow key={item.id}><TableCell>{item.itemNo}</TableCell><TableCell><StatusChip status={item.status} /></TableCell><TableCell>{item.scannedSku || '—'}</TableCell><TableCell>{item.scannedBy || '—'}</TableCell><TableCell>{item.scannedAt || '—'}</TableCell></TableRow>)}
              {!selected.items?.length ? <TableRow><TableCell colSpan={5} align="center">No generated/scanned items.</TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </TableContainer>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>Scan / Exception Events</Typography>
        <TableContainer sx={{ maxHeight: 280 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Result</TableCell><TableCell>Raw</TableCell><TableCell>Message</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead>
            <TableBody>
              {(selected.events || []).map((event) => <TableRow key={event.id}><TableCell>{event.scanType || '—'}</TableCell><TableCell><StatusChip status={event.result} /></TableCell><TableCell>{event.rawValue || event.raw || '—'}</TableCell><TableCell>{event.message || '—'}</TableCell><TableCell>{event.actor || '—'}</TableCell><TableCell>{event.createdAt || '—'}</TableCell></TableRow>)}
              {!selected.events?.length ? <TableRow><TableCell colSpan={6} align="center">No scan events.</TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </TableContainer>
        <Typography variant="subtitle2" fontWeight={750} sx={{ mt: 1.4, mb: 0.5 }}>Weighing History</Typography>
        <TableContainer sx={{ maxHeight: 280 }}>
          <SortableTable stickyHeader size="small">
            <TableHead><TableRow><TableCell>Action</TableCell><TableCell>Result</TableCell><TableCell>Expected kg</TableCell><TableCell>Actual kg</TableCell><TableCell>Difference kg</TableCell><TableCell>Tolerance kg</TableCell><TableCell>Station</TableCell><TableCell>Source</TableCell><TableCell>User</TableCell><TableCell>Time</TableCell></TableRow></TableHead>
            <TableBody>
              {(selected.weightEvents || []).map((event) => <TableRow key={event.id}><TableCell>{event.action || '—'}</TableCell><TableCell>{event.result ? <StatusChip status={event.result} /> : '—'}</TableCell><TableCell>{event.expectedWeightKg ?? '—'}</TableCell><TableCell>{event.actualWeightKg ?? '—'}</TableCell><TableCell>{event.differenceKg ?? '—'}</TableCell><TableCell>{event.toleranceKg ?? '—'}</TableCell><TableCell>{event.stationCode || '—'}</TableCell><TableCell>{event.source || '—'}</TableCell><TableCell>{event.userId || '—'}</TableCell><TableCell>{event.createdAt || '—'}</TableCell></TableRow>)}
              {!selected.weightEvents?.length ? <TableRow><TableCell colSpan={10} align="center">No weighing events.</TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </TableContainer>
      </Paper> : null}
    </Stack>
  );
}
