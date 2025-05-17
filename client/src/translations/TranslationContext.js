import React, { createContext, useContext } from 'react';
import ruTranslations from './ru';

// Create a context for translations
const TranslationContext = createContext(null);

// Provider component to wrap around the app
export const TranslationProvider = ({ children }) => {
  // Use Russian translations by default (you can add more languages later)
  const translations = ruTranslations;
  
  // Translate function that will be used throughout the app
  const translate = (text) => {
    if (!text) return '';
    
    // If the text exists in translations, return the translated version
    // Otherwise, return the original text
    return translations[text] || text;
  };
  
  return (
    <TranslationContext.Provider value={{ translate }}>
      {children}
    </TranslationContext.Provider>
  );
};

// Custom hook to use translations
export const useTranslation = () => {
  const context = useContext(TranslationContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  
  return context.translate;
}; 