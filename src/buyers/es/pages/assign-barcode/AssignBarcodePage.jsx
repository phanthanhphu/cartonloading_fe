import SortableTable from 'components/SortableTable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {   Alert, Box, Button, Chip, CircularProgress, MenuItem, Pagination, Paper, Select, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import {   Inventory2Outlined, OpenInNewOutlined, QrCode2Outlined, RefreshOutlined, RestartAltOutlined, SearchOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { APP_MESSAGES } from '../../../../constants/appMessages';
import { listPackingOrders } from 'buyers/es/services/packingListService';
import { getApiError } from 'utils/apiError';
import { getAccessibleBuyers, readSelectedBuyer } from 'utils/buyerAccess';
import { readStoredUser } from 'utils/accessControl';
import { COMMON_PAGE_SIZE_OPTIONS, PROGRESS_STATUS, DEFAULT_TABLE_PAGE_SIZE } from '../../../../constants/appConstants';


const formatDate = (value) => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const label = (value) => String(value || PROGRESS_STATUS.NOT_STARTED).replaceAll('_', ' ');
const statusSx = (value) => {
  const status = String(value || '').toUpperCase();
  const colors = {
    COMPLETED: { color: '#126B42', backgroundColor: '#E6F5EE' },
    IN_PROGRESS: { color: '#7A4E00', backgroundColor: '#FFF4CC' },
    NOT_STARTED: { color: '#315C8A', backgroundColor: '#EDF4FB' }
  };
  return { height: 22, borderRadius: 999, fontWeight: 750, fontSize: '0.67rem', ...(colors[status] || { color: '#475569', backgroundColor: '#F1F5F9' }) };
};

export default function AssignBarcodePage() {
  const navigate = useNavigate();
  const buyers = useMemo(() => getAccessibleBuyers(readStoredUser()), []);
  const selectedBuyer = readSelectedBuyer();
  const initialBuyer = buyers.find((item) => item.code === selectedBuyer?.code) || buyers[0] || null;

  const buyerCode = initialBuyer?.code || '';
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState('');
  const [appliedAssignmentStatus, setAppliedAssignmentStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
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
      setError(getApiError(requestError, APP_MESSAGES.LOAD_BARCODE_ASSIGNMENT_ORDERS_FAILED));
    } finally {
      setLoading(false);
    }
  }, [buyerCode, appliedKeyword, appliedAssignmentStatus, page, pageSize]);

  useEffect(() => { load(); }, [load]);

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

  if (!buyers.length) {
    return <Box sx={{ p: 1 }}><Alert severity="warning">{APP_MESSAGES.NO_BUYER_WORKSPACE}</Alert></Box>;
  }

  const assigned = rows.reduce((sum, row) => sum + Number(row.assignedCartonCount || 0), 0);
  const cartons = rows.reduce((sum, row) => sum + Number(row.plannedCartonCount || 0), 0);
  const completedOrders = rows.filter((row) => row.assignmentStatus === PROGRESS_STATUS.COMPLETED).length;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <Box sx={{ p: { xs: 0.25, sm: 0.4, md: 0.5 } }}>
      {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}

      <Paper elevation={0} sx={{ border: '1px solid #DCE4EC', borderRadius: 1.75, overflow: 'hidden', bgcolor: '#FFFFFF' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.8} alignItems={{ lg: 'center' }} sx={{ p: 1, borderBottom: '1px solid #DCE4EC' }}>
          <TextField size="small" label="Search Order" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applySearch()} sx={{ flex: 1, minWidth: { lg: 260 } }} />
          <TextField select size="small" label="Barcode Assignment Status" value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value)} sx={{ minWidth: { lg: 170 } }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value={PROGRESS_STATUS.NOT_STARTED}>Not Started</MenuItem>
            <MenuItem value={PROGRESS_STATUS.IN_PROGRESS}>In Progress</MenuItem>
            <MenuItem value={PROGRESS_STATUS.COMPLETED}>Completed</MenuItem>
          </TextField>
          <Button variant="contained" startIcon={<SearchOutlined />} onClick={applySearch} disabled={loading}>Search</Button>
          <Button variant="outlined" startIcon={<RestartAltOutlined />} onClick={resetSearch} disabled={loading}>Reset</Button>
          <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={load} disabled={loading}>Refresh</Button>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 0.75, p: 0.85, borderBottom: '1px solid #E7EDF3', bgcolor: '#F8FAFC' }}>
          {[
            ['Orders on page', rows.length, <QrCode2Outlined key="a" />],
            ['Physical cartons', cartons.toLocaleString('en-US'), <Inventory2Outlined key="b" />],
            ['Barcode Assigned', `${assigned.toLocaleString('en-US')} / ${cartons.toLocaleString('en-US')}`, <QrCode2Outlined key="c" />],
            ['Assignment completed', completedOrders.toLocaleString('en-US'), <QrCode2Outlined key="d" />]
          ].map(([title, value, icon]) => (
            <Stack key={title} direction="row" spacing={0.8} alignItems="center" sx={{ p: 0.8, bgcolor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 1.35 }}>
              <Box sx={{ color: '#0A6ED1', display: 'grid', placeItems: 'center', '& svg': { fontSize: 20 } }}>{icon}</Box>
              <Box>
                <Typography sx={{ fontSize: '0.67rem', color: '#71849A', fontWeight: 650 }}>{title}</Typography>
                <Typography sx={{ fontSize: '0.92rem', color: '#173B63', fontWeight: 800 }}>{value}</Typography>
              </Box>
            </Stack>
          ))}
        </Box>

        <TableContainer sx={{ maxHeight: 'calc(100vh - 245px)', minHeight: 360 }}>
          <SortableTable stickyHeader size="small" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                {['No.', 'Start Order', 'End Order', 'Order', 'Physical Cartons', 'Assigned', 'Not Assigned', 'Barcode Assignment Status', 'Action'].map((title) => (
                  <TableCell key={title} sx={{ bgcolor: '#F3F7FA', fontWeight: 750, whiteSpace: 'nowrap' }}>{title}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5 }}><CircularProgress size={24} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>No Orders match the selected barcode assignment filter.</TableCell></TableRow>
              ) : rows.map((row, index) => (
                <TableRow key={row.id} hover>
                  <TableCell align="center" sx={{ width: 56, color: '#64748B', fontWeight: 650 }}>{page * pageSize + index + 1}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.orderDate)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.endOrderDate)}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: '0.79rem', color: '#173B63', fontWeight: 800 }}>{row.orderName}</Typography>
                    <Typography sx={{ fontSize: '0.67rem', color: '#8291A3' }}>{row.productionFacility || row.supplierName || '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>{Number(row.plannedCartonCount || 0).toLocaleString('en-US')}</TableCell>
                  <TableCell sx={{ color: '#168052', fontWeight: 800 }}>{Number(row.assignedCartonCount || 0).toLocaleString('en-US')}</TableCell>
                  <TableCell sx={{ color: Number(row.unassignedCartonCount || 0) > 0 ? '#C77B00' : '#64748B', fontWeight: 800 }}>{Number(row.unassignedCartonCount || 0).toLocaleString('en-US')}</TableCell>
                  <TableCell><Chip label={label(row.assignmentStatus)} sx={statusSx(row.assignmentStatus)} /></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<OpenInNewOutlined />}
                      onClick={() => buyer && navigate(`/assign-barcode/${buyer.slug}/${row.id}`)}
                      sx={{ minWidth: 145, textTransform: 'none', fontWeight: 750 }}
                    >
                      {row.assignmentStatus === PROGRESS_STATUS.COMPLETED ? 'Review Assignment' : 'Assign Barcode'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </SortableTable>
        </TableContainer>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ px: 1, py: 0.75, borderTop: '1px solid #DCE4EC' }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Typography sx={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Showing {from}-{to} of {total}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#94A3B8' }}>Rows</Typography>
            <Select size="small" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} sx={{ height: 30, minWidth: 72 }}>
              {COMMON_PAGE_SIZE_OPTIONS.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}
            </Select>
          </Stack>
          <Pagination size="small" page={page + 1} count={totalPages} onChange={(_, next) => setPage(next - 1)} shape="rounded" />
        </Stack>
      </Paper>
    </Box>
  );
}
