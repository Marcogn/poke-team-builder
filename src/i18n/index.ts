import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import it from './locales/it.json';

const LANG_KEY = 'teamdex_lang';
const SUPPORTED_LANGUAGES = ['en', 'it'];

function detectLanguage(): string {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  const browserLang = navigator.language.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(browserLang)) return browserLang;
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    it: { translation: it },
  },
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false,
  },
});

// Persist language changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem(LANG_KEY, lng);
});

export default i18n;
