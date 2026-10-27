/**
 * マイページ (本人閲覧時のみ) の OGP 代表作・背景の選択と即時保存。
 *
 * - 代表作の初期値: profile.ogRepresentativeListingIds があればそれ、無ければ新着順上位10件を
 *   自動採用 (spec: 何もしなくてもシェアできる状態にする)。
 * - 背景の初期値: profile.ogBackgroundListingId。未設定なら null
 *   (代表作の先頭が自動的に背景として使われる、既存フォールバック)。
 * - 保存に失敗したら選択を元に戻してトーストを出す。
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { upsertHousingerProfile } from '../../../lib/housing/housingerProfileService';
import { isEligibleForOgRepresentative } from '../../../lib/housing/listingPublish';
import { showToast } from '../../Toast';
import type { HousingerProfile } from '../../../types/housing';
import type { MockListing } from '../../../data/housing/mockListings';

export function useOgRepresentativeSelection(
  isSelf: boolean,
  profile: HousingerProfile | null,
  listings: MockListing[],
) {
  const { t } = useTranslation();
  const [ogSelectionIds, setOgSelectionIds] = useState<string[]>([]);
  useEffect(() => {
    if (!isSelf) return;
    const saved = profile?.ogRepresentativeListingIds;
    if (saved && saved.length > 0) {
      setOgSelectionIds(saved);
      return;
    }
    const nowMs = Date.now();
    const defaultIds = [...listings]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((l) => isEligibleForOgRepresentative(l, nowMs))
      .slice(0, 10)
      .map((l) => l.id);
    setOgSelectionIds(defaultIds);
  }, [isSelf, profile?.ogRepresentativeListingIds, listings]);

  const [ogBackgroundId, setOgBackgroundId] = useState<string | null>(null);
  useEffect(() => {
    if (!isSelf) return;
    setOgBackgroundId(profile?.ogBackgroundListingId ?? null);
  }, [isSelf, profile?.ogBackgroundListingId]);

  const ogSelectionSet = useMemo(() => new Set(ogSelectionIds), [ogSelectionIds]);

  const toggleOgSelect = async (id: string) => {
    const target = listings.find((l) => l.id === id);
    if (!target) return;
    const isSelected = ogSelectionIds.includes(id);
    if (!isSelected && !isEligibleForOgRepresentative(target, Date.now())) {
      showToast(t('housing.housinger.ogSelect.publicOnly'), 'error');
      return;
    }
    if (!isSelected && ogSelectionIds.length >= 10) {
      showToast(t('housing.housinger.ogSelect.maxReached'), 'error');
      return;
    }
    const previousSelection = ogSelectionIds;
    const previousBackground = ogBackgroundId;
    const next = isSelected ? ogSelectionIds.filter((x) => x !== id) : [...ogSelectionIds, id];
    // 背景に指定していたカードを代表作から外す場合は、背景指定も一緒に解除する
    // (外れたlistingが背景のまま残ると、次回描画時にサーバー側フォールバックで無視されるだけで
    // 見た目には問題ないが、UI上の状態としては矛盾するため明示的に解除する)。
    const clearsBackground = isSelected && ogBackgroundId === id;
    setOgSelectionIds(next);
    if (clearsBackground) setOgBackgroundId(null);
    const result = await upsertHousingerProfile({
      ogRepresentativeListingIds: next,
      ...(clearsBackground ? { ogBackgroundListingId: null } : {}),
    });
    if (!result.ok) {
      setOgSelectionIds(previousSelection);
      if (clearsBackground) setOgBackgroundId(previousBackground);
      showToast(t('housing.housinger.account.toastError'), 'error');
    }
  };

  const toggleOgBackground = async (id: string) => {
    if (!ogSelectionIds.includes(id)) return;
    const previous = ogBackgroundId;
    const next = ogBackgroundId === id ? null : id;
    setOgBackgroundId(next);
    const result = await upsertHousingerProfile({ ogRepresentativeListingIds: ogSelectionIds, ogBackgroundListingId: next });
    if (!result.ok) {
      setOgBackgroundId(previous);
      showToast(t('housing.housinger.account.toastError'), 'error');
    }
  };

  return { ogSelectionSet, ogBackgroundId, toggleOgSelect, toggleOgBackground };
}
