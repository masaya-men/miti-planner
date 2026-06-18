/**
 * 進捗トラッキングHUD — 攻略の軌跡（その日の最高到達点を打点）。
 * 試作 feat/progress-celebration-proto の PulseTrail + JourneyStrip を 1:1 移植し、
 * データ供給元を PlanData（useMitigationStore 経由）に差し替えたもの。
 *
 * 見た目: 試作 4c0b94b と 1:1（canvas 定数・クラス・レイアウトは無変更）。
 * 変更点: SEED → store の progress.dailyBest・timelineEvents 駆動に差し替え。
 *         ActivityDots は spec スコープ外のためレンダリングしない。
 * E1追加: お祝い演出（ProgressCelebration）+ 発火条件（クリア遷移 / マウント時クリア済み）。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence } from 'framer-motion';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useMitigations } from '../../hooks/useSkillsData';
import { computeProgressPercent, isEmptyProgress } from '../../lib/progressLogic';
import { useProgressRecording } from './useProgressRecording';
import { ProgressRecordPanel } from './ProgressRecordPanel';
import { ProgressCelebration } from './ProgressCelebration';

/**
 * dismiss 済み planId の記録（モジュールレベル = remount でも保持）。
 * null planId は '__null__' キーとして扱う（記録しない方針 → 発火し続けるが安全）。
 */
const _dismissedPlanIds = new Set<string>();

// 光の玉 + 線状の余韻(尾)を canvas で描く。尾は連続した線でフェード(粒々にしない)。
// fullLine=true(クリア時): 全軌跡を点灯し、その上を count 個のパルスが走る。
function PulseTrail({ cornerX, cornerY, count = 1, fullLine = false }:
  { cornerX: number[]; cornerY: number[]; count?: number; fullLine?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let raf = 0;
    let start = 0;
    const GAP = fullLine ? 0 : 700;                       // 通常は右端で消えて左から再開
    // 速度=「日数」でなく「軌跡の実長(px)」基準で一定に。一周時間は下限/上限でクランプ
    // (日数が増えても遅くなりすぎない・少なくても速くなりすぎない)。
    const SPEED = 0.22;          // device px / ms (大きいほど速い)
    const PERIOD_MIN = 4000;     // 一周の最短(ms)
    const PERIOD_MAX = 8000;     // 一周の最長(ms) ← 30日超でもここで頭打ち
    // 尾(パルス風の細い線)の調整ノブ
    const TAIL_FRAC = 0.10;  // 尾の長さ(全長比)。小さいほど短い
    const TAIL_ALPHA = 0.5;  // 尾の濃さ(0〜1)
    const TAIL_WIDTH = 1;    // 尾の太さ(px CSS)

    const draw = (ts: number) => {
      if (!start) start = ts;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const pts = cornerX.map((x, i) => ({ x: (x / 100) * w, y: (cornerY[i] / 100) * h }));
      const segLen: number[] = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        segLen.push(d); total += d;
      }
      if (total > 0) {
        // 一周の時間 = 軌跡の実長 ÷ 一定速度。下限/上限でクランプ(日数に依らず体感速度を一定に)。
        const PERIOD = Math.min(PERIOD_MAX, Math.max(PERIOD_MIN, total / SPEED));
        const at = (d: number) => {
          if (d <= 0) return pts[0];
          let acc = 0;
          for (let i = 0; i < segLen.length; i++) {
            if (acc + segLen[i] >= d) { const f = (d - acc) / segLen[i]; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f }; }
            acc += segLen[i];
          }
          return pts[pts.length - 1];
        };
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (fullLine) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
          ctx.strokeStyle = 'rgba(59,130,246,0.6)';
          ctx.lineWidth = 1.6 * dpr;
          ctx.shadowColor = 'rgba(59,130,246,0.8)';
          ctx.shadowBlur = 4 * dpr;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        for (let c = 0; c < count; c++) {
          const cyc = (ts - start + (c * (PERIOD + GAP)) / count) % (PERIOD + GAP);
          if (cyc >= PERIOD) continue; // GAP 中は消える
          const prog = cyc / PERIOD;
          const headDist = prog * total;
          const fade = prog < 0.05 ? prog / 0.05 : prog > 0.95 ? (1 - prog) / 0.05 : 1;
          const head = at(headDist);
          // 尾(パルス風): 末端→head を「1本の連続した線」として描く。分割しないので粒(玉の並び)に見えない。
          // フェードはグラデーション、発光(shadowBlur)は線全体に1回だけ。先端のグローは下の玉が担う。
          const tailStart = Math.max(0, headDist - total * TAIL_FRAC);
          if (headDist - tailStart > 0.5) {
            const SAMP = 16;
            const tp: { x: number; y: number }[] = [];
            for (let k = 0; k <= SAMP; k++) tp.push(at(tailStart + (headDist - tailStart) * (k / SAMP)));
            const grad = ctx.createLinearGradient(tp[0].x, tp[0].y, head.x, head.y);
            grad.addColorStop(0, 'rgba(150,195,255,0)');                                  // 末端=透明
            grad.addColorStop(0.55, `rgba(150,195,255,${(TAIL_ALPHA * 0.5 * fade).toFixed(3)})`);
            grad.addColorStop(1, `rgba(180,210,255,${(TAIL_ALPHA * fade).toFixed(3)})`);   // head側=濃い
            ctx.beginPath();
            ctx.moveTo(tp[0].x, tp[0].y);
            for (let k = 1; k < tp.length; k++) ctx.lineTo(tp[k].x, tp[k].y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = TAIL_WIDTH * dpr;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(80,150,255,0.6)';
            ctx.shadowBlur = 3 * dpr;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          // 先頭の玉。やわらかい青のグロー(放射状) + 白い芯。でかすぎない。
          const R = 6.5 * dpr; // グローの広がり
          const g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, R);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
          g.addColorStop(0.30, `rgba(120,170,255,${0.4 * fade})`);
          g.addColorStop(1, 'rgba(59,130,246,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(head.x, head.y, R, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${fade})`; // 中心の白い芯(グローは変えず芯だけ小さく)
          ctx.beginPath();
          ctx.arc(head.x, head.y, 0.8 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [cornerX, cornerY, count, fullLine]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// コンパクトな軌跡ストリップ(ヘッダー想定)。常時の道は描かず、光の玉 + 線状の余韻(尾)。
// points: 日ごとの到達点を % に正規化した配列（store 側で算出して渡す）。
// pct: spec のデータモデルに従い「最高 reachedPos ÷ 全長」で算出した進捗 %（computeProgressPercent の結果）。
// activeDays/activeHours は任意（未設定なら非表示）。
function JourneyStrip({
  points,
  pct,
  cleared,
  activeDays,
  activeHours,
}: {
  points: number[];
  pct: number;
  cleared: boolean;
  activeDays?: number;
  activeHours?: number;
}) {
  const n = points.length;

  const yTop = points.map((p) => 100 - Math.max(3, p)); // 各日の到達点y(%)

  // 光が辿る軌跡(線は常時描かない): 左下から登り、各日の到達点を平らに進み、隣へ縦の段＝階段。
  const cornerX: number[] = [0];
  const cornerY: number[] = [100];
  points.forEach((_, i) => {
    cornerX.push((i / n) * 100, ((i + 1) / n) * 100);
    cornerY.push(yTop[i], yTop[i]);
  });

  // n === 0 のとき: 親 ProgressTrackingHUD が isEmptyProgress で誘導表示に分岐済みのため、
  // JourneyStrip はここに到達しない。念のため空 canvas を返してクラッシュを防ぐ。
  if (n === 0) {
    return <div className="relative flex-1 h-9 overflow-visible" />;
  }

  return (
    <div className="flex items-center gap-4">
      {/* 左: 統計（日数・時間 / 進捗%） */}
      <div className="shrink-0 leading-tight">
        {/* activeDays/activeHours は任意。入れた人だけ表示（spec 準拠） */}
        {(activeDays != null || activeHours != null) && (
          <div className="text-app-sm font-bold text-app-text whitespace-nowrap">
            {activeDays ?? 0}日 {activeHours ?? 0}時間
          </div>
        )}
        {cleared
          ? <div className="text-app-md font-bold text-app-blue" style={{ textShadow: '0 0 8px var(--app-blue)' }}>踏破 👑</div>
          : <div className="text-app-md font-bold whitespace-nowrap">進捗 {pct}<span className="text-app-2xs text-app-text-muted">%</span></div>}
      </div>

      {/* 中央: 光の玉 + 線状の余韻(尾)。クリア時は全軌跡を点灯し数個のパルスが走る。常時の道は出さない。 */}
      <div className="relative flex-1 h-9 overflow-visible">
        <PulseTrail cornerX={cornerX} cornerY={cornerY} count={cleared ? 3 : 1} fullLine={cleared} />
      </div>

      {/* 右: ActivityDots は spec スコープ外のためレンダリングしない */}
    </div>
  );
}

/**
 * 進捗トラッキングHUD（props なし・store から読む）。
 * ConsolidatedHeader の中央スロットに組み込む。
 * クリックで到達点記録パネルを開く。
 */
export function ProgressTrackingHUD() {
  const { t } = useTranslation();
  const progress = useMitigationStore((s) => s.progress);
  const timelineEvents = useMitigationStore((s) => s.timelineEvents);
  const partyMembers = useMitigationStore((s) => s.partyMembers);
  const currentPlanId = usePlanStore((s) => s.currentPlanId);

  // 降らせるアイコン = 設定パーティのジョブが持つスキルアイコン全部（重複除去）
  const mitigations = useMitigations();
  const jobIds = new Set(partyMembers.map((m) => m.jobId).filter((id): id is string => id !== null));
  const celebrationIcons = [...new Set(
    mitigations.filter((m) => jobIds.has(m.jobId)).map((m) => m.icon).filter(Boolean)
  )];

  // タイムライン全長（秒）= timelineEvents の最大 time
  const total = timelineEvents.length
    ? Math.max(...timelineEvents.map((e) => e.time))
    : 0;

  // 各日の到達点を % に正規化した配列（日付昇順は store 側 mergeDailyBest で保証済み）
  const points = progress.dailyBest.map((d) =>
    total > 0 ? Math.max(0, Math.min(100, (d.reachedPos / total) * 100)) : 0
  );

  // spec 準拠の進捗 %（最高 reachedPos ÷ 全長）
  const pct = computeProgressPercent(progress, total);

  // 記録ゼロ判定: true のときは軌跡の代わりに誘導文言を表示する。
  // 1点でも記録されれば isEmptyProgress=false になり、再レンダリングで軌跡へ自動切替。
  const isEmpty = isEmptyProgress(progress);

  // ─── お祝い演出の発火条件 ───────────────────────────────────────────────
  const [showCelebration, setShowCelebration] = useState(false);
  // 前回の cleared 値を保持（false→true への遷移を検知するため）
  const prevCleared = useRef<boolean | undefined>(undefined);
  // プラン切替を検知するため前回の planId を保持
  const prevPlanId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const cleared = progress.cleared;
    const planKey = currentPlanId ?? null;

    // プラン切替時は prevCleared をリセット → マウント相当の評価に戻す（クリア済みの表を開いたら発火）
    if (prevPlanId.current !== currentPlanId) {
      prevCleared.current = undefined;
      prevPlanId.current = currentPlanId;
    }

    // dismiss 済み planId はスキップ（null planId は記録しない = 常に発火）
    const isDismissed = planKey !== null && _dismissedPlanIds.has(planKey);

    if (!isDismissed) {
      // ①クリアボタン押下時（false→true 遷移） ②マウント時またはプラン切替直後にクリア済み（prev=undefined かつ cleared=true）
      if (cleared && (prevCleared.current === false || prevCleared.current === undefined)) {
        setShowCelebration(true);
      }
    }
    prevCleared.current = cleared;
  }, [progress.cleared, currentPlanId]);

  /** 演出を閉じ、同じ表では再表示しない（セッション内フラグ） */
  const handleDismiss = () => {
    setShowCelebration(false);
    if (currentPlanId !== null) {
      _dismissedPlanIds.add(currentPlanId);
    }
  };

  return (
    <>
      {/* HUD 帯クリックで記録パネルを開く（空状態・軌跡表示どちらも同じクリック領域） */}
      <div
        className="w-full cursor-pointer"
        onClick={() => useProgressRecording.getState().openPanel()}
      >
        {isEmpty ? (
          /* 誘導型空状態: 軌跡の代わりに誘導文言を帯に出す */
          <div className="flex items-center justify-center h-9 text-app-sm text-app-text-muted">
            {t('progress.empty_cta')}
          </div>
        ) : (
          <JourneyStrip
            points={points}
            pct={pct}
            cleared={progress.cleared}
            activeDays={progress.activeDays}
            activeHours={progress.activeHours}
          />
        )}
      </div>
      {/* 記録パネル（panelOpen false で自動的に null） */}
      <ProgressRecordPanel />
      {/* お祝い演出（framer-motion AnimatePresence でアンマウント時にフェードアウト） */}
      <AnimatePresence>
        {showCelebration && (
          <ProgressCelebration icons={celebrationIcons} onDismiss={handleDismiss} />
        )}
      </AnimatePresence>
    </>
  );
}
