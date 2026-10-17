import { Children, cloneElement, isValidElement, useEffect, useMemo, useState } from 'react';
import { Box, TableBody, TableContainer, TablePagination } from '@mui/material';
import { PAGE_TABLE_HEIGHT } from 'components/TableViewportHeights';
import SortableTable, { compare, directCells, extractText } from 'components/SortableTable';

const flatten = (children) => Children.toArray(children);

/** Fixed-height list viewport with optional client-side pagination.
 * Only enable paginate for tables receiving an unpaged complete list. Tables
 * paged by the server must retain their existing TablePagination instead.
 */
export default function LululemonTableViewport({
  children,
  sx,
  viewportHeight = PAGE_TABLE_HEIGHT,
  paginate = false,
  defaultRowsPerPage = 25,
  ...props
}) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sortIndex, setSortIndex] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const extraSx = Array.isArray(sx) ? sx : (sx ? [sx] : []);

  // Most table clients pass one <SortableTable> or <Table> child. Clone only
  // their <TableBody>; keep the existing sorting, actions and header intact.
  const table = paginate && isValidElement(children) ? children : null;
  const tableParts = table ? flatten(table.props.children) : [];
  const body = tableParts.find((part) => isValidElement(part) && part.type === TableBody);
  const allRows = body ? flatten(body.props.children) : [];
  const realRows = allRows.filter((row) => {
    if (!isValidElement(row)) return false;
    if (row.props?.children == null) return false;
    // Do not count colspan placeholder rows (loading/empty states).
    const cells = flatten(row.props.children);
    return !(cells.length === 1 && Number(cells[0]?.props?.colSpan || 1) > 1);
  });
  const count = realRows.length;
  const safePage = Math.min(page, Math.max(0, Math.ceil(count / rowsPerPage) - 1));

  useEffect(() => { if (page > safePage) setPage(safePage); }, [page, safePage]);

  const displayedTable = useMemo(() => {
    if (!table || !body || !count) return children;
    // Flatten map arrays while preserving Fragment row groups.
    const sortedRows = sortIndex == null ? realRows : [...realRows].sort((a, b) => {
      const aCell = directCells(a)[sortIndex];
      const bCell = directCells(b)[sortIndex];
      return compare(extractText(aCell), extractText(bCell), sortDirection);
    });
    const pageRows = sortedRows.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);
    return cloneElement(table, {
      rowNumberStart: Number(table.props.rowNumberStart || 0) + safePage * rowsPerPage,
      ...(table.type === SortableTable ? {
        controlledSortIndex: sortIndex,
        controlledSortDirection: sortDirection,
        onSortChange: (index, direction) => { setSortIndex(index); setSortDirection(direction); setPage(0); }
      } : {})
    }, tableParts.map((part) => part === body ? cloneElement(body, {}, pageRows) : part));
  }, [table, body, count, children, tableParts, realRows, safePage, rowsPerPage, sortIndex, sortDirection]);

  const viewport = (
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
          '& .MuiTableCell-root': { py: 0.65, px: 0.9 },
          '& .MuiTableCell-head': {
            position: 'sticky', top: 0, zIndex: 3,
            bgcolor: '#F7F9FC',
            boxShadow: '0 1px 0 #D6E0EA', py: 0.7
          }
        },
        ...extraSx
      ]}
    >
      {paginate ? displayedTable : children}
    </TableContainer>
  );

  if (!paginate || !body) return viewport;
  return (
    <Box sx={{ minWidth: 0, width: '100%' }}>
      {viewport}
      <TablePagination component="div" count={count} page={safePage} rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
        onPageChange={(_, next) => setPage(next)}
        onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
      />
    </Box>
  );
}
