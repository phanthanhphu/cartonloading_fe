import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

import Loadable from 'components/Loadable';
import { BUYER_MODULE_KEY, OPERATION_ROUTE } from '../../../constants/appConstants';
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

const ModuleRoute = ({ children }) => <BuyerModuleRoute moduleKey={BUYER_MODULE_KEY.BARCODE_PACKING}>{children}</BuyerModuleRoute>;

const moduleRoutes = [
  { path: 'sales/shipment-planning', element: <ActiveBuyerCapabilityRoute capability="shipmentPlanning"><SalesRoute><ShipmentManagementPage mode="sales" /></SalesRoute></ActiveBuyerCapabilityRoute> },
  { path: 'sales/shipment-plans', element: <SalesRoute><Navigate to={OPERATION_ROUTE.SHIPMENT_PLANNING} replace /></SalesRoute> },
  { path: 'packing/shipments', element: <ActiveBuyerCapabilityRoute capability="weightCheck"><WeightRoute><PackingShipmentInboxPage /></WeightRoute></ActiveBuyerCapabilityRoute> },
  { path: 'packing/shipments/:buyerSlug/:shipmentId', element: <WeightBuyerRoute><PackingShipmentExecutionPage /></WeightBuyerRoute> },

  { path: 'buyers/:buyerSlug/orders/:orderId/data-management', element: <ModuleRoute><BuyerWorkspaceRoute><BuyerOrderDetailPage /></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/scan', element: <ModuleRoute><WeightBuyerRoute><Navigate to={OPERATION_ROUTE.PACKING_SHIPMENTS} replace /></WeightBuyerRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/weight-check', element: <ModuleRoute><WeightBuyerRoute><Navigate to={OPERATION_ROUTE.PACKING_SHIPMENTS} replace /></WeightBuyerRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/barcode-assign', element: <ModuleRoute><AssignBuyerRoute><BarcodeAssignmentPage /></AssignBuyerRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/items/:masterLineId', element: <ModuleRoute><WeightBuyerRoute><Navigate to={OPERATION_ROUTE.PACKING_SHIPMENTS} replace /></WeightBuyerRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing-list', element: <ModuleRoute><BuyerWorkspaceRoute><LegacyBuyerOrdersPage /></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing-list/:orderId', element: <ModuleRoute><BuyerWorkspaceRoute><BuyerOrderDetailPage /></BuyerWorkspaceRoute></ModuleRoute> },

  { path: 'scale-stations', element: <ActiveBuyerCapabilityRoute capability="scaleStations"><AdminRoute><ScaleStationPage /></AdminRoute></ActiveBuyerCapabilityRoute> },
  { path: 'barcode-management', element: <ActiveBuyerCapabilityRoute capability="barcodeInventory"><BarcodeRoute><BarcodeManagementPage /></BarcodeRoute></ActiveBuyerCapabilityRoute> },
  { path: 'shipment-management', element: <ActiveBuyerCapabilityRoute capability="shipmentTracking"><ShipmentManagementPage /></ActiveBuyerCapabilityRoute> },
  { path: 'assign-barcode', element: <ActiveBuyerCapabilityRoute capability="factoryBarcode"><AssignRoute><AssignBarcodePage /></AssignRoute></ActiveBuyerCapabilityRoute> },
  { path: 'assign-barcode/:buyerSlug/:orderId', element: <ModuleRoute><AssignBuyerRoute><BarcodeAssignmentPage /></AssignBuyerRoute></ModuleRoute> },
  { path: 'weight-check', element: <ActiveBuyerCapabilityRoute capability="weightCheck"><WeightRoute><Navigate to={OPERATION_ROUTE.PACKING_SHIPMENTS} replace /></WeightRoute></ActiveBuyerCapabilityRoute> }
];

export default moduleRoutes;
