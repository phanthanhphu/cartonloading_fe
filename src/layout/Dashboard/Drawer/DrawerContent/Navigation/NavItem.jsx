import PropTypes from 'prop-types';
import { matchPath, Link } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

import Dot from 'components/@extended/Dot';
import IconButton from 'components/@extended/IconButton';
import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';
import { getNavigationIcon } from './menuIcons';

const ACCENT = '#0A6ED1';
const ACCENT_DARK = '#0A6ED1';
const TEXT = '#2D4358';
const TEXT_MUTED = '#5E738B';
const HOVER = '#F5F8FC';
const SELECTED = '#EAF3FC';
const SELECTED_BORDER = '#D7E7F7';

export default function NavItem({ item, level, isParents = false, setSelectedID, pathname }) {
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = Boolean(menuMaster?.isDashboardDrawerOpened);

  const itemTarget = item.target ? '_blank' : '_self';
  const ConfiguredIcon = item.icon;
  const SemanticIcon = getNavigationIcon(item);
  const itemIcon = SemanticIcon ? (
    <SemanticIcon sx={{ fontSize: drawerOpen ? 19 : 21 }} />
  ) : ConfiguredIcon ? (
    <ConfiguredIcon variant="Bulk" size={drawerOpen ? 18 : 20} />
  ) : null;
  const itemPath = item?.link || item.url;
  const isExactItem = Boolean(item?.exact);
  const isSelectedByActivePath = Array.isArray(item?.activePaths) && item.activePaths.some((activePath) =>
    Boolean(matchPath({ path: activePath, end: true }, pathname))
  );

  const isSelected =
    item.id === 'grouprequest'
      ? ['/group-requests', '/summary/', '/requisition-monthly/', '/comparison/', '/request-monthly-comparison/'].some((route) =>
          pathname.startsWith(route)
        )
      : Boolean(matchPath({ path: itemPath, end: isExactItem }, pathname)) || isSelectedByActivePath;

  const itemHandler = () => {
    if (downLG) handlerDrawerOpen(false);
    if (isParents && setSelectedID) setSelectedID();
  };

  const compactPl = () => {
    if (!drawerOpen) return 0.75;
    if (level <= 1) return 1.45;
    if (level === 2) return 2.85;
    return 3.55;
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <ListItemButton
        component={Link}
        to={item.url}
        target={itemTarget}
        disabled={item.disabled}
        selected={isSelected}
        onClick={itemHandler}
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
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 7,
            bottom: 7,
            left: -1,
            width: 3,
            borderRadius: '0 999px 999px 0',
            backgroundColor: ACCENT,
            opacity: 0,
            transition: 'opacity .18s ease'
          },
          '&:hover': {
            bgcolor: HOVER,
            '& .MuiListItemIcon-root': { color: ACCENT_DARK }
          },
          '&.Mui-selected': {
            bgcolor: SELECTED,
            borderColor: 'transparent',
            boxShadow: 'none',
            '&::before': { opacity: 1 },
            '&:hover': { bgcolor: '#E8F2FF' }
          }
        }}
      >
        {itemIcon && (
          <ListItemIcon
            sx={{
              minWidth: drawerOpen ? 36 : 0,
              color: isSelected ? ACCENT_DARK : TEXT_MUTED,
              transition: 'color .18s ease',
              ...(!drawerOpen && {
                width: 42,
                height: 42,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2.25,
                bgcolor: isSelected ? SELECTED : 'transparent',
                border: isSelected ? `1px solid ${SELECTED_BORDER}` : '1px solid transparent'
              })
            }}
          >
            {itemIcon}
          </ListItemIcon>
        )}

        {!itemIcon && drawerOpen && (
          <ListItemIcon sx={{ minWidth: 22 }}>
            <Dot size={isSelected ? 6 : 5} color={isSelected ? 'primary' : 'secondary'} />
          </ListItemIcon>
        )}

        {(drawerOpen || (!drawerOpen && level !== 1)) && (
          <ListItemText
            primaryTypographyProps={{ noWrap: true }}
            primary={
              <Typography
                sx={{
                  color: isSelected ? TEXT : TEXT_MUTED,
                  fontWeight: isSelected ? 700 : 550,
                  fontSize: '0.82rem',
                  lineHeight: 1.1,
                  letterSpacing: 0
                }}
              >
                {item.title}
              </Typography>
            }
          />
        )}

        {(drawerOpen || (!drawerOpen && level !== 1)) && item.chip && (
          <Chip
            color={item.chip.color}
            variant={item.chip.variant}
            size={item.chip.size}
            label={item.chip.label}
            avatar={item.chip.avatar && <Avatar>{item.chip.avatar}</Avatar>}
            sx={{
              ml: 1,
              bgcolor: '#F1F6FF',
              color: ACCENT_DARK,
              border: `1px solid ${alpha(ACCENT, 0.14)}`
            }}
          />
        )}
      </ListItemButton>

      {(drawerOpen || (!drawerOpen && level !== 1)) &&
        item?.actions?.map((action, index) => {
          const ActionIcon = action?.icon;
          const callAction = action?.function;

          return (
            <IconButton
              key={index}
              {...(action.type === 'function' && {
                onClick: (event) => {
                  event.stopPropagation();
                  callAction();
                }
              })}
              {...(action.type === 'link' && {
                component: Link,
                to: action.url,
                target: action.target ? '_blank' : '_self'
              })}
              color="secondary"
              variant="outlined"
              sx={{
                position: 'absolute',
                top: 13,
                right: 8,
                zIndex: 2,
                width: 18,
                height: 18,
                p: 0.25,
                borderColor: alpha(ACCENT, 0.18),
                color: ACCENT_DARK,
                bgcolor: 'transparent',
                '&:hover': {
                  borderColor: ACCENT,
                  bgcolor: alpha(ACCENT, 0.08)
                }
              }}
            >
              <ActionIcon size={11} style={{ marginLeft: 1, color: ACCENT_DARK }} />
            </IconButton>
          );
        })}
    </Box>
  );
}

NavItem.propTypes = {
  item: PropTypes.any,
  level: PropTypes.number,
  isParents: PropTypes.bool,
  setSelectedID: PropTypes.any,
  pathname: PropTypes.string
};
