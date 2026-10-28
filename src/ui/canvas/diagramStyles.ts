/** Stylesheet embedded in the diagram's <svg>, so an exported SVG is self-contained. */
export const diagramStyles = `
.av-diagram { background: var(--av-canvas-bg, transparent); font-family: var(--av-font, system-ui, sans-serif); user-select: none; }
.av-state-body { fill: var(--av-state-fill, #fff); stroke: var(--av-state-stroke, #333); stroke-width: 2; transition: fill 0.2s, stroke 0.2s, opacity 0.2s; }
.av-state-ring { fill: none; stroke: var(--av-state-stroke, #333); stroke-width: 2; transition: stroke 0.2s; }
.av-state-label { fill: var(--av-text, #111); font-size: 14px; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.av-state { transition: opacity 0.2s, transform 300ms ease; }
.av-diagram[data-dragging] .av-state { transition: opacity 0.2s; }
.av-state-hit { fill: transparent; stroke: none; }
.av-edge-hit { fill: none; stroke: transparent; stroke-width: 12; }
.av-rubber-band { stroke: var(--av-selected, #2563eb); stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
.av-edge-path { fill: none; stroke: var(--av-edge-stroke, #333); stroke-width: 1.5; transition: stroke 0.2s, stroke-width 0.2s; }
.av-edge-head { fill: var(--av-edge-stroke, #333); transition: fill 0.2s; }
.av-edge-label { fill: var(--av-text, #111); font-size: 13px; text-anchor: middle; dominant-baseline: central; }
.av-start-arrow .av-edge-path { stroke: var(--av-edge-stroke, #333); }
.av-start-arrow .av-edge-head { fill: var(--av-edge-stroke, #333); }

.av-state[data-tint="0"] .av-state-body { fill: var(--av-tint-0, #dbeafe); }
.av-state[data-tint="1"] .av-state-body { fill: var(--av-tint-1, #fde68a); }
.av-state[data-tint="2"] .av-state-body { fill: var(--av-tint-2, #bbf7d0); }
.av-state[data-tint="3"] .av-state-body { fill: var(--av-tint-3, #fbcfe8); }
.av-state[data-tint="4"] .av-state-body { fill: var(--av-tint-4, #ddd6fe); }
.av-state[data-tint="5"] .av-state-body { fill: var(--av-tint-5, #fed7aa); }
.av-state[data-tint="6"] .av-state-body { fill: var(--av-tint-6, #a5f3fc); }
.av-state[data-tint="7"] .av-state-body { fill: var(--av-tint-7, #e5e7eb); }

.av-state[data-faded="true"], .av-edge[data-faded="true"] { opacity: 0.3; }
.av-state[data-selected="true"] .av-state-body { stroke: var(--av-selected, #2563eb); stroke-width: 3; }
.av-state[data-selected="true"] .av-state-ring { stroke: var(--av-selected, #2563eb); }
.av-state[data-active="true"] .av-state-body { fill: var(--av-active-fill, #fef08a); stroke: var(--av-active, #ca8a04); stroke-width: 3; }
.av-state[data-error="true"] .av-state-body { stroke: var(--av-error, #dc2626); stroke-width: 3; }
.av-state[data-error="true"] .av-state-ring { stroke: var(--av-error, #dc2626); }

.av-edge[data-selected="true"] .av-edge-path { stroke: var(--av-selected, #2563eb); stroke-width: 2.5; }
.av-edge[data-selected="true"] .av-edge-head { fill: var(--av-selected, #2563eb); }
.av-edge[data-taken="true"] .av-edge-path { stroke: var(--av-active, #ca8a04); stroke-width: 3; }
.av-edge[data-taken="true"] .av-edge-head { fill: var(--av-active, #ca8a04); }
.av-edge[data-error="true"] .av-edge-path { stroke: var(--av-error, #dc2626); stroke-width: 2.5; }
.av-edge[data-error="true"] .av-edge-head { fill: var(--av-error, #dc2626); }
`;
