import SortableTable from 'components/SortableTable';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, MenuItem, Paper, Stack,  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { getAccessibleBuyers } from 'utils/buyerAccess';
import { readStoredUser } from 'utils/accessControl';
import { packingInbox, dispatchPackingShipment } from 'buyers/es/services/shipmentService';
import { DEFAULT_TABLE_PAGE_SIZE, SHIPMENT_STATUS } from '../../../../constants/appConstants';
import { APP_MESSAGES, createDispatchShipmentConfirmMessage } from '../../../../constants/appMessages';
const message = (e) => e?.response?.data?.message || e.message || APP_MESSAGES.LOAD_SHIPMENT_PLANS_FAILED;
export default function PackingShipmentInboxPage() {
  const buyers = useMemo(() => getAccessibleBuyers(readStoredUser()), []);
  const [buyerCode, setBuyerCode] = useState(buyers[0]?.code || '');
  const buyer = buyers.find((b) => b.code === buyerCode);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!buyerCode || busy) return undefined;
    let active = true, inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try { const result = await packingInbox(buyerCode, { page, size: DEFAULT_TABLE_PAGE_SIZE }); if (active) { setData(result); setError(''); } }
      catch (e) { if (active) setError(message(e)); }
      finally { inFlight = false; if (active) setLoading(false); }
    };
    setLoading(true); load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [buyerCode, page, busy, revision]);
  const dispatch = async (row) => {
    if (!window.confirm(createDispatchShipmentConfirmMessage(row.shipmentNo))) return;
    setBusy(true); setError('');
    try { await dispatchPackingShipment(buyerCode, row.id); setRevision((n) => n + 1); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  };
  return <Stack spacing={2}>
    <Typography variant="h4">Packing · Weight Check & Dispatch</Typography>
    <Typography color="text.secondary">Sales Shipment Plans refresh automatically every 5 seconds. Packing opens a Sales plan, scans assigned Factory Barcodes, weighs cartons by PLC, then confirms dispatch.</Typography>
    {!buyer && <Alert severity="warning">{APP_MESSAGES.NO_BUYER_ACCESS}</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField select label="Buyer" size="small" value={buyerCode} disabled={busy} sx={{ minWidth: 220 }} onChange={(e) => { setBuyerCode(e.target.value); setPage(0); setData({ content: [], totalElements: 0 }); }}>
        {buyers.map((b) => <MenuItem key={b.code} value={b.code}>{b.label}</MenuItem>)}
      </TextField><Button onClick={() => setRevision((n) => n + 1)} disabled={busy || !buyer}>Refresh</Button>{loading && buyer && <CircularProgress size={20} />}
    </Stack>
    <TableContainer component={Paper}><SortableTable size="small" rowNumberStart={page * DEFAULT_TABLE_PAGE_SIZE}><TableHead><TableRow>
      {['Shipment', 'Planned Date / Destination', 'Status', 'Weighed', 'Completed', 'Failed', 'Actions'].map((label) => <TableCell key={label}>{label}</TableCell>)}
    </TableRow></TableHead><TableBody>
      {!loading && !data.content.length && <TableRow><TableCell colSpan={7}>No shipment plans yet. Sales must create a Shipment Plan before Packing can start.</TableCell></TableRow>}
      {data.content.map(({ shipment: row, planned, checked, completed, failed }) => <TableRow key={row.id}>
        <TableCell>{row.shipmentNo}</TableCell><TableCell>{row.plannedDate}<br />{row.destination}</TableCell>
        <TableCell><Chip size="small" label={row.status} /></TableCell><TableCell>{checked}/{planned}</TableCell><TableCell>{completed}/{planned}</TableCell><TableCell>{failed}</TableCell>
        <TableCell><Stack direction="row" spacing={1}>
          <Button component={Link} to={`/packing/shipments/${buyer?.slug}/${row.id}`} disabled={busy || loading || Boolean(error) || row.status === SHIPMENT_STATUS.PREPARING} variant="contained">{row.status === SHIPMENT_STATUS.PLANNED ? 'Open & Weigh by PLC' : 'View Results'}</Button>
          {[SHIPMENT_STATUS.PLANNED, SHIPMENT_STATUS.DISPATCHING].includes(row.status) && <Button onClick={() => dispatch(row)} disabled={busy || loading || Boolean(error) || !planned || completed !== planned || failed > 0}>{row.status === SHIPMENT_STATUS.DISPATCHING ? 'Resume Dispatch' : 'Confirm Dispatch'}</Button>}
        </Stack></TableCell>
      </TableRow>)}
    </TableBody></SortableTable></TableContainer>
    <TablePagination component="div" count={data.totalElements} page={page} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_, next) => setPage(next)} />
  </Stack>;
}
