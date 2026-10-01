import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';

import { canAssignBarcode as canAssignBarcodeAccess, canManageSales, isAdmin } from 'utils/accessControl';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getApiError } from 'utils/apiError';
import {
  assignFactoryBarcodeToCarton,
  checkFactoryBarcodeForAssignment,
  generateCartonPlanFromWsp,
  listCartonsForItem,
  resetCartonWeight,
  unassignFactoryBarcodeFromCarton
} from 'buyers/es/services/cartonLoadingService';
import {
  createPackingAllocationLine,
  createPackingListLine,
  deletePackingAllocationLine,
  deletePackingListLine,
  downloadOrderMaster,
  downloadPackingList,
  generatePackingList,
  getPackingOrder,
  importPackingAllocationLines,
  importPackingListLines,
  listPackingAllocationLines,
  listPackingListLines,
  saveBlob,
  updatePackingAllocationLine,
  updatePackingListLine
} from 'buyers/es/services/packingListService';
import PackingAllocationFormDialog from './PackingAllocationFormDialog';
import PackingAllocationImportDialog from './PackingAllocationImportDialog';
import PackingListImportDialog from './PackingListImportDialog';
import PackingListLineFormDialog from './PackingListLineFormDialog';
import { formatPackingValue, PACKING_ALLOCATION_FIELDS, PACKING_LIST_FIELDS } from './packingListConfig';

const emptyMasterFilters = {
  keyword: '', poNumber: '', articleNumber: '', styleNumber: '', color: '', sizeValue: '', shipmentMode: '', status: ''
};
const emptyPackingFilters = {
  keyword: '', poNumber: '', articleNumber: '', styleNumber: '', color: '', sizeValue: ''
};

const summaryCard = (label, value) => (
  <Paper key={label} elevation={0} sx={{ p: 1.2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{label}</Typography>
    <Typography sx={{ fontSize: '1rem', fontWeight: 750, color: '#103B5C' }}>{Number(value || 0).toLocaleString()}</Typography>
  </Paper>
);

export default function PackingAllocationPage() {
  const { buyerSlug, orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const buyer = getBuyerBySlug(buyerSlug);
  const assignmentWorkspace = location.pathname.startsWith('/assign-barcode/');
  const canWrite = canManageSales();
  const canAssignOperation = canAssignBarcodeAccess();
  const adminUser = isAdmin();
  const [order, setOrder] = useState(null);
  const [tab, setTab] = useState(0);
  const [notice, setNotice] = useState({ open: false, severity: 'success', message: '' });

  const [masterFilters, setMasterFilters] = useState(emptyMasterFilters);
  const [masterApplied, setMasterApplied] = useState(emptyMasterFilters);
  const [masterRows, setMasterRows] = useState([]);
  const [masterPage, setMasterPage] = useState(0);
  const [masterPages, setMasterPages] = useState(1);
  const [masterTotal, setMasterTotal] = useState(0);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [masterFormRecord, setMasterFormRecord] = useState(null);
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterDeleteTarget, setMasterDeleteTarget] = useState(null);
  const [masterImportOpen, setMasterImportOpen] = useState(false);
  const [masterImporting, setMasterImporting] = useState(false);
  const [masterImportResult, setMasterImportResult] = useState(null);

  const [packingFilters, setPackingFilters] = useState(emptyPackingFilters);
  const [packingApplied, setPackingApplied] = useState(emptyPackingFilters);
  const [packingRows, setPackingRows] = useState([]);
  const [packingPage, setPackingPage] = useState(0);
  const [packingPages, setPackingPages] = useState(1);
  const [packingTotal, setPackingTotal] = useState(0);
  const [packingLoading, setPackingLoading] = useState(false);
  const [packingFormOpen, setPackingFormOpen] = useState(false);
  const [packingFormRecord, setPackingFormRecord] = useState(null);
  const [packingSaving, setPackingSaving] = useState(false);
  const [packingDeleteTarget, setPackingDeleteTarget] = useState(null);
  const [packingImportOpen, setPackingImportOpen] = useState(false);
  const [packingImporting, setPackingImporting] = useState(false);
  const [packingImportResult, setPackingImportResult] = useState(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [cartonGenerateOpen, setCartonGenerateOpen] = useState(false);
  const [cartonGenerating, setCartonGenerating] = useState(false);
  const [cartonItemOpen, setCartonItemOpen] = useState(false);
  const [cartonItemRow, setCartonItemRow] = useState(null);
  const [cartonItemChildren, setCartonItemChildren] = useState([]);
  const [cartonItemLoading, setCartonItemLoading] = useState(false);
  const [cartonAssignTarget, setCartonAssignTarget] = useState(null);
  const [assignedQuantity, setAssignedQuantity] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [cartonBarcode, setCartonBarcode] = useState('');
  const [cartonCheckedBarcode, setCartonCheckedBarcode] = useState(null);
  const [cartonBarcodeChecking, setCartonBarcodeChecking] = useState(false);
  const [cartonAssigningId, setCartonAssigningId] = useState('');
  const [cartonAssignError, setCartonAssignError] = useState('');
  const [cartonAssignNotice, setCartonAssignNotice] = useState('');
  const [cartonCorrectionTarget, setCartonCorrectionTarget] = useState(null);
  const [cartonCorrectionReason, setCartonCorrectionReason] = useState('');
  const [cartonCorrectionSaving, setCartonCorrectionSaving] = useState(false);
  const cartonBarcodeInputRef = useRef(null);

  const notify = (message, severity = 'success') => setNotice({ open: true, severity, message });

  const loadOrder = useCallback(async () => {
    if (!buyer?.code || !orderId) return;
    try {
      const loadedOrder = await getPackingOrder(buyer.code, orderId);
      setOrder(loadedOrder);
      return loadedOrder;
    } catch (error) {
      notify(getApiError(error, 'Unable to load the Order.'), 'error');
    }
  }, [buyer?.code, orderId]);

  const loadMaster = useCallback(async () => {
    if (!buyer?.code || !orderId) return;
    setMasterLoading(true);
    try {
      const data = await listPackingAllocationLines(buyer.code, orderId, { ...masterApplied, page: masterPage, size: 50 });
      setMasterRows(Array.isArray(data?.content) ? data.content : []);
      setMasterPages(Math.max(1, data?.totalPages || 1));
      setMasterTotal(data?.totalElements || 0);
    } catch (error) {
      notify(getApiError(error, 'Unable to load Order Items.'), 'error');
    } finally {
      setMasterLoading(false);
    }
  }, [buyer?.code, masterApplied, masterPage, orderId]);

  const loadPacking = useCallback(async () => {
    if (!buyer?.code || !orderId) return;
    setPackingLoading(true);
    try {
      const data = await listPackingListLines(buyer.code, orderId, { ...packingApplied, page: packingPage, size: 50 });
      setPackingRows(Array.isArray(data?.content) ? data.content : []);
      setPackingPages(Math.max(1, data?.totalPages || 1));
      setPackingTotal(data?.totalElements || 0);
    } catch (error) {
      notify(getApiError(error, 'Unable to load Packing List rows.'), 'error');
    } finally {
      setPackingLoading(false);
    }
  }, [buyer?.code, orderId, packingApplied, packingPage]);

  useEffect(() => { loadOrder(); }, [loadOrder]);
  useEffect(() => { if (tab === 0) loadMaster(); }, [loadMaster, tab]);
  useEffect(() => { if (tab === 1) loadPacking(); }, [loadPacking, tab]);

  const masterTotals = useMemo(() => masterRows.reduce((summary, row) => ({
    pcs: summary.pcs + Number(row.totalPcs || 0),
    cartons: summary.cartons + Number(row.totalCartons || 0),
    pcsAir: summary.pcsAir + Number(row.pcsAir || 0),
    pcsSea: summary.pcsSea + Number(row.pcsSea || 0)
  }), { pcs: 0, cartons: 0, pcsAir: 0, pcsSea: 0 }), [masterRows]);

  const packingTotals = useMemo(() => packingRows.reduce((summary, row) => ({
    pcs: summary.pcs + Number(row.totalPcs || 0),
    cartons: summary.cartons + Number(row.cartonsQty || 0),
    cbm: summary.cbm + Number(row.cbm || 0),
    grossWeight: summary.grossWeight + Number(row.grossWeightKg || 0),
    netWeight: summary.netWeight + Number(row.netWeightKg || 0)
  }), { pcs: 0, cartons: 0, cbm: 0, grossWeight: 0, netWeight: 0 }), [packingRows]);

  const cartonItemAssignedCount = useMemo(
    () => cartonItemChildren.filter((row) => Boolean(row.factoryBarcode)).length,
    [cartonItemChildren]
  );
  const cartonItemExpectedCount = Math.max(0, Math.round(Number(cartonItemRow?.totalCartons || 0)));
  const cartonItemGeneratedCount = cartonItemChildren.length;
  const cartonItemCountMatches = cartonItemExpectedCount > 0 && cartonItemGeneratedCount === cartonItemExpectedCount;
  const cartonItemAssignmentStatus = cartonItemGeneratedCount === 0
    ? 'NOT STARTED'
    : cartonItemCountMatches && cartonItemAssignedCount >= cartonItemExpectedCount
      ? 'COMPLETED'
      : cartonItemAssignedCount > 0 ? 'IN PROGRESS' : 'NOT STARTED';

  const saveMaster = async (payload) => {
    if (!canWrite || !buyer?.code) return;
    setMasterSaving(true);
    try {
      if (masterFormRecord?.id) await updatePackingAllocationLine(buyer.code, orderId, masterFormRecord.id, payload);
      else await createPackingAllocationLine(buyer.code, orderId, payload);
      setMasterFormOpen(false);
      setMasterFormRecord(null);
      notify('Order Item saved. Packing List / Physical Cartons were synchronized automatically when quantity changed.');
      await Promise.all([loadMaster(), loadOrder()]);
    } catch (error) {
      notify(getApiError(error, 'Unable to save the Order Item.'), 'error');
    } finally {
      setMasterSaving(false);
    }
  };

  const removeMaster = async () => {
    if (!canWrite || !masterDeleteTarget?.id || !buyer?.code) return;
    try {
      await deletePackingAllocationLine(buyer.code, orderId, masterDeleteTarget.id);
      setMasterDeleteTarget(null);
      notify('Order Item deleted.');
      if (masterRows.length === 1 && masterPage > 0) setMasterPage((value) => value - 1);
      else await Promise.all([loadMaster(), loadOrder()]);
    } catch (error) {
      notify(getApiError(error, 'Unable to delete the Order Item.'), 'error');
    }
  };

  const importMaster = async (file, mode) => {
    if (!canWrite || !file || !buyer?.code) return;
    setMasterImporting(true);
    setMasterImportResult(null);
    try {
      const result = await importPackingAllocationLines(buyer.code, orderId, file, mode);
      setMasterImportResult(result);
      const message = `Order Items import: ${result.created || 0} created, ${result.updated || 0} updated, ${result.deleted || 0} deleted. Review the Master Total ctns and Qty Per Ctn before generating Carton Master data.`;
      notify(message, 'success');
      setMasterPage(0);
      await Promise.all([loadMaster(), loadOrder()]);
    } catch (error) {
      const result = error?.response?.data;
      setMasterImportResult(result && typeof result === 'object' ? result : { applied: false, errors: [{ message: getApiError(error) }] });
      notify(getApiError(error, 'Order Items import failed.'), 'error');
    } finally {
      setMasterImporting(false);
    }
  };

  const exportMaster = async () => {
    try {
      const response = await downloadOrderMaster(buyer.code, orderId);
      saveBlob(response, `${order?.orderName || 'ORDER'}_ORDER_ITEMS.xlsx`);
    } catch (error) {
      notify(getApiError(error, 'Unable to download the Order Items.'), 'error');
    }
  };

  const savePacking = async (payload) => {
    if (!canWrite || !buyer?.code) return;
    setPackingSaving(true);
    try {
      if (packingFormRecord?.id) await updatePackingListLine(buyer.code, orderId, packingFormRecord.id, payload);
      else await createPackingListLine(buyer.code, orderId, payload);
      setPackingFormOpen(false);
      setPackingFormRecord(null);
      notify('Packing List row saved. Physical Cartons were refreshed using Master Total ctns when carton-related data changed.');
      await Promise.all([loadPacking(), loadOrder()]);
    } catch (error) {
      notify(getApiError(error, 'Unable to save the Packing List row.'), 'error');
    } finally {
      setPackingSaving(false);
    }
  };

  const removePacking = async () => {
    if (!canWrite || !packingDeleteTarget?.id || !buyer?.code) return;
    try {
      await deletePackingListLine(buyer.code, orderId, packingDeleteTarget.id);
      setPackingDeleteTarget(null);
      notify('Packing List row deleted.');
      if (packingRows.length === 1 && packingPage > 0) setPackingPage((value) => value - 1);
      else await Promise.all([loadPacking(), loadOrder()]);
    } catch (error) {
      notify(getApiError(error, 'Unable to delete the Packing List row.'), 'error');
    }
  };

  const importPacking = async (file, mode) => {
    if (!canWrite || !file || !buyer?.code) return;
    setPackingImporting(true);
    setPackingImportResult(null);
    try {
      const result = await importPackingListLines(buyer.code, orderId, file, mode);
      setPackingImportResult(result);
      notify(`Packing List import completed: ${result.created || 0} created and ${result.updated || 0} updated.`);
      setPackingPage(0);
      await Promise.all([loadPacking(), loadOrder()]);
    } catch (error) {
      const result = error?.response?.data;
      setPackingImportResult(result && typeof result === 'object' ? result : { applied: false, errors: [{ message: getApiError(error) }] });
      notify(getApiError(error, 'Packing List import failed.'), 'error');
    } finally {
      setPackingImporting(false);
    }
  };

  const exportPacking = async () => {
    try {
      const response = await downloadPackingList(buyer.code, orderId);
      saveBlob(response, `${order?.orderName || 'ORDER'}_PACKING_LIST.xlsx`);
    } catch (error) {
      notify(getApiError(error, 'Unable to download the Packing List.'), 'error');
    }
  };

  const loadCartonChildren = useCallback(async (row = cartonItemRow) => {
    if (!buyer?.code || !orderId || !row?.id) return;
    setCartonItemLoading(true);
    try {
      const rows = await listCartonsForItem(buyer.code, orderId, row.id);
      setCartonItemChildren(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setCartonItemChildren([]);
      notify(getApiError(error, 'Unable to load physical cartons for this Master row.'), 'error');
    } finally {
      setCartonItemLoading(false);
    }
  }, [buyer?.code, orderId, cartonItemRow]);

  const openCartonItem = async (row) => {
    if (!buyer?.code || !row?.id) return;
    setCartonItemRow(row);
    setCartonItemChildren([]);
    setCartonAssignTarget(null);
    setCartonBarcode('');
    setCartonCheckedBarcode(null);
    setCartonAssignError('');
    setCartonAssignNotice('');
    setCartonItemOpen(true);
    setCartonItemLoading(true);
    try {
      const rows = await listCartonsForItem(buyer.code, orderId, row.id);
      setCartonItemChildren(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setCartonItemChildren([]);
      notify(getApiError(error, 'Unable to load physical cartons for this Master row.'), 'error');
    } finally {
      setCartonItemLoading(false);
    }
  };

  const closeCartonAssignment = () => {
    if (cartonBarcodeChecking || cartonAssigningId) return;
    setCartonAssignTarget(null);
    setCartonBarcode('');
    setCartonCheckedBarcode(null);
    setCartonAssignError('');
    setCartonAssignNotice('');
  };

  const startCartonAssignment = (carton) => {
    if (!carton?.id || carton.factoryBarcode || carton.status !== 'PLANNED') return;
    setCartonAssignTarget(carton);
    setAssignedQuantity(String(carton.cartonPcs ?? carton.qtyPerCarton ?? ''));
    setProductionLine('');
    setCartonBarcode('');
    setCartonCheckedBarcode(null);
    setCartonAssignError('');
    setCartonAssignNotice('');
    window.setTimeout(() => cartonBarcodeInputRef.current?.focus(), 80);
  };

  const checkCartonBarcode = async () => {
    const code = cartonBarcode.trim();
    if (!buyer?.code || !cartonAssignTarget?.id || !code || cartonBarcodeChecking) return;
    setCartonBarcodeChecking(true);
    setCartonAssignError('');
    setCartonAssignNotice('');
    setCartonCheckedBarcode(null);
    try {
      const result = await checkFactoryBarcodeForAssignment(buyer.code, orderId, code);
      setCartonCheckedBarcode(result);
      setCartonBarcode(result?.barcode || code);
      setCartonAssignNotice(`Factory Barcode ${result?.barcode || code} is available for this physical carton.`);
    } catch (error) {
      setCartonAssignError(getApiError(error, 'Factory Barcode cannot be used for assignment.'));
      window.setTimeout(() => cartonBarcodeInputRef.current?.focus(), 80);
    } finally {
      setCartonBarcodeChecking(false);
    }
  };

  const assignBarcodeToSelectedCarton = async () => {
    if (!buyer?.code || !cartonAssignTarget?.id || !cartonCheckedBarcode?.barcode || cartonAssigningId) return;
    if (!Number.isFinite(Number(assignedQuantity)) || Number(assignedQuantity) <= 0) {
      setCartonAssignError('Enter a positive quantity matching the carton plan.');
      return;
    }
    setCartonAssigningId(cartonAssignTarget.id);
    setCartonAssignError('');
    try {
      const assigned = await assignFactoryBarcodeToCarton(buyer.code, orderId, {
        factoryBarcode: cartonCheckedBarcode.barcode,
        cartonId: cartonAssignTarget.id,
        actualQuantity: Number(assignedQuantity),
        productionLine: productionLine.trim()
      });
      const assignedCode = cartonCheckedBarcode.barcode;
      setCartonAssignTarget(null);
      setCartonBarcode('');
      setCartonCheckedBarcode(null);
      setCartonAssignError('');
      setCartonAssignNotice('');
      const [, refreshedOrder] = await Promise.all([loadCartonChildren(cartonItemRow), loadOrder()]);
      const completedMessage = refreshedOrder?.assignmentStatus === 'COMPLETED'
        ? ' Order Barcode Assignment is now COMPLETED and ready for Sales Shipment Planning.'
        : '';
      notify(`Assigned ${assignedCode} to ${assigned?.cartonCode || `Carton #${assigned?.cartonSequence || cartonAssignTarget.cartonSequence}`}.${completedMessage}`);
    } catch (error) {
      setCartonAssignError(getApiError(error, 'Unable to assign Factory Barcode to this physical carton.'));
    } finally {
      setCartonAssigningId('');
    }
  };

  const unassignCartonBarcode = async (carton) => {
    if (!buyer?.code || !carton?.id || !carton.factoryBarcode || carton.status !== 'PLANNED' || cartonAssigningId) return;
    if (!window.confirm(`Unassign Factory Barcode ${carton.factoryBarcode} from Carton #${carton.cartonSequence || '—'}?`)) return;
    setCartonAssigningId(carton.id);
    try {
      await unassignFactoryBarcodeFromCarton(buyer.code, orderId, carton.id);
      await Promise.all([loadCartonChildren(cartonItemRow), loadOrder()]);
      notify(`Factory Barcode ${carton.factoryBarcode} was unassigned. Order assignment returned to IN PROGRESS.`);
    } catch (error) {
      notify(getApiError(error, 'Unable to unassign Factory Barcode.'), 'error');
    } finally {
      setCartonAssigningId('');
    }
  };

  const correctWeightedCarton = async () => {
    if (!adminUser || !buyer?.code || !cartonCorrectionTarget?.id || !cartonCorrectionReason.trim() || cartonCorrectionSaving) return;
    setCartonCorrectionSaving(true);
    try {
      const corrected = await resetCartonWeight(buyer.code, orderId, cartonCorrectionTarget.id, cartonCorrectionReason.trim());
      await Promise.all([loadCartonChildren(cartonItemRow), loadOrder()]);
      setCartonCorrectionTarget(null);
      setCartonCorrectionReason('');
      notify(`Weight Check was reset for ${corrected?.cartonCode || 'the selected carton'}. Its Factory Barcode remains assigned; unassign it only when the barcode mapping must be corrected.`);
    } catch (error) {
      notify(getApiError(error, 'Unable to reset Weight Check for this carton.'), 'error');
    } finally {
      setCartonCorrectionSaving(false);
    }
  };

  const runGenerateCartons = async () => {
    if (!canWrite || !buyer?.code) return;
    setCartonGenerating(true);
    try {
      const result = await generateCartonPlanFromWsp(buyer.code, orderId, true);
      if (!result?.applied) {
        notify(result?.message || 'Unable to generate Carton Master from Master Total ctns.', 'warning');
        return;
      }
      setCartonGenerateOpen(false);
      await Promise.all([loadMaster(), loadOrder()]);
      notify(`${result.message} Generated ${Number(result.createdCartons || 0).toLocaleString('en-US')} physical cartons. Use View Physical Cartons on a Master row to scan and assign barcodes.`);
    } catch (error) {
      notify(getApiError(error, 'Unable to generate Carton Master from Master Total ctns.'), 'error');
    } finally {
      setCartonGenerating(false);
    }
  };

  const runGenerate = async () => {
    if (!canWrite || !buyer?.code) return;
    setGenerating(true);
    try {
      const result = await generatePackingList(buyer.code, orderId, true);
      if (!result?.applied) {
        notify(result?.message || 'The Packing List could not be generated.', 'warning');
      } else {
        notify(`${result.message || 'Packing List generated.'} Created: ${result.created || 0}; skipped: ${result.skipped || 0}.`);
        setGenerateOpen(false);
        setPackingPage(0);
        setTab(1);
        await Promise.all([loadPacking(), loadOrder()]);
      }
    } catch (error) {
      notify(getApiError(error, 'Unable to generate the Packing List.'), 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (!buyer?.code) {
    return <Box sx={{ p: 2 }}><Alert severity="error">Buyer not found or access is not allowed.</Alert></Box>;
  }

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.4, md: 0.5 } }}>

      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.2} sx={{ mb: 1.4 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button component={RouterLink} to={assignmentWorkspace ? '/assign-barcode' : `/buyers/${buyer.slug}/orders`} size="small" startIcon={<ArrowBackOutlinedIcon />} sx={{ textTransform: 'none' }}>
              {assignmentWorkspace ? 'Back to Assign Barcode' : 'Back to Orders'}
            </Button>
            <Chip label={buyer.label} color="primary" size="small" />
          </Stack>
          <Typography sx={{ mt: 0.7, fontSize: '1rem', fontWeight: 750, color: '#103B5C' }}>
            {order?.orderName || '—'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="flex-start">
          <Chip
            size="small"
            label={`Assign: ${String(order?.assignmentStatus || 'NOT_STARTED').replaceAll('_', ' ')} · ${Number(order?.assignedCartonCount || 0).toLocaleString('en-US')}/${Number(order?.plannedCartonCount || 0).toLocaleString('en-US')}`}
            color={order?.assignmentStatus === 'COMPLETED' ? 'success' : order?.assignmentStatus === 'IN_PROGRESS' ? 'warning' : 'default'}
            variant={order?.assignmentStatus === 'COMPLETED' ? 'filled' : 'outlined'}
            sx={{ fontWeight: 750 }}
          />
          {canWrite && (
            <Tooltip title={order?.assignmentStatus === 'COMPLETED' ? 'Create a Sales Shipment Plan from assigned cartons' : 'Assign a Factory Barcode to every physical carton before Sales can create a Shipment Plan'}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<LocalShippingOutlinedIcon />}
                  disabled={order?.assignmentStatus !== 'COMPLETED'}
                  onClick={() => navigate(`/sales/shipment-planning?orderId=${encodeURIComponent(orderId)}`)}
                  sx={{ textTransform: 'none', bgcolor: '#103B5C' }}
                >
                  Sales Shipment Planning
                </Button>
              </span>
            </Tooltip>
          )}
          {order?.supplierName && <Chip size="small" label={`Supplier: ${order.supplierName}`} variant="outlined" />}
          {order?.supplierNumber && <Chip size="small" label={`e.s. Supplier #: ${order.supplierNumber}`} variant="outlined" />}
          {order?.productionFacility && <Chip size="small" label={`Facility: ${order.productionFacility}`} variant="outlined" />}
          {order?.orderDate && <Chip size="small" label={`Date: ${order.orderDate}`} color="primary" />}
          {order?.createdBy && <Chip size="small" label={`Created by: ${order.createdBy}`} variant="outlined" />}
        </Stack>
      </Stack>

      {!assignmentWorkspace && (
        <Paper elevation={0} sx={{ mb: 1.4, border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
            <Tab label={`Order Items (${Number(order?.masterLineCount || 0).toLocaleString('en-US')})`} />
            <Tab label={`Packing List (${Number(order?.packingLineCount || 0).toLocaleString()})`} />
          </Tabs>
        </Paper>
      )}

      {tab === 0 ? (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
            <Box>
              <Typography sx={{ fontWeight: 750, color: '#103B5C', fontSize: '1.06rem' }}>{assignmentWorkspace ? `Assign Barcode – ${buyer.label}` : `Sales · Master Data – ${buyer.label}`}</Typography>
              {!assignmentWorkspace && <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Upload the ALLOCATION sheet. The downloadable edit file includes ACTION values CREATE, UPDATE, DELETE and a KEY column for batch editing.</Typography>}
            </Box>
            {!assignmentWorkspace && (
              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={exportMaster} sx={{ textTransform: 'none' }}>Download Edit File</Button>
                <Tooltip title={canWrite ? '' : 'SALES permission is required'}><span>
                  <Button disabled={!canWrite} variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => { setMasterImportResult(null); setMasterImportOpen(true); }} sx={{ textTransform: 'none' }}>Upload Excel</Button>
                </span></Tooltip>
                <Tooltip title={canWrite ? '' : 'SALES permission is required'}><span>
                  <Button disabled={!canWrite} variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => { setMasterFormRecord(null); setMasterFormOpen(true); }} sx={{ textTransform: 'none' }}>Add Row</Button>
                </span></Tooltip>
                <Tooltip title={canWrite ? '' : 'SALES permission is required'}><span>
                  <Button disabled={!canWrite} color="secondary" variant="contained" startIcon={<PlaylistAddCheckOutlinedIcon />} onClick={() => setGenerateOpen(true)} sx={{ textTransform: 'none' }}>Generate Packing List</Button>
                </span></Tooltip>
                <Tooltip title={canWrite ? 'Generate one Carton Master row for each physical carton defined by Master Total ctns' : 'SALES permission is required'}><span>
                  <Button disabled={!canWrite} color="success" variant="contained" startIcon={<Inventory2OutlinedIcon />} onClick={() => setCartonGenerateOpen(true)} sx={{ textTransform: 'none' }}>Generate Carton Master</Button>
                </span></Tooltip>
              </Stack>
            )}
          </Stack>

          <Paper elevation={0} sx={{ p: 1, mb: 0.7, border: '1px solid #DCE4EC', borderRadius: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
              <TextField size="small" label="General keyword" value={masterFilters.keyword} onChange={(event) => setMasterFilters((current) => ({ ...current, keyword: event.target.value }))} />
              <TextField size="small" label="e.s. PO #" value={masterFilters.poNumber} onChange={(event) => setMasterFilters((current) => ({ ...current, poNumber: event.target.value }))} />
              <TextField size="small" label="e.s. Article #" value={masterFilters.articleNumber} onChange={(event) => setMasterFilters((current) => ({ ...current, articleNumber: event.target.value }))} />
              <TextField size="small" label="STYLE# or STYLE" value={masterFilters.styleNumber} onChange={(event) => setMasterFilters((current) => ({ ...current, styleNumber: event.target.value }))} />
              <TextField size="small" label="Color" value={masterFilters.color} onChange={(event) => setMasterFilters((current) => ({ ...current, color: event.target.value }))} />
              <TextField size="small" label="Size" value={masterFilters.sizeValue} onChange={(event) => setMasterFilters((current) => ({ ...current, sizeValue: event.target.value }))} />
              <TextField size="small" label="Mode of shipment" value={masterFilters.shipmentMode} onChange={(event) => setMasterFilters((current) => ({ ...current, shipmentMode: event.target.value }))} />
              <TextField size="small" label="STATUS" value={masterFilters.status} onChange={(event) => setMasterFilters((current) => ({ ...current, status: event.target.value }))} />
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
              <Button variant="contained" startIcon={<SearchOutlinedIcon />} onClick={() => { setMasterApplied(masterFilters); setMasterPage(0); }} sx={{ textTransform: 'none' }}>Search</Button>
              <Button variant="outlined" startIcon={<RestartAltOutlinedIcon />} onClick={() => { setMasterFilters(emptyMasterFilters); setMasterApplied(emptyMasterFilters); setMasterPage(0); }} sx={{ textTransform: 'none' }}>Reset</Button>
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1, mb: 1.3 }}>
            {[
              ['Total rows', masterTotal], ['PCS on page', masterTotals.pcs], ['CTNS on page', masterTotals.cartons],
              ['AIR PCS on page', masterTotals.pcsAir], ['SEA PCS on page', masterTotals.pcsSea]
            ].map(([label, value]) => summaryCard(label, value))}
          </Box>

          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 470px)', minHeight: 300 }}>
              <SortableTable stickyHeader size="small" sx={{ minWidth: 3600 }}>
                <TableHead><TableRow>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 5, bgcolor: '#eaf1f6', fontWeight: 750, minWidth: 70 }}>No.</TableCell>
                  {PACKING_ALLOCATION_FIELDS.map((field) => <TableCell key={field.name} sx={{ bgcolor: '#eaf1f6', fontWeight: 750, minWidth: field.width, whiteSpace: 'nowrap' }}>{field.label}</TableCell>)}
                  <TableCell align="center" sx={{ position: 'sticky', right: 0, zIndex: 5, bgcolor: '#eaf1f6', fontWeight: 750, minWidth: 100 }}>Actions</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {masterLoading && <TableRow><TableCell colSpan={PACKING_ALLOCATION_FIELDS.length + 2} align="center" sx={{ py: 4 }}>Loading Order Items...</TableCell></TableRow>}
                  {!masterLoading && masterRows.length === 0 && <TableRow><TableCell colSpan={PACKING_ALLOCATION_FIELDS.length + 2} align="center" sx={{ py: 4, color: 'text.secondary' }}>No matching Order Items.</TableCell></TableRow>}
                  {!masterLoading && masterRows.map((row, index) => <TableRow
                    key={row.id}
                    hover
                  >
                    <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>{masterPage * 50 + index + 1}</TableCell>
                    {PACKING_ALLOCATION_FIELDS.map((field) => <TableCell key={field.name} sx={{ minWidth: field.width, maxWidth: field.name === 'style' ? 340 : field.width + 80, whiteSpace: ['style', 'remarks'].includes(field.name) ? 'normal' : 'nowrap' }}>{formatPackingValue(row[field.name], field.type)}</TableCell>)}
                    <TableCell align="center" sx={{ position: 'sticky', right: 0, zIndex: 2, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>
                      <Tooltip title={`View physical cartons for this Master row`}><span><IconButton color="primary" onClick={(event) => { event.stopPropagation(); openCartonItem(row); }}><Inventory2OutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                      {!assignmentWorkspace && <>
                        <Tooltip title={canWrite ? 'Edit row' : 'SALES permission is required'}><span><IconButton disabled={!canWrite} onClick={(event) => { event.stopPropagation(); setMasterFormRecord(row); setMasterFormOpen(true); }}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                        <Tooltip title={canWrite ? 'Delete row' : 'SALES permission is required'}><span><IconButton disabled={!canWrite} color="error" onClick={(event) => { event.stopPropagation(); setMasterDeleteTarget(row); }}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                      </>}
                    </TableCell>
                  </TableRow>)}
                </TableBody>
              </SortableTable>
            </TableContainer>
          </Paper>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.3 }}>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Total: {masterTotal} rows</Typography>
            <Pagination page={masterPage + 1} count={masterPages} onChange={(_, value) => setMasterPage(value - 1)} />
          </Stack>
        </>
      ) : (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1.2 }}>
            <Box>
              <Typography sx={{ fontWeight: 750, color: '#103B5C', fontSize: '1.06rem' }}>Packing List</Typography>
            </Box>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={exportPacking} sx={{ textTransform: 'none' }}>Download</Button>
              <Tooltip title={canWrite ? '' : 'SALES permission is required'}><span>
                <Button disabled={!canWrite} variant="outlined" startIcon={<UploadFileOutlinedIcon />} onClick={() => { setPackingImportResult(null); setPackingImportOpen(true); }} sx={{ textTransform: 'none' }}>Upload PKL</Button>
              </span></Tooltip>
              <Tooltip title={canWrite ? '' : 'SALES permission is required'}><span>
                <Button disabled={!canWrite} variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => { setPackingFormRecord(null); setPackingFormOpen(true); }} sx={{ textTransform: 'none' }}>Add Row</Button>
              </span></Tooltip>
              <Tooltip title={canWrite ? '' : 'SALES permission is required'}><span>
                <Button disabled={!canWrite} color="secondary" variant="contained" startIcon={<PlaylistAddCheckOutlinedIcon />} onClick={() => setGenerateOpen(true)} sx={{ textTransform: 'none' }}>Regenerate from Master</Button>
              </span></Tooltip>
            </Stack>
          </Stack>

          <Paper elevation={0} sx={{ p: 1, mb: 0.7, border: '1px solid #DCE4EC', borderRadius: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
              <TextField size="small" label="General keyword" value={packingFilters.keyword} onChange={(event) => setPackingFilters((current) => ({ ...current, keyword: event.target.value }))} />
              <TextField size="small" label="P.O. #" value={packingFilters.poNumber} onChange={(event) => setPackingFilters((current) => ({ ...current, poNumber: event.target.value }))} />
              <TextField size="small" label="Art.no." value={packingFilters.articleNumber} onChange={(event) => setPackingFilters((current) => ({ ...current, articleNumber: event.target.value }))} />
              <TextField size="small" label="Style # or Style" value={packingFilters.styleNumber} onChange={(event) => setPackingFilters((current) => ({ ...current, styleNumber: event.target.value }))} />
              <TextField size="small" label="Color" value={packingFilters.color} onChange={(event) => setPackingFilters((current) => ({ ...current, color: event.target.value }))} />
              <TextField size="small" label="Size" value={packingFilters.sizeValue} onChange={(event) => setPackingFilters((current) => ({ ...current, sizeValue: event.target.value }))} />
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
              <Button variant="contained" startIcon={<SearchOutlinedIcon />} onClick={() => { setPackingApplied(packingFilters); setPackingPage(0); }} sx={{ textTransform: 'none' }}>Search</Button>
              <Button variant="outlined" startIcon={<RestartAltOutlinedIcon />} onClick={() => { setPackingFilters(emptyPackingFilters); setPackingApplied(emptyPackingFilters); setPackingPage(0); }} sx={{ textTransform: 'none' }}>Reset</Button>
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1, mb: 1.3 }}>
            {[
              ['Total rows', packingTotal], ['PCS on page', packingTotals.pcs], ['CTNS on page', packingTotals.cartons],
              ['CBM on page', packingTotals.cbm], ['Gross weight on page', packingTotals.grossWeight]
            ].map(([label, value]) => summaryCard(label, value))}
          </Box>

          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 470px)', minHeight: 300 }}>
              <SortableTable stickyHeader size="small" sx={{ minWidth: 2350 }}>
                <TableHead><TableRow>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 5, bgcolor: '#eaf1f6', fontWeight: 750, minWidth: 70 }}>No.</TableCell>
                  {PACKING_LIST_FIELDS.map((field) => <TableCell key={field.name} sx={{ bgcolor: '#eaf1f6', fontWeight: 750, minWidth: field.width, whiteSpace: 'nowrap' }}>{field.label}</TableCell>)}
                  <TableCell align="center" sx={{ position: 'sticky', right: 0, zIndex: 5, bgcolor: '#eaf1f6', fontWeight: 750, minWidth: 100 }}>Actions</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {packingLoading && <TableRow><TableCell colSpan={PACKING_LIST_FIELDS.length + 2} align="center" sx={{ py: 4 }}>Loading Packing List...</TableCell></TableRow>}
                  {!packingLoading && packingRows.length === 0 && <TableRow><TableCell colSpan={PACKING_LIST_FIELDS.length + 2} align="center" sx={{ py: 4, color: 'text.secondary' }}>No matching Packing List rows.</TableCell></TableRow>}
                  {!packingLoading && packingRows.map((row, index) => <TableRow key={row.id} hover>
                    <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>{packingPage * 50 + index + 1}</TableCell>
                    {PACKING_LIST_FIELDS.map((field) => <TableCell key={field.name} sx={{ minWidth: field.width, maxWidth: field.name === 'style' ? 340 : field.width + 80, whiteSpace: ['style', 'remarks'].includes(field.name) ? 'normal' : 'nowrap' }}>{formatPackingValue(row[field.name], field.type)}</TableCell>)}
                    <TableCell align="center" sx={{ position: 'sticky', right: 0, zIndex: 2, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>
                      <Tooltip title={canWrite ? 'Edit row' : 'SALES permission is required'}><span><IconButton disabled={!canWrite} onClick={() => { setPackingFormRecord(row); setPackingFormOpen(true); }}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                      <Tooltip title={canWrite ? 'Delete row' : 'SALES permission is required'}><span><IconButton disabled={!canWrite} color="error" onClick={() => setPackingDeleteTarget(row)}><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                    </TableCell>
                  </TableRow>)}
                </TableBody>
              </SortableTable>
            </TableContainer>
          </Paper>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.3 }}>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Total: {packingTotal} rows</Typography>
            <Pagination page={packingPage + 1} count={packingPages} onChange={(_, value) => setPackingPage(value - 1)} />
          </Stack>
        </>
      )}

      <PackingAllocationFormDialog open={masterFormOpen} record={masterFormRecord} saving={masterSaving} onClose={() => { setMasterFormOpen(false); setMasterFormRecord(null); }} onSave={saveMaster} />
      <PackingAllocationImportDialog open={masterImportOpen} importing={masterImporting} result={masterImportResult} onClose={() => setMasterImportOpen(false)} onImport={importMaster} />
      <PackingListLineFormDialog open={packingFormOpen} record={packingFormRecord} saving={packingSaving} onClose={() => { setPackingFormOpen(false); setPackingFormRecord(null); }} onSave={savePacking} />
      <PackingListImportDialog open={packingImportOpen} importing={packingImporting} result={packingImportResult} onClose={() => setPackingImportOpen(false)} onImport={importPacking} />

      <Dialog
        open={cartonItemOpen}
        onClose={() => !cartonAssigningId && setCartonItemOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ fontWeight: 750, pb: 1 }}>
          Physical Cartons · Article {cartonItemRow?.articleNumber || '—'}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          <Stack spacing={1.25}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`PO: ${cartonItemRow?.poNumber || '—'}`} />
              <Chip size="small" label={`Size: ${cartonItemRow?.size || '—'}`} />
              <Chip size="small" label={`Color: ${cartonItemRow?.color || '—'}`} />
              <Chip size="small" label={`Qty Per Ctn: ${cartonItemRow?.qtyPerCarton ?? '—'}`} />
              <Chip size="small" color="primary" label={`Total ctns: ${cartonItemExpectedCount.toLocaleString('en-US')}`} sx={{ fontWeight: 750 }} />
              <Chip
                size="small"
                color={cartonItemCountMatches ? 'success' : 'warning'}
                variant="outlined"
                label={`Generated: ${cartonItemGeneratedCount.toLocaleString('en-US')} physical cartons`}
              />
              <Chip
                size="small"
                color={cartonItemAssignmentStatus === 'COMPLETED' ? 'success' : cartonItemAssignmentStatus === 'IN PROGRESS' ? 'warning' : 'default'}
                variant={cartonItemAssignmentStatus === 'COMPLETED' ? 'filled' : 'outlined'}
                label={`Assigned ${cartonItemAssignedCount.toLocaleString('en-US')}/${Math.max(cartonItemExpectedCount, cartonItemGeneratedCount).toLocaleString('en-US')} · ${cartonItemAssignmentStatus}`}
                sx={{ fontWeight: 750 }}
              />
            </Stack>

            <Alert severity="info" sx={{ py: 0.35 }}>
              Total ctns is the source of truth for the number of physical cartons. Qty Per Ctn is only the planned quantity inside each carton. Assign exactly one Factory Barcode to each physical carton.
            </Alert>

            {!cartonItemLoading && cartonItemExpectedCount > 0 && !cartonItemCountMatches && (
              <Alert severity="warning" sx={{ py: 0.35 }}>
                This Master row expects {cartonItemExpectedCount.toLocaleString('en-US')} physical cartons from Total ctns, but {cartonItemGeneratedCount.toLocaleString('en-US')} are currently generated. Regenerate Carton Master before assigning barcodes.
              </Alert>
            )}

            {cartonItemLoading ? (
              <Box textAlign="center" py={5}><CircularProgress /></Box>
            ) : cartonItemChildren.length ? (
              <Paper elevation={0} sx={{ border: '1px solid #DCE4EC', borderRadius: 1.5, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 480 }}>
                  <SortableTable stickyHeader size="small" sx={{ minWidth: 1120 }}>
                    <TableHead>
                      <TableRow>
                        {['No.', 'Physical Carton', 'CTN No.', 'Planned Qty', 'Assign Status', 'Factory Barcode', 'Weight', 'Weight Status', 'Action'].map((label) => (
                          <TableCell key={label} sx={{ bgcolor: '#EAF1F6', fontWeight: 750, whiteSpace: 'nowrap' }}>{label}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cartonItemChildren.map((carton, index) => {
                        const completed = ['COMPLETED', 'WEIGHT_WARNING'].includes(carton.status);
                        const weightStarted = carton.status === 'WAITING_WEIGHT' || completed || carton.weightKg != null || carton.scannedAt || carton.weighedAt;
                        const canAssign = assignmentWorkspace && canAssignOperation && cartonItemCountMatches && !carton.factoryBarcode && carton.status === 'PLANNED';
                        const canUnassign = assignmentWorkspace && canAssignOperation && Boolean(carton.factoryBarcode) && carton.status === 'PLANNED';
                        const canCorrectWeight = assignmentWorkspace && adminUser && weightStarted;
                        return (
                          <TableRow key={carton.id} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{index + 1}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: '#103B5C' }}>
                                {carton.cartonCode || `Carton #${carton.cartonSequence || '—'}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {carton.cartonSequence || '—'} / {carton.plannedCartons || cartonItemChildren.length}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{carton.cartonNumber ?? '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>{carton.cartonPcs ?? carton.qtyPerCarton ?? cartonItemRow?.qtyPerCarton ?? '—'}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={carton.factoryBarcode ? 'ASSIGNED' : 'NOT ASSIGNED'}
                                color={carton.factoryBarcode ? 'success' : 'default'}
                                variant={carton.factoryBarcode ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: carton.factoryBarcode ? 750 : 500, whiteSpace: 'nowrap' }}>
                              {carton.factoryBarcode || 'Unassigned'}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {carton.weightKg != null
                                ? `${Number(carton.weightKg).toLocaleString('en-US', { maximumFractionDigits: 3 })} kg`
                                : '—'}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Chip
                                size="small"
                                label={carton.status === 'WAITING_WEIGHT'
                                  ? 'WAITING'
                                  : ['UNDER', 'OVER'].includes(carton.weightStatus)
                                    ? 'FAIL'
                                    : carton.weightStatus === 'OK'
                                      ? 'PASS'
                                      : completed ? 'COMPLETED' : 'NOT WEIGHED'}
                                color={carton.weightStatus === 'OK' ? 'success' : ['UNDER', 'OVER'].includes(carton.weightStatus) ? 'error' : carton.status === 'WAITING_WEIGHT' ? 'warning' : 'default'}
                                variant={carton.weightStatus === 'OK' || ['UNDER', 'OVER'].includes(carton.weightStatus) ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {canCorrectWeight ? (
                                <Button
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  startIcon={<BuildCircleOutlinedIcon />}
                                  onClick={() => { setCartonCorrectionTarget(carton); setCartonCorrectionReason(''); }}
                                  disabled={Boolean(cartonAssigningId)}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Reset Weight
                                </Button>
                              ) : canAssign ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<AssignmentTurnedInOutlinedIcon />}
                                  onClick={() => startCartonAssignment(carton)}
                                  disabled={Boolean(cartonAssigningId)}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Assign Barcode
                                </Button>
                              ) : canUnassign ? (
                                <Button
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  startIcon={cartonAssigningId === carton.id ? <CircularProgress size={14} color="inherit" /> : <LinkOffOutlinedIcon />}
                                  onClick={() => unassignCartonBarcode(carton)}
                                  disabled={Boolean(cartonAssigningId)}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Unassign
                                </Button>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  {weightStarted ? 'Barcode locked for this weighed carton' : carton.factoryBarcode ? 'Assigned' : 'Not assignable'}
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </SortableTable>
                </TableContainer>
              </Paper>
            ) : (
              <Alert severity="warning">
                No physical cartons are available for this Master row. Generate Carton Master from Master Total ctns first.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 1.5, py: 1 }}>
          <Button onClick={() => setCartonItemOpen(false)} disabled={Boolean(cartonAssigningId)} sx={{ textTransform: 'none' }}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<QrCodeScannerOutlinedIcon />}
            onClick={() => cartonItemRow?.id && navigate(`/buyers/${buyer.slug}/orders/${orderId}/items/${cartonItemRow.id}`)}
            sx={{ textTransform: 'none' }}
          >
            Open Item Page
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(cartonAssignTarget)} onClose={closeCartonAssignment} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 750 }}>Assign Factory Barcode</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.25}>
            <Paper elevation={0} sx={{ p: 1.2, border: '1px solid #DCE4EC', borderRadius: 1.5, bgcolor: '#F8FAFC' }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 650 }}>Selected physical carton</Typography>
              <Typography sx={{ mt: 0.3, fontSize: '1rem', color: '#103B5C', fontWeight: 800 }}>
                {cartonAssignTarget?.cartonCode || `Carton #${cartonAssignTarget?.cartonSequence || '—'}`}
              </Typography>
              <Typography sx={{ mt: 0.35, fontSize: '0.75rem', color: 'text.secondary' }}>
                Article {cartonItemRow?.articleNumber || '—'} · Size {cartonItemRow?.size || '—'} · Qty Per Ctn {cartonAssignTarget?.cartonPcs ?? cartonAssignTarget?.qtyPerCarton ?? cartonItemRow?.qtyPerCarton ?? '—'}
              </Typography>
            </Paper>

            {cartonAssignError && <Alert severity="error">{cartonAssignError}</Alert>}
            {cartonAssignNotice && <Alert severity="success">{cartonAssignNotice}</Alert>}

            <TextField label="Production line (optional)" value={productionLine} onChange={(event) => setProductionLine(event.target.value)} disabled={Boolean(cartonAssigningId)} fullWidth />
            <TextField label="Actual quantity in carton" type="number" value={assignedQuantity} onChange={(event) => setAssignedQuantity(event.target.value)} disabled={Boolean(cartonAssigningId)} inputProps={{ min: 1, step: 1 }} helperText="Confirm the quantity. If it differs from the plan, ask Sales to correct the plan first." fullWidth required />

            <TextField
              inputRef={cartonBarcodeInputRef}
              autoFocus
              fullWidth
              label="Scan Factory Barcode"
              value={cartonBarcode}
              onChange={(event) => {
                setCartonBarcode(event.target.value);
                setCartonCheckedBarcode(null);
                setCartonAssignError('');
                setCartonAssignNotice('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  checkCartonBarcode();
                }
              }}
              disabled={cartonBarcodeChecking || Boolean(cartonAssigningId)}
              helperText="Scan with the barcode scanner or type the code, then press Enter to verify availability."
              InputProps={{
                endAdornment: cartonBarcodeChecking ? <CircularProgress size={18} /> : null
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 1.5, py: 1 }}>
          <Button onClick={closeCartonAssignment} disabled={cartonBarcodeChecking || Boolean(cartonAssigningId)} sx={{ textTransform: 'none' }}>Cancel</Button>
          {!cartonCheckedBarcode ? (
            <Button
              variant="outlined"
              startIcon={<QrCodeScannerOutlinedIcon />}
              onClick={checkCartonBarcode}
              disabled={!cartonBarcode.trim() || cartonBarcodeChecking || Boolean(cartonAssigningId)}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Verify Barcode
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={cartonAssigningId ? <CircularProgress size={15} color="inherit" /> : <AssignmentTurnedInOutlinedIcon />}
              onClick={assignBarcodeToSelectedCarton}
              disabled={Boolean(cartonAssigningId)}
              sx={{ textTransform: 'none', fontWeight: 750 }}
            >
              Assign Barcode
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(cartonCorrectionTarget)} onClose={cartonCorrectionSaving ? undefined : () => setCartonCorrectionTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 750 }}>Reset Weight Check for this carton?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1.4 }}>
            Admin correction affects only this physical carton. Other cartons in the Order remain unchanged. The assigned Factory Barcode is kept until you explicitly Unassign it.
          </Alert>
          <Typography sx={{ mb: 1.2, fontSize: '0.82rem', color: '#41566E' }}>
            {cartonCorrectionTarget?.cartonCode || `Carton #${cartonCorrectionTarget?.cartonSequence || '—'}`} · Barcode {cartonCorrectionTarget?.factoryBarcode || '—'} · Current weight {cartonCorrectionTarget?.weightKg != null ? `${cartonCorrectionTarget.weightKg} kg` : 'waiting'}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            required
            label="Correction reason"
            value={cartonCorrectionReason}
            onChange={(event) => setCartonCorrectionReason(event.target.value)}
            placeholder="Example: Wrong barcode/carton mapping, recheck required"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCartonCorrectionTarget(null)} disabled={cartonCorrectionSaving} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={correctWeightedCarton} disabled={cartonCorrectionSaving || !cartonCorrectionReason.trim()} sx={{ textTransform: 'none', fontWeight: 750 }}>
            {cartonCorrectionSaving ? 'Resetting...' : 'Reset Weight'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(masterDeleteTarget)} onClose={() => setMasterDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Order Item?</DialogTitle>
        <DialogContent><Typography>Delete Article <strong>{masterDeleteTarget?.articleNumber}</strong>, Size <strong>{masterDeleteTarget?.size}</strong> from this Order?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setMasterDeleteTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button><Button color="error" variant="contained" onClick={removeMaster} sx={{ textTransform: 'none' }}>Delete</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(packingDeleteTarget)} onClose={() => setPackingDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Packing List Row?</DialogTitle>
        <DialogContent><Typography>Delete carton range <strong>{formatPackingValue(packingDeleteTarget?.cartonFrom, 'number')}–{formatPackingValue(packingDeleteTarget?.cartonTo, 'number')}</strong>, Article <strong>{packingDeleteTarget?.articleNumber}</strong>?</Typography></DialogContent>
        <DialogActions><Button onClick={() => setPackingDeleteTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button><Button color="error" variant="contained" onClick={removePacking} sx={{ textTransform: 'none' }}>Delete</Button></DialogActions>
      </Dialog>

      <Dialog open={generateOpen} onClose={generating ? undefined : () => setGenerateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Generate Packing List from Order Items?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 1.4 }}>The current Packing List rows will be replaced.</Alert>
          <Typography>
            The Packing List will use Master Total ctns and Total pcs. Carton measurement and weight fields can be edited after generation.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)} disabled={generating} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={runGenerate} disabled={generating} variant="contained" color="secondary" sx={{ textTransform: 'none' }}>{generating ? 'Generating...' : 'Generate Packing List'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cartonGenerateOpen} onClose={cartonGenerating ? undefined : () => setCartonGenerateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 700 }}>Generate physical cartons from Master Total ctns?</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 1.4 }}>Each generated row represents one physical carton. Master Total ctns controls the number of rows; Qty Per Ctn controls only the planned pieces inside each carton.</Alert>
          <Typography>
            The existing Carton Master will be regenerated only when barcode assignment, scanning, or weighing has not started. After generation, use View Physical Cartons on the correct Master row. Barcode assignment is performed only inside that row's physical-carton list.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCartonGenerateOpen(false)} disabled={cartonGenerating}>Cancel</Button>
          <Button onClick={runGenerateCartons} disabled={cartonGenerating} variant="contained" color="success">{cartonGenerating ? 'Generating...' : 'Generate Carton Master'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={notice.open} autoHideDuration={4500} onClose={() => setNotice((current) => ({ ...current, open: false }))}>
        <Alert severity={notice.severity} variant="filled">{notice.message}</Alert>
      </Snackbar>
    </Box>
  );
}
