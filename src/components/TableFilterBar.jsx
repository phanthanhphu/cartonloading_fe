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
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: `repeat(${Math.min(Math.max(fields.length, 1), 6)}, minmax(135px,1fr)) auto` },
        gap: 0.75,
        alignItems: 'center',
        ...sx
      }}
    >
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
      <Button
        size="small"
        variant="text"
        startIcon={active ? <ClearRounded /> : <FilterAltOutlined />}
        onClick={() => active && onClear?.()}
        disabled={disabled || !active}
        sx={{ justifySelf: { xs: 'stretch', lg: 'end' }, whiteSpace: 'nowrap' }}
      >
        {active ? 'Clear filters' : 'Filters'}
      </Button>
    </Box>
  );
}
