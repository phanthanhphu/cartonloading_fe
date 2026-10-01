export default function TableCell() {
  return {
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #E7EDF3',
          borderRight: 0,
          padding: '8px 10px',
          fontSize: '0.78rem',
          lineHeight: 1.4,
          color: '#30485F'
        },
        head: {
          backgroundColor: '#F7F9FC',
          color: '#50667B',
          fontSize: '0.72rem',
          fontWeight: 750,
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
          '&:hover': { backgroundColor: '#F8FAFD' }
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
