import { useT, useSystemMessage } from '../../i18n/LanguageProvider';
import { managementPageSx, managementStackSx } from 'components/ManagementViewportStyles';
import useAutoDismissFeedback from '../../hooks/useAutoDismissFeedback';
import { useEffect, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography
} from '@mui/material';
import { Close, ExpandMore, Refresh, Visibility } from '@mui/icons-material';
import ManagementTable from 'components/ManagementTable';
import TableFilterBar from 'components/TableFilterBar';
import { getAuditLog, listAuditLogs } from 'services/adminService';
import { isAdmin, getFactoryPermissions } from 'utils/accessControl';
import { useSelectedFactory } from 'utils/factorySelection';
import { readJwtSession } from 'utils/systemTypes';
import { BUYER_CODE, BUYER_LABEL, DEFAULT_TABLE_PAGE_SIZE } from '../../constants/appConstants';
import { normalizeBuyerCode } from 'utils/buyerAccess';
import {
  AUDIT_ACTION_FILTER_OPTIONS, AUDIT_MODULE_FILTER_OPTIONS,
  auditActionLabel, auditChangeRows, auditDateTime, auditFieldLabel,
  auditLogStatus, auditModuleLabel, auditReference, auditSnapshotType,
  auditValueText, quickDateRange
} from './auditLogDisplay';

const initialFilters = {
  username: '', factoryCode: '', action: '', resourceType: '', resourceId: '',
  result: '', fromDate: '', toDate: ''
};

const datePresets = [
  { days: 0, label: 'All time' }, { days: 1, label: 'Today' },
  { days: 7, label: '7 days' }, { days: 30, label: '30 days' }
];

function operationStatus(row, trUi) {
  const { label, color } = auditLogStatus(row.result);
  return <Tooltip title={trUi("Audit recording status. 'Recorded' means the activity was saved, not that RFID, QC or Weight passed.")}>
    <Chip size="small" variant="outlined" color={color} label={trUi(label)} />
  </Tooltip>;
}

function AuditActivity({ row }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const action = auditActionLabel(row.action, row.description);
  return <Box sx={{ minWidth: 0 }}>
    <Tooltip title={row.action || action} placement="top-start">
      <Typography variant="body2" fontWeight={750} sx={{ lineHeight: 1.4 }}>{trUi(action)}</Typography>
    </Tooltip>
    {row.description ? <Tooltip title={trSystem(row.description)} placement="top-start">
      <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.45, mt: 0.2 }}>
        {trSystem(row.description)}
      </Typography>
    </Tooltip> : <Typography variant="caption" color="text.disabled">{trUi("No description recorded")}</Typography>}
  </Box>;
}

export default function AuditLogPage() {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const admin = isAdmin();
  const factories = getFactoryPermissions();
  const sessionBuyer = normalizeBuyerCode(readJwtSession().buyer);
  const buyerLabel = BUYER_LABEL[sessionBuyer] || sessionBuyer;
  const isLululemonUser = !admin && sessionBuyer === BUYER_CODE.LULULEMON;
  // Maintain exactly the current authorization scope: non-admin users must have a selected Factory.
  const { factoryCode: selectedFactory, loading: selectingFactory, error: selectedFactoryError } =
    useSelectedFactory(isLululemonUser ? BUYER_CODE.LULULEMON : '');
  const activeFactory = admin ? '' : isLululemonUser ? selectedFactory : (factories[0] || '');
  const [state, setState] = useState({ rows: [], count: 0, page: 0, size: DEFAULT_TABLE_PAGE_SIZE, loading: false });
  const [filters, setFilters] = useState(initialFilters);
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');
  useAutoDismissFeedback(error, setError, '', 'error');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    if (!sessionBuyer || (!admin && (selectingFactory || !activeFactory))) {
      setState((s) => ({ ...s, rows: [], count: 0, loading: false }));
      return () => { active = false; };
    }
    // Buyer is ALWAYS the JWT workspace, including for ADMIN. The API also enforces it.
    const query = { ...filters, buyerCode: sessionBuyer, page: state.page, size: state.size };
    if (!admin) query.factoryCode = activeFactory;
    delete query.fromDate;
    delete query.toDate;
    if (filters.fromDate) query.from = `${filters.fromDate}T00:00:00`;
    if (filters.toDate) query.to = `${filters.toDate}T23:59:59`;
    const load = async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const result = await listAuditLogs(query);
        if (active) {
          setError('');
          setState((s) => ({ ...s, rows: result.content || [], count: result.totalElements || 0, loading: false }));
        }
      } catch (e) {
        if (active) {
          setError(e?.response?.data?.message || e.message || 'Could not load activity history');
          setState((s) => ({ ...s, rows: [], count: 0, loading: false }));
        }
      }
    };
    load();
    return () => { active = false; };
  }, [filters, state.page, state.size, refresh, admin, activeFactory, selectingFactory, sessionBuyer]);

  const fieldChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setState((prev) => ({ ...prev, page: 0 }));
  };
  const selectDatePreset = (days) => {
    setFilters((prev) => ({ ...prev, ...quickDateRange(days) }));
    setState((prev) => ({ ...prev, page: 0 }));
  };
  const clearFilters = () => {
    setFilters(initialFilters);
    setState((prev) => ({ ...prev, page: 0 }));
  };
  const presetSelection = datePresets.find(({ days }) => {
    const range = quickDateRange(days);
    return range.fromDate === filters.fromDate && range.toDate === filters.toDate;
  })?.days;
  const invalidDateRange = Boolean(filters.fromDate && filters.toDate && filters.fromDate > filters.toDate);
  const filterFields = [
    { key: 'username', label: trUi("Performed by") },
    ...(admin ? [{ key: 'factoryCode', label: trUi("Factory") }] : []),
    { key: 'resourceType', label: trUi("Module"), options: AUDIT_MODULE_FILTER_OPTIONS.map((item) => ({ ...item, label: trUi(item.label) })) },
    { key: 'action', label: trUi("Activity"), options: AUDIT_ACTION_FILTER_OPTIONS.map((item) => ({ ...item, label: trUi(item.label) })) },
    { key: 'result', label: trUi("Log status"), options: [
      { value: 'SUCCESS', label: trUi("Recorded") }, { value: 'FAILED', label: trUi("Failed") },
      { value: 'ERROR', label: trUi("Error") }
    ] },
    { key: 'resourceId', label: trUi("Record ID") },
    { key: 'fromDate', label: trUi("From date"), type: 'date' },
    { key: 'toDate', label: trUi("To date"), type: 'date' }
  ];
  const columns = [
    { key: 'createdAt', label: trUi("When"), minWidth: 147, render: (r) => <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{auditDateTime(r.createdAt)}</Typography> },
    { key: 'action', label: trUi("What happened"), minWidth: 285, render: (r) => <AuditActivity row={r} /> },
    { key: 'username', label: trUi("Performed by"), minWidth: 140, render: (r) => <Box>
      <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{r.username || trUi("Unknown user")}</Typography>
    </Box> },
    { key: 'factoryCode', label: trUi("Factory"), minWidth: 100, render: (r) => <Typography variant="body2" fontWeight={650}>
      {r.factoryCode || (admin ? trUi("Global / legacy") : '—')}
    </Typography> },
    { key: 'resourceType', label: trUi("Where"), minWidth: 182, render: (r) => <Box>
      <Typography variant="body2">{trUi(auditModuleLabel(r.resourceType))}</Typography>
      {r.buyerCode && <Typography variant="caption" color="text.secondary">{r.buyerCode}</Typography>}
      {auditReference(r) && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{auditReference(r)}</Typography>}
    </Box> },
    { key: 'result', label: trUi("Log status"), minWidth: 115, render: (row) => operationStatus(row, trUi) },
    { key: '__view', label: trUi("Details"), minWidth: 82, render: (r) => <Tooltip title={trUi("See activity and field changes")}>
      <IconButton size="small" color="primary" aria-label={trUi("View audit details: {0}", auditActionLabel(r.action, r.description))} onClick={() => setViewing(r.id)}>
        <Visibility fontSize="small" />
      </IconButton>
    </Tooltip> }
  ];

  return <Box sx={{ p: { xs: 0.75, md: 1 }, width: '100%', ...managementPageSx }}>
    <Stack spacing={1.25} sx={managementStackSx}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800}>{trUi("Activity History")}</Typography>
          <Typography variant="body2" color="text.secondary">{trUi("Activity records for the current Buyer only. See who did what, when, and which record was affected.")}</Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={() => setRefresh((n) => n + 1)} disabled={state.loading} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>{trUi("Refresh")}</Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')}>{trSystem(error)}</Alert>}
      {!admin && selectedFactoryError && <Alert severity="error">{trSystem(selectedFactoryError)}</Alert>}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        {sessionBuyer && <Chip size="small" color="primary" variant="outlined" label={`Buyer: ${buyerLabel}`} />}
        {!admin && !selectingFactory && activeFactory && <Chip size="small" variant="outlined" label={`Factory: ${activeFactory}`} />}
      </Stack>
      {invalidDateRange && <Alert severity="warning">{trUi("The From date must be on or before the To date.")}</Alert>}
      <ManagementTable
          fillAvailableHeight
        title={trUi("Audit Logs ({0})", state.count)}
        filterBar={<Stack spacing={1}>
          <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap" alignItems="center">
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mr: 0.5 }}>{trUi("Quick dates")}</Typography>
            {datePresets.map(({ days, label }) => <Button key={label} size="small"
              variant={presetSelection === days ? 'contained' : 'outlined'}
              onClick={() => selectDatePreset(days)} disabled={state.loading}
              sx={{ minWidth: 0, px: 1.2 }}>{trUi(label)}</Button>)}
          </Stack>
          <TableFilterBar fields={filterFields} values={filters} onChange={fieldChange}
            onClear={clearFilters} disabled={state.loading} minFilterWidth={150} />
        </Stack>}
        {...state} rowsPerPage={state.size} columns={columns}
        emptyText={trUi("No activity found for the selected filters.")}
        onPageChange={(page) => setState((p) => ({ ...p, page }))}
        onRowsPerPageChange={(size) => setState((p) => ({ ...p, size, page: 0 }))}
      />
      {viewing && <AuditDetailDialog id={viewing} factoryCode={admin ? '' : activeFactory} onClose={() => setViewing(null)} />}
    </Stack>
  </Box>;
}

function DetailField({ label, value }) {
  const trUi = useT();
  return <Box sx={{ p: 1.1, bgcolor: 'action.hover', borderRadius: '4px', minWidth: 0 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{auditValueText(value, trUi)}</Typography>
  </Box>;
}

function AuditDetailDialog({ id, factoryCode, onClose }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const [row, setRow] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setRow(null); setError('');
    getAuditLog(id, factoryCode).then((result) => { if (active) setRow(result); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || 'Unable to read this audit record'); });
    return () => { active = false; };
  }, [id, factoryCode]);

  const snapshotType = auditSnapshotType(row);
  const changes = auditChangeRows(row);
  const changeHeading = snapshotType === 'comparison' ? 'What changed'
    : snapshotType === 'after' ? 'Values saved after this activity'
    : snapshotType === 'before' ? 'Values recorded before this activity' : 'Change details';

  return <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="audit-detail-title">
    <DialogTitle id="audit-detail-title" sx={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 1 }}>
      <Box>
        <Typography variant="h6" fontWeight={800}>{row ? trUi(auditActionLabel(row.action, row.description)) : trUi("Activity Details")}</Typography>
        {row && <Typography variant="caption" color="text.secondary">{auditDateTime(row.createdAt)} · {row.username || trUi("Unknown user")}</Typography>}
      </Box>
      <IconButton size="small" onClick={onClose} aria-label={trUi("Close activity details")}><Close fontSize="small" /></IconButton>
    </DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error">{trSystem(error)}</Alert>}
      {!row && !error && <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={18} /><Typography color="text.secondary">{trUi("Loading history details…")}</Typography></Stack>}
      {row && <Stack spacing={1.75}>
        {row.description ? <Alert severity="info" icon={false} sx={{ overflowWrap: 'anywhere' }}>{trSystem(row.description)}</Alert>
          : <Typography variant="body2" color="text.secondary">{trUi("No additional description was recorded for this event.")}</Typography>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' }, gap: 1 }}>
          <DetailField label={trUi("Performed by")} value={row.username} />
          <DetailField label={trUi("When")} value={auditDateTime(row.createdAt)} />
          <DetailField label={trUi("Factory")} value={row.factoryCode} />
          <DetailField label={trUi("Module")} value={trUi(auditModuleLabel(row.resourceType))} />
          <DetailField label={trUi("Buyer")} value={row.buyerCode || 'Global / legacy'} />
          <Box sx={{ p: 1.1, bgcolor: 'action.hover', borderRadius: '4px' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{trUi("Audit recording")}</Typography>
            {operationStatus(row, trUi)}
          </Box>
        </Box>
        {auditReference(row) && <Typography variant="body2"><strong>{trUi("Affected record:")}</strong> {auditReference(row)}</Typography>}
        <Divider />
        <Box>
          <Typography variant="subtitle1" fontWeight={800}>{trUi(changeHeading)} ({changes.length})</Typography>
          {snapshotType === 'after' && <Typography variant="caption" color="text.secondary">{trUi("The original log stores new values only; previous values were not recorded. This is not a before/after comparison.")}</Typography>}
          {snapshotType === 'before' && <Typography variant="caption" color="text.secondary">{trUi("The original log stores previous values only; no new values were recorded.")}</Typography>}
        </Box>
        {changes.length > 0 ? <TableContainer sx={{ maxHeight: 380, border: 1, borderColor: 'divider', borderRadius: '4px' }}>
          <Table size="small" stickyHeader>
            <TableHead><TableRow>
              <TableCell sx={{ minWidth: 145 }}>{trUi("Field")}</TableCell>
              {snapshotType === 'comparison' || snapshotType === 'none' ? <><TableCell>{trUi("Before")}</TableCell><TableCell>{trUi("After")}</TableCell></> : <TableCell>{trUi("Recorded value")}</TableCell>}
            </TableRow></TableHead>
            <TableBody>{changes.map((item) => <TableRow key={item.field}>
              <TableCell sx={{ fontWeight: 650, verticalAlign: 'top' }}>
                <Tooltip title={item.field}><span>{trUi(auditFieldLabel(item.field))}</span></Tooltip>
              </TableCell>
              {snapshotType === 'comparison' || snapshotType === 'none' ? <>
                <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 280 }}>{auditValueText(item.before, trUi)}</TableCell>
                <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 280 }}>{auditValueText(item.after, trUi)}</TableCell>
              </> : <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 550 }}>{auditValueText(item.value, trUi)}</TableCell>}
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer> : <Alert severity="info">{trUi("This record has no structured field details. Its original description is shown above; no missing values have been reconstructed.")}</Alert>}
        <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: '4px', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="body2" fontWeight={700}>{trUi("Technical information (for IT)")}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))' }, gap: 1 }}>
              <DetailField label={trUi("Action code")} value={row.action} />
              <DetailField label={trUi("Module code")} value={row.resourceType} />
              <DetailField label={trUi("Resource ID")} value={row.resourceId} />
              <DetailField label={trUi("Audit record ID")} value={row.id} />
              <DetailField label={trUi("IP address")} value={row.ipAddress} />
              <DetailField label={trUi("Log result code")} value={row.result || 'Not recorded'} />
              <DetailField label={trUi("Client / User Agent")} value={row.userAgent} />
            </Box>
          </AccordionDetails>
        </Accordion>
      </Stack>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>{trUi("Close")}</Button></DialogActions>
  </Dialog>;
}
