import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineInput, type InlineInputProps } from './InlineInput';

const props = (extra: Partial<InlineInputProps> = {}): InlineInputProps => ({
  testId: 'rename-input',
  label: 'State name',
  initial: 'even',
  at: { x: 100, y: 50 },
  fontSize: 30,
  onSubmit: () => null,
  onCancel: () => {},
  onBlur: () => {},
  ...extra,
});

const rect = (top: number, height: number): DOMRect =>
  ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect;

describe('InlineInput', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('is centred on its point when no baseline is given', () => {
    render(<InlineInput {...props()} />);
    const box = screen.getByTestId('rename-input').parentElement as HTMLElement;
    expect(box.style).toMatchObject({ left: '100px', top: '50px', fontSize: '30px' });
    expect(box.style.transform).toBe('');
  });

  it("moves its text's baseline to where the drawn label puts it", () => {
    // Laid out, the box is 36px tall and its text's baseline is 28px down: 10px below the
    // centre. The label wants it 0.3em = 9px below, so the box goes up 1px.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('av-inline-baseline') ? rect(128, 0) : rect(100, 36);
    });
    const baseline = vi.fn((text: string) => (text === 'even' ? 0.3 : 0));
    render(<InlineInput {...props({ baseline })} />);
    const box = screen.getByTestId('rename-input').parentElement as HTMLElement;
    expect(baseline).toHaveBeenCalledWith('even');
    expect(box.style.transform).toBe('translate(-50%, calc(-50% + -1px))');
  });

  it('puts its baseline on a whole device pixel, where the drawn label’s baseline rounds to', () => {
    // At 125% the label wants its baseline at 127.3 css px = 159.125 device px, drawn on row 159:
    // the input's text goes there exactly (127.2 css px), not a fraction off that HTML text rounds
    // to the next row.
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1.25);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('av-inline-baseline') ? rect(128.3, 0) : rect(100.3, 36);
    });
    render(<InlineInput {...props({ baseline: () => 0.3 })} />);
    const box = screen.getByTestId('rename-input').parentElement as HTMLElement;
    const shift = Number(/calc\(-50% \+ (-?[\d.]+)px\)/.exec(box.style.transform)?.[1]);
    expect(shift).toBeCloseTo(-1.1, 6);
  });
});
