// ==============================|| THEME CONSTANT ||============================== //

export const APP_DEFAULT_PATH = '/dashboard';
export const HORIZONTAL_MAX_ITEM = 6;
export const DRAWER_WIDTH = 236;
export const MINI_DRAWER_WIDTH = 64;
export const HEADER_HEIGHT = 64;
export const GRID_COMMON_SPACING = { xs: 2, md: 2.5 };

// ==============================|| API CONFIG ||============================== //

export {
  APP_ENV,
  API_BASE_URL,
  API_ROOT,
  FILE_ROOT,
  WS_URL
} from './appEnv';


// ==============================|| THEME CONFIG ||============================== //

const config = {
  fontFamily: `Inter var`,
  i18n: 'en',
  menuOrientation: 'vertical',
  menuCaption: true,
  miniDrawer: true,
  container: true,
  mode: 'light',
  presetColor: 'default',
  themeDirection: 'ltr',
  themeContrast: false
};

export default config;