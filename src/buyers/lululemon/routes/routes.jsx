import { lazy } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import Loadable from 'components/Loadable';
import { BUYER_MODULE_KEY } from '../../../constants/appConstants';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getBuyerAccessLandingPath } from 'buyers/core/buyerModules';
import {
  BuyerModuleRoute,
  BuyerWorkspaceRoute,
  PackingAccessRoute,
  WeightAccessRoute,
  AdminRoute
} from 'buyers/core/BuyerRouteGuards';

const PoPickingPage = Loadable(lazy(() => import('../pages/PoPickingPage')));
const PackingPage = Loadable(lazy(() => import('../pages/PackingPage')));
const CheckingManagementPage = Loadable(lazy(() => import('../pages/CheckingManagementPage')));
const ShippingPage = Loadable(lazy(() => import('../pages/ShippingPage')));
const ShippingScheduleDetailPage = Loadable(lazy(() => import('../pages/ShippingScheduleDetailPage')));
const CartonLoadingPage = Loadable(lazy(() => import('../pages/CartonLoadingAssignPage')));
const WeighingPage = Loadable(lazy(() => import('../pages/WeighingPage')));
const RfidDevicesPage = Loadable(lazy(() => import('../pages/RfidDevicesPage')));
const WeightHistoryPage = Loadable(lazy(() => import('../pages/WeightHistoryPage')));
const WeightManagementLayout = Loadable(lazy(() => import('../pages/WeightManagementLayout')));
const TraceHistoryPage = Loadable(lazy(() => import('../pages/TraceHistoryPage')));

const ModuleRoute = ({ children }) => <BuyerModuleRoute moduleKey={BUYER_MODULE_KEY.SSCC_PACKING}>{children}</BuyerModuleRoute>;
const LegacyPoRedirect = () => { const { buyerSlug } = useParams(); return <Navigate to={`/buyers/${buyerSlug}/orders`} replace />; };
// Legacy Shipping review bookmarks now open the single Shipment Management list.
// Preserve query params (especially orderId) when navigating back from old URLs.
const LegacyShippingReviewRedirect = () => {
  const { buyerSlug } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/buyers/${buyerSlug}/shipping${search}`} replace />;
};
const RetiredPrintRedirect = () => {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  return <Navigate to={buyer ? getBuyerAccessLandingPath(buyer) : '/workflow'} replace />;
};

const moduleRoutes = [
  { path: 'buyers/:buyerSlug/po', element: <ModuleRoute><BuyerWorkspaceRoute><LegacyPoRedirect /></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/po-picking', element: <ModuleRoute><PoPickingPage /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing', element: <ModuleRoute><PackingAccessRoute><PackingPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing/pos/:orderId/:poId', element: <ModuleRoute><PackingAccessRoute><PackingPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/checking', element: <ModuleRoute><PackingAccessRoute><CheckingManagementPage /></PackingAccessRoute></ModuleRoute> },
  // Existing bookmarks redirect; the printing workflow is no longer accessible.
  { path: 'buyers/:buyerSlug/print-requests', element: <ModuleRoute><RetiredPrintRedirect /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping', element: <ModuleRoute><PackingAccessRoute><ShippingPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping/review', element: <ModuleRoute><PackingAccessRoute><LegacyShippingReviewRedirect /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping/review/:scheduleId', element: <ModuleRoute><PackingAccessRoute><ShippingScheduleDetailPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/carton-loading', element: <ModuleRoute><PackingAccessRoute><CartonLoadingPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/weighing', element: <ModuleRoute><WeightAccessRoute><WeightManagementLayout><WeighingPage /></WeightManagementLayout></WeightAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/rfid-devices', element: <ModuleRoute><AdminRoute><RfidDevicesPage /></AdminRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/weight-history', element: <ModuleRoute><WeightAccessRoute><WeightManagementLayout><WeightHistoryPage /></WeightManagementLayout></WeightAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/trace-history', element: <ModuleRoute><TraceHistoryPage /></ModuleRoute> }
];

export default moduleRoutes;
