import { useCallback, useRef, useState } from 'react';
import {
  fetchAllmarksShareUrls,
  resolveHousingAddressFromUrl,
} from './allmarksImport';
import { housingExtractResultToAddressPatch } from './housingExtractResultToAddressPatch';
import { validateEphemeralInput, createEphemeralListing, type EphemeralInput } from './ephemeralListing';
import { useEphemeralListingsStore } from '../../store/useEphemeralListingsStore';
import { regionForDC, type Region } from '../../data/housing/dcServerMap';
import { canAddToTour, regionConflictAmong } from './tourCrossing';
import type { RegisterAddressValues } from '../../components/housing/register/RegisterSectionAddress';

/** 一度に並行して処理する件数。外部サービス(Twitter/YouTube等)への負荷と速さのバランス。 */
const CONCURRENCY = 2;

export type AllmarksImportStatus = 'idle' | 'fetching-list' | 'importing' | 'choosing-region' | 'done';

export interface AllmarksRegionChoice {
  region: Region;
  count: number;
}

export interface AllmarksImportProgress {
  status: AllmarksImportStatus;
  /** 共有に含まれていた件数(取得前は0)。 */
  total: number;
  /** ここまでに処理し終えた件数(成功・失敗・上限到達での打ち切り、すべて含む)。 */
  processed: number;
  added: number;
  failed: number;
  /** 一時ツアーの上限 (EPHEMERAL_POOL_LIMIT) に達して途中で打ち切ったか。 */
  limitReached: boolean;
  /** 共有そのものが見つからなかった(期限切れ/不正なリンク)。 */
  shareNotFound: boolean;
  /** status='choosing-region' のときだけ非空。 混在したリージョンごとの件数。 */
  regionChoices: AllmarksRegionChoice[];
  /** リージョン選択で除外された件数(選択後の done でのみ意味を持つ)。 */
  regionExcluded: number;
}

const IDLE_PROGRESS: AllmarksImportProgress = {
  status: 'idle',
  total: 0,
  processed: 0,
  added: 0,
  failed: 0,
  limitReached: false,
  shareNotFound: false,
  regionChoices: [],
  regionExcluded: 0,
};

/** address patch (RegisterSectionAddress 相当) が EphemeralInput を組み立てられる完全な状態か。 */
function isCompleteAddress(a: RegisterAddressValues): boolean {
  const isHouse = a.buildingType === 'house';
  const isApartment = a.buildingType === 'apartment';
  return (
    a.dc !== undefined && a.dc !== '' &&
    a.server !== undefined && a.server !== '' &&
    a.area !== undefined && a.area !== '' &&
    a.ward !== undefined &&
    (isHouse ? a.plot !== undefined : isApartment ? a.roomNumber !== undefined : false)
  );
}

/**
 * Allmarks共有リンクからの一時ツアー一括インポートを行う (2026-08-19)。
 * `EphemeralAddPanel.tsx` の「+ 住所から追加」1件ずつのフローと同じ判定・同じ一時プールを、
 * URLの配列に対してループで実行する。
 *
 * リージョン跨ぎの扱い(2026-08-19 追記): 空の一時ツアーから始めたときは、取り込み中は
 * リージョンでブロックせず見つかった順にすべて追加する(従来通りの「増えていく」体験を維持)。
 * 全件処理し終えた時点で実際に混在リージョンがあれば `status: 'choosing-region'` に遷移し、
 * `chooseRegion()` で選ばれなかった方だけを後から取り消す。 既にツアーに家がある状態(=
 * `initialTrayRegion` が非null)で始めたときは、リージョンはもう決まっているため従来通り
 * その場でブロックする(選択肢は出さない)。
 */
export function useAllmarksImport() {
  const [progress, setProgress] = useState<AllmarksImportProgress>(IDLE_PROGRESS);
  const cancelledRef = useRef(false);
  /** 空のツアーから始めたときに、追加した各アイテムの id とリージョンを覚えておく。
   * 全件処理後の混在判定・`chooseRegion` での取り消しに使う。 */
  const addedItemsRef = useRef<{ id: string; region: Region }[]>([]);

  /** インポート中に「やめる」/完了後に「閉じる」どちらからも呼ぶ。進行中のループがあれば
   * その場で止め(以降 setProgress しない)、状態を idle に戻す。ここまで追加済みの分は
   * 一時ツアーに残る(取り消さない・「やめる」は追加分の巻き戻しではない)。 */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setProgress(IDLE_PROGRESS);
  }, []);

  const start = useCallback(async (shareId: string, initialTrayRegion: Region | null, onAdd: (id: string) => void) => {
    cancelledRef.current = false;
    addedItemsRef.current = [];
    setProgress({ ...IDLE_PROGRESS, status: 'fetching-list' });

    const urls = await fetchAllmarksShareUrls(shareId);
    if (cancelledRef.current) return;
    if (urls.length === 0) {
      setProgress({ ...IDLE_PROGRESS, status: 'done', shareNotFound: true });
      return;
    }

    setProgress({ ...IDLE_PROGRESS, status: 'importing', total: urls.length });

    const startedEmpty = initialTrayRegion === null;
    let added = 0;
    let failed = 0;
    let processed = 0;
    let limitReached = false;
    let stop = false;

    const runOne = async (url: string) => {
      if (stop || cancelledRef.current) return;
      const resolved = await resolveHousingAddressFromUrl(url);
      if (stop || cancelledRef.current) return;

      const patch = resolved ? housingExtractResultToAddressPatch(resolved.result) : null;
      if (!patch || !isCompleteAddress(patch)) {
        failed += 1;
      } else {
        const candidateRegion = patch.dc ? regionForDC(patch.dc) : null;
        // 空のツアーから始めたときはリージョンでブロックしない(後で choosing-region で聞く)。
        const crossRegionBlocked =
          !startedEmpty && initialTrayRegion != null && candidateRegion != null &&
          !canAddToTour(initialTrayRegion, candidateRegion);
        if (crossRegionBlocked) {
          failed += 1;
        } else {
          const isApartment = patch.buildingType === 'apartment';
          const input: EphemeralInput = {
            area: patch.area as EphemeralInput['area'],
            ward: patch.ward as number,
            buildingType: isApartment ? 'apartment' : 'house',
            plot: isApartment ? undefined : patch.plot,
            size: !isApartment && (patch.size === 'S' || patch.size === 'M' || patch.size === 'L') ? patch.size : undefined,
            apartmentBuilding: isApartment ? (patch.apartmentBuilding ?? 1) : undefined,
            roomNumber: isApartment ? patch.roomNumber : undefined,
            postUrl: resolved?.source?.postUrl,
            ogImageUrl: resolved?.source?.ogImageUrl,
            sourceImageUrls: resolved?.source?.sourceImageUrls,
            dc: patch.dc,
            server: patch.server,
          };
          const validation = validateEphemeralInput(input);
          if (!validation.ok) {
            failed += 1;
          } else {
            const listing = createEphemeralListing(input);
            const accepted = useEphemeralListingsStore.getState().add(listing);
            if (!accepted) {
              limitReached = true;
              stop = true;
            } else {
              added += 1;
              if (startedEmpty && candidateRegion != null) {
                addedItemsRef.current.push({ id: listing.id, region: candidateRegion });
              }
              onAdd(listing.id);
            }
          }
        }
      }
      processed += 1;
      setProgress({
        status: 'importing',
        total: urls.length,
        processed,
        added,
        failed,
        limitReached,
        shareNotFound: false,
        regionChoices: [],
        regionExcluded: 0,
      });
    };

    // CONCURRENCY 件ずつ並行実行するシンプルなワーカープール(外部ライブラリ不使用)。
    let cursor = 0;
    const worker = async () => {
      while (!stop && !cancelledRef.current) {
        const i = cursor;
        cursor += 1;
        if (i >= urls.length) return;
        await runOne(urls[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, () => worker()));

    if (cancelledRef.current) return;

    const conflict = startedEmpty ? regionConflictAmong(addedItemsRef.current.map((i) => i.region)) : null;
    if (conflict) {
      const regionChoices: AllmarksRegionChoice[] = conflict.map((region) => ({
        region: region as Region,
        count: addedItemsRef.current.filter((i) => i.region === region).length,
      }));
      setProgress({
        status: 'choosing-region',
        total: urls.length,
        processed,
        added,
        failed,
        limitReached,
        shareNotFound: false,
        regionChoices,
        regionExcluded: 0,
      });
      return;
    }

    setProgress({
      status: 'done',
      total: urls.length,
      processed,
      added,
      failed,
      limitReached,
      shareNotFound: false,
      regionChoices: [],
      regionExcluded: 0,
    });
  }, []);

  /** `choosing-region` の選択肢からユーザーが1つ選んだあとに呼ぶ。選ばれなかったリージョンの
   * アイテムを一時ツアーから取り消し、`status: 'done'` に確定する。 */
  const chooseRegion = useCallback((chosenRegion: Region) => {
    const items = addedItemsRef.current;
    const kept = items.filter((i) => canAddToTour(chosenRegion, i.region));
    const excluded = items.filter((i) => !canAddToTour(chosenRegion, i.region));
    excluded.forEach((i) => useEphemeralListingsStore.getState().remove(i.id));
    addedItemsRef.current = kept;
    setProgress((prev) => ({
      ...prev,
      status: 'done',
      added: kept.length,
      regionExcluded: excluded.length,
      regionChoices: [],
    }));
  }, []);

  return { progress, start, cancel, chooseRegion };
}
