import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import it from './locales/it.json';

const LANG_KEY = 'teamdex_lang';

function detectLanguage(): string {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored && ['en', 'it'].includes(stored)) return stored;
  const browserLang = navigator.language.split('-')[0];
  if (['en', 'it'].includes(browserLang)) return browserLang;
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    it: { translation: it },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'it'],
  interpolation: {
    escapeValue: false,
  },
});

// Persist language changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_KEY, lng);
});

export default i18n;
