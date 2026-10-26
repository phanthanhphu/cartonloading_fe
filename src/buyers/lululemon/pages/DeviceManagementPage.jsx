import { useState } from 'react';
import { Box, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { ScaleOutlined, SensorsOutlined } from '@mui/icons-material';
import ScalePlcDevicesPage from './ScalePlcDevicesPage';
import RfidDevicesPage from './RfidDevicesPage';
import { DEVICE_TAB } from '../common/deviceConstants';

/** One menu, two horizontal device registries. All actions require ADMIN on backend. */
export default function DeviceManagementPage() {
  const [tab, setTab] = useState(DEVICE_TAB.SCALE);
  return <Box sx={{ px: { xs: 1, md: 2 }, pt: 1, pb: 2 }}>
    <Stack spacing={0.5} sx={{ mb: 1 }}>
      <Typography variant="h6" fontWeight={800}>Device Management</Typography>
      <Typography variant="body2" color="text.secondary">LULULEMON · Admin assigns Scale (PLC) and RFID readers to Factories and Users.</Typography>
    </Stack>
    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 1 }}>
      <Tabs variant="scrollable" scrollButtons="auto" value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value={DEVICE_TAB.SCALE} icon={<ScaleOutlined fontSize="small"/>} iconPosition="start" label="Scale (PLC)"/>
        <Tab value={DEVICE_TAB.RFID} icon={<SensorsOutlined fontSize="small"/>} iconPosition="start" label="RFID Readers"/>
      </Tabs>
    </Paper>
    {tab === DEVICE_TAB.SCALE ? <ScalePlcDevicesPage/> : <RfidDevicesPage/>}
  </Box>;
}
