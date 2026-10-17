import { Box, Paper, Tab, Tabs, Typography, Alert } from '@mui/material';
import { HistoryOutlined, ScaleOutlined } from '@mui/icons-material';
import { Link as RouterLink, Navigate, useLocation, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { canManageSales, canWeightCheck, getWeighingFactoryPermissions, isAdmin } from 'utils/accessControl';

const ALL_FACTORIES = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'];

/**
 * Weight Management has one main-menu item and horizontal factory tabs.
 * Weighing operators see ONLY their Admin-assigned Packing Factories. Switching
 * factories updates the URL and resets page-local state; the existing weighing
 * services, workflows and backend authorization are unchanged.
 */
export default function WeightManagementLayout({ children }) {
  const { buyerSlug } = useParams();
  const { pathname, search } = useLocation();
  const selectedTab = pathname.endsWith('/weight-history') ? 'weight-history' : 'weighing';

  const supervisor = isAdmin() || canManageSales();
  const weighingOperator = canWeightCheck() && !supervisor;
  const showFactoryTabs = supervisor || weighingOperator;
  const assignedFactories = supervisor ? ALL_FACTORIES : weighingOperator ? getWeighingFactoryPermissions() : [];
  const requestedFactory = String(new URLSearchParams(search).get('factory') || '').trim().toUpperCase();
  const hasValidSelection = supervisor
    ? (!requestedFactory || assignedFactories.includes(requestedFactory))
    : assignedFactories.includes(requestedFactory);

  // Never display unrestricted Factory data when a Weighing account opens the
  // base URL, a bookmark for a revoked Factory, or edits ?factory manually.
  // The server remains responsible for enforcing every weighing operation.
  if (weighingOperator && assignedFactories.length === 0) {
    return <Alert severity="warning">No Packing Factory has been assigned for weighing. Please contact Admin.</Alert>;
  }
  if (showFactoryTabs && !hasValidSelection) {
    const fallback = supervisor ? '' : assignedFactories[0];
    return <Navigate replace to={`${pathname}${fallback ? `?factory=${fallback}` : ''}`} />;
  }

  const tabValue = supervisor ? (requestedFactory || 'ALL') : requestedFactory;
  const factoryTabs = supervisor ? ['ALL', ...assignedFactories] : assignedFactories;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Paper
        variant="outlined"
        sx={{
          mx: { xs: 0.25, md: 0.5 },
          mt: { xs: 0.2, md: 0.35 },
          mb: 0.4,
          px: { xs: 0.7, sm: 1.0 },
          pt: 0.15,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        {showFactoryTabs ? (
          <>
            <Typography variant="caption" fontWeight={750} color="text.secondary" sx={{ display: 'block', pt: 0.75, pl: 1 }}>
              Factory · Weighing
            </Typography>
            <Tabs
              value={tabValue}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Assigned Packing Factory tabs"
              sx={{ minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.5, textTransform: 'none', fontWeight: 800 } }}
            >
              {factoryTabs.map((factory) => (
                <Tab
                  key={factory}
                  component={RouterLink}
                  to={`${pathname}${factory === 'ALL' ? '' : `?factory=${factory}`}`}
                  value={factory}
                  label={factory === 'ALL' ? 'All Factories' : factory}
                />
              ))}
            </Tabs>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mx: 0.5 }} />
          </>
        ) : null}
        <Tabs
          value={selectedTab}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Weight Management tabs"
          sx={{ minHeight: 34, '& .MuiTab-root': { minHeight: 34, py: 0.4, textTransform: 'none', fontWeight: 750 } }}
        >
          <Tab
            component={RouterLink}
            to={`/buyers/${buyerSlug}/weighing${search}`}
            value="weighing"
            label="Carton Weight"
            icon={<ScaleOutlined fontSize="small" />}
            iconPosition="start"
          />
          <Tab
            component={RouterLink}
            to={`/buyers/${buyerSlug}/weight-history${search}`}
            value="weight-history"
            label="Weight History"
            icon={<HistoryOutlined fontSize="small" />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>
      {/* A factory switch must not retain the previous factory's selected PO,
          shipping list, active UI dialogs, or temporary search results. */}
      <Box key={`${selectedTab}:${showFactoryTabs ? tabValue : 'legacy'}`}>
        {children}
      </Box>
    </Box>
  );
}

WeightManagementLayout.propTypes = { children: PropTypes.node.isRequired };
