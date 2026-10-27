/**
 * ハウジンガーページ (HousingerPage) のプロフィールとハウジング一覧の取得。
 *
 * - profile と一覧を別々に取得し、 届いた方から表示する (プロフィールが先なら一覧だけダミー表示)。
 * - 同じ人の再訪は前回の一覧を即表示し、 裏で最新を取り直して差し替える。
 *   他人視点 = モジュール内メモリキャッシュ (uid ごと) / 自分視点 = 読み込み済みの myListings ストア。
 * - uid 切替 (同一コンポーネントのまま :uid だけ変わる遷移) 時は前の人のプロフィール/一覧を
 *   保持したまま表示しない (useHousingerProfile の stale 対策と同じ理由で fetch 開始前に必ず
 *   null/空へ戻す)。
 * - 本人のときだけ myListings ストア (公開/住所非公開/完全非公開すべて) を使う。
 *   他人閲覧時は getHousingerListingsWithHidden (公開分+運営非表示の帯カード) のまま不変。
 */
import { useEffect, useState } from 'react';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import {
  getHousingerProfile,
  getHousingerListingsWithHidden,
} from '../../../lib/housing/housingerProfileService';
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';
import { sortListingsForGallery } from '../../../lib/housing/sortListingsForGallery';
import {
  getCachedHousingerListings,
  setCachedHousingerListings,
} from '../../../lib/housing/housingerListingsCache';
import type { HousingerProfile } from '../../../types/housing';
import type { MockListing } from '../../../data/housing/mockListings';

export function useHousingerPageData(uid: string | undefined, isSelf: boolean) {
  const [profile, setProfile] = useState<HousingerProfile | null>(null);
  const [listings, setListings] = useState<MockListing[]>([]);
  // 運営非表示の家 (他人閲覧時のみ・帯カード表示専用。ツアー等の対象には使わない)。
  const [hiddenListings, setHiddenListings] = useState<MockListing[]>([]);
  // プロフィール取得中 / 家一覧取得中を分ける (プロフィールが先に届いたら先に出す)。
  const [profileLoading, setProfileLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setListings([]);
      setProfileLoading(false);
      setListingsLoading(false);
      return;
    }
    let cancelled = false;
    // uid 切替時、 前の人の profile/一覧を保持したまま表示しない (別人のデータが一瞬出る事故防止)。
    setProfile(null);
    setProfileLoading(true);
    // 同じ人の再訪: 一覧は前回の内容を即表示 (ダミーを出さない) し、裏で最新を取り直して差し替える。
    // いずれも無ければ従来どおり空にしてダミー表示。別 uid の内容は決して使わない (キャッシュは uid ごと・
    // 自分視点のストアは自分の uid のときだけ参照)。
    const cached = isSelf ? undefined : getCachedHousingerListings(uid);
    const selfReady = isSelf && useHousingListingsStore.getState().myStatus === 'ready';
    const hasInstant = Boolean(cached) || selfReady;
    if (cached) {
      setListings(cached.listings);
      setHiddenListings(cached.hiddenListings);
    } else if (selfReady) {
      setListings(sortListingsForGallery(useHousingListingsStore.getState().myListings));
      setHiddenListings([]);
    } else {
      setListings([]);
      setHiddenListings([]);
    }
    setListingsLoading(!hasInstant);

    // どちらかが失敗しても無限ローディングにならないよう、
    // 失敗時は従来どおり unavailable 表示へ縮退する (profile=null・一覧空・両フラグ解除)。
    const degrade = (err: unknown) => {
      if (cancelled) return;
      // getHousingerProfile は自身のエラーを飲み込み null を返すが、getHousingerListings は
      // reject しうる (デプロイ直後の複合インデックス未反映、一時的な Firestore エラー等)。
      console.warn('[HousingerPage] failed to load profile/listings', err);
      setProfile(null);
      setListings([]);
      setHiddenListings([]);
      setProfileLoading(false);
      setListingsLoading(false);
    };
    // 一覧だけの失敗: 即表示済み (キャッシュ/読み込み済みストア) なら表示を維持して警告のみ
    // (「公開されていません」へ縮退させない)。即表示が無かったときは従来どおり縮退する。
    const degradeListings = (err: unknown) => {
      if (cancelled) return;
      if (!hasInstant) {
        degrade(err);
        return;
      }
      console.warn('[HousingerPage] failed to refresh listings (keeping cached view)', err);
      setListingsLoading(false);
    };

    const profilePromise = (isSelf ? getHousingerProfile(uid, { isSelf: true }) : getHousingerProfile(uid)).then((profileResult) => {
      if (cancelled) return;
      setProfile(profileResult);
      setProfileLoading(false);
    });

    const listingsPromise = isSelf
      ? // 自分の場合: 公開/住所非公開/完全非公開すべて (myListings ストア、visibility 問わず)。
        // 他人視点の表示 (getHousingerListings、公開分のみ) はこの分岐に入らない限り不変。
        useHousingListingsStore
          .getState()
          .loadMine(uid)
          .then(() => {
            if (cancelled) return;
            setListings(sortListingsForGallery(useHousingListingsStore.getState().myListings));
            setListingsLoading(false);
          })
      : getHousingerListingsWithHidden(uid).then((listingResult) => {
          if (cancelled) return;
          // 運営非表示の家: 一覧表示専用 (件数・帯カード)。 ツアー/OGP代表作/お気に入り等の対象 (listings) には含めない。
          const hiddenCards = listingResult.hiddenListings
            .map(firestoreToGalleryListing)
            .filter((l): l is MockListing => l !== null)
            .map((l) => ({ ...l, imageMode: 'none' as const, adminHidden: true }));
          const nextListings = sortListingsForGallery(
            listingResult.listings.map(firestoreToGalleryListing).filter((l): l is MockListing => l !== null),
          );
          setCachedHousingerListings(uid, { listings: nextListings, hiddenListings: hiddenCards });
          setHiddenListings(hiddenCards);
          setListings(nextListings);
          setListingsLoading(false);
        });

    profilePromise.catch(degrade);
    listingsPromise.catch(degradeListings);
    return () => {
      cancelled = true;
    };
  }, [uid, isSelf]);

  return { profile, listings, setListings, hiddenListings, profileLoading, listingsLoading };
}
