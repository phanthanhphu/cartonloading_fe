import { DEFAULT_TABLE_PAGE_SIZE, OPERATION_ROUTE, BARCODE_CARTON_STATUS, COMMON_FILTER, PROGRESS_STATUS } from '../../../../constants/appConstants';
import SortableTable from 'components/SortableTable';
import { quantityMatchesPlan } from 'buyers/es/domain/workflow';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Divider,
  Paper,
  Stack,
  
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  ArrowBackOutlined,
  AssignmentTurnedInOutlined,
  CheckCircleOutlined,
  Inventory2Outlined,
  LinkOffOutlined,
  QrCodeScannerOutlined,
  RefreshOutlined
} from '@mui/icons-material';
import { APP_MESSAGES, createFactoryBarcodeAssignedMessage, createFactoryBarcodeAssignedNextMessage, createFactoryBarcodeAvailableMessage, createFactoryBarcodeReleasedMessage, createQuantityMismatchMessage, createUnassignFactoryBarcodeConfirmMessage } from '../../../../constants/appMessages';

import {
  assignFactoryBarcodeToCarton,
  checkFactoryBarcodeForAssignment,
  listCartonsForItem,
  listMasterRowsForBarcodeAssignment,
  unassignFactoryBarcodeFromCarton
} from 'buyers/es/services/cartonLoadingService';
import { getPackingOrder } from 'buyers/es/services/packingListService';
import { getBuyerBySlug } from 'utils/buyerAccess';
import TableFilterBar from 'components/TableFilterBar';



const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const valueText = (value) => value === null || value === undefined || value === '' ? '—' : String(value);

const numberText = (value) => Number(value || 0).toLocaleString('en-US');

const statusLabel = (value) => String(value || PROGRESS_STATUS.NOT_STARTED).replaceAll('_', ' ');

const statusChip = (value) => {
  switch (String(value || '').toUpperCase()) {
    case PROGRESS_STATUS.COMPLETED: return { color: 'success', variant: 'filled' };
    case PROGRESS_STATUS.IN_PROGRESS: return { color: 'warning', variant: 'filled' };
    case BARCODE_CARTON_STATUS.PLAN_MISMATCH: return { color: 'error', variant: 'filled' };
    default: return { color: 'default', variant: 'outlined' };
  }
};

const plannedQuantityOf = (carton) => carton?.cartonPcs ?? carton?.qtyPerCarton ?? null;

export default function BarcodeAssignmentPage() {
  const { buyerSlug, orderId } = useParams();
  const navigate = useNavigate();
  const buyer = getBuyerBySlug(buyerSlug);
  const actualInputRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const requestRef = useRef(0);

  const [order, setOrder] = useState(null);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ poNumber: '', articleNumber: '', styleNumber: '', style: '', assignmentStatus: '' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [totalElements, setTotalElements] = useState(0);
  const [summary, setSummary] = useState({ expected: 0, generated: 0, assigned: 0 });
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [loadingRows, setLoadingRows] = useState(true);
  const [pageError, setPageError] = useState('');
  const [pageNotice, setPageNotice] = useState('');

  const [selectedMaster, setSelectedMaster] = useState(null);
  const [cartons, setCartons] = useState([]);
  const [selectedCarton, setSelectedCarton] = useState(null);
  const [loadingCartons, setLoadingCartons] = useState(false);
  const [actualQuantity, setActualQuantity] = useState('');
  const [productionLine, setProductionLine] = useState('');
  const [barcode, setBarcode] = useState('');
  const [checkedBarcode, setCheckedBarcode] = useState(null);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailNotice, setDetailNotice] = useState('');

  const eligibleCartons = useMemo(() => cartons.filter((carton) => (
    !carton.factoryBarcode
    && !carton.shipmentId
    && carton.status === BARCODE_CARTON_STATUS.PLANNED
  )), [cartons]);

  const plannedQuantity = plannedQuantityOf(selectedCarton);
  const quantityEntered = String(actualQuantity ?? '').trim() !== '';
  const quantityValid = Boolean(selectedCarton) && quantityMatchesPlan(actualQuantity, plannedQuantity);
  const quantityMismatch = Boolean(selectedCarton) && quantityEntered && !quantityValid;
  const assignedInSelected = cartons.filter((carton) => Boolean(carton.factoryBarcode)).length;

  const focusActualQuantity = useCallback(() => {
    window.setTimeout(() => actualInputRef.current?.focus(), 100);
  }, []);

  const focusBarcode = useCallback(() => {
    window.setTimeout(() => barcodeInputRef.current?.focus(), 100);
  }, []);

  const resetCartonEntry = useCallback(() => {
    setSelectedCarton(null);
    setActualQuantity('');
    setBarcode('');
    setCheckedBarcode(null);
    setDetailError('');
  }, []);

  const loadOrder = useCallback(async () => {
    if (!buyer?.code || !orderId) return;
    setLoadingOrder(true);
    try {
      setOrder(await getPackingOrder(buyer.code, orderId));
    } catch (error) {
      setPageError(getErrorMessage(error, APP_MESSAGES.LOAD_ORDER_INFO_FAILED));
    } finally {
      setLoadingOrder(false);
    }
  }, [buyer?.code, orderId]);

  const loadMasterRows = useCallback(async ({ keepNotice = true } = {}) => {
    if (!buyer?.code || !orderId) return;
    const requestId = ++requestRef.current;
    setLoadingRows(true);
    setPageError('');
    if (!keepNotice) setPageNotice('');
    try {
      const response = await listMasterRowsForBarcodeAssignment(buyer.code, orderId, {
        poNumber: debouncedFilters.poNumber || undefined,
        articleNumber: debouncedFilters.articleNumber || undefined,
        styleNumber: debouncedFilters.styleNumber || undefined,
        style: debouncedFilters.style || undefined,
        assignmentStatus: debouncedFilters.assignmentStatus || COMMON_FILTER.ALL,
        page,
        size: pageSize
      });
      if (requestId !== requestRef.current) return;
      setRows(Array.isArray(response?.content) ? response.content : []);
      setTotalElements(Number(response?.totalElements || 0));
      setSummary({
        expected: Number(response?.totalExpectedCartons || 0),
        generated: Number(response?.totalGeneratedCartons || 0),
        assigned: Number(response?.totalAssignedCartons || 0)
      });
      if (Number.isInteger(response?.page) && response.page !== page) setPage(response.page);
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setRows([]);
      setTotalElements(0);
      setPageError(getErrorMessage(error, APP_MESSAGES.LOAD_MASTER_ROWS_FAILED));
    } finally {
      if (requestId === requestRef.current) setLoadingRows(false);
    }
  }, [buyer?.code, orderId, debouncedFilters, page, pageSize]);

  const loadMasterCartons = useCallback(async (master, { resetEntry = true } = {}) => {
    if (!buyer?.code || !orderId || !master?.masterLineId) return;
    setLoadingCartons(true);
    setDetailError('');
    try {
      const data = await listCartonsForItem(buyer.code, orderId, master.masterLineId);
      const nextRows = Array.isArray(data) ? [...data] : [];
      nextRows.sort((a, b) => Number(a.cartonSequence || 0) - Number(b.cartonSequence || 0));
      setCartons(nextRows);
      if (resetEntry) resetCartonEntry();
    } catch (error) {
      setCartons([]);
      setDetailError(getErrorMessage(error, APP_MESSAGES.LOAD_PHYSICAL_CARTONS_FAILED));
    } finally {
      setLoadingCartons(false);
    }
  }, [buyer?.code, orderId, resetCartonEntry]);

  useEffect(() => { loadOrder(); }, [loadOrder]);
  useEffect(() => { loadMasterRows(); }, [loadMasterRows]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setDebouncedFilters(filters);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (selectedMaster && !loadingCartons && eligibleCartons.length > 0 && !checkedBarcode) focusBarcode();
  }, [selectedMaster, loadingCartons, eligibleCartons.length, checkedBarcode, focusBarcode]);

  useEffect(() => {
    if (checkedBarcode && selectedCarton) focusActualQuantity();
  }, [checkedBarcode, selectedCarton?.id, focusActualQuantity]);

  const openMaster = async (master) => {
    setSelectedMaster(master);
    setCartons([]);
    setDetailNotice('');
    resetCartonEntry();
    await loadMasterCartons(master);
  };

  const closeMaster = () => {
    if (assigning || checkingBarcode) return;
    setSelectedMaster(null);
    setCartons([]);
    setDetailNotice('');
    resetCartonEntry();
  };

  const checkBarcode = async () => {
    const code = barcode.trim();
    if (!buyer?.code || !code || checkingBarcode || assigning) return;
    setCheckingBarcode(true);
    setDetailError('');
    setDetailNotice('');
    setCheckedBarcode(null);
    try {
      const result = await checkFactoryBarcodeForAssignment(buyer.code, orderId, code);
      setCheckedBarcode(result);
      setBarcode(result?.barcode || code);
      setSelectedCarton(null);
      setActualQuantity('');
        setDetailNotice(createFactoryBarcodeAvailableMessage(result?.barcode || code));
    } catch (error) {
      setDetailError(getErrorMessage(error, APP_MESSAGES.BARCODE_ASSIGNMENT_UNAVAILABLE));
      focusBarcode();
    } finally {
      setCheckingBarcode(false);
    }
  };

  const assignCurrentCarton = async () => {
    if (!buyer?.code || !selectedMaster || !selectedCarton || !checkedBarcode?.barcode || assigning) return;
    if (!quantityValid) {
      setDetailError(createQuantityMismatchMessage(valueText(plannedQuantity)));
      focusActualQuantity();
      return;
    }

    setAssigning(true);
    setDetailError('');
    setDetailNotice('');
    try {
      const assigned = await assignFactoryBarcodeToCarton(buyer.code, orderId, {
        factoryBarcode: checkedBarcode.barcode,
        cartonId: selectedCarton.id,
        actualQuantity: Number(actualQuantity),
        productionLine: productionLine.trim() || null
      });

      const successMessage = createFactoryBarcodeAssignedMessage(assigned.cartonCode || `Carton ${assigned.cartonSequence}`, checkedBarcode.barcode);
      setPageNotice(successMessage);
      await Promise.all([
        loadMasterRows(),
        loadMasterCartons(selectedMaster)
      ]);
      resetCartonEntry();
      setDetailNotice(createFactoryBarcodeAssignedNextMessage(successMessage));
    } catch (error) {
      setDetailError(getErrorMessage(error, APP_MESSAGES.PACK_ASSIGN_CARTON_FAILED));
    } finally {
      setAssigning(false);
    }
  };

  const unassign = async (carton) => {
    if (!buyer?.code || !selectedMaster || !carton?.factoryBarcode || assigning) return;
    if (!window.confirm(createUnassignFactoryBarcodeConfirmMessage(carton.factoryBarcode, carton.cartonCode || 'this physical carton'))) return;
    setAssigning(true);
    setDetailError('');
    try {
      await unassignFactoryBarcodeFromCarton(buyer.code, orderId, carton.id);
      setDetailNotice(createFactoryBarcodeReleasedMessage(carton.factoryBarcode));
      await Promise.all([
        loadMasterRows(),
        loadMasterCartons(selectedMaster)
      ]);
    } catch (error) {
      setDetailError(getErrorMessage(error, APP_MESSAGES.UNASSIGN_FACTORY_BARCODE_FAILED));
    } finally {
      setAssigning(false);
    }
  };

  const refresh = async () => {
    await Promise.all([loadOrder(), loadMasterRows({ keepNotice: false })]);
    if (selectedMaster) await loadMasterCartons(selectedMaster, { resetEntry: false });
  };

  if (!buyer) return <Alert severity="warning">{APP_MESSAGES.BUYER_NOT_IDENTIFIED}</Alert>;

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.4, md: 0.5 }, width: '100%' }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} spacing={0.9} sx={{ mb: 0.9 }}>
        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button size="small" startIcon={<ArrowBackOutlined />} onClick={() => navigate(OPERATION_ROUTE.ASSIGN_BARCODE)}>Back</Button>
          <Box>
            <Typography sx={{ fontWeight: 850, color: '#103B5C', fontSize: '1.05rem' }}>Assign Barcode for Carton</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {loadingOrder ? 'Loading Order...' : (order?.orderName || 'Order')} · Select Master Data first, then assign one Factory Barcode to each physical carton.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip label={`Expected ${numberText(summary.expected)}`} color="primary" variant="outlined" />
          <Chip label={`Generated ${numberText(summary.generated)}`} variant="outlined" />
          <Chip label={`Barcode Assigned ${numberText(summary.assigned)} / ${numberText(summary.expected)}`} color={summary.assigned === summary.expected && summary.expected > 0 ? 'success' : 'warning'} variant="outlined" />
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={refresh} disabled={loadingRows || loadingOrder} sx={{ textTransform: 'none' }}>Refresh</Button>
        </Stack>
      </Stack>

      {pageError && <Alert severity="error" sx={{ mb: 1 }}>{pageError}</Alert>}
      {pageNotice && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setPageNotice('')}>{pageNotice}</Alert>}

      <Paper variant="outlined" sx={{ p: 1.15, mb: 0.9, borderRadius: 1.75 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ lg: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, color: '#173B63' }}>Choose the Master row before packing</Typography>
            <Typography variant="body2" color="text.secondary">
              Total ctns defines the number of physical cartons. Qty Per Ctn defines the planned pieces inside each carton. Physical cartons stay hidden until you open one Master row.
            </Typography>
          </Box>
          <Box sx={{ flex: 1.4, minWidth: { xs: '100%', lg: 680 } }}>
            <TableFilterBar
              fields={[
                { key: 'poNumber', label: 'e.s. PO #' },
                { key: 'articleNumber', label: 'e.s. Article #' },
                { key: 'styleNumber', label: 'STYLE#' },
                { key: 'style', label: 'STYLE' },
                { key: 'assignmentStatus', label: 'Assignment Status', options: [
                  { value: PROGRESS_STATUS.NOT_STARTED, label: 'Not Started' },
                  { value: PROGRESS_STATUS.IN_PROGRESS, label: 'In Progress' },
                  { value: PROGRESS_STATUS.COMPLETED, label: 'Completed' },
                  { value: BARCODE_CARTON_STATUS.PLAN_MISMATCH, label: 'Plan Mismatch' }
                ] }
              ]}
              values={filters}
              onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
              onClear={() => setFilters({ poNumber: '', articleNumber: '', styleNumber: '', style: '', assignmentStatus: '' })}
              disabled={loadingRows}
            />
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer sx={{ minHeight: 430, maxHeight: 'calc(100vh - 310px)', overflow: 'auto' }}>
          <SortableTable stickyHeader size="small" rowNumberStart={page * pageSize} sx={{ minWidth: 1680 }}>
            <TableHead>
              <TableRow>
                {['No.', 'e.s. PO #', 'e.s. Article #', 'STYLE#', 'STYLE', 'Color', 'Size', 'Qty Per Ctn', 'Total ctns', 'Generated', 'Barcode Assigned', 'Remaining', 'Status', 'Action'].map((label) => (
                  <TableCell key={label} sx={{ bgcolor: '#EAF1F6', fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingRows ? (
                <TableRow><TableCell colSpan={14} align="center" sx={{ py: 8 }}><CircularProgress /></TableCell></TableRow>
              ) : rows.length ? rows.map((row, index) => {
                const chip = statusChip(row.assignmentStatus);
                const completed = row.assignmentStatus === PROGRESS_STATUS.COMPLETED;
                const mismatch = row.assignmentStatus === BARCODE_CARTON_STATUS.PLAN_MISMATCH || !row.cartonCountMatches;
                return (
                  <TableRow key={row.masterLineId} hover sx={{ cursor: mismatch ? 'default' : 'pointer' }} onDoubleClick={() => !mismatch && openMaster(row)}>
                    <TableCell sx={{ fontWeight: 750 }}>{page * pageSize + index + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#103B5C' }}>{valueText(row.poNumber)}</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{valueText(row.articleNumber)}</TableCell>
                    <TableCell>{valueText(row.styleNumber)}</TableCell>
                    <TableCell>{valueText(row.style)}</TableCell>
                    <TableCell>{valueText(row.color)}</TableCell>
                    <TableCell>{valueText(row.size)}</TableCell>
                    <TableCell sx={{ fontWeight: 750 }}>{valueText(row.qtyPerCarton)}</TableCell>
                    <TableCell sx={{ fontWeight: 900, color: '#103B5C' }}>{numberText(row.totalCartons)}</TableCell>
                    <TableCell sx={{ color: mismatch ? 'error.main' : 'text.primary', fontWeight: 750 }}>{numberText(row.generatedCartons)}</TableCell>
                    <TableCell sx={{ color: completed ? 'success.main' : '#B26A00', fontWeight: 900 }}>
                      {numberText(row.assignedCount)} / {numberText(row.totalCartons)}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{numberText(row.remainingCount)}</TableCell>
                    <TableCell><Chip size="small" label={statusLabel(row.assignmentStatus)} color={chip.color} variant={chip.variant} sx={{ fontWeight: 750 }} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        variant={completed ? 'outlined' : 'contained'}
                        color={mismatch ? 'error' : 'primary'}
                        startIcon={completed ? <CheckCircleOutlined /> : <Inventory2Outlined />}
                        onClick={() => !mismatch && openMaster(row)}
                        disabled={mismatch}
                        sx={{ textTransform: 'none', fontWeight: 800, minWidth: 128 }}
                      >
                        {mismatch ? 'Fix Plan First' : completed ? 'Review Cartons' : row.assignedCount > 0 ? 'Continue Packing' : 'Start Packing'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={14} align="center" sx={{ py: 8, color: 'text.secondary' }}>No Master rows match the selected filters.</TableCell></TableRow>
              )}
            </TableBody>
          </SortableTable>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalElements}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(event) => { setPage(0); setPageSize(Number(event.target.value)); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="Master rows per page"
          showFirstButton
          showLastButton
        />
      </Paper>

      <Dialog open={Boolean(selectedMaster)} onClose={closeMaster} fullWidth maxWidth="lg">
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ md: 'center' }}>
            <Box>
              <Typography sx={{ fontWeight: 900, color: '#103B5C' }}>Assign Barcode for Carton · {selectedMaster?.poNumber || '—'} / {selectedMaster?.articleNumber || '—'}</Typography>
              <Typography variant="body2" color="text.secondary">Scan or enter a Factory Barcode. After it is accepted, select a physical carton below, enter the actual quantity, then press Final.</Typography>
            </Box>
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`STYLE#: ${selectedMaster?.styleNumber || '—'}`} />
              <Chip size="small" label={`STYLE: ${selectedMaster?.style || '—'}`} />
              <Chip size="small" label={`${selectedMaster?.color || '—'} / ${selectedMaster?.size || '—'}`} />
              <Chip size="small" color="primary" label={`Total ctns: ${numberText(selectedMaster?.totalCartons)}`} />
              <Chip size="small" color={assignedInSelected === Number(selectedMaster?.totalCartons || 0) ? 'success' : 'warning'} label={`Assigned: ${numberText(assignedInSelected)} / ${numberText(selectedMaster?.totalCartons)}`} />
            </Stack>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 1.25, md: 1.75 } }}>
          <Stack spacing={1.25}>
            {detailError && <Alert severity="error" onClose={() => setDetailError('')}>{detailError}</Alert>}
            {detailNotice && <Alert severity="success" onClose={() => setDetailNotice('')}>{detailNotice}</Alert>}

            {!selectedMaster?.cartonCountMatches && (
              <Alert severity="error">
                Carton plan mismatch. Total ctns is {numberText(selectedMaster?.totalCartons)}, but {numberText(selectedMaster?.generatedCartons)} physical cartons are generated. Regenerate Carton Master before packing.
              </Alert>
            )}

            {loadingCartons ? (
              <Box sx={{ py: 7, textAlign: 'center' }}><CircularProgress /></Box>
            ) : cartons.length > 0 ? (
              <>
                {eligibleCartons.length > 0 ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 1.25, md: 1.5 },
                      borderRadius: 2,
                      borderColor: checkedBarcode ? 'success.main' : '#CBD5E1',
                      bgcolor: checkedBarcode ? '#F4FBF7' : '#FFFFFF'
                    }}
                  >
                    <Typography sx={{ mb: 0.75, fontSize: '0.72rem', color: '#64748B', fontWeight: 800 }}>SCAN OR ENTER FACTORY BARCODE</Typography>
                    {!checkedBarcode ? (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ sm: 'flex-start' }}>
                        <TextField
                          inputRef={barcodeInputRef}
                          fullWidth
                          label="Factory Barcode"
                          value={barcode}
                          onChange={(event) => {
                            setBarcode(event.target.value.replace(/\s/g, ''));
                            setCheckedBarcode(null);
                            setSelectedCarton(null);
                            setActualQuantity('');
                            setDetailError('');
                            setDetailNotice('');
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              checkBarcode();
                            }
                          }}
                          disabled={assigning || checkingBarcode}
                          placeholder="Scan or enter Factory Barcode"
                          helperText={APP_MESSAGES.BARCODE_VALIDATE_FIRST_HELPER}
                          sx={{ '& .MuiInputBase-root': { minHeight: 58, fontSize: '1.05rem', fontWeight: 850, letterSpacing: 0.5 } }}
                        />
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={checkingBarcode ? <CircularProgress size={17} color="inherit" /> : <QrCodeScannerOutlined />}
                          onClick={checkBarcode}
                          disabled={!barcode.trim() || checkingBarcode || assigning}
                          sx={{ minWidth: 170, minHeight: 58, textTransform: 'none', fontWeight: 900, bgcolor: '#103B5C' }}
                        >
                          {checkingBarcode ? 'Checking...' : 'Check Barcode'}
                        </Button>
                      </Stack>
                    ) : (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip size="small" icon={<AssignmentTurnedInOutlined />} label="BARCODE READY" color="success" />
                          <Typography sx={{ fontWeight: 950, color: '#103B5C', letterSpacing: 0.45 }}>{checkedBarcode.barcode}</Typography>
                          <Typography sx={{ fontSize: '0.76rem', color: '#557085', fontWeight: 700 }}>Select one physical carton below.</Typography>
                        </Stack>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => {
                            setCheckedBarcode(null);
                            setSelectedCarton(null);
                            setActualQuantity('');
                            setDetailError('');
                            setDetailNotice('');
                            focusBarcode();
                          }}
                          disabled={assigning}
                          sx={{ textTransform: 'none', fontWeight: 800 }}
                        >
                          Change Barcode
                        </Button>
                      </Stack>
                    )}
                  </Paper>
                ) : (
                  <Alert severity="success" icon={<CheckCircleOutlined />}>
                    All {numberText(cartons.length)} physical cartons for this Master row have Factory Barcodes assigned. This Master row is ready for Sales Shipment Planning.
                  </Alert>
                )}

                <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden', opacity: checkedBarcode || eligibleCartons.length === 0 ? 1 : 0.72 }}>
                  <Box sx={{ px: 1.2, py: 0.9, bgcolor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.4} alignItems={{ sm: 'center' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 850, color: '#103B5C' }}>Physical Cartons</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#64748B' }}>
                          {checkedBarcode ? 'Choose the carton that will receive this Factory Barcode.' : 'Scan or enter a valid Factory Barcode to enable carton selection.'}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={checkedBarcode ? `${numberText(eligibleCartons.length)} available` : 'Waiting for barcode'}
                        color={checkedBarcode ? 'primary' : 'default'}
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                  <TableContainer sx={{ maxHeight: 310 }}>
                    <SortableTable stickyHeader size="small" sx={{ minWidth: 930 }}>
                      <TableHead>
                        <TableRow>
                          {['Physical Carton', 'CTN No.', 'Planned Qty', 'Actual Qty', 'Factory Barcode', 'Status', 'Action'].map((label) => (
                            <TableCell key={label} sx={{ bgcolor: '#F3F7FA', fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {cartons.map((carton) => {
                          const assigned = Boolean(carton.factoryBarcode);
                          const eligible = !assigned && !carton.shipmentId && carton.status === BARCODE_CARTON_STATUS.PLANNED;
                          const isSelected = selectedCarton?.id === carton.id;
                          const canSelect = eligible && Boolean(checkedBarcode) && !assigning;
                          const canUnassign = assigned && carton.status === BARCODE_CARTON_STATUS.PLANNED && !carton.shipmentId && !carton.weightKg && !carton.jobId;
                          return (
                            <TableRow
                              key={carton.id}
                              hover={canSelect}
                              selected={isSelected}
                              onClick={() => {
                                if (!canSelect) return;
                                setSelectedCarton(carton);
                                setActualQuantity('');
                                setDetailError('');
                              }}
                              sx={{
                                cursor: canSelect ? 'pointer' : 'default',
                                '&.Mui-selected': { bgcolor: '#E8F3FF' },
                                '&.Mui-selected:hover': { bgcolor: '#DFEEFF' }
                              }}
                            >
                              <TableCell sx={{ fontWeight: 850, color: '#103B5C' }}>Carton {valueText(carton.cartonSequence)} / {valueText(carton.plannedCartons)}</TableCell>
                              <TableCell>{valueText(carton.cartonNumber)}</TableCell>
                              <TableCell sx={{ fontWeight: 750 }}>{valueText(plannedQuantityOf(carton))}</TableCell>
                              <TableCell sx={{ fontWeight: carton.assignedQuantity != null ? 750 : 400 }}>{valueText(carton.assignedQuantity)}</TableCell>
                              <TableCell sx={{ fontWeight: assigned ? 850 : 400 }}>{carton.factoryBarcode || 'Not Assigned'}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={assigned ? 'PACKED / ASSIGNED' : isSelected ? 'SELECTED' : 'NOT PACKED'}
                                  color={assigned ? 'success' : isSelected ? 'primary' : 'default'}
                                  variant={assigned || isSelected ? 'filled' : 'outlined'}
                                />
                              </TableCell>
                              <TableCell>
                                {canUnassign ? (
                                  <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    startIcon={<LinkOffOutlined />}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      unassign(carton);
                                    }}
                                    disabled={assigning}
                                    sx={{ textTransform: 'none' }}
                                  >
                                    Unassign
                                  </Button>
                                ) : eligible ? (
                                  <Button
                                    size="small"
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (!canSelect) return;
                                      setSelectedCarton(carton);
                                      setActualQuantity('');
                                      setDetailError('');
                                    }}
                                    disabled={!checkedBarcode || assigning}
                                    sx={{ textTransform: 'none', fontWeight: 800, minWidth: 92 }}
                                  >
                                    {isSelected ? 'Selected' : checkedBarcode ? 'Select' : 'Scan first'}
                                  </Button>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">Locked</Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </SortableTable>
                  </TableContainer>
                </Paper>

                {checkedBarcode && !selectedCarton && eligibleCartons.length > 0 && (
                  <Alert severity="info">{APP_MESSAGES.FACTORY_BARCODE_READY_SELECT_CARTON}</Alert>
                )}

                {checkedBarcode && selectedCarton && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 1.25, md: 1.5 },
                      borderRadius: 2,
                      borderColor: quantityMismatch ? 'error.main' : '#8AB9E8',
                      bgcolor: quantityMismatch ? '#FFF7F7' : '#F7FBFF'
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ md: 'center' }} sx={{ mb: 1.1 }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 800 }}>SELECTED PHYSICAL CARTON</Typography>
                        <Typography sx={{ fontSize: '1.2rem', color: '#103B5C', fontWeight: 950 }}>
                          Carton {valueText(selectedCarton.cartonSequence)} / {valueText(selectedCarton.plannedCartons || selectedMaster?.totalCartons)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">{selectedCarton.cartonCode || 'Physical carton'} · CTN No. {valueText(selectedCarton.cartonNumber)}</Typography>
                      </Box>
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                        <Chip label={`Barcode: ${checkedBarcode.barcode}`} color="success" variant="outlined" sx={{ fontWeight: 800 }} />
                        <Chip label={`Planned Qty: ${valueText(plannedQuantity)} pcs`} color="primary" sx={{ fontWeight: 850 }} />
                      </Stack>
                    </Stack>

                    <Divider sx={{ mb: 1.2 }} />

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 1fr) minmax(220px, 0.7fr)' }, gap: 1.1 }}>
                      <Box>
                        <TextField
                          inputRef={actualInputRef}
                          fullWidth
                          label="Actual Qty in Carton"
                          type="number"
                          value={actualQuantity}
                          onChange={(event) => {
                            setActualQuantity(event.target.value);
                            setDetailError('');
                          }}
                          disabled={assigning}
                          inputProps={{ min: 1, step: 'any' }}
                          error={quantityMismatch}
                          helperText={quantityMismatch
                            ? `Quantity Mismatch — Planned ${valueText(plannedQuantity)} pcs, Actual ${valueText(actualQuantity)} pcs.`
                            : `Enter the packed quantity for the selected carton. It must match Planned Qty: ${valueText(plannedQuantity)} pcs.`}
                          sx={{ '& .MuiInputBase-root': { minHeight: 58, fontSize: '1.1rem', fontWeight: 850 } }}
                        />
                        {quantityMismatch && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            Quantity Mismatch. Final is blocked until Actual Qty matches Planned Qty.
                          </Alert>
                        )}
                      </Box>

                      <TextField
                        fullWidth
                        label="Production Line (optional)"
                        value={productionLine}
                        onChange={(event) => setProductionLine(event.target.value)}
                        disabled={assigning}
                        sx={{ '& .MuiInputBase-root': { minHeight: 58 } }}
                      />
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="flex-end" alignItems={{ sm: 'center' }} sx={{ mt: 1.15 }}>
                      <Button
                        variant="text"
                        onClick={() => {
                          setSelectedCarton(null);
                          setActualQuantity('');
                          setDetailError('');
                        }}
                        disabled={assigning}
                        sx={{ mr: { sm: 'auto' }, textTransform: 'none', fontWeight: 800 }}
                      >
                        Choose Another Carton
                      </Button>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={assigning ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlined />}
                        onClick={assignCurrentCarton}
                        disabled={assigning || checkingBarcode || !quantityValid || !checkedBarcode?.barcode || !selectedCarton}
                        sx={{ minWidth: 150, textTransform: 'none', fontWeight: 900, minHeight: 44, bgcolor: '#103B5C' }}
                      >
                        {assigning ? 'Saving...' : 'Final'}
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </>
            ) : (
              <Alert severity="warning">{APP_MESSAGES.NO_PHYSICAL_CARTONS_FOR_MASTER}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMaster} disabled={assigning || checkingBarcode}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
