/**
 * 光の道 — フェーズを開始時間に比例配置した発光ライン。
 * ライン上のどこをクリックしてもその比例時間へ大タイムラインがジャンプ（progress:jump-to-time）。
 * フェーズが無ければ非表示。旧 PhaseJumpButtons の置換。
 */
import { useRef } from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { getPhaseName } from '../../types';
import { phaseRoadPositions, roadTimeFromClick } from '../../lib/progressLogic';

export function PhaseRoad() {
  const { contentLanguage } = useThemeStore();
  const phases = useMitigationStore((s) => s.phases);
  const timelineEvents = useMitigationStore((s) => s.timelineEvents);
  const lineRef = useRef<HTMLDivElement>(null);

  const total = timelineEvents.length ? Math.max(...timelineEvents.map((e) => e.time)) : 0;
  const nodes = phaseRoadPositions(
    phases.map((p) => ({ id: p.id, name: p.name, startTime: p.startTime })),
    total
  );
  if (nodes.length === 0) return null;

  const jump = (time: number) => {
    window.dispatchEvent(new CustomEvent('progress:jump-to-time', { detail: { time } }));
  };
  const onLineClick = (e: React.MouseEvent) => {
    const el = lineRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    jump(roadTimeFromClick(frac, total));
  };

  return (
    <div className="relative h-12 select-none" aria-label="phase road">
      {/* 発光ライン（クリックで比例時間ジャンプ）。
          フェーズ名を上下交互に書くため、線は中央(y=24px)まで下げる。
          上ラベルは線の上の空間、下ラベルは線の下の空間に置く（ドロワー高さは不変）。 */}
      <div
        ref={lineRef}
        onClick={onLineClick}
        className="absolute left-0 right-0 cursor-pointer"
        style={{ top: '17px', height: '14px' }}
      >
        <div className="absolute left-0 right-0" style={{
          top: '7px', height: '1px',
          background: 'linear-gradient(90deg, rgba(120,200,255,0) 0%, rgba(120,200,255,.55) 8%, rgba(120,200,255,.55) 92%, rgba(120,200,255,0) 100%)',
          boxShadow: '0 0 6px rgba(120,200,255,.4)',
        }} />
      </div>
      {/* ノード + フェーズ名（index 偶数=線の上 / 奇数=線の下 で交互） */}
      {nodes.map((nd, i) => {
        const above = i % 2 === 0; // Phase1(index0)=上、次=下…
        return (
          <div key={nd.id}>
            <span
              onClick={(e) => { e.stopPropagation(); jump(nd.time); }}
              className="absolute cursor-pointer"
              style={{
                left: `${nd.leftPct}%`, top: '24px', transform: 'translate(-50%,-50%)',
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#cfeaff', boxShadow: '0 0 8px rgba(150,220,255,.9)',
              }}
            />
            <span
              onClick={(e) => { e.stopPropagation(); jump(nd.time); }}
              className="absolute text-app-2xs font-bold text-app-blue hover:text-app-text whitespace-nowrap cursor-pointer"
              style={{ left: `${nd.leftPct}%`, top: above ? '2px' : '34px', transform: 'translateX(-50%)' }}
            >
              {getPhaseName(nd.name, contentLanguage)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
