import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MilspecFxLayer } from './fx/MilspecFxLayer';
import { burst, scanBall, nudgeBall } from './fx/engine';
import { MilspecHazard, MilspecLed, MilspecStencil } from './MilspecDecor';
import { ventChannelSVG } from './armor/pcb';
import { CARRIAGE_W, mwFor, ventCarriageX, ventLayout, ventRailRange } from './headerGeometry';
import { useMilspecHeaderScale } from './headerScaleContext';
import './header/milspecVent.css';
import './MilspecVent.css';

export interface MilspecVentProps {
  isHeaderCollapsed: boolean;
  /** 取っ手を引いたとき(260ms 後)に呼ぶ。MilspecLayout の動き付き開閉に繋ぐ */
  onToggleHeader: () => void;
}

/** 通気口: パンチング板・溝の基板 2 本・光の玉・取っ手(見本 js:930-940, 1091-1093, 1139)。
 *  区画の実幅 MW は mwFor(実幅 ÷ 縮小率、1189 未満にしない)で求める。 */
export function MilspecVent({ isHeaderCollapsed, onToggleHeader }: MilspecVentProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLButtonElement>(null);
  const { scale, sidebarOpen } = useMilspecHeaderScale();
  const [zw, setZw] = useState(0);
  const mw = useMemo(() => mwFor(zw, scale), [zw, scale]);
  const onToggleRef = useRef(onToggleHeader);
  useLayoutEffect(() => { onToggleRef.current = onToggleHeader; });

  // 区画(内箱の親)の実幅を測る
  useLayoutEffect(() => {
    const zone = rootRef.current?.closest('[data-ms-zone="vent"]') as HTMLElement | null;
    if (!zone || typeof ResizeObserver === 'undefined') return;
    const apply = (w: number) => { if (w > 0) setZw(Math.round(w)); };
    apply(zone.getBoundingClientRect().width);
    const ro = new ResizeObserver((es) => { const w = es[es.length - 1]?.contentRect.width; if (typeof w === 'number') apply(w); });
    ro.observe(zone);
    return () => ro.disconnect();
  }, []);

  // 7 秒ごとに光の玉(見本 js:1139)。タブ非表示・動きを減らす・電源 off は scanBall 側で止まる。アンマウントで止める
  useEffect(() => {
    const id = setInterval(() => { if (rowRef.current) scanBall(rowRef.current); }, 7000);
    return () => clearInterval(id);
  }, []);

  // 取っ手の押下タイマー(アンマウントで破棄)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const tug = () => {
    const b = pullRef.current;
    if (b) { b.classList.remove('tug'); void b.offsetWidth; b.classList.add('tug'); }
    timers.current.push(setTimeout(() => {
      onToggleRef.current();
      timers.current.push(setTimeout(() => { burst('ventL:', { stagger: 25 }); burst('ventR:', { stagger: 25 }); }, 200));
    }, 260));
  };

  const v = ventLayout(mw);
  // 台車(列+取っ手+PULL 文字)はレール上。内部の部品は台車の左端基準の相対位置で置く
  // (中身の相対位置は開いた状態の台車 MW/2-192 を基準に決める。狭い画面では閉じた台車の位置が走行量の上限で変わるため)
  const carX = ventCarriageX(mw, sidebarOpen, scale);
  const carX0 = ventCarriageX(mw);
  const rail = ventRailRange(mw, sidebarOpen, scale);
  // 溝はレールの両端で終わる
  const chanL = { x: v.chanL.x, w: rail.x - 8 - v.chanL.x };
  const chanR = { x: rail.x + rail.w + 8, w: mw - 164 - (rail.x + rail.w + 8) };
  const label = t(isHeaderCollapsed ? 'sidebar.expand_header' : 'sidebar.collapse_header');
  const chan = (side: 'L' | 'R', c: { x: number; w: number }) => c.w < 30 ? null : (
    <div key={side} data-vent-chan={side} style={{ left: c.x, top: 5.5, width: c.w, height: 8 }}>
      <div className="milspec-vent-chan" style={{ inset: 0 }} />
      <svg className="milspec-pcb" width={c.w} height={8} viewBox={`0 0 ${c.w} 8`} aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0 }}
        dangerouslySetInnerHTML={{ __html: ventChannelSVG({ w: c.w, side, id: `mv${side}` }) }} />
    </div>
  );

  return (
    <div ref={rootRef} className="milspec-vent" data-milspec-vent>
      <div className="milspec-vent-perf" style={{ left: 0, top: 0, width: mw, height: 19, borderRadius: 2, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.5), 0 2px 3px rgba(0,0,0,0.5)' }} />
      <MilspecHazard w={46} h={7} style={{ left: 16, top: 6 }} />
      <MilspecFxLayer traces={[{ name: 'lk:hdr', d: v.leak, pc: 'leak' }]} />
      <MilspecStencil en="HDR PNL 1A · DO NOT STEP" hi style={{ left: 70, top: 7 }} />
      {chan('L', chanL)}
      {chan('R', chanR)}
      <div className="milspec-vent-rail" data-vent-rail style={{ left: rail.x, top: 7, width: rail.w, height: 5 }}>
        <MilspecHazard w={4} h={9} style={{ left: 0, top: -2 }} />
        <MilspecHazard w={4} h={9} style={{ right: 0, top: -2 }} />
      </div>
      <div className="milspec-carriage" data-vent-carriage style={{ left: carX, top: 0, width: CARRIAGE_W, height: 19 }}>
        <div ref={rowRef} className="milspec-lb-row" data-scan style={{ left: v.xb0 - carX0, top: 5.5 }}
          onClick={() => rowRef.current && scanBall(rowRef.current)}
          onPointerEnter={() => rowRef.current && nudgeBall(rowRef.current)}>
          {Array.from({ length: 11 }, (_, i) => <MilspecLed key={i} size={8} />)}
        </div>
        <button ref={pullRef} type="button" className="milspec-pull" data-vent-pull
          style={{ left: v.pull.x - carX0, top: 2, width: v.pull.w, height: 15 }}
          aria-label={label} title={label} aria-expanded={!isHeaderCollapsed} onClick={tug} />
        <MilspecStencil en="PULL" style={{ left: v.pullLabelX - carX0, top: 6, padding: '1px 3px', background: 'var(--ma-frame)', borderRadius: 1 }} />
        <i className="milspec-carriage-wheel" style={{ left: 12 }} />
        <i className="milspec-carriage-wheel" style={{ left: 120 }} />
        <i className="milspec-carriage-wheel" style={{ left: 232 }} />
        <i className="milspec-carriage-led" />
      </div>
      <MilspecStencil en="P/N 7A-2213-0418" hi style={{ left: v.pnX, top: 7 }} />
      <MilspecHazard w={46} h={7} style={{ left: v.hazR, top: 6 }} />
      <div data-progress-drawer-anchor className="milspec-vent-anchor" />
    </div>
  );
}
