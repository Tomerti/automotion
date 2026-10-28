import type { State } from '../../core/model';
import { ACCEPT_INSET, RING_WIDTH, STATE_RADIUS } from './geometry';

export interface StateNodeProps {
  state: State;
  accepting: boolean;
  start: boolean;
  active: boolean;
  selected: boolean;
  error: boolean;
  faded: boolean;
  tint?: number;
}

export function StateNode(props: StateNodeProps): React.JSX.Element {
  const { state, accepting, start, active, selected, error, faded, tint } = props;
  return (
    <g
      className="av-state"
      data-testid={`state-${state.label}`}
      data-state-id={state.id}
      data-active={String(active)}
      data-accepting={String(accepting)}
      data-start={String(start)}
      data-selected={String(selected)}
      data-error={String(error)}
      data-faded={String(faded)}
      data-tint={tint === undefined ? undefined : String(tint)}
      transform={`translate(${state.x} ${state.y})`}
    >
      {/* Invisible hit area for the outer ring that starts drawing a transition. */}
      <circle className="av-state-hit" r={STATE_RADIUS + RING_WIDTH} />
      <circle className="av-state-body" r={STATE_RADIUS} />
      {accepting && <circle className="av-state-ring" r={STATE_RADIUS - ACCEPT_INSET} />}
      <text className="av-state-label">{state.label}</text>
    </g>
  );
}
