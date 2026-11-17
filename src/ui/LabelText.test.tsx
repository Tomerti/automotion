import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { eliminate } from '../core/eliminate';
import { fixture } from '../core/testing/fixtures';
import { thompson } from '../core/thompson';
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

describe('LabelText with regex walkthrough explanations', () => {
  it('shows Thompson regexes literally, without backticks or subscripts', () => {
    const steps = thompson('(a | _)*').steps;
    const star = steps.filter((s) => s.phase === 'build' && s.span?.start === 0).at(-1);
    const sym = steps.find((s) => s.phase === 'build' && s.span?.start === 5);
    const done = steps.at(-1);
    const shown = [star, sym, done].map((step) => {
      const { container, unmount } = render(<LabelText text={step?.explanation ?? ''} />);
      const text = container.textContent;
      expect(subs(container)).toEqual([]);
      unmount();
      return text;
    });
    for (const text of shown) expect(text).not.toContain('`');
    expect(shown[0]).toMatch(/^'\(a\|_\)\*': a new start/);
    expect(shown[1]).toMatch(/^'_': .* joined by '_'\.$/);
    expect(shown[2]).toMatch(/^The NFA for '\(a\|_\)\*': /);
  });

  it('shows an eliminate formula with a _ symbol literally, state subscripts kept', () => {
    const a = fixture({
      kind: 'NFA',
      alphabet: '_b',
      states: ['p_1', 'q_y', 'r'],
      start: 'p_1',
      accepting: ['r'],
      edges: [
        ['p_1', '_', 'q_y'],
        ['q_y', 'b', 'r'],
      ],
    });
    const remove = eliminate(a, ['q_y']).steps.find((s) => s.phase === 'remove');
    const { container } = render(<LabelText text={remove?.explanation ?? ''} />);
    expect(container.textContent).toMatch(/^qy is gone\. New labels: p₁ → r: '_b'\.$/);
    expect(subs(container)).toEqual(['y']);
  });
});
