import useAutoDismissFeedback from '../../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Breadcrumbs, Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import ManagementTable from 'components/ManagementTable';
import StatusChip from 'components/StatusChip';
import TableFilterBar from 'components/TableFilterBar';
import { CompactPageHeader, CompactStat } from 'components/CompactPageHeader';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getManagedCarton, getManagedOrder, getManagedPo, listManagedItems } from 'services/managementService';
import { APP_MESSAGES } from '../../../../constants/appMessages';
import { BUYER_CODE, DEFAULT_TABLE_PAGE_SIZE } from '../../../../constants/appConstants';

const initial = { page: 0, size: DEFAULT_TABLE_PAGE_SIZE, count: 0, rows: [], loading: false };
const v = (x) => (x === null || x === undefined || x === '' ? '—' : x);
const fromPoIfMissing = (value, poValue) => (value == null || String(value).trim() === '' ? poValue ?? null : value);
const niceTime = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : '—';

export default function BuyerCartonItemsPage() {
  const { buyerSlug, orderId, poKey, cartonId } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const [order, setOrder] = useState(null);
  const [po, setPo] = useState(null);
  const [carton, setCarton] = useState(null);
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const requestRef = useRef(0);
  const paginationRef = useRef({ page: 0, size: DEFAULT_TABLE_PAGE_SIZE });
  const [filters, setFilters] = useState({ itemNo: '', sku: '', style: '', color: '', sizeValue: '', status: '', scannedBy: '' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const load = useCallback(async (page = paginationRef.current.page, size = paginationRef.current.size, freshMetadata = false) => {
    if (!buyer?.code) return;
    const nextPage = Math.max(0, Number(page || 0));
    const nextSize = Math.max(1, Number(size || DEFAULT_TABLE_PAGE_SIZE));
    const requestId = ++requestRef.current;

    paginationRef.current = { page: nextPage, size: nextSize };
    setState((current) => ({ ...current, page: nextPage, size: nextSize, loading: true }));
    try {
      const [orderData, poData, cartonData, items] = await Promise.all([
        order && !freshMetadata ? Promise.resolve(order) : getManagedOrder(buyer.code, orderId),
        po && !freshMetadata ? Promise.resolve(po) : getManagedPo(buyer.code, orderId, poKey),
        carton && !freshMetadata ? Promise.resolve(carton) : getManagedCarton(buyer.code, orderId, cartonId),
        listManagedItems(buyer.code, orderId, cartonId, { ...debouncedFilters, page: nextPage, size: nextSize })
      ]);
      if (requestId !== requestRef.current) return;
      setError('');
      setOrder(orderData); setPo(poData); setCarton(cartonData);
      // Never enrich a carton with attributes from a different PO (for example,
      // when a user changes the PO segment in the URL manually).
      const itemPo = buyer.code === BUYER_CODE.LULULEMON && cartonData?.poKey === poData?.key ? poData : null;
      setState({
        page: nextPage, size: nextSize, count: Number(items?.totalElements || 0),
        rows: (items?.content || []).map((r, i) => ({
          ...r,
          // Compatibility with an older management API that returned null PO attributes.
          // Only the matching LULULEMON PO may supply these generated item slots.
          ...(itemPo ? {
            style: fromPoIfMissing(r.style, itemPo.styleNumber),
            color: fromPoIfMissing(r.color, itemPo.color),
            size: fromPoIfMissing(r.size, itemPo.size)
          } : {}),
          __stt: nextPage * nextSize + i + 1
        })),
        loading: false
      });
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setError(e?.response?.data?.message || e?.message || APP_MESSAGES.LOAD_ITEMS_FAILED);
      setState((current) => ({ ...current, loading: false }));
    }
  }, [buyer?.code, orderId, poKey, cartonId, order?.id, po?.key, carton?.id, debouncedFilters]);

  useEffect(() => { load(0, paginationRef.current.size); }, [load]);
  if (!buyer) return <Alert severity="error">{APP_MESSAGES.BUYER_NOT_FOUND}</Alert>;

  const isLululemon = buyer.code === BUYER_CODE.LULULEMON;

  const columns = [
    ...(!isLululemon ? [{ key: '__stt', label: 'STT', minWidth: 60 }] : []),
    ...(!isLululemon ? [{ key: 'itemNo', label: 'Item No.', minWidth: 85 }] : []),
    { key: 'sku', label: isLululemon ? 'Assigned SKU' : 'Scanned SKU', minWidth: 150, render: (r) => r.sku ? <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 750, color: '#1663BE', letterSpacing: '0.01em' }}>{r.sku}</Typography> : <Typography color="text.disabled" variant="body2">—</Typography> },
    { key: 'style', label: 'Style', minWidth: 110 },
    { key: 'color', label: 'Color', minWidth: 110 },
    ...(!isLululemon ? [{ key: 'size', label: 'Size', minWidth: 80 }] : []),
    { key: 'quantity', label: 'Qty', minWidth: 70 },
    { key: 'status', label: 'Status', minWidth: 100, render: (r) => <StatusChip status={r.status || 'PENDING'} /> },
    { key: 'scannedBy', label: isLululemon ? 'Recorded By' : 'Scanned By', minWidth: 120 },
    { key: 'scannedAt', label: isLululemon ? 'Recorded At' : 'Scanned At', minWidth: 160, render: (r) => <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{niceTime(r.scannedAt)}</Typography> }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        {!isLululemon && (
          <CompactPageHeader
            breadcrumbs={(
              <Breadcrumbs separator="/">
                <Link component={RouterLink} to={`/buyers/${buyer.slug}/orders`} underline="hover" color="inherit">{buyer.label}</Link>
                <Link component={RouterLink} to={`/buyers/${buyer.slug}/orders/${orderId}`} underline="hover" color="inherit">{order?.orderName || 'Order'}</Link>
                <Link component={RouterLink} to={`/buyers/${buyer.slug}/orders/${orderId}/pos/${encodeURIComponent(poKey)}`} underline="hover" color="inherit">PO {po?.poNumber || ''}</Link>
                <Typography color="text.primary">Carton {carton?.cartonNo || ''}</Typography>
              </Breadcrumbs>
            )}
            meta={<Chip size="small" variant="outlined" label={`${state.count} Item${state.count === 1 ? '' : 's'}`} />}
            details={(
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                <CompactStat label="PO" value={v(po?.poNumber)} />
                <CompactStat label="Target" value={v(carton?.plannedQty)} />
                <CompactStat label="Scanned" value={v(carton?.scannedQty)} />
                <CompactStat label="SSCC-18" value={v(carton?.cartonIdentity)} />
                <CompactStat label="Status" value={v(carton?.status)} />
              </Stack>
            )}
          />
        )}

        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

        <Box sx={isLululemon ? {
          '& .MuiPaper-root': { borderRadius: '4px', borderColor: '#D6E4F1' },
          '& .MuiTableHead-root .MuiTableCell-root': { bgcolor: '#EDF4FC', color: '#324F70', fontWeight: 800, borderBottom: '1px solid #D6E4F1' },
          '& .MuiTableBody-root .MuiTableCell-root': { py: 1.1, borderColor: '#ECF1F7' },
          '& .MuiTableRow-hover:hover': { bgcolor: '#F4F9FF' },
          '& .MuiTextField-root .MuiOutlinedInput-root': { borderRadius: '4px', bgcolor: '#FFFFFF' },
        } : undefined}>
        <ManagementTable
          filterBar={<TableFilterBar
          fields={[
            ...(!isLululemon ? [{ key: 'itemNo', label: 'Item No.' }] : []),
            { key: 'sku', label: 'SKU' },
            { key: 'style', label: 'Style' },
            { key: 'color', label: 'Color' },
            ...(!isLululemon ? [{ key: 'sizeValue', label: 'Size' }] : []),
            { key: 'status', label: 'Status' },
            { key: 'scannedBy', label: 'Scanned By' }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ itemNo: '', sku: '', style: '', color: '', sizeValue: '', status: '', scannedBy: '' })}
        />}
          title={isLululemon ? `Carton Items · ${state.count} total` : 'Items'}
          {...state}
          rowsPerPage={state.size}
          onPageChange={(p) => load(p, paginationRef.current.size)}
          onRowsPerPageChange={(s) => load(0, s)}
          columns={columns}
          emptyText="No Item rows found."
        />
        </Box>
      </Stack>
    </Box>
  );
}
