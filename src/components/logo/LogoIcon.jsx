import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

export default function LogoIcon() {
  const theme = useTheme();
  const ACCENT = theme.palette.primary.main; // xanh theme

  return (
    <Box
      aria-label="Youngone"
      sx={{
        width: 40,
        height: 40,
        mx: 'auto',
        display: 'grid',
        placeItems: 'center',
        borderRadius: 2.5,

        // glass feel
        bgcolor: alpha('#ffffff', 0.06),
        border: `1px solid ${alpha('#ffffff', 0.10)}`,
        boxShadow: `
          inset 0 1px 0 ${alpha('#ffffff', 0.06)},
          0 12px 30px ${alpha('#000', 0.30)}
        `,

        // Slight emphasis for visibility
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: 0.5,
          color: ACCENT,
          textShadow: `0 10px 22px ${alpha('#000', 0.35)}`
        }}
      >
        Y
      </Typography>
    </Box>
  );
}
