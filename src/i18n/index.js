import en_common from './locales/en/common';
import en_dashboard from './locales/en/dashboard';
import en_reports from './locales/en/reports';
import en_devices from './locales/en/devices';
import en_shipping from './locales/en/shipping';
import en_lululemon from './locales/en/lululemon';
import en_es from './locales/en/es';
import en_errors from './locales/en/errors';
import en_accounts from './locales/en/accounts';
import en_orders from './locales/en/orders';
import en_audit from './locales/en/audit';
import vi_common from './locales/vi/common';
import vi_dashboard from './locales/vi/dashboard';
import vi_reports from './locales/vi/reports';
import vi_devices from './locales/vi/devices';
import vi_shipping from './locales/vi/shipping';
import vi_lululemon from './locales/vi/lululemon';
import vi_es from './locales/vi/es';
import vi_errors from './locales/vi/errors';
import vi_accounts from './locales/vi/accounts';
import vi_orders from './locales/vi/orders';
import vi_audit from './locales/vi/audit';

// Preserve string-key lookups for all existing trUi(...) consumers.
const en = {...en_common, ...en_dashboard, ...en_reports, ...en_devices, ...en_shipping, ...en_lululemon, ...en_es, ...en_errors, ...en_accounts, ...en_orders, ...en_audit};
const vi = {...vi_common, ...vi_dashboard, ...vi_reports, ...vi_devices, ...vi_shipping, ...vi_lululemon, ...vi_es, ...vi_errors, ...vi_accounts, ...vi_orders, ...vi_audit};

export const translations = { en, vi };
export { systemMessagePatterns } from './messagePatterns';
