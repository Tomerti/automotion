import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// The welcome dialog opens by itself on a first visit; tests start as return visitors.
// Tests of that first visit remove the key themselves.
beforeEach(() => {
  localStorage.setItem('automotion:seen-help', '1');
});
