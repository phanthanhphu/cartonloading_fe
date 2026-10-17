export default function TableCell() {
  return {
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #D6E0EA',
          borderRight: '1px solid #D6E0EA',
          padding: '8px 10px',
          fontSize: '0.78rem',
          lineHeight: 1.4,
          color: '#30485F'
        },
        head: {
          backgroundColor: '#F7F9FC',
          color: '#475569',
          fontSize: '0.75rem',
          fontWeight: 800,
          letterSpacing: '.02em',
          whiteSpace: 'nowrap'
        },
        sizeSmall: {
          padding: '7px 9px'
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color .12s ease',
          '&.MuiTableRow-hover:hover:not(.Mui-selected)': { backgroundColor: '#EEF4FC' }
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderColor: '#DFE7EF',
          borderRadius: 10,
          // TableContainer is a scroll surface. `overflow: hidden` clipped rows/columns
          // and made Rows per page / Columns look as if they were not applied.
          overflowX: 'auto',
          overflowY: 'auto'
        }
      }
    }
  };
}
