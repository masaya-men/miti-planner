// 色で探す: 登録・編集のあとに、代表の写真から色を計算してサーバーに送る(失敗しても登録・編集は成功のまま)。
import { colorsFromBase64, colorsFromImageUrl, representativeUrlForColors, type ListingColors } from './housingColorFromUrl';
import { isColorComputed } from './housingColorFilter';
import { setListingColors } from '../../housingApiClient';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';

type ColorSourceListing = Parameters<typeof representativeUrlForColors>[0] & Parameters<typeof isColorComputed>[0];

/** 登録の画面を待たせすぎない上限。越えたら色なしで登録(あとで管理画面の取り直しが拾う)。 */
const REGISTRATION_COLOR_BUDGET_MS = 6000;

function withBudget<T>(p: Promise<T>, fallback: T): Promise<T> {
    return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), REGISTRATION_COLOR_BUDGET_MS))]);
}

/**
 * 登録の直前に、登録する代表の写真から色を計算する。
 * sns(X・YouTube・OGP)は画像 URL から、直接アップロードは手元の元ファイル(base64)から。読めなければ null。
 */
export function computeRegistrationColors(
    draft: { imageMode?: string; ogImageUrl?: string },
    localImages: ReadonlyArray<{ base64: string; mimeType: string }>,
): Promise<ListingColors | null> {
    if (draft.imageMode === 'sns' && draft.ogImageUrl) return withBudget(colorsFromImageUrl(draft.ogImageUrl), null);
    if (localImages.length > 0) return withBudget(colorsFromBase64(localImages[0].base64, localImages[0].mimeType), null);
    return Promise.resolve(null);
}

/** 手元の一覧(公開 + マイ)の同じ家に、計算した色を重ねる(Firestore は読まない)。 */
export function patchListingColorsInStore(id: string, colors: ListingColors): void {
    const s = useHousingListingsStore.getState();
    const target = s.listings.find((l) => l.id === id) ?? s.myListings.find((l) => l.id === id);
    if (target) s.upsert({ ...target, ...colors });
}

/**
 * 手元の一覧にある家の色が未計算(または古い決まり)なら、代表の写真から計算して保存する。
 * 編集のあと・家主が編集ページを開いた時に呼ぶ。写真が読めない・保存に失敗した時は何もしない(null)。
 */
export async function ensureListingColors(
    listingId: string,
    known?: ColorSourceListing,
): Promise<ListingColors | null> {
    const s = useHousingListingsStore.getState();
    const listing: ColorSourceListing | undefined =
        s.listings.find((l) => l.id === listingId) ?? s.myListings.find((l) => l.id === listingId) ?? known;
    if (!listing || isColorComputed(listing)) return null;
    const url = representativeUrlForColors(listing);
    if (!url) return null;
    const colors = await colorsFromImageUrl(url);
    if (!colors) return null;
    try {
        await setListingColors(listingId, colors);
    } catch {
        return null;
    }
    patchListingColorsInStore(listingId, colors);
    return colors;
}
