import { Box } from '@mui/material';
import TraceHistoryPage from './TraceHistoryPage';

/** One History management page. RFID and Weight details are in the same carton history view. */
export default function HistoryPage() {
  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <TraceHistoryPage />
    </Box>
  );
}
