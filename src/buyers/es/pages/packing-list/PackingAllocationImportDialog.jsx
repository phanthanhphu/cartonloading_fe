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

export default function PackingAllocationImportDialog({ open, importing, result, onClose, onImport }) {
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
      <DialogTitle sx={{ fontWeight: 900 }}>Upload Order Items</DialogTitle>
      <DialogContent>
        <Stack spacing={1.7} sx={{ pt: 0.7 }}>
          <Alert severity="info">
            Use the file downloaded from <strong>Download Edit File</strong> whenever possible. The ACTION column supports <strong>CREATE</strong>, <strong>UPDATE</strong>, and <strong>DELETE</strong>. UPDATE and DELETE use KEY to identify the exact row. The entire file is validated before any changes are applied.
          </Alert>
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
            {file?.name || 'Select an Excel file (.xlsx or .xls)'}
            <input hidden type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </Button>
          <FormControl>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Mode for legacy WSP files without ACTION/KEY</Typography>
            <RadioGroup value={mode} onChange={(event) => setMode(event.target.value)}>
              <FormControlLabel value="CREATE_ONLY" control={<Radio />} label="CREATE_ONLY — add every row as new data" />
              <FormControlLabel value="UPSERT" control={<Radio />} label="UPSERT — update matching business data and add new rows" />
              <FormControlLabel value="REPLACE_ALL" control={<Radio />} label="REPLACE_ALL — delete current data and import the file again" />
            </RadioGroup>
          </FormControl>
          {result && (
            <Alert severity={result.applied ? 'success' : 'error'}>
              {result.applied
                ? `Completed: ${result.created || 0} created, ${result.updated || 0} updated, ${result.deleted || 0} deleted.`
                : `Import failed. ${result.errors?.[0]?.message || 'Please check the file.'}`}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={importing} sx={{ textTransform: 'none' }}>Close</Button>
        <Button onClick={() => onImport(file, mode)} disabled={importing || !file} variant="contained" sx={{ textTransform: 'none' }}>
          {importing ? 'Importing...' : 'Upload & Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
