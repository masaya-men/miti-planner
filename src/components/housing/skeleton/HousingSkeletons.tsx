import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDelayedFlag } from '../../../lib/housing/useDelayedFlag';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

/**
 * 読み込み中ダミー (スケルトン) の共通部品。
 * - マウントされている間だけ「読み込み中」。 200ms 以内に消える (= 本物に差し替わる) ならダミーは描かない。
 * - コンテナに role="status" + 読み上げ専用テキスト。 ダミー要素自体は aria-hidden。
 * - 動きは housing-skeleton-pulse (落ち着いた明滅) のみ。 reduced-motion では停止 (data-shimmer="false")。
 */
export interface SkeletonShellProps {
  className?: string;
  /** ダミー本体を包む内側要素のクラス。未指定なら display: contents (子が外側の直接の子として並ぶ)。 */
  fillClassName?: string;
  /** 読み上げ用文言の i18n キー (既存キーを流用)。 */
  labelKey?: string;
  children: React.ReactNode;
  'data-testid'?: string;
}

export const SkeletonShell: React.FC<SkeletonShellProps> = ({
  className,
  fillClassName,
  labelKey = 'housing.gallery.loading',
  children,
  'data-testid': testId,
}) => {
  const { t } = useTranslation();
  const visible = useDelayedFlag(true);
  const reduced = useReducedMotion();
  return (
    <div
      className={className}
      role="status"
      data-shimmer={reduced ? 'false' : 'true'}
      data-testid={testId}
    >
      <span className="housing-sr-only">{t(labelKey)}</span>
      {visible ? <div className={fillClassName ?? 'housing-skel-fill'} aria-hidden="true">{children}</div> : null}
    </div>
  );
};

/** 家の詳細: 写真枠 + タイトル行 + 住所行 + タグ行。実表示 (.housing-detail-content) と同じ骨格を流用。 */
export const DetailSkeleton: React.FC = () => (
  <SkeletonShell className="housing-detail-body" labelKey="housing.detail.title" data-testid="housing-detail-skeleton">
    <div className="housing-detail-content">
      <div className="housing-detail-visual">
        <div className="housing-detail-gallery">
          <div className="housing-skel housing-skel-detail-photo" />
        </div>
      </div>
      <div className="housing-detail-side">
        <div className="housing-skel housing-skel-line housing-skel-title" />
        <div className="housing-skel housing-skel-line housing-skel-line-mid" />
        <div className="housing-skel-tags">
          <div className="housing-skel housing-skel-tag" />
          <div className="housing-skel housing-skel-tag" />
          <div className="housing-skel housing-skel-tag" />
        </div>
      </div>
    </div>
  </SkeletonShell>
);

/** ハウジンガーのプロフィール部 (左列): アイコン丸 + 名前行 + 紹介文 2 行。 */
export const HousingerProfileSkeleton: React.FC = () => (
  <SkeletonShell className="housinger-page-profile-col" labelKey="housing.housinger.loading" data-testid="housinger-profile-skeleton">
    <div className="housing-skel-profile">
      <div className="housing-skel housing-skel-avatar" />
      <div className="housing-skel housing-skel-line housing-skel-name" />
    </div>
    <div className="housing-skel housing-skel-line" />
    <div className="housing-skel housing-skel-line housing-skel-line-mid" />
  </SkeletonShell>
);

/** 地図枠サイズの薄い四角。 */
export const MapSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <SkeletonShell className={className ?? 'housing-skel-map-shell'} labelKey="housing.map.loading" data-testid="housing-map-skeleton">
    <div className="housing-skel housing-skel-map" />
  </SkeletonShell>
);

/** 細い行ダミー (タグ選択の読み込み中など)。 */
export const LinesSkeleton: React.FC<{ count?: number; labelKey: string }> = ({ count = 3, labelKey }) => (
  <SkeletonShell className="housing-skel-lines-shell" labelKey={labelKey}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="housing-skel housing-skel-line" />
    ))}
  </SkeletonShell>
);

/** ハウジンガーページ「まとめてツアー」ボタンの居場所。 実ボタンと同じクラスで寸法を合わせ、 色だけダミーにする。 */
export const TourAllButtonSkeleton: React.FC = () => {
  const { t } = useTranslation();
  const visible = useDelayedFlag(true);
  const reduced = useReducedMotion();
  return (
    <div data-shimmer={reduced ? 'false' : 'true'} aria-hidden="true">
      <div
        className="housinger-page-tour-btn housinger-page-tour-btn-skel housing-skel"
        data-visible={visible ? 'true' : 'false'}
        data-testid="housinger-tour-btn-skeleton"
      >
        {t('housing.housinger.tourAll')}
      </div>
    </div>
  );
};
