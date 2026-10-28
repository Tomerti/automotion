import type { Automaton, State, StateId, Sym } from '../../core/model';
import type { Viewport } from '../../store/types';
import { Arrowhead, EdgeView } from './EdgeView';
import { StateNode } from './StateNode';
import { diagramStyles } from './diagramStyles';
import {
  bestLoopAngle,
  edgeGeometry,
  selfLoopGeometry,
  startArrowGeometry,
  STATE_RADIUS,
  type Point,
} from './geometry';

export interface DiagramHighlight {
  active?: StateId[];
  taken?: string[]; // run / focus
  faded?: StateId[]; // minimization trim
  tints?: Record<StateId, number>; // partition block index
  visibleStates?: StateId[];
  visibleTransitions?: string[]; // subset reveal; undefined = all
  edgeSymbols?: Record<string, Sym[]>; // label override per transition id (subset: built so far)
  errorStates?: StateId[];
  errorTransitions?: string[];
  selectedStates?: StateId[];
  selectedTransitions?: string[];
}

export interface DiagramProps {
  automaton: Automaton;
  viewport: Viewport;
  highlight?: DiagramHighlight;
  svgRef?: React.Ref<SVGSVGElement>;
  children?: React.ReactNode; // overlay layer (e.g. a rubber-band edge while drawing)
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onContextMenu?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

/** Distance of the virtual neighbor standing in for the start arrow. */
const START_ARROW_CLEARANCE = 100;

const has = (list: readonly string[] | undefined, id: string): boolean =>
  list !== undefined && list.includes(id);

export function Diagram(props: DiagramProps): React.JSX.Element {
  const { automaton, viewport, highlight = {}, svgRef, children } = props;
  const stateById = new Map<StateId, State>(automaton.states.map((s) => [s.id, s]));

  const stateVisible = (id: StateId): boolean =>
    highlight.visibleStates === undefined || highlight.visibleStates.includes(id);

  const visibleTransitions = automaton.transitions.filter((t) => {
    const from = stateById.get(t.from);
    const to = stateById.get(t.to);
    return (
      from !== undefined &&
      to !== undefined &&
      stateVisible(t.from) &&
      stateVisible(t.to) &&
      (highlight.visibleTransitions === undefined || highlight.visibleTransitions.includes(t.id))
    );
  });

  const hasEdge = (from: StateId, to: StateId): boolean =>
    automaton.transitions.some((t) => t.from === from && t.to === to);

  const start = automaton.start === null ? undefined : stateById.get(automaton.start);
  const startVisible = start !== undefined && stateVisible(start.id);

  return (
    <svg
      ref={svgRef}
      className="av-diagram"
      data-testid="diagram"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onDoubleClick}
      onContextMenu={props.onContextMenu}
    >
      <style>{diagramStyles}</style>
      <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
        {startVisible && (
          <g className="av-start-arrow" data-testid="start-arrow">
            <path className="av-edge-path" d={startArrowGeometry(start).d} />
            <Arrowhead end={{ x: start.x - STATE_RADIUS, y: start.y }} angle={0} />
          </g>
        )}
        {visibleTransitions.map((t) => {
          const from = stateById.get(t.from) as State;
          const to = stateById.get(t.to) as State;
          let geometry;
          if (t.from === t.to) {
            const neighbors: Point[] = automaton.transitions
              .filter((o) => o.from !== o.to && (o.from === t.from || o.to === t.from))
              .map((o) => stateById.get(o.from === t.from ? o.to : o.from))
              .filter((s): s is State => s !== undefined);
            // The start arrow enters from the left: treat that direction as occupied.
            if (automaton.start === t.from) {
              neighbors.push({ x: from.x - START_ARROW_CLEARANCE, y: from.y });
            }
            geometry = selfLoopGeometry(from, bestLoopAngle(from, neighbors));
          } else {
            geometry = edgeGeometry(from, to, hasEdge(t.to, t.from));
          }
          return (
            <EdgeView
              key={t.id}
              transitionId={t.id}
              fromLabel={from.label}
              toLabel={to.label}
              symbols={highlight.edgeSymbols?.[t.id] ?? t.symbols}
              geometry={geometry}
              taken={has(highlight.taken, t.id)}
              selected={has(highlight.selectedTransitions, t.id)}
              error={has(highlight.errorTransitions, t.id)}
            />
          );
        })}
        {automaton.states
          .filter((s) => stateVisible(s.id))
          .map((s) => (
            <StateNode
              key={s.id}
              state={s}
              accepting={automaton.accepting.includes(s.id)}
              start={automaton.start === s.id}
              active={has(highlight.active, s.id)}
              selected={has(highlight.selectedStates, s.id)}
              error={has(highlight.errorStates, s.id)}
              faded={has(highlight.faded, s.id)}
              tint={highlight.tints?.[s.id]}
            />
          ))}
        {children}
      </g>
    </svg>
  );
}
