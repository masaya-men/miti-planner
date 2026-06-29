// ④-b-2: 他者カーソルをタイムライン上に描く。位置は rAF lerp で transform 直書き(高頻度 setState 禁止)。
// 【perf 重要】このコンポーネントは roster(参加者の出入り=低頻度)だけを購読する。受信座標(byClient=高頻度)は
//   購読せず rAF ループ内で getState() で読む。これにより「カーソル1パケットごとに親 Timeline 全体が再描画」
//   を断ち切る(描く peer 集合が増減したときだけ React 再レンダー)。
// 座標変換に要る map/width は「参照箱(ref)」で受ける → 親が再描画しなくても rAF が常に最新を読める。
import React, { useEffect, useMemo, useRef } from 'react';
import { timeSecToY, xRatioToPx } from '../Memo/coords';
import { lerp } from '../../lib/collab/cursorInterp';
import { useJobs } from '../../hooks/useSkillsData';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { useRemoteCursorsStore } from '../../store/useRemoteCursorsStore';
import './cursor.css';

// roster から描く相手(自分以外 & cursorEnabled)だけを取り出した最小情報。位置は持たない(rAF が store から読む)。
export interface RemoteCursorPeer {
  clientId: number;
  color: string;
  jobId: string | null;
}

interface CursorOverlayProps {
  // 親(Timeline)が高頻度に再描画しなくても最新の座標材料を読めるよう「参照箱」で受ける。
  // timeToYMapRef.current は Timeline の render 中に作り直される(Timeline.tsx の timeToYMapRef)ため、
  //   値ではなく ref を渡して rAF で .current を読む。
  timeToYMapRef: React.RefObject<Map<number, number>>;
  sheetWidthRef: React.RefObject<number>;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ timeToYMapRef, sheetWidthRef }) => {
  // 描く相手の集合(色/ジョブ)。roster は低頻度更新 → この購読由来の再描画も低頻度。
  const roster = useCollabPresenceStore(s => s.roster);
  const peers = useMemo<RemoteCursorPeer[]>(
    () => roster
      .filter(r => !r.isLocal && r.cursorEnabled)
      .map(r => ({ clientId: r.clientId, color: r.color, jobId: r.jobId })),
    [roster],
  );

  // jobId → アイコン URL(本人選択ジョブ。未選択は表示なし)。
  const jobs = useJobs();
  const jobIconById = useMemo(() => {
    const m = new Map<string, string>();
    for (const j of jobs) m.set(j.id, j.icon);
    return m;
  }, [jobs]);

  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const positions = useRef<Map<number, { x: number; y: number }>>(new Map());
  // rAF ループが参照する「描く相手の clientId」。再描画なしで最新化するため毎 render で ref に同期。
  const peerIdsRef = useRef<number[]>([]);
  peerIdsRef.current = peers.map(p => p.clientId);

  const hasPeers = peers.length > 0;
  useEffect(() => {
    if (!hasPeers) return; // 描く相手がいなければ rAF を回さない(空回し防止・元の挙動を踏襲)。
    let raf = 0;
    const tick = () => {
      const byClient = useRemoteCursorsStore.getState().byClient; // 高頻度 store は購読せず毎フレーム読む。
      const tMap = timeToYMapRef.current;
      const width = sheetWidthRef.current ?? 0;
      for (const id of peerIdsRef.current) {
        const el = elRefs.current.get(id);
        if (!el) continue;
        const pos = byClient[id]?.pos ?? null;
        if (!pos || !tMap) { el.style.opacity = '0'; continue; } // 未受信/タイムライン外は非表示。
        const tx = xRatioToPx(pos.xRatio, width);
        const ty = timeSecToY(pos.timeSec, tMap);
        const cur = positions.current.get(id) ?? { x: tx, y: ty };
        // 補間係数を下げるほど滑らか(遅延は微増・送信量は不変=コスト不変)。
        // 15Hz(≒66ms/4フレーム)で速く到達しすぎて減速→カクつくのを防ぐため 0.25→0.15。
        const next = { x: lerp(cur.x, tx, 0.15), y: lerp(cur.y, ty, 0.15) };
        positions.current.set(id, next);
        el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
        el.style.opacity = '1';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasPeers, timeToYMapRef, sheetWidthRef]);

  if (!hasPeers) return null;
  return (
    <>
      {peers.map((c) => (
        <div
          key={c.clientId}
          data-cursor-id={c.clientId}
          ref={(el) => {
            if (el) elRefs.current.set(c.clientId, el);
            else { elRefs.current.delete(c.clientId); positions.current.delete(c.clientId); }
          }}
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
