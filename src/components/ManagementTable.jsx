import { Box, CircularProgress, Paper, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import SortableTable from 'components/SortableTable';
import { PAGE_TABLE_HEIGHT } from 'components/TableViewportHeights';
import { tableScrollbarSx } from 'components/TableScrollbarStyles';
import StatusChip from 'components/StatusChip';

export default function ManagementTable({ title, columns = [], rows = [], loading = false, count = 0, page = 0, rowsPerPage = 25,
  onPageChange, onRowsPerPageChange, onRowClick, filterBar, selectedId, getRowId = (row) => row?.id, emptyText = 'No data', autoHeight = false, fillAvailableHeight = false }) {
  const safeCount = Math.max(0, Number(count || 0));
  const safeRowsPerPage = Math.max(1, Number(rowsPerPage || 10));
  const maxPage = Math.max(0, Math.ceil(safeCount / safeRowsPerPage) - 1);
  const safePage = Math.min(Math.max(0, Number(page || 0)), maxPage);
  const colSpan = Math.max(1, columns.length);
  // Standard tables retain their original internal scroll viewport.
  // Factory/Department opt into compact height only for up to 25 rows.
  const scrollInsideTable = !autoHeight || rows.length > 25;
  const tableMinWidth = Math.max(680, columns.reduce((total, column) => total + Math.max(70, Number(column?.minWidth || 110)), 0));

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: '4px', borderColor: '#DCE4EC',
      ...(fillAvailableHeight ? { display: 'flex', flexDirection: 'column', flex: '1 1 0%', minWidth: 0, minHeight: 0,
        '@media (max-height: 570px)': { flex: '0 0 auto', minHeight: 340 } } : {})
    }}>
      {title ? <Box sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}><Typography fontWeight={800}>{title}</Typography></Box> : null}
      {filterBar ? (
        <Box sx={{ px: { xs: 0.85, md: 1.2 }, py: 0.85, borderBottom: '1px solid #E5E7EB', bgcolor: '#FBFCFE', flexShrink: 0 }}>
          {filterBar}
        </Box>
      ) : null}
      <TableContainer
        sx={{
          width: '100%',
          maxWidth: '100%',
          height: fillAvailableHeight ? 'auto' : (scrollInsideTable ? PAGE_TABLE_HEIGHT : 'auto'),
          ...(fillAvailableHeight ? { flex: '1 1 0%', minHeight: 0 } : {}),
          overflowX: 'auto',
          ...tableScrollbarSx
        }}
      >
        <SortableTable size="small" stickyHeader={fillAvailableHeight || scrollInsideTable} rowNumberStart={safePage * safeRowsPerPage} sx={{ minWidth: tableMinWidth + 64 }}>
          <TableHead><TableRow>{columns.map((c) => <TableCell key={c.key} sx={{ fontWeight: 800, whiteSpace: 'nowrap', minWidth: c.minWidth }}>{c.label}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={colSpan} align="center" sx={{ py: 3 }}><CircularProgress size={24} /></TableCell></TableRow> : null}
            {!loading && rows.length === 0 ? <TableRow><TableCell colSpan={colSpan} align="center" sx={{ py: 3, color: 'text.secondary' }}>{emptyText}</TableCell></TableRow> : null}
            {!loading && rows.map((row, index) => {
              const id = getRowId(row) ?? index;
              return <TableRow hover key={id} selected={selectedId != null && id === selectedId} onClick={() => onRowClick?.(row)} sx={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                {columns.map((c) => {
                  const value = row?.[c.key];
                  const isStatus = c.status === true || String(c.key || '').toLowerCase().includes('status');
                  return <TableCell key={c.key} data-sort-value={c.sortValue ? c.sortValue(row) : undefined}>{c.render ? c.render(row) : (isStatus && value != null ? <StatusChip status={value} /> : (value ?? '—'))}</TableCell>;
                })}
              </TableRow>;
            })}
          </TableBody>
        </SortableTable>
      </TableContainer>
      <TablePagination component="div" count={safeCount} page={safePage} rowsPerPage={safeRowsPerPage}
        onPageChange={(_, next) => onPageChange?.(next)} onRowsPerPageChange={(e) => onRowsPerPageChange?.(Number(e.target.value))}
        rowsPerPageOptions={[10, 25, 50, 100]} sx={{ flexShrink: 0 }} />
    </Paper>
  );
}
