import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ArrowBackRounded,
  CancelOutlined,
  DeleteOutlineRounded,
  MoveToInboxOutlined,
  RefreshRounded,
  SendRounded,
  VisibilityOutlined,
  PlayArrowRounded,
  TaskAltRounded
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { buyerPath } from 'utils/buyerAccess';
import { CompactPageHeader } from 'components/CompactPageHeader';
import OrderScope from '../components/OrderScope';
import StatusChip from '../components/StatusChip';
import {
  cancelPrintRequest,
  createPrintRequest,
  deletePrintRequest,
  listAllPos,
  listPrintRequests,
  updatePrintRequestStatus
} from '../services/service';
import { canAssignBarcode, canManageSales, canPrintRoom, readStoredUser } from 'utils/accessControl';
import { APP_MESSAGES, createCancelHandoffConfirmMessage, createDeleteHandoffConfirmMessage, createHandoffCancelledMessage, createHandoffDeletedMessage, createHandoffSentMessage, createHandoffSingleFactoryMessage } from '../../../constants/appMessages';

import { BUYER_CODE, LARGE_PAGE_SIZE_OPTIONS, PRINT_REQUEST_STATUS, PURCHASE_ORDER_STATUS, DEFAULT_TABLE_PAGE_SIZE, DEFAULT_TABLE_ROWS_PER_PAGE } from '../../../constants/appConstants';
const clean = (value) => String(value || '').trim().toLowerCase();
const contains = (value, needle) => !needle || clean(value).includes(clean(needle));
const fmtDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ');
  return date.toLocaleString();
};
const isActiveHandoff = (status) => [PRINT_REQUEST_STATUS.SENT, PRINT_REQUEST_STATUS.PENDING, PRINT_REQUEST_STATUS.PRINTING].includes(String(status || '').toUpperCase());
const isDeletableHandoff = (status) => [PRINT_REQUEST_STATUS.SENT, PRINT_REQUEST_STATUS.PENDING].includes(String(status || '').toUpperCase());

export default function PrintRequestsPage() {
  const navigate = useNavigate();
  const printRoomUser = canPrintRoom();
  const packingUser = canAssignBarcode() || canManageSales();
  const salesUser = canManageSales();
  const currentUser = readStoredUser();
  const currentEmail = String(currentUser?.email || '').toLowerCase();

  const [mode, setMode] = useState(printRoomUser && !packingUser ? 'received' : 'send');
  const [orderId, setOrderId] = useState('');
  const [pos, setPos] = useState([]);
  const [poLoading, setPoLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState('');
  const [poFilters, setPoFilters] = useState({ po: '', factory: '', style: '', sku: '', status: '' });
  const [poPage, setPoPage] = useState(0);
  const [poSize, setPoSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  const [queue, setQueue] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [queueFilters, setQueueFilters] = useState({ requestNo: '', packingUser: '', factoryCode: '', poNumber: '' });
  const [debouncedQueueFilters, setDebouncedQueueFilters] = useState(queueFilters);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadPos = useCallback(async () => {
    if (!orderId || !packingUser) { setPos([]); return; }
    setPoLoading(true);
    try {
      const rows = await listAllPos(orderId);
      setPos(rows || []);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.LOAD_PURCHASE_ORDERS_FAILED });
      setPos([]);
    } finally { setPoLoading(false); }
  }, [orderId, packingUser]);

  useEffect(() => {
    setSelected(new Set());
    setPoPage(0);
    loadPos();
  }, [orderId, loadPos]);

  const loadQueue = useCallback(async (page = queue.page, size = queue.size) => {
    setQueue((s) => ({ ...s, loading: true }));
    try {
      const result = await listPrintRequests({
        ...debouncedQueueFilters,
        mine: mode === 'send' ? true : undefined,
        page,
        size
      });
      setQueue({ rows: result?.content || [], count: Number(result?.totalElements || 0), page, size, loading: false });
    } catch (error) {
      setQueue((s) => ({ ...s, loading: false }));
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.LOAD_PO_HANDOFFS_FAILED });
    }
  }, [queue.page, queue.size, debouncedQueueFilters, mode]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQueueFilters(queueFilters), 300);
    return () => window.clearTimeout(timer);
  }, [queueFilters]);

  useEffect(() => { loadQueue(0, queue.size); }, [debouncedQueueFilters, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPos = useMemo(() => pos.filter((row) =>
    contains(row.poNumber, poFilters.po)
      && contains(row.factoryCode, poFilters.factory)
      && contains(row.styleNumber || row.style, poFilters.style)
      && contains(row.sku, poFilters.sku)
      && contains(row.status, poFilters.status)
  ), [pos, poFilters]);

  const pagedPos = useMemo(() => filteredPos.slice(poPage * poSize, poPage * poSize + poSize), [filteredPos, poPage, poSize]);
  const selectedFactory = useMemo(() => {
    const firstId = [...selected][0];
    return firstId ? (pos.find((row) => row.id === firstId)?.factoryCode || '') : '';
  }, [selected, pos]);
  const visibleIds = pagedPos.filter((row) => !selectedFactory || row.factoryCode === selectedFactory).map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const togglePo = (id) => {
    const row = pos.find((item) => item.id === id);
    if (!row) return;
    if (!selected.has(id) && selectedFactory && row.factoryCode !== selectedFactory) {
      setNotice({ severity: 'warning', text: createHandoffSingleFactoryMessage(selectedFactory, row.factoryCode) });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleVisible = () => {
    if (!selectedFactory) {
      const factories = [...new Set(pagedPos.map((row) => row.factoryCode).filter(Boolean))];
      if (factories.length > 1) {
        setNotice({ severity: 'info', text: APP_MESSAGES.FILTER_SINGLE_FACTORY });
        return;
      }
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const send = async () => {
    if (!orderId || !selected.size || busy) return;
    setBusy(true);
    try {
      const created = await createPrintRequest(orderId, [...selected], note);
      setSelected(new Set());
      setNote('');
      setNotice({ severity: 'success', text: createHandoffSentMessage(created.requestNo, created.poCount) });
      await loadQueue(0, queue.size);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.SEND_PO_LIST_FAILED });
    } finally { setBusy(false); }
  };

  const updatePrintStatus = async (row, status) => {
    if (!row?.id || busy) return;
    setBusy(true);
    try {
      await updatePrintRequestStatus(row.id, status);
      setNotice({ severity: 'success', text: status === PRINT_REQUEST_STATUS.PRINTING ? `Print Request ${row.requestNo} is now PRINTING.` : `Print Request ${row.requestNo}: PRINTED & SENT TO PACKING.` });
      await loadQueue(queue.page, queue.size);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || 'Unable to update Print Request status.' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (row) => {
    if (busy || !window.confirm(createCancelHandoffConfirmMessage(row.requestNo))) return;
    setBusy(true);
    try {
      await cancelPrintRequest(row.id);
      setNotice({ severity: 'info', text: createHandoffCancelledMessage(row.requestNo) });
      await loadQueue(queue.page, queue.size);
      if (dialog?.id === row.id) setDialog(null);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message });
    } finally { setBusy(false); }
  };

  const deleteRequest = async (row) => {
    if (!row?.id || busy || !window.confirm(createDeleteHandoffConfirmMessage(row.requestNo))) return;
    setBusy(true);
    try {
      await deletePrintRequest(row.id);
      setNotice({ severity: 'success', text: createHandoffDeletedMessage(row.requestNo) });
      if (dialog?.id === row.id) setDialog(null);
      await Promise.all([
        loadQueue(queue.page, queue.size),
        orderId && packingUser ? loadPos() : Promise.resolve()
      ]);
    } catch (error) {
      setNotice({ severity: 'error', text: error?.response?.data?.message || error.message || APP_MESSAGES.DELETE_PRINT_REQUEST_FAILED });
    } finally { setBusy(false); }
  };

  return (
    <Stack spacing={0.9}>
      <CompactPageHeader
        dense
        title="Print Request"
        subtitle={APP_MESSAGES.PRINT_LIST_PAGE_SUBTITLE}
        meta={<Chip size="small" label={BUYER_CODE.LULULEMON} variant="outlined" sx={{ fontWeight: 750 }} />}
        actions={
          <Stack direction="row" spacing={0.5}>
            <Button size="small" variant="outlined" startIcon={<ArrowBackRounded />} onClick={() => navigate(buyerPath(BUYER_CODE.LULULEMON, 'packing'))}>Back</Button>
            <Tooltip title="Refresh"><span><IconButton size="small" onClick={() => loadQueue(queue.page, queue.size)} disabled={queue.loading}><RefreshRounded fontSize="small" /></IconButton></span></Tooltip>
          </Stack>
        }
      />

      {(packingUser && (printRoomUser || salesUser)) && (
        <Paper variant="outlined" sx={{ p: 0.75, borderRadius: 2.2 }}>
          <Stack direction="row" spacing={0.5}>
            <Button size="small" variant={mode === 'send' ? 'contained' : 'text'} startIcon={<SendRounded />} onClick={() => setMode('send')}>Send PO List</Button>
            <Button size="small" variant={mode === 'received' ? 'contained' : 'text'} startIcon={<MoveToInboxOutlined />} onClick={() => setMode('received')}>Received PO Lists</Button>
          </Stack>
        </Paper>
      )}

      {notice && <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      {mode === 'send' && packingUser ? (
        <>
          <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 2 }}>
            <Stack spacing={0.7}>
              <Box>
                <Typography variant="subtitle2" fontWeight={850}>1. Select Order</Typography>
                <Typography variant="caption" color="text.secondary">Select the Order that contains the POs you want to send.</Typography>
              </Box>
              <OrderScope value={orderId} onChange={setOrderId} embedded compact disabled={busy} />
            </Stack>
          </Paper>

          {orderId ? (
            <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2.2 }}>
              <Box sx={{ px: 1.25, py: 1, bgcolor: '#FBFCFE', borderBottom: '1px solid #E4EAF0' }}>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.75} alignItems={{ lg: 'center' }}>
                  <Box sx={{ minWidth: 190 }}>
                    <Typography variant="subtitle2" fontWeight={850}>2. Select Purchase Orders</Typography>
                    <Typography variant="caption" color="text.secondary">{selected.size} selected · {filteredPos.length} matching{selectedFactory ? ` · Factory ${selectedFactory}` : ''}</Typography>
                  </Box>
                  <TextField size="small" placeholder="PO No." value={poFilters.po} onChange={(e) => { setPoFilters((s) => ({ ...s, po: e.target.value })); setPoPage(0); }} sx={{ width: { xs: '100%', lg: 150 } }} />
                  <TextField size="small" placeholder="Factory" value={poFilters.factory} onChange={(e) => { setPoFilters((s) => ({ ...s, factory: e.target.value })); setPoPage(0); }} sx={{ width: { xs: '100%', lg: 130 } }} />
                  <TextField size="small" placeholder="Style" value={poFilters.style} onChange={(e) => { setPoFilters((s) => ({ ...s, style: e.target.value })); setPoPage(0); }} sx={{ width: { xs: '100%', lg: 160 } }} />
                  <TextField size="small" placeholder="SKU" value={poFilters.sku} onChange={(e) => { setPoFilters((s) => ({ ...s, sku: e.target.value })); setPoPage(0); }} sx={{ width: { xs: '100%', lg: 170 } }} />
                  <TextField select size="small" label="Status" value={poFilters.status} onChange={(e) => { setPoFilters((s) => ({ ...s, status: e.target.value })); setPoPage(0); }} sx={{ width: { xs: '100%', lg: 145 } }}>
                    <MenuItem value="">All</MenuItem><MenuItem value={PURCHASE_ORDER_STATUS.NOT_STARTED}>Not Started</MenuItem><MenuItem value={PURCHASE_ORDER_STATUS.PACKING}>Packing</MenuItem><MenuItem value={PURCHASE_ORDER_STATUS.WAITING_EX_FTY}>Waiting Ex-fty</MenuItem><MenuItem value={PURCHASE_ORDER_STATUS.WAITING_LABEL}>Waiting Label</MenuItem><MenuItem value={PURCHASE_ORDER_STATUS.WAITING_SSCC}>Waiting SSCC</MenuItem><MenuItem value={PURCHASE_ORDER_STATUS.READY_TO_SHIP}>Ready to Ship</MenuItem>
                  </TextField>
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" onClick={toggleVisible} disabled={!visibleIds.length}>{allVisibleSelected ? 'Unselect visible' : 'Select visible'}</Button>
                  <Button size="small" onClick={() => setSelected(new Set())} disabled={!selected.size}>Clear</Button>
                </Stack>
              </Box>

              <LululemonTableViewport>
                <SortableTable size="small" rowNumberStart={poPage * poSize}>
                  <TableHead><TableRow>
                    <TableCell padding="checkbox"><Checkbox size="small" checked={allVisibleSelected} indeterminate={visibleIds.some((id) => selected.has(id)) && !allVisibleSelected} onChange={toggleVisible} /></TableCell>
                    <TableCell>Purchase Order</TableCell><TableCell>Factory</TableCell><TableCell>Style</TableCell><TableCell>Color</TableCell><TableCell>Size</TableCell><TableCell>SKU</TableCell><TableCell align="right">Cartons</TableCell><TableCell align="right">Qty</TableCell><TableCell>Status</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {pagedPos.map((row) => <TableRow key={row.id} hover selected={selected.has(row.id)}>
                      <TableCell padding="checkbox"><Checkbox size="small" checked={selected.has(row.id)} disabled={Boolean(selectedFactory && row.factoryCode !== selectedFactory)} onChange={() => togglePo(row.id)} /></TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>{row.poNumber}</TableCell><TableCell>{row.factoryCode || '—'}</TableCell><TableCell>{row.styleNumber || row.style || '—'}</TableCell><TableCell>{row.color || '—'}</TableCell><TableCell>{row.size || '—'}</TableCell><TableCell>{row.sku || 'Not assigned'}</TableCell><TableCell align="right">{row.plannedCartons ?? '—'}</TableCell><TableCell align="right">{row.plannedTotalQty ?? row.totalQty ?? '—'}</TableCell><TableCell><StatusChip status={row.status} /></TableCell>
                    </TableRow>)}
                    {!poLoading && !pagedPos.length && <TableRow><TableCell colSpan={10}><Typography align="center" color="text.secondary" sx={{ py: 3 }}>No matching Purchase Orders.</Typography></TableCell></TableRow>}
                  </TableBody>
                </SortableTable>
              </LululemonTableViewport>
              <TablePagination component="div" count={filteredPos.length} page={poPage} rowsPerPage={poSize} rowsPerPageOptions={LARGE_PAGE_SIZE_OPTIONS} onPageChange={(_, page) => setPoPage(page)} onRowsPerPageChange={(e) => { setPoSize(Number(e.target.value)); setPoPage(0); }} />

              <Divider />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} sx={{ p: 0.9 }}>
                <TextField size="small" fullWidth label="Note to Print Room (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: Priority / special note" />
                <Button variant="contained" startIcon={<SendRounded />} disabled={!selected.size || busy} onClick={send} sx={{ minWidth: 195 }}>Send {selected.size || ''} PO{selected.size === 1 ? '' : 's'}</Button>
              </Stack>
            </Paper>
          ) : null}

          <HandoffTable
            title="My Sent Lists"
            subtitle="Lists sent by this Packing account."
            queue={queue}
            filters={queueFilters}
            setFilters={setQueueFilters}
            onPage={(page) => loadQueue(page, queue.size)}
            onSize={(size) => loadQueue(0, size)}
            onView={setDialog}
            onCancel={cancel}
            canCancel={(row) => isActiveHandoff(row.status) && (salesUser || String(row.packingEmail || '').toLowerCase() === currentEmail)}
            onDelete={deleteRequest}
            canDelete={(row) => isDeletableHandoff(row.status) && (salesUser || String(row.packingEmail || '').toLowerCase() === currentEmail)}
            busy={busy}
          />
        </>
      ) : (
        <HandoffTable
          title="Received PO Lists"
          subtitle={APP_MESSAGES.PRINT_LIST_QUEUE_SUBTITLE}
          queue={queue}
          filters={queueFilters}
          setFilters={setQueueFilters}
          onPage={(page) => loadQueue(page, queue.size)}
          onSize={(size) => loadQueue(0, size)}
          onView={setDialog}
          canCancel={() => false}
          onDelete={deleteRequest}
          canDelete={(row) => isDeletableHandoff(row.status) && salesUser}
          canProcess={printRoomUser}
          onStatus={updatePrintStatus}
          busy={busy}
        />
      )}

      {dialog && <HandoffDialog row={dialog} onClose={() => setDialog(null)} />}
    </Stack>
  );
}

function HandoffTable({ title, subtitle, queue, filters, setFilters, onPage, onSize, onView, onCancel, canCancel, onDelete, canDelete, canProcess = false, onStatus, busy }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2.2 }}>
      <Box sx={{ px: 1.25, py: 1, bgcolor: '#FBFCFE', borderBottom: '1px solid #E4EAF0' }}>
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={0.75} alignItems={{ xl: 'center' }}>
          <Box sx={{ minWidth: 230 }}><Typography variant="subtitle2" fontWeight={850}>{title}</Typography><Typography variant="caption" color="text.secondary">{subtitle}</Typography></Box>
          <TextField size="small" placeholder="Request No." value={filters.requestNo} onChange={(e) => setFilters((s) => ({ ...s, requestNo: e.target.value }))} sx={{ width: { xs: '100%', xl: 155 } }} />
          <TextField size="small" placeholder="Packing / Department" value={filters.packingUser} onChange={(e) => setFilters((s) => ({ ...s, packingUser: e.target.value }))} sx={{ width: { xs: '100%', xl: 180 } }} />
          <TextField size="small" placeholder="Factory" value={filters.factoryCode} onChange={(e) => setFilters((s) => ({ ...s, factoryCode: e.target.value }))} sx={{ width: { xs: '100%', xl: 130 } }} />
          <TextField size="small" placeholder="PO No." value={filters.poNumber} onChange={(e) => setFilters((s) => ({ ...s, poNumber: e.target.value }))} sx={{ width: { xs: '100%', xl: 145 } }} />
        </Stack>
      </Box>
      <LululemonTableViewport>
        <SortableTable size="small" rowNumberStart={queue.page * queue.size}>
          <TableHead><TableRow><TableCell>Request No.</TableCell><TableCell>Packing</TableCell><TableCell>Factory</TableCell><TableCell>Order</TableCell><TableCell align="right">POs</TableCell><TableCell>Status</TableCell><TableCell>Sent At</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
          <TableBody>
            {(queue.rows || []).map((row) => <TableRow key={row.id} hover sx={String(row.status || '').toUpperCase() === PRINT_REQUEST_STATUS.CANCELLED ? { opacity: 0.55 } : undefined}>
              <TableCell sx={{ fontWeight: 850 }}>{row.requestNo}</TableCell>
              <TableCell><Typography variant="body2" fontWeight={750}>{row.packingUser || '—'}</Typography><Typography variant="caption" color="text.secondary">{row.packingDepartment || row.packingEmail || ''}</Typography></TableCell>
              <TableCell>{(row.factoryCodes || []).join(', ') || '—'}</TableCell>
              <TableCell>{row.orderName || row.orderId || '—'}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>{row.poCount ?? (row.pos || []).length}</TableCell>
              <TableCell><StatusChip status={row.status} /></TableCell>
              <TableCell>{fmtDateTime(row.createdAt)}</TableCell>
              <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={0.25}>
                <Tooltip title="View PO list"><IconButton size="small" onClick={() => onView(row)}><VisibilityOutlined fontSize="small" /></IconButton></Tooltip>
                {canProcess && [PRINT_REQUEST_STATUS.SENT, PRINT_REQUEST_STATUS.PENDING].includes(String(row.status || '').toUpperCase()) && <Tooltip title="Start printing"><span><IconButton size="small" color="primary" disabled={busy} onClick={() => onStatus?.(row, PRINT_REQUEST_STATUS.PRINTING)}><PlayArrowRounded fontSize="small" /></IconButton></span></Tooltip>}
                {canProcess && [PRINT_REQUEST_STATUS.SENT, PRINT_REQUEST_STATUS.PENDING, PRINT_REQUEST_STATUS.PRINTING].includes(String(row.status || '').toUpperCase()) && <Tooltip title="Printed & sent to Packing"><span><IconButton size="small" color="success" disabled={busy} onClick={() => onStatus?.(row, PRINT_REQUEST_STATUS.PRINTED_SENT_TO_PACKING)}><TaskAltRounded fontSize="small" /></IconButton></span></Tooltip>}
                {canCancel?.(row) && <Tooltip title="Cancel sent list"><span><IconButton size="small" color="error" disabled={busy} onClick={() => onCancel?.(row)}><CancelOutlined fontSize="small" /></IconButton></span></Tooltip>}
                {canDelete?.(row) && <Tooltip title="Delete Print Request permanently"><span><IconButton size="small" color="error" disabled={busy} onClick={() => onDelete?.(row)}><DeleteOutlineRounded fontSize="small" /></IconButton></span></Tooltip>}
              </Stack></TableCell>
            </TableRow>)}
            {!queue.loading && !(queue.rows || []).length && <TableRow><TableCell colSpan={10}><Typography align="center" color="text.secondary" sx={{ py: 3 }}>No PO lists found.</Typography></TableCell></TableRow>}
          </TableBody>
        </SortableTable>
      </LululemonTableViewport>
      <TablePagination component="div" count={queue.count} page={queue.page} rowsPerPage={queue.size} rowsPerPageOptions={LARGE_PAGE_SIZE_OPTIONS} onPageChange={(_, page) => onPage(page)} onRowsPerPageChange={(e) => onSize(Number(e.target.value))} />
    </Paper>
  );
}

function HandoffDialog({ row, onClose }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
  const poRows = row.pos || [];
  const pageRows = poRows.slice(page * size, page * size + size);
  return (
    <OperationWorkspaceDialog
      open
      onClose={onClose}
      title={row.requestNo}
      subtitle={`Packing: ${row.packingUser || '—'}${row.packingDepartment ? ` · ${row.packingDepartment}` : ''} · ${(row.factoryCodes || []).join(', ') || 'No factory'}`}
      maxWidth="lg"
    >
      <Stack spacing={1.25}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Meta label="Order" value={row.orderName || row.orderId} /><Meta label="Packing account" value={row.packingEmail || row.packingUser} /><Meta label="Sent at" value={fmtDateTime(row.createdAt)} />
        </Stack>
        {row.packingNote && <Alert severity="info">Packing note: {row.packingNote}</Alert>}
        <LululemonTableViewport component={Paper} variant="outlined" viewportHeight="min(420px, 58vh)">
          <SortableTable size="small" rowNumberStart={page * size}>
            <TableHead><TableRow><TableCell>Purchase Order</TableCell><TableCell>Factory</TableCell><TableCell>Style</TableCell><TableCell>Color</TableCell><TableCell>Size</TableCell><TableCell>SKU</TableCell><TableCell align="right">Cartons</TableCell><TableCell align="right">Qty</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
            <TableBody>{pageRows.map((po) => <TableRow key={po.poId}><TableCell sx={{ fontWeight: 800 }}>{po.poNumber}</TableCell><TableCell>{po.factoryCode || '—'}</TableCell><TableCell>{po.style || '—'}</TableCell><TableCell>{po.color || '—'}</TableCell><TableCell>{po.size || '—'}</TableCell><TableCell>{po.sku || 'Not assigned'}</TableCell><TableCell align="right">{po.plannedCartons ?? '—'}</TableCell><TableCell align="right">{po.plannedTotalQty ?? '—'}</TableCell><TableCell><StatusChip status={po.status} /></TableCell></TableRow>)}</TableBody>
          </SortableTable>
        </LululemonTableViewport>
        <TablePagination component="div" count={poRows.length} page={page} rowsPerPage={size} rowsPerPageOptions={LARGE_PAGE_SIZE_OPTIONS} onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} />
      </Stack>
    </OperationWorkspaceDialog>
  );
}

function Meta({ label, value }) {
  return <Box sx={{ minWidth: 150 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={750}>{value || '—'}</Typography></Box>;
}
