import TransientAlert from '../../../components/TransientAlert';
import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { ArrowDownward, ArrowUpward, FileDownloadOutlined } from '@mui/icons-material';
import { STORAGE_KEY } from '../../../constants/appConstants';
import { readStoredUser } from '../../../utils/accessControl';
import { SHIPPING_EXPORT_COLUMN_OPTIONS, SHIPPING_EXPORT_DEFAULT_COLUMNS,
  validShippingExportColumns } from './shippingExportColumns';

// Saved per signed-in account in this browser; independent from All POs' Customize Columns.
const storageKey = () => {
  const user = readStoredUser();
  const id = localStorage.getItem(STORAGE_KEY.USER_ID) || user?.id || user?.userId || user?.email;
  return id ? `lululemon.shipping-schedule.export-columns.v1.${encodeURIComponent(String(id))}` : null;
};
const storedColumns = () => {
  try {
    const key = storageKey();
    if (!key) return [...SHIPPING_EXPORT_DEFAULT_COLUMNS];
    const raw = localStorage.getItem(key);
    return raw ? validShippingExportColumns(JSON.parse(raw)) : [...SHIPPING_EXPORT_DEFAULT_COLUMNS];
  } catch { return [...SHIPPING_EXPORT_DEFAULT_COLUMNS]; }
};
const display = Object.fromEntries(SHIPPING_EXPORT_COLUMN_OPTIONS.map(({ key, label }) => [key, label]));

export default function ShippingScheduleExportDialog({ open, exporting, error, onClose, onExport }) {
  const [selected, setSelected] = useState(storedColumns);
  const [message, setMessage] = useState('');
  useAutoDismissFeedback(message, setMessage, '', 'info');
  useEffect(() => {
    if (!open) return;
    setSelected(storedColumns());
    setMessage('');
  }, [open]);

  const available = useMemo(() => SHIPPING_EXPORT_COLUMN_OPTIONS.filter(({ key }) => !selected.includes(key)), [selected]);
  const move = (index, delta) => setSelected((current) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= current.length) return current;
    const next = [...current];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    return next;
  });
  const disable = (key) => setSelected((current) => current.filter((item) => item !== key));
  const enable = (key) => setSelected((current) => current.includes(key) ? current : [...current, key]);

  const reset = () => {
    setSelected([...SHIPPING_EXPORT_DEFAULT_COLUMNS]);
    const key = storageKey();
    if (key) localStorage.removeItem(key);
    setMessage('Default 12-column template restored.');
  };
  const saveTemplate = () => {
    const key = storageKey();
    if (!key) { setMessage('Please sign in again before saving an export template.'); return; }
    try {
      localStorage.setItem(key, JSON.stringify(selected));
      setMessage('Export template saved for this account in this browser.');
    } catch { setMessage('Unable to save the template in this browser.'); }
  };

  return <Dialog open={open} onClose={exporting ? undefined : onClose} maxWidth="sm" fullWidth
    aria-labelledby="shipping-export-title">
    <DialogTitle id="shipping-export-title">Customize Excel Export</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Select export columns and change their order. The default is 12 columns. This does not change the All POs table.
        </Typography>
        {error && <TransientAlert messageKey={error} severity="error">{error}</TransientAlert>}
        {message && <Alert severity="info" onClose={() => setMessage('')}>{message}</Alert>}
        <Typography fontWeight={750} variant="subtitle2">Selected columns ({selected.length}) — exported from top to bottom</Typography>
        <Stack spacing={0.6}>
          {selected.map((key, index) => <Paper variant="outlined" key={key} sx={{ p: 0.55 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="caption" sx={{ width: 22, textAlign: 'center', fontWeight: 750 }}>{index + 1}</Typography>
              <Checkbox checked size="small" disabled={selected.length === 1}
                inputProps={{ 'aria-label': `Remove ${display[key]} from Excel` }} onChange={() => disable(key)} />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{display[key]}</Typography>
              <Tooltip title="Move up"><span><IconButton size="small" disabled={index === 0} onClick={() => move(index, -1)}
                aria-label={`Move ${display[key]} up`}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Move down"><span><IconButton size="small" disabled={index === selected.length - 1}
                onClick={() => move(index, 1)} aria-label={`Move ${display[key]} down`}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
            </Stack>
          </Paper>)}
        </Stack>
        {available.length > 0 && <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={750}>Additional columns</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 0.15 }}>
            {available.map(({ key, label }) => <Stack key={key} direction="row" alignItems="center">
              <Checkbox size="small" checked={false} onChange={() => enable(key)}
                inputProps={{ 'aria-label': `Add ${label} to Excel` }} />
              <Typography variant="body2">{label}</Typography>
            </Stack>)}
          </Box>
        </>}
        <Typography variant="caption" color="text.secondary">
          Order: {selected.map((key) => display[key]).join(' → ')}
        </Typography>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ flexWrap: 'wrap', px: 2, py: 1.5, gap: 0.5 }}>
      <Button size="small" onClick={reset} disabled={exporting}>Reset Default</Button>
      <Button size="small" variant="outlined" onClick={saveTemplate} disabled={exporting}>Save Template</Button>
      <Box sx={{ flex: '1 1 auto' }} />
      <Button size="small" onClick={onClose} disabled={exporting}>Cancel</Button>
      <Button size="small" variant="contained" disabled={!selected.length || exporting}
        startIcon={exporting ? <CircularProgress size={15} color="inherit" /> : <FileDownloadOutlined />}
        onClick={() => onExport(selected)}>Export Excel</Button>
    </DialogActions>
  </Dialog>;
}
