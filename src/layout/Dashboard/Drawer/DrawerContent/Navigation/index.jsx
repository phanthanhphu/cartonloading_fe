import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import NavGroup from './NavGroup';
import NavItem from './NavItem';
import { useGetMenuMaster } from 'api/menu';
import { getDashboardMenu } from 'menu-items/dashboard';
import { listAccessibleBuyers } from 'services/buyerService';
import { setBuyerCatalog } from 'utils/buyerAccess';

export default function Navigation() {
  const { pathname } = useLocation();
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = Boolean(menuMaster?.isDashboardDrawerOpened);
  const [catalogVersion, setCatalogVersion] = useState(0);

  const refreshBuyers = useCallback(async () => {
    try {
      const rows = await listAccessibleBuyers();
      if (Array.isArray(rows) && rows.length) setBuyerCatalog(rows);
    } catch {
      // Keep the last cached catalog when the server is temporarily unavailable.
    } finally {
      setCatalogVersion((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    refreshBuyers();
    const onChanged = () => refreshBuyers();
    window.addEventListener('buyers:changed', onChanged);
    window.addEventListener('storage', onChanged);
    return () => {
      window.removeEventListener('buyers:changed', onChanged);
      window.removeEventListener('storage', onChanged);
    };
  }, [refreshBuyers]);

  const menuItems = useMemo(() => getDashboardMenu(), [catalogVersion, pathname]);
  const [selectedID, setSelectedID] = useState('');
  const [selectedItems, setSelectedItems] = useState('');
  const [selectedLevel, setSelectedLevel] = useState(0);

  const lastItem = null;
  let lastItemIndex = menuItems.items.length - 1;
  let remItems = [];
  let lastItemId;

  if (lastItem && lastItem < menuItems.items.length) {
    lastItemId = menuItems.items[lastItem - 1].id;
    lastItemIndex = lastItem - 1;
    remItems = menuItems.items.slice(lastItem - 1, menuItems.items.length).map((item) => ({
      title: item.title,
      elements: item.children,
      icon: item.icon,
      ...(item.url && { url: item.url })
    }));
  }

  const navGroups = menuItems.items.slice(0, lastItemIndex + 1).map((item) => {
    switch (item.type) {
      case 'group':
        if (item.url && item.id !== lastItemId) {
          return (
            <Fragment key={item.id}>
              <Divider sx={{ my: 0.75, borderColor: '#E8EEF5' }} />
              <NavItem item={item} level={1} isParents setSelectedID={setSelectedID} pathname={pathname} />
            </Fragment>
          );
        }
        return (
          <NavGroup
            key={item.id}
            selectedID={selectedID}
            setSelectedID={setSelectedID}
            setSelectedItems={setSelectedItems}
            setSelectedLevel={setSelectedLevel}
            selectedLevel={selectedLevel}
            selectedItems={selectedItems}
            lastItem={lastItem}
            remItems={remItems}
            lastItemId={lastItemId}
            item={item}
            pathname={pathname}
          />
        );
      default:
        return <Typography key={item.id} variant="h6" color="error" align="center">Fix - Navigation Group</Typography>;
    }
  });

  return (
    <Box sx={{ pt: drawerOpen ? 1.1 : 0, '& > ul:first-of-type': { mt: 0 }, display: 'block', alignItems: 'center' }}>
      {navGroups}
    </Box>
  );
}
