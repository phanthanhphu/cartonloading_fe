import { managementPageSx, managementStackSx } from 'components/ManagementViewportStyles';
import useAutoDismissFeedback from '../../../../hooks/useAutoDismissFeedback';
import { CARTON_STATUS, DEFAULT_TABLE_ROWS_PER_PAGE, FINAL_INSPECTION_RESULT, RFID_CHECK_RESULT, WEIGHING_RESULT } from '../../../../constants/appConstants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CheckCircleOutlineRounded, ErrorOutlineRounded, AccessTimeRounded, VisibilityOutlined, ReplayRounded } from '@mui/icons-material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import ManagementTable from 'components/ManagementTable';
import StatusChip from 'components/StatusChip';
import TableFilterBar from 'components/TableFilterBar';
import { CompactPageHeader, CompactStat } from 'components/CompactPageHeader';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getManagedOrder, getManagedPo, listManagedCartons } from 'services/managementService';
import { APP_MESSAGES } from '../../../../constants/appMessages';
import { BUYER_CODE } from '../../../../constants/appConstants';
import { canWeightCheck, isAdmin } from 'utils/accessControl';
import PoRfidWeightWorkspace from 'buyers/lululemon/components/PoRfidWeightWorkspace';
import { unassignProcessingIdentity } from 'buyers/lululemon/services/cartonProcessing';
import OperationWorkspaceDialog from 'buyers/lululemon/components/OperationWorkspaceDialog';
import { useSelectedFactory } from 'utils/factorySelection';

// Scan RFID / Weight intentionally retains the previous compact 2px corners.
// An isolated MUI theme also preserves the corners on menus/confirmation dialogs
// rendered through portals, without affecting the other application pages.
const scanRfidWeightTheme = (base) => createTheme(base, {
  shape: { borderRadius: 2 },
  components: {
    MuiButton: { styleOverrides: { root: {
      borderRadius: '2px',
      '&::after': { borderRadius: '2px' },
      '&:active::after': { borderRadius: '2px' }
    } } },
    MuiChip: { styleOverrides: { root: { borderRadius: '2px' } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: '2px' } } },
    MuiIconButton: { styleOverrides: { root: { borderRadius: '2px' } } },
    MuiTab: { styleOverrides: { root: { borderRadius: '2px', '&:focus-visible': { borderRadius: '2px' } } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: '2px' }, bar: { borderRadius: '2px' } } },
    MuiListItemButton: { styleOverrides: { root: { borderRadius: '2px' } } },
    MuiTableContainer: { styleOverrides: { root: { borderRadius: '2px' } } }
  }
});

const initial = { page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE, count: 0, rows: [], loading: false };
const v = (x) => (x === null || x === undefined || x === '' ? '—' : x);

export default function BuyerPoCartonsPage() {
  const { buyerSlug, orderId, poKey } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [po, setPo] = useState(null);
  const [state, setState] = useState(initial);
  const isLulu = buyer?.code === BUYER_CODE.LULULEMON;
  const canProcess = isLulu && (canWeightCheck() || isAdmin());
  const { factoryCode: selectedFactory, loading: factoryLoading } = useSelectedFactory(buyer?.code);
  // PO-level scan station: one toolbar action for the entire PO, no per-carton action buttons.
  const [scanOpen, setScanOpen] = useState(false);
  const [scanDialogReady, setScanDialogReady] = useState(false);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const [notice, setNotice] = useState('');
  useAutoDismissFeedback(notice, setNotice, '', 'success');
  const [reassignCarton, setReassignCarton] = useState(null);
  const [reassignError, setReassignError] = useState('');
  useAutoDismissFeedback(reassignError, setReassignError, '', 'error');
  const [reassignBusy, setReassignBusy] = useState(false);
  const requestRef = useRef(0);
  const paginationRef = useRef({ page: 0, size: DEFAULT_TABLE_ROWS_PER_PAGE });
  const [filters, setFilters] = useState({ cartonNo: '', sscc: '', status: '' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const load = useCallback(async (page = paginationRef.current.page, size = paginationRef.current.size) => {
    if (!buyer?.code) return;
    const nextPage = Math.max(0, Number(page || 0));
    const nextSize = Math.max(1, Number(size || 10));
    const requestId = ++requestRef.current;

    paginationRef.current = { page: nextPage, size: nextSize };
    setState((current) => ({ ...current, page: nextPage, size: nextSize, loading: true }));
    try {
      const [orderData, poData, cartons] = await Promise.all([
        order ? Promise.resolve(order) : getManagedOrder(buyer.code, orderId),
        po ? Promise.resolve(po) : getManagedPo(buyer.code, orderId, poKey),
        listManagedCartons(buyer.code, orderId, poKey, { ...debouncedFilters, page: nextPage, size: nextSize })
      ]);
      if (requestId !== requestRef.current) return;
      setOrder(orderData); setPo(poData);
      setState({ page: nextPage, size: nextSize, count: Number(cartons?.totalElements || 0), rows: cartons?.content || [], loading: false });
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setError(e?.response?.data?.message || e?.message || APP_MESSAGES.LOAD_CARTONS_FAILED);
      setState((current) => ({ ...current, loading: false }));
    }
  }, [buyer?.code, orderId, poKey, order?.id, po?.key, debouncedFilters]);

  useEffect(() => { load(0, paginationRef.current.size); }, [load]);
  useEffect(() => { setScanOpen(false); setReassignCarton(null); setReassignError(''); setNotice(''); }, [orderId, poKey, selectedFactory]);
  const closeScan = () => {
    setScanOpen(false);
    load(paginationRef.current.page, paginationRef.current.size);
  };
  if (!buyer) return <Alert severity="error">{APP_MESSAGES.BUYER_NOT_FOUND}</Alert>;
  const mismatch = isLulu && !factoryLoading && po?.factoryCode &&
    String(po.factoryCode).toUpperCase() !== String(selectedFactory || '').toUpperCase();

  // Only LULULEMON uses the compact RFID-first workstation table. ES retains
  // its original packing-centric columns and behavior.
  const finalStatus = (row) => {
    const rfid = String(row?.rfidStatus || '').toUpperCase();
    const weight = String(row?.weightStatus || '').toUpperCase();
    // FINAL status exists only after BOTH operations have finished.
    if (![RFID_CHECK_RESULT.PASS, RFID_CHECK_RESULT.FAILED].includes(rfid)
      || ![WEIGHING_RESULT.PASS, WEIGHING_RESULT.FAILED].includes(weight)) return FINAL_INSPECTION_RESULT.PENDING;
    return rfid === RFID_CHECK_RESULT.PASS && weight === WEIGHING_RESULT.PASS
      ? FINAL_INSPECTION_RESULT.PASS : FINAL_INSPECTION_RESULT.FAILED;
  };
  const statusIcon = (status) => {
    if (status === FINAL_INSPECTION_RESULT.PASS) return <CheckCircleOutlineRounded color="success" sx={{ fontSize: 17 }} />;
    if (status === FINAL_INSPECTION_RESULT.FAILED) return <ErrorOutlineRounded color="error" sx={{ fontSize: 17 }} />;
    return <AccessTimeRounded color="disabled" sx={{ fontSize: 16 }} />;
  };
  const openCarton = (row) => navigate(`/buyers/${buyer.slug}/orders/${orderId}/pos/${encodeURIComponent(poKey)}/cartons/${row.id}`);

  // Re-assign is available for an identified carton until its final RFID +
  // Weight inspection is complete. Activation / an unfinished scan is allowed.
  // Backend also protects saved weight history and any active PDA reservation.
  const canReassignIdentity = (row) => Boolean(canProcess && !mismatch && !scanOpen
    && row?.id && (row?.cartonIdentity || row?.labelConfirmedSku)
    && finalStatus(row) === FINAL_INSPECTION_RESULT.PENDING);

  const closeReassign = () => {
    if (reassignBusy) return;
    setReassignCarton(null);
    setReassignError('');
  };
  const submitReassign = async () => {
    const current = reassignCarton;
    if (!current?.id || reassignBusy || !canReassignIdentity(current)) return;
    setReassignBusy(true);
    setReassignError('');
    setError('');
    setNotice('');
    try {
      // Same audited, factory-scoped BE operation used by the RFID/Weight workstation.
      // It resets unfinished assignment and scan progress; never deletes Carton/PO/Items.
      // Backend still requires a reason for audit; create one automatically on confirmation.
      await unassignProcessingIdentity(orderId, current.id, 'Re-assign confirmed in PO Cartons');
      setReassignCarton(null);
      setReassignError('');
      // Re-fetch PO as well: if this was the only carton that established a
      // provisional PO SKU, Backend may have released it during Re-assign.
      // The scan workspace must not reuse a stale PO SKU from this page.
      const updatedPo = await getManagedPo(buyer.code, orderId, poKey);
      setPo(updatedPo);
      setNotice(`Carton ${current.cartonNo}: SSCC and SKU assignment deleted. ${updatedPo?.sku
        ? 'PO SKU remains assigned; the next scanned SKU must match the PO.'
        : 'The provisional PO SKU is available for a new first scan.'} Scan and assign again from Scan RFID / Weight.`);
      await load(paginationRef.current.page, paginationRef.current.size);
    } catch (e) {
      setReassignError(e?.response?.data?.message || e?.message || 'Could not unassign SSCC and SKU. Please refresh the PO and try again.');
    } finally {
      setReassignBusy(false);
    }
  };
  const columns = isLulu ? [
    { key: 'cartonIdentity', label: 'SSCC-18', minWidth: 175,
      render: (row) => <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v(row.cartonIdentity)}</Typography> },
    { key: 'labelConfirmedSku', label: 'SKU', minWidth: 150,
      render: (row) => <Typography sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v(row.labelConfirmedSku)}</Typography> },
    { key: 'plannedQty', label: 'Qty', minWidth: 75 },
    { key: 'rfidVerifiedQty', label: 'RFID', minWidth: 108,
      render: (row) => <Tooltip arrow title={`RFID: ${row.rfidStatus || 'PENDING'} · Matched EPC / Expected Qty · Wrong SKU: ${row.rfidWrongSkuQty ?? 0}`}>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ whiteSpace: 'nowrap' }}>
          {statusIcon(row.rfidStatus)}
          <Typography sx={{ fontSize: 12, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{row.rfidMatchedQty ?? (row.rfidStatus === RFID_CHECK_RESULT.PASS ? row.rfidVerifiedQty : null) ?? '—'}/{row.plannedQty ?? '—'}</Typography>
        </Stack>
      </Tooltip> },
    { key: 'weightKg', label: 'Weight (kg)', minWidth: 126,
      render: (row) => {
        const gw = Number(po?.grossWeightKg);
        const expected = row.expectedWeightKg ?? (gw > 0 ? gw * Number(row.plannedQty || 0) : null);
        return <Tooltip arrow title={`Weight: ${row.weightStatus || 'PENDING'} · Expected ${expected == null ? '—' : Number(expected).toFixed(3)} kg`}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ whiteSpace: 'nowrap' }}>
            {row.weightKg != null ? statusIcon(row.weightStatus) : <AccessTimeRounded color="disabled" sx={{ fontSize: 16 }} />}
            <Typography sx={{ fontSize: 12, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
              {row.weightKg == null ? '—' : Number(row.weightKg).toFixed(3)}
            </Typography>
          </Stack>
        </Tooltip>;
      } },
    { key: 'finalCheck', label: 'Final', minWidth: 100,
      render: (row) => <StatusChip status={finalStatus(row)} /> },
    { key: 'actions', label: 'Action', minWidth: 112,
      render: (row) => <Stack direction="row" spacing={0.25} alignItems="center">
        <Tooltip arrow title={`View Carton ${row.cartonNo} details`}>
          <IconButton size="small" aria-label={`View Carton ${row.cartonNo} details`}
            onClick={(event) => { event.stopPropagation(); openCarton(row); }}>
            <VisibilityOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip arrow title={canReassignIdentity(row)
          ? 'Re-assign: delete existing SSCC and SKU assignment'
          : finalStatus(row) !== FINAL_INSPECTION_RESULT.PENDING
            ? 'Completed cartons cannot be Re-assigned.'
            : 'Assign SSCC first or check your access permission.'}>
          <span>
            <IconButton size="small" color="primary" disabled={!canReassignIdentity(row)}
              aria-label={`Re-assign SSCC and SKU for Carton ${row.cartonNo}`}
              onClick={(event) => {
                event.stopPropagation();
                setError(''); setNotice(''); setReassignError(''); setReassignCarton(row);
              }}>
              <ReplayRounded fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack> }
  ] : [
    { key: 'cartonNo', label: 'Carton No.', minWidth: 100, render: (r) => <Typography fontWeight={900} color="primary.main">{v(r.cartonNo)}</Typography> },
    { key: 'plannedQty', label: 'Target Qty', minWidth: 90 },
    { key: 'scannedQty', label: 'Scanned Qty', minWidth: 95 },
    { key: 'cartonIdentity', label: 'SSCC-18', minWidth: 170 },
    { key: 'status', label: 'Status', minWidth: 130, render: (r) => <StatusChip status={r.status || CARTON_STATUS.READY_TO_PACK} /> }
  ];

  const poBreadcrumbs = (
    <Breadcrumbs separator="/">
      <Link component={RouterLink} to={`/buyers/${buyer.slug}/orders`} underline="hover" color="inherit">{buyer.label}</Link>
      <Link component={RouterLink} to={`/buyers/${buyer.slug}/orders/${orderId}`} underline="hover" color="inherit">{order?.orderName || 'Order'}</Link>
      <Typography color="text.primary">PO {po?.poNumber || ''}</Typography>
    </Breadcrumbs>
  );

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 }, ...managementPageSx }}>
      <Stack spacing={isLulu ? 0.75 : 1} sx={managementStackSx}>
        <CompactPageHeader
          title={`PO ${v(po?.poNumber)}`}
          subtitle={isLulu ? 'PO station: Scan / Assign SSCC + SKU → RFID → Weight. One scan button per PO; no PO picking or conveyor.' : 'Cartons are generated on first open; Items are generated only when a Carton is opened.'}
          breadcrumbs={isLulu ? (
            !mismatch && canProcess ? (
              <Stack direction="row" justifyContent="flex-end" alignItems="center">
                <Button variant="contained" onClick={() => setScanOpen(true)} sx={{ flexShrink: 0 }}>
                  Scan RFID / Weight
                </Button>
              </Stack>
            ) : null
          ) : poBreadcrumbs}
          meta={<Chip size="small" variant="outlined" label={`${state.count} Carton${state.count === 1 ? '' : 's'}`} />}
          details={(
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {!isLulu && <CompactStat label="Factory" value={v(po?.factoryCode)} />}
              <CompactStat label="Style" value={v(po?.styleNumber)} />
              <CompactStat label="Qty" value={v(po?.totalQty)} />
              <CompactStat label="Pcs/Ctn" value={v(po?.qtyPerCarton)} />
              <CompactStat label="Planned Ctn" value={v(po?.plannedCartons)} />
              <CompactStat label="Destination" value={v(po?.destination)} />
            </Stack>
          )}
          dense={isLulu}
        />

        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        {notice ? <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert> : null}
        {mismatch && <Alert severity="warning" action={<Button size="small" onClick={() => navigate(`/buyers/${buyer.slug}/orders`)}>Back to Orders</Button>}>
          This PO belongs to Factory {po.factoryCode}, but your selected Factory is {selectedFactory || 'not set'}. Switch Factory to continue.
        </Alert>}
        {!mismatch && isLulu && !canProcess && <Alert severity="info">RFID and Weight processing requires the assigned Weight operator permission. You can inspect cartons here.</Alert>}
        {isLulu && canProcess && <ThemeProvider theme={scanRfidWeightTheme}><OperationWorkspaceDialog
          open={Boolean(scanOpen && !mismatch && po?.id)}
          onClose={closeScan}
          title={`Carton Weighing · PO ${v(po?.poNumber)}`}
          subtitle={`Order ${v(order?.orderName)} · Factory ${v(po?.factoryCode)}`}
          allowMaximize
          startMaximized
          fitViewport
          onEntered={() => setScanDialogReady(true)}
          onExited={() => setScanDialogReady(false)}
          contentSx={{ bgcolor: '#F8FAFC' }}
        >
          {scanOpen && po?.id && <PoRfidWeightWorkspace
            dialogReady={scanDialogReady}
            buyerCode={buyer.code} orderId={orderId} poId={po.id} poKey={poKey}
            po={po} factoryCode={selectedFactory}
            onCartonSaved={() => load(paginationRef.current.page, paginationRef.current.size)}
          />}
        </OperationWorkspaceDialog></ThemeProvider>}
        {isLulu && <Dialog open={Boolean(reassignCarton)} onClose={closeReassign} maxWidth="sm" fullWidth
          aria-labelledby="reassign-identity-title">
          <DialogTitle id="reassign-identity-title">Re-assign SSCC &amp; SKU</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 1.5 }}>
              Delete the current SSCC and SKU assignment for Carton {reassignCarton?.cartonNo}?
              You will be able to scan and assign them again from Scan RFID / Weight.
            </DialogContentText>
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              <Typography variant="body2"><strong>SSCC-18:</strong> {v(reassignCarton?.cartonIdentity)}</Typography>
              <Typography variant="body2"><strong>SKU:</strong> {v(reassignCarton?.labelConfirmedSku)}</Typography>
            </Stack>
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Re-assign clears unfinished scan / RFID progress and SSCC / SKU so you can scan again.
              Carton, PO, Qty, Item IDs and historical scan evidence are retained.
              A carton with completed RFID and Weight cannot be Re-assigned.
            </Alert>
            {reassignError && <Alert severity="error" sx={{ mb: 1.5 }}>{reassignError}</Alert>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeReassign} disabled={reassignBusy}>Cancel</Button>
            <Button onClick={submitReassign} color="error" variant="contained"
              disabled={reassignBusy || !canReassignIdentity(reassignCarton)}>
              {reassignBusy ? 'Processing...' : 'OK'}
            </Button>
          </DialogActions>
        </Dialog>}
        {!mismatch && <ManagementTable
          fillAvailableHeight
          filterBar={<TableFilterBar
          fields={[
            ...(!isLulu ? [{ key: 'cartonNo', label: 'Carton No.' }] : []),
            { key: 'sscc', label: 'SSCC-18' },
            { key: 'status', label: 'Status' }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ cartonNo: '', sscc: '', status: '' })}
        />}
          title="Cartons"
          {...state}
          rowsPerPage={state.size}
          onRowClick={(row) => navigate(`/buyers/${buyer.slug}/orders/${orderId}/pos/${encodeURIComponent(poKey)}/cartons/${row.id}`)}
          onPageChange={(p) => load(p, paginationRef.current.size)}
          onRowsPerPageChange={(s) => load(0, s)}
          columns={columns}
          emptyText="No Cartons could be generated for this PO."
        />}
      </Stack>
    </Box>
  );
}
