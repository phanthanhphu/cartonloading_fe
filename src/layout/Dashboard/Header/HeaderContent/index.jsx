import { useMemo } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Profile from './Profile';
import WorkingContextSwitcher from './WorkingContextSwitcher';
import { getBuyerBySlug } from '../../../../utils/buyerAccess';
// Every real route gets an explicit page name. Keep specific routes above generic ones.
// The app bar owns the page title; page bodies display only functional controls.
const PAGE_MAP = [
  { path: '/', title: 'Carton Loading Dashboard', section: 'Supply Chain' },
  { path: '/workflow', title: 'Carton Loading Dashboard', section: 'Supply Chain' },
  { path: '/dashboard', title: 'Carton Loading Dashboard', section: 'Supply Chain' },
  { path: '/orders-management', title: 'Orders', section: 'Supply Chain' },
  { path: '/users', title: 'User Management', section: 'Administration' },
  { path: '/departments', title: 'Factory & Department Management', section: 'Administration' },
  { path: '/buyers', title: 'Buyer Management', section: 'Administration' },
  { path: '/audit-logs', title: 'Audit Trail', section: 'History' },
  { path: '/scale-stations', title: 'Scale Stations', section: 'Factory Tools' },
  { path: '/barcode-management', title: 'Barcode Inventory', section: 'Factory Tools' },
  { path: '/assign-barcode/:buyerSlug/:orderId', title: 'Assign Barcode for Carton', section: 'Factory Tools' },
  { path: '/assign-barcode', title: 'Assign Barcode for Carton', section: 'Factory Tools' },
  { path: '/sales/shipment-planning', title: 'Sales Shipment Planning', section: 'Supply Chain' },
  { path: '/sales/shipment-plans', title: 'Sales Shipment Planning', section: 'Supply Chain' },
  { path: '/packing/shipments/:buyerSlug/:shipmentId', title: 'Packing Weight Check & Dispatch', section: 'Operations' },
  { path: '/packing/shipments', title: 'Packing Weight Check & Dispatch', section: 'Operations' },
  { path: '/shipment-management', title: 'Carton & Shipment Tracking', section: 'Supply Chain' },
  { path: '/weight-check', title: 'Packing Weight Check & Dispatch', section: 'Operations' },

  // Dedicated LULULEMON admin/history routes (URLs remain unchanged).
  { path: '/buyers/:buyerSlug/rfid-devices', title: 'Device Management', section: 'Administration' },
  { path: '/buyers/:buyerSlug/trace-history', title: 'Carton History', section: 'History' },

  // LULULEMON operation pages: do not fall back to "Workspace / Supply Chain".
  { path: '/buyers/:buyerSlug/packing', title: 'Packing Operations', section: 'Packing' },
  { path: '/buyers/:buyerSlug/carton-loading', title: 'Carton Identification & SSCC', section: 'Packing' },
  { path: '/buyers/:buyerSlug/shipping/review/:scheduleId', title: 'Shipment Details', section: 'Shipment Management' },
  { path: '/buyers/:buyerSlug/shipping/review', title: 'Shipment Management', section: 'Shipment Management' },
  { path: '/buyers/:buyerSlug/shipping', title: 'Shipment Management', section: 'Shipment Management' },
  { path: '/buyers/:buyerSlug/weighing', title: 'Carton Weight', section: 'Carton Weighing' },
  { path: '/buyers/:buyerSlug/po', title: 'PO Master Data', section: 'Orders' },

  // Shared Buyer and ES routes, from most detailed to the root.
  { path: '/buyers/:buyerSlug/orders/:orderId/shipping-schedules/:day', title: 'Shipping Schedule Details', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/shipping-schedules', title: 'Shipping Schedules', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/pos/:poKey/cartons/:cartonId', title: 'Carton Items', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/pos/:poKey', title: 'PO Cartons', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/data-management', title: 'Order Data Management', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/barcode-assign', title: 'Barcode Assignment', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/items/:masterLineId', title: 'Carton Items', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/weight-check', title: 'Weight Check', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId/scan', title: 'Scan Cartons', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders/:orderId', title: 'Order Workspace', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders', title: 'Orders', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/packing-list/:orderId', title: 'Packing List Detail', section: 'Orders' },
  { path: '/buyers/:buyerSlug/packing-list', title: 'Packing List', section: 'Orders' }
];

const resolvePage = (pathname) => {
  for (const page of PAGE_MAP) {
    const matched = matchPath({ path: page.path, end: true }, pathname);
    if (!matched) continue;
    const buyer = matched.params?.buyerSlug ? getBuyerBySlug(matched.params.buyerSlug) : null;
    return {
      ...page,
      section: buyer ? `${buyer.label} · ${page.section}` : page.section
    };
  }
  // Unknown extensions still show a meaningful title rather than an unrelated generic label.
  const lastSegment = pathname.split('/').filter(Boolean).pop() || 'workspace';
  return {
    title: decodeURIComponent(lastSegment).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    section: 'Supply Chain'
  };
};

export default function HeaderContent() {
  const { pathname } = useLocation();
  const page = useMemo(() => resolvePage(pathname), [pathname]);

  return (
    <Box sx={{ width: 1, display: 'flex', alignItems: 'center', minWidth: 0, gap: 1.2 }}>
      <Stack spacing={0.05} sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="h1"
          title={page.title}
          sx={{
            color: '#183658',
            fontSize: { xs: '0.9rem', sm: '0.98rem' },
            lineHeight: 1.2,
            fontWeight: 750,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {page.title}
        </Typography>
        <Typography sx={{ color: '#7A8CA0', fontSize: '0.69rem', fontWeight: 550, whiteSpace: 'nowrap' }}>
          {page.section}
        </Typography>
      </Stack>

      <WorkingContextSwitcher pathname={pathname} />

      <Profile />
    </Box>
  );
}
