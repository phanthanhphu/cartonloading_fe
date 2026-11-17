import { useT } from '../../../i18n/LanguageProvider';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import { ClearRounded, FilterAltOutlined } from '@mui/icons-material';

// Keep the first seven PO/workflow filters on row 1 and the remaining seven
// QC/date/action controls on row 2 at desktop widths. These are the SAME
// filter keys sent to the existing Shipping Schedule API and Excel export.
const FILTER_FIELDS = [
  { key: 'poNumber', label: 'PO No.' },
  { key: 'factory', label: 'Factory' },
  { key: 'style', label: 'Style' },
  { key: 'sku', label: 'SKU' },
  { key: 'destination', label: 'Destination' },
  { key: 'status', label: 'Workflow Status' },
  { key: 'inspectionStatus', label: 'QC Progress', options: [
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'INCOMPLETE', label: 'Incomplete' },
    { value: 'IMPORTING', label: 'Importing' },
    { value: 'NOT_STARTED', label: 'Imported / Not Started' }
  ] },
  { key: 'exFtyDate', label: 'Ex-Factory', type: 'date' },
  { key: 'cartonStatus', label: 'Carton Completion', options: [
    { value: 'COMPLETED', label: 'Completed cartons' },
    { value: 'INCOMPLETE', label: 'Incomplete cartons' }
  ] },
  { key: 'ssccStatus', label: 'SSCC Assignment', options: [
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'MISSING', label: 'Not assigned' }
  ] },
  { key: 'skuStatus', label: 'SKU / Item Assignment', options: [
    { value: 'ASSIGNED', label: 'Complete' },
    { value: 'MISSING', label: 'Missing items' }
  ] },
  { key: 'rfidStatus', label: 'RFID Status', options: [
    { value: 'PASS', label: 'PASS' },
    { value: 'FAILED', label: 'FAILED' },
    { value: 'NOT_SCANNED', label: 'Not scanned' },
    { value: 'MISSING_TAGS', label: 'Missing tags' }
  ] },
  { key: 'scanDate', label: 'Scan Date', type: 'date' }
];

export default function ShippingScheduleFilterBar({ values = {}, onChange, onClear, disabled = false }) {
  const trUi = useT();
  const active = FILTER_FIELDS.some((field) => String(values[field.key] ?? '').trim() !== '');
  return (
    <Box
      role="group"
      aria-label={trUi("Shipping Schedule PO and carton filters")}
      sx={{
        display: 'grid',
        // At desktop width: 7 PO fields, then 6 QC/date fields + Clear Filters.
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
          lg: 'repeat(7, minmax(0, 1fr))'
        },
        columnGap: 0.9,
        rowGap: 2.5, // Floating labels need clearance from the previous row.
        alignItems: 'center',
        width: '100%'
      }}
    >
      {FILTER_FIELDS.map((field) => (
        <TextField
          key={field.key}
          fullWidth
          size="small"
          type={field.type || 'text'}
          select={Boolean(field.options)}
          label={trUi(field.label)}
          placeholder={field.placeholder}
          value={values[field.key] ?? ''}
          onChange={(event) => onChange?.(field.key, event.target.value)}
          disabled={disabled}
          InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
          sx={{
            minWidth: 0,
            '& .MuiInputBase-root': { height: 40, bgcolor: 'background.paper' },
            '& .MuiSelect-select': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
          }}
        >
          {field.options ? [
            <MenuItem key="__all" value="">{trUi("All")}</MenuItem>,
            ...field.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>{trUi(option.label)}</MenuItem>
            ))
          ] : null}
        </TextField>
      ))}
      <Button
        fullWidth
        size="small"
        variant={active ? 'outlined' : 'text'}
        startIcon={active ? <ClearRounded /> : <FilterAltOutlined />}
        onClick={() => active && onClear?.()}
        disabled={disabled || !active}
        sx={{ height: 40, minWidth: 0, whiteSpace: 'nowrap' }}
      >
        {active ? trUi("Clear Filters") : trUi("Filters")}
      </Button>
    </Box>
  );
}
