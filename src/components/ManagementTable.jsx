import { Box, CircularProgress, Paper, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import SortableTable from 'components/SortableTable';
import StatusChip from 'components/StatusChip';

export default function ManagementTable({ title, columns = [], rows = [], loading = false, count = 0, page = 0, rowsPerPage = 25,
  onPageChange, onRowsPerPageChange, onRowClick, selectedId, getRowId = (row) => row?.id, emptyText = 'No data' }) {
  const safeCount = Math.max(0, Number(count || 0));
  const safeRowsPerPage = Math.max(1, Number(rowsPerPage || 25));
  const maxPage = Math.max(0, Math.ceil(safeCount / safeRowsPerPage) - 1);
  const safePage = Math.min(Math.max(0, Number(page || 0)), maxPage);
  const colSpan = Math.max(1, columns.length);
  const tableMinWidth = Math.max(680, columns.reduce((total, column) => total + Math.max(70, Number(column?.minWidth || 110)), 0));

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 2, borderColor: '#DCE4EC' }}>
      {title ? <Box sx={{ px: 1.25, py: 0.75, borderBottom: '1px solid #E5E7EB' }}><Typography fontWeight={800}>{title}</Typography></Box> : null}
      <TableContainer
        sx={{
          maxHeight: 520,
          maxWidth: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          scrollbarGutter: 'stable'
        }}
      >
        <SortableTable size="small" stickyHeader rowNumberStart={safePage * safeRowsPerPage} sx={{ minWidth: tableMinWidth + 64 }}>
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
                  return <TableCell key={c.key}>{c.render ? c.render(row) : (isStatus && value != null ? <StatusChip status={value} /> : (value ?? '—'))}</TableCell>;
                })}
              </TableRow>;
            })}
          </TableBody>
        </SortableTable>
      </TableContainer>
      <TablePagination component="div" count={safeCount} page={safePage} rowsPerPage={safeRowsPerPage}
        onPageChange={(_, next) => onPageChange?.(next)} onRowsPerPageChange={(e) => onRowsPerPageChange?.(Number(e.target.value))}
        rowsPerPageOptions={[10, 25, 50, 100]} />
    </Paper>
  );
}
