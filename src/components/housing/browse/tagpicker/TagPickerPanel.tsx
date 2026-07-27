import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';
import { useHousingViewStore } from '../../../../store/useHousingViewStore';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingTagPickerStore } from '../../../../store/useHousingTagPickerStore';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import { applyFilters } from '../../../../lib/housing/applyFilters';
import { useKeywordFilteredListings } from '../../../../lib/housing/useKeywordFilteredListings';
import { HousingerTagSection } from './HousingerTagSection';
import { AllTagsSection } from './AllTagsSection';

export interface TagPickerPanelProps {
  /** 「絞り込む」で committed tags へ反映した直後に呼ばれる (PC=一覧へ遷移 / スマホ=折りたたみ)。 */
  onApplied: () => void;
}

/**
 * タグ検索の中身 (ハウジンガー+タグ全部の2セクション、件数プレビュー、絞り込む/クリア)。
 * PC (BrowseTagView) とスマホ (HousingFilterSheet インライン) の両方から使う共有コンポーネント
 * (design 2026-07-27-housing-tag-and-search-design.md 技術的な注意点)。
 */
export const TagPickerPanel: React.FC<TagPickerPanelProps> = ({ onApplied }) => {
  const { t } = useTranslation();

  const committedTags = useHousingFilterStore((s) => s.tags);
  const setTags = useHousingFilterStore((s) => s.setTags);
  const dc = useHousingFilterStore((s) => s.dc);
  const regions = useHousingFilterStore((s) => s.regions);
  const servers = useHousingFilterStore((s) => s.servers);
  const areas = useHousingFilterStore((s) => s.areas);
  const sizes = useHousingFilterStore((s) => s.sizes);
  const keyword = useHousingFilterStore((s) => s.keyword);

  const pendingTags = useHousingTagPickerStore((s) => s.pendingTags);
  const lastSyncedCommitted = useHousingTagPickerStore((s) => s.lastSyncedCommitted);
  const toggleTag = useHousingTagPickerStore((s) => s.toggleTag);
  const clearPending = useHousingTagPickerStore((s) => s.clearPending);
  const syncFromCommitted = useHousingTagPickerStore((s) => s.syncFromCommitted);

  // committed tags がタグ検索の外側 (ヘッダー検索・詳細ページのタグクリック・
  // 他のクリアボタン等) で変わったときは pending を追従させる。タブ往復だけでは
  // committed は変わらないので、その間に選んだ pending の下書きはそのまま保持される
  // (design 2026-07-27 §3)。
  useEffect(() => {
    const changed =
      lastSyncedCommitted === null ||
      lastSyncedCommitted.length !== committedTags.length ||
      lastSyncedCommitted.some((v, i) => v !== committedTags[i]);
    if (changed) syncFromCommitted(committedTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedTags]);

  const viewMode = useHousingViewStore((s) => s.viewMode);
  const realListings = useHousingListingsStore((s) => s.listings);
  const source = viewMode === 'map' ? MOCK_LISTINGS : realListings;

  const previewBase = useMemo(
    () => applyFilters(source, { dc, regions, servers, areas, sizes, tags: pendingTags }),
    [source, dc, regions, servers, areas, sizes, pendingTags],
  );
  const preview = useKeywordFilteredListings(previewBase, keyword);

  const handleApply = () => {
    setTags(pendingTags);
    onApplied();
  };

  return (
    <div className="housing-tagpicker">
      <HousingerTagSection selected={pendingTags} onToggle={toggleTag} />
      <AllTagsSection selected={pendingTags} onToggle={toggleTag} />
      <div className="housing-tagpicker-footer">
        <span className="housing-tagpicker-preview">
          {t('housing.tagpicker.preview_count', { count: preview.length })}
        </span>
        <div className="housing-tagpicker-footer-actions">
          <button type="button" className="housing-tagpicker-clear-btn" onClick={clearPending}>
            {t('housing.tagpicker.clear_button')}
          </button>
          <button type="button" className="housing-tagpicker-apply-btn" onClick={handleApply}>
            {t('housing.tagpicker.apply_button')}
          </button>
        </div>
      </div>
    </div>
  );
};
