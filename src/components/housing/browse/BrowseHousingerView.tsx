import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { LinesSkeleton } from '../skeleton/HousingSkeletons';
import { HousingerAvatar } from '../housinger/HousingerAvatar';
import { useSkeletonReveal } from '../../../lib/housing/useSkeletonReveal';
import { getCachedPublishedHousingers } from '../../../lib/housing/publishedHousingersCache';
import type { PublishedHousinger } from '../../../lib/housing/publishedHousingers';
import { stripHashedPrefix } from '../../../lib/housing/housingerProfile';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { thumbHousingImageUrl } from '../../../lib/housing/cardImageAttrs';

export interface BrowseHousingerViewProps {
  /** 探すページで絞り込み済みの家。ここに 1 件も家を持たない人は一覧に出さない。 */
  filtered: MockListing[];
}

const MAX_THUMBS = 3;

/** 頭文字の見出し: 英字は大文字 1 字、かなは「かな」、それ以外は「漢字」 (見本 H3 と同じ)。 */
export function housingerInitialHeading(name: string): string {
  const c = name.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0) || name.charAt(0);
  if (/[A-Za-z]/.test(c)) return c.toUpperCase();
  if (/[぀-ヿ]/.test(c)) return 'かな';
  return '漢字';
}

type LoadStatus = 'loading' | 'ready';

/**
 * 探すページ「ハウジンガー」表示 (見本 H3)。行 = アイコン・名前・紹介文 1 行 + 右に代表作の小サムネ。
 * 家の一覧は BrowsePage が読み込み済みの filtered を使い、追加の通信はハウジンガー一覧の 1 回 (セッション内キャッシュ) だけ。
 */
export const BrowseHousingerView: React.FC<BrowseHousingerViewProps> = ({ filtered }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [housingers, setHousingers] = useState<PublishedHousinger[]>([]);
  const reveal = useSkeletonReveal(status === 'loading');

  useEffect(() => {
    let cancelled = false;
    getCachedPublishedHousingers()
      .then((list) => {
        if (cancelled) return;
        setHousingers(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ownerUid ごとに、新しい順の代表画像 (最大 3 枚) をまとめる。
  const thumbsByOwner = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
    const map = new Map<string, string[]>();
    for (const l of sorted) {
      const arr = map.get(l.ownerUid) ?? [];
      if (arr.length < MAX_THUMBS) {
        arr.push(thumbHousingImageUrl(representativeImage(l)));
        map.set(l.ownerUid, arr);
      }
    }
    return map;
  }, [filtered]);

  // 絞り込み後の家を持つ人だけ (並びは listPublishedHousingers の順をそのまま使う)。
  const visible = useMemo(() => housingers.filter((h) => thumbsByOwner.has(h.uid)), [housingers, thumbsByOwner]);

  return (
    <div
      className={`housing-housinger-view${reveal ? ' housing-reveal' : ''}`}
      data-reveal={reveal || undefined}
      data-testid="housing-browse-housinger-view"
    >
      {status === 'loading' ? (
        <LinesSkeleton count={6} labelKey="housing.browse.housinger_loading" />
      ) : visible.length === 0 ? (
        <div className="housing-housinger-empty">{t('housing.browse.housinger_empty')}</div>
      ) : (
        <>
          <div className="housing-housinger-count">{t('housing.browse.housinger_count', { count: visible.length })}</div>
          {visible.map((h, i) => {
            const heading = housingerInitialHeading(h.displayName);
            const showHeading = i === 0 || housingerInitialHeading(visible[i - 1].displayName) !== heading;
            return (
              <Fragment key={h.uid}>
                {showHeading && <div className="housing-housinger-heading">{heading}</div>}
                <Link to={`/housing/housinger/${stripHashedPrefix(h.uid)}`} className="housing-housinger-row">
                  <HousingerAvatar avatarUrl={h.avatarUrl ?? null} name={h.displayName} className="housing-housinger-row-avatar" />
                  <span className="housing-housinger-row-text">
                    <span className="housing-housinger-row-name">{h.displayName}</span>
                    {h.bio && <span className="housing-housinger-row-bio">{h.bio}</span>}
                  </span>
                  <span className="housing-housinger-row-thumbs">
                    {(thumbsByOwner.get(h.uid) ?? []).map((src, k) => (
                      <img key={k} src={src} alt="" loading="lazy" decoding="async" />
                    ))}
                  </span>
                </Link>
              </Fragment>
            );
          })}
        </>
      )}
    </div>
  );
};
