import { useT } from '../../../i18n/LanguageProvider';
import { useMemo, useState, useEffect } from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';

const issues = [
  ['ALL', 'All cartons'], ['INCOMPLETE', 'Not completed'], ['SSCC_MISSING', 'SSCC missing'],
  ['SKU_MISSING', 'SKU / item missing'], ['PASS', 'RFID PASS'], ['FAILED', 'RFID FAILED'],
  ['NOT_SCANNED', 'RFID not scanned'], ['MISSING_TAGS', 'RFID missing tags']
];
const matches = (carton, issue, scanDate) => {
  switch (issue) {
    case 'INCOMPLETE': return !carton.completed;
    case 'SSCC_MISSING': return !carton.ssccAssigned;
    case 'SKU_MISSING': return !carton.skuAssigned;
    case 'PASS': return scanDate ? carton.scanDayPassAttempts > 0 : carton.rfidStatus === 'PASS';
    case 'FAILED': return scanDate ? carton.scanDayFailedAttempts > 0 : carton.rfidStatus === 'FAILED';
    case 'NOT_SCANNED': return carton.rfidStatus === 'NOT_SCANNED';
    case 'MISSING_TAGS': return carton.rfidMissingQty > 0;
    default: return true;
  }
};
export default function ShippingScheduleQcDetailsDialog({ open, po, report, initialIssue, onClose }) {
  const trUi = useT();
  const [issue, setIssue] = useState('ALL');
  useEffect(() => { if (open) setIssue(initialIssue || 'ALL'); }, [open, initialIssue]);
  const cartons = useMemo(() => (report?.cartons || [])
    .filter((c) => c.poId === po?.id && matches(c, issue, report?.scanDate)), [report, po?.id, issue]);
  return <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="xl">
    <DialogTitle>{trUi("Carton QC Details — PO ")}{po?.poNumber || '—'}</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField select size="small" label={trUi("Show cartons")} value={issue} onChange={(e) => setIssue(e.target.value)} sx={{ minWidth: 220 }}>
            {issues.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <Typography variant="body2" color="text.secondary">{cartons.length}{trUi(" cartons · RFID results show current status; PASS/FAILED filters use the selected scan date when set.")}</Typography>
          {report?.scanDate && <Chip label={trUi("Scan date: {0}", report.scanDate)} size="small" variant="outlined" />}
        </Stack>
        <TableContainer sx={{ maxHeight: '65vh', border: 1, borderColor: 'divider' }}>
          <Table stickyHeader size="small">
            <TableHead><TableRow>
              {['Carton', 'Created', 'SSCC-18', 'SSCC', 'Label SKU', 'SKU Items', 'RFID', 'Read / Expected', 'Missing Tags', 'RFID Reason', 'Last Scan', 'Weight', 'Completed', 'PASS / FAIL Attempts'].map((label) =>
                <TableCell key={label} sx={{ whiteSpace: 'nowrap', fontWeight: 800 }}>{label}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {cartons.map((c) => <TableRow key={`${c.poId}:${c.cartonNo}`} hover>
                <TableCell>{c.cartonNo}</TableCell>
                <TableCell>{c.generated ? 'Yes' : 'No'}</TableCell>
                <TableCell>{c.sscc18 || '—'}</TableCell>
                <TableCell sx={{ color: c.ssccAssigned ? 'success.main' : 'error.main' }}>{c.ssccAssigned ? 'Assigned' : 'Missing'}</TableCell>
                <TableCell>{c.labelSku || '—'}</TableCell>
                <TableCell sx={{ color: c.skuAssigned ? 'success.main' : 'warning.main' }}>{c.skuAssignedItems} / {c.expectedItems}</TableCell>
                <TableCell sx={{ color: c.rfidStatus === 'PASS' ? 'success.main' : c.rfidStatus === 'FAILED' ? 'error.main' : 'text.secondary' }}>{c.rfidStatus}</TableCell>
                <TableCell>{c.rfidActualQty} / {c.rfidExpectedQty}</TableCell>
                <TableCell sx={{ color: c.rfidMissingQty > 0 ? 'error.main' : 'text.primary' }}>{c.rfidMissingQty}</TableCell>
                <TableCell>{c.rfidReason || '—'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.lastRfidAt || '—'}</TableCell>
                <TableCell>{c.weightStatus || '—'}</TableCell>
                <TableCell>{c.completed ? 'Yes' : 'No'}</TableCell>
                <TableCell>{c.scanDayPassAttempts} / {c.scanDayFailedAttempts}</TableCell>
              </TableRow>)}
              {!cartons.length && <TableRow><TableCell colSpan={14}><Box p={2} textAlign="center">{trUi("No cartons match this filter.")}</Box></TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>{trUi("Close")}</Button></DialogActions>
  </Dialog>;
}
