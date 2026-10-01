import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';

const DrawerHeaderStyled = styled(Box, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  ...theme.mixins.toolbar,
  minHeight: 70,
  display: 'flex',
  alignItems: 'center',
  justifyContent: open ? 'flex-start' : 'center',
  paddingLeft: open ? theme.spacing(1.5) : theme.spacing(0),
  paddingRight: open ? theme.spacing(1.5) : theme.spacing(0),
  backgroundColor: '#FFFFFF',
  borderBottom: '1px solid #E8EEF5'
}));

export default DrawerHeaderStyled;
