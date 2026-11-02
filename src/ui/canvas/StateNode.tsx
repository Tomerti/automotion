import { parseLabel } from '../../core/label';
import type { State } from '../../core/model';
import { ACCEPT_INSET, HIT_MARGIN, labelFontSize, STATE_RADIUS } from './geometry';

export interface StateNodeProps {
  state: State;
  accepting: boolean;
  start: boolean;
  active: boolean;
  selected: boolean;
  error: boolean;
  faded: boolean;
  tint?: number;
  /** Pointed at by the open issues popover: ringed in the issue's color. */
  issue?: 'error' | 'warning';
  /** Its label is being edited in place: hide the drawn one under the input. */
  editing?: boolean;
}

/** Subscripts are set at this share of the label size, lowered by SUB_SHIFT of the label size. */
const SUB_SCALE = 0.7;
const SUB_SHIFT = 0.25;
/** How far outside the circle an issue ring sits. */
const ISSUE_GAP = 7;

/**
 * Label text as tspans: subscript runs smaller and lowered, the run after one raised back.
 * Shifts are in px of the label size, so lowering and raising cancel out exactly.
 */
function LabelText(props: { label: string; fontSize: number }): React.JSX.Element {
  const { label, fontSize } = props;
  const shift = fontSize * SUB_SHIFT;
  const segments = parseLabel(label);
  return (
    <text className="av-state-label" style={{ fontSize }}>
      {segments.map((seg, i) => {
        const lowered = segments[i - 1]?.sub ?? false;
        const dy = seg.sub === lowered ? undefined : seg.sub ? shift : -shift;
        return (
          <tspan
            key={i}
            className={seg.sub ? 'av-state-label-sub' : undefined}
            dy={dy}
            fontSize={seg.sub ? `${SUB_SCALE}em` : undefined}
          >
            {seg.text}
          </tspan>
        );
      })}
    </text>
  );
}

export function StateNode(props: StateNodeProps): React.JSX.Element {
  const { state, accepting, start, active, selected, error, faded, tint, issue, editing } = props;
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
      data-issue={issue}
      data-editing={editing ? 'true' : undefined}
      transform={`translate(${state.x} ${state.y})`}
    >
      {/* Invisible hit area a little larger than the circle. */}
      <circle className="av-state-hit" r={STATE_RADIUS + HIT_MARGIN} />
      {issue && <circle className="av-state-issue" r={STATE_RADIUS + ISSUE_GAP} />}
      <circle className="av-state-body" r={STATE_RADIUS} />
      {accepting && <circle className="av-state-ring" r={STATE_RADIUS - ACCEPT_INSET} />}
      <LabelText label={state.label} fontSize={labelFontSize(state.label)} />
    </g>
  );
}
