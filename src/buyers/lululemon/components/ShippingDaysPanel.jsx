import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { Add, CalendarMonthOutlined, ChevronRight, DeleteOutline, FileDownloadOutlined, Refresh } from '@mui/icons-material';
import { listPoShippingDays, getPoShippingDay, removePoFromShippingDay, exportPoShippingDayExcel } from '../services/shipping';

const humanDate = (date) => {
  const parts = String(date || '').split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
};
const message = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

/** A date item is derived from persisted PO membership; no duplicate date items per Factory/Order. */
export default function ShippingDaysPanel({ orderId, buyerCode, factoryCode, writable, refreshKey, onAddToDate, onChanged }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [removing, setRemoving] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadDays = useCallback(async () => {
    if (!orderId || !factoryCode) { setDays([]); return; }
    setLoading(true);
    setError('');
    try { setDays(await listPoShippingDays(orderId, factoryCode, buyerCode)); }
    catch (e) { setError(message(e, 'Unable to load Shipping Dates.')); }
    finally { setLoading(false); }
  }, [orderId, factoryCode, buyerCode]);

  useEffect(() => { loadDays(); }, [loadDays, refreshKey]);
  useEffect(() => { setOpened(null); setDetail(null); setDetailError(''); }, [orderId, factoryCode]);

  const openDay = async (day) => {
    setOpened(day);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try { setDetail(await getPoShippingDay(orderId, day, factoryCode, buyerCode)); }
    catch (e) { setDetailError(message(e, 'Unable to load POs for this Shipping Date.')); }
    finally { setDetailLoading(false); }
  };

  const removePo = async (po) => {
    if (!opened || !po?.id || removing) return;
    if (!window.confirm(`Remove PO ${po.poNumber || po.id} from ${humanDate(opened)}? The PO and its cartons will not be deleted.`)) return;
    setRemoving(po.id);
    setDetailError('');
    try {
      const next = await removePoFromShippingDay(orderId, opened, po.id, factoryCode, buyerCode);
      if (!next?.pos?.length) { setOpened(null); setDetail(null); }
      else setDetail(next);
      await loadDays();
      if (onChanged) await onChanged();
    } catch (e) { setDetailError(message(e, 'Unable to remove PO from this date.')); }
    finally { setRemoving(''); }
  };

  const exportExcel = async () => {
    if (!opened || exporting) return;
    setExporting(true);
    setDetailError('');
    try {
      const response = await exportPoShippingDayExcel(orderId, opened, factoryCode, buyerCode);
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Shipping_${opened}_${factoryCode}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (e) { setDetailError(message(e, 'Unable to export the Shipping Date Excel.')); }
    finally { setExporting(false); }
  };

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 1 }}>
        <Typography fontWeight={800} variant="subtitle2">Shipping Dates</Typography>
        <Tooltip title="Refresh Shipping Dates"><span><IconButton size="small" disabled={loading} onClick={loadDays}>
          {loading ? <CircularProgress size={17} /> : <Refresh fontSize="small" />}
        </IconButton></span></Tooltip>
      </Stack>
      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {!loading && !days.length ? <Typography variant="caption" color="text.secondary">No Shipping Dates yet. Choose Schedule Shipping to create one.</Typography> : null}
        {days.map((day) => (
          <Button key={`${day.factoryCode}-${day.shippingDate}`} variant="outlined" size="small"
            startIcon={<CalendarMonthOutlined fontSize="small" />}
            endIcon={<ChevronRight fontSize="small" />}
            onClick={() => openDay(day.shippingDate)}
            sx={{ textTransform: 'none', fontWeight: 750, bgcolor: 'background.paper' }}>
            {humanDate(day.shippingDate)} <Chip label={`${day.poCount} PO${day.poCount === 1 ? '' : 's'}`} size="small" sx={{ ml: 1, height: 20 }} />
          </Button>
        ))}
      </Stack>

      <Dialog open={Boolean(opened)} onClose={() => { if (!removing && !exporting) setOpened(null); }} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 850 }}>Shipping – {humanDate(opened)} · {factoryCode}</DialogTitle>
        <DialogContent dividers sx={{ minHeight: 140 }}>
          {detailError ? <Alert severity="error" sx={{ mb: 1 }}>{detailError}</Alert> : null}
          {detailLoading ? <Box textAlign="center" py={3}><CircularProgress size={24}/></Box> : (
            <TableContainer sx={{ maxHeight: '55dvh' }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow>
                  {['STT', 'PO', 'Master PO', 'Style', 'SKU', 'QTY', ...(writable ? ['Action'] : [])].map((label) =>
                    <TableCell key={label} sx={{ fontWeight: 800 }}>{label}</TableCell>)}
                </TableRow></TableHead>
                <TableBody>
                  {(detail?.pos || []).map((po, index) => <TableRow key={po.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{po.poNumber || '—'}</TableCell>
                    <TableCell>{po.masterPo || '—'}</TableCell>
                    <TableCell>{po.style || '—'}</TableCell>
                    <TableCell>{po.sku || '—'}</TableCell>
                    <TableCell>{po.quantity ?? '—'}</TableCell>
                    {writable ? <TableCell><Tooltip title="Remove from this Shipping Date (PO is kept)"><span>
                      <IconButton size="small" color="error" disabled={Boolean(removing)} onClick={() => removePo(po)}>
                        {removing === po.id ? <CircularProgress size={16} /> : <DeleteOutline fontSize="small" />}
                      </IconButton>
                    </span></Tooltip></TableCell> : null}
                  </TableRow>)}
                  {!detailLoading && !detail?.pos?.length ? <TableRow><TableCell colSpan={writable ? 7 : 6} align="center">No POs in this Shipping Date.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.25 }}>
          {writable ? <Button startIcon={<Add />} disabled={!detail || Boolean(removing)} onClick={() => {
            const selected = opened;
            const ids = (detail?.pos || []).map(po => po.id);
            setOpened(null);
            onAddToDate(selected, ids);
          }}>Add PO</Button> : null}
          <Button startIcon={exporting ? <CircularProgress size={16} /> : <FileDownloadOutlined />}
            disabled={exporting || !detail?.pos?.length} onClick={exportExcel}>Export Excel</Button>
          <Button onClick={() => setOpened(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
