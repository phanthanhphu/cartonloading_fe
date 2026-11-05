import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import { useTheme, alpha } from '@mui/material/styles';

// logo asset
import logoYoungone from '../../assets/svg/logos/logo-youngone.png';

export default function LogoMain({ sx }) {
  const theme = useTheme();

  return (
    <Box
      component="img"
      src={logoYoungone}
      alt="Youngone logo"
      draggable={false}
      sx={{
        display: 'block',
        width: '100%',
        height: 'auto',
        maxWidth: 150,
        mr: 'auto',

        // Softer visual treatment
        opacity: 0.92,
        filter: `
          drop-shadow(0 10px 22px ${alpha(theme.palette.common.black, 0.35)})
          saturate(1.05)
        `,

        ...sx
      }}
    />
  );
}

LogoMain.propTypes = {
  sx: PropTypes.object
};
