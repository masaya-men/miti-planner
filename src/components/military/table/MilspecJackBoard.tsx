import React from 'react';
import type { PartyMember } from '../../../types';
import { LIGHT_PARTY_MEMBER_IDS } from '../../../constants/party';
import { BACKPLANE_H, backplaneSVG } from './backplane';
import './milspecJack.css';

// ジョブの差込口の土台の基板(見本 v11 js:431-466)。controlBar の内側(#timeline-controls-inner)に敷くので、
// 表と一緒に横スクロールする。列の中心は Timeline が実測した memberLayout(left + width / 2)。

export interface MilspecJackBoardProps {
  /** 表の列の並び順(表示メンバーのみ) */
  members: PartyMember[];
  partySortOrder: 'role' | 'light_party';
  /** 列の実測(controlBar の内側の座標。left は padding 込みの内側の左端) */
  memberLayout: Map<string, { left: number; width: number }>;
}

/** ライトパーティ順のとき、LP1 の最後の列の番号(その右が境目)。LP1 と LP2 が両方いなければ null */
export function lightPartyGap(members: PartyMember[], partySortOrder: 'role' | 'light_party'): number | null {
  if (partySortOrder !== 'light_party') return null;
  const lp1 = new Set<string>(LIGHT_PARTY_MEMBER_IDS.slice(0, 4));
  const first2 = members.findIndex((m) => !lp1.has(m.id));
  return first2 > 0 ? first2 - 1 : null;
}

export function MilspecJackBoard({ members, partySortOrder, memberLayout }: MilspecJackBoardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ x: 0, w: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setBox((p) => (p.x === el.offsetLeft && p.w === el.clientWidth ? p : { x: el.offsetLeft, w: el.clientWidth }));
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  });

  const centers: number[] = [];
  members.forEach((m) => {
    const l = memberLayout.get(m.id);
    if (l) centers.push(l.left + l.width / 2 - box.x);
  });
  const html = box.w > 0 && centers.length === members.length
    ? backplaneSVG({ centers, pw: box.w, lpGap: lightPartyGap(members, partySortOrder) })
    : '';
  return (
    <div className="milspec-jackboard" ref={ref} aria-hidden="true">
      <svg className="milspec-pcb" width={box.w} height={BACKPLANE_H} viewBox={`0 0 ${box.w} ${BACKPLANE_H}`}
        dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
