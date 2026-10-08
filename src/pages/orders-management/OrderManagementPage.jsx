import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { Add, Delete, Edit, Refresh } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { getActiveBuyer } from 'utils/buyerAccess';
import { canManageSales } from 'utils/accessControl';
import { createManagedOrder, deleteManagedOrder, listManagedCartons, listManagedItems, listManagedOrders, listManagedPos, updateManagedOrder } from 'services/managementService';

import { APP_MESSAGES, createDeleteOrderConfirmMessage } from '../../constants/appMessages';
import { DEFAULT_TABLE_ROWS_PER_PAGE } from '../../constants/appConstants';

const pageState = () => ({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE, count: 0, rows: [], loading: false });
const todayLocal = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const emptyOrderFilters = () => ({ orderDate: '', orderName: '', factory: '', supplier: '', createdBy: '', status: '' });
const emptyPoFilters = () => ({ poNumber: '', factory: '', style: '', sku: '', destination: '', status: '', exFtyDate: '' });
const emptyCartonFilters = () => ({ cartonNo: '', sscc: '', status: '' });
const emptyItemFilters = () => ({ itemNo: '', sku: '', style: '', color: '', sizeValue: '', status: '', scannedBy: '' });

export default function OrderManagementPage() {
  const buyer = getActiveBuyer();
  const buyerCode = buyer?.code || '';
  const [orders, setOrders] = useState(pageState());
  const [pos, setPos] = useState(pageState());
  const [cartons, setCartons] = useState(pageState());
  const [items, setItems] = useState(pageState());
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedPo, setSelectedPo] = useState(null);
  const [selectedCarton, setSelectedCarton] = useState(null);
  const [orderFilters, setOrderFilters] = useState(emptyOrderFilters());
  const [poFilters, setPoFilters] = useState(emptyPoFilters());
  const [cartonFilters, setCartonFilters] = useState(emptyCartonFilters());
  const [itemFilters, setItemFilters] = useState(emptyItemFilters());
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const writable = canManageSales();

  const loadOrders = useCallback(async (page = orders.page, size = orders.size) => {
    if (!buyerCode) return;
    setOrders((state) => ({ ...state, loading: true }));
    try {
      const result = await listManagedOrders(buyerCode, { ...orderFilters, page, size });
      setOrders({ page, size, count: result.totalElements || 0, rows: (result.content || []).map((row, index) => ({ ...row, __stt: page * size + index + 1 })), loading: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setOrders((state) => ({ ...state, loading: false }));
    }
  }, [buyerCode, orderFilters, orders.page, orders.size]);

  const loadPos = useCallback(async (order = selectedOrder, page = pos.page, size = pos.size) => {
    if (!order) return;
    setPos((state) => ({ ...state, loading: true }));
    try {
      const result = await listManagedPos(buyerCode, order.id, { ...poFilters, page, size });
      setPos({ page, size, count: result.totalElements || 0, rows: result.content || [], loading: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setPos((state) => ({ ...state, loading: false }));
    }
  }, [buyerCode, selectedOrder, poFilters, pos.page, pos.size]);

  const loadCartons = useCallback(async (po = selectedPo, page = cartons.page, size = cartons.size) => {
    if (!selectedOrder || !po) return;
    setCartons((state) => ({ ...state, loading: true }));
    try {
      const result = await listManagedCartons(buyerCode, selectedOrder.id, po.key, { ...cartonFilters, page, size });
      setCartons({ page, size, count: result.totalElements || 0, rows: result.content || [], loading: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setCartons((state) => ({ ...state, loading: false }));
    }
  }, [buyerCode, selectedOrder, selectedPo, cartonFilters, cartons.page, cartons.size]);

  const loadItems = useCallback(async (carton = selectedCarton, page = items.page, size = items.size) => {
    if (!selectedOrder || !carton) return;
    setItems((state) => ({ ...state, loading: true }));
    try {
      const result = await listManagedItems(buyerCode, selectedOrder.id, carton.id, { ...itemFilters, page, size });
      setItems({ page, size, count: result.totalElements || 0, rows: result.content || [], loading: false });
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setItems((state) => ({ ...state, loading: false }));
    }
  }, [buyerCode, selectedOrder, selectedCarton, itemFilters, items.page, items.size]);

  useEffect(() => { loadOrders(0, orders.size); }, [buyerCode, orderFilters]);
  useEffect(() => {
    if (selectedOrder) loadPos(selectedOrder, 0, pos.size); else setPos(pageState());
    setSelectedPo(null); setSelectedCarton(null); setCartons(pageState()); setItems(pageState());
  }, [selectedOrder, poFilters]);
  useEffect(() => {
    if (selectedPo) loadCartons(selectedPo, 0, cartons.size); else setCartons(pageState());
    setSelectedCarton(null); setItems(pageState());
  }, [selectedPo, cartonFilters]);
  useEffect(() => { if (selectedCarton) loadItems(selectedCarton, 0, items.size); else setItems(pageState()); }, [selectedCarton, itemFilters]);

  const save = async (form) => {
    try {
      if (dialog?.record?.id) await updateManagedOrder(buyerCode, dialog.record.id, form); else await createManagedOrder(buyerCode, form);
      setDialog(null); setSelectedOrder(null); await loadOrders(0, orders.size);
    } catch (e) { setError(e?.response?.data?.message || e.message); }
  };
  const remove = async () => {
    if (!selectedOrder || !confirm(createDeleteOrderConfirmMessage(selectedOrder.orderName))) return;
    try { await deleteManagedOrder(buyerCode, selectedOrder.id); setSelectedOrder(null); await loadOrders(0, orders.size); }
    catch (e) { setError(e?.response?.data?.message || e.message); }
  };

  if (!buyerCode) return <Alert severity="warning">{APP_MESSAGES.SELECT_BUYER_FIRST}</Alert>;

  return <Box sx={{ p: { xs: 1, md: 1.5 } }}><Stack spacing={1}>
    <Stack direction={{ xs: 'column', md: 'row' }} gap={1} justifyContent="space-between">
      <Box><Typography variant="h5" fontWeight={850}>Order Management</Typography><Typography color="text.secondary">{buyer?.label}: Order → PO → Carton → Item</Typography></Box>
      <Stack direction="row" gap={1}><Button startIcon={<Refresh />} onClick={() => loadOrders()}>Refresh</Button>{writable ? <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({ record: null })}>Add Order</Button> : null}{writable && selectedOrder ? <><Button startIcon={<Edit />} onClick={() => setDialog({ record: selectedOrder })}>Edit</Button><Button color="error" startIcon={<Delete />} onClick={remove}>Delete</Button></> : null}</Stack>
    </Stack>
    {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

    <TableFilterBar fields={[{ key: 'orderDate', label: 'Start Order', type: 'date' }, { key: 'orderName', label: 'Order' }, { key: 'factory', label: 'Factory' }, { key: 'supplier', label: 'Supplier' }, { key: 'createdBy', label: 'Created By' }, { key: 'status', label: 'Status' }]} values={orderFilters} onChange={(key, value) => setOrderFilters((v) => ({ ...v, [key]: value }))} onClear={() => setOrderFilters(emptyOrderFilters())} />
    <ManagementTable title="Orders" {...orders} rowsPerPage={orders.size} selectedId={selectedOrder?.id} onRowClick={setSelectedOrder} onPageChange={(p) => loadOrders(p, orders.size)} onRowsPerPageChange={(size) => loadOrders(0, size)} columns={[{ key: '__stt', label: 'STT' }, { key: 'orderName', label: 'Order' }, { key: 'orderDate', label: 'Start Order' }, { key: 'endOrderDate', label: 'End Order' }, { key: 'status', label: 'Status', status: true }, { key: 'plannedCartonCount', label: 'Cartons' }, { key: 'completedCartonCount', label: 'Completed' }]} />

    {selectedOrder ? <TableFilterBar fields={[{ key: 'poNumber', label: 'PO No.' }, { key: 'factory', label: 'Factory' }, { key: 'style', label: 'Style' }, { key: 'sku', label: 'SKU / Article' }, { key: 'destination', label: 'Destination' }, { key: 'status', label: 'Status' }, { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' }]} values={poFilters} onChange={(key, value) => setPoFilters((v) => ({ ...v, [key]: value }))} onClear={() => setPoFilters(emptyPoFilters())} /> : null}
    <ManagementTable title={`PO${selectedOrder ? ` — ${selectedOrder.orderName}` : ''}`} {...pos} rowsPerPage={pos.size} selectedId={selectedPo?.key} getRowId={(row) => row.key} onRowClick={setSelectedPo} onPageChange={(p) => loadPos(selectedOrder, p, pos.size)} onRowsPerPageChange={(size) => loadPos(selectedOrder, 0, size)} columns={[{ key: 'poNumber', label: 'PO' }, { key: 'styleNumber', label: 'Style' }, { key: 'sku', label: 'SKU / Article' }, { key: 'factoryCode', label: 'Factory' }, { key: 'status', label: 'Status' }, { key: 'cartonCount', label: 'Cartons' }, { key: 'itemCount', label: 'Items' }]} />

    {selectedPo ? <TableFilterBar fields={[{ key: 'cartonNo', label: 'Carton No.' }, { key: 'sscc', label: 'SSCC / Barcode' }, { key: 'status', label: 'Status' }]} values={cartonFilters} onChange={(key, value) => setCartonFilters((v) => ({ ...v, [key]: value }))} onClear={() => setCartonFilters(emptyCartonFilters())} /> : null}
    <ManagementTable title={`Cartons${selectedPo ? ` — ${selectedPo.poNumber}` : ''}`} {...cartons} rowsPerPage={cartons.size} selectedId={selectedCarton?.id} onRowClick={setSelectedCarton} onPageChange={(p) => loadCartons(selectedPo, p, cartons.size)} onRowsPerPageChange={(size) => loadCartons(selectedPo, 0, size)} columns={[{ key: 'cartonNo', label: 'Carton No.' }, { key: 'cartonIdentity', label: 'SSCC / Barcode' }, { key: 'status', label: 'Status' }, { key: 'plannedQty', label: 'Qty' }, { key: 'scannedQty', label: 'Scanned' }, { key: 'weightKg', label: 'Weight (kg)' }, { key: 'weightStatus', label: 'Weight Status' }]} />

    {selectedCarton ? <TableFilterBar fields={[{ key: 'itemNo', label: 'Item No.' }, { key: 'sku', label: 'SKU / Article' }, { key: 'style', label: 'Style' }, { key: 'color', label: 'Color' }, { key: 'sizeValue', label: 'Size' }, { key: 'status', label: 'Status' }, { key: 'scannedBy', label: 'Scanned By' }]} values={itemFilters} onChange={(key, value) => setItemFilters((v) => ({ ...v, [key]: value }))} onClear={() => setItemFilters(emptyItemFilters())} /> : null}
    <ManagementTable title={`Items${selectedCarton ? ` — Carton ${selectedCarton.cartonNo ?? selectedCarton.id}` : ''}`} {...items} rowsPerPage={items.size} onPageChange={(p) => loadItems(selectedCarton, p, items.size)} onRowsPerPageChange={(size) => loadItems(selectedCarton, 0, size)} columns={[{ key: 'itemNo', label: 'Item No.' }, { key: 'sku', label: 'SKU / Article' }, { key: 'style', label: 'Style' }, { key: 'color', label: 'Color' }, { key: 'size', label: 'Size' }, { key: 'quantity', label: 'Qty' }, { key: 'status', label: 'Status' }, { key: 'scannedBy', label: 'Scanned By' }]} />

    {dialog ? <OrderDialog record={dialog.record} onClose={() => setDialog(null)} onSave={save} /> : null}
  </Stack></Box>;
}

function OrderDialog({ record, onClose, onSave }) {
  const [form, setForm] = useState({ orderDate: record?.orderDate || todayLocal(), endOrderDate: record?.endOrderDate || '', orderName: record?.orderName || '', supplierName: record?.supplierName || null, supplierNumber: record?.supplierNumber || null, productionFacility: record?.productionFacility || null });
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{record ? 'Edit Order' : 'Add Order'}</DialogTitle><DialogContent><Stack spacing={1.5} sx={{ mt: 1 }}><TextField autoFocus label="Order Name" value={form.orderName} onChange={(e) => setForm({ ...form, orderName: e.target.value })} /><TextField required type="date" label="Start Order" InputLabelProps={{ shrink: true }} value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} /><TextField required type="date" label="End Order" InputLabelProps={{ shrink: true }} inputProps={{ min: form.orderDate || undefined }} value={form.endOrderDate} onChange={(e) => setForm({ ...form, endOrderDate: e.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={() => onSave(form)} disabled={!form.orderDate || !form.endOrderDate || !form.orderName.trim() || form.endOrderDate < form.orderDate}>Save</Button></DialogActions></Dialog>;
}
