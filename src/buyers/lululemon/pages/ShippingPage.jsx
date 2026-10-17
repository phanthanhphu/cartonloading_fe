import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Typography
} from '@mui/material';
import {
  ArrowForwardRounded,
  ClearRounded,
  CloseRounded,
  DeleteOutlineRounded,
  LocalShippingOutlined,
  AssignmentTurnedInOutlined,
  ScaleOutlined,
  Refresh,
  Search,
  TuneRounded
} from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import { CompactPageHeader } from '../components/LululemonPageHeader';
import { canAccessAssignedFactory, canAssignBarcode, canManageSales, getFactoryPermissions } from 'utils/accessControl';
import OrderScope from '../components/OrderScope';
import { createShippingSchedule, listAllPos, listShippingSchedules, removeShippingSchedule, sendShippingScheduleToWeight } from '../services/service';
import { listPoPicks } from '../services/poPicking';
import { FACTORY_CODES } from '../../../constants/appConstants';

const errorText = (error) => error?.response?.data?.message || error?.message || 'Operation failed.';
const value = (v) => (v == null || v === '' ? '—' : v);
const normalize = (v) => String(v ?? '').trim();

const FILTER_CONFIG = Object.freeze([
  { key: 'poNumber', label: 'PO' },
  { key: 'masterPo', label: 'Master PO' },
  { key: 'dcDestination', label: 'DC / Destination' },
  { key: 'packingPlan', label: 'Packing Plan' },
  { key: 'salesOrderPts', label: 'SO (PTS)' },
  { key: 'styleColor', label: 'Style / Color' },
  { key: 'size', label: 'Size' }
]);

const emptyPoFilters = () => Object.fromEntries(FILTER_CONFIG.map(({ key }) => [key, []]));

const uniqueSorted = (rows, key) => [...new Set(
  rows.map((row) => normalize(row?.[key])).filter(Boolean)
)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

const pairValue = (first, second) => [normalize(first), normalize(second)].filter(Boolean).join(' · ');

const uniquePairOptions = (rows, firstKey, secondKey) => [...new Set(
  rows.map((row) => pairValue(row?.[firstKey], row?.[secondKey])).filter(Boolean)
)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

function MultiValueFilter({ label, options, value: selectedValues, onChange, disabled }) {
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      filterSelectedOptions
      limitTags={1}
      size="small"
      options={options}
      value={selectedValues}
      onChange={(_, next) => onChange(next)}
      disabled={disabled}
      isOptionEqualToValue={(option, selected) => option === selected}
      renderOption={(props, option, { selected }) => (
        <li {...props}>
          <Checkbox size="small" checked={selected} sx={{ mr: 0.5, p: 0.25 }} />
          <Typography variant="body2" noWrap>{option}</Typography>
        </li>
      )}
      renderInput={(params) => <TextField {...params} label={label} placeholder={selectedValues.length ? '' : 'All'} />}
      sx={{ minWidth: 0 }}
    />
  );
}

export default function ShippingPage() {
  const sales = canManageSales();
  const packing = canAssignBarcode();
  const canCreateShipment = sales || packing;
  const assignedFactories = useMemo(() => getFactoryPermissions(), []);
  const createFactories = useMemo(() => sales
    ? FACTORY_CODES
    : FACTORY_CODES.filter((code) => assignedFactories.includes('*') || assignedFactories.includes(code)),
  [sales, assignedFactories]);
  const navigate = useNavigate();
  const { buyerSlug } = useParams();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(() => searchParams.get('orderId') || '');
  const [pos, setPos] = useState([]);
  const [claims, setClaims] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedPoIds, setSelectedPoIds] = useState(() => new Set());
  const [poSearch, setPoSearch] = useState('');
  const [poFilters, setPoFilters] = useState(() => emptyPoFilters());
  const [shippingName, setShippingName] = useState('');
  const [factoryCode, setFactoryCode] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [highlightShipmentId, setHighlightShipmentId] = useState(null);
  const [sendingShipmentId, setSendingShipmentId] = useState(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [poPage, setPoPage] = useState(0);
  const [poRowsPerPage, setPoRowsPerPage] = useState(25);
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('ALL');
  const [scheduleFactory, setScheduleFactory] = useState('ALL');
  const [scheduleReadiness, setScheduleReadiness] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scheduleFiltersOpen, setScheduleFiltersOpen] = useState(false);
  const [schedulePage, setSchedulePage] = useState(0);
  const [scheduleRowsPerPage, setScheduleRowsPerPage] = useState(25);

  const loadBase = useCallback(async () => {
    if (!orderId) {
      setPos([]);
      setClaims([]);
      setSchedules([]);
      return;
    }
    setBusy(true);
    try {
      const [poRows, scheduleRows, pickRows] = await Promise.all([listAllPos(orderId), listShippingSchedules(orderId), listPoPicks(orderId)]);
      setPos(Array.isArray(poRows) ? poRows : []);
      setSchedules(Array.isArray(scheduleRows) ? scheduleRows : []);
      setClaims(Array.isArray(pickRows) ? pickRows : []);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }, [orderId]);

  useEffect(() => {
    setSelectedPoIds(new Set());
    setShippingName('');
    setFactoryCode(createFactories.length === 1 ? createFactories[0] : '');
    setShippingDate('');
    setPoSearch('');
    setPoFilters(emptyPoFilters());
    setPoPage(0);
    setScheduleSearch('');
    setScheduleStatus('ALL');
    setScheduleFactory('ALL');
    setScheduleReadiness('ALL');
    setDateFrom('');
    setDateTo('');
    setSchedulePage(0);
    setCreateOpen(false);
    loadBase();
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSchedules = useMemo(() => {
    const query = scheduleSearch.trim().toLowerCase();
    return [...schedules]
      .filter((row) => {
        const schedule = row?.schedule || {};
        // Packing users only see shipments belonging to factories they can access.
        if (!sales && !canAccessAssignedFactory(schedule.factoryCode)) return false;
        if (scheduleStatus !== 'ALL' && schedule.status !== scheduleStatus) return false;
        if (scheduleFactory !== 'ALL' && schedule.factoryCode !== scheduleFactory) return false;
        if (scheduleReadiness !== 'ALL' && Boolean(row?.readyToSendToWeight) !== (scheduleReadiness === 'READY')) return false;
        if (dateFrom && (!schedule.exFtyDate || schedule.exFtyDate < dateFrom)) return false;
        if (dateTo && (!schedule.exFtyDate || schedule.exFtyDate > dateTo)) return false;
        if (!query) return true;
        return [schedule.shippingName, schedule.scheduleNo, schedule.factoryCode, schedule.exFtyDate,
          schedule.status, schedule.createdBy, ...(row?.pos || []).map((po) => po.poNumber)]
          .filter(Boolean).join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => {
        // Keep a newly created shipment visible at the top, irrespective of its shipping date.
        if (a?.schedule?.id === highlightShipmentId) return -1;
        if (b?.schedule?.id === highlightShipmentId) return 1;
        return String(b?.schedule?.exFtyDate || b?.schedule?.createdAt || '').localeCompare(
          String(a?.schedule?.exFtyDate || a?.schedule?.createdAt || ''));
      });
  }, [schedules, scheduleSearch, scheduleStatus, scheduleFactory, scheduleReadiness, dateFrom, dateTo, sales, highlightShipmentId]);

  const pagedSchedules = useMemo(() => filteredSchedules.slice(
    schedulePage * scheduleRowsPerPage, (schedulePage + 1) * scheduleRowsPerPage
  ), [filteredSchedules, schedulePage, scheduleRowsPerPage]);

  useEffect(() => { setSchedulePage(0); }, [orderId, scheduleSearch, scheduleStatus, scheduleFactory, scheduleReadiness, dateFrom, dateTo]);
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(filteredSchedules.length / scheduleRowsPerPage) - 1);
    if (schedulePage > lastPage) setSchedulePage(lastPage);
  }, [filteredSchedules.length, schedulePage, scheduleRowsPerPage]);

  const canRemoveShipment = (schedule = {}) => sales
    && !schedule.weighingOrderId
    && !schedule.sentToWeightAt
    && ['PLANNED', 'REVIEWED'].includes(schedule.status);

  const removeShipment = async (event, schedule) => {
    event.stopPropagation();
    if (!orderId || !schedule?.id || !canRemoveShipment(schedule) || busy) return;
    const confirmed = window.confirm(`Remove shipment ${schedule.shippingName || schedule.scheduleNo || ''}?\n\nPacking, Carton, SKU and SSCC records will be kept.`);
    if (!confirmed) return;
    setBusy(true);
    setNotice(null);
    try {
      await removeShippingSchedule(orderId, schedule.id);
      setNotice({ severity: 'success', text: 'Shipment removed. Packing, Carton, SKU and SSCC records were kept.' });
      await loadBase();
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const clearShipmentFilters = () => {
    setScheduleSearch('');
    setScheduleStatus('ALL');
    setScheduleFactory('ALL');
    setScheduleReadiness('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const shipmentFilterCount = Number(scheduleFactory !== 'ALL') + Number(scheduleReadiness !== 'ALL') + Number(Boolean(dateFrom)) + Number(Boolean(dateTo));

  const poAssignmentMap = useMemo(() => {
    const map = new Map();
    schedules.forEach((row) => {
      const schedule = row?.schedule;
      if (!schedule?.poIds?.length || schedule.status === 'COMPLETED') return;
      const assignment = {
        scheduleNo: schedule.shippingName || schedule.scheduleNo,
        status: schedule.status,
        reassignable: ['PLANNED', 'REVIEWED'].includes(schedule.status) && !schedule.weighingOrderId && !schedule.sentToWeightAt
      };
      schedule.poIds.forEach((id) => {
        if (!map.has(id)) map.set(id, assignment);
      });
    });
    return map;
  }, [schedules]);

  // A Shipping List can only contain POs that Packing actually PICKED for its Factory.
  // The backend independently enforces this prerequisite during CREATE.
  const pickedForFactory = useMemo(() => new Set(claims
    .filter((claim) => ['ACTIVE', 'LEGACY_PICKED'].includes(claim.pickStatus)
      && normalize(claim.factoryCode).toUpperCase() === factoryCode)
    .map((claim) => normalize(claim.poNumber))), [claims, factoryCode]);
  const creationPos = useMemo(() => pos.filter((po) =>
    Boolean(factoryCode) && normalize(po.factoryCode).toUpperCase() === factoryCode
    && pickedForFactory.has(normalize(po.poNumber))
  ), [pos, factoryCode, pickedForFactory]);

  const filterOptions = useMemo(() => ({
    poNumber: uniqueSorted(creationPos, 'poNumber'),
    masterPo: uniqueSorted(creationPos, 'masterPo'),
    dcDestination: uniquePairOptions(creationPos, 'dcCode', 'destination'),
    packingPlan: uniqueSorted(creationPos, 'packingPlan'),
    salesOrderPts: uniqueSorted(creationPos, 'salesOrderPts'),
    styleColor: uniquePairOptions(creationPos, 'style', 'color'),
    size: uniqueSorted(creationPos, 'size')
  }), [creationPos]);

  const activeFilterCount = useMemo(
    () => FILTER_CONFIG.filter(({ key }) => (poFilters[key] || []).length > 0).length,
    [poFilters]
  );

  const filteredPos = useMemo(() => {
    const tokens = poSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return creationPos.filter((po) => {
      if (tokens.length) {
        const haystack = [
          po.poNumber,
          po.sku,
          po.masterPo,
          po.dcCode,
          po.destination,
          po.channel,
          po.packingPlan,
          po.salesOrderPts,
          po.style,
          po.description,
          po.color,
          po.size,
          po.factoryCode
        ].filter((item) => item != null && item !== '').join(' ').toLowerCase();
        if (!tokens.every((token) => haystack.includes(token))) return false;
      }

      for (const key of ['poNumber', 'masterPo', 'packingPlan', 'salesOrderPts']) {
        const selected = poFilters[key] || [];
        if (selected.length && !selected.includes(normalize(po?.[key]))) return false;
      }

      if (poFilters.dcDestination.length && !poFilters.dcDestination.includes(pairValue(po?.dcCode, po?.destination))) return false;
      if (poFilters.styleColor.length && !poFilters.styleColor.includes(pairValue(po?.style, po?.color))) return false;
      if (poFilters.size.length && !poFilters.size.includes(normalize(po?.size))) return false;
      return true;
    });
  }, [creationPos, poSearch, poFilters]);

  const selectableFilteredPos = useMemo(
    () => filteredPos.filter((po) => {
      const assignment = poAssignmentMap.get(po.id);
      return !assignment || assignment.reassignable;
    }),
    [filteredPos, poAssignmentMap]
  );

  const pagedPos = useMemo(() => {
    const start = poPage * poRowsPerPage;
    return filteredPos.slice(start, start + poRowsPerPage);
  }, [filteredPos, poPage, poRowsPerPage]);

  const selectablePagePos = useMemo(
    () => pagedPos.filter((po) => {
      const assignment = poAssignmentMap.get(po.id);
      return !assignment || assignment.reassignable;
    }),
    [pagedPos, poAssignmentMap]
  );

  const selectedVisibleCount = useMemo(
    () => filteredPos.filter((po) => selectedPoIds.has(po.id)).length,
    [filteredPos, selectedPoIds]
  );
  const selectedHiddenCount = Math.max(0, selectedPoIds.size - selectedVisibleCount);
  const allFilteredSelected = selectableFilteredPos.length > 0 && selectableFilteredPos.every((po) => selectedPoIds.has(po.id));
  const allPageSelected = selectablePagePos.length > 0 && selectablePagePos.every((po) => selectedPoIds.has(po.id));
  const somePageSelected = selectablePagePos.some((po) => selectedPoIds.has(po.id));

  useEffect(() => {
    setPoPage(0);
  }, [poSearch, poFilters]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredPos.length / poRowsPerPage) - 1);
    if (poPage > maxPage) setPoPage(maxPage);
  }, [filteredPos.length, poPage, poRowsPerPage]);

  const activeFilterChips = useMemo(() => FILTER_CONFIG.flatMap(({ key, label }) => {
    const values = poFilters[key] || [];
    if (!values.length) return [];
    const summary = `${values.slice(0, 2).join(', ')}${values.length > 2 ? ` +${values.length - 2}` : ''}`;
    return [{ key, label: `${label}: ${summary}` }];
  }), [poFilters]);

  const updatePoFilter = (key, values) => setPoFilters((current) => ({ ...current, [key]: values }));
  const clearAllFilters = () => {
    setPoSearch('');
    setPoFilters(emptyPoFilters());
  };

  const toggleFilteredPos = () => {
    setSelectedPoIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) selectableFilteredPos.forEach((po) => next.delete(po.id));
      else selectableFilteredPos.forEach((po) => next.add(po.id));
      return next;
    });
  };

  const togglePagePos = () => {
    setSelectedPoIds((current) => {
      const next = new Set(current);
      if (allPageSelected) selectablePagePos.forEach((po) => next.delete(po.id));
      else selectablePagePos.forEach((po) => next.add(po.id));
      return next;
    });
  };

  const togglePo = (id) => {
    const assignment = poAssignmentMap.get(id);
    if (assignment && !assignment.reassignable) return;
    setSelectedPoIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const createSchedule = async () => {
    if (!canCreateShipment || !orderId || !shippingName.trim() || !factoryCode || !shippingDate || !selectedPoIds.size || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await createShippingSchedule(orderId, {
        shippingName: shippingName.trim(),
        factoryCode,
        exFtyDate: shippingDate,
        poIds: Array.from(selectedPoIds)
      });
      setSelectedPoIds(new Set());
      setShippingName('');
      setShippingDate('');
      setNotice({ severity: 'success', text: `${result?.schedule?.shippingName || result?.schedule?.scheduleNo || 'Shipment'} created. Use SEND TO WEIGHT in the table once its cartons are ready.` });
      setCreateOpen(false);
      setScheduleSearch('');
      setScheduleStatus('ALL');
      setScheduleFactory('ALL');
      setScheduleReadiness('ALL');
      setDateFrom('');
      setDateTo('');
      setSchedulePage(0);
      setHighlightShipmentId(result?.schedule?.id || null);
      await loadBase();
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };


  const sendToWeight = async (event, row) => {
    event.stopPropagation();
    const schedule = row?.schedule;
    if (!canCreateShipment || !orderId || !schedule?.id || busy || sendingShipmentId
      || !['PLANNED', 'REVIEWED'].includes(schedule.status) || !row?.readyToSendToWeight) return;
    setSendingShipmentId(schedule.id);
    setNotice(null);
    try {
      await sendShippingScheduleToWeight(orderId, schedule.id);
      setHighlightShipmentId(schedule.id);
      setNotice({ severity: 'success', text: `${schedule.shippingName || schedule.scheduleNo} sent to Carton Weight. Weight may now scan SSCC and weigh cartons.` });
      await loadBase();
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
      await loadBase();
    } finally {
      setSendingShipmentId(null);
    }
  };

  return (
    <Stack spacing={0.9} className="lululemon-compact-v16" sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader dense title="Shipment Management" />

      <Paper variant="outlined" sx={{ px: 1.25, py: 0.95, borderRadius: 2.2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={850}>Packing → Carton Weight</Typography>
            <Typography variant="caption" color="text.secondary">
              Picked PO → New Shipment → Send to Weight. Only sent shipments enter the weighing queue.
            </Typography>
          </Box>
          <Stack direction="row" gap={0.7} flexWrap="wrap" alignItems="center">
            <Button size="small" variant="outlined" startIcon={<AssignmentTurnedInOutlined />} disabled={!orderId || busy}
              onClick={() => navigate(`/buyers/${buyerSlug}/po-picking?orderId=${encodeURIComponent(orderId)}${factoryCode ? `&factory=${encodeURIComponent(factoryCode)}` : ''}`)}>
              PO Picking
            </Button>
            <Button size="small" variant="contained" startIcon={<LocalShippingOutlined />}
              disabled={!orderId || !canCreateShipment || busy} onClick={() => setCreateOpen(true)}>
              New Shipment
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {notice && !createOpen ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

      {canCreateShipment ? (
        <Dialog
          open={createOpen}
          onClose={(_, reason) => { if (!busy && reason !== 'backdropClick') setCreateOpen(false); }}
          fullWidth
          maxWidth="xl"
          fullScreen={false}
          aria-labelledby="create-shipment-dialog-title"
          PaperProps={{ sx: { borderRadius: 2, maxHeight: '94vh' } }}
        >
          <DialogTitle id="create-shipment-dialog-title" sx={{ py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" component="span" fontWeight={900}>New Shipment · Picked POs</Typography>
              <IconButton aria-label="Close New Shipment" size="small" onClick={() => setCreateOpen(false)} disabled={busy}><CloseRounded /></IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent dividers sx={{ p: { xs: 1, md: 1.5 } }}>
            <Stack id="lululemon-create-shipping-schedule" spacing={0.8}>
              {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
              <Stack spacing={0.8}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }}>
                  <TextField size="small" label="Shipment Name" value={shippingName}
                    onChange={(e) => setShippingName(e.target.value)} required inputProps={{ maxLength: 80 }}
                    placeholder="e.g. Canada Shipment - October" sx={{ minWidth: { md: 250 }, flex: { md: 1 } }}
                    disabled={!orderId || busy} />
                  <TextField select size="small" label="Packing Factory" value={factoryCode} onChange={(e) => { setFactoryCode(e.target.value); setSelectedPoIds(new Set()); setPoFilters(emptyPoFilters()); setPoSearch(''); setPoPage(0); }} sx={{ minWidth: 180 }} disabled={!orderId || busy}>
                    {createFactories.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
                  </TextField>
                  <TextField size="small" type="date" label="Shipping Date" InputLabelProps={{ shrink: true }} value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} disabled={!orderId || busy} sx={{ minWidth: 200 }} />
                  <Box sx={{ flex: 1 }} />
                  <Chip size="small" variant="outlined" label={`${selectedPoIds.size} PO selected`} color={selectedPoIds.size ? 'primary' : 'default'} />
                  <Button
                    variant="contained"
                    startIcon={<LocalShippingOutlined />}
                    onClick={createSchedule}
                    disabled={!orderId || !shippingName.trim() || !factoryCode || !shippingDate || !selectedPoIds.size || busy}
                    sx={{ minWidth: 190 }}
                  >
                    Create Shipment
                  </Button>
                </Stack>
    
                {!sales && <Alert severity="info" sx={{ py: 0.3 }}>
                  Only POs already PICKED for the selected Factory can be included. Create the Shipment, then use SEND TO WEIGHT in the table when the cartons are ready. Weight cannot receive it before you send.
                </Alert>}
                <Paper variant="outlined" sx={{ p: 0.8, borderRadius: 1.8, bgcolor: 'background.default' }}>
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', xl: 'row' }} spacing={0.8} alignItems={{ xl: 'center' }}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Quick search PO, SKU, Master PO, DC, Destination, Packing Plan, SO, Style, Color or Size..."
                        value={poSearch}
                        onChange={(e) => setPoSearch(e.target.value)}
                        disabled={!orderId || busy}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search fontSize="small" />
                            </InputAdornment>
                          )
                        }}
                      />
                      <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip size="small" variant="outlined" label={`${filteredPos.length} / ${creationPos.length} picked POs shown`} />
                        <Chip size="small" color={selectedPoIds.size ? 'primary' : 'default'} variant={selectedPoIds.size ? 'filled' : 'outlined'} label={`${selectedPoIds.size} selected`} />
                        <Button size="small" startIcon={<TuneRounded fontSize="small" />} variant={advancedFiltersOpen || activeFilterCount ? 'outlined' : 'text'} onClick={() => setAdvancedFiltersOpen((open) => !open)} aria-expanded={advancedFiltersOpen}>
                          Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
                        </Button>
                        <Button variant="outlined" size="small" onClick={toggleFilteredPos} disabled={!selectableFilteredPos.length || busy} sx={{ whiteSpace: 'nowrap' }}>
                          {allFilteredSelected ? 'Unselect Results' : `Select Results (${selectableFilteredPos.length})`}
                        </Button>
                        {selectedPoIds.size ? <Button size="small" onClick={() => setSelectedPoIds(new Set())} disabled={busy} sx={{ whiteSpace: 'nowrap' }}>Clear Selection</Button> : null}
                      </Stack>
                    </Stack>
    
                    <Collapse in={advancedFiltersOpen} unmountOnExit>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', xl: 'repeat(6, minmax(150px,1fr))' }, gap: 0.75, pt: 0.4 }}>
                        {FILTER_CONFIG.map(({ key, label }) => (
                          <MultiValueFilter
                            key={key}
                            label={label}
                            options={filterOptions[key] || []}
                            value={poFilters[key] || []}
                            onChange={(next) => updatePoFilter(key, next)}
                            disabled={!orderId || busy}
                          />
                        ))}
                      </Box>
                    </Collapse>
    
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.6} alignItems={{ md: 'center' }}>
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
                        {poSearch ? <Chip size="small" label={`Search: ${poSearch}`} onDelete={() => setPoSearch('')} /> : null}
                        {activeFilterChips.map((chip) => <Chip key={chip.key} size="small" variant="outlined" label={chip.label} onDelete={() => updatePoFilter(chip.key, [])} />)}
                      </Stack>
                      <Button size="small" startIcon={<ClearRounded />} onClick={clearAllFilters} disabled={!poSearch && !activeFilterCount}>Clear Filters</Button>
                    </Stack>
    
                    {selectedHiddenCount > 0 ? (
                      <Typography variant="caption" color="primary.main" fontWeight={800}>
                        {selectedHiddenCount} selected PO{selectedHiddenCount === 1 ? '' : 's'} are outside the current filters and remain selected.
                      </Typography>
                    ) : null}



                  </Stack>
                </Paper>

                <LululemonTableViewport sx={{ maxHeight: 410, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <SortableTable size="small" stickyHeader>
                    <TableHead><TableRow>
                      <TableCell padding="checkbox" data-sortable={false}>
                        <Checkbox
                          size="small"
                          checked={allPageSelected}
                          indeterminate={!allPageSelected && somePageSelected}
                          disabled={!selectablePagePos.length || busy}
                          onChange={togglePagePos}
                          inputProps={{ 'aria-label': 'Select all POs on this page' }}
                        />
                      </TableCell>
                      <TableCell>PO</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Master PO</TableCell>
                      <TableCell>DC / Destination</TableCell>
                      <TableCell>Channel</TableCell>
                      <TableCell>Packing Plan</TableCell>
                      <TableCell>SO (PTS)</TableCell>
                      <TableCell>Style / Color / Size</TableCell>
                      <TableCell data-sortable={false}>Availability</TableCell>
                    </TableRow></TableHead>
                    <TableBody>
                      {pagedPos.map((po) => {
                        const assignment = poAssignmentMap.get(po.id);
                        const locked = Boolean(assignment) && !assignment.reassignable;
                        const assigned = Boolean(assignment);
                        return (
                          <TableRow key={po.id} hover selected={selectedPoIds.has(po.id)} sx={{ opacity: locked ? 0.62 : 1, '&:nth-of-type(even)': { bgcolor: 'action.hover' } }}>
                            <TableCell padding="checkbox"><Checkbox size="small" checked={selectedPoIds.has(po.id)} disabled={locked || busy} onChange={() => togglePo(po.id)} /></TableCell>
                            <TableCell sx={{ fontWeight: 900, whiteSpace: 'nowrap' }}>{po.poNumber}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{po.sku || <Chip size="small" label="Not scanned" color="warning" variant="outlined" />}</TableCell>
                            <TableCell>{value(po.masterPo)}</TableCell>
                            <TableCell sx={{ minWidth: 190 }}><Typography variant="body2" fontWeight={800}>{value(po.dcCode)}</Typography><Typography variant="caption" color="text.secondary">{value(po.destination)}</Typography></TableCell>
                            <TableCell>{value(po.channel)}</TableCell>
                            <TableCell>{value(po.packingPlan)}</TableCell>
                            <TableCell>{value(po.salesOrderPts)}</TableCell>
                            <TableCell sx={{ minWidth: 190 }}><Typography variant="body2" fontWeight={800}>{value(po.style)}</Typography><Typography variant="caption" color="text.secondary">{value(po.color)} · Size {value(po.size)}</Typography></TableCell>
                            <TableCell><Chip size="small" label={locked ? `Locked · ${assignment.scheduleNo}` : assigned ? `Reassign · ${assignment.scheduleNo}` : 'Available'} color={locked ? 'default' : assigned ? 'warning' : 'success'} variant={locked ? 'outlined' : 'filled'} /></TableCell>
                          </TableRow>
                        );
                      })}
                      {!filteredPos.length ? (
                        <TableRow><TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                          <Typography fontWeight={850}>{!orderId ? 'Select an Order first.' : !factoryCode ? 'Select a Packing Factory first.' : !creationPos.length ? 'No picked POs are available for this Factory.' : 'No PO matches the current filters.'}</Typography>
                          {orderId && factoryCode && !creationPos.length ? (
                            <Button size="small" onClick={() => navigate(`/buyers/${buyerSlug}/po-picking?orderId=${encodeURIComponent(orderId)}&factory=${encodeURIComponent(factoryCode)}`)}>Go to PO Picking</Button>
                          ) : orderId ? <Typography variant="caption" color="text.secondary">Clear one or more filters to broaden the results.</Typography> : null}
                        </TableCell></TableRow>
                      ) : null}
                    </TableBody>
                  </SortableTable>
                </LululemonTableViewport>
                <TablePagination
                  component="div"
                  count={filteredPos.length}
                  page={poPage}
                  onPageChange={(_, nextPage) => setPoPage(nextPage)}
                  rowsPerPage={poRowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setPoRowsPerPage(Number(event.target.value));
                    setPoPage(0);
                  }}
                  rowsPerPageOptions={[25, 50, 100]}
                  labelRowsPerPage="Rows per page"
                  showFirstButton
                  showLastButton
                  sx={{ borderTop: '1px solid', borderColor: 'divider' }}
                />
              </Stack>
            </Stack>
          </DialogContent>
        </Dialog>
      ) : null}

      <Paper id="lululemon-shipment-list" variant="outlined" sx={{ borderRadius: 2.2, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }} justifyContent="space-between"
          sx={{ px: 1, py: 0.85, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box>
            <Typography fontWeight={950}>Shipments</Typography>
            <Typography variant="caption" color="text.secondary">Pick PO → New Shipment (popup) → SEND TO WEIGHT in this table → Weight scans SSCC and weighs.</Typography>
          </Box>
          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
            <Chip size="small" variant="outlined" label={`${filteredSchedules.length} Shipments`} />
            {canCreateShipment ? (
              <Button variant="contained" size="small"
                startIcon={<LocalShippingOutlined />} onClick={() => { setNotice(null); setCreateOpen(true); }}
                disabled={!orderId || busy} aria-haspopup="dialog" aria-controls="create-shipment-dialog-title">
                New Shipment
              </Button>
            ) : null}
            <Button variant="outlined" size="small" startIcon={<Refresh />} onClick={loadBase} disabled={!orderId || busy}>Refresh</Button>
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} sx={{ px: 1, py: 0.9 }} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 190 }}>
            <OrderScope value={orderId} onChange={setOrderId} disabled={busy} embedded compact />
          </Box>
          <TextField size="small" placeholder="Search Shipment Name, code, factory, PO..." value={scheduleSearch}
            onChange={(event) => setScheduleSearch(event.target.value)}
            sx={{ flex: 1.2, minWidth: 210 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
          <TextField select size="small" label="Status" value={scheduleStatus}
            onChange={(event) => setScheduleStatus(event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="ALL">All statuses</MenuItem>
            {[...new Set(schedules.map((row) => row?.schedule?.status).filter(Boolean))].sort().map((status) =>
              <MenuItem key={status} value={status}>{status.replaceAll('_', ' ')}</MenuItem>)}
          </TextField>
          <Button size="small" startIcon={<TuneRounded />} variant={scheduleFiltersOpen || shipmentFilterCount ? 'outlined' : 'text'}
            onClick={() => setScheduleFiltersOpen((open) => !open)} aria-expanded={scheduleFiltersOpen}>
            Filters{shipmentFilterCount ? ` (${shipmentFilterCount})` : ''}
          </Button>
          <Button size="small" color="inherit" startIcon={<ClearRounded />}
            disabled={!scheduleSearch && scheduleStatus === 'ALL' && !shipmentFilterCount}
            onClick={clearShipmentFilters}>Clear</Button>
        </Stack>

        <Collapse in={scheduleFiltersOpen} unmountOnExit>
          <Box sx={{ px: 1, pb: 0.9, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 0.75 }}>
            <TextField select size="small" label="Factory" value={scheduleFactory} onChange={(event) => setScheduleFactory(event.target.value)}>
              <MenuItem value="ALL">All factories</MenuItem>
              {[...new Set(schedules.map((row) => row?.schedule?.factoryCode).filter(Boolean))]
                .filter((factory) => sales || assignedFactories.includes(factory)).sort()
                .map((factory) => <MenuItem key={factory} value={factory}>{factory}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Readiness" value={scheduleReadiness} onChange={(event) => setScheduleReadiness(event.target.value)}>
              <MenuItem value="ALL">All readiness</MenuItem>
              <MenuItem value="READY">Ready to weigh</MenuItem>
              <MenuItem value="NOT_READY">Action required</MenuItem>
            </TextField>
            <TextField size="small" type="date" label="Shipping Date From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <TextField size="small" type="date" label="Shipping Date To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </Box>
        </Collapse>

        <LululemonTableViewport sx={{ border: 0, borderRadius: 0 }}>
          <SortableTable size="small" stickyHeader rowNumberStart={schedulePage * scheduleRowsPerPage}>
            <TableHead><TableRow>
              <TableCell>Shipment Name</TableCell>
              <TableCell>Shipping Date</TableCell>
              <TableCell>Factory</TableCell>
              <TableCell>POs</TableCell>
              <TableCell>Cartons</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Readiness</TableCell>
              <TableCell data-sortable={false} align="right">Action</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {pagedSchedules.map((row) => {
                const schedule = row?.schedule || {};
                const open = () => navigate(`/buyers/${buyerSlug}/shipping/review/${encodeURIComponent(schedule.id)}?orderId=${encodeURIComponent(orderId)}`);
                return (
                  <TableRow key={schedule.id} hover sx={{ cursor: 'pointer', bgcolor: schedule.id === highlightShipmentId ? '#EFF6FF' : undefined }} onDoubleClick={open}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={900}>{schedule.shippingName || schedule.scheduleNo || '—'} {schedule.id === highlightShipmentId && ['PLANNED', 'REVIEWED'].includes(schedule.status) ? <Chip label="NEW" size="small" color="primary" variant="outlined" sx={{ ml: 0.5, height: 19 }} /> : null}</Typography>
                      {schedule.shippingName ? <Typography variant="caption" color="text.secondary">{schedule.scheduleNo}</Typography> : null}
                    </TableCell>
                    <TableCell>{schedule.exFtyDate || '—'}</TableCell>
                    <TableCell>{schedule.factoryCode || '—'}</TableCell>
                    <TableCell>{row.totalPos ?? schedule.poIds?.length ?? 0}</TableCell>
                    <TableCell>{row.totalCartons ?? 0}</TableCell>
                    <TableCell><Chip size="small" variant="outlined" color={schedule.status === 'COMPLETED' && schedule.rfidReviewStatus && schedule.rfidReviewStatus !== 'PASS' ? 'warning' : schedule.status === 'COMPLETED' ? 'success' : schedule.status === 'SENT_TO_WEIGHT' ? 'primary' : 'default'}
                      label={schedule.status === 'COMPLETED' && schedule.rfidReviewStatus
                        ? `WEIGHT COMPLETE · RFID ${schedule.rfidReviewStatus === 'PASS' ? 'VERIFIED' : schedule.rfidReviewStatus}`
                        : (schedule.status || 'PLANNED').replaceAll('_', ' ')} /></TableCell>
                    <TableCell><Chip size="small" variant="outlined"
                      color={schedule.status === 'COMPLETED' ? 'success' : ['SENT_TO_WEIGHT', 'WEIGHING'].includes(schedule.status) ? 'primary' : row.readyToSendToWeight ? 'success' : 'warning'}
                      label={schedule.status === 'COMPLETED' ? 'WEIGHT COMPLETE' : ['SENT_TO_WEIGHT', 'WEIGHING'].includes(schedule.status) ? 'AT WEIGHING' : row.readyToSendToWeight ? 'READY TO SEND' : 'PACKING REQUIRED'} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        {canCreateShipment && ['PLANNED', 'REVIEWED'].includes(schedule.status) ? (
                          <Button size="small" color="success" variant="contained" startIcon={<ScaleOutlined />}
                            onClick={(event) => sendToWeight(event, row)}
                            disabled={!row.readyToSendToWeight || Boolean(schedule.weighingOrderId) || busy || Boolean(sendingShipmentId)}
                            title={!row.readyToSendToWeight ? 'Complete Packing SSCC, Qty and SKU before sending.' : 'Release Shipment to Carton Weight'}>
                            {sendingShipmentId === schedule.id ? 'Sending...' : 'Send to Weight'}
                          </Button>
                        ) : null}
                        <Button size="small" variant="outlined" endIcon={<ArrowForwardRounded />} onClick={open}>Details</Button>
                        {canRemoveShipment(schedule) ? (
                          <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineRounded />}
                            disabled={busy} onClick={(event) => removeShipment(event, schedule)}>Remove</Button>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!pagedSchedules.length ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                {orderId ? 'No shipments match the current Order and filters.' : 'Select an Order to view shipments.'}
              </TableCell></TableRow> : null}
            </TableBody>
          </SortableTable>
        </LululemonTableViewport>
        <TablePagination component="div" count={filteredSchedules.length} page={schedulePage}
          onPageChange={(_, next) => setSchedulePage(next)} rowsPerPage={scheduleRowsPerPage}
          onRowsPerPageChange={(event) => { setScheduleRowsPerPage(Number(event.target.value)); setSchedulePage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]} showFirstButton showLastButton
          sx={{ borderTop: '1px solid', borderColor: 'divider' }} />
      </Paper>
    </Stack>
  );
}
