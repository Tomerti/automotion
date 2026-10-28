import { z } from 'zod';
import { EPSILON } from '../core/model';

const stateSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
});

const transitionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  symbols: z.array(z.string()),
  bend: z.number().optional(),
  loopAngle: z.number().optional(),
});

export const automatonSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['DFA', 'NFA']),
    alphabet: z.array(z.string()),
    states: z.array(stateSchema),
    start: z.string().nullable(),
    accepting: z.array(z.string()),
    transitions: z.array(transitionSchema),
  })
  .superRefine((a, ctx) => {
    const ids = new Set(a.states.map((s) => s.id));
    for (const t of a.transitions) {
      for (const end of [t.from, t.to]) {
        if (!ids.has(end)) {
          ctx.addIssue({
            code: 'custom',
            message: `Transition ${t.id} points to unknown state ${end}`,
          });
          return;
        }
      }
    }
    const multi =
      a.alphabet.some((s) => Array.from(s).length !== 1) ||
      a.transitions.some((t) => t.symbols.some((s) => s !== EPSILON && Array.from(s).length !== 1));
    if (multi) ctx.addIssue({ code: 'custom', message: 'Symbols must be single characters' });
  });

export const fileSchema = z.object({
  format: z.literal('automaton-vis'),
  version: z.number().int(),
  automata: z.array(automatonSchema),
});
