import { Chip } from '@mui/material';

const normalize = (value) => String(value || 'UNKNOWN').trim().toUpperCase().replace(/[\s-]+/g, '_');

const colorFor = (status) => {
  const value = normalize(status);
  if (['COMPLETED', 'FINISHED', 'LABEL_CONFIRMED', 'PACKED', 'READY_TO_SHIP', 'RELEASED', 'PASS', 'PASSED', 'OK', 'AVAILABLE', 'PRINTED', 'SHIPPED', 'SUCCESS'].includes(value)) return 'success';
  if (['IN_PROGRESS', 'PACKING', 'PRINTING', 'SENT', 'ASSIGNED', 'RUNNING', 'SCANNING'].includes(value)) return 'info';
  if (['READY', 'READY_TO_PACK', 'PLANNED', 'CREATED', 'OPEN'].includes(value)) return 'primary';
  if (['WAITING', 'WAITING_LABEL', 'WAITING_SSCC', 'WAITING_EX_FTY', 'WAITING_FOR_WEIGHING', 'WAITING_WEIGHT', 'PENDING', 'NOT_STARTED', 'DRAFT', 'UNASSIGNED'].includes(value)) return 'warning';
  if (['CANCELLED', 'CANCELED', 'FAILED', 'FAIL', 'ERROR', 'VOID', 'WEIGHT_WARNING', 'WEIGHT_MISMATCH', 'HOLD', 'REJECTED', 'WRONG_SKU'].includes(value)) return 'error';
  return 'default';
};

const labelFor = (status) => {
  const raw = String(status || '—').trim();
  if (!raw) return '—';
  return raw
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function StatusChip({ status, size = 'small', variant = 'filled', sx, ...props }) {
  const color = colorFor(status);
  return (
    <Chip
      size={size}
      label={labelFor(status)}
      color={color}
      variant={variant}
      sx={{ fontWeight: 750, minWidth: 88, ...sx }}
      {...props}
    />
  );
}

export { colorFor as statusColor, labelFor as statusLabel };
