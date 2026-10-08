import { useRef, useState } from 'react';
import { alpha } from '@mui/material/styles';
import { Box, ButtonBase, ClickAwayListener, Divider, ListItemIcon, ListItemText, MenuItem, Paper, Popper, Stack, Typography } from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { clearAuthSession } from '../../../../../routes/globalApi';

import { STORAGE_KEY } from '../../../../../constants/appConstants';

const readUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY.USER) || '{}');
    return { username: user.username || user.email || 'User', email: user.email || '', role: user.role || localStorage.getItem(STORAGE_KEY.ROLE) || '' };
  } catch {
    return { username: 'User', email: '', role: localStorage.getItem(STORAGE_KEY.ROLE) || '' };
  }
};

export default function Profile() {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const user = readUser();
  const firstLetter = String(user.username || 'U').charAt(0).toUpperCase();
  const logout = () => { clearAuthSession(); window.location.assign('/login'); };

  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <ButtonBase ref={anchorRef} aria-label="open user menu" aria-haspopup="true" onClick={() => setOpen((value) => !value)} sx={{ width: 46, height: 46, p: 0.4, borderRadius: '50%', '&:hover': { bgcolor: alpha('#3B82F6', 0.07) } }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', border: `2px solid ${alpha('#3B82F6', 0.78)}`, bgcolor: alpha('#3B82F6', 0.08), color: '#2563EB', fontWeight: 900 }}>{firstLetter}</Box>
      </ButtonBase>
      <Popper placement="bottom-end" open={open} anchorEl={anchorRef.current} popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [0, 10] } }] }}>
        <ClickAwayListener onClickAway={() => setOpen(false)}>
          <Paper sx={{ width: 250, borderRadius: 2.5, overflow: 'hidden', border: '1px solid #E8EEF5', boxShadow: '0 18px 60px rgba(24,54,84,.14)' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ p: 2 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: alpha('#3B82F6', .08), color: '#2563EB' }}><AccountCircleOutlinedIcon sx={{ fontSize: 20 }} /></Box>
              <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }}>{user.username}</Typography><Typography sx={{ fontSize: '.72rem', color: 'text.secondary' }}>{user.email || user.role}</Typography></Box>
            </Stack>
            <Divider />
            <MenuItem onClick={logout} sx={{ py: 1.2 }}><ListItemIcon><LogoutOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon><ListItemText primary="Logout" /></MenuItem>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </Box>
  );
}
