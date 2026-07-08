import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { stepStatus, isTourPlaceable, type TourStep } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';

export interface TourRouteStepsProps {
  steps: TourStep[];
  currentIndex: number;
}

/**
 * 右カラム: ルートのステップ一覧 (表示専用)。
 *
 * 各ステップの状態 (到着済み/次に訪問/未到着) は tourNav.ts の stepStatus を
 * そのまま使う。listing 欠落 (steps.missing) と地図解決不可 (steps.map_pending・
 * ナビ自体は継続想定なので行自体は出す) は静かな注記として添える。
 */
export const TourRouteSteps: React.FC<TourRouteStepsProps> = ({ steps, currentIndex }) => {
  const { t, i18n } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);

  // スクロールバーは隠し、上下端フェード(マスク)でスクロール可能を示唆する(業界標準)。
  // 端(上/下)に達したらその側のフェードを消す → data 属性を CSS が読む。
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => {
      el.dataset.atTop = String(el.scrollTop <= 1);
      el.dataset.atBottom = String(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [steps.length, currentIndex]);

  // 次へ/前へ で現在ステップが変わったら、その行をリスト中央付近へ自動スクロール(1つずつ追従)。
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const current = list.querySelector<HTMLElement>('.housing-tour-steps-item--current');
    if (!current) return;
    if (typeof list.scrollTo !== 'function') return; // 非レイアウト環境(テスト等)ではスキップ
    const listRect = list.getBoundingClientRect();
    const itemRect = current.getBoundingClientRect();
    const delta = (itemRect.top - listRect.top) - (list.clientHeight - itemRect.height) / 2;
    list.scrollTo({ top: list.scrollTop + delta, behavior: 'smooth' });
  }, [currentIndex, steps.length]);

  return (
    <div className="housing-tour-steps">
      <span className="housing-tour-steps-heading">{t('housing.tour.nav.steps.heading')}</span>
      <ol ref={listRef} className="housing-tour-steps-list" data-at-top="true" data-at-bottom="true">
        {steps.map((step, index) => {
          const status = stepStatus(index, currentIndex);
          const missing = step.listing === null;
          const mapPending = !missing && !isTourPlaceable(step.listing);

          return (
            <li
              key={step.id}
              className={`housing-tour-steps-item housing-tour-steps-item--${status}`}
              data-status={status}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              <span className="housing-tour-steps-dot" aria-hidden="true" />
              <div className="housing-tour-steps-body">
                <span className="housing-tour-steps-addr">
                  {step.listing
                    ? formatHousingAddress(step.listing, i18n.language)
                    : t('housing.tour.nav.steps.missing')}
                </span>
                {mapPending && (
                  <span className="housing-tour-steps-note">
                    {t('housing.tour.nav.steps.map_pending')}
                  </span>
                )}
              </div>
              <span className="housing-tour-steps-status">
                {t(`housing.tour.nav.steps.status.${status}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
