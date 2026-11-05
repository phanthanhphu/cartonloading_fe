import { ACCESS_PERMISSION, ROLE, STORAGE_KEY, ADMIN_ACCESS_PERMISSIONS, ALLOWED_ACCESS_PERMISSIONS } from '../constants/appConstants';
import { isFactoryCode } from '../common/factory/factoryCodes';
import { readJwtSession } from './systemTypes';
import { BUYER_CODE } from '../constants/appConstants';

export { ACCESS_PERMISSION };

export const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY.USER) || '{}') || {};
  } catch {
    return {};
  }
};

export const normalizeRole = (value) => {
  const role = String(value || '').trim().toUpperCase();
  return role === ROLE.ADMIN || role === ROLE.ROLE_ADMIN ? ROLE.ADMIN : ROLE.USER;
};

export const isAdmin = () => normalizeRole(readStoredUser().role || localStorage.getItem(STORAGE_KEY.ROLE)) === ROLE.ADMIN;

const normalizePermissionValue = (value) => String(value || '').trim().toUpperCase();

export const normalizeAccessPermissions = (value, role = normalizeRole(readStoredUser().role || localStorage.getItem(STORAGE_KEY.ROLE))) => {
  if (role === ROLE.ADMIN) return [...ADMIN_ACCESS_PERMISSIONS];

  let source = value;
  if (source === undefined || source === null || source === '') {
    source = readStoredUser().accessPermissions ?? localStorage.getItem(STORAGE_KEY.ACCESS_PERMISSIONS);
  }

  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      source = Array.isArray(parsed) ? parsed : source;
    } catch {
      source = source.split(/[,;|]/);
    }
  }

  const set = new Set(
    (Array.isArray(source) ? source : [])
      .map(normalizePermissionValue)
      .filter((item) => ALLOWED_ACCESS_PERMISSIONS.includes(item))
  );

  if (set.has(ACCESS_PERMISSION.VIEW_SYSTEM)) return [ACCESS_PERMISSION.VIEW_SYSTEM];
  if (set.size === 0) return Array.isArray(source) ? [] : [ACCESS_PERMISSION.VIEW_SYSTEM];
  return [...set];
};

export const getAccessPermissions = () => normalizeAccessPermissions();
const isLululemonWorkspace = () => readJwtSession().buyer === BUYER_CODE.LULULEMON;
export const getLululemonPermissions = () => {
  if (isAdmin()) return [
    ACCESS_PERMISSION.LULU_UPLOAD_EDIT_DATA, ACCESS_PERMISSION.LULU_SHIPPING_SCHEDULER,
    ACCESS_PERMISSION.LULU_SCAN_RFID_SSCC_SKU_WEIGHT
  ];
  const all = readStoredUser().buyerAccessPermissions;
  return Array.isArray(all?.[BUYER_CODE.LULULEMON]) ? all[BUYER_CODE.LULULEMON] : [];
};
export const hasLululemonPermission = (permission) => isAdmin() || getLululemonPermissions().includes(permission);
export const canManageShipping = () => isAdmin() || (isLululemonWorkspace()
  ? hasLululemonPermission(ACCESS_PERMISSION.LULU_SHIPPING_SCHEDULER)
  : getAccessPermissions().includes(ACCESS_PERMISSION.SALES) || getAccessPermissions().includes(ACCESS_PERMISSION.ASSIGN_BARCODE));
export const canManageSales = () => isAdmin() || (isLululemonWorkspace()
  ? hasLululemonPermission(ACCESS_PERMISSION.LULU_UPLOAD_EDIT_DATA)
  : getAccessPermissions().includes(ACCESS_PERMISSION.SALES));
export const canManageBarcodes = () => !isLululemonWorkspace() && (canManageSales() || getAccessPermissions().includes(ACCESS_PERMISSION.BARCODE_OPERATOR));
export const canAssignBarcode = () => isAdmin() || (isLululemonWorkspace()
  ? hasLululemonPermission(ACCESS_PERMISSION.LULU_UPLOAD_EDIT_DATA)
  : getAccessPermissions().includes(ACCESS_PERMISSION.ASSIGN_BARCODE));
export const canPickPo = () => !isLululemonWorkspace() && (isAdmin() || canAssignBarcode() || getAccessPermissions().includes(ACCESS_PERMISSION.PICK_PO));
export const canAssignWeight = () => !isLululemonWorkspace() && (isAdmin() || getAccessPermissions().includes(ACCESS_PERMISSION.ASSIGN_WEIGHT));
export const canWeightCheck = () => isAdmin() || (isLululemonWorkspace()
  ? hasLululemonPermission(ACCESS_PERMISSION.LULU_SCAN_RFID_SSCC_SKU_WEIGHT)
  : getAccessPermissions().includes(ACCESS_PERMISSION.WEIGHT_CHECK));
export const isViewOnly = () => !isAdmin() && (isLululemonWorkspace()
  ? getLululemonPermissions().length === 1 && getLululemonPermissions()[0] === ACCESS_PERMISSION.LULU_VIEW_ONLY
  : getAccessPermissions().length === 1 && getAccessPermissions()[0] === ACCESS_PERMISSION.VIEW_SYSTEM);
export const canUseBuyerWorkspace = () => isAdmin() || (isLululemonWorkspace()
  ? getLululemonPermissions().length > 0 : canManageSales() || isViewOnly());

export const getFactoryPermissions = () => {
  const user = readStoredUser();
  let source = user.factoryPermissions ?? localStorage.getItem(STORAGE_KEY.FACTORY_PERMISSIONS) ?? [];
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      source = Array.isArray(parsed) ? parsed : source.split(/[,;|]/);
    } catch {
      source = source.split(/[,;|]/);
    }
  }
  return [...new Set((Array.isArray(source) ? source : [])
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean))];
};

export const canAccessAssignedFactory = (factoryCode) => {
  if (isAdmin()) return true;
  const code = String(factoryCode || '').trim().toUpperCase();
  if (!code) return false;
  const allowed = getFactoryPermissions();
  return isFactoryCode(code) && allowed.includes(code);
};


// Separate Weighing permissions: read from authenticated user, never infer from the menu URL.
export const getWeighingFactoryPermissions = () => {
  const user = readStoredUser();
  const configured = user.weighingFactoryPermissions;
  const values = Array.isArray(configured) ? configured : getFactoryPermissions();
  return [...new Set(values.map((v) => String(v || '').toUpperCase().trim()).filter(isFactoryCode))];
};
export const canWeighFactory = (factory) => isAdmin()
  ? isFactoryCode(factory)
  : isLululemonWorkspace() ? canAccessAssignedFactory(factory)
    : canWeightCheck() ? getWeighingFactoryPermissions().includes(String(factory || '').toUpperCase())
      : canAccessAssignedFactory(factory);
