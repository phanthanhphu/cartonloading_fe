const removeTrailingSlash = (value = '') => {
  return String(value || '').replace(/\/+$/, '');
};

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;

  return ['true', '1', 'yes', 'y', 'on'].includes(
    String(value).trim().toLowerCase()
  );
};

const getBrowserHost = () => {
  if (typeof window === 'undefined') return 'localhost';
  return window.location.hostname;
};

const DEV_USE_HTTPS = toBoolean(import.meta.env.VITE_DEV_USE_HTTPS, false);

const APP_PROTOCOL =
  import.meta.env.VITE_APP_PROTOCOL || (DEV_USE_HTTPS ? 'https' : 'http');

const APP_HOST = import.meta.env.VITE_APP_HOST || getBrowserHost();

const API_PORT = import.meta.env.VITE_API_PORT || '8082';

const WS_PROTOCOL = APP_PROTOCOL === 'https' ? 'wss' : 'ws';

export const APP_ENV = {
  mode: import.meta.env.MODE,
  protocol: APP_PROTOCOL,
  host: APP_HOST,
  apiPort: API_PORT,
  devUseHttps: DEV_USE_HTTPS
};

export const API_BASE_URL = removeTrailingSlash(
  `${APP_PROTOCOL}://${APP_HOST}:${API_PORT}`
);

export const API_ROOT = removeTrailingSlash(`${API_BASE_URL}/api`);

export const FILE_ROOT = API_BASE_URL;

export const WS_URL = removeTrailingSlash(
  `${WS_PROTOCOL}://${APP_HOST}:${API_PORT}/ws`
);

console.log('================ APP ENV ================');
console.log('MODE:', APP_ENV.mode);
console.log('APP_PROTOCOL:', APP_PROTOCOL);
console.log('APP_HOST:', APP_HOST);
console.log('API_PORT:', API_PORT);
console.log('API_BASE_URL:', API_BASE_URL);
console.log('API_ROOT:', API_ROOT);
console.log('FILE_ROOT:', FILE_ROOT);
console.log('WS_URL:', WS_URL);
console.log('=========================================');