// FILE: client/src/context/LayoutContext.jsx
import React, { createContext, useContext } from 'react';

const LayoutContext = createContext();

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

// Provider will be used within Layout.jsx itself
export { LayoutContext };