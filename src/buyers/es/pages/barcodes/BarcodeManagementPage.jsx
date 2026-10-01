import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  AddOutlined,
  BlockOutlined,
  PrintOutlined,
  QrCode2Outlined,
  RefreshOutlined,
  SearchOutlined
} from '@mui/icons-material';

import {
  generateFactoryBarcodes,
  getFactoryBarcodeSequence,
  listFactoryBarcodes,
  markFactoryBarcodesPrinted,
  voidFactoryBarcode
} from 'buyers/es/services/factoryBarcodeService';
import { buildCode128Svg } from 'utils/code128';

const getErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || error?.message
  || fallback
);

const currentYear = new Date().getFullYear();
const DEFAULT_FACTORY_CODE = '002';

const statusMeta = (value) => {
  const status = String(value || 'AVAILABLE').toUpperCase();
  if (status === 'ASSIGNED') return { label: 'Assigned', color: 'success' };
  if (status === 'VOID') return { label: 'Void', color: 'error' };
  return { label: 'Available', color: 'info' };
};

const dateTimeText = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const makePrintHtml = (rows) => {
  const labels = rows.map((row) => `
    <section class="label">
      <div class="label-title">Factory Use Only</div>
      <div class="barcode">${buildCode128Svg(row.barcode, { moduleWidth: 1.6, barHeight: 58, fontSize: 15 })}</div>
    </section>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Factory Barcode Labels</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background: #fff; }
    .label {
      width: 70mm;
      height: 30mm;
      padding: 2.2mm 4mm 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .label-title { font-size: 12pt; line-height: 1.1; font-weight: 800; margin-bottom: 1.3mm; }
    .barcode { width: 61mm; height: 18mm; }
    @media screen {
      body { background: #e5e7eb; padding: 12px; }
      .label { margin: 0 auto 12px; background: #d9ee00; border: 1px solid #9ca3af; border-radius: 2mm; box-shadow: 0 2px 9px rgba(15,23,42,.14); }
    }
    @media print {
      @page { size: 70mm 30mm; margin: 0; }
      body { background: #fff; }
      .label { margin: 0; background: transparent; border: 0; }
      .label:last-child { page-break-after: auto; break-after: auto; }
    }
  </style>
</head>
<body>${labels}</body>
</html>`;
};

export default function BarcodeManagementPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('ALL');
  const [yearFilter, setYearFilter] = useState('');
  const [factoryFilter, setFactoryFilter] = useState('');
  const [applied, setApplied] = useState({ keyword: '', status: 'ALL', year: '', factoryCode: '' });
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateYear, setGenerateYear] = useState(currentYear);
  const [generateFactoryCode, setGenerateFactoryCode] = useState(DEFAULT_FACTORY_CODE);
  const [generateQuantity, setGenerateQuantity] = useState(10);
  const [sequence, setSequence] = useState(null);
  const [generating, setGenerating] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listFactoryBarcodes({
        keyword: applied.keyword || undefined,
        status: applied.status === 'ALL' ? undefined : applied.status,
        year: applied.year || undefined,
        factoryCode: applied.factoryCode || undefined,
        page,
        size: 50
      });
      setRows(Array.isArray(result?.content) ? result.content : []);
      setTotalPages(Number(result?.totalPages || 0));
      setTotalElements(Number(result?.totalElements || 0));
      setSelected(new Set());
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to load Factory Barcodes.'));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { loadRows(); }, [loadRows]);

  useEffect(() => {
    if (!generateOpen || !/^\d{3}$/.test(generateFactoryCode) || !generateYear) {
      setSequence(null);
      return;
    }
    let cancelled = false;
    getFactoryBarcodeSequence(generateYear, generateFactoryCode)
      .then((value) => { if (!cancelled) setSequence(value); })
      .catch(() => { if (!cancelled) setSequence(null); });
    return () => { cancelled = true; };
  }, [generateOpen, generateYear, generateFactoryCode]);

  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.barcode)), [rows, selected]);
  const printableSelected = selectedRows.filter((row) => row.status !== 'VOID');
  const allPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.barcode));

  const toggleAll = (checked) => {
    setSelected(checked ? new Set(rows.map((row) => row.barcode)) : new Set());
  };

  const toggleOne = (barcode, checked) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(barcode); else next.delete(barcode);
      return next;
    });
  };

  const runSearch = () => {
    setPage(0);
    setApplied({ keyword: keyword.trim(), status, year: yearFilter, factoryCode: factoryFilter.trim() });
  };

  const resetSearch = () => {
    setKeyword('');
    setStatus('ALL');
    setYearFilter('');
    setFactoryFilter('');
    setPage(0);
    setApplied({ keyword: '', status: 'ALL', year: '', factoryCode: '' });
  };

  const runGenerate = async () => {
    const code = generateFactoryCode.trim();
    const qty = Number(generateQuantity);
    if (!/^\d{3}$/.test(code)) {
      setError('Factory Code must contain exactly 3 digits, for example 002.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
      setError('Generate quantity must be between 1 and 1000.');
      return;
    }
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const result = await generateFactoryBarcodes({ year: Number(generateYear), factoryCode: code, quantity: qty });
      setNotice(`Generated ${Number(result?.quantity || qty).toLocaleString()} Factory Barcodes in batch ${result?.batchId || ''}.`);
      setGenerateOpen(false);
      setPage(0);
      setApplied({ keyword: result?.batchId || '', status: 'ALL', year: '', factoryCode: '' });
      setKeyword(result?.batchId || '');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to generate Factory Barcodes.'));
    } finally {
      setGenerating(false);
    }
  };

  const printRows = async (items) => {
    const printable = items.filter((row) => row?.barcode && row.status !== 'VOID');
    if (!printable.length || printing) return;
    const printWindow = window.open('', '_blank', 'width=900,height=720');
    if (!printWindow) {
      setError('The browser blocked the print window. Allow pop-ups for this site and try again.');
      return;
    }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(makePrintHtml(printable));
    printWindow.document.close();

    setPrinting(true);
    setError('');
    try {
      await markFactoryBarcodesPrinted(printable.map((row) => row.barcode));
      setNotice(`Print prepared for ${printable.length.toLocaleString()} label${printable.length === 1 ? '' : 's'}.`);
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
      await loadRows();
    } catch (requestError) {
      printWindow.close();
      setError(getErrorMessage(requestError, 'Unable to record the print request.'));
    } finally {
      setPrinting(false);
    }
  };

  const runVoid = async (row) => {
    if (!row || row.status !== 'AVAILABLE') return;
    const reason = window.prompt(`Reason to VOID ${row.barcode} (optional):`, 'Damaged / unused label');
    if (reason === null) return;
    setError('');
    try {
      await voidFactoryBarcode(row.barcode, reason);
      setNotice(`Factory Barcode ${row.barcode} is now VOID and will never be reused.`);
      await loadRows();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Unable to VOID Factory Barcode.'));
    }
  };

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.4, md: 0.5 }, width: '100%' }}>
      <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ mb: 0.65 }}>
        <Button size="small" variant="outlined" startIcon={<RefreshOutlined />} onClick={loadRows} disabled={loading}>Refresh</Button>
        <Button size="small" variant="outlined" startIcon={<PrintOutlined />} onClick={() => printRows(printableSelected)} disabled={!printableSelected.length || printing}>
          Print Selected ({printableSelected.length})
        </Button>
        <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={() => setGenerateOpen(true)} sx={{ bgcolor: '#103B5C' }}>Generate Barcode</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1.25 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 1.25 }}>{notice}</Alert>}

      <Paper variant="outlined" sx={{ p: 1, mb: 0, borderRadius: '8px 8px 0 0', borderColor: '#DCE4EC', borderBottom: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '2fr 1fr 1fr 1fr' }, gap: 1 }}>
          <TextField size="small" label="Barcode / Batch / PO / Article" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runSearch()} />
          <FormControl size="small">
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(event) => setStatus(event.target.value)}>
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="AVAILABLE">Available</MenuItem>
              <MenuItem value="ASSIGNED">Assigned</MenuItem>
              <MenuItem value="VOID">Void</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="number" label="Year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} placeholder={String(currentYear)} />
          <TextField size="small" label="Factory Code" value={factoryFilter} onChange={(event) => setFactoryFilter(event.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="002" />
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
          <Button variant="contained" startIcon={<SearchOutlined />} onClick={runSearch} sx={{ textTransform: 'none' }}>Search</Button>
          <Button variant="outlined" onClick={resetSearch} sx={{ textTransform: 'none' }}>Reset</Button>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', fontWeight: 800 }}>
            Total {totalElements.toLocaleString()} labels
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: '0 0 8px 8px', overflow: 'hidden', borderColor: '#DCE4EC' }}>
        <TableContainer sx={{ minHeight: 380, maxHeight: 'calc(100vh - 245px)', overflowX: 'auto' }}>
          <SortableTable size="small" sx={{ minWidth: 1420 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ bgcolor: '#F8FAFC' }}><Checkbox checked={allPageSelected} onChange={(event) => toggleAll(event.target.checked)} /></TableCell>
                {['No.', 'Factory Barcode', 'Status', 'Factory', 'Year', 'Running No.', 'Batch', 'Print', 'Assigned Carton', 'PO / Article', 'Created', 'Actions'].map((label) => (
                  <TableCell key={label} sx={{ whiteSpace: 'nowrap' }}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={13} align="center" sx={{ py: 8 }}><CircularProgress /></TableCell></TableRow>
              ) : rows.length ? rows.map((row, index) => {
                const meta = statusMeta(row.status);
                return (
                  <TableRow key={row.id || row.barcode} hover>
                    <TableCell padding="checkbox"><Checkbox checked={selected.has(row.barcode)} onChange={(event) => toggleOne(row.barcode, event.target.checked)} /></TableCell>
                    <TableCell align="center" sx={{ width: 56, color: '#64748B', fontWeight: 650 }}>{page * 50 + index + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 750, color: '#173B63', letterSpacing: 0.35 }}>{row.barcode}</TableCell>
                    <TableCell><Chip size="small" label={meta.label} color={meta.color} variant={row.status === 'AVAILABLE' ? 'outlined' : 'filled'} /></TableCell>
                    <TableCell>{row.factoryCode || '—'}</TableCell>
                    <TableCell>{row.year || '—'}</TableCell>
                    <TableCell>{Number(row.runningNumber || 0).toLocaleString()}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.batchId || '—'}</TableCell>
                    <TableCell>{Number(row.printCount || 0)}×</TableCell>
                    <TableCell>
                      {row.assignedCartonCode ? (
                        <Box>
                          <Typography variant="body2" fontWeight={850}>{row.assignedCartonCode}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            CTN {row.assignedCartonNumber ?? '—'} · Qty {row.assignedQuantity ?? row.assignedQtyPerCarton ?? '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{row.assignedBuyerCode || '—'} · {row.assignedOrderName || '—'}</Typography>
                        </Box>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{row.assignedPoNumber || row.assignedArticleNumber ? `${row.assignedPoNumber || '—'} / ${row.assignedArticleNumber || '—'}` : '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateTimeText(row.createdAt)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Button size="small" startIcon={<PrintOutlined />} onClick={() => printRows([row])} disabled={row.status === 'VOID' || printing} sx={{ textTransform: 'none', mr: 0.5 }}>Print</Button>
                      <Button size="small" color="error" startIcon={<BlockOutlined />} onClick={() => runVoid(row)} disabled={row.status !== 'AVAILABLE'} sx={{ textTransform: 'none' }}>Void</Button>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={13} align="center" sx={{ py: 8, color: 'text.secondary' }}>No Factory Barcodes found.</TableCell></TableRow>
              )}
            </TableBody>
          </SortableTable>
        </TableContainer>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.25, borderTop: '1px solid #E5E7EB' }}>
          <Typography variant="body2" color="text.secondary">Page {totalPages ? page + 1 : 0} / {totalPages}</Typography>
          <Pagination count={Math.max(1, totalPages)} page={Math.min(page + 1, Math.max(1, totalPages))} onChange={(_, value) => setPage(value - 1)} disabled={totalPages <= 1} />
        </Stack>
      </Paper>

      <Dialog open={generateOpen} onClose={generating ? undefined : () => setGenerateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 750 }}>Generate Factory Barcodes</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="info">
              Format: <strong>YY + Factory Code + 9-digit Running Number</strong>. Running numbers are allocated by the server and can never be reused.
            </Alert>
            <TextField type="number" label="Year" value={generateYear} onChange={(event) => setGenerateYear(Number(event.target.value))} inputProps={{ min: 2000, max: 2099 }} />
            <TextField label="Factory Code" value={generateFactoryCode} onChange={(event) => setGenerateFactoryCode(event.target.value.replace(/\D/g, '').slice(0, 3))} helperText="Exactly 3 digits, for example 002." />
            <TextField type="number" label="Quantity" value={generateQuantity} onChange={(event) => setGenerateQuantity(event.target.value)} inputProps={{ min: 1, max: 1000 }} />
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC' }}>
              <Typography variant="caption" color="text.secondary">Next Running Number</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 750, color: '#103B5C' }}>{sequence?.nextRunningNumber ? Number(sequence.nextRunningNumber).toLocaleString() : '—'}</Typography>
              <Typography variant="caption" color="text.secondary">Next Factory Barcode</Typography>
              <Typography sx={{ fontSize: '1.15rem', fontWeight: 750, letterSpacing: 1 }}>{sequence?.nextBarcode || '—'}</Typography>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateOpen(false)} disabled={generating}>Cancel</Button>
          <Button variant="contained" onClick={runGenerate} disabled={generating} startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AddOutlined />} sx={{ bgcolor: '#103B5C' }}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
