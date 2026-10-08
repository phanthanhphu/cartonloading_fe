import { ACCESS_PERMISSION, ROLE, STORAGE_KEY, ADMIN_ACCESS_PERMISSIONS, ALLOWED_ACCESS_PERMISSIONS } from '../constants/appConstants';

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
  if (set.size === 0) return [ACCESS_PERMISSION.VIEW_SYSTEM];
  return [...set];
};

export const getAccessPermissions = () => normalizeAccessPermissions();
export const canManageSales = () => isAdmin() || getAccessPermissions().includes(ACCESS_PERMISSION.SALES);
export const canManageBarcodes = () => canManageSales() || getAccessPermissions().includes(ACCESS_PERMISSION.BARCODE_OPERATOR);
export const canAssignBarcode = () => isAdmin() || getAccessPermissions().includes(ACCESS_PERMISSION.ASSIGN_BARCODE);
export const canWeightCheck = () => isAdmin() || getAccessPermissions().includes(ACCESS_PERMISSION.WEIGHT_CHECK);
export const canPrintRoom = () => isAdmin() || getAccessPermissions().includes(ACCESS_PERMISSION.PRINT_ROOM);
export const isViewOnly = () => !isAdmin() && getAccessPermissions().length === 1 && getAccessPermissions()[0] === ACCESS_PERMISSION.VIEW_SYSTEM;
export const canUseBuyerWorkspace = () => isAdmin() || canManageSales() || isViewOnly();

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
  if (isAdmin() || canManageSales()) return true;
  const code = String(factoryCode || '').trim().toUpperCase();
  if (!code) return false;
  const allowed = getFactoryPermissions();
  return allowed.includes('*') || allowed.includes(code);
};
