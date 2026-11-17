import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from '@mui/material';
import { useT } from '../../i18n/LanguageProvider';

const ConfirmationContext = createContext(null);
const descriptions = {
  create: ['Confirm create', 'Are you sure you want to create this record?'],
  update: ['Confirm update', 'Are you sure you want to save these changes?'],
  delete: ['Confirm delete', 'This record will be deleted. Do you want to continue?'],
  replace: ['Confirm replace all', 'Existing data will be replaced. This action may delete existing records. Continue?'],
  assign: ['Confirm assignment', 'Are you sure you want to save this assignment?'],
  unassign: ['Confirm unassignment', 'Are you sure you want to remove this assignment?'],
  submit: ['Confirm submission', 'Are you sure you want to submit this change?']
};

/** A promise resolves only after the user explicitly confirms. Cancelling never triggers an API call. */
export function ActionConfirmationProvider({ children }) {
  const t = useT();
  const [request, setRequest] = useState(null);
  const pendingRef = useRef(null);
  const finish = useCallback((result) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setRequest(null);
    pending.resolve(result);
  }, []);
  const confirmAction = useCallback(({ kind = 'update', entity = '', name = '', warning = '' } = {}) => {
    // Ignore duplicate clicks while a confirmation is already visible.
    if (pendingRef.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pendingRef.current = { resolve };
      setRequest({ kind: descriptions[kind] ? kind : 'update', entity, name, warning });
    });
  }, []);
  useEffect(() => () => {
    // A page being unmounted must not leave an unresolved action.
    if (pendingRef.current) { pendingRef.current.resolve(false); pendingRef.current = null; }
  }, []);
  const config = descriptions[request?.kind] || descriptions.update;
  const destructive = request?.kind === 'delete' || request?.kind === 'replace' || request?.kind === 'unassign';
  return <ConfirmationContext.Provider value={confirmAction}>
    {children}
    <Dialog open={Boolean(request)} onClose={() => finish(false)} aria-labelledby="confirm-action-title" maxWidth="xs" fullWidth>
      <DialogTitle id="confirm-action-title" sx={{ fontWeight: 750 }}>{t(config[0])}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.2}>
          <DialogContentText>{t(config[1])}</DialogContentText>
          {request?.entity && <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{t(request.entity)}{request?.name ? ': ' : ''}{request?.name || ''}</Typography>}
          {request?.warning && <Alert severity={destructive ? 'warning' : 'info'}>{t(request.warning)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => finish(false)} color="inherit">{t('Cancel')}</Button>
        <Button onClick={() => finish(true)} color={destructive ? 'error' : 'primary'} variant="contained">{t('Confirm')}</Button>
      </DialogActions>
    </Dialog>
  </ConfirmationContext.Provider>;
}

export function useConfirmAction() {
  const confirm = useContext(ConfirmationContext);
  if (!confirm) throw new Error('Action confirmation provider is missing');
  return confirm;
}
