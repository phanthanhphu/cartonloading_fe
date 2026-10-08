import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Loadable from 'components/Loadable';
import { BUYER_MODULE_KEY } from '../../../constants/appConstants';
import {
  BuyerModuleRoute,
  BuyerWorkspaceRoute,
  PackingAccessRoute,
  PrintAccessRoute,
  WeightAccessRoute
} from 'buyers/core/BuyerRouteGuards';

const PackingPage = Loadable(lazy(() => import('../pages/PackingPage')));
const CheckingManagementPage = Loadable(lazy(() => import('../pages/CheckingManagementPage')));
const ShippingPage = Loadable(lazy(() => import('../pages/ShippingPage')));
const ScheduleReviewPage = Loadable(lazy(() => import('../pages/ScheduleReviewPage')));
const ShippingScheduleDetailPage = Loadable(lazy(() => import('../pages/ShippingScheduleDetailPage')));
const PrintRequestsPage = Loadable(lazy(() => import('../pages/PrintRequestsPage')));
const CartonLoadingPage = Loadable(lazy(() => import('../pages/CartonLoadingAssignPage')));
const WeighingPage = Loadable(lazy(() => import('../pages/WeighingPage')));
const WeightHistoryPage = Loadable(lazy(() => import('../pages/WeightHistoryPage')));
const WeightManagementLayout = Loadable(lazy(() => import('../pages/WeightManagementLayout')));
const TraceHistoryPage = Loadable(lazy(() => import('../pages/TraceHistoryPage')));

const ModuleRoute = ({ children }) => <BuyerModuleRoute moduleKey={BUYER_MODULE_KEY.SSCC_PACKING}>{children}</BuyerModuleRoute>;
const LegacyPoRedirect = () => { const { buyerSlug } = useParams(); return <Navigate to={`/buyers/${buyerSlug}/orders`} replace />; };

const moduleRoutes = [
  { path: 'buyers/:buyerSlug/po', element: <ModuleRoute><BuyerWorkspaceRoute><LegacyPoRedirect /></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing', element: <ModuleRoute><PackingAccessRoute><PackingPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/checking', element: <ModuleRoute><PackingAccessRoute><CheckingManagementPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/print-requests', element: <ModuleRoute><PrintAccessRoute><PrintRequestsPage /></PrintAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping', element: <ModuleRoute><PackingAccessRoute><ShippingPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping/review', element: <ModuleRoute><PackingAccessRoute><ScheduleReviewPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/shipping/review/:scheduleId', element: <ModuleRoute><PackingAccessRoute><ShippingScheduleDetailPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/carton-loading', element: <ModuleRoute><PackingAccessRoute><CartonLoadingPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/weighing', element: <ModuleRoute><WeightAccessRoute><WeightManagementLayout><WeighingPage /></WeightManagementLayout></WeightAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/weight-history', element: <ModuleRoute><WeightAccessRoute><WeightManagementLayout><WeightHistoryPage /></WeightManagementLayout></WeightAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/trace-history', element: <ModuleRoute><TraceHistoryPage /></ModuleRoute> }
];

export default moduleRoutes;
