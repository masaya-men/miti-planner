import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { MobileBottomSheet } from '../../MobileBottomSheet';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { FilterPanel } from '../workspace/FilterPanel';

export interface HousingFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * スマホ用フィルターシート (Task1: モバイルシェル基盤)。
 * キーワード入力 (PC 版はヘッダー内 .housing-app-search にしかないためここに複製) +
 * 既存 FilterPanel をそのまま流用する (中身は改変しない)。
 */
export const HousingFilterSheet: React.FC<HousingFilterSheetProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const keyword = useHousingFilterStore((s) => s.keyword);
  const setKeyword = useHousingFilterStore((s) => s.setKeyword);

  // 実機FB#1: 共有シートの白背景 (miti トークン) だと housing の白文字が見えない。
  // title prop はやめて housing 自前ヘッダーにし、className でシート面を housing トンマナ化する。
  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} height="80vh" className="housing-mobile-sheet">
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
    </MobileBottomSheet>
  );
};
