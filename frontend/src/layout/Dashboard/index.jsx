import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import Loader from 'components/Loader';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { DRAWER_WIDTH, MINI_DRAWER_WIDTH } from 'config';

export default function MainLayout() {
  const { menuMaster, menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));

  useEffect(() => {
    handlerDrawerOpen(!downXL);
  }, [downXL]);

  if (menuMasterLoading || !menuMaster) return <Loader />;

  const drawerOpen = Boolean(menuMaster.isDashboardDrawerOpened);

  return (
    <Box sx={{ display: 'flex', width: '100%', minHeight: '100vh', bgcolor: '#F4F7FA' }}>
      <Header />
      <Drawer />

      <Box
        component="main"
        sx={{
          width: `calc(100% - ${drawerOpen ? DRAWER_WIDTH : MINI_DRAWER_WIDTH}px)`,
          flexGrow: 1,
          bgcolor: '#F4F7FA',
          transition: 'width .2s ease',
          minWidth: 0
        }}
      >
        <Toolbar />
        <Box
          sx={{
            p: { xs: 1, sm: 1.25, md: 1.5 },
            position: 'relative',
            minHeight: 'calc(100vh - 64px)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Outlet />
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
