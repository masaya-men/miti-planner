import React from 'react';
import type { PartyMember } from '../../../types';
import { BACKPLANE_H, backplaneSVG } from './backplane';
import { lightPartyGap } from './milspecJackBoardModel';
import './MilspecJackBoard.css';

// ジョブの差込口の土台の基板(見本 v11 js:431-466)。controlBar の内側(#timeline-controls-inner)に敷くので、
// 表と一緒に横スクロールする。列の中心は Timeline が実測した memberLayout(left + width / 2)。

export interface MilspecJackBoardProps {
  /** 表の列の並び順(表示メンバーのみ) */
  members: PartyMember[];
  partySortOrder: 'role' | 'light_party';
  /** 列の実測(controlBar の内側の座標。left は padding 込みの内側の左端) */
  memberLayout: Map<string, { left: number; width: number }>;
}

function MilspecJackBoardImpl({ members, partySortOrder, memberLayout }: MilspecJackBoardProps) {
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
  }, []);

  const lpGap = lightPartyGap(members, partySortOrder);
  const centers: number[] = [];
  members.forEach((m) => {
    const l = memberLayout.get(m.id);
    if (l) centers.push(l.left + l.width / 2 - box.x);
  });
  const full = centers.length === members.length;
  // SVG 文字列は入力(列中心・幅・境目)が同じなら作り直さない
  const key = `${box.w}|${lpGap}|${centers.map((c) => c.toFixed(2)).join(',')}`;
  const html = React.useMemo(
    () => (box.w > 0 && full ? backplaneSVG({ centers, pw: box.w, lpGap }) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, full],
  );
  const inner = React.useMemo(() => ({ __html: html }), [html]);
  return (
    <div className="milspec-jackboard" ref={ref} aria-hidden="true">
      <svg className="milspec-pcb" width={box.w} height={BACKPLANE_H} viewBox={`0 0 ${box.w} ${BACKPLANE_H}`}
        dangerouslySetInnerHTML={inner} />
    </div>
  );
}

export const MilspecJackBoard = React.memo(MilspecJackBoardImpl);
