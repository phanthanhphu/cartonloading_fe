import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { CalendarMonthOutlined, DeleteOutline, LockOpenOutlined, Refresh, TaskAltOutlined, VisibilityOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { canManageShipping, canCreateShippingSchedule, canReopenShippingSchedule } from 'utils/accessControl';
import { deletePoShippingDay, listPoShippingDays, submitPoShippingDay, unsubmitPoShippingDay } from '../services/shipping';
import ShippingSchedulePoPicker from './ShippingSchedulePoPicker';

const errorText = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const displayDate = (date) => String(date || '').split('-').reverse().join('/');
const todayInVietnam = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

/** Tab 2 is ONLY the Shipping Date list. View opens a dedicated PO table page. */
export default function ShippingSchedulesTab({ orderId, factoryCode, factoryLoading, creating, onCloseCreating, visibleColumns }) {
  const writable = canManageShipping();
  const canCreate = canCreateShippingSchedule();
  const canReopen = canReopenShippingSchedule();
  const navigate = useNavigate();
  const [days, setDays] = useState([]);
  const columnsToShow = new Set(Array.isArray(visibleColumns) ? visibleColumns : ['stt', 'shippingDate', 'poCount', 'status', 'action']);
  columnsToShow.add('shippingDate');
  columnsToShow.add('action');
  const visibleColumnCount = ['stt', 'shippingDate', 'poCount', 'status', 'action'].filter((key) => columnsToShow.has(key)).length;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleting, setDeleting] = useState('');
  const [changingStatus, setChangingStatus] = useState('');
  const requestRef = useRef(0);
  const knownDates = useMemo(() => days.map((item) => item.shippingDate), [days]);

  const loadDays = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!orderId || factoryLoading || !factoryCode) {
      setDays([]); setLoading(false); return;
    }
    setLoading(true); setError('');
    try {
      const data = await listPoShippingDays(orderId, factoryCode);
      if (requestId === requestRef.current) setDays(Array.isArray(data) ? data : []);
    } catch (e) {
      if (requestId === requestRef.current) {
        setError(errorText(e, 'Unable to load Shipping Schedules.'));
        setDays([]);
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [orderId, factoryCode, factoryLoading]);

  useEffect(() => {
    loadDays();
    return () => { requestRef.current += 1; };
  }, [loadDays]);

  // One refresh at midnight in Vietnam; no continuous polling.
  useEffect(() => {
    if (!factoryCode || factoryLoading) return undefined;
    const [year, month, date] = todayInVietnam().split('-').map(Number);
    const nextMidnight = Date.UTC(year, month - 1, date, 17, 0, 1);
    const timer = window.setTimeout(() => loadDays(), Math.max(1000, nextMidnight - Date.now()));
    return () => window.clearTimeout(timer);
  }, [loadDays, days, factoryCode, factoryLoading]);

  const deleteDay = async (day) => {
    if (!writable || deleting || changingStatus || !day || days.find((item) => item.shippingDate === day)?.submitted) return;
    if (!window.confirm(`Delete Shipping Schedule ${displayDate(day)}? This only removes its PO memberships; original POs and cartons are kept.`)) return;
    setDeleting(day); setError(''); setSuccess('');
    try {
      await deletePoShippingDay(orderId, day, factoryCode);
      await loadDays();
      setSuccess(`Shipping Schedule ${displayDate(day)} deleted. Original POs and cartons were kept.`);
    } catch (e) {
      setError(errorText(e, 'Unable to delete this Shipping Schedule.'));
      await loadDays();
    } finally { setDeleting(''); }
  };

  const changeStatus = async (entry, action) => {
    if (changingStatus || deleting || !entry || (action === 'unsubmit' ? !canReopen : !writable)) return;
    if (action === 'submit' ? entry.submitted : !entry.submitted) return;
    const verb = action === 'submit' ? 'Submit' : 'Unsubmit';
    if (!window.confirm(`${verb} Shipping Schedule ${displayDate(entry.shippingDate)}? ${action === 'submit'
      ? 'After submission, PO assignments will be locked until an authorized user Unsubmits.'
      : 'This will unlock PO assignments until it is submitted again.'}`)) return;
    setChangingStatus(entry.shippingDate); setError(''); setSuccess('');
    try {
      if (action === 'submit') await submitPoShippingDay(orderId, entry.shippingDate, factoryCode);
      else await unsubmitPoShippingDay(orderId, entry.shippingDate, factoryCode);
      await loadDays();
      setSuccess(`Shipping Schedule ${displayDate(entry.shippingDate)} ${action === 'submit' ? 'submitted' : 'unsubmitted'} successfully.`);
    } catch (e) {
      setError(errorText(e, `Unable to ${action} this Shipping Schedule.`));
      await loadDays();
    } finally { setChangingStatus(''); }
  };

  const viewDay = (day) => {
    if (!day) return;
    navigate(`/buyers/lululemon/orders/${encodeURIComponent(orderId)}/shipping-schedules/${encodeURIComponent(day)}`);
  };

  return <Box sx={{ p: { xs: 0.5, md: 0.75 } }}><Stack spacing={1}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography variant="subtitle1" fontWeight={800}>Shipping Schedules</Typography>
        <Chip size="small" variant="outlined" label={loading ? 'Loading…' : `${days.length} Schedule${days.length === 1 ? '' : 's'}`} />
      </Stack>
      <Tooltip title="Refresh Shipping Schedules"><span>
        <IconButton size="small" disabled={loading || !factoryCode || factoryLoading} onClick={loadDays}>
          {loading ? <CircularProgress size={18} /> : <Refresh fontSize="small" />}
        </IconButton>
      </span></Tooltip>
    </Stack>
    {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
    {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
    <TableContainer sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <Table size="small"><TableHead><TableRow sx={{ bgcolor: 'action.hover' }}>
        {columnsToShow.has('stt') && <TableCell sx={{ fontWeight: 800 }}>STT</TableCell>}
        <TableCell sx={{ fontWeight: 800 }}>Shipping Date</TableCell>
        {columnsToShow.has('poCount') && <TableCell sx={{ fontWeight: 800 }}>Total POs</TableCell>}
        {columnsToShow.has('status') && <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>}
        <TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell>
      </TableRow></TableHead><TableBody>
        {days.map((entry, index) => (
          <TableRow key={`${entry.factoryCode}-${entry.shippingDate}`} hover>
            {columnsToShow.has('stt') && <TableCell>{index + 1}</TableCell>}
            <TableCell><Stack direction="row" spacing={1} alignItems="center">
              <CalendarMonthOutlined fontSize="small" color="action" />
              <Typography fontWeight={750}>{displayDate(entry.shippingDate)}</Typography>
            </Stack></TableCell>
            {columnsToShow.has('poCount') && <TableCell>{entry.poCount} PO{entry.poCount === 1 ? '' : 's'}</TableCell>}
            {columnsToShow.has('status') && <TableCell><Chip size="small" color={entry.submitted ? 'success' : 'default'}
              variant={entry.submitted ? 'filled' : 'outlined'}
              label={entry.submitted ? (entry.autoSubmitted ? 'Submitted (Auto)' : 'Submitted')
                : (entry.reopened ? 'Unsubmitted' : 'Draft')} /></TableCell>}
            <TableCell align="right"><Stack direction="row" justifyContent="flex-end" spacing={0.5}>
              <Tooltip title="Open full PO table for this Shipping Schedule"><span>
                <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => viewDay(entry.shippingDate)}>View</Button>
              </span></Tooltip>
              {writable && !entry.submitted && <Button size="small" variant="outlined" startIcon={<TaskAltOutlined />}
                disabled={Boolean(changingStatus || deleting)} onClick={() => changeStatus(entry, 'submit')}>
                {changingStatus === entry.shippingDate ? 'Working…' : 'Submit'}
              </Button>}
              {canReopen && entry.submitted && <Button size="small" color="warning" variant="outlined"
                startIcon={<LockOpenOutlined />} disabled={Boolean(changingStatus || deleting)}
                onClick={() => changeStatus(entry, 'unsubmit')}>
                {changingStatus === entry.shippingDate ? 'Working…' : 'Unsubmit'}
              </Button>}
              {writable && <Tooltip title={entry.submitted ? 'Unsubmit first to unlock.' : 'Delete this Schedule only; keep source POs'}><span>
                <IconButton size="small" color="error" disabled={entry.submitted || Boolean(deleting || changingStatus)}
                  onClick={() => deleteDay(entry.shippingDate)} aria-label={`Delete Shipping Schedule ${displayDate(entry.shippingDate)}`}>
                  {deleting === entry.shippingDate ? <CircularProgress size={18} /> : <DeleteOutline fontSize="small" />}
                </IconButton>
              </span></Tooltip>}
            </Stack></TableCell>
          </TableRow>
        ))}
        {!loading && !days.length && <TableRow><TableCell align="center" colSpan={visibleColumnCount} sx={{ py: 4 }}>
          No Shipping Schedules yet. Choose New Schedule to select a Shipping Date and POs.
        </TableCell></TableRow>}
        {loading && <TableRow><TableCell align="center" colSpan={visibleColumnCount}><CircularProgress size={22} /></TableCell></TableRow>}
      </TableBody></Table>
    </TableContainer>
    <ShippingSchedulePoPicker open={Boolean(creating) && canCreate} orderId={orderId} factoryCode={factoryCode}
      knownDates={knownDates} onClose={onCloseCreating}
      onSaved={async (date, result) => {
        onCloseCreating(); await loadDays();
        setSuccess(`Saved ${result?.scheduledCount ?? 0} PO(s) to Shipping Schedule ${displayDate(date)}.`);
      }} />
  </Stack></Box>;
}
