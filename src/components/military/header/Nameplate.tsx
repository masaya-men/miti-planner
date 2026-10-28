import React from 'react';
import { MilspecDecal, MilspecRivet, MilspecBarcode } from '../MilspecDecor';
import { headerLayout, HDR_BASE_MW } from '../headerGeometry';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';
import { flapText } from './flapText';
import { onPower } from '../power/power';
import './Nameplate.css';

// 銘板 H2(見本 js:870-878)。座標は headerLayout の decor(銘板まわりの位置は MW に依らない)。
const DECOR = headerLayout(HDR_BASE_MW).decor;
const BARS = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2]; // 見本 js:876
// 銘板の窪み(見本 pockets: chamRect(362,30) を +12,+6)。はみ出した文字はここで切る(省略記号なし)
const CLIP = { left: 12, top: 6, width: 362, height: 30 };

/** 銘板。上段 = コンテンツ名(title)・下段 = プラン名(sub)。変わったときだけパタパタとめくれる(sub は 120ms 遅れ)。
 *  親は「ヘッダー区画」(position:absolute の座標系)。リベット・SN バーコードも銘板の一部としてここで出す。 */
export function Nameplate({ title, sub }: { title: string; sub: string }) {
  const { nameplate: np, rivets, barcode, sn } = DECOR;
  const reduced = useReducedMotion();
  const reducedRef = React.useRef(reduced);
  reducedRef.current = reduced;
  const ttlRef = React.useRef<HTMLSpanElement>(null);
  const subRef = React.useRef<HTMLSpanElement>(null);
  const cancelT = React.useRef<() => void>(() => {});
  const cancelS = React.useRef<() => void>(() => {});
  const mounted = React.useRef(false);

  // 初回は文字をそのまま置く(見本の setPlate も初期値ではめくらない)。以降は変わったときだけ
  React.useLayoutEffect(() => {
    const el = ttlRef.current;
    if (!el) return;
    if (!mounted.current) { el.textContent = title; return; }
    cancelT.current();
    cancelT.current = flapText(el, title, 0, reducedRef.current);
  }, [title]);
  React.useLayoutEffect(() => {
    const el = subRef.current;
    if (!el) return;
    if (!mounted.current) { el.textContent = sub; return; }
    cancelS.current();
    cancelS.current = flapText(el, sub, 120, reducedRef.current);
  }, [sub]);
  // 電源投入: 空にして 520ms 後にめくれて表示(見本 js:1171)
  const text = React.useRef({ title, sub });
  text.current = { title, sub };
  React.useEffect(() => {
    mounted.current = true;
    let t: number | undefined;
    const off = onPower((e) => {
      if (e.state !== 'on' || e.reduced) return;
      const a = ttlRef.current, b = subRef.current;
      cancelT.current(); cancelS.current();
      window.clearTimeout(t);
      if (a) a.textContent = '';
      if (b) b.textContent = '';
      t = window.setTimeout(() => {
        cancelT.current = flapText(ttlRef.current, text.current.title, 0, reducedRef.current);
        cancelS.current = flapText(subRef.current, text.current.sub, 120, reducedRef.current);
      }, 520);
    });
    return () => { mounted.current = false; off(); window.clearTimeout(t); cancelT.current(); cancelS.current(); };
  }, []);

  const inClip = (p: { x: number; y: number }) => ({ left: p.x - CLIP.left, top: p.y - CLIP.top });
  return (
    <>
      {rivets.map((r, i) => <MilspecRivet key={i} style={{ left: r.x, top: r.y }} />)}
      <div className="milspec-np" style={{ left: np.x, top: np.y, width: np.w, height: np.h }}>
        <div className="milspec-np-clip" style={{ left: CLIP.left, top: CLIP.top, width: CLIP.width, height: CLIP.height }}>
          <MilspecDecal text="TTL-01 · TARGET ENGAGEMENT" style={inClip(np.eng)} />
          <span className="milspec-np-ttl" ref={ttlRef} aria-hidden="true" style={{ ...inClip(np.ttl), maxWidth: np.sub.x - np.ttl.x - 6 }} />
          <span className="milspec-np-sub" ref={subRef} aria-hidden="true" style={inClip(np.sub)} />
        </div>
        <span className="milspec-sr">{title} {sub}</span>
      </div>
      <MilspecBarcode h={8} bars={BARS} k={0.8} style={{ left: barcode.x, top: barcode.y, fill: '#4b5157', opacity: 1 }} />
      <MilspecDecal text="SN 0418-7A" style={{ left: sn.x, top: sn.y, color: '#4b5157' }} />
    </>
  );
}
