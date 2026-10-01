import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

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
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {}; }
  catch { return {}; }
};

const getStoredRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return String(user?.role || localStorage.getItem('role') || '').trim().toUpperCase();
  } catch {
    return String(localStorage.getItem('role') || '').trim().toUpperCase();
  }
};

const isAdminRole = (role) => role === 'ADMIN' || role === 'ROLE_ADMIN';

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
    if (!allowed) toast.error('This function is not part of the selected Buyer workflow.');
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
    if (!allowed) toast.error(`This page does not belong to the selected Buyer workflow.`);
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
    if (!allowed) toast.error('You do not have access to the Buyer workspace.');
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function WorkspaceRoute({ children }) {
  const allowed = canUseBuyerWorkspace();
  useEffect(() => { if (!allowed) toast.error('Access denied. This account is limited to Factory Operations.'); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function SalesRoute({ children }) {
  return canManageSales() ? children : <BuyerHomeRedirect />;
}

export function AssignRoute({ children }) {
  const allowed = canAssignBarcode();
  useEffect(() => { if (!allowed) toast.error('Access denied. Assign Barcode permission is required.'); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function BarcodeRoute({ children }) {
  return canManageBarcodes() ? children : <BuyerHomeRedirect />;
}

export function WeightRoute({ children }) {
  const allowed = canWeightCheck();
  useEffect(() => { if (!allowed) toast.error('Access denied. Weight Check permission is required.'); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function LululemonPackingAccessRoute({ children }) {
  const allowed = canAssignBarcode() || canManageSales();
  useEffect(() => { if (!allowed) toast.error('Access denied. LULULEMON Packing permission is required.'); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}


export function LululemonWeightAccessRoute({ children }) {
  const allowed = canWeightCheck() || canManageSales() || canAssignBarcode();
  useEffect(() => { if (!allowed) toast.error('Access denied. LULULEMON Weighing permission is required.'); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function LululemonPrintAccessRoute({ children }) {
  const allowed = canPrintRoom() || canAssignBarcode() || canManageSales();
  useEffect(() => { if (!allowed) toast.error('Access denied. Print Room or Packing permission is required.'); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function AssignBuyerRoute({ children }) {
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const allowed = Boolean(buyer && canAccessBuyer(buyer.code, user) && buyerCapability(buyer, 'factoryBarcode') && canAssignBarcode());

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error('Access denied. Assign Barcode permission is required for this Buyer.');
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
    if (!allowed) toast.error('Access denied. Weight Check permission is required for this Buyer.');
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function AdminRoute({ children }) {
  const allowed = isAdminRole(getStoredRole());
  useEffect(() => { if (!allowed) toast.error('Access denied. Administrator only.'); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}
