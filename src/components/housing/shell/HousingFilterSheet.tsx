import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { MobileBottomSheet } from '../../MobileBottomSheet';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { FilterPanel } from '../workspace/FilterPanel';
import { TagPickerPanel } from '../browse/tagpicker/TagPickerPanel';

export interface HousingFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * スマホ用フィルターシート (Task1: モバイルシェル基盤)。
 * キーワード入力 (PC 版はヘッダー内 .housing-app-search にしかないためここに複製) +
 * 既存 FilterPanel をそのまま流用する (中身は改変しない)。
 * 「テーマ」があった位置には、PC版「タグ」ビューと同じ中身 (TagPickerPanel) を
 * FilterDropdown と同じ見た目のインラインアコーディオンとして追加する
 * (design 2026-07-27-housing-tag-and-search-design.md §5)。
 * 「絞り込む」を押してもこのシート自体は閉じず、その場で折りたたまれるだけ
 * (他のフィルター項目を続けて調整できるように)。
 */
export const HousingFilterSheet: React.FC<HousingFilterSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const keyword = useHousingFilterStore((s) => s.keyword);
  const setKeyword = useHousingFilterStore((s) => s.setKeyword);
  const [tagOpen, setTagOpen] = useState(false);

  // 実機FB#1: 共有シートの白背景 (miti トークン) だと housing の白文字が見えない。
  // title prop はやめて housing 自前ヘッダーにし、className でシート面を housing トンマナ化する。
  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      height="80vh"
      className="housing-mobile-sheet"
      // 実機FB第3弾: 中身の縦スクロールが全面スワイプ閉じと衝突して不安定 → つまみだけで閉じる。
      swipeArea="handle"
    >
      <div className="housing-sheet-head">
        <span className="housing-sheet-title">{t('housing.mobile.filter_title')}</span>
        <button
          type="button"
          className="housing-sheet-close"
          onClick={onClose}
          aria-label={t('housing.card.close')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <input
        type="search"
        className="housing-app-search-input housing-mobile-filter-search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={t('housing.header.search_placeholder')}
        aria-label={t('housing.header.search_placeholder')}
      />
      <FilterPanel
        hideClose
        onClose={onClose}
        onRegisterClick={() => {
          onClose();
          navigate('/housing/register');
        }}
      />
      <div className="housing-filter-field housing-tagpicker-inline" data-open={tagOpen ? 'true' : 'false'}>
        <span className="housing-filter-field-label">{t('housing.browse.view_tags')}</span>
        <button
          type="button"
          className="housing-filter-select"
          aria-label={t('housing.browse.view_tags')}
          aria-expanded={tagOpen}
          onClick={() => setTagOpen((v) => !v)}
        >
          <span className="housing-filter-select-value">{t('housing.browse.view_tags')}</span>
          <ChevronDown size={15} aria-hidden="true" className="housing-filter-select-chevron" />
        </button>
        {tagOpen && (
          <div className="housing-tagpicker-inline-body">
            <TagPickerPanel onApplied={() => setTagOpen(false)} />
          </div>
        )}
      </div>
    </MobileBottomSheet>
  );
};
