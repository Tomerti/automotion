import { STATE_RADIUS } from './geometry';
import type { Point } from './geometry';
import type { Automaton, StateId } from './model';
import type { Piece } from './thompson';

/** Centre-to-centre distance between the states an arrow of a piece joins. */
const H_GAP = 96;
/** Space between the boxes of a union's stacked branches. */
const V_GAP = 88;
/** Space between a star's arc and what it curves around. */
const ARC_CLEARANCE = 24;
/** Room beyond a star's arc for its label. */
const ARC_LABEL = 20;
/**
 * How much taller than its floor (the body's extent + a state's radius + ARC_CLEARANCE) a star's
 * arc may get before the star pads its body's ends instead. A parabola k times its floor high
 * meets a box with flat, full-height ends at u(1 − u) = 1/(4k) along it, so a lower k pads more.
 * 3/2 was picked on the test's ARCHES: well under the 2× it allows, 10–20% narrower than 4/3.
 */
const ARC_SLACK = 3 / 2;
/** Step in which a star pads its body's ends. */
const INSET_STEP = 24;

/** A piece's box: start at x = 0 and accept at x = width, both on its middle line. */
interface Box {
  width: number;
  /** Extent above and below the middle line, states and arcs and their labels included. */
  above: number;
  below: number;
  /** Union: the horizontal gap from its start to the branches, and each branch's middle line. */
  fan?: number;
  offsets?: number[];
  /** Star / plus: how far its back arrow bulges above the line and its skip arrow below. */
  back?: number;
  skip?: number;
  /**
   * Star / plus: padding at both ends of its body and on both ε-arrows around it, which keeps the
   * arcs low over a body with tall ends.
   */
  inset?: number;
}

/** A star / plus's choice: the padding at its body's ends and the bulges it leads to. */
interface Arcs {
  inset: number;
  back: number;
  skip: number;
}

/** A star / plus arc as laid out: from x1 to x2 on the line y, its apex `depth` below (< 0: above). */
interface Arc {
  x1: number;
  x2: number;
  y: number;
  depth: number;
}

interface Placed {
  pos: Map<StateId, Point>;
  bends: Map<string, number>;
  arcs: Arc[];
}

/** Something an arc has to curve around: a point and how far around it to keep clear. */
interface Obstacle extends Point {
  r: number;
}

const arrowId = (from: StateId, to: StateId): string => `${from}->${to}`;

/** Points along an arc (as a parabola between the state centres) and its label's spot. */
function arcObstacles({ x1, x2, y, depth }: Arc): Obstacle[] {
  const out: Obstacle[] = [];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    out.push({ x: x1 + (x2 - x1) * t, y: y + depth * 4 * t * (1 - t), r: 0 });
  }
  out.push({ x: (x1 + x2) / 2, y: y + depth + Math.sign(depth) * ARC_LABEL, r: 0 });
  return out;
}

const ARC_SEGMENTS = 32;
/**
 * An arc always clears in the end: as it grows its ends turn vertical, and every obstacle is at
 * least a state's width (an inner arc's point: an eighth of its chord) in from them. A bulge this
 * big means that broke, which is a bug, not a drawing to show.
 */
const MAX_BULGE = 1 << 20;

/** Distance from (x, out) to the arc 4·bulge·u·(1 − u) over the chord from x = 0 to `width`. */
function distanceToArc(x: number, out: number, width: number, bulge: number): number {
  const at = (i: number): Point => {
    const u = i / ARC_SEGMENTS;
    return { x: width * u, y: 4 * bulge * u * (1 - u) };
  };
  let best = Infinity;
  for (let i = 0; i < ARC_SEGMENTS; i++) {
    const a = at(i);
    const b = at(i + 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (out - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, out - a.y - t * dy));
  }
  return best;
}

/**
 * Smallest bulge, at least `least`, for an arc over the chord from x = 0 to x = `width` on y = 0
 * (bulging toward negative y when `up`) that passes every obstacle on its side with
 * ARC_CLEARANCE to spare. The arc is the parabola the diagram draws, 4·bulge·u·(1 − u) out at the
 * fraction u of the chord, so an apex that only clears the box would cut through states near a
 * long arc's steep ends. The room under the arc only grows with the bulge, so each obstacle's
 * smallest bulge that keeps it under the arc and clear of it is found by bisection.
 */
function bulgeClearing(obstacles: Obstacle[], width: number, up: boolean, least: number): number {
  let bulge = least;
  for (const o of obstacles) {
    const out = up ? -o.y : o.y;
    if (o.x <= 0 || o.x >= width || out + o.r <= 0) continue;
    const need = o.r + ARC_CLEARANCE;
    const u = o.x / width;
    // Under the arc, not beyond it, and far enough from it.
    const clears = (b: number): boolean =>
      out < 4 * b * u * (1 - u) && distanceToArc(o.x, out, width, b) >= need;
    if (clears(bulge)) continue;
    let lo = bulge;
    let hi = Math.max(2 * bulge, 1);
    while (!clears(hi)) {
      if (hi >= MAX_BULGE) throw new Error('Thompson layout: an arc cannot clear its body');
      lo = hi;
      hi *= 2;
    }
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (clears(mid)) hi = mid;
      else lo = mid;
    }
    bulge = hi;
  }
  return bulge;
}

/**
 * Horizontal gap from a union's start to its branches' starts (the same from their accepts to its
 * accept), whose middle lines are at `offsets`: H_GAP, widened so that in a tall stack the arrow
 * to a far branch still passes the starts of the branches nearer the middle line with a state's
 * width to spare. With the gap g, the arrow to offset y passes a start at offset y' at a distance
 * g·|y − y'| / √(g² + y²).
 */
function fanGap(offsets: number[]): number {
  const clear = 2 * STATE_RADIUS;
  let gap = H_GAP;
  for (const y of offsets) {
    for (const y2 of offsets) {
      const between = y2 !== y && Math.sign(y2) !== -Math.sign(y) && Math.abs(y2) < Math.abs(y);
      if (!between) continue;
      const d = Math.abs(y - y2);
      gap = Math.max(gap, (clear * Math.abs(y)) / Math.sqrt(d * d - clear * clear));
    }
  }
  return Math.ceil(gap / 24) * 24;
}

/**
 * Thompson's NFA drawn like the textbook: concatenation left to right, a union's branches stacked
 * between its new start and accept, a star's back arrow over its body and its skip arrow under.
 * Returns `result` with every state's position and the star / plus arrows' bends set; deterministic.
 */
export function layoutPieces(root: Piece, result: Automaton): Automaton {
  const boxes = new Map<Piece, Box>();

  const measure = (p: Piece): Box => {
    const known = boxes.get(p);
    if (known) return known;
    let box: Box;
    switch (p.node.type) {
      case 'sym':
      case 'eps':
      case 'empty':
        box = { width: H_GAP, above: STATE_RADIUS, below: STATE_RADIUS };
        break;
      case 'concat': {
        const [l, r] = (p.children as [Piece, Piece]).map(measure) as [Box, Box];
        box = {
          width: l.width + H_GAP + r.width,
          above: Math.max(l.above, r.above),
          below: Math.max(l.below, r.below),
        };
        break;
      }
      case 'union': {
        const branches = p.children.map(measure);
        // Middle lines measured from the first branch's, then centred on the union's.
        const lines: number[] = [];
        let y = 0;
        for (const [i, b] of branches.entries()) {
          if (i > 0) y += branches[i - 1]!.below + V_GAP + b.above;
          lines.push(y);
        }
        const top = -branches[0]!.above;
        const bottom = y + branches.at(-1)!.below;
        const centre = (top + bottom) / 2;
        const offsets = lines.map((l) => l - centre);
        const fan = fanGap(offsets);
        box = {
          width: 2 * fan + Math.max(...branches.map((b) => b.width)),
          above: centre - top,
          below: bottom - centre,
          fan,
          offsets,
        };
        break;
      }
      case 'star':
      case 'plus': {
        const bodyPiece = p.children[0]!;
        const body = measure(bodyPiece);
        const star = p.node.type === 'star';
        // The least each arc needs: the body's extent on that side, a state's radius, clearance.
        const backFloor = body.above + STATE_RADIUS + ARC_CLEARANCE;
        const skipFloor = body.below + STATE_RADIUS + ARC_CLEARANCE;
        /** The arcs over the body padded by `inset` at both ends, laid out on its own at (0, 0). */
        const arcsWith = (inset: number): Arcs => {
          const local: Placed = { pos: new Map(), bends: new Map(), arcs: [] };
          const bw = body.width + 2 * inset;
          place(bodyPiece, 0, 0, bw, inset, inset, local);
          const obstacles: Obstacle[] = [
            ...[...local.pos.values()].map((s) => ({ ...s, r: STATE_RADIUS })),
            ...local.arcs.flatMap(arcObstacles),
          ];
          const back = bulgeClearing(obstacles, bw, true, backFloor);
          // The skip's chord: the ε-arrows into and out of the body, padded alike, and the body.
          const side = H_GAP + inset;
          const skip = star
            ? bulgeClearing(
                obstacles.map((o) => ({ ...o, x: o.x + side })),
                bw + 2 * side,
                false,
                skipFloor,
              )
            : 0;
          return { inset, back, skip };
        };
        const excess = (a: Arcs): number =>
          Math.max(a.back / backFloor, star ? a.skip / skipFloor : 0);
        const snug = (a: Arcs): boolean => excess(a) <= ARC_SLACK;
        // The arcs rise steeply from their ends, so over a body whose ends are tall (a union's
        // stacked branches) they would tower over it. Padding the ends (inside the body for the
        // back arrow, the ε-arrows around it for the skip) trades width for height: the smallest
        // padding that keeps them snug, by doubling, then bisection; failing that the snuggest.
        let arcs = arcsWith(0);
        if (!snug(arcs)) {
          const maxSteps = Math.ceil((4 * body.width) / INSET_STEP);
          let best = arcs;
          let lo = 0;
          let hi = 1;
          arcs = arcsWith(INSET_STEP);
          while (!snug(arcs) && hi < maxSteps) {
            if (excess(arcs) < excess(best)) best = arcs;
            lo = hi;
            hi = Math.min(2 * hi, maxSteps);
            arcs = arcsWith(hi * INSET_STEP);
          }
          if (!snug(arcs) && excess(best) <= excess(arcs)) arcs = best;
          while (snug(arcs) && hi - lo > 1) {
            const mid = Math.floor((lo + hi) / 2);
            const tried = arcsWith(mid * INSET_STEP);
            if (snug(tried)) {
              hi = mid;
              arcs = tried;
            } else lo = mid;
          }
        }
        box = {
          width: body.width + 4 * arcs.inset + 2 * H_GAP,
          above: arcs.back + ARC_LABEL,
          below: star ? arcs.skip + ARC_LABEL : body.below,
          ...arcs,
        };
        break;
      }
    }
    boxes.set(p, box);
    return box;
  };

  /**
   * Lays `p` out with its start at (x, y), stretched to `width` (at least its box's): `lead` of it
   * goes between its start and the rest of it, `trail` between the rest and its accept, and any
   * more to its middle.
   */
  const place = (
    p: Piece,
    x: number,
    y: number,
    width: number,
    lead: number,
    trail: number,
    out: Placed,
  ): void => {
    const box = measure(p);
    const extra = width - box.width - lead - trail;
    switch (p.node.type) {
      case 'sym':
      case 'eps':
      case 'empty':
        out.pos.set(p.start, { x, y });
        out.pos.set(p.accept, { x: x + width, y });
        break;
      case 'concat': {
        // The joining ε-arrow takes up any extra width.
        const [l, r] = p.children as [Piece, Piece];
        const lw = measure(l).width + lead;
        const rw = measure(r).width + trail;
        place(l, x, y, lw, lead, 0, out);
        place(r, x + lw + H_GAP + extra, y, rw, 0, trail, out);
        break;
      }
      case 'union': {
        // Every branch is stretched to the widest, so their starts and accepts line up; the fans
        // take up any extra width, lead and trail.
        const fanIn = box.fan! + extra / 2 + lead;
        const inner = width - 2 * box.fan! - extra - lead - trail;
        out.pos.set(p.start, { x, y });
        out.pos.set(p.accept, { x: x + width, y });
        for (const [i, c] of p.children.entries())
          place(c, x + fanIn, y + box.offsets![i]!, inner, 0, 0, out);
        break;
      }
      case 'star':
      case 'plus': {
        const body = p.children[0]!;
        const inset = box.inset!;
        const bw = measure(body).width + 2 * inset;
        // The ε-arrows into and out of the body are padded by the inset too, and take up any
        // extra width, lead and trail in equal shares: lengthening both ends alike keeps the skip
        // arrow clear of the body.
        const bodyX = x + H_GAP + inset + (extra + lead + trail) / 2;
        out.pos.set(p.start, { x, y });
        out.pos.set(p.accept, { x: x + width, y });
        place(body, bodyX, y, bw, inset, inset, out);
        // Both arcs bulge right of their direction on screen (a negative bend): the back arrow
        // points left and goes over, the skip arrow points right and goes under.
        out.bends.set(arrowId(body.accept, body.start), -box.back!);
        out.arcs.push({ x1: bodyX, x2: bodyX + bw, y, depth: -box.back! });
        if (p.node.type === 'star') {
          out.bends.set(arrowId(p.start, p.accept), -box.skip!);
          out.arcs.push({ x1: x, x2: x + width, y, depth: box.skip! });
        }
        // A symbol or ε body's arrow is the back arrow's reverse, which the diagram would curve.
        if (body.node.type === 'sym' || body.node.type === 'eps') {
          out.bends.set(arrowId(body.start, body.accept), 0);
        }
        break;
      }
    }
  };

  const placed: Placed = { pos: new Map(), bends: new Map(), arcs: [] };
  place(root, 0, 0, measure(root).width, 0, 0, placed);
  return {
    ...result,
    states: result.states.map((s) => ({ ...s, ...placed.pos.get(s.id) })),
    transitions: result.transitions.map((t) => {
      const bend = placed.bends.get(t.id);
      return bend === undefined ? t : { ...t, bend };
    }),
  };
}
