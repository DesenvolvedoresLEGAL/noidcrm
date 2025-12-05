import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-BR.json';
import enUS from './locales/en-US.json';

export const defaultNS = 'common';
export const resources = {
  'pt-BR': ptBR,
  'en-US': enUS,
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en-US'],
    
    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'noid-crm-language',
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
