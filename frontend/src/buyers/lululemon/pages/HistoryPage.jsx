import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import TraceHistoryPage from './TraceHistoryPage';
import WeightHistoryPage from './WeightHistoryPage';

/** One history menu, two inline tabs; both existing audit APIs are preserved. */
export default function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'weight' ? 'weight' : 'trace';
  const choose = (next) => setParams(next === 'weight' ? { tab: 'weight' } : {});
  return <Box sx={{ p: { xs: 0.75, md: 1 } }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
      <Typography variant="h6" fontWeight={800}>History</Typography>
      <Chip size="small" variant="outlined" label="Factory scoped" />
      <Box sx={{ flex: 1 }} />
      <Button size="small" variant={tab === 'trace' ? 'contained' : 'text'} onClick={() => choose('trace')}>Trace & RFID</Button>
      <Button size="small" variant={tab === 'weight' ? 'contained' : 'text'} onClick={() => choose('weight')}>Weight History</Button>
    </Stack>
    {tab === 'weight' ? <WeightHistoryPage /> : <TraceHistoryPage />}
  </Box>;
}
