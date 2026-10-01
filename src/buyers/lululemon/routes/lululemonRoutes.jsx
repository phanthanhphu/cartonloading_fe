import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Loadable from 'components/Loadable';
import {
  BuyerModuleRoute,
  BuyerWorkspaceRoute,
  LululemonPackingAccessRoute,
  LululemonPrintAccessRoute,
  LululemonWeightAccessRoute,
  SalesRoute
} from 'buyers/core/BuyerRouteGuards';

const PackingPage = Loadable(lazy(() => import('../pages/PackingPage')));
const ShippingPage = Loadable(lazy(() => import('../pages/ShippingPage')));
const PrintRequestsPage = Loadable(lazy(() => import('../pages/PrintRequestsPage')));
const CartonLoadingPage = Loadable(lazy(() => import('../pages/CartonLoadingAssignPage')));
const WeighingPage = Loadable(lazy(() => import('../pages/WeighingPage')));
const TraceHistoryPage = Loadable(lazy(() => import('../pages/TraceHistoryPage')));

const LululemonRoute = ({ children }) => <BuyerModuleRoute moduleKey="lululemon">{children}</BuyerModuleRoute>;
const LegacyPoRedirect = () => { const { buyerSlug } = useParams(); return <Navigate to={`/buyers/${buyerSlug}/orders`} replace />; };

const lululemonRoutes = [
  { path: 'buyers/:buyerSlug/po', element: <LululemonRoute><BuyerWorkspaceRoute><LegacyPoRedirect /></BuyerWorkspaceRoute></LululemonRoute> },
  { path: 'buyers/:buyerSlug/packing', element: <LululemonRoute><LululemonPackingAccessRoute><PackingPage /></LululemonPackingAccessRoute></LululemonRoute> },
  { path: 'buyers/:buyerSlug/print-requests', element: <LululemonRoute><LululemonPrintAccessRoute><PrintRequestsPage /></LululemonPrintAccessRoute></LululemonRoute> },
  { path: 'buyers/:buyerSlug/shipping', element: <LululemonRoute><SalesRoute><ShippingPage /></SalesRoute></LululemonRoute> },
  { path: 'buyers/:buyerSlug/carton-loading', element: <LululemonRoute><LululemonPackingAccessRoute><CartonLoadingPage /></LululemonPackingAccessRoute></LululemonRoute> },
  { path: 'buyers/:buyerSlug/weighing', element: <LululemonRoute><LululemonWeightAccessRoute><WeighingPage /></LululemonWeightAccessRoute></LululemonRoute> },
  { path: 'buyers/:buyerSlug/trace-history', element: <LululemonRoute><TraceHistoryPage /></LululemonRoute> }
];

export default lululemonRoutes;
