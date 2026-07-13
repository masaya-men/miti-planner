import { useLayoutEffect, useRef } from 'react';
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

  useLayoutEffect(() => {
    const list = listRef.current;
    const track = trackRef.current;
    if (!list || !track) return;
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
    };
    measure();
    // アクティブ説明文の開閉で末尾ステップの高さが変わる (= 末尾バッジの中心位置が動く) ため、
    // scroll ハンドラでの layout 読みではなく ResizeObserver で再計測する
    // (reference_perf_forced_reflow_resizeobserver: onMount + リサイズ時のみ計算)。
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [steps.length]);

  return (
    <nav className="housing-register-stepper" aria-label={t('housing.register.stepper_aria_label')}>
      <div className="housing-register-stepper-body">
        <div
          ref={trackRef}
          className="housing-register-stepper-track"
          aria-hidden="true"
          style={{ '--stepper-progress': progress } as CSSProperties}
        >
          <div className="housing-register-stepper-track-fill" />
        </div>
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
