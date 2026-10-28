import type { Automaton } from '../../core/model';
import { STATE_RADIUS } from './geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PADDING = 32;
const LOOP_ALLOWANCE = 28; // room for self-loops and edge labels around a state

/** Elements that exist only for pointer interaction. */
const INTERACTION_ONLY = '[data-testid="rubber-band"], .av-state-hit, .av-edge-hit';

function resolveCustomProperties(css: string): string {
  const root = getComputedStyle(document.documentElement);
  return css.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
    (_m, name: string, fb?: string) => {
      const value = root.getPropertyValue(name).trim();
      return value !== '' ? value : (fb ?? '').trim();
    },
  );
}

/** Standalone SVG text of the diagram: fitted viewBox, resolved colours, no interaction chrome. */
export function diagramToSvgString(svg: SVGSVGElement, automaton: Automaton): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;

  const reach = STATE_RADIUS + LOOP_ALLOWANCE + PADDING;
  const xs = automaton.states.map((s) => s.x);
  const ys = automaton.states.map((s) => s.y);
  const minX = xs.length > 0 ? Math.min(...xs) - reach : 0;
  const minY = ys.length > 0 ? Math.min(...ys) - reach : 0;
  const width = xs.length > 0 ? Math.max(...xs) + reach - minX : 2 * reach;
  const height = ys.length > 0 ? Math.max(...ys) + reach - minY : 2 * reach;

  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  clone.querySelector(':scope > g')?.setAttribute('transform', 'translate(0 0) scale(1)');
  clone.querySelectorAll(INTERACTION_ONLY).forEach((el) => el.remove());
  clone.querySelectorAll('[data-selected="true"]').forEach((el) => {
    el.setAttribute('data-selected', 'false');
  });
  clone.querySelectorAll('style').forEach((style) => {
    style.textContent = resolveCustomProperties(style.textContent ?? '');
  });

  return new XMLSerializer().serializeToString(clone);
}

/** Rasterise standalone SVG text to a PNG (white background). */
export function svgToPng(svgText: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const box = /viewBox="[^"]*? [^"]*? ([\d.]+) ([\d.]+)"/.exec(svgText);
    const w = Math.ceil(Number(box?.[1] ?? 0) * scale);
    const h = Math.ceil(Number(box?.[2] ?? 0) * scale);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas is not available'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not create the PNG'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Could not render the diagram'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  });
}

function currentSvg(): SVGSVGElement | null {
  return document.querySelector<SVGSVGElement>('[data-testid="canvas"] svg[data-testid="diagram"]');
}

/** Export the editable canvas's diagram; null when there is none. */
export function exportableSvg(automaton: Automaton): string | null {
  const svg = currentSvg();
  return svg ? diagramToSvgString(svg, automaton) : null;
}
