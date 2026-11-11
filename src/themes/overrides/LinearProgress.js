// ==============================|| OVERRIDES - LINER PROGRESS ||============================== //

export default function LinearProgress() {
  return {
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 6,
          borderRadius: '4px'
        },
        bar: {
          borderRadius: '4px'
        }
      }
    }
  };
}
