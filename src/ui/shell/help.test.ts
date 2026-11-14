import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { SEEN_HELP_KEY, useWelcome } from './help';

beforeEach(() => localStorage.clear());

it('useWelcome(true) starts closed and leaves the help unseen', () => {
  const { result } = renderHook(() => useWelcome(true));
  expect(result.current[0]).toBe(false);
  expect(localStorage.getItem(SEEN_HELP_KEY)).toBeNull();
});

it('useWelcome() opens on a first visit', () => {
  expect(renderHook(() => useWelcome()).result.current[0]).toBe(true);
});
