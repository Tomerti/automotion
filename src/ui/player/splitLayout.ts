import type { Point } from '../../core/geometry';
import { fitToView } from '../canvas/viewport';

export type SplitLayout = 'row' | 'column';

type Size = { width: number; height: number };

/**
 * Orientation for the subset split view: side by side ('row', NFA left) or stacked ('column',
 * NFA on top), whichever gives the smaller of the two fitted pane zooms the larger value.
 * Ties keep the side-by-side default.
 */
export function chooseSplitLayout(nfa: Point[], dfa: Point[], size: Size): SplitLayout {
  const worstZoom = (pane: Size): number =>
    Math.min(fitToView(nfa, pane).zoom, fitToView(dfa, pane).zoom);
  const row = worstZoom({ width: size.width / 2, height: size.height });
  const column = worstZoom({ width: size.width, height: size.height / 2 });
  return column > row ? 'column' : 'row';
}
