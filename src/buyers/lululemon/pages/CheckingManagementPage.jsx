import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Paper,
  Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography
} from '@mui/material';
import { ArrowBack, Close, QrCodeScanner, Refresh, Search } from '@mui/icons-material';
import { CompactPageHeader } from 'components/CompactPageHeader';
import TableFilterBar from 'components/TableFilterBar';
import { checkingSearch, checkingPoCartons } from '../services/service';
import { listManagedItems } from 'services/managementService';
import { BUYER_CODE } from '../../../constants/appConstants';
import { APP_MESSAGES } from '../../../constants/appMessages';

const SEARCH_MODES = {
  PO: { title: 'Search PO', label: 'PO number', placeholder: 'Enter PO number, e.g. 20627087' },
  SKU: { title: 'Scan SKU', label: 'SKU barcode', placeholder: 'Scan or enter SKU, then press Enter' },
  SSCC: { title: 'Scan SSCC', label: 'SSCC-18', placeholder: 'Scan SSCC-18, then press Enter' }
};
const DATE_FORMAT = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
const show = (value) => value === undefined || value === null || value === '' ? '—' : String(value);
const when = (value) => value ? new Date(value).toLocaleString(undefined, DATE_FORMAT) : '—';
const resultColor = (result) => result === 'PASS' ? 'success' : result === 'FAIL' ? 'error' : 'default';
const errorMessage = (error) => error?.response?.data?.message || error?.message || APP_MESSAGES.CHECKING_OPERATION_FAILED;
const ITEM_FILTER_DEFAULT = { itemNo: '', sku: '', style: '', color: '', sizeValue: '', status: '', scannedBy: '' };
const fromPoIfMissing = (value, poValue) => (value == null || String(value).trim() === '' ? poValue ?? null : value);

export default function CheckingManagementPage() {
  const [mode, setMode] = useState('PO');
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState({ pos: [], cartons: [], truncated: false });
  const [selectedId, setSelectedId] = useState('');
  const [activePo, setActivePo] = useState(null);
  const [poCartons, setPoCartons] = useState({ content: [], totalElements: 0 });
  const [poPage, setPoPage] = useState(0);
  const [poPageSize, setPoPageSize] = useState(25);
  const [poBusy, setPoBusy] = useState(false);
  const [poError, setPoError] = useState('');
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemPage, setItemPage] = useState(0);
  const [itemPageSize, setItemPageSize] = useState(25);
  const [itemData, setItemData] = useState({ content: [], totalElements: 0 });
  const [itemBusy, setItemBusy] = useState(false);
  const [itemError, setItemError] = useState('');
  const [itemFilters, setItemFilters] = useState(ITEM_FILTER_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const scannerInputRef = useRef(null);
  const lookupRef = useRef(0);
  const poRequestRef = useRef(0);
  const itemRequestRef = useRef(0);

  const rows = result.cartons || [];
  const visibleCartons = activePo ? poCartons.content : rows;
  const selected = useMemo(() => visibleCartons.find((row) => row.id === selectedId) || null, [visibleCartons, selectedId]);
  const checkedCount = rows.filter((row) => row.lastCheck).length;
  const identifiedCount = rows.filter((row) => row.identified).length;

  const resetDrilldown = () => {
    poRequestRef.current += 1;
    itemRequestRef.current += 1;
    setActivePo(null); setPoCartons({ content: [], totalElements: 0 });
    setPoPage(0); setPoError(''); setPoBusy(false);
    setItemsOpen(false); setItemData({ content: [], totalElements: 0 });
    setItemError(''); setItemBusy(false); setItemPage(0); setItemFilters(ITEM_FILTER_DEFAULT);
  };

  const resetSearch = () => {
    resetDrilldown();
    lookupRef.current += 1;
    setResult({ pos: [], cartons: [], truncated: false });
    setSelectedId(''); setPage(0); setSearched(false);
    setLoading(false); setNotice(null);
  };

  const changeMode = (_, next) => {
    if (!next || next === mode) return;
    setMode(next); setQuery(''); resetSearch();
    setTimeout(() => scannerInputRef.current?.focus(), 0);
  };

  const loadPoCartons = async (po, nextPage = 0, size = poPageSize) => {
    if (!po?.id) return;
    const token = ++poRequestRef.current;
    setPoBusy(true); setPoError(''); setPoPage(nextPage); setPoPageSize(size);
    try {
      const pageData = await checkingPoCartons(po.id, { page: nextPage, size });
      if (token !== poRequestRef.current) return;
      setPoCartons({ content: pageData?.content || [], totalElements: Number(pageData?.totalElements || 0) });
    } catch (error) {
      if (token !== poRequestRef.current) return;
      setPoCartons({ content: [], totalElements: 0 });
      setPoError(errorMessage(error));
    } finally {
      if (token === poRequestRef.current) setPoBusy(false);
    }
  };

  const openPo = (po) => {
    itemRequestRef.current += 1;
    setActivePo(po);
    setSelectedId('');
    setItemsOpen(false); setItemData({ content: [], totalElements: 0 }); setItemError(''); setItemFilters(ITEM_FILTER_DEFAULT);
    loadPoCartons(po, 0, poPageSize);
  };

  const openCarton = (carton) => {
    setSelectedId(carton.id); setItemPage(0); setNotice(null);
    setItemsOpen(true); setItemError(''); setItemData({ content: [], totalElements: 0 }); setItemFilters(ITEM_FILTER_DEFAULT);
    // The data still comes from Orders' actual CartonItem endpoint; no separate QC mock rows.
  };

  const closeCarton = () => {
    // Closing the popup does not reset search results, PO selection or carton pagination.
    itemRequestRef.current += 1;
    setItemsOpen(false); setSelectedId('');
    setItemError(''); setItemBusy(false);
  };

  const search = async (keepSelection = false) => {
    const target = query.trim();
    if (!target) return;
    const token = ++lookupRef.current;
    resetDrilldown();
    setLoading(true); setNotice(null);
    try {
      const response = await checkingSearch(mode, target);
      if (token !== lookupRef.current) return;
      const nextRows = Array.isArray(response?.cartons) ? response.cartons : [];
      setResult({ pos: response?.pos || [], cartons: nextRows, truncated: Boolean(response?.truncated) });
      setSearched(true); setPage(0);
      const nextId = keepSelection && nextRows.some((row) => row.id === selectedId) ? selectedId
        : mode === 'SSCC' && nextRows.length === 1 ? nextRows[0].id : '';
      setSelectedId(nextId);
      setItemsOpen(Boolean(nextId));
      if (!(response?.pos?.length || nextRows.length)) {
        setNotice({ severity: 'info', text: APP_MESSAGES.CHECKING_NOT_FOUND });
      }
    } catch (error) {
      if (token !== lookupRef.current) return;
      setResult({ pos: [], cartons: [], truncated: false });
      setSelectedId(''); setSearched(false);
      setNotice({ severity: 'error', text: errorMessage(error) });
    } finally {
      if (token === lookupRef.current) setLoading(false);
    }
  };

  // Load the real per-item rows from the SAME API as Orders > PO > Carton > Items.
  // That API generates item slots on first open, consistent with Orders' behaviour.
  useEffect(() => {
    if (!selected || !itemsOpen) { setItemBusy(false); return; }
    const token = ++itemRequestRef.current;
    setItemBusy(true); setItemError('');
    listManagedItems(BUYER_CODE.LULULEMON, selected.orderId, selected.id, { ...itemFilters, page: itemPage, size: itemPageSize })
      .then((data) => {
        if (token !== itemRequestRef.current) return;
        setItemData({ content: data?.content || [], totalElements: Number(data?.totalElements || 0) });
      })
      .catch((error) => {
        if (token !== itemRequestRef.current) return;
        setItemData({ content: [], totalElements: 0 });
        setItemError(errorMessage(error));
      })
      .finally(() => { if (token === itemRequestRef.current) setItemBusy(false); });
    return () => { itemRequestRef.current += 1; };
  }, [selected?.id, selected?.orderId, itemsOpen, itemPage, itemPageSize, itemFilters]);

  return (
    <Stack spacing={1} sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader dense title="Checking Management"
        subtitle="Search PO / SKU / SSCC → open PO cartons → view carton Items in a popup. No Order selection."
        meta={<Chip size="small" variant="outlined" label="LULULEMON · QC Checking" />}
      />
      <Alert severity="info" sx={{ py: 0.2 }}>Click a PO to view its cartons, then View Items to open the item list in a popup. No Order selection is needed.</Alert>
      {notice && !itemsOpen && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.2 }}>
        <Tabs value={mode} onChange={changeMode} variant="scrollable" scrollButtons="auto"
          sx={{ mb: 1, minHeight: 41, '& .MuiTab-root': { minHeight: 41, textTransform: 'none', fontWeight: 750 } }}>
          <Tab value="PO" label="Search PO" icon={<Search fontSize="small" />} iconPosition="start" />
          <Tab value="SKU" label="Scan SKU" icon={<QrCodeScanner fontSize="small" />} iconPosition="start" />
          <Tab value="SSCC" label="Scan SSCC" icon={<QrCodeScanner fontSize="small" />} iconPosition="start" />
        </Tabs>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <TextField
            inputRef={scannerInputRef} autoFocus fullWidth size="small" label={SEARCH_MODES[mode].label}
            value={query} onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(); } }}
            placeholder={SEARCH_MODES[mode].placeholder} inputProps={{ autoComplete: 'off' }}
            helperText={mode === 'PO' ? 'Exact PO number across all LULULEMON Orders. Click a matching PO below to view its complete, paginated carton list.' : 'Scan directly with a USB/Bluetooth scanner (Enter suffix); no Order selection needed.'}
          />
          <Button variant="contained" startIcon={<Search />} disabled={!query.trim() || loading} onClick={() => search()} sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>
            {loading ? 'Searching...' : 'Search / Check'}
          </Button>
          <Button variant="outlined" startIcon={<Refresh />} disabled={!query.trim() || loading} onClick={() => activePo ? loadPoCartons(activePo, poPage, poPageSize) : search(true)} sx={{ alignSelf: 'flex-start' }}>Refresh</Button>
        </Stack>
      </Paper>

      {searched && <>
        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip size="small" label={`${result.pos.length} PO line(s)`} />
          {!activePo && <Chip size="small" label={`${rows.length} matching carton(s)`} />}
          {activePo && <Chip size="small" label={`${poCartons.totalElements} carton(s) in selected PO`} />}
          {!activePo && <Chip size="small" color="success" variant="outlined" label={`${identifiedCount} identified in matches`} />}
          {!activePo && <Chip size="small" color="info" variant="outlined" label={`${checkedCount} QC checked in matches`} />}
          {!activePo && mode !== 'SSCC' && rows.some((row) => row.identified && !row.lastCheck) &&
            <Button size="small" variant="outlined" disabled={loading}
              onClick={() => {
                const candidates = rows.filter((row) => row.identified && !row.lastCheck);
                const choice = candidates[Math.floor(Math.random() * candidates.length)];
                if (!choice) return;
                openCarton(choice);
                setPage(Math.floor(rows.findIndex((row) => row.id === choice.id) / rowsPerPage));
              }}>Pick random unchecked carton</Button>}
        </Stack>
        {result.truncated && !activePo && <Alert severity="warning">Search results show up to 200 cartons. Click a PO to browse every carton with pagination.</Alert>}

        {!activePo && result.pos.length > 0 && <Paper variant="outlined" sx={{ p: 1.1, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.6 }}>Purchase Orders — select a PO to see its cartons</Typography>
          <TableContainer sx={{ maxHeight: 300 }}><Table size="small" stickyHeader><TableHead><TableRow>
            {['Order', 'PO', 'Style', 'Color', 'Size', 'Assigned SKU', 'Planned cartons', 'Open'].map((field) => <TableCell key={field} sx={{ fontWeight: 750 }}>{field}</TableCell>)}
          </TableRow></TableHead><TableBody>{result.pos.map((po) => <TableRow key={po.id} hover sx={{ cursor: 'pointer' }} onClick={() => openPo(po)}>
            <TableCell>{show(po.orderName || po.orderId)}</TableCell>
            <TableCell><Button size="small" sx={{ p: 0, minWidth: 0 }} onClick={(e) => { e.stopPropagation(); openPo(po); }}>{show(po.poNumber)}</Button></TableCell>
            <TableCell>{show(po.style)}</TableCell><TableCell>{show(po.color)}</TableCell>
            <TableCell>{show(po.size)}</TableCell><TableCell>{show(po.sku)}</TableCell><TableCell>{show(po.plannedCartons)}</TableCell>
            <TableCell><Button size="small" onClick={(e) => { e.stopPropagation(); openPo(po); }}>View Cartons</Button></TableCell>
          </TableRow>)}</TableBody></Table></TableContainer>
          {!rows.length && <Alert severity="info" sx={{ mt: 1 }}>PO found. Open it to view existing cartons. Checking does not create cartons.</Alert>}
        </Paper>}

        {activePo && <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ p: 1.1 }}>
            <Button size="small" startIcon={<ArrowBack />} onClick={() => {
              poRequestRef.current += 1; itemRequestRef.current += 1;
              setActivePo(null); setSelectedId(''); setItemsOpen(false);
            }}>PO Results</Button>
            <Typography fontWeight={750} variant="subtitle2">PO {show(activePo.poNumber)} · {show(activePo.orderName || activePo.orderId)} · Cartons</Typography>
            <Chip size="small" variant="outlined" label={`Style ${show(activePo.style)} / Color ${show(activePo.color)} / Size ${show(activePo.size)}`} />
          </Stack>
          {poError && <Alert severity="error">{poError}</Alert>}
          {poBusy && <Typography color="text.secondary" variant="body2" sx={{ px: 1.2 }}>Loading cartons...</Typography>}
          {!poBusy && !poError && poCartons.totalElements === 0 && <Alert severity="info">This PO has no generated cartons yet. Open it in Packing / Orders to generate cartons. Checking only reads existing cartons.</Alert>}
          <TableContainer><Table size="small"><TableHead><TableRow>
            {['Carton', 'SSCC-18', 'SKU', 'Target Qty', 'Packing', 'QC result', 'Action'].map((field) => <TableCell key={field} sx={{ fontWeight: 750 }}>{field}</TableCell>)}
          </TableRow></TableHead><TableBody>
            {poCartons.content.map((carton) => <TableRow key={carton.id} selected={selectedId === carton.id} hover
              sx={{ cursor: 'pointer' }} onClick={() => openCarton(carton)}>
              <TableCell><Button sx={{ p: 0, minWidth: 0 }} size="small" onClick={(e) => { e.stopPropagation(); openCarton(carton); }}>Carton {show(carton.cartonNo)}</Button></TableCell>
              <TableCell>{show(carton.sscc18)}</TableCell><TableCell>{show(carton.sku)}</TableCell>
              <TableCell>{show(carton.plannedQty)}</TableCell>
              <TableCell><Chip size="small" color={carton.identified ? 'success' : 'warning'} label={carton.identified ? 'Identified' : 'Not identified'} variant="outlined" /></TableCell>
              <TableCell><Chip size="small" color={resultColor(carton.lastCheck)} label={carton.lastCheck || 'Not checked'} variant={carton.lastCheck ? 'filled' : 'outlined'} /></TableCell>
              <TableCell><Button size="small" variant={selectedId === carton.id ? 'contained' : 'outlined'} onClick={(e) => { e.stopPropagation(); openCarton(carton); }}>View Items</Button></TableCell>
            </TableRow>)}
          </TableBody></Table></TableContainer>
          <TablePagination component="div" count={poCartons.totalElements} page={poPage}
            onPageChange={(_, value) => { setSelectedId(''); setItemsOpen(false); loadPoCartons(activePo, value, poPageSize); }} rowsPerPage={poPageSize}
            onRowsPerPageChange={(event) => { setSelectedId(''); setItemsOpen(false); loadPoCartons(activePo, 0, Number(event.target.value)); }} rowsPerPageOptions={[10, 25, 50, 100]} />
        </Paper>}

        {!activePo && mode !== 'PO' && rows.length > 0 && <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 1.1 }}><Typography variant="subtitle2">Matching Cartons — click to view Items</Typography></Box>
          <TableContainer><Table size="small" sx={{ '& .MuiTableCell-root': { whiteSpace: 'nowrap' } }}>
            <TableHead><TableRow>
              {['Order', 'PO', 'Carton', 'SSCC-18', 'SKU', 'Qty', 'Packing', 'QC result', 'Action'].map((field) => <TableCell key={field} sx={{ fontWeight: 750 }}>{field}</TableCell>)}
            </TableRow></TableHead><TableBody>
              {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((carton) =>
                <TableRow key={carton.id} selected={selectedId === carton.id} hover sx={{ cursor: 'pointer' }} onClick={() => openCarton(carton)}>
                  <TableCell>{show(carton.orderName || carton.orderId)}</TableCell>
                  <TableCell>{show(carton.poNumber)}</TableCell>
                  <TableCell><Button size="small" sx={{ p: 0, minWidth: 0 }} onClick={(e) => { e.stopPropagation(); openCarton(carton); }}>{show(carton.cartonNo)}</Button></TableCell>
                  <TableCell>{show(carton.sscc18)}</TableCell>
                  <TableCell>{show(carton.sku)}</TableCell>
                  <TableCell>{show(carton.plannedQty)}</TableCell>
                  <TableCell><Chip size="small" color={carton.identified ? 'success' : 'warning'} label={carton.identified ? 'Identified' : 'Not identified'} variant="outlined" /></TableCell>
                  <TableCell><Chip size="small" color={resultColor(carton.lastCheck)} label={carton.lastCheck || 'Not checked'} variant={carton.lastCheck ? 'filled' : 'outlined'} /></TableCell>
                  <TableCell><Button size="small" variant={selectedId === carton.id ? 'contained' : 'outlined'} onClick={(e) => { e.stopPropagation(); openCarton(carton); }}>
                    {selectedId === carton.id ? 'Viewing' : 'View Items'}
                  </Button></TableCell>
                </TableRow>)}
            </TableBody></Table></TableContainer>
            <TablePagination component="div" count={rows.length} page={page} onPageChange={(_, value) => { setPage(value); setSelectedId(''); setItemsOpen(false); }} rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); setSelectedId(''); setItemsOpen(false); }} rowsPerPageOptions={[10, 25, 50]} />
        </Paper>}
      </>}

      <Dialog
        open={Boolean(selected && itemsOpen)}
        onClose={() => closeCarton()}
        fullWidth maxWidth="xl" scroll="paper"
        aria-labelledby="checking-carton-dialog-title"
        PaperProps={{ sx: {
          width: { xs: 'calc(100vw - 16px)', sm: '96vw' },
          maxWidth: '1500px', maxHeight: 'calc(100dvh - 24px)',
          borderRadius: 2, overflow: 'hidden'
        } }}
      >
      {selected && <>
        <DialogTitle id="checking-carton-dialog-title" sx={{ px: 2, py: 1.2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={750} variant="subtitle1">PO {show(selected.poNumber)} · Carton {show(selected.cartonNo)} — Items</Typography>
              <Typography variant="caption" color="text.secondary">{show(selected.orderName || selected.orderId)}</Typography>
            </Box>
            <IconButton aria-label="Close carton details" onClick={closeCarton} size="small"><Close /></IconButton>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.7} sx={{ mt: 0.8 }}>
            <Chip size="small" variant="outlined" label={`${itemData.totalElements} item(s)`} />
            <Chip size="small" variant="outlined" label={`Target ${show(selected.plannedQty)}`} />
            <Chip size="small" variant="outlined" label={`SSCC ${show(selected.sscc18)}`} />
            <Chip size="small" color={selected.identified ? 'success' : 'warning'} variant="outlined" label={selected.identified ? 'Identified' : 'Not identified'} />
            <Chip size="small" color={resultColor(selected.lastCheck)} variant="outlined" label={`QC ${selected.lastCheck || 'Not checked'}`} />
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent dividers sx={{ p: { xs: 1, md: 1.5 } }}>
        <Stack spacing={1.5}>
        {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Carton Items</Typography>
        {itemError && <Alert severity="error">{itemError}</Alert>}
        <Box sx={{ pb: 0.6 }}>
          <TableFilterBar
            fields={[
              { key: 'itemNo', label: 'Item No.' }, { key: 'sku', label: 'SKU' },
              { key: 'style', label: 'Style' }, { key: 'color', label: 'Color' },
              { key: 'sizeValue', label: 'Size' }, { key: 'status', label: 'Status' },
              { key: 'scannedBy', label: 'Scanned By' }
            ]}
            values={itemFilters}
            onChange={(key, value) => { setItemFilters((current) => ({ ...current, [key]: value })); setItemPage(0); }}
            onClear={() => { setItemFilters(ITEM_FILTER_DEFAULT); setItemPage(0); }}
            disabled={itemBusy}
          />
        </Box>
        {itemBusy && <Typography sx={{ px: 1.2 }} color="text.secondary" variant="body2">Loading item list...</Typography>}
        <TableContainer sx={{ maxHeight: 420, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><Table size="small" stickyHeader>
          <TableHead><TableRow>
            {['STT', 'Item No.', 'Scanned SKU', 'Style', 'Color', 'Size', 'Qty', 'Status', 'Scanned By', 'Scanned At'].map((label) =>
              <TableCell key={label} sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>{label}</TableCell>)}
          </TableRow></TableHead><TableBody>
            {itemData.content.map((item, i) => <TableRow key={item.id || `${item.itemNo}-${i}`} hover>
              <TableCell>{itemPage * itemPageSize + i + 1}</TableCell>
              <TableCell>{show(item.itemNo)}</TableCell><TableCell>{show(item.sku)}</TableCell>
              <TableCell>{show(fromPoIfMissing(item.style, selected.style))}</TableCell>
              <TableCell>{show(fromPoIfMissing(item.color, selected.color))}</TableCell><TableCell>{show(fromPoIfMissing(item.size, selected.size))}</TableCell>
              <TableCell>{show(item.quantity)}</TableCell>
              <TableCell><Chip size="small" variant="outlined" color={['PASS', 'IDENTIFIED', 'SCANNED'].includes(item.status) ? 'success' : 'default'} label={show(item.status)} /></TableCell>
              <TableCell>{show(item.scannedBy)}</TableCell><TableCell>{when(item.scannedAt)}</TableCell>
            </TableRow>)}
          </TableBody></Table></TableContainer>
        <TablePagination component="div" count={itemData.totalElements} page={itemPage} onPageChange={(_, value) => setItemPage(value)}
          rowsPerPage={itemPageSize} onRowsPerPageChange={(event) => { setItemPageSize(Number(event.target.value)); setItemPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]} />
        </Box>


        </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1 }}>
          <Button variant="outlined" onClick={closeCarton}>Close</Button>
        </DialogActions>
      </>}
      </Dialog>
    </Stack>
  );
}
