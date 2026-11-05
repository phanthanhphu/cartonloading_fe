import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Loadable from 'components/Loadable';
import { BUYER_MODULE_KEY } from '../../../constants/appConstants';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getBuyerAccessLandingPath } from 'buyers/core/buyerModules';
import {
  BuyerModuleRoute,
  BuyerWorkspaceRoute,
  BuyerOrdersAccessRoute,
  AdminRoute
} from 'buyers/core/BuyerRouteGuards';

const DeviceManagementPage = Loadable(lazy(() => import('../pages/DeviceManagementPage')));
const HistoryPage = Loadable(lazy(() => import('../pages/HistoryPage')));
const ShippingSchedulesPage = Loadable(lazy(() => import('../pages/ShippingSchedulesPage')));
const ShippingScheduleDetailPage = Loadable(lazy(() => import('../pages/ShippingScheduleDetailPage')));

const ModuleRoute = ({ children }) => <BuyerModuleRoute moduleKey={BUYER_MODULE_KEY.SSCC_PACKING}>{children}</BuyerModuleRoute>;
const LegacyPoRedirect = () => { const { buyerSlug } = useParams(); return <Navigate to={`/buyers/${buyerSlug}/orders`} replace />; };
const RetiredPrintRedirect = () => {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  return <Navigate to={buyer ? getBuyerAccessLandingPath(buyer) : '/dashboard'} replace />;
};

const HistoryRedirect = () => {
  const { buyerSlug } = useParams();
  return <Navigate to={`/buyers/${buyerSlug}/trace-history`} replace />;
};

const ProcessingRoute = () => {
  const { buyerSlug } = useParams();
  return <Navigate to={`/buyers/${buyerSlug}/orders`} replace />;
};

const moduleRoutes = [
  // Shipping Scheduler uses a dedicated list page and a dedicated date detail page.
  { path: 'buyers/:buyerSlug/orders/:orderId/shipping-schedules',
    element: <ModuleRoute><BuyerWorkspaceRoute><BuyerOrdersAccessRoute><ShippingSchedulesPage /></BuyerOrdersAccessRoute></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/orders/:orderId/shipping-schedules/:day',
    element: <ModuleRoute><BuyerWorkspaceRoute><BuyerOrdersAccessRoute><ShippingScheduleDetailPage /></BuyerOrdersAccessRoute></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/po', element: <ModuleRoute><BuyerWorkspaceRoute><LegacyPoRedirect /></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing-import', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/carton-processing', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  // Old bookmarks stay valid but no longer expose PO self-picking, separate Packing,
  // Shipping dispatch or Weight-first workflow.
  { path: 'buyers/:buyerSlug/po-picking', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing/pos/:orderId/:poId', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping/review', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping/review/:scheduleId', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/carton-loading', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/weighing', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/checking', element: <ModuleRoute><ProcessingRoute /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/print-requests', element: <ModuleRoute><RetiredPrintRedirect /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/rfid-devices', element: <ModuleRoute><AdminRoute><DeviceManagementPage /></AdminRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/weight-history', element: <ModuleRoute><HistoryRedirect /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/trace-history', element: <ModuleRoute><HistoryPage /></ModuleRoute> }
];

export default moduleRoutes;
