import { useTranslation as useI18nTranslation } from 'react-i18next';
import i18n from '@/i18n';

/**
 * Custom hook wrapper for translations with type safety
 */
export function useTranslation(ns?: string) {
  const { t, i18n: i18nInstance, ready } = useI18nTranslation(ns);

  const changeLanguage = async (lang: 'pt-BR' | 'en-US') => {
    await i18nInstance.changeLanguage(lang);
  };

  const currentLanguage = i18nInstance.language as 'pt-BR' | 'en-US';

  return {
    t,
    i18n: i18nInstance,
    ready,
    changeLanguage,
    currentLanguage,
    languages: ['pt-BR', 'en-US'] as const,
  };
}

export { i18n };
