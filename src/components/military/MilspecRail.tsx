import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { burst } from './fx/engine';
import { MilspecRivet } from './MilspecDecor';
import { railLayout } from './rail/railGeometry';
import { railSVG } from './rail/railSvg';
import './MilspecRail.css';

export interface MilspecRailProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/** サイドバーと本体の間の細い縦の列(レール。見本 buildRail js:397-415 + 取っ手 js:861)。
 *  パンチング板・溝・基板(光の経路 rail:a / rail:b)・縦の取っ手。取っ手を引く(260ms 後)とサイドバーが開閉し、
 *  200ms 後にレールを光が走る(js:1092)。サイドバーを畳んでもこの列は残るので、必ず開き直せる。 */
export function MilspecRail({ isSidebarOpen, onToggleSidebar }: MilspecRailProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLButtonElement>(null);
  const [H, setH] = useState(679);
  const onToggleRef = useRef(onToggleSidebar);
  useLayoutEffect(() => { onToggleRef.current = onToggleSidebar; });

  // 区画の実高 H を測る(見本は 679 固定。縦に伸びたぶんはバス B の下端とリベットの数に反映)
  useLayoutEffect(() => {
    const zone = rootRef.current?.closest('[data-ms-zone="rail"]') as HTMLElement | null;
    if (!zone || typeof ResizeObserver === 'undefined') return;
    const apply = (h: number) => { if (h > 0) setH((p) => { const n = Math.round(h); return n === p ? p : n; }); };
    apply(zone.getBoundingClientRect().height);
    const ro = new ResizeObserver((es) => { const h = es[es.length - 1]?.contentRect.height; if (typeof h === 'number') apply(h); });
    ro.observe(zone);
    return () => ro.disconnect();
  }, []);

  // 取っ手の押下タイマー(アンマウントで破棄)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const tug = () => {
    const b = pullRef.current;
    if (b) { b.classList.remove('tug'); void b.offsetWidth; b.classList.add('tug'); }
    timers.current.push(setTimeout(() => {
      onToggleRef.current();
      timers.current.push(setTimeout(() => { burst('rail:a', { rev: true, stagger: 20 }); burst('rail:b', { stagger: 20, chain: false }); }, 200));
    }, 260));
  };

  const r = railLayout(H);
  const label = t(isSidebarOpen ? 'sidebar.close_menu' : 'sidebar.open_menu');
  return (
    <div ref={rootRef} className="milspec-rail">
      <div className="milspec-rail-perf" style={{ left: 0, top: 0, width: 22, height: H }} />
      <div className="milspec-vent-chan" style={{ left: 4, top: 6, width: 14, height: r.L }} />
      <svg className="milspec-pcb" width={14} height={r.L} viewBox={`0 0 14 ${r.L}`} aria-hidden="true"
        style={{ position: 'absolute', left: 4, top: 6 }}
        dangerouslySetInnerHTML={{ __html: railSVG(H) }} />
      {r.rivets.map(([x, y], i) => <MilspecRivet key={i} style={{ left: x, top: y }} />)}
      {/* aria-label は今の文言キー。milspec-rail-handle は検査スクリプトが探す旧クラス名 */}
      <button ref={pullRef} type="button" className="milspec-pull is-v milspec-rail-handle"
        style={{ left: r.pull.x, top: r.pull.y, width: r.pull.w, height: r.pull.h }}
        title={label} aria-label={label} aria-expanded={isSidebarOpen} onClick={tug} />
    </div>
  );
}
