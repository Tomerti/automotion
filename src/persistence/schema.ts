import { z } from 'zod';
import { EPSILON } from '../core/model';

const stateSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  startAngle: z.number().optional(),
  mergedFrom: z.array(z.string()).optional(),
});

const transitionSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  symbols: z.array(z.string()),
  bend: z.number().optional(),
  loopAngle: z.number().optional(),
  labelSide: z.enum(['left', 'right']).optional(),
});

export const automatonSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['DFA', 'NFA']),
    alphabet: z.array(z.string()),
    states: z.array(stateSchema),
    starts: z.array(z.string()),
    accepting: z.array(z.string()),
    transitions: z.array(transitionSchema),
  })
  .superRefine((a, ctx) => {
    const ids = new Set(a.states.map((s) => s.id));
    for (const s of a.starts) {
      if (!ids.has(s)) {
        ctx.addIssue({ code: 'custom', message: `Start state ${s} is not a state` });
        return;
      }
    }
    for (const s of a.accepting) {
      if (!ids.has(s)) {
        ctx.addIssue({ code: 'custom', message: `Accepting state ${s} is not a state` });
        return;
      }
    }
    if (a.kind === 'DFA' && a.starts.length > 1) {
      ctx.addIssue({ code: 'custom', message: 'A DFA has exactly one start state' });
      return;
    }
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

export const FORMAT = 'automotion';
/** The format name from before the project was renamed AutoMotion; still read, never written. */
export const LEGACY_FORMAT = 'automaton-vis';

export const fileSchema = z.object({
  format: z.enum([FORMAT, LEGACY_FORMAT]),
  version: z.number().int(),
  automata: z.array(automatonSchema),
});
