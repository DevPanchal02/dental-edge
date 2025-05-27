// FILE: client/src/context/ThemeContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const localTheme = localStorage.getItem('theme');
    // Default to light mode if no theme is stored or if stored theme is invalid
    return (localTheme === 'light' || localTheme === 'dark') ? localTheme : 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = ''; // Clear existing theme classes
    document.body.classList.add(theme + '-mode'); // Add current theme class
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};