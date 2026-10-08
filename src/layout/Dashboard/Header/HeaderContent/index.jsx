import { useMemo } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined';

import Profile from './Profile';
import {
  getAccessibleBuyers,
  getBuyerBySlug,
  readSelectedBuyer,
  saveSelectedBuyer
} from 'utils/buyerAccess';
import { BUYER_CODE, BUYER_LABEL } from '../../../../constants/appConstants';
import { readStoredUser } from 'utils/accessControl';
import { getBuyerAccessLandingPath } from 'buyers/core/buyerModules';

const PAGE_MAP = [
  { path: '/', title: 'Buyer Workspace', section: 'Workspace' },
  { path: '/dashboard', title: 'Dashboard', section: 'Workspace' },
  { path: '/orders-management', title: 'Orders', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Sales` },
  { path: '/users', title: 'Users', section: 'Administration' },
  { path: '/departments', title: 'Departments', section: 'Administration' },
  { path: '/buyers', title: 'Buyers', section: 'Administration' },
  { path: '/audit-logs', title: 'Audit Logs', section: 'Administration' },  { path: '/scale-stations', title: 'Scale Stations', section: 'Factory Tools' },
  { path: '/barcode-management', title: 'Barcode Inventory', section: 'Factory Tools' },
  { path: '/assign-barcode', title: 'Assign Barcode for Carton', section: 'Buyer Workspace' },
  { path: '/assign-barcode/:buyerSlug/:orderId', title: 'Assign Barcode for Carton', section: 'Buyer Workspace' },
  { path: '/sales/shipment-planning', title: 'Sales Shipment Planning', section: 'Buyer Workspace' },
  { path: '/sales/shipment-plans', title: 'Sales Shipment Planning', section: 'Buyer Workspace' },
  { path: '/packing/shipments', title: 'Packing Weight Check & Dispatch', section: 'Buyer Workspace' },
  { path: '/packing/shipments/:buyerSlug/:shipmentId', title: 'Packing Weight Check & Dispatch', section: 'Buyer Workspace' },
  { path: '/shipment-management', title: 'Carton & Shipment Tracking', section: 'Buyer Workspace' },
  { path: '/weight-check', title: 'Packing Weight Check & Dispatch', section: 'Buyer Workspace' },
  { path: '/buyers/:buyerSlug/orders/:orderId/weight-check', title: 'Packing Weight Check & Dispatch', section: 'Buyer Workspace' },
  { path: '/buyers/:buyerSlug/orders/:orderId/scan', title: 'Packing Weight Check & Dispatch', section: 'Buyer Workspace' },
  { path: '/buyers/:buyerSlug/po', title: 'Master Data / PO', section: BUYER_LABEL[BUYER_CODE.LULULEMON] },
  { path: '/buyers/:buyerSlug/print-requests', title: 'Print Request', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Operations` },
  { path: '/buyers/:buyerSlug/packing', title: 'Packing', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Operations` },
  { path: '/buyers/:buyerSlug/shipping', title: 'Shipping Schedule', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Sales / Packing` },
  { path: '/buyers/:buyerSlug/carton-loading', title: 'Carton Label / SSCC', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Operations` },
  { path: '/buyers/:buyerSlug/weighing', title: 'Weight Management', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Operations` },
  { path: '/buyers/:buyerSlug/weight-history', title: 'Weight Management', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Operations` },
  { path: '/buyers/:buyerSlug/orders/:orderId/items/:masterLineId', title: 'Carton Item Detail', section: 'Buyer Workspace' },
  { path: '/buyers/:buyerSlug/orders/:orderId', title: 'Order Workspace', section: 'Order Management' },
  { path: '/buyers/:buyerSlug/orders', title: 'Orders', section: `${BUYER_LABEL[BUYER_CODE.LULULEMON]} · Sales` },
  { path: '/buyers/:buyerSlug/packing-list/:orderId', title: 'Packing List', section: 'Buyer Workspace' },
  { path: '/buyers/:buyerSlug/packing-list', title: 'Packing List', section: 'Buyer Workspace' },
  { path: '/workflow', title: 'Buyer Workspace', section: 'Workspace' }
];

const resolvePage = (pathname) => {
  for (const page of PAGE_MAP) {
    const matched = matchPath({ path: page.path, end: true }, pathname);
    if (!matched) continue;
    const buyer = matched.params?.buyerSlug ? getBuyerBySlug(matched.params.buyerSlug) : null;
    return { ...page, buyerLabel: buyer?.label || '' };
  }
  return { title: 'Workspace', section: 'Supply Chain', buyerLabel: '' };
};

const buyerSwitchTarget = (_pathname, buyer) => {
  if (!buyer) return '/workflow';
  // Each Buyer owns a different workflow/menu. Switching Buyer must therefore open that
  // Buyer's own landing page instead of forcing the legacy ES /orders route.
  return getBuyerAccessLandingPath(buyer);
};

export default function HeaderContent() {
  const { pathname } = useLocation();
  const page = useMemo(() => resolvePage(pathname), [pathname]);
  const user = readStoredUser();
  const buyers = getAccessibleBuyers(user);
  const pathBuyerMatch = pathname.match(/^\/buyers\/([^/]+)/i) || pathname.match(/^\/assign-barcode\/([^/]+)\//i) || pathname.match(/^\/packing\/shipments\/([^/]+)\//i);
  const pathBuyer = pathBuyerMatch ? getBuyerBySlug(pathBuyerMatch[1]) : null;
  const storedBuyer = readSelectedBuyer();
  const activeBuyer = pathBuyer || buyers.find((buyer) => buyer.code === storedBuyer?.code) || buyers[0] || null;

  const changeBuyer = (buyerCode) => {
    const nextBuyer = buyers.find((buyer) => buyer.code === buyerCode);
    if (!nextBuyer || nextBuyer.code === activeBuyer?.code) return;
    saveSelectedBuyer(nextBuyer);
    window.dispatchEvent(new CustomEvent('buyer:selected', { detail: { buyerCode: nextBuyer.code } }));
    window.location.assign(buyerSwitchTarget(pathname, nextBuyer));
  };

  return (
    <Box sx={{ width: 1, display: 'flex', alignItems: 'center', minWidth: 0, gap: 1.2 }}>
      <Stack spacing={0.05} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: '#183658',
              fontSize: '0.98rem',
              fontWeight: 750,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {page.title}
          </Typography>
          {page.buyerLabel ? (
            <Chip
              size="small"
              label={page.buyerLabel}
              sx={{
                height: 22,
                borderRadius: 999,
                color: '#0A6ED1',
                bgcolor: alpha('#0A6ED1', 0.08),
                border: `1px solid ${alpha('#0A6ED1', 0.14)}`,
                fontSize: '0.67rem',
                fontWeight: 700
              }}
            />
          ) : null}
        </Stack>
        <Typography sx={{ color: '#7A8CA0', fontSize: '0.69rem', fontWeight: 550, whiteSpace: 'nowrap' }}>
          {page.section}
        </Typography>
      </Stack>

      {buyers.length > 0 && activeBuyer ? (
        <Select
          size="small"
          value={activeBuyer.code}
          onChange={(event) => changeBuyer(event.target.value)}
          renderValue={(value) => {
            const selected = buyers.find((buyer) => buyer.code === value) || activeBuyer;
            return (
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
                <SwapHorizOutlined sx={{ fontSize: 17, color: '#315C8A' }} />
                <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, color: '#183658', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selected?.label || value}
                </Typography>
              </Stack>
            );
          }}
          sx={{
            minWidth: { xs: 118, sm: 150 },
            maxWidth: 190,
            height: 38,
            borderRadius: 1.4,
            bgcolor: '#FFFFFF',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#D8E2EC' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#AFC3D8' },
            '& .MuiSelect-select': { py: 0.75, pl: 1.15, pr: 4 }
          }}
        >
          {buyers.map((buyer) => (
            <MenuItem key={buyer.code} value={buyer.code}>
              <Stack spacing={0.1}>
                <Typography sx={{ fontSize: '0.79rem', fontWeight: 800 }}>{buyer.label}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{buyer.code}</Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      ) : null}

      <Profile />
    </Box>
  );
}
