import { createContext, useContext } from 'react';

interface LayoutContextType {
  isSidebarOpen: boolean;
  isSidebarEffectivelyPinned: boolean;
}

// Don't define a provider component here because Layout.tsx acts as the provider.
export const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider (Layout.tsx)');
  }
  return context;
};