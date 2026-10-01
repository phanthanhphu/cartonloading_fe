import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { matchPath } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { alpha } from '@mui/material/styles';

import NavItem from './NavItem';
import { getNavigationIcon } from './menuIcons';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

const ACCENT = '#0A6ED1';
const ACCENT_DARK = '#0A6ED1';
const TEXT = '#2D4358';
const TEXT_MUTED = '#5E738B';
const HOVER = '#F5F8FC';
const SELECTED = '#F4F8FD';
const SELECTED_BORDER = '#E2EBF5';

const isItemSelected = (menuItem, pathname) => {
  if (!menuItem) return false;

  if (menuItem.url) {
    return Boolean(
      matchPath(
        {
          path: menuItem?.link || menuItem.url,
          end: Boolean(menuItem.exact)
        },
        pathname
      )
    );
  }

  return Array.isArray(menuItem.children) && menuItem.children.some((child) => isItemSelected(child, pathname));
};

function NavCollapse({ item, level = 1, pathname }) {
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = Boolean(menuMaster?.isDashboardDrawerOpened);
  const [open, setOpen] = useState(false);

  const selected = isItemSelected(item, pathname);
  const ConfiguredIcon = item.icon;
  const SemanticIcon = getNavigationIcon(item);
  const itemIcon = SemanticIcon ? (
    <SemanticIcon sx={{ fontSize: drawerOpen ? 19 : 21 }} />
  ) : ConfiguredIcon ? (
    <ConfiguredIcon variant="Bulk" size={drawerOpen ? 18 : 20} />
  ) : null;

  useEffect(() => {
    if (selected) setOpen(true);
  }, [selected]);

  const compactPl = () => {
    if (!drawerOpen) return 0.75;
    if (level <= 1) return 1.45;
    if (level === 2) return 2.85;
    return 3.55;
  };

  const handleCollapseClick = () => {
    // In icon-only mode, open the sidebar first so child items are immediately available.
    if (!drawerOpen) {
      handlerDrawerOpen(true);
      setOpen(true);
      return;
    }

    setOpen((previous) => !previous);
  };

  return (
    <>
      <ListItemButton
        selected={false}
        onClick={handleCollapseClick}
        aria-label={!drawerOpen ? item.title : undefined}
        title={!drawerOpen ? item.title : undefined}
        sx={{
          position: 'relative',
          minHeight: 40,
          pl: compactPl(),
          pr: drawerOpen ? 1.3 : 0.75,
          py: 0.45,
          mx: drawerOpen ? 0.65 : 0.45,
          my: 0.16,
          border: '1px solid transparent',
          borderRadius: 1.25,
          justifyContent: drawerOpen ? 'flex-start' : 'center',
          transition: 'background-color .18s ease, border-color .18s ease, color .18s ease',
          '&:hover': {
            bgcolor: HOVER,
            '& .MuiListItemIcon-root': { color: ACCENT_DARK }
          },
          '&.Mui-selected': {
            bgcolor: SELECTED,
            borderColor: SELECTED_BORDER,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#EEF4FA' }
          }
        }}
      >
        {itemIcon && (
          <ListItemIcon
            sx={{
              minWidth: drawerOpen ? 36 : 0,
              color: TEXT_MUTED,
              transition: 'color .18s ease',
              ...(!drawerOpen && {
                width: 42,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2.25,
                bgcolor: 'transparent',
                border: '1px solid transparent'
              })
            }}
          >
            {itemIcon}
          </ListItemIcon>
        )}

        {drawerOpen && (
          <>
            <ListItemText
              primaryTypographyProps={{ noWrap: true }}
              primary={
                <Typography
                  sx={{
                    color: TEXT,
                    fontWeight: selected ? 700 : 600,
                    fontSize: '0.82rem',
                    lineHeight: 1.1
                  }}
                >
                  {item.title}
                </Typography>
              }
            />
            {open ? (
              <ExpandLess sx={{ fontSize: 18, color: TEXT_MUTED }} />
            ) : (
              <ExpandMore sx={{ fontSize: 18, color: TEXT_MUTED }} />
            )}
          </>
        )}
      </ListItemButton>

      <Collapse in={open && drawerOpen} timeout="auto" unmountOnExit>
        <List component="div" disablePadding sx={{ py: 0.2 }}>
          {(item.children || []).map((child) => {
            if (child.type === 'collapse') {
              return <NavCollapse key={child.id} item={child} level={level + 1} pathname={pathname} />;
            }

            if (child.type === 'item') {
              return <NavItem key={child.id} item={child} level={level + 1} pathname={pathname} />;
            }

            return (
              <Typography key={child.id || child.title} variant="h6" color="error" align="center">
                Fix - Group Collapse or Items
              </Typography>
            );
          })}
        </List>
      </Collapse>
    </>
  );
}

NavCollapse.propTypes = {
  item: PropTypes.any,
  level: PropTypes.number,
  pathname: PropTypes.string
};

export default function NavGroup({ item, lastItem, remItems, lastItemId, setSelectedID, pathname }) {
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = Boolean(menuMaster?.isDashboardDrawerOpened);
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const [anchorEl, setAnchorEl] = useState(null);
  const [currentItem, setCurrentItem] = useState(item);
  const openMini = Boolean(anchorEl);

  useEffect(() => {
    if (lastItem && item.id === lastItemId) {
      const localItem = { ...item };
      localItem.children = remItems.map((element) => element.elements).flat(1);
      setCurrentItem(localItem);
      return;
    }

    setCurrentItem(item);
  }, [item, lastItem, lastItemId, remItems, downLG]);

  const checkOpenForParent = (children, id) => {
    children.forEach((element) => {
      if (element.children?.length) checkOpenForParent(element.children, id);

      if (element.url && matchPath({ path: element?.link || element.url, end: Boolean(element.exact) }, pathname)) {
        setSelectedID(id);
      }
    });
  };

  const checkSelectedOnload = (data) => {
    (data.children || []).forEach((menuItem) => {
      if (menuItem?.children?.length) checkOpenForParent(menuItem.children, currentItem.id);

      if (menuItem.url && matchPath({ path: menuItem?.link || menuItem.url, end: Boolean(menuItem.exact) }, pathname)) {
        setSelectedID(currentItem.id);
      }
    });
  };

  useEffect(() => {
    checkSelectedOnload(currentItem);
    if (openMini) setAnchorEl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, currentItem]);

  const navCollapse = currentItem.children?.map((menuItem, index) => {
    if (menuItem.type === 'collapse') {
      return <NavCollapse key={menuItem.id} item={menuItem} level={1} pathname={pathname} />;
    }

    if (menuItem.type === 'item') {
      return <NavItem key={menuItem.id} item={menuItem} level={1} pathname={pathname} />;
    }

    return (
      <Typography key={index} variant="h6" color="error" align="center">
        Fix - Group Collapse or Items
      </Typography>
    );
  });

  return (
    <List
      subheader={
        currentItem.title ? (
          drawerOpen && (
            <Box sx={{ px: 1.35, pt: 1.25, pb: 0.5 }}>
              <Typography
                sx={{
                  textTransform: 'uppercase',
                  fontSize: '0.61rem',
                  lineHeight: 1,
                  letterSpacing: 0.9,
                  fontWeight: 800,
                  color: '#6F8298'
                }}
              >
                {currentItem.title}
              </Typography>
              {currentItem.caption && (
                <Typography sx={{ mt: 0.45, fontSize: '0.66rem', lineHeight: 1.2, color: '#9AA9B8' }}>
                  {currentItem.caption}
                </Typography>
              )}
            </Box>
          )
        ) : (
          <Divider sx={{ my: 1, borderColor: alpha('#8FA2B8', 0.18) }} />
        )
      }
      sx={{ mt: drawerOpen && currentItem.title ? 0.25 : 0, py: 0 }}
    >
      {navCollapse}
    </List>
  );
}

NavGroup.propTypes = {
  item: PropTypes.any,
  lastItem: PropTypes.number,
  remItems: PropTypes.array,
  lastItemId: PropTypes.string,
  selectedID: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
  setSelectedID: PropTypes.oneOfType([PropTypes.any, PropTypes.func]),
  setSelectedItems: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
  selectedItems: PropTypes.oneOfType([PropTypes.string, PropTypes.any]),
  setSelectedLevel: PropTypes.object,
  selectedLevel: PropTypes.number,
  pathname: PropTypes.string
};
