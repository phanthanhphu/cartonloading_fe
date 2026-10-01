import { styled } from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';

import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from 'config';

const AppBarStyled = styled(AppBar, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  marginLeft: open ? DRAWER_WIDTH : MINI_DRAWER_WIDTH,
  width: open ? `calc(100% - ${DRAWER_WIDTH}px)` : `calc(100% - ${MINI_DRAWER_WIDTH}px)`,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen
  })
}));

export default AppBarStyled;
