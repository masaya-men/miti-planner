import { useEffect, useId, useRef, useState } from 'react';
import { makeDisplacementMapDataURL } from '../../../lib/housing/displacementMap';

export interface LiquidGlassPanelProps {
  edge: number;
  radius: number;
  scale: number;
  /** Chromatic aberration is intentionally unused (Lucky Graphics flavor — no color channel split). */
  chroma?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Liquid Glass Precision Lens panel.
 * - SVG <feImage> + <feDisplacementMap> only (no color channel split, no blur).
 * - Displacement map regenerated on resize via ResizeObserver.
 * - The actual visual filter is applied via CSS custom property `--liquid-filter`
 *   on the wrapper; consuming CSS reads it as `backdrop-filter: var(--liquid-filter, none)`.
 */
export const LiquidGlassPanel: React.FC<LiquidGlassPanelProps> = ({
  edge,
  radius,
  scale,
  className = '',
  style = {},
  children,
}) => {
  const rawId = useId();
  const filterId = `liquid-${rawId.replace(/:/g, '')}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setTick] = useState(0);

  // Rebuild displacement map on resize.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const svg = svgRef.current;
    if (!wrapper || !svg) return;

    const rebuild = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 4 || h < 4) return;

      // Clear any prior <filter> and rebuild
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const ns = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(ns, 'defs');
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', filterId);
      filter.setAttribute('x', '-20%');
      filter.setAttribute('y', '-20%');
      filter.setAttribute('width', '140%');
      filter.setAttribute('height', '140%');
      filter.setAttribute('filterUnits', 'objectBoundingBox');
      filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
      filter.setAttribute('color-interpolation-filters', 'sRGB');

      const feImage = document.createElementNS(ns, 'feImage');
      feImage.setAttribute('href', makeDisplacementMapDataURL({ width: w, height: h, edge, radius }));
      feImage.setAttribute('x', '0');
      feImage.setAttribute('y', '0');
      feImage.setAttribute('width', String(w));
      feImage.setAttribute('height', String(h));
      feImage.setAttribute('result', 'dmap');
      filter.appendChild(feImage);

      const feDisp = document.createElementNS(ns, 'feDisplacementMap');
      feDisp.setAttribute('in', 'SourceGraphic');
      feDisp.setAttribute('in2', 'dmap');
      feDisp.setAttribute('scale', String(scale));
      feDisp.setAttribute('xChannelSelector', 'R');
      feDisp.setAttribute('yChannelSelector', 'G');
      filter.appendChild(feDisp);

      defs.appendChild(filter);
      svg.appendChild(defs);

      wrapper.style.setProperty('--liquid-filter', `url(#${filterId})`);
      setTick((n) => n + 1);
    };

    rebuild();
    const observer = new ResizeObserver(rebuild);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [filterId, edge, radius, scale]);

  return (
    <div
      ref={wrapperRef}
      data-liquid-filter-id={filterId}
      className={`liquid-glass-panel ${className}`}
      style={{
        ...style,
        // Read by global CSS to apply the SVG filter as a backdrop.
        // The actual backdrop-filter declaration lives in the consuming CSS.
        position: style.position ?? 'relative',
      }}
    >
      <svg ref={svgRef} width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" />
      {children}
    </div>
  );
};
