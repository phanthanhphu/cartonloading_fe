import { useT, useSystemMessage } from '../../../i18n/LanguageProvider';
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
// Preserve the existing QC summary option; the two assignment columns are independently opt-in.
const qcPreferenceKey = () => {
  const key = storageKey();
  return key ? `${key}.include-qc.v1` : null;
};
const storedIncludeQcColumns = () => {
  try {
    const key = qcPreferenceKey();
    return key ? localStorage.getItem(key) !== 'false' : true;
  } catch { return true; }
};
// New assignment columns are not included unless this user explicitly opts in.
const assignmentPreferenceKey = (name) => {
  const key = storageKey();
  return key ? `${key}.${name}.v1` : null;
};
const storedAssignmentChoice = (name) => {
  try {
    const key = assignmentPreferenceKey(name);
    return key ? localStorage.getItem(key) === 'true' : false;
  } catch { return false; }
};

export default function ShippingScheduleExportDialog({ open, exporting, error, onClose, onExport }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [selected, setSelected] = useState(storedColumns);
  const [includeQcColumns, setIncludeQcColumns] = useState(storedIncludeQcColumns);
  const [includeSsccAssigned, setIncludeSsccAssigned] = useState(() => storedAssignmentChoice('sscc-assigned'));
  const [includeSkuItemsAssigned, setIncludeSkuItemsAssigned] = useState(() => storedAssignmentChoice('sku-items-assigned'));
  const [message, setMessage] = useState('');
  useAutoDismissFeedback(message, setMessage, '', 'info');
  useEffect(() => {
    if (!open) return;
    setSelected(storedColumns());
    setIncludeQcColumns(storedIncludeQcColumns());
    setIncludeSsccAssigned(storedAssignmentChoice('sscc-assigned'));
    setIncludeSkuItemsAssigned(storedAssignmentChoice('sku-items-assigned'));
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
    setIncludeQcColumns(true);
    setIncludeSsccAssigned(false);
    setIncludeSkuItemsAssigned(false);
    const key = storageKey();
    const qcKey = qcPreferenceKey();
    if (key) localStorage.removeItem(key);
    if (qcKey) localStorage.removeItem(qcKey);
    for (const name of ['sscc-assigned', 'sku-items-assigned']) {
      const preference = assignmentPreferenceKey(name);
      if (preference) localStorage.removeItem(preference);
    }
    setMessage(trUi("Default template restored. Carton/RFID summary is on; SSCC and SKU assignment columns are off."));
  };
  const saveTemplate = () => {
    const key = storageKey();
    if (!key) { setMessage(trUi("Please sign in again before saving an export template.")); return; }
    try {
      localStorage.setItem(key, JSON.stringify(selected));
      const qcKey = qcPreferenceKey();
      if (qcKey) localStorage.setItem(qcKey, String(includeQcColumns));
      const ssccKey = assignmentPreferenceKey('sscc-assigned');
      const skuKey = assignmentPreferenceKey('sku-items-assigned');
      if (ssccKey) localStorage.setItem(ssccKey, String(includeSsccAssigned));
      if (skuKey) localStorage.setItem(skuKey, String(includeSkuItemsAssigned));
      setMessage(trUi("Export template and optional QC columns saved for this account in this browser."));
    } catch { setMessage(trUi("Unable to save the template in this browser.")); }
  };

  return <Dialog open={open} onClose={exporting ? undefined : onClose} maxWidth="sm" fullWidth
    aria-labelledby="shipping-export-title">
    <DialogTitle id="shipping-export-title">{trUi("Customize Excel Export")}</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">{trUi("\n          Export one Shipping POs sheet (default: 12 customizable columns).\n          Current table filters, including Scan Date, are applied to the export.\n        ")}</Typography>
        {error && <TransientAlert messageKey={trSystem(error)} severity="error">{trSystem(error)}</TransientAlert>}
        {message && <Alert severity="info" onClose={() => setMessage('')}>{message}</Alert>}
        <Paper variant="outlined" sx={{ p: 1.1 }}>
          <Stack spacing={0.7}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Checkbox size="small" checked={includeQcColumns}
                onChange={(event) => setIncludeQcColumns(event.target.checked)}
                inputProps={{ 'aria-label': 'Include Carton Completed and RFID Scan Result columns' }} />
              <Box>
                <Typography variant="body2" fontWeight={700}>{trUi("Include QC summary (default: on)")}</Typography>
                <Typography variant="caption" color="text.secondary">{trUi("\n                  Carton Completed · RFID Scan Result\n                ")}</Typography>
              </Box>
            </Stack>
            <Divider />
            <Typography variant="body2" fontWeight={700}>{trUi("Optional assignment columns (default: off)")}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }}>
              <Stack direction="row" alignItems="center">
                <Checkbox size="small" checked={includeSsccAssigned}
                  onChange={(event) => setIncludeSsccAssigned(event.target.checked)}
                  inputProps={{ 'aria-label': 'Add SSCC Assigned column' }} />
                <Typography variant="body2">{trUi("SSCC Assigned (cartons)")}</Typography>
              </Stack>
              <Stack direction="row" alignItems="center">
                <Checkbox size="small" checked={includeSkuItemsAssigned}
                  onChange={(event) => setIncludeSkuItemsAssigned(event.target.checked)}
                  inputProps={{ 'aria-label': 'Add SKU Items Assigned column' }} />
                <Typography variant="body2">{trUi("SKU Items Assigned (products)")}</Typography>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary">{trUi("\n              Selected assignment columns will be added to the same Shipping POs sheet, after the other export columns.\n            ")}</Typography>
          </Stack>
        </Paper>
        <Typography fontWeight={750} variant="subtitle2">{trUi("Selected columns (")}{selected.length}{trUi(") — exported from top to bottom")}</Typography>
        <Stack spacing={0.6}>
          {selected.map((key, index) => <Paper variant="outlined" key={key} sx={{ p: 0.55 }}>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="caption" sx={{ width: 22, textAlign: 'center', fontWeight: 750 }}>{index + 1}</Typography>
              <Checkbox checked size="small" disabled={selected.length === 1}
                inputProps={{ 'aria-label': `Remove ${display[key]} from Excel` }} onChange={() => disable(key)} />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>{display[key]}</Typography>
              <Tooltip title={trUi("Move up")}><span><IconButton size="small" disabled={index === 0} onClick={() => move(index, -1)}
                aria-label={`Move ${display[key]} up`}><ArrowUpward fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title={trUi("Move down")}><span><IconButton size="small" disabled={index === selected.length - 1}
                onClick={() => move(index, 1)} aria-label={trUi("Move {0} down", display[key])}><ArrowDownward fontSize="small" /></IconButton></span></Tooltip>
            </Stack>
          </Paper>)}
        </Stack>
        {available.length > 0 && <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={750}>{trUi("Additional columns")}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 0.15 }}>
            {available.map(({ key, label }) => <Stack key={key} direction="row" alignItems="center">
              <Checkbox size="small" checked={false} onChange={() => enable(key)}
                inputProps={{ 'aria-label': `Add ${label} to Excel` }} />
              <Typography variant="body2">{label}</Typography>
            </Stack>)}
          </Box>
        </>}
        <Typography variant="caption" color="text.secondary">{trUi("\n          Order: ")}{selected.map((key) => display[key]).join(' → ')}
        </Typography>
      </Stack>
    </DialogContent>
    <DialogActions sx={{ flexWrap: 'wrap', px: 2, py: 1.5, gap: 0.5 }}>
      <Button size="small" onClick={reset} disabled={exporting}>{trUi("Reset Default")}</Button>
      <Button size="small" variant="outlined" onClick={saveTemplate} disabled={exporting}>{trUi("Save Template")}</Button>
      <Box sx={{ flex: '1 1 auto' }} />
      <Button size="small" onClick={onClose} disabled={exporting}>{trUi("Cancel")}</Button>
      <Button size="small" variant="contained" disabled={!selected.length || exporting}
        startIcon={exporting ? <CircularProgress size={15} color="inherit" /> : <FileDownloadOutlined />}
        onClick={() => onExport(selected, includeQcColumns, includeSsccAssigned, includeSkuItemsAssigned)}>{trUi("Export Excel")}</Button>
    </DialogActions>
  </Dialog>;
}
