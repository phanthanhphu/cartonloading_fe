import { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { ORGANIZATION_REALTIME as RT, ROUTE_PATH, STORAGE_KEY } from '../constants/appConstants';
import { clearAuthSession, getStoredToken } from '../routes/globalApi';
import { subscribeOrganizationChanges } from '../common/realtime/organizationSocket';
import { shouldRevokeAccount } from '../common/realtime/accountChangeGuard';

const currentUserId = () => {
  const storedId = localStorage.getItem(STORAGE_KEY.USER_ID);
  if (storedId) return storedId;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY.USER) || '{}')?.id || ''; }
  catch { return ''; }
};

/** Kept under its original filename to preserve routing; it does not render a modal.
 * It subscribes to a private STOMP user queue and automatically ends revoked sessions.
 */
export default function AccountChangeDialog() {
  const redirected = useRef(false);

  const revoke = useCallback((notice, checkedToken = null) => {
    if (redirected.current || !shouldRevokeAccount({
      notice, token: getStoredToken(), userId: currentUserId(), checkedToken
    })) return;

    redirected.current = true;
    clearAuthSession();
    const disabled = notice.enabled === false;
    window.location.replace(`${ROUTE_PATH.LOGIN}?accountChanged=true${disabled ? '&accountDisabled=true' : ''}`);
  }, []);

  const check = useCallback(async () => {
    const token = getStoredToken();
    if (!token || redirected.current) return;
    try {
      // Signed, unexpired stale tokens may access ONLY this read-only notice.
      const response = await axios.get(`${API_BASE_URL}/api/auth/account-change`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 8000
      });
      if (response.data?.changed) revoke(response.data, token);
    } catch { /* Server enforces revocation even when the network is unavailable. */ }
  }, [revoke]);

  useEffect(() => {
    const onAccountChange = (event) => revoke(event.detail);
    const unsubscribe = subscribeOrganizationChanges(RT.ACCOUNT, (event) => {
      if (event.module === RT.ACCOUNT) revoke(event);
      else if (event.module === RT.SYNC) check();
    });
    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
    const onStorage = (event) => {
      // All tabs for this account share the browser's auth storage.
      // Other users on other browsers do not share it and are unaffected.
      if ((event.key === STORAGE_KEY.TOKEN || event.key === STORAGE_KEY.ACCESS_TOKEN)
          && event.oldValue && !event.newValue && !getStoredToken() && !redirected.current) {
        redirected.current = true;
        window.location.replace(`${ROUTE_PATH.LOGIN}?accountChanged=true`);
      }
    };
    window.addEventListener('bsl:account-change', onAccountChange);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    check();
    return () => {
      unsubscribe();
      window.removeEventListener('bsl:account-change', onAccountChange);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [revoke, check]);

  return null;
}
