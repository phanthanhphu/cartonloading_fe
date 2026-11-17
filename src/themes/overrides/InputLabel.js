// ==============================|| OVERRIDES - INPUT LABEL ||============================== //

export default function InputLabel(theme) {
  return {
    MuiInputLabel: {
      styleOverrides: {
        // Keep MUI's native outlined label line-height, transform and width.
        // Its notch is measured from that geometry; extra padding, margins or
        // different line-heights cut through labels (especially small/date fields).
        root: {
          color: theme.palette.secondary.main
        }
      }
    }
  };
}
