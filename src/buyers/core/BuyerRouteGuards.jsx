import { useT, useSystemMessage } from '../../i18n/LanguageProvider';
import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { BUYER_CODE, ROLE, STORAGE_KEY } from '../../constants/appConstants';
import { APP_MESSAGES } from '../../constants/appMessages';

import {
  canAssignBarcode,
  canAssignWeight,
  canPickPo,
  canManageBarcodes,
  canManageSales,
  canUseBuyerWorkspace,
  canWeightCheck,
  canManageShipping,
  canCreateShippingSchedule,
  canViewManagementReports
} from 'utils/accessControl';
import {
  canAccessBuyer,
  getAccessibleBuyers,
  getBuyerBySlug,
  readSelectedBuyer,
  saveSelectedBuyer
} from 'utils/buyerAccess';
import { buyerCapability, getBuyerAccessLandingPath, getBuyerModule } from './buyerModules';
import { readJwtSession, supportedSystemTypes } from '../../utils/systemTypes';

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
  const trSystem = useSystemMessage();
  const user = readStoredUser();
  const selected = readSelectedBuyer();
  const first = getAccessibleBuyers(user)[0];
  const buyer = selected && canAccessBuyer(selected.code, user) ? selected : first;
  const allowed = Boolean(buyer && buyerCapability(buyer, capability));

  useEffect(() => {
    if (!allowed) toast.error(trSystem(APP_MESSAGES.BUYER_WORKFLOW_FUNCTION_UNAVAILABLE));
  }, [allowed]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function BuyerModuleRoute({ moduleKey, children }) {
  const trSystem = useSystemMessage();
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const session = readJwtSession();
  const allowed = Boolean(buyer && getBuyerModule(buyer)?.key === moduleKey && canAccessBuyer(buyer.code, user)
    && supportedSystemTypes(buyer).includes(session.type));

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(trSystem(APP_MESSAGES.BUYER_WORKFLOW_PAGE_MISMATCH));
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function BuyerWorkspaceRoute({ children }) {
  const trSystem = useSystemMessage();
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const session = readJwtSession();
  const allowed = Boolean(buyer && canAccessBuyer(buyer.code, user)
    && supportedSystemTypes(buyer).includes(session.type)
    && (canUseBuyerWorkspace() || (buyer.code === BUYER_CODE.LULULEMON
      && (canAssignBarcode() || canWeightCheck() || canViewManagementReports()))));

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(trSystem(APP_MESSAGES.BUYER_WORKSPACE_ACCESS_DENIED));
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

/** LULULEMON Orders are readable by assigned Weight operators. Writes remain Sales/Admin-only on the API. */
export function BuyerOrdersAccessRoute({ children }) {
  const trUi = useT();
  const trSystem = useSystemMessage();
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const allowed = Boolean(buyer && (buyer.code !== BUYER_CODE.LULULEMON || canUseBuyerWorkspace()));
  useEffect(() => { if (!allowed) toast.error(trUi("Orders requires Sales, Packing or Weight operator permission.")); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function WorkspaceRoute({ children }) {
  const trSystem = useSystemMessage();
  const allowed = canUseBuyerWorkspace();
  useEffect(() => { if (!allowed) toast.error(trSystem(APP_MESSAGES.FACTORY_OPERATIONS_ONLY)); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function SalesRoute({ children }) {
  return canManageSales() ? children : <BuyerHomeRedirect />;
}

export function AssignRoute({ children }) {
  const trSystem = useSystemMessage();
  const allowed = canAssignBarcode();
  useEffect(() => { if (!allowed) toast.error(trSystem(APP_MESSAGES.ASSIGN_BARCODE_REQUIRED)); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function BarcodeRoute({ children }) {
  return canManageBarcodes() ? children : <BuyerHomeRedirect />;
}

export function WeightRoute({ children }) {
  const trSystem = useSystemMessage();
  const allowed = canWeightCheck();
  useEffect(() => { if (!allowed) toast.error(trSystem(APP_MESSAGES.WEIGHT_CHECK_REQUIRED)); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function PackingAccessRoute({ children }) {
  const trSystem = useSystemMessage();
  const allowed = canAssignBarcode() || canManageSales();
  useEffect(() => { if (!allowed) toast.error(trSystem(APP_MESSAGES.PACKING_PERMISSION_REQUIRED)); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}


export function PoPickingAccessRoute({ children }) {
  const allowed = canPickPo() || canManageSales();
  return allowed ? children : <BuyerHomeRedirect />;
}

export function ShippingAccessRoute({ children }) {
  const trSystem = useSystemMessage();
  const allowed = canCreateShippingSchedule() || canManageShipping() || canAssignBarcode() || canManageSales() || canAssignWeight();
  useEffect(() => { if (!allowed) toast.error(trSystem(APP_MESSAGES.PACKING_PERMISSION_REQUIRED)); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}

export function WeightAccessRoute({ children }) {
  const trSystem = useSystemMessage();
  const allowed = canWeightCheck() || canManageSales() || canAssignBarcode();
  useEffect(() => { if (!allowed) toast.error(trSystem(APP_MESSAGES.WEIGHING_PERMISSION_REQUIRED)); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}


export function AssignBuyerRoute({ children }) {
  const trSystem = useSystemMessage();
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const allowed = Boolean(buyer && canAccessBuyer(buyer.code, user) && buyerCapability(buyer, 'factoryBarcode') && canAssignBarcode());

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(trSystem(APP_MESSAGES.ASSIGN_BARCODE_BUYER_REQUIRED));
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function WeightBuyerRoute({ children }) {
  const trSystem = useSystemMessage();
  const { buyerSlug } = useParams();
  const buyer = getBuyerBySlug(buyerSlug);
  const user = readStoredUser();
  const allowed = Boolean(buyer && canAccessBuyer(buyer.code, user) && buyerCapability(buyer, 'weightCheck') && canWeightCheck());

  useEffect(() => {
    if (allowed && buyer) saveSelectedBuyer(buyer);
    if (!allowed) toast.error(trSystem(APP_MESSAGES.WEIGHT_CHECK_BUYER_REQUIRED));
  }, [allowed, buyer]);

  return allowed ? children : <BuyerHomeRedirect />;
}

export function AdminRoute({ children }) {
  const trSystem = useSystemMessage();
  const allowed = isAdminRole(getStoredRole());
  useEffect(() => { if (!allowed) toast.error(trSystem(APP_MESSAGES.ADMIN_ONLY)); }, [allowed]);
  return allowed ? children : <BuyerHomeRedirect />;
}
