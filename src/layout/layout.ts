import ELK from 'elkjs/lib/elk.bundled.js';
import type { Automaton } from '../core/model';

// Mirrors ui's STATE_RADIUS; kept local so layout/ depends only on core/.
const STATE_RADIUS = 24;
const NODE_SIZE = 2 * STATE_RADIUS + 16;

const elk = new ELK();

export async function layoutAutomaton(a: Automaton): Promise<Automaton> {
  if (a.states.length === 0) return a;

  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '96',
    },
    children: a.states.map((s) => ({
      id: s.id,
      width: NODE_SIZE,
      height: NODE_SIZE,
      ...(s.id === a.start ? { layoutOptions: { 'elk.layered.layering.layerConstraint': 'FIRST' } } : {}),
    })),
    edges: a.transitions
      .filter((t) => t.from !== t.to)
      .map((t) => ({ id: t.id, sources: [t.from], targets: [t.to] })),
  });

  const pos = new Map((graph.children ?? []).map((c) => [c.id, c]));
  return {
    ...a,
    states: a.states.map((s) => {
      const c = pos.get(s.id);
      if (!c) return s;
      return { ...s, x: (c.x ?? 0) + NODE_SIZE / 2, y: (c.y ?? 0) + NODE_SIZE / 2 };
    }),
  };
}
