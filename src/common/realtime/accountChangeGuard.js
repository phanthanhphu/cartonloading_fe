/** Pure guard for targeted server account-revocation notices.
 * JWT signature/authorization is checked by the backend; this guards against
 * old in-flight events from a prior session in the same browser.
 */
export const readTokenVersion = (token) => {
  try {
    if (!token) return -1;
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const value = Number(JSON.parse(atob(base64)).tokenVersion);
    return Number.isFinite(value) ? value : -1;
  } catch { return -1; }
};

export const shouldRevokeAccount = ({ notice, token, userId, checkedToken }) => {
  if (!notice || (notice.module && notice.module !== 'ACCOUNT') || notice.changed === false || !token) return false;
  if (checkedToken && checkedToken !== token) return false;
  if (notice.userId && String(notice.userId) !== String(userId || '')) return false;
  // Ignore old notices after a new login, including delayed socket deliveries.
  const incoming = Number(notice.version);
  if (notice.version !== undefined && notice.version !== null
      && Number.isFinite(incoming) && incoming <= readTokenVersion(token)) return false;
  return true;
};
