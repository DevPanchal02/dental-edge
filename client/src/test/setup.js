import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Automatically unmount and cleanup DOM after the test is finished.
afterEach(() => {
  cleanup();
});

// Polyfill for window.scrollTo (not implemented in Happy-DOM either)
// We check if 'window' exists first to be safe
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    value: () => {},
    writable: true,
  });
}