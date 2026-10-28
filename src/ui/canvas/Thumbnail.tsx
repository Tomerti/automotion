import { memo } from 'react';
import type { Automaton, State } from '../../core/model';
import { Arrowhead } from './EdgeView';
import { startArrowGeometry, STATE_RADIUS, transitionGeometry } from './geometry';
import { fitToView } from './viewport';

/** Inner ring of an accepting state, as on the canvas. */
const ACCEPT_RING = STATE_RADIUS - 5;
/** World margin around the states, enough for self-loops and the start arrow. */
const FIT_PADDING = 40;
/** Small automata stay small instead of filling the box, so their loops fit too. */
const MAX_ZOOM = 0.45;

/**
 * A small read-only picture of `automaton` (no labels, no test ids, so it never clashes with the
 * canvas's `Diagram`), fitted into `width` × `height`. Memoized: automata are immutable, so it
 * redraws only when its automaton changes.
 */
export const Thumbnail = memo(function Thumbnail(props: {
  automaton: Automaton;
  width: number;
  height: number;
}): React.JSX.Element {
  const { automaton, width, height } = props;
  const vp = fitToView(automaton.states, { width, height }, FIT_PADDING, MAX_ZOOM);
  const byId = new Map<string, State>(automaton.states.map((s) => [s.id, s]));
  const start = automaton.start === null ? undefined : byId.get(automaton.start);

  return (
    <svg
      className="av-thumb"
      data-testid="history-thumbnail"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
        {start && (
          <g className="av-thumb-start">
            <path className="av-thumb-edge-path" d={startArrowGeometry(start).d} />
            <Arrowhead end={{ x: start.x - STATE_RADIUS, y: start.y }} angle={0} />
          </g>
        )}
        {automaton.transitions.map((t) => {
          const from = byId.get(t.from);
          const to = byId.get(t.to);
          if (!from || !to) return null;
          const g = transitionGeometry(automaton, from, to);
          return (
            <g key={t.id} className="av-thumb-edge">
              <path className="av-thumb-edge-path" d={g.d} />
              <Arrowhead end={g.end} angle={g.endAngle} />
            </g>
          );
        })}
        {automaton.states.map((s) => (
          <g key={s.id}>
            <circle className="av-thumb-state" cx={s.x} cy={s.y} r={STATE_RADIUS} />
            {automaton.accepting.includes(s.id) && (
              <circle className="av-thumb-accept" cx={s.x} cy={s.y} r={ACCEPT_RING} />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
});
