import { useTranslation } from 'react-i18next';
import { AllmarksFallingHouses } from './AllmarksFallingHouses';
import type { AllmarksImportProgress as AllmarksImportProgressState } from '../../../lib/housing/useAllmarksImport';
import type { Region } from '../../../data/housing/dcServerMap';
import { regionLabel, pickRegionLocale } from '../../../data/housing/regionMap';
import { localeDefaultRegion } from '../../../lib/housing/localeRegionDefaults';

export interface AllmarksImportProgressProps {
  progress: AllmarksImportProgressState;
  /**
   * 「やめる」(取得中/インポート中)・「閉じる」(完了後) どちらからも呼ぶ、通常の
   * 追加パネルへ戻る単一の窓口。取得中/インポート中に呼んでも、ここまで追加済みの分
   * (`progress.added`) は一時ツアーに残る(取り消さない)。
   */
  onClose: () => void;
  /** status='choosing-region' のとき、選ばれたリージョンを渡して確定する。 */
  onChooseRegion: (region: Region) => void;
}

/**
 * Allmarksまとめてインポートの進捗表示 (2026-08-19)。
 * 数値の進捗はテキストで表示し、視覚演出は `AllmarksFallingHouses`(家が降ってくる→
 * 道でつながる→歩く→消える、を繰り返す)に任せる。 実際の取り込み進捗とは連動しない
 * 純粋な演出(ユーザー発案、2026-08-19)。
 */
export const AllmarksImportProgress: React.FC<AllmarksImportProgressProps> = ({ progress, onClose, onChooseRegion }) => {
  const { t, i18n } = useTranslation();
  const regionLocale = pickRegionLocale(i18n.language);

  if (progress.status === 'fetching-list') {
    return (
      <div className="housing-allmarks-import-panel">
        <div className="housing-fetch-indicator">
          <span className="housing-spinner" aria-hidden />
          <span>{t('housing.ephemeral.allmarks_import.fetching_list')}</span>
        </div>
        <button type="button" className="housing-action-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  if (progress.status === 'importing') {
    return (
      <div className="housing-allmarks-import-panel">
        <AllmarksFallingHouses />
        <p className="housing-allmarks-import-status">
          {t('housing.ephemeral.allmarks_import.checking', { processed: progress.processed, total: progress.total })}
        </p>
        <p className="housing-allmarks-import-tally">
          {t('housing.ephemeral.allmarks_import.added_so_far', { count: progress.added })}
        </p>
        <button type="button" className="housing-action-btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  if (progress.status === 'choosing-region') {
    const preferred = localeDefaultRegion(i18n.language);
    const defaultRegion =
      progress.regionChoices.find((c) => c.region === preferred)?.region ?? progress.regionChoices[0]?.region;
    return (
      <div className="housing-allmarks-import-panel">
        <p className="housing-allmarks-import-status">
          {t('housing.ephemeral.allmarks_import.choose_region_title')}
        </p>
        <div className="housing-allmarks-import-region-choices">
          {progress.regionChoices.map((choice) => (
            <button
              key={choice.region}
              type="button"
              className={
                choice.region === defaultRegion
                  ? 'housing-action-btn housing-btn-primary'
                  : 'housing-action-btn'
              }
              onClick={() => onChooseRegion(choice.region)}
            >
              {t('housing.ephemeral.allmarks_import.choose_region_option', {
                region: regionLabel(choice.region, regionLocale),
                count: choice.count,
              })}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // status === 'done'
  if (progress.shareNotFound) {
    return (
      <div className="housing-allmarks-import-panel">
        <p className="housing-error-text">{t('housing.ephemeral.allmarks_import.not_found')}</p>
        <div className="housing-allmarks-import-actions">
          <button type="button" className="housing-action-btn housing-btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="housing-allmarks-import-panel">
      <div className="housing-allmarks-import-summary">
        <p className="housing-ephemeral-added">
          {t('housing.ephemeral.allmarks_import.summary_added', { count: progress.added, total: progress.total })}
        </p>
        {progress.failed > 0 && (
          <p className="housing-allmarks-import-status">
            {t('housing.ephemeral.allmarks_import.summary_failed', { count: progress.failed })}
          </p>
        )}
        {progress.limitReached && (
          <p className="housing-allmarks-import-status">
            {t('housing.ephemeral.allmarks_import.summary_limit_reached')}
          </p>
        )}
        {progress.regionExcluded > 0 && (
          <p className="housing-allmarks-import-status">
            {t('housing.ephemeral.allmarks_import.summary_region_excluded', { count: progress.regionExcluded })}
          </p>
        )}
      </div>
      <div className="housing-allmarks-import-actions">
        <button type="button" className="housing-action-btn housing-btn-primary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
};
