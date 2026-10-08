
import { APP_MESSAGES } from '../../constants/appMessages';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography
} from '@mui/material';
import { ArrowForward, StoreOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { CompactPageHeader } from 'components/CompactPageHeader';
import { getCartonDashboard } from 'services/managementService';
import { readStoredUser } from 'utils/accessControl';
import { getAccessibleBuyers, saveSelectedBuyer } from 'utils/buyerAccess';

export default function WorkflowHomePage() {
  const navigate = useNavigate();
  const buyers = useMemo(() => getAccessibleBuyers(readStoredUser()), []);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getCartonDashboard()
      .then((result) => alive && setSummary(result?.buyers || []))
      .catch(() => alive && setSummary([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const openBuyer = (buyer) => {
    saveSelectedBuyer(buyer);
    navigate(`/buyers/${buyer.slug}/orders`);
  };

  const buyerSummary = (buyer) => summary.find((row) => row.buyerCode === buyer.code) || {};

  return (
    <Box sx={{ p: { xs: 0.75, md: 1 } }}>
      <Stack spacing={1}>
        <CompactPageHeader
          title="Buyer Workspaces"
          subtitle="Choose a Buyer, then work through Order → PO → Carton → Item."
        />

        {!buyers.length ? <Alert severity="warning">{APP_MESSAGES.NO_BUYER_ACCESS_CONTACT_ADMIN}</Alert> : null}
        {loading ? <LinearProgress /> : null}

        <Grid container spacing={1}>
          {buyers.map((buyer) => {
            const stats = buyerSummary(buyer);
            return (
              <Grid item xs={12} md={6} xl={4} key={buyer.code}>
                <Card
                  variant="outlined"
                  onClick={() => openBuyer(buyer)}
                  sx={{
                    height: '100%',
                    borderRadius: 2,
                    cursor: 'pointer',
                    borderColor: '#DCE4EC',
                    transition: 'box-shadow 120ms ease, border-color 120ms ease',
                    '&:hover': { boxShadow: 2, borderColor: 'primary.light' }
                  }}
                >
                  <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 1.5, bgcolor: '#EEF5FC', color: '#245B8E' }}>
                          <StoreOutlined fontSize="small" />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h5" fontWeight={850}>{buyer.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{buyer.code}</Typography>
                        </Box>
                        <Chip size="small" label="Active" color="success" variant="outlined" />
                      </Stack>

                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {[
                          ['Orders', stats.orders], ['PO', stats.pos], ['Cartons', stats.cartons], ['Items', stats.items]
                        ].map(([label, count]) => <Chip key={label} size="small" variant="outlined" label={`${label}: ${Number(count || 0).toLocaleString()}`} />)}
                      </Stack>

                      <Button size="small" endIcon={<ArrowForward />} onClick={(event) => { event.stopPropagation(); openBuyer(buyer); }} sx={{ alignSelf: 'flex-start' }}>
                        Open Orders
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Stack>
    </Box>
  );
}
