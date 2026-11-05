import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { ORGANIZATION_REALTIME as RT, ROUTE_PATH } from '../constants/appConstants';
import { clearAuthSession, getStoredToken } from '../routes/globalApi';
import { subscribeOrganizationChanges } from '../common/realtime/organizationSocket';

/** This dialog intentionally cannot be dismissed without acknowledging the session revoke. */
export default function AccountChangeDialog() {
  const [notice, setNotice] = useState(null);
  const show = useCallback((payload) => {
    if (!payload || (payload.module && payload.module !== RT.ACCOUNT) || payload.changed === false) return;
    const details = Array.isArray(payload.details) && payload.details.length
      ? payload.details.map((item) => String(item))
      : ['Thông tin tài khoản hoặc quyền truy cập của bạn đã được thay đổi'];
    window.__ACCOUNT_CHANGE_DIALOG_OPEN__ = true;
    setNotice({ enabled: payload.enabled !== false, details });
  }, []);
  const check = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/account-change`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 8000
      });
      if (response.data?.changed) show(response.data);
    } catch { /* Other session expiry/errors keep existing login behavior. */ }
  }, [show]);
  useEffect(() => {
    const onAccountChange = (event) => show(event.detail);
    const unsubscribe = subscribeOrganizationChanges(RT.ACCOUNT, (event) => {
      if (event.module === RT.ACCOUNT) show(event);
      else if (event.module === RT.SYNC) check();
    });
    window.addEventListener('bsl:account-change', onAccountChange);
    window.addEventListener('focus', check);
    check();
    return () => {
      unsubscribe();
      window.removeEventListener('bsl:account-change', onAccountChange);
      window.removeEventListener('focus', check);
      window.__ACCOUNT_CHANGE_DIALOG_OPEN__ = false;
    };
  }, [show, check]);
  const confirm = () => {
    window.__ACCOUNT_CHANGE_DIALOG_OPEN__ = false;
    clearAuthSession();
    window.location.replace(ROUTE_PATH.LOGIN);
  };
  return (
    <Dialog open={Boolean(notice)} disableEscapeKeyDown maxWidth="sm" fullWidth
      onClose={() => {}} aria-labelledby="account-change-title">
      <DialogTitle id="account-change-title">Thông báo thay đổi quyền tài khoản</DialogTitle>
      <DialogContent>
        <Stack spacing={1.3} sx={{ pt: 1 }}>
          <Alert severity={notice?.enabled ? 'info' : 'warning'}>
            {notice?.enabled ? 'Admin vừa cập nhật tài khoản của bạn.' : 'Tài khoản của bạn đã bị vô hiệu hóa.'}
          </Alert>
          {(notice?.details || []).map((message, index) =>
            <Typography key={`${index}-${message}`} variant="body2" sx={{ overflowWrap: 'anywhere' }}>• {message}</Typography>)}
          <Box><Typography fontWeight={700} variant="body2">
            Nhấn OK để đăng xuất và đăng nhập lại để áp dụng thay đổi.
          </Typography></Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}><Button variant="contained" onClick={confirm} autoFocus>OK — Đăng nhập lại</Button></DialogActions>
    </Dialog>
  );
}
