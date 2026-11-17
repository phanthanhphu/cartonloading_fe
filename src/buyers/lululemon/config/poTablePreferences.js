/** LULULEMON All_BP column preferences and Shipping Date list layout.
 * Keep legacy storage keys for existing users.
 */
import {
  DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY,
  WORKSPACE_DEFAULT_COLUMN_KEYS
} from '../../../constants/appConstants';

export const PO_DEFAULT_COLUMN_KEYS = Object.freeze(
  WORKSPACE_DEFAULT_COLUMN_KEYS.filter((key) => key !== 'sys:factory' && key !== 'sys:sku')
);
export const PO_DEFAULT_HIDDEN_KEYS = new Set(['sys:factory', 'sys:sku']);
export const UNSCHEDULED_COLUMN_STORAGE_KEY = `${DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY}.unscheduled`;
export const SCHEDULE_COLUMN_STORAGE_KEY = 'lululemon.shippingScheduleDays.columns.v1';
// Shipping Schedules is a date list, not a PO table: customize its columns separately.
// Shipping Date and Action stay visible so schedules can always be identified and opened.
export const SCHEDULE_COLUMNS = [
  { key: 'stt', label: 'STT' },
  { key: 'shippingDate', label: 'Shipping Date', required: true },
  { key: 'poCount', label: 'Total POs' },
  { key: 'status', label: 'Status' },
  { key: 'action', label: 'Action', required: true }
];
const loadColumnPreference = (storageKey) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
// One-time migration: hide Factory and SKU from pre-existing saved table layouts.
// After migration, an explicit user selection in Columns is preserved on reload.
const loadPoColumnPreference = (storageKey) => {
  const saved = loadColumnPreference(storageKey);
  const migrationKey = `${storageKey}.factory-sku-default-hidden.v1`;
  try {
    if (localStorage.getItem(migrationKey) === '1') return saved;
    const migrated = Array.isArray(saved) ? saved.filter((key) => !PO_DEFAULT_HIDDEN_KEYS.has(key)) : null;
    if (migrated !== null) localStorage.setItem(storageKey, JSON.stringify(migrated));
    localStorage.setItem(migrationKey, '1');
    return migrated;
  } catch {
    return Array.isArray(saved) ? saved.filter((key) => !PO_DEFAULT_HIDDEN_KEYS.has(key)) : null;
  }
};
export const loadSavedColumns = () => loadPoColumnPreference(DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY);
export const loadUnscheduledColumns = () => loadPoColumnPreference(UNSCHEDULED_COLUMN_STORAGE_KEY);
export const loadScheduleColumns = () => {
  const saved = loadColumnPreference(SCHEDULE_COLUMN_STORAGE_KEY);
  if (!saved) return SCHEDULE_COLUMNS.map((column) => column.key);
  return SCHEDULE_COLUMNS.filter((column) => column.required || saved.includes(column.key)).map((column) => column.key);
};

