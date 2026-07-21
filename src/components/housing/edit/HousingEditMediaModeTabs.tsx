import { useTranslation } from 'react-i18next';

export type EditMediaMode = 'thumbnail' | 'sns';

export interface HousingEditMediaModeTabsProps {
  mode: EditMediaMode;
  onChange: (mode: EditMediaMode) => void;
}

/**
 * 編集ページの「アップロード」/「URL」切り替えタブ (Plan B・2026-07-21)。
 * 押した瞬間はローカルの表示切り替えのみでサーバーへは何も送らない。実際にサーバー側の
 * データが変わる (旧方式のクリーンアップを含む) のは、新しい方に実コンテンツが
 * 入った瞬間 (HousingEditThumbnailPanel のアップロード成功時 / HousingEditSourcePanel の
 * URL取得成功時) であり、それらは別コンポーネントの責務。
 */
export function HousingEditMediaModeTabs({ mode, onChange }: HousingEditMediaModeTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="housing-edit-media-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'thumbnail'}
        className="housing-edit-media-tab"
        onClick={() => onChange('thumbnail')}
      >
        {t('housing.register.editMedia.tab_upload')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'sns'}
        className="housing-edit-media-tab"
        onClick={() => onChange('sns')}
      >
        {t('housing.register.editMedia.tab_url')}
      </button>
    </div>
  );
}
