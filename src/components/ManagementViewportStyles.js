/** Fit a single management table + its controls inside the Dashboard viewport.
 * Dashboard already reserves the app bar and outer content padding. The small
 * additional offset avoids creating a second page scrollbar at desktop sizes.
 * Short-height displays fall back to page scrolling rather than clipping UI.
 */
export const managementPageSx = {
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  minHeight: 0,
  height: { xs: 'calc(100dvh - 94px)', sm: 'calc(100dvh - 104px)', md: 'calc(100dvh - 116px)' },
  display: 'flex',
  flexDirection: 'column',
  '@media (max-height: 570px)': { height: 'auto', minHeight: 400 }
};

export const managementStackSx = {
  flex: '1 1 0%',
  minHeight: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column'
};

export const managementPanelSx = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 0%',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
  '@media (max-height: 570px)': { flex: '0 0 auto', minHeight: 350 }
};

export const managementTableViewportSx = {
  flex: '1 1 0%',
  minHeight: 0,
  height: 'auto',
  maxHeight: 'none',
  minWidth: 0,
  '@media (max-height: 570px)': { minHeight: 220 }
};
