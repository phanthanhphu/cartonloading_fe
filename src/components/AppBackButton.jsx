import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { useLocation, useNavigate } from 'react-router-dom';

const HOME_PATHS = new Set(['/', '/workflow']);


const hasLocalBackButton = (pathname = '/') => {
  const path = pathname.replace(/\/+$/, '') || '/';
  return [
    /^\/buyers\/[^/]+\/orders\/[^/]+$/,
    /^\/buyers\/[^/]+\/orders\/[^/]+\/(?:data-management|scan|weight-check|barcode-assign)$/,
    /^\/buyers\/[^/]+\/orders\/[^/]+\/items\/[^/]+$/,
    /^\/buyers\/[^/]+\/packing-list\/[^/]+$/,
    /^\/buyers\/[^/]+\/(?:packing|print-requests|shipping)$/,
    /^\/assign-barcode\/[^/]+\/[^/]+$/
  ].some((pattern) => pattern.test(path));
};

const decodeSegment = (value = '') => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function resolveBackPath(pathname = '/') {
  const path = pathname.replace(/\/+$/, '') || '/';

  let match = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)\/pos\/([^/]+)\/cartons\/([^/]+)$/);
  if (match) return `/buyers/${match[1]}/orders/${match[2]}/pos/${encodeURIComponent(decodeSegment(match[3]))}`;

  match = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)\/pos\/([^/]+)$/);
  if (match) return `/buyers/${match[1]}/orders/${match[2]}`;

  match = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)\/(?:data-management|scan|weight-check|barcode-assign)$/);
  if (match) return `/buyers/${match[1]}/orders/${match[2]}`;

  match = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)\/items\/[^/]+$/);
  if (match) return `/buyers/${match[1]}/orders/${match[2]}`;

  match = path.match(/^\/buyers\/([^/]+)\/orders\/([^/]+)$/);
  if (match) return `/buyers/${match[1]}/orders`;

  match = path.match(/^\/buyers\/([^/]+)\/packing-list\/([^/]+)$/);
  if (match) return `/buyers/${match[1]}/packing-list`;

  match = path.match(/^\/buyers\/([^/]+)\/(?:packing-list|packing|print-requests|shipping|carton-loading)$/);
  if (match) return `/buyers/${match[1]}/orders`;

  match = path.match(/^\/buyers\/([^/]+)\/orders$/);
  if (match) return '/workflow';

  match = path.match(/^\/packing\/shipments\/[^/]+\/[^/]+$/);
  if (match) return '/packing/shipments';

  match = path.match(/^\/assign-barcode\/[^/]+\/[^/]+$/);
  if (match) return '/assign-barcode';

  return '/workflow';
}

export default function AppBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  if (HOME_PATHS.has(location.pathname) || hasLocalBackButton(location.pathname)) return null;

  const backPath = resolveBackPath(location.pathname);

  return (
    <Tooltip title="Back to previous page">
      <Button
        type="button"
        size="small"
        variant="outlined"
        startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 18 }} />}
        onClick={() => navigate(backPath)}
        aria-label="Back"
        sx={{
          minWidth: 76,
          height: 34,
          px: 1.1,
          borderRadius: 1.5,
          textTransform: 'none',
          fontWeight: 700,
          color: '#2E5F97',
          borderColor: '#D7E3F0',
          bgcolor: '#FFFFFF',
          '&:hover': { borderColor: '#9BB8D7', bgcolor: '#F5F9FE' }
        }}
      >
        Back
      </Button>
    </Tooltip>
  );
}
