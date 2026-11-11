import { managementPageSx, managementStackSx, managementTableViewportSx } from 'components/ManagementViewportStyles';
import { tableScrollbarSx } from 'components/TableScrollbarStyles';
import useAutoDismissFeedback from '../../../hooks/useAutoDismissFeedback';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { Add, ArrowBack, CalendarMonthOutlined, ChevronRight, DeleteOutline, LockOpenOutlined, Refresh, TaskAltOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { BUYER_CODE } from '../../../constants/appConstants';
import { canManageShipping, canCreateShippingSchedule, canReopenShippingSchedule } from 'utils/accessControl';
import { useSelectedFactory } from 'utils/factorySelection';
import { deletePoShippingDay, listPoShippingDays, submitPoShippingDay, unsubmitPoShippingDay } from '../services/shipping';
import ShippingSchedulePoPicker from '../components/ShippingSchedulePoPicker';

const errText = (e, fallback) => e?.response?.data?.message || e?.message || fallback;
const showDate = (date) => String(date || '').split('-').reverse().join('/');
const todayInVietnam = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

/** Dedicated list page. Creating a Shipping Schedule always returns here. */
export default function ShippingSchedulesPage() {
  const { buyerSlug, orderId } = useParams();
  const navigate = useNavigate();
  const { factoryCode, loading: factoryLoading } = useSelectedFactory(BUYER_CODE.LULULEMON);
  const writable = canManageShipping();
  const canCreate = canCreateShippingSchedule();
  const canReopen = canReopenShippingSchedule();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const [success, setSuccess] = useState('');
  useAutoDismissFeedback(success, setSuccess, '', 'success');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [changingStatus, setChangingStatus] = useState('');
  const basePath = `/buyers/${buyerSlug}/orders/${orderId}`;
  const knownDates = useMemo(() => days.map((day) => day.shippingDate), [days]);

  const load = useCallback(async () => {
    if (!factoryCode || factoryLoading) { setDays([]); return; }
    setLoading(true); setError('');
    try { setDays(await listPoShippingDays(orderId, factoryCode)); }
    catch (e) { setError(errText(e, 'Unable to load Shipping Schedules.')); setDays([]); }
    finally { setLoading(false); }
  }, [orderId, factoryCode, factoryLoading]);
  useEffect(() => { load(); }, [load]);

  // One refresh at midnight in Vietnam; no continuous polling.
  useEffect(() => {
    if (!factoryCode || factoryLoading) return undefined;
    const [year, month, date] = todayInVietnam().split('-').map(Number);
    const nextMidnight = Date.UTC(year, month - 1, date, 17, 0, 1);
    const timer = window.setTimeout(() => load(), Math.max(1000, nextMidnight - Date.now()));
    return () => window.clearTimeout(timer);
  }, [load, days, factoryCode, factoryLoading]);

  const deleteDay = async (event, day) => {
    event.stopPropagation();
    if (!writable || deleting || changingStatus || days.find((entry) => entry.shippingDate === day)?.submitted) return;
    if (!window.confirm(`Delete the entire Shipping Schedule ${showDate(day)}? Only schedule memberships will be removed; source POs and cartons are kept.`)) return;
    setDeleting(day); setError(''); setSuccess('');
    try {
      await deletePoShippingDay(orderId, day, factoryCode);
      await load();
      setSuccess(`Shipping Schedule ${showDate(day)} deleted. Original POs and cartons were kept.`);
    } catch (e) { setError(errText(e, 'Unable to delete Shipping Schedule.')); await load(); }
    finally { setDeleting(''); }
  };

  const changeStatus = async (event, entry, action) => {
    event.stopPropagation();
    if (changingStatus || deleting || !entry || (action === 'unsubmit' ? !canReopen : !writable)) return;
    if (action === 'submit' ? entry.submitted : !entry.submitted) return;
    const verb = action === 'submit' ? 'Submit' : 'Unsubmit';
    if (!window.confirm(`${verb} Shipping Schedule ${showDate(entry.shippingDate)}? ${action === 'submit'
      ? 'PO assignments will be locked until an authorized user Unsubmits.'
      : 'PO assignments will be unlocked until submitted again.'}`)) return;
    setChangingStatus(entry.shippingDate); setError(''); setSuccess('');
    try {
      if (action === 'submit') await submitPoShippingDay(orderId, entry.shippingDate, factoryCode);
      else await unsubmitPoShippingDay(orderId, entry.shippingDate, factoryCode);
      await load();
      setSuccess(`Shipping Schedule ${showDate(entry.shippingDate)} ${action === 'submit' ? 'submitted' : 'unsubmitted'} successfully.`);
    } catch (e) { setError(errText(e, `Unable to ${action} Shipping Schedule.`)); await load(); }
    finally { setChangingStatus(''); }
  };

  return <Box sx={{ p: { xs: 1, md: 2 }, ...managementPageSx }}>
    <Stack spacing={1.5} sx={managementStackSx}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Button size="small" startIcon={<ArrowBack />} onClick={() => navigate(basePath)}>All POs</Button>
          <Box>
            <Typography variant="h5" fontWeight={850}>Shipping Schedules</Typography>
            <Typography variant="caption" color="text.secondary">{factoryCode || 'Select a Factory'} · One item per Shipping Date</Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1}>
          <Tooltip title="Refresh Shipping Schedules"><span><IconButton disabled={loading || !factoryCode} onClick={load}>
            {loading ? <CircularProgress size={20} /> : <Refresh />}
          </IconButton></span></Tooltip>
          {canCreate && <Button variant="contained" size="small" startIcon={<Add />}
            disabled={!factoryCode || factoryLoading || Boolean(deleting)} onClick={() => { setSuccess(''); setCreating(true); }}>
            New Schedule
          </Button>}
        </Stack>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
      <TableContainer sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: '4px', overflowX: 'auto', ...managementTableViewportSx, ...tableScrollbarSx }}>
        <Table size="small" stickyHeader><TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
          <TableCell sx={{ fontWeight: 800 }}>Shipping Date</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>POs</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Factory</TableCell>
          <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
          <TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell>
        </TableRow></TableHead><TableBody>
          {days.map((day) => {
            return <TableRow key={`${day.factoryCode}-${day.shippingDate}`} hover
              onClick={() => navigate(`${basePath}/shipping-schedules/${day.shippingDate}`)}
              sx={{ cursor: 'pointer' }}>
              <TableCell><Stack direction="row" alignItems="center" gap={1}>
                <CalendarMonthOutlined fontSize="small" color="action" />
                <Typography fontWeight={750}>{showDate(day.shippingDate)}</Typography>
              </Stack></TableCell>
              <TableCell><Chip size="small" label={`${day.poCount} PO${day.poCount === 1 ? '' : 's'}`} /></TableCell>
              <TableCell>{day.factoryCode}</TableCell>
              <TableCell><Chip size="small" color={day.submitted ? 'success' : 'default'}
                variant={day.submitted ? 'filled' : 'outlined'}
                label={day.submitted ? (day.autoSubmitted ? 'Submitted (Auto)' : 'Submitted')
                  : (day.reopened ? 'Unsubmitted' : 'Draft')} /></TableCell>
              <TableCell align="right"><Stack direction="row" alignItems="center" justifyContent="flex-end" gap={1}>
                {writable && !day.submitted && <Button size="small" variant="outlined" startIcon={<TaskAltOutlined />}
                  disabled={Boolean(changingStatus || deleting)} onClick={(event) => changeStatus(event, day, 'submit')}>
                  {changingStatus === day.shippingDate ? 'Working…' : 'Submit'}
                </Button>}
                {canReopen && day.submitted && <Button size="small" color="warning" variant="outlined"
                  startIcon={<LockOpenOutlined />} disabled={Boolean(changingStatus || deleting)}
                  onClick={(event) => changeStatus(event, day, 'unsubmit')}>
                  {changingStatus === day.shippingDate ? 'Working…' : 'Unsubmit'}
                </Button>}
                {writable && <Tooltip title={day.submitted ? 'Unsubmit first to unlock.' : 'Delete this Shipping Schedule (POs are kept)'}>
                  <span><IconButton size="small" color="error" disabled={day.submitted || Boolean(deleting || changingStatus)}
                    onClick={(event) => deleteDay(event, day.shippingDate)} aria-label={`Delete Shipping Schedule ${showDate(day.shippingDate)}`}>
                    {deleting === day.shippingDate ? <CircularProgress size={18} /> : <DeleteOutline fontSize="small" />}
                  </IconButton></span>
                </Tooltip>}
                <ChevronRight fontSize="small" color="action" />
              </Stack></TableCell>
            </TableRow>;
          })}
          {!loading && !days.length ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>
            No Shipping Schedules yet. Choose New Schedule to select a date and POs.
          </TableCell></TableRow> : null}
          {loading ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={22} /></TableCell></TableRow> : null}
        </TableBody></Table>
      </TableContainer>
    </Stack>
    <ShippingSchedulePoPicker open={creating && canCreate} orderId={orderId} factoryCode={factoryCode} knownDates={knownDates}
      onClose={() => setCreating(false)} onSaved={async (day, result) => {
        setCreating(false);
        await load();
        setSuccess(`Saved ${result?.scheduledCount ?? 0} PO(s) to Shipping Schedule ${showDate(day)}.`);
      }} />
  </Box>;
}
