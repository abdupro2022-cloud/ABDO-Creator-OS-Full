import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ar from "./ar.json";

const STORAGE_KEY = "abdo.lang";

const initialLang = (() => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "ar") return stored;
  return "en";
})();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: "en" | "ar"): void {
  i18n.changeLanguage(lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, lang);
}

// Apply initial direction on load.
if (typeof document !== "undefined") {
  document.documentElement.lang = initialLang;
  document.documentElement.dir = initialLang === "ar" ? "rtl" : "ltr";
}

export default i18n;
