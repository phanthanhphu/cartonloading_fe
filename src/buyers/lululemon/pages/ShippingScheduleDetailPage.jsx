import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  ArrowBackRounded,
  CheckCircleOutline,
  FactCheckOutlined,
  Refresh,
  ScaleOutlined
} from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { CompactPageHeader } from 'components/CompactPageHeader';
import { canAssignBarcode, canManageSales } from 'utils/accessControl';
import {
  checkShippingSchedule,
  getShippingSchedule,
  listShippingScheduleWeightHistory,
  sendShippingScheduleToWeight
} from '../services/service';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Operation failed.';
const value = (v) => (v == null || v === '' ? '—' : v);
const pairValue = (first, second) => [String(first ?? '').trim(), String(second ?? '').trim()].filter(Boolean).join(' · ');

const readinessState = (row = {}) => {
  if (!row.skuAssigned) return { label: 'SKU REQUIRED', color: 'error' };
  if ((row.finishedCartons || 0) < (row.totalCartons || 0)) return { label: 'PACKING', color: 'warning' };
  if ((row.ssccAssignedCartons || 0) < (row.totalCartons || 0)) return { label: 'SSCC', color: 'warning' };
  return { label: 'READY', color: 'success' };
};

export default function ShippingScheduleDetailPage() {
  const navigate = useNavigate();
  const { buyerSlug, scheduleId } = useParams();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const packing = canAssignBarcode() || canManageSales();
  const [detail, setDetail] = useState(null);
  const [weightHistory, setWeightHistory] = useState([]);
  const [selectedPoDetail, setSelectedPoDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    if (!orderId || !scheduleId) return;
    setBusy(true);
    try {
      const [d, h] = await Promise.all([
        getShippingSchedule(orderId, scheduleId),
        listShippingScheduleWeightHistory(orderId, scheduleId)
      ]);
      setDetail(d);
      setWeightHistory(Array.isArray(h) ? h : []);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      setDetail(null);
      setWeightHistory([]);
    } finally {
      setBusy(false);
    }
  }, [orderId, scheduleId]);

  useEffect(() => { load(); }, [load]);

  const checkSchedule = async () => {
    if (!packing || !orderId || !scheduleId || busy) return;
    setBusy(true);
    try {
      const result = await checkShippingSchedule(orderId, scheduleId);
      setDetail(result);
      setNotice({
        severity: result.readyToSendToWeight ? 'success' : 'warning',
        text: result.readyToSendToWeight
          ? 'All POs have SKU and all cartons have SSCC. This schedule is ready for Carton Weight.'
          : 'Check completed. Review the PO Status column below to see what is still missing.'
      });
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const sendToWeight = async () => {
    if (!packing || !detail?.readyToSendToWeight || !scheduleId || busy) return;
    setBusy(true);
    try {
      const result = await sendShippingScheduleToWeight(orderId, scheduleId);
      setDetail(result);
      setNotice({ severity: 'success', text: `${result?.schedule?.scheduleNo}: Packing confirmed cartons were moved to the Carton Weight area.` });
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const summary = useMemo(() => detail ? [
    ['Schedule', detail.schedule?.scheduleNo, detail.schedule?.status],
    ['Factory / Date', `${value(detail.schedule?.factoryCode)} · ${value(detail.schedule?.exFtyDate)}`, 'Assigned by Sales'],
    ['PO Ready', `${detail.readyPos}/${detail.totalPos}`, detail.readyToSendToWeight ? 'Ready for Carton Weight' : 'Action required'],
    ['SSCC', `${detail.ssccAssignedCartons}/${detail.totalCartons}`, 'Assigned cartons'],
    ['Weight', `${detail.passCartons} PASS · ${detail.failedCartons} FAILED`, `${detail.remainingWeightCartons} remaining`]
  ] : [], [detail]);

  if (!orderId) {
    return <Alert severity="error">Order context is missing. Please return to Schedule Review and open the schedule again.</Alert>;
  }

  return (
    <Stack spacing={0.85} sx={{ p: { xs: 0.5, md: 1 } }}>
      <CompactPageHeader
        dense
        title="Shipping Schedule Detail"
        subtitle={detail?.schedule?.scheduleNo || 'Review PO readiness for this Shipping Schedule.'}
        actions={(
          <Stack direction="row" spacing={0.6}>
            <Button size="small" variant="outlined" startIcon={<ArrowBackRounded />} onClick={() => navigate(`/buyers/${buyerSlug}/shipping/review?orderId=${encodeURIComponent(orderId)}`)}>Schedule List</Button>
            <Button size="small" startIcon={<Refresh />} onClick={load} disabled={busy}>Refresh</Button>
          </Stack>
        )}
      />

      {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

      {detail ? (
        <>
          <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ lg: 'center' }}>
              <Box>
                <Typography fontWeight={950}>PO Readiness</Typography>
                <Typography variant="caption" color="text.secondary">Packing receives this Shipping List first. Verify mapped scan data, then confirm the cartons were moved to the Carton Weight area.</Typography>
              </Box>
              <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                <Button variant="outlined" startIcon={<FactCheckOutlined />} onClick={checkSchedule} disabled={!packing || busy} sx={{ minHeight: { xs: 48, md: 'auto' }, flex: { xs: 1, md: 'initial' } }}>CHECK</Button>
                <Button variant="contained" color="success" startIcon={<ScaleOutlined />} onClick={sendToWeight} disabled={!packing || !detail.readyToSendToWeight || Boolean(detail.schedule?.weighingOrderId) || busy} sx={{ minHeight: { xs: 48, md: 'auto' }, flex: { xs: 1, md: 'initial' } }}>CONFIRM SENT TO WEIGHING AREA</Button>
              </Stack>
            </Stack>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', xl: 'repeat(5,1fr)' }, gap: 0.8 }}>
            {summary.map(([label, main, secondary]) => (
              <Paper key={label} variant="outlined" sx={{ p: 0.75, borderRadius: 1.7 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography>
                <Typography fontWeight={950}>{main}</Typography>
                <Typography variant="caption" color="text.secondary">{secondary}</Typography>
              </Paper>
            ))}
          </Box>

          <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
            <Box sx={{ p: 0.85, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.8} alignItems={{ md: 'center' }}>
                <Box>
                  <Typography fontWeight={950}>PO List</Typography>
                  <Typography variant="caption" color="text.secondary">Operational view only. Use Details when full logical PO information is needed.</Typography>
                </Box>
                <Chip label={detail.readyToSendToWeight ? 'READY FOR CARTON WEIGHT' : 'ACTION REQUIRED'} color={detail.readyToSendToWeight ? 'success' : 'warning'} icon={detail.readyToSendToWeight ? <CheckCircleOutline /> : undefined} />
              </Stack>
            </Box>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <LululemonTableViewport>
                <SortableTable size="small">
                  <TableHead><TableRow>
                    <TableCell>PO</TableCell>
                    <TableCell>Style / Color / Size</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>Packing</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>SSCC</TableCell>
                    <TableCell>Weight</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell data-sortable={false} align="right">Details</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {(detail.pos || []).map((row) => {
                      const state = readinessState(row);
                      const packingPercent = row.totalCartons > 0 ? Math.min(100, Math.round((row.finishedCartons / row.totalCartons) * 100)) : 0;
                      const ssccPercent = row.totalCartons > 0 ? Math.min(100, Math.round((row.ssccAssignedCartons / row.totalCartons) * 100)) : 0;
                      return (
                        <TableRow key={row.po.id} hover>
                          <TableCell><Typography fontWeight={950}>{row.po.poNumber}</Typography><Typography variant="caption" color="text.secondary">{value(row.po.dcCode)} · Plan {value(row.po.packingPlan)}</Typography></TableCell>
                          <TableCell><Typography variant="body2" fontWeight={800}>{value(row.po.style)}</Typography><Typography variant="caption" color="text.secondary">{value(row.po.color)} · Size {value(row.po.size)}</Typography></TableCell>
                          <TableCell>{row.skuAssigned ? <Typography variant="body2" fontWeight={850}>{row.po.sku}</Typography> : <Chip size="small" color="error" variant="outlined" label="NOT SCANNED" />}</TableCell>
                          <TableCell><Stack spacing={0.4}><Stack direction="row" justifyContent="space-between"><Typography variant="caption" fontWeight={850}>{row.finishedCartons}/{row.totalCartons}</Typography><Typography variant="caption" color="text.secondary">{packingPercent}%</Typography></Stack><LinearProgress variant="determinate" value={packingPercent} color={packingPercent === 100 ? 'success' : 'primary'} sx={{ height: 6, borderRadius: 6 }} /></Stack></TableCell>
                          <TableCell><Stack spacing={0.4}><Stack direction="row" justifyContent="space-between"><Typography variant="caption" fontWeight={850}>{row.ssccAssignedCartons}/{row.totalCartons}</Typography><Typography variant="caption" color="text.secondary">{ssccPercent}%</Typography></Stack><LinearProgress variant="determinate" value={ssccPercent} color={ssccPercent === 100 ? 'success' : 'warning'} sx={{ height: 6, borderRadius: 6 }} /></Stack></TableCell>
                          <TableCell><Typography variant="body2" fontWeight={850}>{row.passCartons} PASS</Typography><Typography variant="caption" color={row.failedCartons > 0 ? 'error.main' : 'text.secondary'}>{row.failedCartons} FAILED</Typography></TableCell>
                          <TableCell><Chip size="small" color={state.color} label={state.label} /></TableCell>
                          <TableCell align="right"><Button size="small" variant="outlined" onClick={() => setSelectedPoDetail(row)}>View</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </SortableTable>
              </LululemonTableViewport>
            </Box>
            <Stack spacing={0.75} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
              {(detail.pos || []).map((row) => {
                const state = readinessState(row);
                const packingPercent = row.totalCartons > 0 ? Math.min(100, Math.round((row.finishedCartons / row.totalCartons) * 100)) : 0;
                const ssccPercent = row.totalCartons > 0 ? Math.min(100, Math.round((row.ssccAssignedCartons / row.totalCartons) * 100)) : 0;
                return (
                  <Paper key={row.po.id} variant="outlined" sx={{ p: 1, borderRadius: 1.7 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={950}>PO {row.po.poNumber}</Typography>
                        {row.skuAssigned ? <Typography variant="body2" fontWeight={850}>SKU {row.po.sku}</Typography> : <Chip size="small" color="error" variant="outlined" label="SKU NOT SCANNED" />}
                        <Typography variant="caption" color="text.secondary">{value(row.po.dcCode)} · Plan {value(row.po.packingPlan)}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Style {value(row.po.style)} · Color {value(row.po.color)} · Size {value(row.po.size)}</Typography>
                      </Box>
                      <Chip size="small" color={state.color} label={state.label} />
                    </Stack>
                    <Box sx={{ mt: 0.9 }}>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="caption" fontWeight={850}>Packing {row.finishedCartons}/{row.totalCartons}</Typography><Typography variant="caption" color="text.secondary">{packingPercent}%</Typography></Stack>
                      <LinearProgress variant="determinate" value={packingPercent} color={packingPercent === 100 ? 'success' : 'primary'} sx={{ mt: 0.35, height: 7, borderRadius: 6 }} />
                    </Box>
                    <Box sx={{ mt: 0.8 }}>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="caption" fontWeight={850}>SSCC {row.ssccAssignedCartons}/{row.totalCartons}</Typography><Typography variant="caption" color="text.secondary">{ssccPercent}%</Typography></Stack>
                      <LinearProgress variant="determinate" value={ssccPercent} color={ssccPercent === 100 ? 'success' : 'warning'} sx={{ mt: 0.35, height: 7, borderRadius: 6 }} />
                    </Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.9 }}>
                      <Typography variant="body2" fontWeight={850} color={row.failedCartons > 0 ? 'error.main' : 'success.main'}>{row.passCartons} PASS · {row.failedCartons} FAILED</Typography>
                      <Button variant="outlined" onClick={() => setSelectedPoDetail(row)} sx={{ minHeight: 44 }}>Details</Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Paper>

          <OperationWorkspaceDialog
            open={Boolean(selectedPoDetail)}
            onClose={() => setSelectedPoDetail(null)}
            title={selectedPoDetail ? `Shipping PO Detail · ${selectedPoDetail.po?.poNumber || '—'}` : 'Shipping PO Detail'}
            subtitle={selectedPoDetail ? `SKU ${selectedPoDetail.po?.sku || 'Not assigned'} · ${pairValue(selectedPoDetail.po?.style, selectedPoDetail.po?.color) || '—'} · Size ${value(selectedPoDetail.po?.size)}` : ''}
            maxWidth="md"
          >
            {selectedPoDetail ? (
              <Stack spacing={1}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 0.8 }}>
                  {[
                    ['Master PO', selectedPoDetail.po.masterPo],
                    ['DC / Destination', pairValue(selectedPoDetail.po.dcCode, selectedPoDetail.po.destination)],
                    ['Channel', selectedPoDetail.po.channel],
                    ['Packing Plan', selectedPoDetail.po.packingPlan],
                    ['SO (PTS)', selectedPoDetail.po.salesOrderPts],
                    ['Style', selectedPoDetail.po.style],
                    ['Color', selectedPoDetail.po.color],
                    ['Size', selectedPoDetail.po.size]
                  ].map(([label, fieldValue]) => (
                    <Paper key={label} variant="outlined" sx={{ p: 0.9, borderRadius: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography>
                      <Typography variant="body2" fontWeight={850}>{value(fieldValue)}</Typography>
                    </Paper>
                  ))}
                </Box>
                <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 1.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                    <Box><Typography variant="caption" color="text.secondary">Packing</Typography><Typography fontWeight={900}>{selectedPoDetail.finishedCartons}/{selectedPoDetail.totalCartons} cartons</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">SSCC</Typography><Typography fontWeight={900}>{selectedPoDetail.ssccAssignedCartons}/{selectedPoDetail.totalCartons} assigned</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Weight</Typography><Typography fontWeight={900}>{selectedPoDetail.passCartons} PASS · {selectedPoDetail.failedCartons} FAILED</Typography></Box>
                  </Stack>
                </Paper>
                {selectedPoDetail.po.description ? <Alert severity="info">{selectedPoDetail.po.description}</Alert> : null}
              </Stack>
            ) : null}
          </OperationWorkspaceDialog>

          {detail.schedule?.history?.length ? (
            <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 2 }}>
              <Typography fontWeight={950} sx={{ mb: 0.7 }}>Schedule History</Typography>
              <Stack spacing={0.5}>
                {[...detail.schedule.history].reverse().map((event, index) => (
                  <Stack key={`${event.createdAt}-${index}`} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ py: 0.55, borderBottom: index < detail.schedule.history.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Chip size="small" label={event.action} color={event.action === 'COMPLETED' ? 'success' : 'default'} />
                    <Typography variant="body2" sx={{ minWidth: 155 }}>{event.createdAt}</Typography>
                    <Typography variant="body2" sx={{ minWidth: 180 }}>{event.userId || '—'}</Typography>
                    <Typography variant="body2" color="text.secondary">{event.note}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          ) : null}

          <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
            <Box sx={{ p: 1.2, bgcolor: 'background.default' }}><Typography fontWeight={950}>Carton Weight History</Typography><Typography variant="caption" color="text.secondary">All weighing results retained against this Shipping Schedule.</Typography></Box>
            <Divider />
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <LululemonTableViewport>
                <SortableTable size="small">
                  <TableHead><TableRow><TableCell>Time</TableCell><TableCell>PO</TableCell><TableCell>Carton</TableCell><TableCell>SSCC</TableCell><TableCell>Qty</TableCell><TableCell>Target</TableCell><TableCell>Actual</TableCell><TableCell>Result</TableCell><TableCell>Station</TableCell><TableCell>User</TableCell></TableRow></TableHead>
                  <TableBody>
                    {weightHistory.map((row) => <TableRow key={row.id}><TableCell>{row.createdAt}</TableCell><TableCell>{row.poNumber}</TableCell><TableCell>{row.cartonNo}</TableCell><TableCell>{row.sscc18}</TableCell><TableCell>{row.cartonQty}</TableCell><TableCell>{row.expectedWeightKg}</TableCell><TableCell>{row.actualWeightKg}</TableCell><TableCell><Chip size="small" label={row.result === 'PASS' ? 'PASS' : 'FAILED'} color={row.result === 'PASS' ? 'success' : 'error'} /></TableCell><TableCell>{row.stationCode}</TableCell><TableCell>{row.userId}</TableCell></TableRow>)}
                    {!weightHistory.length ? <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4 }}>No weight result recorded yet.</TableCell></TableRow> : null}
                  </TableBody>
                </SortableTable>
              </LululemonTableViewport>
            </Box>
            <Stack spacing={0.7} sx={{ display: { xs: 'flex', md: 'none' }, p: 0.75 }}>
              {weightHistory.map((row) => (
                <Paper key={row.id} variant="outlined" sx={{ p: 0.9, borderRadius: 1.6 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                    <Box><Typography fontWeight={900}>PO {row.poNumber} · Carton {row.cartonNo}</Typography><Typography variant="caption" color="text.secondary">{row.createdAt} · Station {row.stationCode || '—'}</Typography></Box>
                    <Chip size="small" label={row.result === 'PASS' ? 'PASS' : 'FAILED'} color={row.result === 'PASS' ? 'success' : 'error'} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}>SSCC {row.sscc18 || '—'}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0.6, mt: 0.7 }}>
                    <Box><Typography variant="caption" color="text.secondary">Qty</Typography><Typography fontWeight={900}>{row.cartonQty ?? '—'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Target</Typography><Typography fontWeight={900}>{row.expectedWeightKg ?? '—'}</Typography></Box>
                    <Box><Typography variant="caption" color="text.secondary">Actual</Typography><Typography fontWeight={900}>{row.actualWeightKg ?? '—'}</Typography></Box>
                  </Box>
                </Paper>
              ))}
              {!weightHistory.length ? <Typography align="center" color="text.secondary" sx={{ py: 3 }}>No weight result recorded yet.</Typography> : null}
            </Stack>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
