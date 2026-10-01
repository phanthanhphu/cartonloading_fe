import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

import Loadable from 'components/Loadable';
import {
  ActiveBuyerCapabilityRoute,
  AdminRoute,
  AssignBuyerRoute,
  AssignRoute,
  BarcodeRoute,
  BuyerModuleRoute,
  BuyerWorkspaceRoute,
  SalesRoute,
  WeightBuyerRoute,
  WeightRoute
} from 'buyers/core/BuyerRouteGuards';

const LegacyBuyerOrdersPage = Loadable(lazy(() => import('../pages/packing-list/PackingListPage')));
const BuyerOrderDetailPage = Loadable(lazy(() => import('../pages/packing-list/PackingAllocationPage')));
const AssignBarcodePage = Loadable(lazy(() => import('../pages/assign-barcode/AssignBarcodePage')));
const ScaleStationPage = Loadable(lazy(() => import('../pages/scale-stations/ScaleStationPage')));
const BarcodeManagementPage = Loadable(lazy(() => import('../pages/barcodes/BarcodeManagementPage')));
const BarcodeAssignmentPage = Loadable(lazy(() => import('../pages/barcodes/BarcodeAssignmentPage')));
const ShipmentManagementPage = Loadable(lazy(() => import('../pages/shipments/ShipmentManagementPage')));
const PackingShipmentInboxPage = Loadable(lazy(() => import('../pages/packing-shipments/PackingShipmentInboxPage')));
const PackingShipmentExecutionPage = Loadable(lazy(() => import('../pages/packing-shipments/PackingShipmentExecutionPage')));

const EsRoute = ({ children }) => <BuyerModuleRoute moduleKey="es">{children}</BuyerModuleRoute>;

const esRoutes = [
  { path: 'sales/shipment-planning', element: <ActiveBuyerCapabilityRoute capability="shipmentPlanning"><SalesRoute><ShipmentManagementPage mode="sales" /></SalesRoute></ActiveBuyerCapabilityRoute> },
  { path: 'sales/shipment-plans', element: <SalesRoute><Navigate to="/sales/shipment-planning" replace /></SalesRoute> },
  { path: 'packing/shipments', element: <ActiveBuyerCapabilityRoute capability="weightCheck"><WeightRoute><PackingShipmentInboxPage /></WeightRoute></ActiveBuyerCapabilityRoute> },
  { path: 'packing/shipments/:buyerSlug/:shipmentId', element: <WeightBuyerRoute><PackingShipmentExecutionPage /></WeightBuyerRoute> },

  { path: 'buyers/:buyerSlug/orders/:orderId/data-management', element: <EsRoute><BuyerWorkspaceRoute><BuyerOrderDetailPage /></BuyerWorkspaceRoute></EsRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/scan', element: <EsRoute><WeightBuyerRoute><Navigate to="/packing/shipments" replace /></WeightBuyerRoute></EsRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/weight-check', element: <EsRoute><WeightBuyerRoute><Navigate to="/packing/shipments" replace /></WeightBuyerRoute></EsRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/barcode-assign', element: <EsRoute><AssignBuyerRoute><BarcodeAssignmentPage /></AssignBuyerRoute></EsRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/items/:masterLineId', element: <EsRoute><WeightBuyerRoute><Navigate to="/packing/shipments" replace /></WeightBuyerRoute></EsRoute> },
  { path: 'buyers/:buyerSlug/packing-list', element: <EsRoute><BuyerWorkspaceRoute><LegacyBuyerOrdersPage /></BuyerWorkspaceRoute></EsRoute> },
  { path: 'buyers/:buyerSlug/packing-list/:orderId', element: <EsRoute><BuyerWorkspaceRoute><BuyerOrderDetailPage /></BuyerWorkspaceRoute></EsRoute> },

  { path: 'scale-stations', element: <ActiveBuyerCapabilityRoute capability="scaleStations"><AdminRoute><ScaleStationPage /></AdminRoute></ActiveBuyerCapabilityRoute> },
  { path: 'barcode-management', element: <ActiveBuyerCapabilityRoute capability="barcodeInventory"><BarcodeRoute><BarcodeManagementPage /></BarcodeRoute></ActiveBuyerCapabilityRoute> },
  { path: 'shipment-management', element: <ActiveBuyerCapabilityRoute capability="shipmentTracking"><ShipmentManagementPage /></ActiveBuyerCapabilityRoute> },
  { path: 'assign-barcode', element: <ActiveBuyerCapabilityRoute capability="factoryBarcode"><AssignRoute><AssignBarcodePage /></AssignRoute></ActiveBuyerCapabilityRoute> },
  { path: 'assign-barcode/:buyerSlug/:orderId', element: <EsRoute><AssignBuyerRoute><BarcodeAssignmentPage /></AssignBuyerRoute></EsRoute> },
  { path: 'weight-check', element: <ActiveBuyerCapabilityRoute capability="weightCheck"><WeightRoute><Navigate to="/packing/shipments" replace /></WeightRoute></ActiveBuyerCapabilityRoute> }
];

export default esRoutes;
