export const ACCESS_PERMISSION = Object.freeze({
  SALES: 'SALES',
  BARCODE_OPERATOR: 'BARCODE_OPERATOR',
  ASSIGN_BARCODE: 'ASSIGN_BARCODE',
  WEIGHT_CHECK: 'WEIGHT_CHECK',
  PRINT_ROOM: 'PRINT_ROOM',
  VIEW_SYSTEM: 'VIEW_SYSTEM'
});

export const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}') || {};
  } catch {
    return {};
  }
};

export const normalizeRole = (value) => {
  const role = String(value || '').trim().toUpperCase();
  return role === 'ADMIN' || role === 'ROLE_ADMIN' ? 'ADMIN' : 'USER';
};

export const isAdmin = () => normalizeRole(readStoredUser().role || localStorage.getItem('role')) === 'ADMIN';

const normalizePermissionValue = (value) => String(value || '').trim().toUpperCase();
const ADMIN_PERMISSIONS = [
  ACCESS_PERMISSION.SALES,
  ACCESS_PERMISSION.BARCODE_OPERATOR,
  ACCESS_PERMISSION.ASSIGN_BARCODE,
  ACCESS_PERMISSION.WEIGHT_CHECK,
  ACCESS_PERMISSION.PRINT_ROOM
];
const ALLOWED_PERMISSIONS = [...ADMIN_PERMISSIONS, ACCESS_PERMISSION.VIEW_SYSTEM];

export const normalizeAccessPermissions = (value, role = normalizeRole(readStoredUser().role || localStorage.getItem('role'))) => {
  if (role === 'ADMIN') return [...ADMIN_PERMISSIONS];

  let source = value;
  if (source === undefined || source === null || source === '') {
    source = readStoredUser().accessPermissions ?? localStorage.getItem('accessPermissions');
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
      .filter((item) => ALLOWED_PERMISSIONS.includes(item))
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


