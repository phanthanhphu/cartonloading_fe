import { styled } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';

import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from 'config';

const openedMixin = (theme) => ({
  width: DRAWER_WIDTH,
  overflowX: 'hidden',
  borderRight: '1px solid #E7EDF4',
  backgroundImage: 'none',
  boxShadow: 'none',
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen
  })
});

const closedMixin = (theme) => ({
  width: MINI_DRAWER_WIDTH,
  overflowX: 'hidden',
  borderRight: '1px solid #E7EDF4',
  backgroundImage: 'none',
  boxShadow: 'none',
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen
  })
});

const MiniDrawerStyled = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',

  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme)
  }),

  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme)
  })
}));

export default MiniDrawerStyled;
