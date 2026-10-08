import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ROLE, STORAGE_KEY } from '../../constants/appConstants';
import { APP_MESSAGES } from '../../constants/appMessages';

import {
  canAssignBarcode,
  canManageBarcodes,
  canManageSales,
  canPrintRoom,
  canUseBuyerWorkspace,
  canWeightCheck
} from 'utils/accessControl';
import {
  canAccessBuyer,
  getAccessibleBuyers,
  getBuyerBySlug,
  readSelectedBuyer,
  saveSelectedBuyer
} from 'utils/buyerAccess';
import { buyerCapability, getBuyerAccessLandingPath, getBuyerModule } from './buyerModules';

const readStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY.USER) || '{}') || {}; }
  catch { return {}; }
};

const getStoredRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_KEY.USER) || '{}');
    return String(user?.role || localStorage.getItem(STORAGE_KEY.ROLE) || '').trim().toUpperCase();
  } catch {
    return String(localStorage.getItem(STORAGE_KEY.ROLE) || '').trim().toUpperCase();
  }
};

const isAdminRole = (role) => role === ROLE.ADMIN || role === ROLE.ROLE_ADMIN;

export function BuyerHomeRedirect() {
  const user = readStoredUser();
  const selected = readSelectedBuyer();
  const first = getAccessibleBuyers(user)[0];
  const buyer = selected && canAccessBuyer(selected.code, user) ? selected : first;
  if (!buyer) return <Navigate to="/login" replace />;
  return <Navigate to={getBuyerAccessLandingPath(buyer)} replace />;
}

export function ActiveBuyerCapabilityRoute({ capability, children }) {
  const user = readStoredUser();
  const selected = readSelectedBuyer();
  const first = getAccessibleBuyers(user)[0];
  const buyer = selected && canAccessBuyer(selected.code, user) ? selected : first;
  const allowed = Boolean(buyer && buyerCapability(buyer, capability));

  useEffect(() => {
    if (!allowed) toast.error(APP_MESSAGES.BUYER_WORKFLOW_FUNCTION_UNAVAILABLE);
  }, [allowed]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function BuyerModuleRoute({ moduleKey, children }) {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const allowed = Boolean(buyer && getBuyerModule(buyer)?.key === moduleKey && canAccessBuyer(buyer.code, user));

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(APP_MESSAGES.BUYER_WORKFLOW_PAGE_MISMATCH);
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function BuyerWorkspaceRoute({ children }) {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const allowed = Boolean(buyer && canAccessBuyer(buyer.code, user) && canUseBuyerWorkspace());

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(APP_MESSAGES.BUYER_WORKSPACE_ACCESS_DENIED);
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function WorkspaceRoute({ children }) {
  const allowed = canUseBuyerWorkspace();
  useEffect(() => { if (!allowed) toast.error(APP_MESSAGES.FACTORY_OPERATIONS_ONLY); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function SalesRoute({ children }) {
  return canManageSales() ? children : <BuyerHomeRedirect />;
}

export function AssignRoute({ children }) {
  const allowed = canAssignBarcode();
  useEffect(() => { if (!allowed) toast.error(APP_MESSAGES.ASSIGN_BARCODE_REQUIRED); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function BarcodeRoute({ children }) {
  return canManageBarcodes() ? children : <BuyerHomeRedirect />;
}

export function WeightRoute({ children }) {
  const allowed = canWeightCheck();
  useEffect(() => { if (!allowed) toast.error(APP_MESSAGES.WEIGHT_CHECK_REQUIRED); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function PackingAccessRoute({ children }) {
  const allowed = canAssignBarcode() || canManageSales();
  useEffect(() => { if (!allowed) toast.error(APP_MESSAGES.PACKING_PERMISSION_REQUIRED); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}


export function WeightAccessRoute({ children }) {
  const allowed = canWeightCheck() || canManageSales() || canAssignBarcode();
  useEffect(() => { if (!allowed) toast.error(APP_MESSAGES.WEIGHING_PERMISSION_REQUIRED); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function PrintAccessRoute({ children }) {
  const allowed = canPrintRoom() || canAssignBarcode() || canManageSales();
  useEffect(() => { if (!allowed) toast.error(APP_MESSAGES.PRINT_ROOM_PERMISSION_REQUIRED); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function AssignBuyerRoute({ children }) {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const allowed = Boolean(buyer && canAccessBuyer(buyer.code, user) && buyerCapability(buyer, 'factoryBarcode') && canAssignBarcode());

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(APP_MESSAGES.ASSIGN_BARCODE_BUYER_REQUIRED);
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function WeightBuyerRoute({ children }) {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const allowed = Boolean(buyer && canAccessBuyer(buyer.code, user) && buyerCapability(buyer, 'weightCheck') && canWeightCheck());

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(APP_MESSAGES.WEIGHT_CHECK_BUYER_REQUIRED);
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function AdminRoute({ children }) {
  const allowed = isAdminRole(getStoredRole());
  useEffect(() => { if (!allowed) toast.error(APP_MESSAGES.ADMIN_ONLY); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}
