import Navigation from './Navigation';
import SimpleBar from 'components/third-party/SimpleBar';

export default function DrawerContent() {
  return (
    <SimpleBar
      sx={{
        height: '100%',
        '& .simplebar-content': { display: 'flex', flexDirection: 'column' },
        '& .simplebar-scrollbar:before': { backgroundColor: 'rgba(121, 145, 174, 0.34)' }
      }}
    >
      <Navigation />
    </SimpleBar>
  );
}
