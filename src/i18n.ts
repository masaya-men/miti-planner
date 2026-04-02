import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ko from './locales/ko.json';

// localStorageに保存されたユーザーの言語設定を復元する
// useThemeStore (zustand persist) が 'theme-storage' キーに保存している
const SUPPORTED_LANGS = ['ja', 'en', 'zh', 'ko'] as const;
function getSavedLanguage(): typeof SUPPORTED_LANGS[number] {
    try {
        const raw = localStorage.getItem('theme-storage');
        if (raw) {
            const parsed = JSON.parse(raw);
            const lang = parsed?.state?.contentLanguage;
            if (SUPPORTED_LANGS.includes(lang)) return lang;
        }
    } catch { /* localStorageアクセス失敗時はデフォルト */ }
    return 'ja';
}

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        ja: { translation: ja },
        zh: { translation: zh },
        ko: { translation: ko },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
