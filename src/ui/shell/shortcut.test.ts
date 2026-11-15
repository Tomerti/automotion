import { describe, expect, it } from 'vitest';
import { isCtrlLetter, shortcutLetter } from './shortcut';

const ctrl = { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };

describe('shortcutLetter', () => {
  it('reads a Latin key as typed, so AZERTY’s A key is a', () => {
    expect(shortcutLetter({ key: 'A', code: 'KeyA' })).toBe('a');
    expect(shortcutLetter({ key: 'a', code: 'KeyQ' })).toBe('a');
  });

  it('falls back to the physical key on a Hebrew or Russian layout', () => {
    expect(shortcutLetter({ key: 'ש', code: 'KeyA' })).toBe('a');
    expect(shortcutLetter({ key: 'ב', code: 'KeyC' })).toBe('c');
    expect(shortcutLetter({ key: 'ф', code: 'KeyA' })).toBe('a');
  });

  it('is empty for a key with no letter', () => {
    expect(shortcutLetter({ key: 'Delete', code: 'Delete' })).toBe('');
    expect(shortcutLetter({ key: '1', code: 'Digit1' })).toBe('');
  });
});

describe('isCtrlLetter', () => {
  it('needs Ctrl or ⌘, and no Shift or Alt', () => {
    expect(isCtrlLetter({ key: 'ש', code: 'KeyA', ...ctrl }, 'a')).toBe(true);
    expect(
      isCtrlLetter({ key: 'a', code: 'KeyA', ...ctrl, ctrlKey: false, metaKey: true }, 'a'),
    ).toBe(true);
    expect(isCtrlLetter({ key: 'a', code: 'KeyA', ...ctrl, ctrlKey: false }, 'a')).toBe(false);
    expect(isCtrlLetter({ key: 'A', code: 'KeyA', ...ctrl, shiftKey: true }, 'a')).toBe(false);
    expect(isCtrlLetter({ key: 'c', code: 'KeyC', ...ctrl }, 'a')).toBe(false);
  });
});
