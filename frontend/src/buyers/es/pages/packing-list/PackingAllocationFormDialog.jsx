import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';
import { emptyAllocationForm, PACKING_ALLOCATION_FIELDS, toAllocationPayload } from './packingListConfig';

const sections = [
  { title: 'Supplier and Shipment', fields: ['supplierName', 'supplierNumber', 'productionFacility', 'containerNumber', 'shipmentMode', 'etd', 'eta'] },
  { title: 'PO and Product', fields: ['poNumber', 'articleNumber', 'styleNumber', 'style', 'color', 'size', 'qtyPerCarton', 'invoiceNumber'] },
  { title: 'AIR and SEA Quantities', fields: ['totalPcs', 'totalCartons', 'pcsAir', 'cartonsAir', 'pcsSea', 'cartonsSea', 'cbmAir', 'kgAir'] },
  { title: 'Status and Carton Details', fields: ['status', 'openPoQtyOverdel', 'remarks', 'yoLotNumber', 'hCtn', 'cbmCtn'] }
];

export default function PackingAllocationFormDialog({ open, record, saving, onClose, onSave }) {
  const [form, setForm] = useState(emptyAllocationForm());
  const [errors, setErrors] = useState({});
  const fieldMap = useMemo(() => Object.fromEntries(PACKING_ALLOCATION_FIELDS.map((field) => [field.name, field])), []);

  useEffect(() => {
    const next = emptyAllocationForm();
    if (record) {
      PACKING_ALLOCATION_FIELDS.forEach((field) => {
        const value = record[field.name];
        next[field.name] = value === null || value === undefined ? '' : String(value);
      });
    }
    setForm(next);
    setErrors({});
  }, [record, open]);

  const submit = () => {
    const nextErrors = {};
    PACKING_ALLOCATION_FIELDS.forEach((field) => {
      if (field.required && String(form[field.name] ?? '').trim() === '') {
        nextErrors[field.name] = `${field.label} is required.`;
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(toAllocationPayload(form));
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 900 }}>{record?.id ? 'Edit Order Items Row' : 'Add Order Items Row'}</DialogTitle>
      <DialogContent dividers>
        {sections.map((section) => (
          <Box key={section.title} sx={{ mb: 2.4 }}>
            <Typography sx={{ mb: 1.1, fontWeight: 900, color: '#103B5C' }}>{section.title}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.4 }}>
              {section.fields.map((name) => {
                const field = fieldMap[name];
                return (
                  <TextField
                    key={name}
                    label={field.label}
                    type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                    value={form[name]}
                    error={Boolean(errors[name])}
                    helperText={errors[name] || ' '}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                    InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
                    inputProps={field.type === 'number' ? { step: 'any', min: 0 } : undefined}
                    multiline={name === 'remarks'}
                    minRows={name === 'remarks' ? 2 : undefined}
                    fullWidth
                    size="small"
                  />
                );
              })}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button onClick={submit} disabled={saving} variant="contained" sx={{ textTransform: 'none' }}>
          {saving ? 'Saving...' : 'Save Row'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
