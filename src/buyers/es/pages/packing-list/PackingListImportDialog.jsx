import { useConfirmAction } from '../../../../components/confirmation/ActionConfirmationProvider';
import { useT } from '../../../../i18n/LanguageProvider';
import TransientAlert from '../../../../components/TransientAlert';
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
import { APP_MESSAGES } from '../../../../constants/appMessages';
import { IMPORT_MODE } from '../../../../constants/appConstants';

export default function PackingListImportDialog({ open, importing, result, onClose, onImport }) {
  const confirmAction = useConfirmAction();
  const trUi = useT();
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState(IMPORT_MODE.CREATE_ONLY);
  const applyImport = async () => {
    if (!file || importing) return;
    const allowed = await confirmAction({
      kind: mode === IMPORT_MODE.REPLACE_ALL ? 'replace' : 'create',
      entity: 'Import', name: file.name,
      warning: ''
    });
    if (allowed) await onImport(file, mode);
  };

  useEffect(() => {
    if (open) {
      setFile(null);
      setMode(IMPORT_MODE.CREATE_ONLY);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={importing ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>{trUi("Import Packing List")}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.7} sx={{ pt: 0.7 }}>
          <Alert severity="info">{trUi("\n            The system reads the ")}<strong>{trUi("SEA")}</strong>{trUi(" sheet from the ENGELBERT STRAUSS PKL template, including carton range, PO, style, article, color, size quantities, CBM and weights.\n          ")}</Alert>
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
            {file?.name || trUi("Select a Packing List file (.xls or .xlsx)")}
            <input hidden type="file" accept=".xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </Button>
          <FormControl>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{trUi("Import mode")}</Typography>
            <RadioGroup value={mode} onChange={(event) => setMode(event.target.value)}>
              <FormControlLabel value={IMPORT_MODE.CREATE_ONLY} control={<Radio />} label={trUi("Append rows to the existing Packing List")} />
              <FormControlLabel value={IMPORT_MODE.UPSERT} control={<Radio />} label={trUi("Update matching carton/product rows and add new rows")} />
              <FormControlLabel value={IMPORT_MODE.REPLACE_ALL} control={<Radio />} label={trUi("Delete the current Packing List and import the file again")} />
            </RadioGroup>
          </FormControl>
          {result && (
            <TransientAlert messageKey={JSON.stringify(result)} severity={result.applied ? 'success' : 'error'}>
              {result.applied
                ? trUi("Import completed: {0} created and {1} updated.", result.created || 0, result.updated || 0)
                : trUi("Import failed. {0}", result.errors?.[0]?.message || APP_MESSAGES.PLEASE_CHECK_FILE)}
            </TransientAlert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={importing} sx={{ textTransform: 'none' }}>{trUi("Close")}</Button>
        <Button onClick={applyImport} disabled={importing || !file} variant="contained" sx={{ textTransform: 'none' }}>
          {importing ? 'Importing...' : trUi("Import Data")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
