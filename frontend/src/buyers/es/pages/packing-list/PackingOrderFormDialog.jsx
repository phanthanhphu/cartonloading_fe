import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField
} from '@mui/material';
import { PACKING_ORDER_FIELDS } from './packingListConfig';

const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const emptyForm = () => PACKING_ORDER_FIELDS.reduce((result, field) => ({
  ...result,
  [field.name]: field.name === 'orderDate' ? today() : ''
}), {});

export default function PackingOrderFormDialog({ open, record, saving, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(PACKING_ORDER_FIELDS.reduce((result, field) => ({
      ...result,
      [field.name]: record?.[field.name] ?? (field.name === 'orderDate' ? today() : '')
    }), {}));
    setErrors({});
  }, [open, record]);

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const submit = () => {
    const nextErrors = {};
    if (!String(form.orderDate || '').trim()) nextErrors.orderDate = 'Start Order is required.';
    if (!String(form.endOrderDate || '').trim()) nextErrors.endOrderDate = 'End Order is required.';
    else if (form.orderDate && form.endOrderDate < form.orderDate) nextErrors.endOrderDate = 'End Order cannot be earlier than Start Order.';
    if (!String(form.orderName || '').trim()) nextErrors.orderName = 'Order Name is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onSave(PACKING_ORDER_FIELDS.reduce((result, field) => ({
      ...result,
      [field.name]: form[field.name] === '' ? null : form[field.name]
    }), {}));
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 950 }}>{record?.id ? 'Edit Order' : 'Add Order'}</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          {PACKING_ORDER_FIELDS.map((field) => (
            <TextField
              key={field.name}
              type={field.type === 'date' ? 'date' : 'text'}
              label={field.label}
              value={form[field.name] ?? ''}
              onChange={(event) => update(field.name, event.target.value)}
              error={Boolean(errors[field.name])}
              helperText={errors[field.name] || ' '}
              required={field.required}
              InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
              inputProps={field.name === 'endOrderDate' ? { min: form.orderDate || undefined } : undefined}
              sx={{ gridColumn: field.name === 'orderName' ? '1 / -1' : undefined }}
            />
          ))}
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button onClick={submit} disabled={saving} variant="contained" sx={{ textTransform: 'none' }}>
          {saving ? 'Saving...' : 'Save Order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
