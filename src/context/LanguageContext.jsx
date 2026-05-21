'use client';
import React, { createContext, useState, useEffect, useContext } from 'react';
import vi from '../i18n/vi.json';
import en from '../i18n/en.json';
import ja from '../i18n/ja.json';
import my from '../i18n/my.json';
import pt from '../i18n/pt.json';

const translations = { vi, en, ja, my, pt };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('vi');

  useEffect(() => {
    const savedLang = localStorage.getItem('jobchat_lang');
    if (savedLang && translations[savedLang]) {
      setLang(savedLang);
    }
  }, []);

  const changeLanguage = (newLang) => {
    if (translations[newLang]) {
      setLang(newLang);
      localStorage.setItem('jobchat_lang', newLang);
    }
  };

  const t = (key) => {
    const keys = key.split('.');
    let result = translations[lang];
    for (const k of keys) {
      if (result && result[k]) {
        result = result[k];
      } else {
        return key; // Fallback to key if not found
      }
    }
    return result;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
