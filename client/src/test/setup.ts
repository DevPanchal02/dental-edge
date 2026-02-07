import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom'; // Ensure this is installed for extra matchers

// Automatically unmount and cleanup DOM after the test is finished.
afterEach(() => {
  cleanup();
});

// Polyfill for window.scrollTo (not implemented in Happy-DOM)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', {
    value: () => {},
    writable: true,
  });
}