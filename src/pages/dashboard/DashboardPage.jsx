import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import { ArrowForward, StoreOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import ManagementTable from 'components/ManagementTable';
import { CompactPageHeader } from 'components/CompactPageHeader';
import { getCartonDashboard } from 'services/managementService';
import { readStoredUser } from 'utils/accessControl';
import { getAccessibleBuyers, saveSelectedBuyer } from 'utils/buyerAccess';
import { DEFAULT_TABLE_ROWS_PER_PAGE } from '../../constants/appConstants';

const metricLabels = [
  ['totalOrders', 'Orders'], ['totalPos', 'PO'], ['totalCartons', 'Cartons'], ['totalItems', 'Items'],
  ['assignedIdentities', 'Assigned Barcode / SSCC'], ['completedCartons', 'Completed Cartons'], ['weightWarnings', 'Weight Warnings'], ['shipments', 'Shipments']
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_TABLE_ROWS_PER_PAGE);
  const accessibleBuyers = useMemo(() => getAccessibleBuyers(readStoredUser()), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCartonDashboard()
      .then((value) => alive && setData(value))
      .catch((e) => alive && setError(e?.response?.data?.message || e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const buyerSummary = data?.buyers || [];
  const visible = useMemo(() => buyerSummary.slice(page * size, page * size + size), [buyerSummary, page, size]);

  const openBuyer = (buyer) => {
    saveSelectedBuyer(buyer);
    navigate(`/buyers/${buyer.slug}/orders`);
  };

  const summaryFor = (buyer) => buyerSummary.find((row) => row.buyerCode === buyer.code) || {};

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <CompactPageHeader
          title="Carton Loading Dashboard"
          subtitle="Orders, PO, Cartons, Items, barcode/SSCC, weight and shipment status."
          actions={<Button size="small" variant="contained" startIcon={<StoreOutlined />} onClick={() => navigate('/workflow')}>Buyer Workspaces</Button>}
        />

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Grid container spacing={1}>
          {metricLabels.map(([key, label]) => (
            <Grid item xs={6} md={3} key={key}>
              <Card variant="outlined" sx={{ height: '100%', borderRadius: 2 }}>
                <CardContent>
                  <Typography color="text.secondary" variant="body2">{label}</Typography>
                  <Typography variant="h4" fontWeight={900} sx={{ mt: 0.5 }}>
                    {loading ? '…' : Number(data?.[key] || 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box>
          <Typography variant="h5" fontWeight={900}>Buyer Overview</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.35, mb: 1.25 }}>
            Open a Buyer to manage its own Orders. Each Order contains only its own PO → Carton → Item hierarchy.
          </Typography>
          <Grid container spacing={1.5}>
            {accessibleBuyers.map((buyer) => {
              const summary = summaryFor(buyer);
              return (
                <Grid item xs={12} md={6} xl={4} key={buyer.code}>
                  <Card
                    variant="outlined"
                    onClick={() => openBuyer(buyer)}
                    sx={{
                      cursor: 'pointer',
                      height: '100%',
                      borderRadius: 2.5,
                      transition: 'transform 120ms ease, box-shadow 120ms ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                    }}
                  >
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
                            <StoreOutlined />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" fontWeight={900}>{buyer.label}</Typography>
                            <Typography variant="body2" color="text.secondary">{buyer.code}</Typography>
                          </Box>
                          <Chip size="small" label="Open" variant="outlined" />
                        </Stack>

                        <Grid container spacing={1}>
                          {[
                            ['Orders', summary.orders],
                            ['PO', summary.pos],
                            ['Cartons', summary.cartons],
                            ['Items', summary.items]
                          ].map(([label, value]) => (
                            <Grid item xs={3} key={label}>
                              <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: '#F8FAFC', textAlign: 'center' }}>
                                <Typography fontWeight={900}>{Number(value || 0).toLocaleString()}</Typography>
                                <Typography variant="caption" color="text.secondary">{label}</Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>

                        <Button endIcon={<ArrowForward />} onClick={(e) => { e.stopPropagation(); openBuyer(buyer); }} sx={{ alignSelf: 'flex-start' }}>
                          View Orders
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        <ManagementTable
          title="Buyer Summary"
          rows={visible}
          count={buyerSummary.length}
          page={page}
          rowsPerPage={size}
          loading={loading}
          onPageChange={setPage}
          onRowsPerPageChange={(value) => { setSize(value); setPage(0); }}
          columns={[
            { key: 'buyerCode', label: 'Buyer' },
            { key: 'orders', label: 'Orders' },
            { key: 'pos', label: 'PO' },
            { key: 'cartons', label: 'Cartons' },
            { key: 'items', label: 'Items' },
            { key: 'completedCartons', label: 'Completed' },
            { key: 'weightWarnings', label: 'Weight Warnings' }
          ]}
        />
      </Stack>
    </Box>
  );
}
