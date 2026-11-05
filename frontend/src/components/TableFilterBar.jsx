import { Box, Button, MenuItem, TextField } from '@mui/material';
import { ClearRounded, FilterAltOutlined } from '@mui/icons-material';

export default function TableFilterBar({ fields = [], values = {}, onChange, onClear, disabled = false, sx = {} }) {
  const active = fields.some((field) => {
    const value = values?.[field.key];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        alignItems: 'center',
        ...sx
      }}
    >
      <Box sx={{ flex: '1 1 600px', minWidth: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }, gap: 0.75 }}>
      {fields.map((field) => (
        <TextField
          key={field.key}
          size="small"
          type={field.type || 'text'}
          select={Boolean(field.options)}
          label={field.label}
          placeholder={field.placeholder}
          value={values?.[field.key] ?? ''}
          onChange={(event) => onChange?.(field.key, event.target.value)}
          disabled={disabled}
          InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
          sx={{ minWidth: 0 }}
        >
          {field.options ? [<MenuItem key="__all" value="">All</MenuItem>, ...field.options.map((option) => {
            const value = typeof option === 'string' ? option : option.value;
            const label = typeof option === 'string' ? option : option.label;
            return <MenuItem key={value} value={value}>{label}</MenuItem>;
          })] : null}
        </TextField>
      ))}
      </Box>
      <Button
        size="small"
        variant="text"
        startIcon={active ? <ClearRounded /> : <FilterAltOutlined />}
        onClick={() => active && onClear?.()}
        disabled={disabled || !active}
        sx={{ ml: 'auto', whiteSpace: 'nowrap', minWidth: 96 }}
      >
        {active ? 'Clear filters' : 'Filters'}
      </Button>
    </Box>
  );
}
