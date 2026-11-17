import { useT } from '../i18n/LanguageProvider';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fallbackBackPath, recordCurrentAppRoute, useSafeAppBack } from 'utils/appBackNavigation';

const HOME_PATHS = new Set(['/', '/dashboard', '/workflow']);


// Packing has its own local Back button which uses the same safe history helper.
const hasLocalBackButton = (pathname = '/') => /^\/buyers\/[^/]+\/packing(?:\/pos\/[^/]+\/[^/]+)?\/?$/.test(pathname);

// Kept for modules which import this path helper. Safe deep-link fallback only.
export function resolveBackPath(pathname = '/', search = '') {
  return fallbackBackPath(pathname, search);
}

export default function AppBackButton() {
  const trUi = useT();
  const location = useLocation();
  const goBack = useSafeAppBack();
  // Track every dashboard route, including screens with their own local Back button.
  useEffect(() => { recordCurrentAppRoute(location); }, [location.key, location.pathname, location.search, location.hash]);

  if (HOME_PATHS.has(location.pathname) || hasLocalBackButton(location.pathname)) return null;

  return (
    <Tooltip title={trUi("Back to previous page")}>
      <Button
        type="button"
        size="small"
        variant="outlined"
        startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 18 }} />}
        onClick={goBack}
        aria-label={trUi("Back")}
        sx={{
          minWidth: 76,
          height: 34,
          px: 1.1,
          borderRadius: '4px',
          textTransform: 'none',
          fontWeight: 700,
          color: '#2E5F97',
          borderColor: '#D7E3F0',
          bgcolor: '#FFFFFF',
          '&:hover': { borderColor: '#9BB8D7', bgcolor: '#F5F9FE' }
        }}
      >{trUi("\n        Back\n      ")}</Button>
    </Tooltip>
  );
}
