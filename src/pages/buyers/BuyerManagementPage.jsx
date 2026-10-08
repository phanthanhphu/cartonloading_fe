import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Delete, Edit, FolderOpenOutlined } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { useNavigate } from 'react-router-dom';
import { getBuyerCatalog, normalizeBuyerCode, saveSelectedBuyer, setBuyerCatalog } from 'utils/buyerAccess';
import { createBuyerAdmin, deleteBuyerAdmin, listBuyersAdmin, updateBuyerAdmin } from 'services/adminService';

export default function BuyerManagementPage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [filters, setFilters] = useState({ buyerKey: '', buyerName: '', description: '', active: '' });
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');

  const load = async (page = state.page, size = state.size) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const r = await listBuyersAdmin({ ...filters, active: filters.active === '' ? undefined : filters.active === 'true', page, size });
      const rows = r.content || [];
      setState({ rows, count: r.totalElements || 0, page, size, loading: false });
      setBuyerCatalog([...getBuyerCatalog(), ...rows]);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => { load(0, state.size); }, [filters]);

  const save = async (body) => {
    try {
      dialog?.id ? await updateBuyerAdmin(dialog.id, body) : await createBuyerAdmin(body);
      setDialog(null);
      load(0, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const remove = async (row) => {
    if (!row || !confirm(createDeleteBuyerConfirmMessage(row.buyerKey))) return;
    try {
      await deleteBuyerAdmin(row.id);
      load(state.page, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };


  const openOrders = (row) => {
    const buyer = saveSelectedBuyer({
      id: row?.id,
      buyerKey: row?.buyerKey,
      buyerName: row?.buyerName,
      slug: row?.slug,
      active: row?.active,
      sequence: row?.sequence,
      description: row?.description
    });
    if (!buyer) return;
    setBuyerCatalog([...getBuyerCatalog(), buyer]);
    navigate(`/buyers/${buyer.slug}/orders`);
  };

  const columns = [
    { key: 'buyerKey', label: 'Buyer Key' },
    { key: 'buyerName', label: 'Buyer Name' },
    { key: 'active', label: 'Status', render: (r) => r.active ? 'Active' : 'Inactive' },
    { key: 'sequence', label: 'Sequence' },
    { key: 'description', label: 'Description' },
    {
      key: 'actions',
      label: 'Actions',
      minWidth: 132,
      render: (r) => (
        <Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Open Order Management"><IconButton size="small" color="primary" onClick={() => openOrders(r)}><FolderOpenOutlined fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit Buyer"><IconButton size="small" onClick={() => setDialog(r)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete Buyer"><IconButton size="small" color="error" onClick={() => remove(r)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h5" fontWeight={850}>Buyer Management</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})}>Add Buyer</Button>
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        <Alert severity="info">{APP_MESSAGES.BUYER_CONFIGURATION_INFO}</Alert>
        <TableFilterBar
          fields={[
            { key: 'buyerKey', label: 'Buyer Key' },
            { key: 'buyerName', label: 'Buyer Name' },
            { key: 'description', label: 'Description' },
            { key: 'active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ buyerKey: '', buyerName: '', description: '', active: '' })}
          disabled={state.loading}
        />
        <ManagementTable {...state} rowsPerPage={state.size} onPageChange={(p) => load(p, state.size)} onRowsPerPageChange={(s) => load(0, s)} columns={columns} />
        {dialog ? <BuyerDialog row={dialog} onClose={() => setDialog(null)} onSave={save} /> : null}
      </Stack>
    </Box>
  );
}

import { APP_MESSAGES, createDeleteBuyerConfirmMessage } from '../../constants/appMessages';
import { DEFAULT_TABLE_PAGE_SIZE } from '../../constants/appConstants';

function BuyerDialog({ row, onClose, onSave }) {
  const editing = Boolean(row.id);
  const [form, setForm] = useState({
    buyerKey: row.buyerKey || '',
    buyerName: row.buyerName || '',
    active: row.active !== false,
    sequence: row.sequence || 0,
    description: row.description || ''
  });

  const changeKey = (value) => {
    const key = normalizeBuyerCode(value);
    setForm((s) => ({ ...s, buyerKey: key }));
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? 'Edit' : 'Add'} Buyer</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField
            label="Buyer Key"
            value={form.buyerKey}
            disabled={editing}
            onChange={(e) => changeKey(e.target.value)}
            helperText={editing ? 'Buyer Key cannot be changed.' : 'Example: NIKE, ADIDAS, NEW_BUYER. Letters/numbers are normalized to an uppercase key.'}
          />
          <TextField label="Buyer Name" value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
          <TextField select label="Status" value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <TextField type="number" label="Sequence" value={form.sequence} onChange={(e) => setForm({ ...form, sequence: Number(e.target.value) })} />
          <TextField multiline minRows={2} label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.buyerKey || !form.buyerName.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
