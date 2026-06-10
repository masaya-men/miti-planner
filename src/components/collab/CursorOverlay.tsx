// ④-b-2: 他者カーソルをタイムライン上に描く。位置は rAF lerp で transform 直書き(高頻度 setState 禁止)。
// React 再レンダーは「描く peer 集合の増減」時のみ。色/ジョブは roster 由来(props)。
// jobId → アイコン URL は useJobs() で解決(本人が選んだ自己表現ジョブ・実名なし)。
import React, { useEffect, useMemo, useRef } from 'react';
import { timeSecToY, xRatioToPx } from '../Memo/coords';
import { lerp } from '../../lib/collab/cursorInterp';
import { useJobs } from '../../hooks/useSkillsData';
import './cursor.css';

export interface RemoteCursor {
  clientId: number;
  color: string;
  jobId: string | null;
  pos: { timeSec: number; xRatio: number } | null;
}

interface CursorOverlayProps {
  cursors: RemoteCursor[];
  timeToYMap: Map<number, number>;
  sheetWidth: number;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors, timeToYMap, sheetWidth }) => {
  // jobId → アイコン URL(本人選択ジョブ。未選択は表示なし)。
  const jobs = useJobs();
  const jobIconById = useMemo(() => {
    const m = new Map<string, string>();
    for (const j of jobs) m.set(j.id, j.icon);
    return m;
  }, [jobs]);

  // 目標座標を ref で保持(描画ループが毎フレーム読む。setState しない)。
  const targets = useRef<Map<number, { timeSec: number; xRatio: number }>>(new Map());
  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const positions = useRef<Map<number, { x: number; y: number }>>(new Map());

  // 最新の目標 + 変換材料を ref に同期(props 変化のたび)。
  targets.current = new Map(
    cursors.filter((c) => c.pos).map((c) => [c.clientId, c.pos!]),
  );
  const mapRef = useRef(timeToYMap); mapRef.current = timeToYMap;
  const widthRef = useRef(sheetWidth); widthRef.current = sheetWidth;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const [id, target] of targets.current) {
        const el = elRefs.current.get(id);
        if (!el) continue;
        const tx = xRatioToPx(target.xRatio, widthRef.current);
        const ty = timeSecToY(target.timeSec, mapRef.current);
        const cur = positions.current.get(id) ?? { x: tx, y: ty };
        // 補間係数を下げるほど滑らか(遅延は微増・送信量は不変=コスト不変)。
        // 15Hz(≒66ms/4フレーム)で速く到達しすぎて減速→カクつくのを防ぐため 0.25→0.15。
        const next = { x: lerp(cur.x, tx, 0.15), y: lerp(cur.y, ty, 0.15) };
        positions.current.set(id, next);
        el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const visible = cursors.filter((c) => c.pos);
  return (
    <>
      {visible.map((c) => (
        <div
          key={c.clientId}
          data-cursor-id={c.clientId}
          ref={(el) => { if (el) elRefs.current.set(c.clientId, el); else elRefs.current.delete(c.clientId); }}
          className="collab-cursor"
          style={{ color: c.color }}
        >
          <svg className="collab-cursor__arrow" width="14" height="20" viewBox="0 0 14 20" aria-hidden>
            <path d="M1 1 L1 16 L5 12 L8 18 L10 17 L7 11 L13 11 Z" fill="currentColor" stroke="#000" strokeWidth="1" />
          </svg>
          {c.jobId && jobIconById.has(c.jobId) && (
            <img className="collab-cursor__job" src={jobIconById.get(c.jobId)} alt="" />
          )}
        </div>
      ))}
    </>
  );
};
