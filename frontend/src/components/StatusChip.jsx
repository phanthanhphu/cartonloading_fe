import { Chip } from '@mui/material';
import { STATUS_COLOR_GROUPS } from '../constants/appConstants';

const normalize = (value) => String(value || 'UNKNOWN').trim().toUpperCase().replace(/[\s-]+/g, '_');

const colorFor = (status) => {
  const value = normalize(status);
  if (STATUS_COLOR_GROUPS.success.includes(value)) return 'success';
  if (STATUS_COLOR_GROUPS.info.includes(value)) return 'info';
  if (STATUS_COLOR_GROUPS.primary.includes(value)) return 'primary';
  if (STATUS_COLOR_GROUPS.warning.includes(value)) return 'warning';
  if (STATUS_COLOR_GROUPS.error.includes(value)) return 'error';
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
