import { Box } from '@mui/material';
import { managementPageSx } from 'components/ManagementViewportStyles';
import TraceHistoryPage from './TraceHistoryPage';

/** One History management page. RFID and Weight details are in the same carton history view. */
export default function HistoryPage() {
  return (
    <Box sx={{
      p: { xs: 0.75, md: 1 },
      ...managementPageSx,
      // Keep the existing natural page flow for mobile cards. Fit the desktop
      // table + pagination to the available Dashboard viewport only.
      height: { xs: 'auto', sm: 'auto', md: managementPageSx.height.md },
      display: { xs: 'block', md: 'flex' },
      '@media (max-height: 570px)': { height: 'auto', minHeight: 400 }
    }}>
      <TraceHistoryPage />
    </Box>
  );
}
