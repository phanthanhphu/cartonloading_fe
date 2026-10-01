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
import { emptyPackingListForm, PACKING_LIST_FIELDS, toPackingListPayload } from './packingListConfig';

const sections = [
  { title: 'Carton Range', fields: ['cartonFrom', 'cartonTo', 'cartonsQty'] },
  { title: 'PO and Product', fields: ['poNumber', 'styleNumber', 'style', 'articleNumber', 'color', 'size', 'qtyPerCarton', 'totalPcs'] },
  { title: 'Measurement and Weight', fields: ['cartonMeasurement', 'cbm', 'grossWeightKg', 'netWeightKg', 'actualWeightKg', 'remarks'] }
];

export default function PackingListLineFormDialog({ open, record, saving, onClose, onSave }) {
  const [form, setForm] = useState(emptyPackingListForm());
  const [errors, setErrors] = useState({});
  const fieldMap = useMemo(() => Object.fromEntries(PACKING_LIST_FIELDS.map((field) => [field.name, field])), []);

  useEffect(() => {
    const next = emptyPackingListForm();
    if (record) {
      PACKING_LIST_FIELDS.forEach((field) => {
        const value = record[field.name];
        next[field.name] = value === null || value === undefined ? '' : String(value);
      });
    }
    setForm(next);
    setErrors({});
  }, [record, open]);

  const submit = () => {
    const nextErrors = {};
    PACKING_LIST_FIELDS.forEach((field) => {
      if (field.required && String(form[field.name] ?? '').trim() === '') {
        nextErrors[field.name] = `${field.label} is required.`;
      }
    });
    const from = Number(form.cartonFrom);
    const to = Number(form.cartonTo);
    if (form.cartonFrom !== '' && form.cartonTo !== '' && Number.isFinite(from) && Number.isFinite(to) && to < from) {
      nextErrors.cartonTo = 'C/T To must be greater than or equal to C/T From.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave(toPackingListPayload(form));
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 900 }}>{record?.id ? 'Edit Packing List Row' : 'Add Packing List Row'}</DialogTitle>
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
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={form[name]}
                    error={Boolean(errors[name])}
                    helperText={errors[name] || ' '}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
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
