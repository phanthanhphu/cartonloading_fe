import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';

export default function PackingListImportDialog({ open, importing, result, onClose, onImport }) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('CREATE_ONLY');

  useEffect(() => {
    if (open) {
      setFile(null);
      setMode('CREATE_ONLY');
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={importing ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>Import Packing List</DialogTitle>
      <DialogContent>
        <Stack spacing={1.7} sx={{ pt: 0.7 }}>
          <Alert severity="info">
            The system reads the <strong>SEA</strong> sheet from the ENGELBERT STRAUSS PKL template, including carton range, PO, style, article, color, size quantities, CBM and weights.
          </Alert>
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
            {file?.name || 'Select a Packing List file (.xls or .xlsx)'}
            <input hidden type="file" accept=".xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </Button>
          <FormControl>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Import mode</Typography>
            <RadioGroup value={mode} onChange={(event) => setMode(event.target.value)}>
              <FormControlLabel value="CREATE_ONLY" control={<Radio />} label="Append rows to the existing Packing List" />
              <FormControlLabel value="UPSERT" control={<Radio />} label="Update matching carton/product rows and add new rows" />
              <FormControlLabel value="REPLACE_ALL" control={<Radio />} label="Delete the current Packing List and import the file again" />
            </RadioGroup>
          </FormControl>
          {result && (
            <Alert severity={result.applied ? 'success' : 'error'}>
              {result.applied
                ? `Import completed: ${result.created || 0} created and ${result.updated || 0} updated.`
                : `Import failed. ${result.errors?.[0]?.message || 'Please check the file.'}`}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={importing} sx={{ textTransform: 'none' }}>Close</Button>
        <Button onClick={() => onImport(file, mode)} disabled={importing || !file} variant="contained" sx={{ textTransform: 'none' }}>
          {importing ? 'Importing...' : 'Import Data'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
