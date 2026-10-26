/** Shared Factory Code syntax. Existence/ACTIVE checks always happen on backend. */
export const FACTORY_CODE_PATTERN = /^F[1-9]\d*$/;
export const normalizeFactoryCode = (code) => String(code || '').trim().toUpperCase();
export const isFactoryCode = (code) => FACTORY_CODE_PATTERN.test(normalizeFactoryCode(code));
