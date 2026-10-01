import PropTypes from 'prop-types';
import { useMemo } from 'react';

import useMediaQuery from '@mui/material/useMediaQuery';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';

import DrawerHeader from './DrawerHeader';
import DrawerContent from './DrawerContent';
import MiniDrawerStyled from './MiniDrawerStyled';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH } from 'config';

const SIDEBAR_SURFACE = '#FFFFFF';
const BORDER = '#E6EDF4';
const TEXT = '#24364B';

export default function MainDrawer({ window }) {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = Boolean(menuMaster?.isDashboardDrawerOpened);
  const container = window !== undefined ? () => window().document.body : undefined;

  const drawerContent = useMemo(() => <DrawerContent />, []);
  const drawerHeader = useMemo(() => <DrawerHeader open={drawerOpen} />, [drawerOpen]);

  const paperBase = {
    borderRight: `1px solid ${BORDER}`,
    backgroundColor: SIDEBAR_SURFACE,
    backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #FAFBFD 100%)',
    overflow: 'hidden',
    color: TEXT,
    boxShadow: '8px 0 24px rgba(24, 54, 84, 0.03)'
  };

  const drawerBody = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ flexShrink: 0 }}>{drawerHeader}</Box>
      <Box sx={{ flex: 1, px: 0.55, py: 0.7, overflow: 'hidden' }}>{drawerContent}</Box>
    </Box>
  );

  return (
    <Box component="nav" aria-label="application navigation" sx={{ flexShrink: { md: 0 }, zIndex: 1200 }}>
      {!downLG ? (
        <MiniDrawerStyled variant="permanent" open={drawerOpen} sx={{ '& .MuiDrawer-paper': paperBase }}>
          {drawerBody}
        </MiniDrawerStyled>
      ) : (
        <Drawer
          container={container}
          variant="temporary"
          open={drawerOpen}
          onClose={() => handlerDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: drawerOpen ? 'block' : 'none', lg: 'none' },
            '& .MuiDrawer-paper': {
              ...paperBase,
              width: DRAWER_WIDTH,
              boxShadow: '12px 0 38px rgba(24, 54, 84, 0.16)'
            }
          }}
        >
          {drawerBody}
        </Drawer>
      )}
    </Box>
  );
}

MainDrawer.propTypes = { window: PropTypes.func };
