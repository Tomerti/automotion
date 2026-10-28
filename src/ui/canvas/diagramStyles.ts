/**
 * Stylesheet embedded in the diagram's <svg>, so an exported SVG is self-contained.
 * Colours come from the theme tokens in src/ui/theme.css; fallbacks are the light theme's
 * values and must stay plain (no parentheses) so the exporter can resolve them.
 */
export const diagramStyles = `
.av-diagram { background: var(--av-canvas-bg, transparent); font-family: var(--av-font, Geist, system-ui, sans-serif); user-select: none; }
.av-state-body { fill: var(--av-state-fill, #ffffff); stroke: var(--av-state-stroke, #1c2333); stroke-width: 1.75; transition: fill 0.2s, stroke 0.2s, opacity 0.2s; }
.av-state-ring { fill: none; stroke: var(--av-state-stroke, #1c2333); stroke-width: 1.5; transition: stroke 0.2s; }
.av-state-label { fill: var(--av-text, #1c2333); font-size: 15px; font-weight: 500; text-anchor: middle; dominant-baseline: central; pointer-events: none; transition: fill 0.2s; }
.av-state { transition: opacity 0.2s, transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.av-diagram[data-dragging] .av-state { transition: opacity 0.2s; }
.av-state-hit { fill: transparent; stroke: none; }
.av-edge-hit { fill: none; stroke: transparent; stroke-width: 12; stroke-linecap: round; transition: stroke 0.2s; }
.av-snap-guide { stroke: var(--av-guide, #2d4fd0); stroke-width: 1; stroke-dasharray: 4 4; vector-effect: non-scaling-stroke; pointer-events: none; }
.av-state[data-editing="true"] .av-state-label, .av-edge[data-editing="true"] .av-edge-label { visibility: hidden; }
.av-edge-path { fill: none; stroke: var(--av-edge-stroke, #3a4356); stroke-width: 1.4; stroke-linecap: round; transition: stroke 0.2s, stroke-width 0.2s; }
.av-edge-head { fill: var(--av-edge-stroke, #3a4356); transition: fill 0.2s; }
.av-edge-label { fill: var(--av-text, #1c2333); font-size: 15px; font-weight: 500; text-anchor: middle; dominant-baseline: central; paint-order: stroke; stroke: var(--av-label-halo, #f3f5f0); stroke-width: 4px; stroke-linejoin: round; }
.av-rubber-band { pointer-events: none; }
.av-rubber-band .av-edge-path { stroke: var(--av-selected, #2563eb); stroke-width: 2; }
.av-rubber-band .av-edge-head { fill: var(--av-selected, #2563eb); }
.av-start-arrow .av-edge-path { stroke: var(--av-state-stroke, #1c2333); stroke-width: 1.75; }
.av-start-arrow .av-edge-head { fill: var(--av-state-stroke, #1c2333); }

.av-state[data-tint="0"] .av-state-body { fill: var(--av-tint-0, #c9dbff); }
.av-state[data-tint="1"] .av-state-body { fill: var(--av-tint-1, #ffcfc0); }
.av-state[data-tint="2"] .av-state-body { fill: var(--av-tint-2, #c3e9c7); }
.av-state[data-tint="3"] .av-state-body { fill: var(--av-tint-3, #e4cdf5); }
.av-state[data-tint="4"] .av-state-body { fill: var(--av-tint-4, #ffdfa6); }
.av-state[data-tint="5"] .av-state-body { fill: var(--av-tint-5, #bfe7e6); }
.av-state[data-tint="6"] .av-state-body { fill: var(--av-tint-6, #f8c8dc); }
.av-state[data-tint="7"] .av-state-body { fill: var(--av-tint-7, #dadfe6); }

.av-state[data-faded="true"], .av-edge[data-faded="true"] { opacity: 0.25; }
.av-state[data-selected="true"] .av-state-body { stroke: var(--av-selected, #2563eb); stroke-width: 3; }
.av-state[data-selected="true"] .av-state-ring { stroke: var(--av-selected, #2563eb); }
.av-state[data-active="true"] .av-state-body { fill: var(--av-active-fill, #fff0e1); stroke: var(--av-active-stroke, #d9480f); stroke-width: 2.25; }
.av-state[data-active="true"] .av-state-ring { stroke: var(--av-active-stroke, #d9480f); }
.av-state[data-active="true"] .av-state-label { fill: var(--av-active-text, #1c2333); }
.av-state[data-error="true"] .av-state-body { stroke: var(--av-error, #c42f36); stroke-width: 3; }
.av-state[data-error="true"] .av-state-ring { stroke: var(--av-error, #c42f36); }

.av-edge[data-selected="true"] .av-edge-path { stroke: var(--av-selected, #2563eb); stroke-width: 2.5; }
.av-edge[data-selected="true"] .av-edge-head { fill: var(--av-selected, #2563eb); }
.av-edge[data-taken="true"] .av-edge-hit { stroke: var(--av-taken-band, #f7670726); stroke-width: 7; }
.av-edge[data-taken="true"] .av-edge-path { stroke: var(--av-active, #d9480f); stroke-width: 2.25; }
.av-edge[data-taken="true"] .av-edge-head { fill: var(--av-active, #d9480f); }
.av-edge[data-error="true"] .av-edge-path { stroke: var(--av-error, #c42f36); stroke-width: 2.5; }
.av-edge[data-error="true"] .av-edge-head { fill: var(--av-error, #c42f36); }

@media (prefers-reduced-motion: reduce) {
  .av-state, .av-state-body, .av-state-ring, .av-state-label, .av-edge-hit, .av-edge-path, .av-edge-head { transition: none; }
}
`;
