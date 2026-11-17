// Shared wire values and interaction keys (keep exact backend protocol values).
export const FORMAT_LOCALE = Object.freeze({ EN_US: 'en-US' });
export const KEYBOARD_KEY = Object.freeze({ ENTER: 'Enter' });
export const DEVICE_CONNECTION_TYPE = Object.freeze({
  SIMULATOR: 'SIMULATOR',
  MODBUS_TCP: 'MODBUS_TCP',
  DELTA_SERIAL: 'DELTA_SERIAL'
});
export const DEVICE_CONNECTION_STATE = Object.freeze({
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED'
});

// Shared keys for the Factory & Department page navigation.
export const ORGANIZATION_MANAGEMENT_TAB = Object.freeze({
  FACTORIES: 'factories',
  DEPARTMENTS: 'departments'
});

export const ORGANIZATION_REALTIME = Object.freeze({
  FACTORY: 'FACTORY',
  DEPARTMENT: 'DEPARTMENT',
  USER: 'USER',
  ACCOUNT: 'ACCOUNT',
  DEVICE: 'DEVICE',
  HISTORY: 'HISTORY',
  ACCOUNT_TOPIC: '/user/queue/account-change',
  SYNC: 'SYNC',
  FACTORIES_TOPIC: '/topic/organization-factories',
  ADMIN_TOPIC: '/topic/organization-admin',
  RETRY_MS: 1500,
  MAX_RETRY_MS: 30000,
});

// Shared, exact string contract with backend AppConstants.SystemType.
export const SYSTEM_TYPE = Object.freeze({
  RFID: 'RFID',
  UNRFID: 'UNRFID',
  FACTORY_USE_ONLY: 'FACTORY_USE_ONLY'
});

