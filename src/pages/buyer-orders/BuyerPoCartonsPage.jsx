import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Breadcrumbs, Chip, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import ManagementTable from 'components/ManagementTable';
import StatusChip from 'components/StatusChip';
import TableFilterBar from 'components/TableFilterBar';
import { CompactPageHeader, CompactStat } from 'components/CompactPageHeader';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getManagedOrder, getManagedPo, listManagedCartons } from 'services/managementService';

const initial = { page: 0, size: 10, count: 0, rows: [], loading: false };
const v = (x) => (x === null || x === undefined || x === '' ? '—' : x);

export default function BuyerPoCartonsPage() {
  const { buyerSlug, orderId, poKey } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [po, setPo] = useState(null);
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const paginationRef = useRef({ page: 0, size: 10 });
  const [filters, setFilters] = useState({ cartonNo: '', sscc: '', status: '' });

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
        listManagedCartons(buyer.code, orderId, poKey, { ...filters, page: nextPage, size: nextSize })
      ]);
      if (requestId !== requestRef.current) return;
      setOrder(orderData); setPo(poData);
      setState({ page: nextPage, size: nextSize, count: Number(cartons?.totalElements || 0), rows: cartons?.content || [], loading: false });
    } catch (e) {
      if (requestId !== requestRef.current) return;
      setError(e?.response?.data?.message || e?.message || 'Unable to load Cartons.');
      setState((current) => ({ ...current, loading: false }));
    }
  }, [buyer?.code, orderId, poKey, order?.id, po?.key, filters]);

  useEffect(() => { load(0, paginationRef.current.size); }, [load]);
  if (!buyer) return <Alert severity="error">Buyer not found.</Alert>;

  const columns = [
    { key: 'cartonNo', label: 'Carton No.', minWidth: 100, render: (r) => <Typography fontWeight={900} color="primary.main">{v(r.cartonNo)}</Typography> },
    { key: 'plannedQty', label: 'Target Qty', minWidth: 90 },
    { key: 'scannedQty', label: 'Scanned Qty', minWidth: 95 },
    { key: 'cartonIdentity', label: 'SSCC-18', minWidth: 170 },
    { key: 'status', label: 'Status', minWidth: 130, render: (r) => <StatusChip status={r.status || 'READY_TO_PACK'} /> }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <CompactPageHeader
          title={`PO ${v(po?.poNumber)}`}
          subtitle="Cartons are generated on first open; Items are generated only when a Carton is opened."
          breadcrumbs={(
            <Breadcrumbs separator="/">
              <Link component={RouterLink} to={`/buyers/${buyer.slug}/orders`} underline="hover" color="inherit">{buyer.label}</Link>
              <Link component={RouterLink} to={`/buyers/${buyer.slug}/orders/${orderId}`} underline="hover" color="inherit">{order?.orderName || 'Order'}</Link>
              <Typography color="text.primary">PO {po?.poNumber || ''}</Typography>
            </Breadcrumbs>
          )}
          meta={<Chip size="small" variant="outlined" label={`${state.count} Carton${state.count === 1 ? '' : 's'}`} />}
          details={(
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <CompactStat label="Factory" value={v(po?.factoryCode)} />
              <CompactStat label="Style" value={v(po?.styleNumber)} />
              <CompactStat label="Qty" value={v(po?.totalQty)} />
              <CompactStat label="Pcs/Ctn" value={v(po?.qtyPerCarton)} />
              <CompactStat label="Planned Ctn" value={v(po?.plannedCartons)} />
              <CompactStat label="Destination" value={v(po?.destination)} />
            </Stack>
          )}
        />

        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}

        <TableFilterBar
          fields={[
            { key: 'cartonNo', label: 'Carton No.' },
            { key: 'sscc', label: 'SSCC-18' },
            { key: 'status', label: 'Status' }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ cartonNo: '', sscc: '', status: '' })}
          disabled={state.loading}
        />

        <ManagementTable
          title="Cartons"
          {...state}
          rowsPerPage={state.size}
          onRowClick={(row) => navigate(`/buyers/${buyer.slug}/orders/${orderId}/pos/${encodeURIComponent(poKey)}/cartons/${row.id}`)}
          onPageChange={(p) => load(p, paginationRef.current.size)}
          onRowsPerPageChange={(s) => load(0, s)}
          columns={columns}
          emptyText="No Cartons could be generated for this PO."
        />
      </Stack>
    </Box>
  );
}
