import { useT } from '../../../i18n/LanguageProvider';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

// This is a blocking business conflict, not a temporary success/error toast.
// Keep it visible until the user reviews the existing Factory owner.
export default function PoDuplicateConflictDialog({ duplicates = [], open, onClose }) {
  const trUi = useT();
  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="lg" fullWidth aria-labelledby="po-duplicate-dialog-title">
      <DialogTitle id="po-duplicate-dialog-title" sx={{ fontWeight: 800 }}>{trUi("\n        Duplicate PO — Import Not Applied\n      ")}</DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {duplicates.length}{trUi(" PO identity conflict(s) found within this Buyer. No PO in this file was imported.\n          For an existing PO, edit the existing item in the PO management screen rather than uploading it again.\n          For an ownership conflict between Factories, contact the listed importer or an administrator.\n          Do not delete operational cartons or RFID/Weight history.\n        ")}</Alert>
        <TableContainer sx={{ maxHeight: 390, border: '1px solid', borderColor: 'divider' }}>
          <Table stickyHeader size="small" aria-label={trUi("Duplicate PO ownership")}>
            <TableHead><TableRow>
              {['Master PO', 'PO', 'Packing Plan', 'SO (PTS)', 'Factory owner', 'Imported by', 'Imported at', 'Order'].map(name =>
                <TableCell key={name} sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{name}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>{duplicates.map((po, index) => (
              <TableRow key={`${po.poNumber}-${index}`} hover>
                <TableCell>{po.masterPo || '—'}</TableCell>
                <TableCell>{po.poNumber || '—'}</TableCell>
                <TableCell>{po.packingPlan || '—'}</TableCell>
                <TableCell>{po.salesOrderPts || '—'}</TableCell>
                <TableCell><Typography fontWeight={700}>{po.existingFactory || 'Unknown'}</Typography></TableCell>
                <TableCell>{po.importedBy || 'Unknown'}</TableCell>
                <TableCell>{po.importedAt ? String(po.importedAt).replace('T', ' ').slice(0, 19) : 'Unknown'}</TableCell>
                <TableCell>{po.existingOrderId || '—'}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{trUi("\n          Unique key: Buyer + Master PO + PO + Packing Plan + SO (PTS). Factory is not part of the key.\n        ")}</Typography></Box>
      </DialogContent>
      <DialogActions><Button variant="contained" onClick={onClose}>{trUi("Close")}</Button></DialogActions>
    </Dialog>
  );
}
