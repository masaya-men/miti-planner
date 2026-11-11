import { useEffect } from 'react';
import { ensureListingColors } from './housingColorSync';
import { isColorComputed } from './housingColorFilter';

/**
 * 家主が自分の家の編集ページを開いた時に、色が未計算なら自動で補う
 * (非公開・期限切れの家は管理画面の取り直しの対象外のため。持ち主決定 2026-11-12)。
 * 一覧に載っていない家・写真が読めない家は何もしない。
 */
export function useListingColorSync(listing: { id: string; imageMode?: string; ogImageUrl?: string; thumbnailPath?: string; colorFamilies?: string[]; colorRule?: number } | undefined): void {
    const id = listing?.id;
    const done = listing ? isColorComputed(listing) : true;
    useEffect(() => {
        if (!id || done) return;
        void ensureListingColors(id, listing);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- listing は id と done が変わった時だけ見れば足りる
    }, [id, done]);
}
