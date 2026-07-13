import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { computeSegmentFills } from '../../../lib/housing/stepperProgress';
import { computeStepperScroll } from '../../../lib/housing/stepperScroll';

export type RegisterStepState = 'idle' | 'active' | 'done';

export interface RegisterStep {
  id: number;
  labelKey: string;
  state: RegisterStepState;
}

interface Props {
  steps: RegisterStep[];
  onJump: (id: number) => void;
  /**
   * 中央カラムのスクロール進行度 (0..1, 連続値)。左パネルの縦接続線の塗りに反映する
   * (Task2)。未指定時は 0 (塗りなし) として振る舞う。
   */
  progress?: number;
}

/**
 * `housing.register.step.*` (ラベル) から `housing.register.step_desc.*` (説明文) の
 * キーを導出する。ステップ id ごとに別マップを持たせず、命名規約 (spec 正典) で導出する。
 */
function descKeyFor(labelKey: string): string {
  return labelKey.replace('.step.', '.step_desc.');
}

// SVG 進捗レイヤーの座標定数 (Task2)。丸中心 x = item padding-left 10 + num 半径 11。
// 描画半径は num 22px の縁の内側に stroke が乗るよう実画面で調整する (色/線幅は Task4 で token 化)。
const RING_CX = 21;
const RING_R = 10;
const RING_C = 2 * Math.PI * RING_R;

/**
 * 登録ページ左カラム: ライブステッパーナビ (media/address/intro/visibility/confirm)。
 * スクロール位置と連動する現在地表示 + クリックで該当セクションへジャンプ。
 * `done` は「そのセクションの必須が埋まったか」を RegisterPage が算出して渡す
 * (このコンポーネント自体は状態を持たず表示に徹する)。
 * 既定 public のような「最初から✅」は作らない (feedback_form_ux_progress)。
 *
 * Task2: 番号を縦の接続線でつなぎ、中央カラムのスクロール進行度 (0..1) に合わせて塗る。
 * 説明文はアクティブなステップだけ開く (grid-template-rows のトランジション)。
 * 接続線の上端/下端は先頭・末尾バッジの中心に測って合わせる (ResizeObserver で再計測、
 * アクティブ説明文の開閉で末尾ステップの高さが変わっても追従する) — ツアーパネルの
 * ステップ接続線 (TourRouteSteps.tsx / `--housing-tour-step-spring`) と同じトークン・
 * イージングを流用する。
 */
export const RegisterStepperNav: React.FC<Props> = ({ steps, onJump, progress = 0 }) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  // 各丸バッジの中心 y (stepper-body 基準・px) と body の全高。SVG 進捗レイヤーの座標に使う。
  const [centers, setCenters] = useState<number[]>([]);
  const [svgHeight, setSvgHeight] = useState(0);
  // 説明文常時表示化 (Task3) で body がビューポートより高くなり得るため、進行連動オートスクロール
  // (computeStepperScroll) の入力として body 全高 / viewport 器高さを測る。
  const [contentH, setContentH] = useState(0);
  const [viewportH, setViewportH] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const body = bodyRef.current;
    if (!list || !body) return;
    const measure = () => {
      const badges = list.querySelectorAll<HTMLElement>('.housing-register-stepper-num');
      const bodyRect = body.getBoundingClientRect();
      const ys: number[] = [];
      badges.forEach((b) => {
        const r = b.getBoundingClientRect();
        ys.push(r.top + r.height / 2 - bodyRect.top);
      });
      setCenters(ys);
      setSvgHeight(bodyRect.height);
      const viewport = viewportRef.current;
      setContentH(bodyRect.height);
      setViewportH(viewport ? viewport.getBoundingClientRect().height : 0);
    };
    measure();
    // アクティブ説明文の開閉で末尾ステップの高さが変わる (= 末尾バッジの中心位置が動く) ため、
    // scroll ハンドラでの layout 読みではなく ResizeObserver で再計測する
    // (reference_perf_forced_reflow_resizeobserver: onMount + リサイズ時のみ計算)。
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    const viewport = viewportRef.current;
    if (viewport) ro.observe(viewport);
    return () => ro.disconnect();
  }, [steps.length]);

  // SVG 接続線 = 丸の縁から縁 (中心間距離 - 2R)。描画座標と dash 長さ (len) の両方に使う。
  const connectors = centers.slice(0, -1).map((cy, i) => {
    const y1 = cy + RING_R;
    const y2 = centers[i + 1] - RING_R;
    return { y1, y2, len: y2 - y1 };
  });

  // progress (0..1) をセグメント列 [円0, 線0, 円1, 線1, …, 円N] へ按分し、各リング/接続線の
  // dash 塗り量に変換する (Task3)。
  const segments: number[] = [];
  centers.forEach((_, i) => {
    segments.push(RING_C); // 円 i
    if (i < connectors.length) segments.push(connectors[i].len); // 線 i
  });
  const fills = computeSegmentFills(progress, segments);
  const ringFill = (i: number) => fills[i * 2] ?? 0; // 円 i
  const connectorFill = (i: number) => fills[i * 2 + 1] ?? 0; // 線 i

  // 説明文常時表示化 (Task3) で body がビューポートより高くなり得る分、進行度に応じて body を
  // 上へ送る (スクロールバー無し・端フェード併用)。器に収まる時は scrollY=0 (動かさない)。
  const scrollY = computeStepperScroll(progress, contentH, viewportH);
  const overflow = contentH > viewportH;

  return (
    <nav className="housing-register-stepper" aria-label={t('housing.register.stepper_aria_label')}>
      <div
        ref={viewportRef}
        className="housing-register-stepper-viewport"
        data-overflow={overflow ? 'true' : 'false'}
      >
        <div
          ref={bodyRef}
          className="housing-register-stepper-body"
          style={{ transform: `translateY(${-scrollY}px)` }}
        >
          <svg
            className="housing-register-stepper-svg"
            data-testid="housing-register-stepper-svg"
            width="100%"
            height={svgHeight}
            aria-hidden="true"
          >
            {/* 未塗り下地(トラック): 前景の手前(DOM順で後ろ = 描画は下)に敷く「これから塗る道筋」。
                dash なし = 全長・全周をそのまま表示。 */}
            {connectors.map((c, i) => (
              <line
                key={`ct-${i}`}
                className="housing-register-stepper-connector-track"
                x1={RING_CX}
                y1={c.y1}
                x2={RING_CX}
                y2={c.y2}
              />
            ))}
            {centers.map((cy, i) => (
              <circle
                key={`rt-${i}`}
                className="housing-register-stepper-ring-track"
                cx={RING_CX}
                cy={cy}
                r={RING_R}
              />
            ))}
            {/* 接続線 (丸の後ろ)。座標は測定値、progress に応じて dash で塗る */}
            {connectors.map((c, i) => (
              <line
                key={`c-${i}`}
                className="housing-register-stepper-connector"
                x1={RING_CX}
                y1={c.y1}
                x2={RING_CX}
                y2={c.y2}
                style={{ strokeDasharray: c.len, strokeDashoffset: c.len * (1 - connectorFill(i)) }}
              />
            ))}
            {/* 円周リング。座標は測定値、progress に応じて dash で塗る */}
            {centers.map((cy, i) => (
              <circle
                key={`r-${i}`}
                className="housing-register-stepper-ring"
                cx={RING_CX}
                cy={cy}
                r={RING_R}
                style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - ringFill(i)) }}
              />
            ))}
          </svg>
          <ol ref={listRef} className="housing-register-stepper-list">
            {steps.map((step) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={`housing-register-stepper-item is-${step.state}`}
                  data-testid={`housing-register-step-${step.id}`}
                  aria-current={step.state === 'active' ? 'step' : undefined}
                  onClick={() => onJump(step.id)}
                >
                  <span className="housing-register-stepper-num" aria-hidden="true">
                    <span className="housing-register-stepper-num-digit">{step.id}</span>
                    <svg
                      className="housing-register-stepper-check"
                      viewBox="0 0 16 16"
                      width="12"
                      height="12"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 8.5L6.2 11.5L13 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="housing-register-stepper-content">
                    <span className="housing-register-stepper-label">{t(step.labelKey)}</span>
                    <span className="housing-register-stepper-desc-wrap">
                      <span className="housing-register-stepper-desc-inner">
                        <span
                          className="housing-register-stepper-desc"
                          data-testid={`housing-register-step-desc-${step.id}`}
                        >
                          {t(descKeyFor(step.labelKey))}
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </nav>
  );
};
