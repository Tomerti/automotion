import type { Point } from '../../core/geometry';

export interface EdgeViewProps {
  transitionId: string;
  fromLabel: string;
  toLabel: string;
  symbols: string[];
  geometry: { d: string; label: Point; end: Point; endAngle: number };
  taken: boolean;
  selected: boolean;
  error: boolean;
  /** Its label is being edited in place: hide the drawn one under the input. */
  editing?: boolean;
}

const HEAD_LENGTH = 10;
const HEAD_HALF_WIDTH = 5;
const HEAD_PATH = `M 0 0 L ${-HEAD_LENGTH} ${-HEAD_HALF_WIDTH} L ${-HEAD_LENGTH} ${HEAD_HALF_WIDTH} Z`;

/** Small filled triangle whose tip sits at `end`, pointing along `angle` (radians). */
export function Arrowhead(props: { end: Point; angle: number }): React.JSX.Element {
  const { end, angle } = props;
  const deg = (angle * 180) / Math.PI;
  return (
    <path
      className="av-edge-head"
      d={HEAD_PATH}
      transform={`translate(${end.x} ${end.y}) rotate(${deg})`}
    />
  );
}

export function EdgeView(props: EdgeViewProps): React.JSX.Element {
  const { transitionId, fromLabel, toLabel, symbols, geometry, taken, selected, error, editing } =
    props;
  return (
    <g
      className="av-edge"
      data-testid={`edge-${fromLabel}-${toLabel}`}
      data-transition-id={transitionId}
      data-taken={String(taken)}
      data-selected={String(selected)}
      data-error={String(error)}
      data-editing={editing ? 'true' : undefined}
    >
      <path className="av-edge-hit" d={geometry.d} />
      <path className="av-edge-path" d={geometry.d} />
      <Arrowhead end={geometry.end} angle={geometry.endAngle} />
      <text
        className="av-edge-label"
        data-testid="edge-label"
        x={geometry.label.x}
        y={geometry.label.y}
      >
        {symbols.join(',')}
      </text>
    </g>
  );
}
