import { labelBaselineOffset, parseLabel, SUB_SCALE, SUB_SHIFT } from '../../core/label';
import type { State } from '../../core/model';
import { ACCEPT_INSET, HIT_MARGIN, labelFontSize, STATE_RADIUS } from '../../core/geometry';

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

/** How far outside the circle an issue ring sits. */
const ISSUE_GAP = 7;

/**
 * A state label's runs as tspans, for a `<text>` of `fontSize`: subscript runs smaller and
 * lowered, the run after one raised back. Shifts are in px of the label size, so lowering and
 * raising cancel out exactly.
 */
export function LabelSpans(props: { label: string; fontSize: number }): React.JSX.Element {
  const { label, fontSize } = props;
  const shift = fontSize * SUB_SHIFT;
  const segments = parseLabel(label);
  return (
    <>
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
    </>
  );
}

/**
 * Label text with its subscripts. The baseline is placed so the ink, not the font's em box, is
 * centred on the state.
 */
function LabelText(props: { label: string; fontSize: number }): React.JSX.Element {
  const { label, fontSize } = props;
  const y = Math.round(fontSize * labelBaselineOffset(label) * 100) / 100;
  return (
    <text className="av-state-label" y={y} style={{ fontSize }}>
      <LabelSpans label={label} fontSize={fontSize} />
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
