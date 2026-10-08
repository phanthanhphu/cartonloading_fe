import axios from 'axios';
import { API_BASE_URL, API_ROOT, FILE_ROOT } from '../config';
import { AUTH_STORAGE_KEYS, ROUTE_PATH, STORAGE_KEY, REDIRECT_REASON } from '../constants/appConstants';
import { APP_MESSAGES } from '../constants/appMessages';

window.API_BASE_URL = API_BASE_URL;

export const clearAuthSession = () => {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const redirectToLogin = (reason = REDIRECT_REASON.SESSION_EXPIRED) => {
  clearAuthSession();

  const currentPath = window.location.pathname;

  if (currentPath !== ROUTE_PATH.LOGIN) {
    window.location.href = `${ROUTE_PATH.LOGIN}?${reason}=true`;
  }
};

export const getStoredToken = () => {
  return (
    localStorage.getItem(STORAGE_KEY.TOKEN) ||
    localStorage.getItem(STORAGE_KEY.ACCESS_TOKEN) ||
    sessionStorage.getItem(STORAGE_KEY.TOKEN) ||
    sessionStorage.getItem(STORAGE_KEY.ACCESS_TOKEN) ||
    ''
  );
};

const isBadUrl = (url) => {
  return (
    url === undefined ||
    url === null ||
    url === '' ||
    url === 'undefined' ||
    url === '/undefined' ||
    String(url).includes('/undefined')
  );
};

const getRawUrl = (input) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return input?.url;
};

export const normalizeApiUrl = (rawUrl) => {
  if (isBadUrl(rawUrl)) {
    console.error('❌ BAD API URL:', rawUrl);
    throw new Error(APP_MESSAGES.API_URL_UNDEFINED);
  }

  try {
    const parsedUrl = new URL(rawUrl, window.location.origin);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/api')) {
      return `${API_BASE_URL}${pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    if (
      pathname.startsWith('/ws')
    ) {
      return `${FILE_ROOT}${pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    if (String(rawUrl).startsWith('/')) {
      return `${API_ROOT}${pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
};

const applyRequestAuth = (config = {}) => {
  const token = getStoredToken();

  config.url = normalizeApiUrl(config.url || '');

  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data instanceof FormData) {
    // Let browser add multipart/form-data boundary automatically.
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  } else if (config.data && String(config.method || '').toLowerCase() !== 'get') {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
};

const handleRequestError = (error) => Promise.reject(error);

const handleResponseError = (error) => {
  const status = error.response?.status;
  const url = error.config?.url || '';

  console.error(`❌ [${status}] ${url}`, error.response?.data || error);

  const isLoginRequest = String(url).includes('/login');

  if (status === 401 && !isLoginRequest) {
    redirectToLogin(REDIRECT_REASON.SESSION_EXPIRED);
  }

  return Promise.reject(error);
};

/**
 * apiRawClient keeps full Axios response.
 * Use it when old code expects response.data, response.headers, blob response, etc.
 */
export const apiRawClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1000000,
  withCredentials: true,
});

apiRawClient.interceptors.request.use(applyRequestAuth, handleRequestError);
apiRawClient.interceptors.response.use((response) => response, handleResponseError);

/**
 * apiClient returns response.data directly.
 * Use it for new clean API service code.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 1000000,
  withCredentials: true,
});

apiClient.interceptors.request.use(applyRequestAuth, handleRequestError);
apiClient.interceptors.response.use((response) => response.data, handleResponseError);

/**
 * Optional safety net:
 * Existing files that still import axios directly will also receive Bearer token
 * as long as this module is imported once by the app.
 */
if (!window.__BSL_AXIOS_AUTH_INTERCEPTORS_INSTALLED__) {
  axios.interceptors.request.use(applyRequestAuth, handleRequestError);
  axios.interceptors.response.use((response) => response, handleResponseError);
  window.__BSL_AXIOS_AUTH_INTERCEPTORS_INSTALLED__ = true;
}

const originalFetch = window.fetch;

if (!window.__BSL_FETCH_AUTH_INTERCEPTOR_INSTALLED__) {
  window.fetch = async function (input, init = {}) {
    const rawUrl = getRawUrl(input);

    if (isBadUrl(rawUrl)) {
      console.error('❌ FETCH URL UNDEFINED:', rawUrl, input);
      throw new Error(APP_MESSAGES.FETCH_URL_UNDEFINED);
    }

    const normalizedUrl = normalizeApiUrl(rawUrl);

    const token = getStoredToken();
    const hasFiles = init.body instanceof FormData;
    const headers = new Headers(init.headers || {});
    const method = String(init.method || 'GET').toUpperCase();

    if (!hasFiles && init.body && method !== 'GET' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const config = {
      ...init,
      headers,
      credentials: 'include',
    };

    const response = await originalFetch(normalizedUrl, config);

    const isLoginRequest = String(normalizedUrl).includes('/login');

    if (response.status === 401 && !isLoginRequest) {
      redirectToLogin(REDIRECT_REASON.SESSION_EXPIRED);
    }

    return response;
  };

  window.__BSL_FETCH_AUTH_INTERCEPTOR_INSTALLED__ = true;
}

export const api = {
  get: (url, params = {}) => apiClient.get(url, { params }),
  post: (url, data = {}) => apiClient.post(url, data),
  put: (url, data = {}) => apiClient.put(url, data),
  patch: (url, data = {}) => apiClient.patch(url, data),
  delete: (url, config = {}) => apiClient.delete(url, config),
  postForm: (url, formData) => apiClient.post(url, formData),
  upload: (url, formData) => apiClient.post(url, formData),
};

window.addEventListener('unhandledrejection', (event) => {
  const err = event.reason;

  if (err?.response?.status === 401) {
    const url = err?.config?.url || '';
    const isLoginRequest = String(url).includes('/login');

    if (!isLoginRequest) {
      redirectToLogin(REDIRECT_REASON.GLOBAL_ERROR);
    }
  }
});

console.log('🚀 API BASE URL:', API_BASE_URL);

export default apiClient;
