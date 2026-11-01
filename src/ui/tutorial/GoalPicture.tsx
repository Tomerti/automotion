import { memo } from 'react';
import type { Automaton, State } from '../../core/model';
import { Arrowhead } from '../canvas/EdgeView';
import type { Point } from '../canvas/geometry';
import { startArrowGeometry, STATE_RADIUS, transitionGeometry } from '../canvas/geometry';

/** Inner ring of an accepting state, as on the canvas. */
const ACCEPT_RING = STATE_RADIUS - 4;
/** World margin around everything drawn: label glyphs reach past their anchor points. */
const MARGIN = 12;
/** Start arrows are this long past the circle (geometry's START_ARROW_LENGTH). */
const START_ARROW = 32;

/**
 * A goal automaton as a small labelled picture, like the canvas draws it (states, start arrow,
 * accepting ring, arrows and their symbols), scaled to the card's width. Its own SVG, without
 * `Diagram`'s test ids, which the user's own automaton on the canvas carries.
 */
export const GoalPicture = memo(function GoalPicture(props: {
  automaton: Automaton;
  description: string;
}): React.JSX.Element {
  const { automaton, description } = props;
  const byId = new Map<string, State>(automaton.states.map((s) => [s.id, s]));
  const starts = automaton.starts
    .map((id) => byId.get(id))
    .filter((s): s is State => s !== undefined);
  const edges = automaton.transitions.flatMap((t) => {
    const from = byId.get(t.from);
    const to = byId.get(t.to);
    return from && to ? [{ t, g: transitionGeometry(automaton, from, to) }] : [];
  });

  // Everything that has to fit: each circle, each start arrow's tail, each symbol.
  const points: Point[] = [
    ...automaton.states.flatMap((s) => [
      { x: s.x - STATE_RADIUS, y: s.y - STATE_RADIUS },
      { x: s.x + STATE_RADIUS, y: s.y + STATE_RADIUS },
    ]),
    ...starts.map((s) => {
      const angle = s.startAngle ?? Math.PI;
      const r = STATE_RADIUS + START_ARROW;
      return { x: s.x + r * Math.cos(angle), y: s.y + r * Math.sin(angle) };
    }),
    ...edges.map(({ g }) => g.label),
  ];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - MARGIN;
  const minY = Math.min(...ys) - MARGIN;
  const width = Math.max(...xs) + MARGIN - minX;
  const height = Math.max(...ys) + MARGIN - minY;

  return (
    <svg
      className="av-tutorial-goal-picture"
      data-testid="tutorial-goal-picture"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      role="img"
      aria-label={description}
    >
      {starts.map((s) => {
        const arrow = startArrowGeometry(s, s.startAngle);
        return (
          <g key={s.id}>
            <path className="av-goal-edge" d={arrow.d} />
            <Arrowhead end={arrow.end} angle={arrow.endAngle} />
          </g>
        );
      })}
      {edges.map(({ t, g }) => (
        <g key={t.id}>
          <path className="av-goal-edge" d={g.d} />
          <Arrowhead end={g.end} angle={g.endAngle} />
          <text className="av-goal-symbols" x={g.label.x} y={g.label.y}>
            {t.symbols.join(',')}
          </text>
        </g>
      ))}
      {automaton.states.map((s) => (
        <g key={s.id}>
          <circle className="av-goal-state" cx={s.x} cy={s.y} r={STATE_RADIUS} />
          {automaton.accepting.includes(s.id) && (
            <circle className="av-goal-accept" cx={s.x} cy={s.y} r={ACCEPT_RING} />
          )}
          <text className="av-goal-label" x={s.x} y={s.y}>
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
});
