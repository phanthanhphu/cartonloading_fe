import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import jsconfigPaths from 'vite-jsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;

  return ['true', '1', 'yes', 'y', 'on'].includes(
    String(value).trim().toLowerCase()
  );
};

const uniqueList = (items = []) => {
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
};

const getProtocolFromEnv = (env) => {
  if (env.VITE_APP_PROTOCOL) {
    return String(env.VITE_APP_PROTOCOL).replace(':', '').trim();
  }

  const useHttps = toBoolean(env.VITE_DEV_USE_HTTPS, false);
  return useHttps ? 'https' : 'http';
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const isDev = command === 'serve' || mode === 'development';

  const DEV_PORT = Number(env.VITE_DEV_PORT || 3003);
  const DEV_HOST = env.VITE_DEV_HOST || '0.0.0.0';

  const APP_PROTOCOL = getProtocolFromEnv(env);
  const DEV_USE_HTTPS = APP_PROTOCOL === 'https';

  /**
   * Không hardcode IP ở đây.
   * IP chỉ khai báo duy nhất trong file .env:
   * VITE_APP_HOST=10.232.100.69
   */
  const APP_HOST = env.VITE_APP_HOST || 'localhost';
  const APP_DOMAIN = env.VITE_APP_DOMAIN || '';
  const API_PORT = env.VITE_API_PORT || '8083';

  const BACKEND_TARGET = `${APP_PROTOCOL}://${APP_HOST}:${API_PORT}`;

  /**
   * Không dùng VITE_ALLOWED_HOSTS nữa.
   * allowedHosts tự lấy từ APP_HOST + APP_DOMAIN + localhost.
   */
  const allowedHosts = uniqueList([
    APP_HOST,
    APP_DOMAIN,
    'localhost'
  ]);

  const base = isDev
    ? '/'
    : env.VITE_APP_BASE_NAME || env.VITE_BASE_URL || '/';

  const proxyConfig = {
    target: BACKEND_TARGET,
    changeOrigin: true,
    secure: false
  };

  let sslConfig = undefined;

  if (isDev && DEV_USE_HTTPS) {
    const certCandidates = [
      env.VITE_SSL_CERT_DIR,
      'D:/Project internal/chung chi',
      'C:/Users/Administrator/Documents/portal/cert',
      'C:/Users/phupt.st/Documents/portal/cert'
    ].filter(Boolean);

    const CERT_DIR = certCandidates.find((dir) => {
      return (
        fs.existsSync(path.join(dir, 'homepage.key')) &&
        fs.existsSync(path.join(dir, 'homepage.crt'))
      );
    });

    if (!CERT_DIR) {
      throw new Error(
        `Không tìm thấy homepage.key/homepage.crt. Đã kiểm tra: ${certCandidates.join(', ')}`
      );
    }

    console.log('🔐 Running Vite with HTTPS');
    console.log('Using SSL cert folder:', CERT_DIR);

    sslConfig = {
      key: fs.readFileSync(path.join(CERT_DIR, 'homepage.key')),
      cert: fs.readFileSync(path.join(CERT_DIR, 'homepage.crt'))
    };
  } else {
    console.log('🌐 Running Vite with HTTP');
  }

  console.log('Mode:', mode);
  console.log('App protocol:', APP_PROTOCOL);
  console.log('App host:', APP_HOST);
  console.log('App domain:', APP_DOMAIN);
  console.log('API port:', API_PORT);
  console.log('Backend target:', BACKEND_TARGET);
  console.log('Allowed hosts:', allowedHosts);

  return {
    base,

    server: {
      open: true,
      port: DEV_PORT,
      host: DEV_HOST,
      https: sslConfig,
      allowedHosts,

      proxy: {
        '/api': proxyConfig,
        '/files': proxyConfig,
        '/uploads': proxyConfig,
        '/ws': {
          ...proxyConfig,
          ws: true
        },
        '/swagger-ui': proxyConfig,
        '/v3/api-docs': proxyConfig,
        '/swagger-resources': proxyConfig,
        '/webjars': proxyConfig
      }
    },

    preview: {
      open: true,
      host: DEV_HOST,
      port: DEV_PORT,
      https: sslConfig,
      allowedHosts
    },

    define: {
      global: 'window'
    },

    resolve: {
      alias: []
    },

    plugins: [react(), jsconfigPaths(), tailwindcss()]
  };
});