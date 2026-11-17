import { useConfirmAction } from '../../components/confirmation/ActionConfirmationProvider';
import { useT, useSystemMessage } from '../../i18n/LanguageProvider';
import { managementPageSx, managementStackSx } from 'components/ManagementViewportStyles';
import useAutoDismissFeedback from '../../hooks/useAutoDismissFeedback';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Delete, Edit, FolderOpenOutlined } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { useNavigate } from 'react-router-dom';
import { getBuyerCatalog, normalizeBuyerCode, saveSelectedBuyer, setBuyerCatalog } from 'utils/buyerAccess';
import { createBuyerAdmin, deleteBuyerAdmin, listBuyersAdmin, updateBuyerAdmin } from 'services/adminService';

export default function BuyerManagementPage() {
  const confirmAction = useConfirmAction();
  const trUi = useT();
  const trSystem = useSystemMessage();
  const navigate = useNavigate();
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [filters, setFilters] = useState({ buyerKey: '', buyerName: '', description: '', active: '' });
  const [dialog, setDialog] = useState(null);
  const [error, setError] = useState('');

  useAutoDismissFeedback(error, setError, '', 'error');
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
    if (!await confirmAction({ kind: dialog?.id ? 'update' : 'create', entity: 'Buyer', name: body?.buyerName || body?.buyerKey || '' })) return;
    try {
      dialog?.id ? await updateBuyerAdmin(dialog.id, body) : await createBuyerAdmin(body);
      setDialog(null);
      load(0, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const remove = async (row) => {
    if (!row || !await confirmAction({ kind: 'delete', entity: 'Buyer', name: row.buyerKey })) return;
    try {
      await deleteBuyerAdmin(row.id);
      load(state.page, state.size);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };


  const openOrders = (row) => {
    if (!isSessionBuyer(row?.buyerKey)) {
      window.dispatchEvent(new CustomEvent('bsl:working-context:open', { detail: { buyerCode: row?.buyerKey, target: 'orders' } }));
      return;
    }
    const buyer = saveSelectedBuyer({
      id: row?.id,
      buyerKey: row?.buyerKey,
      buyerName: row?.buyerName,
      slug: row?.slug,
      active: row?.active,
      sequence: row?.sequence,
      supportedTypes: row?.supportedTypes,
      description: row?.description
    });
    if (!buyer) return;
    setBuyerCatalog([...getBuyerCatalog(), buyer]);
    navigate(`/buyers/${buyer.slug}/orders`);
  };

  const columns = [
    { key: 'buyerKey', label: trUi("Buyer Key") },
    { key: 'buyerName', label: trUi("Buyer Name") },
    { key: 'active', label: trUi("Status"), render: (r) => r.active ? 'Active' : 'Inactive' },
    { key: 'sequence', label: trUi("Sequence") },
    { key: 'description', label: trUi("Description") },
    { key: 'supportedTypes', label: trUi("Types"), render: (r) => supportedSystemTypes(r).join(', ') || '—' },
    {
      key: 'actions',
      label: trUi("Actions"),
      minWidth: 132,
      render: (r) => (
        <Stack direction="row" spacing={0.25} alignItems="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={trUi("Open Order Management")}><IconButton size="small" color="primary" onClick={() => openOrders(r)}><FolderOpenOutlined fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={trUi("Edit Buyer")}><IconButton size="small" onClick={() => setDialog(r)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={trUi("Delete Buyer")}><IconButton size="small" color="error" onClick={() => remove(r)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 }, ...managementPageSx }}>
      <Stack spacing={1} sx={managementStackSx}>
        <Stack direction="row" justifyContent="flex-end">
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialog({})}>{trUi("Add Buyer")}</Button>
        </Stack>
        {error ? <Alert severity="error" onClose={() => setError('')}>{trSystem(error)}</Alert> : null}
        
        <ManagementTable
          fillAvailableHeight
          filterBar={<TableFilterBar
          fields={[
            { key: 'buyerKey', label: trUi("Buyer Key") },
            { key: 'buyerName', label: trUi("Buyer Name") },
            { key: 'description', label: trUi("Description") },
    { key: 'supportedTypes', label: trUi("Types"), render: (r) => supportedSystemTypes(r).join(', ') || '—' },
            { key: 'active', label: trUi("Status"), options: [{ value: 'true', label: trUi("Active") }, { value: 'false', label: trUi("Inactive") }] }
          ]}
          values={filters}
          onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setFilters({ buyerKey: '', buyerName: '', description: '', active: '' })}
          disabled={state.loading}
        />} {...state} rowsPerPage={state.size} onPageChange={(p) => load(p, state.size)} onRowsPerPageChange={(s) => load(0, s)} columns={columns} />
        {dialog ? <BuyerDialog row={dialog} onClose={() => setDialog(null)} onSave={save} /> : null}
      </Stack>
    </Box>
  );
}

import { DEFAULT_TABLE_PAGE_SIZE } from '../../constants/appConstants';
import { isSessionBuyer } from '../../utils/systemTypes';
import { SYSTEM_TYPE_OPTIONS, supportedSystemTypes } from '../../utils/systemTypes';

function BuyerDialog({ row, onClose, onSave }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const editing = Boolean(row.id);
  const [form, setForm] = useState({
    buyerKey: row.buyerKey || '',
    buyerName: row.buyerName || '',
    active: row.active !== false,
    sequence: row.sequence || 0,
    description: row.description || '',
    supportedTypes: supportedSystemTypes(row)
  });

  const changeKey = (value) => {
    const key = normalizeBuyerCode(value);
    setForm((s) => ({ ...s, buyerKey: key }));
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? 'Edit' : 'Add'}{trUi(" Buyer")}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField
            label={trUi("Buyer Key")}
            value={form.buyerKey}
            disabled={editing}
            onChange={(e) => changeKey(e.target.value)}
            helperText={editing ? trUi("Buyer Key cannot be changed.") : trUi("Example: NIKE, ADIDAS, NEW_BUYER. Letters/numbers are normalized to an uppercase key.")}
          />
          <TextField label={trUi("Buyer Name")} value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
          <TextField select label={trUi("Status")} value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}>
            <MenuItem value="active">{trUi("Active")}</MenuItem>
            <MenuItem value="inactive">{trUi("Inactive")}</MenuItem>
          </TextField>
          <Typography fontWeight={800}>{trUi("Supported System Types")}</Typography>
          <Stack direction="row" flexWrap="wrap">
            {SYSTEM_TYPE_OPTIONS.map((option) => <FormControlLabel key={option.value}
              control={<Checkbox checked={form.supportedTypes.includes(option.value)}
                onChange={() => setForm((s) => ({ ...s, supportedTypes: s.supportedTypes.includes(option.value)
                  ? s.supportedTypes.filter((v) => v !== option.value) : [...s.supportedTypes, option.value] }))} />}
              label={option.label} />)}
          </Stack>
          <Alert severity="info">{trUi("RFID is implemented for LULULEMON; Factory Use Only for ES. UnRFID is a future workflow and cannot be used until its module is developed.")}</Alert>
          <TextField type="number" label={trUi("Sequence")} value={form.sequence} onChange={(e) => setForm({ ...form, sequence: Number(e.target.value) })} />
          <TextField multiline minRows={2} label={trUi("Description")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{trUi("Cancel")}</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.buyerKey || !form.buyerName.trim()}>{trUi("Save")}</Button>
      </DialogActions>
    </Dialog>
  );
}
