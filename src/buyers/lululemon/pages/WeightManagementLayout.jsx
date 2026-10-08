import PropTypes from 'prop-types';
import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { HistoryOutlined, ScaleOutlined } from '@mui/icons-material';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';

/** Common horizontal navigation for the two existing LULULEMON weight routes. */
export default function WeightManagementLayout({ children }) {
  const { buyerSlug } = useParams();
  const { pathname } = useLocation();
  const selectedTab = pathname.endsWith('/weight-history') ? 'weight-history' : 'weighing';

  return (
    <Box sx={{ minWidth: 0 }}>
      <Paper
        variant="outlined"
        sx={{
          mx: { xs: 0.25, md: 0.5 },
          mt: { xs: 0.25, md: 0.5 },
          mb: 1,
          px: { xs: 1, sm: 1.5 },
          pt: 1,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 0.3 }}>
          Weight Management
        </Typography>
        <Tabs
          value={selectedTab}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Weight Management tabs"
          sx={{ minHeight: 42, '& .MuiTab-root': { minHeight: 42, textTransform: 'none', fontWeight: 750 } }}
        >
          <Tab
            component={RouterLink}
            to={`/buyers/${buyerSlug}/weighing`}
            value="weighing"
            label="Carton Weight"
            icon={<ScaleOutlined fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            component={RouterLink}
            to={`/buyers/${buyerSlug}/weight-history`}
            value="weight-history"
            label="Weight History"
            icon={<HistoryOutlined fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>
      {children}
    </Box>
  );
}

WeightManagementLayout.propTypes = { children: PropTypes.node.isRequired };
