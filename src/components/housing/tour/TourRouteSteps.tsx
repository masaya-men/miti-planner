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

  return (
    <div className="housing-tour-steps">
      <span className="housing-tour-steps-heading">{t('housing.tour.nav.steps.heading')}</span>
      <ol className="housing-tour-steps-list">
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
