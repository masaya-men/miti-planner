import { useEffect, useId, useRef, useState } from 'react';
import { makeDisplacementMapDataURL } from '../../../lib/housing/displacementMap';

export interface LiquidGlassPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Rim thickness (px) where refraction lives. */
  edge: number;
  /** Corner radius (px) — matches CSS border-radius. */
  radius: number;
  /** feDisplacementMap scale (px of max bend). */
  scale: number;
  /** Chromatic aberration is intentionally unused (no color channel split). */
  chroma?: number;
  /** Set false to skip the decorative chrome (corners + top sheen). */
  chrome?: boolean;
  children?: React.ReactNode;
}

/**
 * Liquid Glass panel — wraps content in a `.housing-panel.is-liquid` shell
 * with a per-panel SVG `<feDisplacementMap>` refraction filter and the
 * mockup chrome (gradient ring border + horizontal sheen + 4 corner
 * highlights + top sheen line — all defined in `housing.css`).
 *
 * Displacement map is regenerated on resize via ResizeObserver.
 * Pure-displacement filter (no color split, no blur) — the
 * "Lucky Graphics Precision Lens" flavor.
 */
export const LiquidGlassPanel: React.FC<LiquidGlassPanelProps> = ({
  edge,
  radius,
  scale,
  chrome = true,
  chroma: _chroma,
  className = '',
  style = {},
  children,
  ...rest
}) => {
  const rawId = useId();
  const filterId = `liquid-${rawId.replace(/:/g, '')}`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const svg = svgRef.current;
    if (!wrapper || !svg) return;

    const rebuild = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 4 || h < 4) return;

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
      className={`housing-panel is-liquid liquid-glass-panel ${className}`}
      style={style}
      {...rest}
    >
      <svg ref={svgRef} width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" />
      {chrome && (
        <>
          <span className="housing-panel-corner tl" aria-hidden="true" />
          <span className="housing-panel-corner tr" aria-hidden="true" />
          <span className="housing-panel-corner bl" aria-hidden="true" />
          <span className="housing-panel-corner br" aria-hidden="true" />
          <span className="housing-panel-sheen" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
};
