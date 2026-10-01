import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
  Tooltip,
  Typography
} from '@mui/material';
import {
  CheckCircleOutlineOutlined,
  PlayArrowOutlined,
  RefreshOutlined,
  RestartAltOutlined,
  SearchOutlined,
  ScaleOutlined
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { listPackingOrders } from 'buyers/es/services/packingListService';
import { getApiError } from 'utils/apiError';
import { getAccessibleBuyers, readSelectedBuyer, saveSelectedBuyer } from 'utils/buyerAccess';
import { readStoredUser } from 'utils/accessControl';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const formatDate = (value) => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const statusLabel = (value) => String(value || 'NOT_STARTED').replaceAll('_', ' ');
const statusChipSx = (value) => {
  const status = String(value || '').toUpperCase();
  const palette = {
    COMPLETED: { color: '#126B42', backgroundColor: '#E6F5EE' },
    IN_PROGRESS: { color: '#7A4E00', backgroundColor: '#FFF4CC' },
    NOT_STARTED: { color: '#315C8A', backgroundColor: '#EDF4FB' }
  };
  return {
    height: 22,
    borderRadius: 999,
    fontSize: '0.67rem',
    fontWeight: 750,
    ...(palette[status] || { color: '#475569', backgroundColor: '#F1F5F9' })
  };
};

const progressText = (done, total) => `${Number(done || 0).toLocaleString('en-US')} / ${Number(total || 0).toLocaleString('en-US')}`;

export default function WeightCheckPage() {
  const navigate = useNavigate();
  const buyers = useMemo(() => getAccessibleBuyers(readStoredUser()), []);
  const selectedBuyer = readSelectedBuyer();
  const initialBuyer = buyers.find((item) => item.code === selectedBuyer?.code) || buyers[0] || null;

  const [buyerCode, setBuyerCode] = useState(initialBuyer?.code || '');
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState('');
  const [appliedAssignmentStatus, setAppliedAssignmentStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buyer = useMemo(() => buyers.find((item) => item.code === buyerCode) || null, [buyers, buyerCode]);

  const load = useCallback(async () => {
    if (!buyerCode) return;
    setLoading(true);
    setError('');
    try {
      const data = await listPackingOrders(buyerCode, {
        keyword: appliedKeyword || undefined,
        assignmentStatus: appliedAssignmentStatus || undefined,
        page,
        size: pageSize
      });
      setRows(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
      setTotal(Number(data?.totalElements || 0));
    } catch (requestError) {
      setRows([]);
      setError(getApiError(requestError, 'Unable to load Orders for Weight Check.'));
    } finally {
      setLoading(false);
    }
  }, [buyerCode, appliedKeyword, appliedAssignmentStatus, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const changeBuyer = (value) => {
    const next = buyers.find((item) => item.code === value);
    if (next) saveSelectedBuyer(next);
    setBuyerCode(value);
    setPage(0);
  };

  const applySearch = () => {
    setAppliedKeyword(keyword.trim());
    setAppliedAssignmentStatus(assignmentStatus);
    setPage(0);
  };

  const resetSearch = () => {
    setKeyword('');
    setAssignmentStatus('');
    setAppliedKeyword('');
    setAppliedAssignmentStatus('');
    setPage(0);
  };

  const openWeightCheck = (row) => {
    const planned = Number(row?.plannedCartonCount || 0);
    const weightStarted = String(row?.weightStatus || 'NOT_STARTED') !== 'NOT_STARTED';
    const canOpen = planned > 0 && (row?.assignmentStatus === 'COMPLETED' || weightStarted);
    if (!buyer || !canOpen) return;
    navigate(`/buyers/${buyer.slug}/orders/${row.id}/weight-check`);
  };

  if (!buyers.length) {
    return <Box sx={{ p: 1 }}><Alert severity="warning">No Buyer workspace is available for this user.</Alert></Box>;
  }

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const pageAssigned = rows.reduce((sum, row) => sum + Number(row.assignedCartonCount || 0), 0);
  const pageCartons = rows.reduce((sum, row) => sum + Number(row.plannedCartonCount || 0), 0);
  const pagePass = rows.reduce((sum, row) => sum + Number(row.passWeightCartonCount || 0), 0);
  const pageFail = rows.reduce((sum, row) => sum + Number(row.failWeightCartonCount || 0), 0);

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.4, md: 0.5 } }}>
      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}

      <Paper elevation={0} sx={{ border: '1px solid #DCE4EC', borderRadius: 1.75, overflow: 'hidden', bgcolor: '#FFFFFF' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.8} alignItems={{ lg: 'center' }} sx={{ p: 1, borderBottom: '1px solid #DCE4EC' }}>
          <TextField select size="small" label="Buyer" value={buyerCode} onChange={(event) => changeBuyer(event.target.value)} sx={{ minWidth: { lg: 190 } }}>
            {buyers.map((item) => <MenuItem key={item.code} value={item.code}>{item.label}</MenuItem>)}
          </TextField>
          <TextField
            size="small"
            label="Search Order"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applySearch()}
            placeholder="Order name, status, user..."
            sx={{ flex: 1, minWidth: { lg: 260 } }}
          />
          <TextField select size="small" label="Assignment Status" value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value)} sx={{ minWidth: { lg: 175 } }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
            <MenuItem value="NOT_STARTED">Not Started</MenuItem>
          </TextField>
          <Button variant="contained" startIcon={<SearchOutlined />} onClick={applySearch} disabled={loading}>Search</Button>
          <Button variant="outlined" startIcon={<RestartAltOutlined />} onClick={resetSearch} disabled={loading}>Reset</Button>
          <Tooltip title="Refresh current data"><span><Button variant="outlined" startIcon={<RefreshOutlined />} onClick={load} disabled={loading}>Refresh</Button></span></Tooltip>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 0.75, p: 0.85, borderBottom: '1px solid #E7EDF3', bgcolor: '#F8FAFC' }}>
          {[
            ['Orders on page', rows.length, <ScaleOutlined key="a" fontSize="small" />],
            ['Assigned cartons', `${pageAssigned.toLocaleString('en-US')} / ${pageCartons.toLocaleString('en-US')}`, <CheckCircleOutlineOutlined key="b" fontSize="small" />],
            ['Weight PASS', pagePass.toLocaleString('en-US'), <CheckCircleOutlineOutlined key="c" fontSize="small" />],
            ['Weight FAIL', pageFail.toLocaleString('en-US'), <ScaleOutlined key="d" fontSize="small" />]
          ].map(([label, value, icon]) => (
            <Stack key={label} direction="row" spacing={0.8} alignItems="center" sx={{ p: 0.8, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 1.35 }}>
              <Box sx={{ color: '#0A6ED1', display: 'grid', placeItems: 'center' }}>{icon}</Box>
              <Box>
                <Typography sx={{ fontSize: '0.67rem', color: '#71849A', fontWeight: 650 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.92rem', color: '#173B63', fontWeight: 800 }}>{value}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>

        <TableContainer sx={{ maxHeight: 'calc(100vh - 245px)', minHeight: 360 }}>
          <SortableTable stickyHeader size="small" sx={{ minWidth: 1180 }}>
            <TableHead>
              <TableRow>
                {['No.', 'Start Order', 'End Order', 'Order', 'Assign Status', 'Assign Progress', 'Weight Status', 'Weight Progress', 'PASS / FAIL', 'Action'].map((label) => (
                  <TableCell key={label} sx={{ whiteSpace: 'nowrap', bgcolor: '#F3F7FA', fontWeight: 750 }}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} align="center" sx={{ py: 5 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} align="center" sx={{ py: 5, color: 'text.secondary' }}>No Orders match the selected Weight Check filter.</TableCell></TableRow>
              ) : rows.map((row, index) => {
                const planned = Number(row.plannedCartonCount || 0);
                const assignmentReady = row.assignmentStatus === 'COMPLETED' && planned > 0;
                const weightStarted = String(row.weightStatus || 'NOT_STARTED') !== 'NOT_STARTED';
                const weightAvailable = planned > 0 && (assignmentReady || weightStarted);
                const weighed = Number(row.completedCartonCount || 0);
                return (
                  <TableRow key={row.id} hover>
                    <TableCell align="center" sx={{ width: 56, color: '#64748B', fontWeight: 650 }}>{page * pageSize + index + 1}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.orderDate)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.endOrderDate)}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.79rem', color: '#173B63', fontWeight: 800 }}>{row.orderName}</Typography>
                      <Typography sx={{ fontSize: '0.67rem', color: '#8291A3' }}>{row.productionFacility || row.supplierName || '—'}</Typography>
                    </TableCell>
                    <TableCell><Chip label={statusLabel(row.assignmentStatus)} sx={statusChipSx(row.assignmentStatus)} /></TableCell>
                    <TableCell sx={{ fontWeight: 750 }}>{progressText(row.assignedCartonCount, row.plannedCartonCount)}</TableCell>
                    <TableCell><Chip label={statusLabel(row.weightStatus)} sx={statusChipSx(row.weightStatus)} /></TableCell>
                    <TableCell sx={{ fontWeight: 750 }}>{progressText(weighed, row.plannedCartonCount)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Typography component="span" sx={{ color: '#168052', fontWeight: 800, fontSize: '0.76rem' }}>{Number(row.passWeightCartonCount || 0).toLocaleString('en-US')}</Typography>
                      <Typography component="span" sx={{ color: '#94A3B8', mx: 0.7 }}>/</Typography>
                      <Typography component="span" sx={{ color: '#C73A3A', fontWeight: 800, fontSize: '0.76rem' }}>{Number(row.failWeightCartonCount || 0).toLocaleString('en-US')}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={weightAvailable ? (assignmentReady ? 'Open Weight Check for this Order' : 'Weight Check is already in progress; continue assigned cartons while carton-level correction is completed') : 'Complete barcode assignment for all physical cartons before starting Weight Check'}>
                        <span>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<PlayArrowOutlined />}
                            disabled={!weightAvailable}
                            onClick={() => openWeightCheck(row)}
                            sx={{ minWidth: 132, textTransform: 'none', fontWeight: 750 }}
                          >
                            {row.weightStatus === 'NOT_STARTED' ? 'Start Weight' : row.weightStatus === 'COMPLETED' ? 'View Weight' : 'Continue'}
                          </Button>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </SortableTable>
        </TableContainer>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ px: 1, py: 0.75, borderTop: '1px solid #DCE4EC' }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Typography sx={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Showing {from}-{to} of {total}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#94A3B8' }}>Rows</Typography>
            <Select size="small" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} sx={{ height: 30, minWidth: 72 }}>
              {PAGE_SIZE_OPTIONS.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
            </Select>
          </Stack>
          <Pagination size="small" page={page + 1} count={totalPages} onChange={(_, next) => setPage(next - 1)} shape="rounded" />
        </Stack>
      </Paper>
    </Box>
  );
}
