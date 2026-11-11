import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Stack, Typography
} from '@mui/material';
import { UploadFileOutlined } from '@mui/icons-material';
import { BUYER_CODE, EXCEL_FILE_ACCEPT, PO_IMPORT_ERROR_CODE, LULULEMON_EXCEL_MODE } from '../../../constants/appConstants';
import { previewLululemonExcel, applyLululemonExcel } from '../services/service';
import PoDuplicateConflictDialog from './PoDuplicateConflictDialog';

/**
 * Shared Lululemon CREATE-only upload control for PO Master Data and Order Workspace.
 * Template download / edited Excel export / edited Excel upload are intentionally
 * hidden from the UI; no backend endpoints or existing stored data are changed.
 */
export default function LululemonExcelActions({ orderId, buyer = BUYER_CODE.LULULEMON, disabled = false, onApplied, onMessage }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const [duplicates, setDuplicates] = useState([]);

  const handleError = (err) => {
    const response = err?.response?.data;
    const conflicts = response?.code === PO_IMPORT_ERROR_CODE.ALL_BP_DUPLICATE_PO
      ? response.duplicates : null;
    if (Array.isArray(conflicts) && conflicts.length) {
      setDuplicates(conflicts);
      setError('');
      onMessage?.(null);
      return;
    }
    const message = response?.message || err?.message || 'Unable to process Excel';
    setDuplicates([]);
    if (typeof onMessage === 'function') {
      setError('');
      onMessage({ severity: 'error', text: message });
    } else {
      setError(message);
    }
  };

  const chooseFile = async (event) => {
    const next = event.target.files?.[0];
    event.target.value = '';
    if (!next) return;
    setFile(next);
    setPreview(null);
    setBusy(true);
    setError('');
    setDuplicates([]);
    onMessage?.(null);
    try {
      setPreview(await previewLululemonExcel(orderId, next, buyer, LULULEMON_EXCEL_MODE.NEW));
    } catch (err) {
      setFile(null);
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await applyLululemonExcel(orderId, file, buyer, LULULEMON_EXCEL_MODE.NEW);
      const message = `Successfully imported ${result.createdPos || 0} new PO(s).`;
      setFile(null);
      setPreview(null);
      onMessage?.({ severity: 'success', text: message });
      try {
        await onApplied?.(result);
      } catch (_) {
        // Import already succeeded; a refresh error must not prompt duplicate retries.
        onMessage?.({ severity: 'warning', text: `${message} Refresh the Order page to see the latest data.` });
      }
    } catch (err) {
      setFile(null);
      setPreview(null);
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  return <>
    <Button
      size="small"
      variant="contained"
      startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <UploadFileOutlined />}
      disabled={busy || disabled || !orderId}
      onClick={() => input.current?.click()}
      sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
    >
      Upload New Excel
    </Button>
    <input ref={input} type="file" hidden accept={EXCEL_FILE_ACCEPT} onChange={chooseFile} />
    <PoDuplicateConflictDialog open={duplicates.length > 0} duplicates={duplicates} onClose={() => setDuplicates([])} />
    <Dialog open={Boolean(preview)} onClose={() => !busy && setPreview(null)} fullWidth maxWidth="sm">
      <DialogTitle fontWeight={800}>Import New POs — Preview</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{file?.name}</Typography>
        <Stack direction="row" gap={2} flexWrap="wrap">
          <Typography color="success.main" fontWeight={800}>New PO rows: {preview?.creates ?? 0}</Typography>
        </Stack>
        {preview?.warnings?.map((warning, index) => (
          <Typography key={index} variant="caption" sx={{ display: 'block', mt: 1 }}>{warning}</Typography>
        ))}
        <Alert severity="info" sx={{ mt: 2 }}>
          Upload your original Lululemon Excel with the 29 business columns — no ID or ACTION column is needed.
          Every row creates a new PO. Existing PO identities across factories are blocked.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setFile(null); setPreview(null); }} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={apply} disabled={busy || !(preview?.creates > 0)}>
          {busy ? 'Applying...' : 'Confirm Import'}
        </Button>
      </DialogActions>
    </Dialog>
    {error && <Box sx={{ width: '100%', mt: 0.5 }}>
      <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
    </Box>}
  </>;
}
