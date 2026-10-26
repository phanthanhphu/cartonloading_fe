import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Refresh, UploadFile } from '@mui/icons-material';
import { listManagedOrders } from 'services/managementService';
import { BUYER_CODE } from '../../../constants/appConstants';
import { listFactoryPackingImports, importFactoryPacking } from '../services/cartonProcessing';

const messageOf = (e) => e?.response?.data?.message || e?.message || 'Import failed.';

/** Embedded Orders tab: Packing SSCC mapping is tied to the selected Factory. */
export default function PackingImportPage({ factoryCode }) {
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState('');
  const [file, setFile] = useState(null);
  const [batches, setBatches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async (factory) => {
    if (!factory) { setBatches([]); return; }
    const result = await listFactoryPackingImports(factory);
    setBatches(Array.isArray(result) ? result : []);
  }, []);
  useEffect(() => {
    setOrderId(''); setFile(null); setBatches([]); setError(''); setNotice('');
    if (!factoryCode) return;
    load(factoryCode).catch((e) => setError(messageOf(e)));
    // Only Order identities owned by the current Factory are offered.
    const fetchOrders = async () => {
      let page = 0;
      const rows = [];
      while (true) {
        const result = await listManagedOrders(BUYER_CODE.LULULEMON, { factory: factoryCode, page, size: 100 });
        rows.push(...(result?.content || []));
        if (result?.last || page + 1 >= Number(result?.totalPages || 0) || !(result?.content || []).length) break;
        page++;
      }
      setOrders(rows);
    };
    fetchOrders().catch((e) => setError(messageOf(e)));
  }, [factoryCode, load]);
  const submit = async () => {
    if (!orderId || !factoryCode || !file || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await importFactoryPacking(orderId, factoryCode, file);
      setNotice(`Imported ${result.rowCount} carton identities for Factory ${result.factoryCode}.`);
      setFile(null);
      await load(factoryCode);
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  };
  return <Box sx={{ px: { xs: 1, md: 2 }, py: 1.5 }}>
    <Typography variant="h6" fontWeight={850}>Optional SSCC Mapping Import</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      Optional bulk pre-assignment of SSCC + SKU to a selected Factory. With your All_BP file, you can instead open a PO and scan SSCC + SKU directly to assign the next pending carton (FIFO). No PO Picking.
    </Typography>
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}
    {notice && <Alert severity="success" onClose={() => setNotice('')} sx={{ mb: 1 }}>{notice}</Alert>}
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 1.5 }}>
      <Stack spacing={1.4}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
          <TextField label="Factory" size="small" value={factoryCode || ''} disabled sx={{ minWidth: 140 }}/>
          <TextField label="Order" select size="small" value={orderId} onChange={(e) => setOrderId(e.target.value)}
            disabled={busy || !factoryCode} sx={{ minWidth: 230, flex: 1 }}>
            <MenuItem value="">Select an Order</MenuItem>
            {orders.map((order) => <MenuItem key={order.id} value={order.id}>{order.orderName}</MenuItem>)}
          </TextField>
        </Stack>
        {!orders.length && <Alert severity="warning">No Orders in this Factory yet. Create an Order and import ALL_BP first.</Alert>}
        <Alert severity="info">
          File Excel (.xlsx/.xls), first sheet. Required columns: <strong>PO, Carton No, SSCC, SKU</strong>.
          If PO Number repeats in one Order/Factory, add <strong>Master PO, Packing Plan, SO (PTS)</strong> to identify the exact ALL_BP PO.
          Import ALL_BP/Orders first to establish the authoritative carton count and expected weight.
        </Alert>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
          <Button variant="outlined" component="label" startIcon={<UploadFile />} disabled={busy}>
            Choose Packing File<input hidden type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)}/>
          </Button>
          <Typography variant="body2">{file ? file.name : 'No file selected'}</Typography>
          <Box sx={{ flex: 1 }}/>
          <Button variant="contained" disabled={!file || !factoryCode || !orderId || busy} onClick={submit}>
            {busy ? 'Importing…' : 'Import into Factory'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={800}>Packing Import Batches</Typography>
        <Stack direction="row" gap={1}><Chip variant="outlined" label={`${batches.length} files · ${factoryCode || 'No Factory'}`}/>
          <Button size="small" startIcon={<Refresh />} onClick={() => load(factoryCode).catch((e) => setError(messageOf(e)))}>Refresh</Button></Stack>
      </Stack>
      <TableContainer><Table size="small">
        <TableHead><TableRow><TableCell>STT</TableCell><TableCell>File</TableCell><TableCell>Factory</TableCell><TableCell>Order</TableCell><TableCell>Cartons</TableCell><TableCell>Imported By</TableCell><TableCell>Time</TableCell></TableRow></TableHead>
        <TableBody>{batches.map((row, i) => <TableRow key={row.id}>
          <TableCell>{i + 1}</TableCell><TableCell>{row.sourceFileName}</TableCell><TableCell>{row.factoryCode}</TableCell>
          <TableCell>{row.orderId}</TableCell><TableCell>{row.rowCount}</TableCell><TableCell>{row.importedBy}</TableCell><TableCell>{row.importedAt || '—'}</TableCell>
        </TableRow>)}
        {!batches.length && <TableRow><TableCell colSpan={7} align="center">No Packing imports for this Factory.</TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>
    </Paper>
  </Box>;
}
