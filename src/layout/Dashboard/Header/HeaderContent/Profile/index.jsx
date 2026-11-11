import { useEffect, useRef, useState } from 'react';
import { alpha } from '@mui/material/styles';
import {
  Alert, Box, Button, ButtonBase, Chip, CircularProgress, ClickAwayListener, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, InputAdornment, ListItemIcon, ListItemText,
  MenuItem, Paper, Popper, Stack, TextField, Typography, Avatar
} from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { changeMyPassword, getMyAccount, getMyAvatar } from '../../../../../services/accountService';
import { clearAuthSession } from '../../../../../routes/globalApi';
import { ACCESS_PERMISSION_LABEL, ROLE, STORAGE_KEY } from '../../../../../constants/appConstants';
import useAutoDismissFeedback from '../../../../../hooks/useAutoDismissFeedback';

const readUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY.USER) || '{}');
    return { username: user.username || user.email || 'User', email: user.email || '', role: user.role || '' };
  } catch {
    return { username: 'User', email: '', role: '' };
  }
};

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };
const compactSection = { p: 1.5, border: '1px solid #E4EAF1', borderRadius: '4px', minWidth: 0 };

function GrantList({ values, emptyText = 'Not assigned' }) {
  const items = [...new Set((values || []).filter(Boolean))];
  if (!items.length) return <Typography color="text.secondary" variant="body2">{emptyText}</Typography>;
  return (
    <Stack direction="row" gap={0.7} flexWrap="wrap">
      {items.map(value => <Chip size="small" key={value} label={value} variant="outlined" sx={{ maxWidth: '100%' }} />)}
    </Stack>
  );
}

function PermissionSection({ title, children }) {
  return (
    <Box sx={compactSection}>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.9 }}>{title}</Typography>
      {children}
    </Box>
  );
}

export default function Profile() {
  const anchorRef = useRef(null);
  const storedAvatarUrl = useRef(null);
  const avatarVersionRef = useRef(0);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const user = readUser();
  const firstLetter = String(user.username || 'U').charAt(0).toUpperCase();
  useAutoDismissFeedback(error, setError, '', 'error');

  // Photo is read-only here. Admin uploads and removes it in User Management.
  useEffect(() => {
    let active = true;
    const refresh = () => {
      const version = ++avatarVersionRef.current;
      getMyAvatar().then(response => {
        if (!active || version !== avatarVersionRef.current) return;
        const blob = response.status === 200 ? response.data : null;
        const nextUrl = blob?.size ? URL.createObjectURL(blob) : '';
        if (storedAvatarUrl.current) URL.revokeObjectURL(storedAvatarUrl.current);
        storedAvatarUrl.current = nextUrl;
        setAvatarUrl(nextUrl);
      }).catch(() => { /* Keep initials if private photo cannot load. */ });
    };
    refresh();
    window.addEventListener('bsl:avatar-changed', refresh);
    return () => {
      active = false;
      ++avatarVersionRef.current;
      window.removeEventListener('bsl:avatar-changed', refresh);
      if (storedAvatarUrl.current) URL.revokeObjectURL(storedAvatarUrl.current);
      storedAvatarUrl.current = null;
    };
  }, []);

  const logout = () => { clearAuthSession(); window.location.assign('/login'); };
  const closeDialog = () => {
    if (saving) return;
    setDialog(null);
    setError('');
    setPasswords(EMPTY_PASSWORDS);
    setShowPasswords(false);
  };

  useEffect(() => {
    if (dialog !== 'profile') return undefined;
    let active = true;
    setLoading(true);
    setProfile(null);
    getMyAccount()
      .then(value => { if (active) setProfile(value); })
      .catch(err => { if (active) setError(err?.response?.data?.message || err?.message || 'Unable to load account details'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dialog]);

  const openDialog = (kind) => {
    setOpen(false);
    setError('');
    setPasswords(EMPTY_PASSWORDS);
    setDialog(kind);
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!passwords.currentPassword) { setError('Enter your current password.'); return; }
    if (passwords.newPassword.length < 8 || passwords.newPassword.length > 200) {
      setError('New password must be between 8 and 200 characters.'); return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) { setError('New passwords do not match.'); return; }
    if (passwords.newPassword === passwords.currentPassword) { setError('Choose a different new password.'); return; }
    setSaving(true);
    setError('');
    try {
      await changeMyPassword(passwords);
      // The backend increments tokenVersion, invalidating all old sessions.
      clearAuthSession();
      sessionStorage.removeItem(STORAGE_KEY.LOGIN_DRAFT_PASSWORD);
      window.location.assign('/login?passwordChanged=true');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Unable to change password');
      setSaving(false);
    }
  };

  const account = profile?.user;
  const admin = account?.role === ROLE.ADMIN || account?.role === ROLE.ROLE_ADMIN;
  const labels = (account?.accessPermissions || []).map(value => ACCESS_PERMISSION_LABEL[value] || value);
  const avatarDisplay = (src, size = 38) => (
    <Avatar src={src || undefined} alt={user.username} sx={{ width: size, height: size, bgcolor: alpha('#3B82F6', 0.08), color: '#2563EB', fontWeight: 900, fontSize: size > 60 ? 27 : 16 }}>
      {firstLetter}
    </Avatar>
  );

  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <ButtonBase ref={anchorRef} aria-label="open user menu" aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen(value => !value)} sx={{ width: 46, height: 46, p: 0.4, borderRadius: '50%', '&:hover': { bgcolor: alpha('#3B82F6', 0.07) } }}>
        <Box sx={{ borderRadius: '50%', border: `2px solid ${alpha('#3B82F6', 0.78)}`, overflow: 'hidden' }}>
          {avatarDisplay(avatarUrl)}
        </Box>
      </ButtonBase>
      <Popper placement="bottom-end" open={open} anchorEl={anchorRef.current}
        sx={{ zIndex: theme => theme.zIndex.modal + 1 }}
        popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [0, 10] } }] }}>
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Paper sx={{ width: 270, borderRadius: '4px', overflow: 'hidden', border: '1px solid #E8EEF5', boxShadow: '0 18px 60px rgba(24,54,84,.14)' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 2 }}>
              {avatarDisplay(avatarUrl)}
              <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }} noWrap>{user.username}</Typography>
                <Typography sx={{ fontSize: '.72rem', color: 'text.secondary' }} noWrap>{user.email || user.role}</Typography></Box>
            </Stack>
            <Divider />
            <MenuItem onClick={() => openDialog('profile')} sx={{ py: 1.2 }}>
              <ListItemIcon><SecurityOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon><ListItemText primary="My Profile & Permissions" />
            </MenuItem>
            <MenuItem onClick={() => openDialog('password')} sx={{ py: 1.2 }}>
              <ListItemIcon><LockOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon><ListItemText primary="Change Password" />
            </MenuItem>
            <Divider />
            <MenuItem onClick={logout} sx={{ py: 1.2 }}><ListItemIcon><LogoutOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon><ListItemText primary="Logout" /></MenuItem>
          </Paper>
        </ClickAwayListener>
      </Popper>

      <Dialog open={dialog === 'profile'} onClose={closeDialog} fullWidth maxWidth="sm" aria-labelledby="my-account-title">
        <DialogTitle id="my-account-title" sx={{ fontWeight: 850 }}>My Profile & Permissions</DialogTitle>
        <DialogContent dividers sx={{ display: 'grid', gap: 1.5, maxHeight: '65vh' }}>
          {error && <Alert severity="error">{error}</Alert>}
          {loading && <Stack direction="row" gap={1} alignItems="center"><CircularProgress size={18} /><Typography>Loading permissions...</Typography></Stack>}
          {account && <>
            <PermissionSection title="Account">
              <Stack direction="row" gap={1.5} alignItems="center" sx={{ mb: 1.2 }}>
                {avatarDisplay(avatarUrl, 56)}
                <Box>
                  <Typography><b>{account.username || 'User'}</b> · {account.email}</Typography>
                  <Typography variant="caption" color="text.secondary">Photo managed by Admin in User Management</Typography>
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary">Role: {account.role} · {account.enabled ? 'Active' : 'Disabled'}</Typography>
              {account.departmentId && <Typography variant="body2" color="text.secondary">Department: {account.departmentId}</Typography>}
            </PermissionSection>
            <PermissionSection title="Current Login Context">
              <GrantList values={[`Buyer: ${profile.selectedBuyer}`, `Type: ${profile.selectedType}`]} />
            </PermissionSection>
            <PermissionSection title="Operation Permissions">
              <GrantList values={labels} emptyText="View only / no additional operation permissions" />
              {admin && <Typography variant="caption" color="text.secondary">Administrator has additional administrative access.</Typography>}
            </PermissionSection>
            <PermissionSection title="Accessible Buyers">
              {admin ? <Typography variant="body2">All active Buyers (Admin)</Typography> : <GrantList values={account.buyerPermissions} />}
            </PermissionSection>
            <PermissionSection title="Buyer / System Type Permissions">
              {admin ? <Typography variant="body2">All active Buyers and their supported Types (Admin)</Typography> :
                <Stack gap={0.7}>{(account.buyerTypePermissions || []).length ? account.buyerTypePermissions.map(grant => (
                  <Stack key={grant.buyerCode} direction="row" flexWrap="wrap" gap={0.6} alignItems="center">
                    <Typography fontSize={12} fontWeight={800}>{grant.buyerCode}:</Typography>
                    <GrantList values={grant.types} emptyText="No Type access" />
                  </Stack>
                )) : <Typography variant="body2" color="text.secondary">Not assigned</Typography>}</Stack>}
            </PermissionSection>
            <PermissionSection title="Factory Permissions">
              {admin ? <Typography variant="body2">All active Factories (Admin)</Typography> : <GrantList values={account.factoryPermissions} />}
            </PermissionSection>
            <PermissionSection title="Weighing Factory Permissions">
              {admin ? <Typography variant="body2">All eligible Factories (Admin)</Typography> : <GrantList values={account.weighingFactoryPermissions} />}
            </PermissionSection>
          </>}
        </DialogContent>
        <DialogActions><Button onClick={closeDialog}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={dialog === 'password'} onClose={closeDialog} fullWidth maxWidth="xs" aria-labelledby="change-password-title">
        <Box component="form" onSubmit={submitPassword}>
          <DialogTitle id="change-password-title" sx={{ fontWeight: 850 }}>Change Password</DialogTitle>
          <DialogContent dividers>
            <Stack gap={2} sx={{ pt: 1 }}>
              <Typography color="text.secondary" variant="body2">Enter your current password and a new password. After saving, you must sign in again.</Typography>
              {error && <Alert severity="error">{error}</Alert>}
              {[
                ['currentPassword', 'Current Password'],
                ['newPassword', 'New Password'],
                ['confirmPassword', 'Confirm New Password']
              ].map(([key, label]) => <TextField key={key} required fullWidth label={label}
                type={showPasswords ? 'text' : 'password'} autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
                value={passwords[key]} disabled={saving}
                onChange={event => setPasswords(previous => ({ ...previous, [key]: event.target.value }))}
                inputProps={{ minLength: key === 'currentPassword' ? undefined : 8, maxLength: 200 }}
                InputProps={{ endAdornment: key === 'newPassword' ? <InputAdornment position="end">
                  <IconButton onClick={() => setShowPasswords(value => !value)} edge="end" aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}>
                    {showPasswords ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                  </IconButton></InputAdornment> : undefined }} />)}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 1.5 }}>
            <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : <LockOutlinedIcon />}>Update Password</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
