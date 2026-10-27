import { createContext, useCallback, useContext } from 'react';

/**
 * 2026-05-27 ハウジング動画再生 orchestration (Allmarks 流)。
 *
 * - useViewportPlaybackPool: IntersectionObserver で各カードの visibility ratio 集計
 * - useSpotlightRotation: candidates Set + cap で「画面内 N 本だけ再生」 を 15s ごとに promote
 * - useReducedMotion / useIsScrolling: 動かない条件を集約
 *
 * 結果を context として配り、 HousingCard 系 (HousingCard / RightPanelListItem /
 * MapBubbleCard / FavoriteCard) が register / playing.has(id) / ambientOn を購読する。
 *
 * Provider が無いとき (= テスト等) は no-op default で動く (= 再生なし、 register/unregister は no-op)。
 */
export interface HousingPlaybackContextValue {
    /** spotlight rotation の live メンバー (cap=1 動画 hero)。 */
    playing: ReadonlySet<string>;
    /** ambient slideshow / 動画再生を ON にするか (= !reduced && !isScrolling && !lightboxOpen)。 */
    ambientOn: boolean;
    /** IntersectionObserver 監視対象に追加。 */
    register: (id: string, el: Element) => void;
    /** IntersectionObserver 監視から外し、 visibility map からも消す。 */
    unregister: (id: string) => void;
}

const NOOP_CONTEXT: HousingPlaybackContextValue = {
    playing: new Set(),
    ambientOn: false,
    register: () => {},
    unregister: () => {},
};

export const HousingPlaybackContext = createContext<HousingPlaybackContextValue>(NOOP_CONTEXT);

export function useHousingPlayback(): HousingPlaybackContextValue {
    return useContext(HousingPlaybackContext);
}

/**
 * Card 専用の便宜 hook。 listing.id を渡すと register/unregister の useEffect 用 callback と、
 * 再生フラグを一括で返す。 各カード variant の重複コードを削減する。
 *
 * `isVideo`: 動画 listing (= videoUrl or youtubeVideoId) のみ candidate に入れたい。
 * 2026-05-27 hotfix: 画像 only カードまで register していたため、 candidates に画像 only
 * カードが混入して spotlight slot を奪っていた (= 動画カードが永遠に再生されない)。
 * 動画じゃないカードは register=no-op で pool に乗らない。
 *
 * 旧 hotfix: 旧実装は `ctx` 全体を useCallback deps に入れていたため、 ctx の
 * playing/ambientOn が変わるたびに register 関数が新しくなり、 HousingCard の useEffect が
 * 毎回 cleanup + re-run で「unregister → register」 を繰り返し、 visibility map から id が
 * 消える瞬間に spotlight rotation が候補空と判定して video overlay を unmount してしまう
 * 振動バグがあった。 ctx から register / unregister を destructure することで stable な
 * 関数参照に依存させ、 register callback 自体を mount から unmount まで stable にする
 * (= ctxRegister / ctxUnregister は useViewportPlaybackPool で useCallback([]) 済み)。
 */
export function useHousingCardPlayback(listingId: string, isVideo: boolean): {
    isPlaying: boolean;
    ambientOn: boolean;
    register: (el: Element | null) => void;
} {
    const { playing, ambientOn, register: ctxRegister, unregister: ctxUnregister } =
        useHousingPlayback();
    const register = useCallback(
        (el: Element | null) => {
            if (!isVideo) return;
            if (!el) {
                ctxUnregister(listingId);
                return;
            }
            ctxRegister(listingId, el);
        },
        [listingId, ctxRegister, ctxUnregister, isVideo],
    );
    return {
        isPlaying: playing.has(listingId),
        ambientOn,
        register,
    };
}
