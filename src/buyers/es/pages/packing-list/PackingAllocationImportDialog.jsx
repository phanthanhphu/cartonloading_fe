import { useConfirmAction } from '../../../../components/confirmation/ActionConfirmationProvider';
import { useT } from '../../../../i18n/LanguageProvider';
import TransientAlert from '../../../../components/TransientAlert';
import { EXCEL_FILE_ACCEPT, IMPORT_MODE } from '../../../../constants/appConstants';
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

export default function PackingAllocationImportDialog({ open, importing, result, onClose, onImport }) {
  const confirmAction = useConfirmAction();
  const trUi = useT();
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState(IMPORT_MODE.CREATE_ONLY);
  const applyImport = async () => {
    if (!file || importing) return;
    const allowed = await confirmAction({
      kind: mode === IMPORT_MODE.REPLACE_ALL ? 'replace' : 'create',
      entity: 'Import', name: file.name,
      warning: mode !== IMPORT_MODE.REPLACE_ALL ? 'An ACTION=DELETE row in the imported file can remove existing records.' : ''
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
      <DialogTitle sx={{ fontWeight: 900 }}>{trUi("Upload Order Items")}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.7} sx={{ pt: 0.7 }}>
          <Alert severity="info">{trUi("\n            Use the file downloaded from ")}<strong>{trUi("Download Edit File")}</strong>{trUi(" whenever possible. The ACTION column supports ")}<strong>{trUi("CREATE")}</strong>, <strong>{trUi("UPDATE")}</strong>{trUi(", and ")}<strong>{trUi("DELETE")}</strong>{trUi(". UPDATE and DELETE use KEY to identify the exact row. The entire file is validated before any changes are applied.\n          ")}</Alert>
          <Button component="label" variant="outlined" startIcon={<UploadFileOutlinedIcon />} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
            {file?.name || trUi("Select an Excel file (.xlsx or .xls)")}
            <input hidden type="file" accept={EXCEL_FILE_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </Button>
          <FormControl>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{trUi("Mode for legacy WSP files without ACTION/KEY")}</Typography>
            <RadioGroup value={mode} onChange={(event) => setMode(event.target.value)}>
              <FormControlLabel value={IMPORT_MODE.CREATE_ONLY} control={<Radio />} label={trUi("CREATE_ONLY — add every row as new data")} />
              <FormControlLabel value={IMPORT_MODE.UPSERT} control={<Radio />} label={trUi("UPSERT — update matching business data and add new rows")} />
              <FormControlLabel value={IMPORT_MODE.REPLACE_ALL} control={<Radio />} label={trUi("REPLACE_ALL — delete current data and import the file again")} />
            </RadioGroup>
          </FormControl>
          {result && (
            <TransientAlert messageKey={JSON.stringify(result)} severity={result.applied ? 'success' : 'error'}>
              {result.applied
                ? trUi("Completed: {0} created, {1} updated, {2} deleted.", result.created || 0, result.updated || 0, result.deleted || 0)
                : trUi("Import failed. {0}", result.errors?.[0]?.message || APP_MESSAGES.PLEASE_CHECK_FILE)}
            </TransientAlert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={importing} sx={{ textTransform: 'none' }}>{trUi("Close")}</Button>
        <Button onClick={applyImport} disabled={importing || !file} variant="contained" sx={{ textTransform: 'none' }}>
          {importing ? 'Importing...' : trUi("Upload & Apply")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
