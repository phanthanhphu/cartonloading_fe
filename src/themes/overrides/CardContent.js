// ==============================|| OVERRIDES - CARD CONTENT ||============================== //

export default function CardContent() {
  return {
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 10,
          '&:last-child': {
            paddingBottom: 10
          }
        }
      }
    }
  };
}
