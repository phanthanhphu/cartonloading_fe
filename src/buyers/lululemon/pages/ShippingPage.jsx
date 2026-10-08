import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
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
  FactCheckOutlined,
  LocalShippingOutlined,
  Refresh,
  Search
} from '@mui/icons-material';
import SortableTable from 'components/SortableTable';
import LululemonTableViewport from '../components/LululemonTableViewport';
import OperationWorkspaceDialog from '../components/OperationWorkspaceDialog';
import { CompactPageHeader } from 'components/CompactPageHeader';
import { canManageSales } from 'utils/accessControl';
import OrderScope from '../components/OrderScope';
import { createShippingSchedule, listAllPos, listShippingSchedules } from '../services/service';
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

function SectionHeading({ tag, title, subtitle, action }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Chip size="small" color="primary" variant="outlined" label={tag} sx={{ mt: 0.15, fontWeight: 900 }} />
        <Box>
          <Typography fontWeight={950}>{title}</Typography>
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        </Box>
      </Stack>
      {action || null}
    </Stack>
  );
}

export default function ShippingPage() {
  const sales = canManageSales();
  const navigate = useNavigate();
  const { buyerSlug } = useParams();
  const [orderId, setOrderId] = useState('');
  const [pos, setPos] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedPoIds, setSelectedPoIds] = useState(() => new Set());
  const [poSearch, setPoSearch] = useState('');
  const [poFilters, setPoFilters] = useState(() => emptyPoFilters());
  const [factoryCode, setFactoryCode] = useState('');
  const [shippingDate, setShippingDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [poPage, setPoPage] = useState(0);
  const [poRowsPerPage, setPoRowsPerPage] = useState(25);

  const loadBase = useCallback(async () => {
    if (!orderId) {
      setPos([]);
      setSchedules([]);
      return;
    }
    setBusy(true);
    try {
      const [poRows, scheduleRows] = await Promise.all([listAllPos(orderId), listShippingSchedules(orderId)]);
      setPos(Array.isArray(poRows) ? poRows : []);
      setSchedules(Array.isArray(scheduleRows) ? scheduleRows : []);
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }, [orderId]);

  useEffect(() => {
    setSelectedPoIds(new Set());
    setFactoryCode('');
    setShippingDate('');
    setPoSearch('');
    setPoFilters(emptyPoFilters());
    setPoPage(0);
    setCreateOpen(false);
    loadBase();
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignedOpenPoIds = useMemo(() => {
    const ids = new Set();
    schedules.forEach((row) => {
      if (row?.schedule?.status === 'COMPLETED') return;
      (row?.schedule?.poIds || []).forEach((id) => ids.add(id));
    });
    return ids;
  }, [schedules]);

  const filterOptions = useMemo(() => ({
    poNumber: uniqueSorted(pos, 'poNumber'),
    masterPo: uniqueSorted(pos, 'masterPo'),
    dcDestination: uniquePairOptions(pos, 'dcCode', 'destination'),
    packingPlan: uniqueSorted(pos, 'packingPlan'),
    salesOrderPts: uniqueSorted(pos, 'salesOrderPts'),
    styleColor: uniquePairOptions(pos, 'style', 'color'),
    size: uniqueSorted(pos, 'size')
  }), [pos]);

  const activeFilterCount = useMemo(
    () => FILTER_CONFIG.filter(({ key }) => (poFilters[key] || []).length > 0).length,
    [poFilters]
  );

  const filteredPos = useMemo(() => {
    const tokens = poSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return pos.filter((po) => {
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
  }, [pos, poSearch, poFilters]);

  const selectableFilteredPos = useMemo(
    () => filteredPos.filter((po) => !assignedOpenPoIds.has(po.id)),
    [filteredPos, assignedOpenPoIds]
  );

  const pagedPos = useMemo(() => {
    const start = poPage * poRowsPerPage;
    return filteredPos.slice(start, start + poRowsPerPage);
  }, [filteredPos, poPage, poRowsPerPage]);

  const selectablePagePos = useMemo(
    () => pagedPos.filter((po) => !assignedOpenPoIds.has(po.id)),
    [pagedPos, assignedOpenPoIds]
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
    if (assignedOpenPoIds.has(id)) return;
    setSelectedPoIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const createSchedule = async () => {
    if (!sales || !orderId || !factoryCode || !shippingDate || !selectedPoIds.size || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await createShippingSchedule(orderId, {
        factoryCode,
        exFtyDate: shippingDate,
        poIds: Array.from(selectedPoIds)
      });
      setSelectedPoIds(new Set());
      setNotice({ severity: 'success', text: `${result?.schedule?.scheduleNo || 'Shipping Schedule'} created for Factory ${factoryCode}. Open Schedule Review to monitor it.` });
      setCreateOpen(false);
      await loadBase();
    } catch (error) {
      setNotice({ severity: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const openScheduleReview = () => {
    const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
    navigate(`/buyers/${buyerSlug}/shipping/review${query}`);
  };

  return (
    <Stack spacing={0.9} sx={{ p: { xs: 0.25, md: 0.5 } }}>
      <CompactPageHeader
        dense
        title="Shipping Schedule"
        subtitle="Sales creates shipment schedules. Packing reviews assigned schedules on a separate operational page."
        actions={<Button size="small" startIcon={<Refresh />} onClick={loadBase} disabled={!orderId || busy}>Refresh</Button>}
      />

      <OrderScope value={orderId} onChange={setOrderId} disabled={busy} />
      {notice && !createOpen ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}

      {!sales ? (
        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="outlined"
            startIcon={<FactCheckOutlined />}
            endIcon={<ArrowForwardRounded />}
            onClick={openScheduleReview}
            disabled={!orderId}
            sx={{ fontWeight: 850 }}
          >
            Open Schedule Review
          </Button>
        </Stack>
      ) : null}

      {sales ? (
        <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 2.2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }} justifyContent="space-between">
            <Box>
              <Typography fontWeight={950}>Shipping Schedule</Typography>
              <Typography variant="caption" color="text.secondary">Create a Shipping Schedule in a focused window, or open the Packing review list.</Typography>
            </Box>
            <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
              <Button variant="contained" startIcon={<LocalShippingOutlined />} onClick={() => setCreateOpen(true)} disabled={!orderId || busy}>
                Create Shipping Schedule
              </Button>
              <Button variant="outlined" startIcon={<FactCheckOutlined />} endIcon={<ArrowForwardRounded />} onClick={openScheduleReview} disabled={!orderId}>
                Open Schedule Review
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <OperationWorkspaceDialog
        open={Boolean(sales && createOpen)}
        onClose={() => setCreateOpen(false)}
        disableClose={busy}
        title="Create Shipping Schedule"
        subtitle={orderId ? 'Choose Factory, Shipping Date and logical POs for this Shipping List.' : 'Select an Order first.'}
      >
        <Stack spacing={0.8}>
          {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
          <Box sx={{ p: 0.95, borderBottom: '1px solid', borderColor: 'divider' }}>
            <SectionHeading
              tag="SALES"
              title="Create Shipping Schedule"
              subtitle="Choose Factory and shipping date, then select the exact logical PO records to assign."
            />
          </Box>

          <Stack spacing={0.8} sx={{ p: 0.95 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }}>
              <TextField select size="small" label="Factory" value={factoryCode} onChange={(e) => setFactoryCode(e.target.value)} sx={{ minWidth: 180 }} disabled={!orderId || busy}>
                {FACTORY_CODES.map((code) => <MenuItem key={code} value={code}>{code}</MenuItem>)}
              </TextField>
              <TextField size="small" type="date" label="Shipping Date" InputLabelProps={{ shrink: true }} value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} disabled={!orderId || busy} sx={{ minWidth: 200 }} />
              <Box sx={{ flex: 1 }} />
              <Chip size="small" variant="outlined" label={`${selectedPoIds.size} PO selected`} color={selectedPoIds.size ? 'primary' : 'default'} />
              <Button
                variant="contained"
                startIcon={<LocalShippingOutlined />}
                onClick={createSchedule}
                disabled={!orderId || !factoryCode || !shippingDate || !selectedPoIds.size || busy}
                sx={{ minWidth: 190 }}
              >
                Create Schedule
              </Button>
            </Stack>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<FactCheckOutlined />}
                endIcon={<ArrowForwardRounded />}
                onClick={openScheduleReview}
                disabled={!orderId}
                sx={{ fontWeight: 850 }}
              >
                Open Schedule Review
              </Button>
            </Stack>

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
                    <Chip size="small" variant="outlined" label={`${filteredPos.length} / ${pos.length} shown`} />
                    <Chip size="small" color={selectedPoIds.size ? 'primary' : 'default'} variant={selectedPoIds.size ? 'filled' : 'outlined'} label={`${selectedPoIds.size} selected`} />
                    <Button variant="outlined" size="small" onClick={toggleFilteredPos} disabled={!selectableFilteredPos.length || busy} sx={{ whiteSpace: 'nowrap' }}>
                      {allFilteredSelected ? 'Unselect Results' : `Select Results (${selectableFilteredPos.length})`}
                    </Button>
                    {selectedPoIds.size ? <Button size="small" onClick={() => setSelectedPoIds(new Set())} disabled={busy} sx={{ whiteSpace: 'nowrap' }}>Clear Selection</Button> : null}
                  </Stack>
                </Stack>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', xl: 'repeat(6, minmax(150px,1fr))' }, gap: 0.75 }}>
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

                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.6} alignItems={{ md: 'center' }}>
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" alignItems="center">
                    {poSearch ? <Chip size="small" label={`Search: ${poSearch}`} onDelete={() => setPoSearch('')} /> : null}
                    {activeFilterChips.map((chip) => <Chip key={chip.key} size="small" variant="outlined" label={chip.label} onDelete={() => updatePoFilter(chip.key, [])} />)}
                    {!poSearch && !activeFilterChips.length ? <Typography variant="caption" color="text.secondary">Multiple values in the same filter are OR. Different filters are combined as AND.</Typography> : null}
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
                    const locked = assignedOpenPoIds.has(po.id);
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
                        <TableCell><Chip size="small" label={locked ? 'Assigned' : 'Available'} color={locked ? 'default' : 'success'} variant={locked ? 'outlined' : 'filled'} /></TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredPos.length ? (
                    <TableRow><TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                      <Typography fontWeight={850}>{orderId ? 'No PO matches the current filters.' : 'Select an Order first.'}</Typography>
                      {orderId ? <Typography variant="caption" color="text.secondary">Clear one or more filters to broaden the results.</Typography> : null}
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
        </Paper>
        </Stack>
      </OperationWorkspaceDialog>
    </Stack>
  );
}
