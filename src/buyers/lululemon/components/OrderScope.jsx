import { useCallback, useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { listManagedOrders } from 'services/managementService';



import { BUYER_CODE, buyerOrderStorageKey } from '../../../constants/appConstants';
import { APP_MESSAGES, createBuyerOrderFirstMessage } from '../../../constants/appMessages';
import { buyerPath } from 'utils/buyerAccess';
async function loadAllOrders() {
  const rows = [];
  let page = 0;
  const size = 100;
  while (true) {
    const result = await listManagedOrders(BUYER_CODE.LULULEMON, { page, size });
    rows.push(...(result?.content || []));
    if (result?.last || page + 1 >= Number(result?.totalPages || 0) || !(result?.content || []).length) break;
    page += 1;
  }
  return rows;
}

export default function OrderScope({ value, onChange, disabled = false, embedded = false, compact = false }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = await loadAllOrders();
      setOrders(next);
      const stored = localStorage.getItem(buyerOrderStorageKey(BUYER_CODE.LULULEMON)) || '';
      const validCurrent = next.some((row) => row.id === value) ? value : '';
      const validStored = next.some((row) => row.id === stored) ? stored : '';
      const chosen = validCurrent || validStored || next[0]?.id || '';
      if (chosen && chosen !== value) onChange(chosen);
      if (!chosen && value) onChange('');
    } catch (e) {
      setOrders([]);
      setError(e?.response?.data?.message || e.message || APP_MESSAGES.UNABLE_LOAD_ORDERS);
    } finally { setLoading(false); }
  }, [value, onChange]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next) => {
    if (next) localStorage.setItem(buyerOrderStorageKey(BUYER_CODE.LULULEMON), next); else localStorage.removeItem(buyerOrderStorageKey(BUYER_CODE.LULULEMON));
    onChange(next);
  };

  if (error) return <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>;
  if (!loading && !orders.length) return <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => navigate(buyerPath(BUYER_CODE.LULULEMON, 'orders'))}>Create Order</Button>}>{createBuyerOrderFirstMessage(BUYER_CODE.LULULEMON)}</Alert>;

  const content = (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.55} alignItems={{ md: 'center' }}>
      {!embedded ? <Box sx={{ minWidth: 76 }}><Typography variant="caption" color="text.secondary">Active Order</Typography><Typography variant="body2" sx={{ fontWeight: 750 }}>Order scope</Typography></Box> : null}
      <Autocomplete
        size="small"
        sx={{ minWidth: { xs: '100%', md: 300 }, flex: 1 }}
        disabled={disabled || loading}
        options={orders}
        value={orders.find((row) => row.id === value) || null}
        onChange={(_, row) => change(row?.id || '')}
        getOptionLabel={(row) => [row.orderName, row.orderDate, row.endOrderDate].filter(Boolean).join(' · ')}
        isOptionEqualToValue={(option, selected) => option.id === selected.id}
        autoHighlight
        openOnFocus
        clearOnEscape
        noOptionsText="No matching orders"
        renderOption={(props, row) => (
          <Box component="li" {...props} key={row.id} sx={{ alignItems: 'flex-start !important', py: '6px !important' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={750}>{row.orderName}</Typography>
              <Typography variant="caption" color="text.secondary">
                Start: {row.orderDate || '—'}{row.endOrderDate ? ` · End: ${row.endOrderDate}` : ''}
              </Typography>
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label={compact ? undefined : 'Active Order'}
            placeholder={compact ? 'Search and select an Order' : 'Search Order...'}
            sx={compact ? {
              bgcolor: '#FFFFFF',
              borderRadius: 1.8,
              '& .MuiOutlinedInput-root': { py: '1px !important' }
            } : undefined}
          />
        )}
      />
      {!embedded ? <Button size="small" startIcon={<Refresh />} onClick={load} disabled={loading || disabled}>Refresh</Button> : null}
    </Stack>
  );

  return embedded ? content : <Paper variant="outlined" sx={{ px: 0.9, py: 0.6, borderRadius: 1.9, borderColor: '#DFE7EF' }}>{content}</Paper>;
}
