import { useCallback, useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { listManagedOrders } from 'services/managementService';

const BUYER = 'LULULEMON';
const STORAGE_KEY = 'cartonloading.lululemon.orderId';

async function loadAllOrders() {
  const rows = [];
  let page = 0;
  const size = 100;
  while (true) {
    const result = await listManagedOrders(BUYER, { page, size });
    rows.push(...(result?.content || []));
    if (result?.last || page + 1 >= Number(result?.totalPages || 0) || !(result?.content || []).length) break;
    page += 1;
  }
  return rows;
}

export default function LululemonOrderScope({ value, onChange, disabled = false, embedded = false, compact = false }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const next = await loadAllOrders();
      setOrders(next);
      const stored = localStorage.getItem(STORAGE_KEY) || '';
      const validCurrent = next.some((row) => row.id === value) ? value : '';
      const validStored = next.some((row) => row.id === stored) ? stored : '';
      const chosen = validCurrent || validStored || next[0]?.id || '';
      if (chosen && chosen !== value) onChange(chosen);
      if (!chosen && value) onChange('');
    } catch (e) {
      setOrders([]);
      setError(e?.response?.data?.message || e.message || 'Unable to load Orders.');
    } finally { setLoading(false); }
  }, [value, onChange]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (next) => {
    if (next) localStorage.setItem(STORAGE_KEY, next); else localStorage.removeItem(STORAGE_KEY);
    onChange(next);
  };

  if (error) return <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>;
  if (!loading && !orders.length) return <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => navigate('/buyers/lululemon/orders')}>Create Order</Button>}>Create a LULULEMON Order before importing PO or scanning cartons.</Alert>;

  const content = (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }}>
      {!embedded ? <Box sx={{ minWidth: 92 }}><Typography variant="caption" color="text.secondary">Active Order</Typography><Typography variant="body2" sx={{ fontWeight: 750 }}>Order scope</Typography></Box> : null}
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
          <Box component="li" {...props} key={row.id} sx={{ alignItems: 'flex-start !important', py: '8px !important' }}>
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

  return embedded ? content : <Paper variant="outlined" sx={{ px: 1.25, py: 0.9, borderRadius: 2.25, borderColor: '#DFE7EF' }}>{content}</Paper>;
}
