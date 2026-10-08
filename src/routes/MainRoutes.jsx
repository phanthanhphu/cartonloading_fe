import { lazy, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useRouteError } from 'react-router-dom';
import { toast } from 'react-toastify';

import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';
import LoginPage from './LoginPage';
import { BuyerHomeRedirect, BuyerWorkspaceRoute } from 'buyers/core/BuyerRouteGuards';
import { isAdmin } from 'utils/accessControl';
import barcodePackingRoutes from 'buyers/es/routes/routes';
import { AUTH_STORAGE_KEYS, BUYER_CODE, ROUTE_PATH, STORAGE_KEY } from '../constants/appConstants';
import { APP_MESSAGES } from '../constants/appMessages';
import ssccPackingRoutes from 'buyers/lululemon/routes/routes';

const WorkflowHomePage = Loadable(lazy(() => import('pages/workflow/WorkflowHomePage')));
const DashboardPage = Loadable(lazy(() => import('pages/dashboard/DashboardPage')));
const BuyerOrdersPage = Loadable(lazy(() => import('pages/buyer-orders/BuyerOrdersPage')));
const BuyerOrderWorkspacePage = Loadable(lazy(() => import('pages/buyer-orders/BuyerOrderWorkspacePage')));
const BuyerPoCartonsPage = Loadable(lazy(() => import('pages/buyer-orders/BuyerPoCartonsPage')));
const BuyerCartonItemsPage = Loadable(lazy(() => import('pages/buyer-orders/BuyerCartonItemsPage')));
const UserManagementPage = Loadable(lazy(() => import('pages/users/UserManagementPage')));
const DepartmentManagementPage = Loadable(lazy(() => import('pages/department/DepartmentManagement')));
const BuyerManagementPage = Loadable(lazy(() => import('pages/buyers/BuyerManagementPage')));
const AuditLogPage = Loadable(lazy(() => import('pages/audit/AuditLogPage')));

function RouteErrorPage() {
  const error = useRouteError();
  const message = error?.message || error?.statusText || APP_MESSAGES.UNEXPECTED_ERROR;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F4F7FB' }}>
      <div style={{ width: 'min(560px, 100%)', padding: 24, borderRadius: 16, border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 12px 34px rgba(15, 23, 42, 0.08)' }}>
        <h2 style={{ margin: 0, color: '#103B5C' }}>{APP_MESSAGES.PAGE_OPEN_FAILED}</h2>
        <p style={{ color: '#64748B', lineHeight: 1.6 }}>{message}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 8, padding: '10px 16px', background: '#103B5C', color: '#FFFFFF', cursor: 'pointer', fontWeight: 700 }}>
          {APP_MESSAGES.RELOAD_PAGE}
        </button>
      </div>
    </div>
  );
}

const decodeJwtPayload = (token) => {
  try {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => Boolean(decodeJwtPayload(token)?.exp && decodeJwtPayload(token).exp * 1000 <= Date.now());
const clearAuthSession = () => AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));


function AdminRoute({ children }) {
  return isAdmin() ? children : <Navigate to={ROUTE_PATH.DASHBOARD} replace />;
}

function ProtectedRoute() {
  const location = useLocation();
  const token = localStorage.getItem(STORAGE_KEY.TOKEN);
  const expired = token ? isTokenExpired(token) : false;

  useEffect(() => {
    if (expired) {
      clearAuthSession();
      toast.error(APP_MESSAGES.SESSION_EXPIRED);
    }
  }, [expired]);

  if (!token || expired) return <Navigate to={ROUTE_PATH.LOGIN} replace state={{ from: location }} />;
  return <Outlet />;
}

const MainRoutes = {
  path: '/',
  errorElement: <RouteErrorPage />,
  children: [
    { path: 'login', element: <LoginPage /> },
    {
      element: <ProtectedRoute />,
      children: [{
        element: <DashboardLayout />,
        children: [
          { index: true, element: <WorkflowHomePage /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'workflow', element: <WorkflowHomePage /> },
          { path: 'orders-management', element: <Navigate to={`/buyers/${String(BUYER_CODE.LULULEMON).toLowerCase()}/orders`} replace /> },
          { path: 'users', element: <AdminRoute><UserManagementPage /></AdminRoute> },
          { path: 'departments', element: <AdminRoute><DepartmentManagementPage /></AdminRoute> },
          { path: 'buyers', element: <AdminRoute><BuyerManagementPage /></AdminRoute> },
          { path: 'audit-logs', element: <AdminRoute><AuditLogPage /></AdminRoute> },

          // Unified Buyer hierarchy: Buyer → Order → PO → Carton → Item.
          { path: 'buyers/:buyerSlug/orders', element: <BuyerWorkspaceRoute><BuyerOrdersPage /></BuyerWorkspaceRoute> },
          { path: 'buyers/:buyerSlug/orders/:orderId', element: <BuyerWorkspaceRoute><BuyerOrderWorkspacePage /></BuyerWorkspaceRoute> },
          { path: 'buyers/:buyerSlug/orders/:orderId/pos/:poKey', element: <BuyerWorkspaceRoute><BuyerPoCartonsPage /></BuyerWorkspaceRoute> },
          { path: 'buyers/:buyerSlug/orders/:orderId/pos/:poKey/cartons/:cartonId', element: <BuyerWorkspaceRoute><BuyerCartonItemsPage /></BuyerWorkspaceRoute> },

          // Buyer-owned operational routes.
          ...barcodePackingRoutes,
          ...ssccPackingRoutes,

          { path: '*', element: <BuyerHomeRedirect /> }
        ]
      }]
    },
    { path: '*', element: <Navigate to={ROUTE_PATH.LOGIN} replace /> }
  ]
};

export default MainRoutes;
