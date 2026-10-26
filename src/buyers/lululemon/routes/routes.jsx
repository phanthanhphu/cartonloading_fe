import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Loadable from 'components/Loadable';
import { BUYER_MODULE_KEY } from '../../../constants/appConstants';
import { getBuyerBySlug } from 'utils/buyerAccess';
import { getBuyerAccessLandingPath } from 'buyers/core/buyerModules';
import {
  BuyerModuleRoute,
  BuyerWorkspaceRoute,
  PackingAccessRoute,
  WeightAccessRoute,
  WeightRoute,
  AdminRoute
} from 'buyers/core/BuyerRouteGuards';

const CheckingManagementPage = Loadable(lazy(() => import('../pages/CheckingManagementPage')));
const DeviceManagementPage = Loadable(lazy(() => import('../pages/DeviceManagementPage')));
const HistoryPage = Loadable(lazy(() => import('../pages/HistoryPage')));

const PackingImportRedirect = () => { const { buyerSlug } = useParams(); return <Navigate to={`/buyers/${buyerSlug}/orders?tab=packing`} replace />; };
const ModuleRoute = ({ children }) => <BuyerModuleRoute moduleKey={BUYER_MODULE_KEY.SSCC_PACKING}>{children}</BuyerModuleRoute>;
const LegacyPoRedirect = () => { const { buyerSlug } = useParams(); return <Navigate to={`/buyers/${buyerSlug}/orders`} replace />; };
const RetiredPrintRedirect = () => {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  return <Navigate to={buyer ? getBuyerAccessLandingPath(buyer) : '/workflow'} replace />;
};

const ProcessingRoute = () => {
  const { buyerSlug } = useParams();
  return <Navigate to={`/buyers/${buyerSlug}/orders`} replace />;
};
const WeightHistoryRedirect = () => {
  const { buyerSlug } = useParams();
  return <Navigate to={`/buyers/${buyerSlug}/trace-history?tab=weight`} replace />;
};

const moduleRoutes = [
  { path: 'buyers/:buyerSlug/po', element: <ModuleRoute><BuyerWorkspaceRoute><LegacyPoRedirect /></BuyerWorkspaceRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/packing-import', element: <ModuleRoute><PackingAccessRoute><PackingImportRedirect /></PackingAccessRoute></ModuleRoute> },
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
  { path: 'buyers/:buyerSlug/checking', element: <ModuleRoute><PackingAccessRoute><CheckingManagementPage /></PackingAccessRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/print-requests', element: <ModuleRoute><RetiredPrintRedirect /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/rfid-devices', element: <ModuleRoute><AdminRoute><DeviceManagementPage /></AdminRoute></ModuleRoute> },
  { path: 'buyers/:buyerSlug/weight-history', element: <ModuleRoute><WeightHistoryRedirect /></ModuleRoute> },
  { path: 'buyers/:buyerSlug/trace-history', element: <ModuleRoute><HistoryPage /></ModuleRoute> }
];

export default moduleRoutes;
