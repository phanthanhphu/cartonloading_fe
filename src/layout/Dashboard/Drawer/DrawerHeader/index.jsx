import PropTypes from 'prop-types';

import Box from '@mui/material/Box';

import DrawerHeaderStyled from './DrawerHeaderStyled';
import Logo from 'components/logo';
import { HEADER_HEIGHT } from 'config';

export default function DrawerHeader({ open }) {
  return (
    <DrawerHeaderStyled
      open={open}
      sx={{
        minHeight: HEADER_HEIGHT,
        width: 'initial'
      }}
    >
      <Box
        sx={{
          width: open ? '100%' : 44,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
          px: open ? 0.55 : 0,
          '& a': {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 0,
            lineHeight: 0
          }
        }}
      >
        <Logo isIcon={!open} sx={{ width: open ? 118 : 30, height: 'auto', display: 'block' }} />
      </Box>
    </DrawerHeaderStyled>
  );
}

DrawerHeader.propTypes = { open: PropTypes.bool };
