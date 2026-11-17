import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations, systemMessagePatterns } from './index';

const LANGUAGE_STORAGE_KEY = 'cartonloading.ui.language';
const VALID_LANGUAGES = new Set(['en', 'vi']);
const LanguageContext = createContext(null);

const readLanguage = () => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return VALID_LANGUAGES.has(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
};

// Interpolate only explicit parameters after translating the fixed system text.
// PO, SSCC, Factory IDs and imported values remain unchanged.
const formatMessage = (template, values) => {
  if (!values.length) return template;
  return template.replace(/\{(\d+)\}/g, (original, index) => {
    const position = Number(index);
    return position < values.length ? String(values[position] ?? '') : original;
  });
};

/** Translate only mapped UI labels. Values sent to APIs must never pass through this helper. */
export const translateUi = (value, language = 'en', ...values) => {
  if (typeof value !== 'string') return value;
  const activeLanguage = VALID_LANGUAGES.has(language) ? language : 'en';
  const key = value.replace(/\s+/g, ' ').trim();
  if (!key) return value;
  const replacement = translations[activeLanguage]?.[key] ?? translations.en?.[key] ?? key;
  if (replacement === key && values.length === 0) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return `${leading}${formatMessage(replacement, values)}${trailing}`;
};

/** Localize recognized server messages, keeping dynamic data captures intact. */
export function translateSystemMessage(message, language = 'en') {
  if (typeof message !== 'string' || language !== 'vi') return message;
  const clean = message.replace(/\s+/g, ' ').trim();
  if (!clean) return message;
  const known = translations.vi?.[clean];
  if (known && known !== clean) return known;
  for (const item of systemMessagePatterns) {
    const match = clean.match(new RegExp(item.source, 'i'));
    if (!match) continue;
    return item.vi.replace(/\{(\d+)\}/g, (_, index) => {
      const position = Number(index);
      const value = match[position + 1] ?? '';
      if (item.dateCaptures?.includes(position) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return `${day}/${month}/${year}`;
      }
      return item.translateList && position === 1
        ? value.split(', ').map((label) => translations.vi?.[label] ?? label).join(', ')
        : value;
    });
  }
  return message; // Unknown server messages are not guessed or machine-translated.
}

export function LanguageProvider({ children }) {
  const [language, changeLanguage] = useState(readLanguage);
  const setLanguage = useCallback((value) => {
    if (VALID_LANGUAGES.has(value)) changeLanguage(value);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Optional */ }
    document.documentElement.lang = language;
  }, [language]);
  const t = useCallback((value, ...values) => translateUi(value, language, ...values), [language]);
  const systemMessage = useCallback((value) => translateSystemMessage(value, language), [language]);
  const contextValue = useMemo(() => ({ language, setLanguage, t, systemMessage }), [language, setLanguage, t, systemMessage]);
  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage requires LanguageProvider');
  return context;
}

export function useT() { return useLanguage().t; }
export function useSystemMessage() { return useLanguage().systemMessage; }
