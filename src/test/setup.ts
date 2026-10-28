import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// The controls popup opens by itself on a first visit; tests start as return visitors.
// Tests of that first visit remove the key themselves.
beforeEach(() => {
  localStorage.setItem('automaton-vis:seen-help', '1');
});
