import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

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
// 円周長 (RING_C = 2 * Math.PI * RING_R) は dash 進捗計算で使う値のため Task3 で導入する
// (Task2 で定義すると未使用のまま残り noUnusedLocals で tsc -b が落ちるため)。
const RING_CX = 21;
const RING_R = 10;

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
  const trackRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 各丸バッジの中心 y (stepper-body 基準・px) と body の全高。SVG 進捗レイヤーの座標に使う
  // (Task2: 静的表示のみ。progress に応じた dash 反映は Task3)。
  const [centers, setCenters] = useState<number[]>([]);
  const [svgHeight, setSvgHeight] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const track = trackRef.current;
    const body = bodyRef.current;
    if (!list || !track || !body) return;
    const measure = () => {
      const badges = list.querySelectorAll<HTMLElement>('.housing-register-stepper-num');
      if (badges.length < 2) return;
      const listRect = list.getBoundingClientRect();
      const first = badges[0].getBoundingClientRect();
      const last = badges[badges.length - 1].getBoundingClientRect();
      const top = first.top + first.height / 2 - listRect.top;
      const bottom = listRect.bottom - (last.top + last.height / 2);
      track.style.setProperty('--connector-top', `${top}px`);
      track.style.setProperty('--connector-bottom', `${bottom}px`);

      const bodyRect = body.getBoundingClientRect();
      const ys: number[] = [];
      badges.forEach((b) => {
        const r = b.getBoundingClientRect();
        ys.push(r.top + r.height / 2 - bodyRect.top);
      });
      setCenters(ys);
      setSvgHeight(bodyRect.height);
    };
    measure();
    // アクティブ説明文の開閉で末尾ステップの高さが変わる (= 末尾バッジの中心位置が動く) ため、
    // scroll ハンドラでの layout 読みではなく ResizeObserver で再計測する
    // (reference_perf_forced_reflow_resizeobserver: onMount + リサイズ時のみ計算)。
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [steps.length]);

  // SVG 接続線 = 丸の縁から縁 (中心間距離 - 2R)。描画座標にだけ使う (色/dash は Task3/4)。
  const connectors = centers.slice(0, -1).map((cy, i) => ({ y1: cy + RING_R, y2: centers[i + 1] - RING_R }));

  return (
    <nav className="housing-register-stepper" aria-label={t('housing.register.stepper_aria_label')}>
      <div ref={bodyRef} className="housing-register-stepper-body">
        <div
          ref={trackRef}
          className="housing-register-stepper-track"
          aria-hidden="true"
          style={{ '--stepper-progress': progress } as CSSProperties}
        >
          <div className="housing-register-stepper-track-fill" />
        </div>
        <svg
          className="housing-register-stepper-svg"
          data-testid="housing-register-stepper-svg"
          width="100%"
          height={svgHeight}
          aria-hidden="true"
        >
          {/* 接続線 (丸の後ろ)。座標は測定値、色/dash は Task3/4 */}
          {connectors.map((c, i) => (
            <line
              key={`c-${i}`}
              className="housing-register-stepper-connector"
              x1={RING_CX}
              y1={c.y1}
              x2={RING_CX}
              y2={c.y2}
            />
          ))}
          {/* 円周リング。座標は測定値、色/dash は Task3/4 */}
          {centers.map((cy, i) => (
            <circle
              key={`r-${i}`}
              className="housing-register-stepper-ring"
              cx={RING_CX}
              cy={cy}
              r={RING_R}
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
    </nav>
  );
};
