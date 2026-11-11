import { Box } from '@mui/material';
import SimpleBar from 'simplebar-react';

/**
 * Native desktop scrollbars reserve a right-hand gutter on Windows. SimpleBar
 * draws its scrollbar OVER the content instead, so the last table column still
 * reaches the outer edge. Both axes remain scrollable (wheel, touch, keyboard,
 * trackpad and thumb dragging); no horizontal/vertical table space is reserved.
 *
 * The application's existing index.css already imports simplebar-react CSS.
 */
export default function OverlayTableScroll({ children, sx, ...other }) {
  const overrides = Array.isArray(sx) ? sx : (sx ? [sx] : []);

  return (
    <Box
      component={SimpleBar}
      autoHide={false}
      {...other}
      sx={[
        {
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          // The SimpleBar content wrapper is the actual scroll surface.
          // Never activate an additional native scrollbar on the outer box.
          overflow: 'hidden',
          '& .simplebar-track.simplebar-vertical': {
            width: 10,
            right: 0,
            zIndex: 5
          },
          '& .simplebar-track.simplebar-horizontal': {
            height: 10,
            bottom: 0,
            zIndex: 5
          },
          '& .simplebar-scrollbar::before': {
            backgroundColor: 'rgba(93, 117, 146, 0.55)',
            borderRadius: '5px'
          }
        },
        ...overrides,
        // Some callers pass overflowX: 'auto'. That must apply to the internal
        // SimpleBar content wrapper, not create a second outer scrollbar.
        { overflow: 'hidden' }
      ]}
    >
      {children}
    </Box>
  );
}
