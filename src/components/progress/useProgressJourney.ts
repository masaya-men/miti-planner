/**
 * 攻略の軌跡の「値」だけを返すフック。
 * 標準テーマの ProgressTrackingHUD と MIL-SPEC のブラウン管(MilspecCrt)が同じ値を使うために、
 * ProgressTrackingHUD.tsx にあった計算(points / pct / cleared / 活動日数・時間・クリック)をそのまま移した。
 */
import { useMemo } from 'react';
import { useMitigationStore } from '../../store/useMitigationStore';
import { computeProgressPercent } from '../../lib/progressLogic';
import { useProgressRecording } from './useProgressRecording';

export interface ProgressJourney {
  /** 打点ゼロ かつ 未クリア(誘導文言を出す状態) */
  empty: boolean;
  /** 各打点の到達点を % (0〜100) に正規化した配列(並び順=記録順。標準の JourneyStrip が使う) */
  percents: number[];
  /** 軌跡の座標。x = 記録順の位置(0〜100・1点なら 100)、y = 到達点(0〜100) */
  points: { x: number; y: number }[];
  /** 進捗 %(最高 reachedPos ÷ 全長)。empty のとき null */
  pct: number | null;
  cleared: boolean;
  /** 活動日数・時間のどちらかが入力されているか(標準は入力した人だけ表示) */
  hasActivity: boolean;
  activeDays: number;
  activeHours: number;
  /** 記録パネルを開く(開いている時は開き直さない) */
  openPanel: () => void;
}

export function useProgressJourney(): ProgressJourney {
  const progress = useMitigationStore((s) => s.progress);
  const timelineEvents = useMitigationStore((s) => s.timelineEvents);

  // タイムライン全長(秒)= timelineEvents の最大 time。参照を安定化して下流の再起動を防ぐ
  const total = useMemo(
    () => (timelineEvents.length ? Math.max(...timelineEvents.map((e) => e.time)) : 0),
    [timelineEvents],
  );

  // 旧形式データが万一すり抜けても落ちないよう ?? [] で防御
  const percents = useMemo(
    () => (progress.points ?? []).map((p) =>
      total > 0 ? Math.max(0, Math.min(100, (p.reachedPos / total) * 100)) : 0),
    [progress.points, total],
  );

  const points = useMemo(
    () => percents.map((y, i) => ({ x: percents.length > 1 ? (i / (percents.length - 1)) * 100 : 100, y })),
    [percents],
  );

  const pct = useMemo(() => computeProgressPercent(progress, total), [progress, total]);
  const empty = percents.length === 0 && !progress.cleared;

  return {
    empty,
    percents,
    points,
    pct: empty ? null : pct,
    cleared: progress.cleared,
    hasActivity: progress.activeDays != null || progress.activeHours != null,
    activeDays: progress.activeDays ?? 0,
    activeHours: progress.activeHours ?? 0,
    openPanel: () => {
      const r = useProgressRecording.getState();
      if (!r.panelOpen) r.openPanel();
    },
  };
}
