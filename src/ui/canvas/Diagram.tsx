import type { Automaton, State, StateId, Sym } from '../../core/model';
import type { Viewport } from '../../store/types';
import { Arrowhead, EdgeView } from './EdgeView';
import { StateNode } from './StateNode';
import { diagramStyles } from './diagramStyles';
import { startArrowGeometry, STATE_RADIUS, transitionGeometry } from './geometry';

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
  editing?: string; // id of the state or transition whose label is being edited in place
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

  const starts = automaton.starts
    .map((id) => stateById.get(id))
    .filter((s): s is State => s !== undefined && stateVisible(s.id));

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
        {starts.map((start) => (
          <g
            key={start.id}
            className="av-start-arrow"
            data-testid="start-arrow"
            data-state-id={start.id}
          >
            <path className="av-edge-path" d={startArrowGeometry(start).d} />
            <Arrowhead end={{ x: start.x - STATE_RADIUS, y: start.y }} angle={0} />
          </g>
        ))}
        {visibleTransitions.map((t) => {
          const from = stateById.get(t.from) as State;
          const to = stateById.get(t.to) as State;
          const geometry = transitionGeometry(automaton, from, to);
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
              editing={highlight.editing === t.id}
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
              start={automaton.starts.includes(s.id)}
              active={has(highlight.active, s.id)}
              selected={has(highlight.selectedStates, s.id)}
              error={has(highlight.errorStates, s.id)}
              faded={has(highlight.faded, s.id)}
              tint={highlight.tints?.[s.id]}
              editing={highlight.editing === s.id}
            />
          ))}
        {children}
      </g>
    </svg>
  );
}
