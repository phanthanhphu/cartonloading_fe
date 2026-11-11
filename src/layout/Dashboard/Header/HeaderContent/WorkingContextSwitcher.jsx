import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Popover, Stack, TextField, Typography } from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { applyWorkingContext, listWorkingContexts } from '../../../../services/contextService';
import { BUYER_CODE, STORAGE_KEY, buyerOrderStorageKey } from '../../../../constants/appConstants';
import { getBuyerByCode, getBuyerBySlug, readSelectedBuyer, saveSelectedBuyer, setBuyerCatalog, buyerPath } from '../../../../utils/buyerAccess';
import { readJwtSession } from '../../../../utils/systemTypes';
import { readSelectedFactory, saveSelectedFactory, useSelectedFactory } from '../../../../utils/factorySelection';
import { getBuyerAccessLandingPath } from '../../../../buyers/core/buyerModules';

const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;
const selectedForBuyer = (options, buyerCode) => options.find((item) => item.buyerKey === buyerCode);

/** Small, permission-backed switcher; user profile popover stays separate. */
export default function WorkingContextSwitcher({ pathname }) {
  const triggerRef = useRef(null);
  const session = readJwtSession();
  const currentBuyer = getBuyerByCode(session.buyer) || readSelectedBuyer();
  const currentFactory = useSelectedFactory(session.buyer);
  const [anchor, setAnchor] = useState(null);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [buyerCode, setBuyerCode] = useState(session.buyer);
  const [systemType, setSystemType] = useState(session.type);
  const [factoryCode, setFactoryCode] = useState('');
  const [postSwitchTarget, setPostSwitchTarget] = useState('');
  const open = Boolean(anchor);

  // A factory may be initialized by its server-authorized master after the
  // first render; only set the draft automatically while the menu is closed.
  useEffect(() => {
    if (!open) setFactoryCode(currentFactory.factoryCode || '');
  }, [currentFactory.factoryCode, open]);

  const close = () => {
    if (saving || confirmOpen) return;
    setAnchor(null);
    setPostSwitchTarget('');
    setEditing(false);
    setError('');
  };

  const show = async (event, requestedBuyer = '', target = '') => {
    setAnchor(event.currentTarget);
    setPostSwitchTarget(target);
    setEditing(false);
    setError('');
    setOptions([]); // Fail closed: never use stale or client-only permission data.
    setLoading(true);
    try {
      const result = await listWorkingContexts();
      const authorized = Array.isArray(result?.options) ? result.options : [];
      setOptions(authorized);
      const requested = requestedBuyer ? selectedForBuyer(authorized, requestedBuyer) : null;
      const preferred = requested || selectedForBuyer(authorized, session.buyer) || authorized[0];
      if (requestedBuyer && !requested) setError('This Buyer / Type is not active or approved for your account.');
      if (requested) setEditing(true);
      setBuyerCode(preferred?.buyerKey || '');
      setSystemType(preferred?.supportedTypes?.includes(session.type) ? session.type : preferred?.supportedTypes?.[0] || '');
      setFactoryCode(preferred?.buyerKey === BUYER_CODE.LULULEMON
        ? (preferred.factories?.includes(currentFactory.factoryCode) ? currentFactory.factoryCode : preferred.factories?.[0] || '')
        : '');
      if (!authorized.length) setError('No approved Buyer / Type is available for this account.');
    } catch (err) {
      setError(errorText(err, 'Could not load approved Buyer / Type.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const listener = (event) => {
      if (!triggerRef.current) return;
      show({ currentTarget: triggerRef.current }, event.detail?.buyerCode || '', event.detail?.target || '');
    };
    window.addEventListener('bsl:working-context:open', listener);
    return () => window.removeEventListener('bsl:working-context:open', listener);
    // The listener is rebound to the latest JWT workspace after a normal render.
  });

  const chooseBuyer = (code) => {
    const entry = selectedForBuyer(options, code);
    if (!entry) return;
    setBuyerCode(code);
    setSystemType(entry.supportedTypes?.[0] || '');
    setFactoryCode(code === BUYER_CODE.LULULEMON
      ? (entry.factories?.includes(currentFactory.factoryCode) ? currentFactory.factoryCode : entry.factories?.[0] || '')
      : '');
    setError('');
  };

  const chosen = selectedForBuyer(options, buyerCode);
  const requiresFactory = buyerCode === BUYER_CODE.LULULEMON && (chosen?.factories?.length || 0) > 0;
  const invalid = !chosen || !chosen.supportedTypes?.includes(systemType)
    || (requiresFactory && !chosen.factories.includes(factoryCode));
  // Shared by both Apply buttons. Previously changingWorkspace was local to
  // requestApply(), so the confirmed apply() threw *after* saving the new JWT.
  const changingWorkspace = buyerCode !== session.buyer || systemType !== session.type;
  const changingFactory = buyerCode === BUYER_CODE.LULULEMON && factoryCode !== currentFactory.factoryCode;
  const hasContextChanges = changingWorkspace || changingFactory;

  const requestApply = () => {
    if (saving || invalid || loading) return;
    if (!hasContextChanges) {
      // The Buyer Management folder icon also opens this switcher. Clicking the
      // current Buyer should still open Orders, without a redundant token swap.
      const destination = postSwitchTarget === 'orders' ? buyerPath({
        code: chosen.buyerKey, slug: chosen.slug, buyerName: chosen.buyerName
      }, 'orders') : '';
      close();
      if (destination && pathname !== destination) window.location.assign(destination);
      return;
    }
    setError('');
    setConfirmOpen(true);
  };

  const cancelConfirmation = () => {
    if (saving) return;
    setConfirmOpen(false);
    setError('');
  };

  const apply = async () => {
    // Only a deliberate click on the system confirmation dialog can switch.
    if (!confirmOpen || saving || invalid || loading) return;
    // The selection could have become equal to the current session after the
    // dialog opened. Never call the switch API for an unchanged context.
    if (!hasContextChanges) {
      setConfirmOpen(false);
      setAnchor(null);
      setEditing(false);
      setPostSwitchTarget('');
      setError('');
      return;
    }
    setSaving(true);
    setError('');
    let restoreSession = null;
    try {
      const result = await applyWorkingContext({
        buyerCode,
        systemType,
        factoryCode: buyerCode === BUYER_CODE.LULULEMON ? factoryCode : ''
      });
      if (!result?.token || result.selectedBuyer !== buyerCode || result.selectedType !== systemType
        || (result.selectedFactory || '') !== (buyerCode === BUYER_CODE.LULULEMON ? factoryCode : '')) {
        throw new Error('Server returned a mismatched working context. No changes were applied.');
      }

      // Check that the new token actually contains the context authenticated
      // by the server, *before* touching any browser session data.
      let payload;
      try {
        payload = JSON.parse(window.atob(result.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      } catch {
        throw new Error('Server returned an invalid session token. Please try again.');
      }
      if (payload.selectedBuyer !== buyerCode || payload.selectedType !== systemType) {
        throw new Error('Server token does not match the selected Buyer / Type.');
      }

      // Decide the destination before saving the token, so route/cached Buyer
      // lookups cannot leave a new JWT behind if they fail.
      const nextBuyer = { code: chosen.buyerKey, slug: chosen.slug, buyerName: chosen.buyerName };
      let destination;
      if (changingWorkspace) {
        destination = postSwitchTarget === 'orders'
          ? buyerPath(nextBuyer, 'orders') : getBuyerAccessLandingPath(nextBuyer);
      } else {
        const orderDetail = pathname.match(/^\/buyers\/([^/]+)\/orders\/[^/]+(?:\/|$)/i);
        const onCurrentOrder = orderDetail && getBuyerBySlug(orderDetail[1])?.code === buyerCode;
        destination = onCurrentOrder ? buyerPath(nextBuyer, 'orders') : pathname;
      }
      if (!destination || destination === '/login') {
        throw new Error('Unable to resolve the destination for this Buyer.');
      }

      // Snapshot only the keys touched by this operation. A failed local save
      // or redirect must not strand the browser with a half-switched session.
      const keys = [STORAGE_KEY.TOKEN, STORAGE_KEY.ACCESS_TOKEN, STORAGE_KEY.SELECTED_TYPE,
        STORAGE_KEY.BUYER_CATALOG, STORAGE_KEY.SELECTED_BUYER, STORAGE_KEY.SELECTED_BUYER_LABEL,
        buyerOrderStorageKey(session.buyer)];
      const previous = keys.map((key) => [key, localStorage.getItem(key)]);
      const previousFactory = readSelectedFactory();
      restoreSession = () => {
        previous.forEach(([key, value]) => {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        });
        saveSelectedFactory(previousFactory);
      };

      localStorage.setItem(STORAGE_KEY.TOKEN, result.token);
      localStorage.setItem(STORAGE_KEY.ACCESS_TOKEN, result.token);
      localStorage.setItem(STORAGE_KEY.SELECTED_TYPE, systemType);
      setBuyerCatalog(options.map((item) => ({
        code: item.buyerKey, buyerName: item.buyerName, slug: item.slug,
        active: true, supportedTypes: item.supportedTypes
      })));
      if (!saveSelectedBuyer(buyerCode)) {
        throw new Error('Buyer context could not be saved. Please sign in again.');
      }
      saveSelectedFactory(buyerCode === BUYER_CODE.LULULEMON ? factoryCode : '');
      localStorage.removeItem(buyerOrderStorageKey(session.buyer));
      window.location.replace(destination);
    } catch (err) {
      if (restoreSession) {
        try { restoreSession(); } catch { /* keep the original error visible */ }
      }
      setError(errorText(err, 'Could not switch working context.'));
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        color="inherit" variant="outlined" size="small" onClick={(event) => show(event)}
        aria-label="Open Working Context" aria-haspopup="dialog" aria-expanded={open}
        endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />}
        startIcon={<BusinessOutlinedIcon sx={{ fontSize: 17 }} />}
        sx={{ borderColor: '#D8E2EC', color: '#183658', bgcolor: '#fff', minWidth: 0,
          maxWidth: { xs: 138, sm: 250 }, height: 38, borderRadius: '5px', textTransform: 'none', px: 1.2 }}
      >
        <Stack spacing={0} sx={{ minWidth: 0, textAlign: 'left' }}>
          <Typography noWrap sx={{ fontSize: '0.72rem', lineHeight: 1.25, fontWeight: 800 }}>
            {currentBuyer?.label || session.buyer || 'Buyer'}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.64rem', lineHeight: 1.25, color: '#647993' }}>
            {session.type || 'Type'}{session.buyer === BUYER_CODE.LULULEMON && currentFactory.factoryCode ? ` · ${currentFactory.factoryCode}` : ''}
          </Typography>
        </Stack>
      </Button>
      <Popover open={open} anchorEl={anchor} onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 330, maxWidth: 'calc(100vw - 24px)', mt: 0.7, borderRadius: '8px', p: 2, boxShadow: '0 9px 30px rgba(20,44,72,.16)' } }}>
        <Stack gap={1.6}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={800} sx={{ fontSize: '0.89rem' }}>Working Context</Typography>
            {!editing && !loading && options.length > 0 && <Button size="small" startIcon={<EditOutlinedIcon fontSize="small" />}
              onClick={() => setEditing(true)} sx={{ textTransform: 'none' }}>Edit</Button>}
          </Stack>
          <Divider />
          {loading ? <Stack direction="row" alignItems="center" gap={1}><CircularProgress size={17} /><Typography variant="body2">Loading approved choices…</Typography></Stack> : null}
          {!loading && !editing && <Stack gap={1}>
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Buyer</Typography><Typography fontWeight={700} variant="body2">{currentBuyer?.label || session.buyer}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Type</Typography><Typography fontWeight={700} variant="body2">{session.type}</Typography></Stack>
            {session.buyer === BUYER_CODE.LULULEMON && <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Factory</Typography><Typography fontWeight={700} variant="body2">{currentFactory.factoryCode || 'Not assigned'}</Typography></Stack>}
          </Stack>}
          {!loading && editing && <Stack gap={1.4}>
            <TextField select label="Buyer" size="small" fullWidth value={buyerCode} disabled={saving} onChange={(e) => chooseBuyer(e.target.value)}>
              {options.map((item) => <MenuItem key={item.buyerKey} value={item.buyerKey}>{item.buyerName || item.buyerKey}</MenuItem>)}
            </TextField>
            <TextField select label="Type" size="small" fullWidth value={systemType} disabled={saving || !chosen} onChange={(e) => setSystemType(e.target.value)}>
              {(chosen?.supportedTypes || []).map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
            </TextField>
            {buyerCode === BUYER_CODE.LULULEMON && <TextField select label="Factory" size="small" fullWidth value={factoryCode}
              disabled={saving || !(chosen?.factories?.length)} onChange={(e) => setFactoryCode(e.target.value)}
              helperText={!chosen?.factories?.length ? 'No active Factory is assigned.' : undefined}>
              {(chosen?.factories || []).map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
            </TextField>}
            {buyerCode !== BUYER_CODE.LULULEMON && <Typography variant="caption" color="text.secondary">This Buyer does not use the shared Factory selector.</Typography>}
            <Stack direction="row" justifyContent="flex-end" gap={1}>
              <Button disabled={saving} variant="outlined" onClick={() => { setEditing(false); setError(''); }}>Cancel</Button>
              <Button variant="contained" disabled={saving || invalid} onClick={requestApply}>
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
              </Button>
            </Stack>
          </Stack>}
          {error && !confirmOpen && <Alert severity="error" sx={{ py: 0.2, '& .MuiAlert-message': { fontSize: '0.76rem' } }}>{error}</Alert>}
        </Stack>
      </Popover>
      <Dialog
        open={confirmOpen}
        onClose={cancelConfirmation}
        fullWidth
        maxWidth="xs"
        aria-labelledby="working-context-confirm-title"
        aria-describedby="working-context-confirm-description"
        PaperProps={{ sx: { borderRadius: 2, maxWidth: 460 } }}
      >
        <DialogTitle id="working-context-confirm-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.2, fontWeight: 800, color: '#183658', pb: 1 }}>
          <WarningAmberRoundedIcon color="warning" />
          Confirm Context Switch
        </DialogTitle>
        <DialogContent sx={{ pt: '12px !important', pb: 1 }}>
          <Typography id="working-context-confirm-description" variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to switch your working context?
          </Typography>
          <Box sx={{ bgcolor: '#F4F7FB', border: '1px solid #E1E8F0', borderRadius: 1.5, p: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>CURRENT CONTEXT</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.3 }}>
              {currentBuyer?.label || session.buyer || 'Buyer'} · {session.type || 'Type'}
              {session.buyer === BUYER_CODE.LULULEMON && currentFactory.factoryCode ? ` · ${currentFactory.factoryCode}` : ''}
            </Typography>
            <Typography sx={{ textAlign: 'center', color: '#718298', fontSize: 22, my: 0.4, lineHeight: 1 }}>↓</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>SWITCH TO</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.3 }}>
              {chosen?.buyerName || buyerCode || 'Buyer'} · {systemType || 'Type'}
              {buyerCode === BUYER_CODE.LULULEMON && factoryCode ? ` · ${factoryCode}` : ''}
            </Typography>
          </Box>
          <Alert severity="warning" variant="standard" sx={{ mt: 2, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
            Unsaved changes on this page may be lost.
          </Alert>
          {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}>
          <Button onClick={cancelConfirmation} disabled={saving} variant="outlined" sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={saving || invalid} variant="contained" sx={{ textTransform: 'none' }}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Confirm Switch'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
