export default function Surfaces() {
  return {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        },
        outlined: {
          borderColor: '#DFE7EF'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #DFE7EF',
          boxShadow: '0 1px 2px rgba(30, 55, 80, 0.035)'
        }
      }
    },
    MuiTablePagination: {
      styleOverrides: {
        root: {
          borderTop: '1px solid #E7EDF3',
          backgroundColor: '#FBFCFE'
        },
        toolbar: {
          minHeight: 48
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          border: '1px solid rgba(80, 105, 130, 0.12)'
        }
      }
    }
  };
}
