import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LabelText } from './LabelText';

afterEach(cleanup);

const subs = (el: Element): (string | null)[] =>
  [...el.querySelectorAll('sub')].map((s) => s.textContent);

describe('LabelText', () => {
  it('renders label subscripts as <sub>', () => {
    const { container } = render(<LabelText text="ε-closure: {q_0} → {q_0, q_{12}}" />);
    expect(container).toHaveTextContent('ε-closure: {q0} → {q0, q12}');
    expect(subs(container)).toEqual(['0', '0', '12']);
  });

  it('leaves plain text, quoted symbols and stray underscores alone', () => {
    const { container } = render(<LabelText text="Read '_': a_ b → _" className="x" />);
    expect(container.firstChild).toHaveClass('x');
    expect(container).toHaveTextContent("Read '_': a_ b → _");
    expect(subs(container)).toEqual([]);
  });

  it('keeps whitespace between words', () => {
    const { container } = render(<LabelText text="Ended in q_1,  which" />);
    expect(container.textContent).toBe('Ended in q1,  which');
  });

  it('keeps a quote inside a quoted regex, and subscripts after it', () => {
    const { container } = render(<LabelText text="'a'_b': then q_1, then {q_2', q_3}." />);
    expect(container.textContent).toBe("'a'_b': then q1, then {q2', q3}.");
    expect(subs(container)).toEqual(['1', '2', '3']);
  });
});
