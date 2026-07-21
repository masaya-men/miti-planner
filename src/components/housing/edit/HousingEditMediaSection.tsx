import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditMediaModeTabs, type EditMediaMode } from './HousingEditMediaModeTabs';
import { HousingEditThumbnailPanel } from './HousingEditThumbnailPanel';
import { HousingEditSourcePanel, type EditVideoPreview } from './HousingEditSourcePanel';
import type { SnsCapture } from '../pages/RegisterPage';

export interface HousingEditMediaSectionProps {
  listingId: string;
  initialMode: EditMediaMode;
  thumbnailPaths: string[];
  onThumbnailPathsChange: (next: string[]) => void;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: EditVideoPreview | null;
  /** 2026-07-22 追加 (Batch2): 貼った投稿URLの一覧 (重複検出に使う)。 */
  sourcePostUrls: string[];
  onCommitSnsFetch: (
    capture: SnsCapture,
    freshSourceImageUrls: string[],
    nextPostUrl: string,
  ) => Promise<{ ok: boolean; skipped?: boolean }>;
}

/**
 * 編集ページの写真セクション全体 (Plan B・2026-07-21)。タブの選択状態は完全にローカル
 * (どちらのパネルを見せるかだけ) で、実データの切り替えは各パネルの操作結果
 * (アップロード成功 / URL取得commit成功) を受けて親 (RegisterPage) 側の state が
 * 更新されることで反映される。
 */
export function HousingEditMediaSection({
  listingId,
  initialMode,
  thumbnailPaths,
  onThumbnailPathsChange,
  sourceImageUrls,
  onSourceImageUrlsChange,
  videoPreview,
  sourcePostUrls,
  onCommitSnsFetch,
}: HousingEditMediaSectionProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<EditMediaMode>(initialMode);

  return (
    <section className="housing-register-section" data-testid="housing-edit-media-section">
      <h2 className="housing-register-section-title">{t('housing.register.section_media')}</h2>
      <HousingEditMediaModeTabs mode={mode} onChange={setMode} />
      <p className="housing-register-image-note">{t('housing.register.editMedia.recommend_url')}</p>
      {mode === 'thumbnail' ? (
        <HousingEditThumbnailPanel
          listingId={listingId}
          images={thumbnailPaths}
          onImagesChange={onThumbnailPathsChange}
        />
      ) : (
        <HousingEditSourcePanel
          listingId={listingId}
          sourceImageUrls={sourceImageUrls}
          onSourceImageUrlsChange={onSourceImageUrlsChange}
          videoPreview={videoPreview}
          sourcePostUrls={sourcePostUrls}
          onCommitSnsFetch={onCommitSnsFetch}
        />
      )}
    </section>
  );
}
