import { TableContainer } from '@mui/material';

/**
 * Dedicated scroll area for LULULEMON data tables.
 *
 * Keeps long tables from stretching the whole page: users scroll inside the
 * table viewport while the table header stays visible. Horizontal scrolling is
 * also contained here for wide ALL_BP / shipping tables.
 */
export default function LululemonTableViewport({
  children,
  sx,
  viewportHeight = 'clamp(240px, 38vh, 390px)',
  ...props
}) {
  const extraSx = Array.isArray(sx) ? sx : (sx ? [sx] : []);

  return (
    <TableContainer
      {...props}
      sx={[
        {
          width: '100%',
          height: viewportHeight,
          maxWidth: '100%',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          '& .MuiTableCell-root': {
            py: 0.65,
            px: 0.9
          },
          '& .MuiTableCell-head': {
            position: 'sticky',
            top: 0,
            zIndex: 3,
            bgcolor: 'background.paper',
            boxShadow: '0 1px 0 rgba(0, 0, 0, 0.08)',
            py: 0.7
          }
        },
        ...extraSx
      ]}
    >
      {children}
    </TableContainer>
  );
}
