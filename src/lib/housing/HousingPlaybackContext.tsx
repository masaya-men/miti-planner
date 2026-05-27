import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    type ReactElement,
    type ReactNode,
} from 'react';
import { useViewportPlaybackPool } from './useViewportPlaybackPool';
import { useSpotlightRotation } from './useSpotlightRotation';
import { useReducedMotion } from './useReducedMotion';
import { useIsScrolling } from './useIsScrolling';
import { selectActivePlayers } from './viewportPlaybackPool';

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

const HousingPlaybackContext = createContext<HousingPlaybackContextValue>(NOOP_CONTEXT);

export function useHousingPlayback(): HousingPlaybackContextValue {
    return useContext(HousingPlaybackContext);
}

export interface HousingPlaybackProviderProps {
    children: ReactNode;
    /**
     * 画面内 spotlight (= 同時動画再生) の上限。 default 1 (Allmarks 流 hero=1)。
     * pool 候補とは別。 候補は viewport ratio>=minRatio を満たすカード全部を入れる
     * (Allmarks コメント参照: pool cap=999 で全 in-view を浮上させ、 spotlight
     * cap=1 で実際に再生する数を絞る)。 同一にすると rotation キューが空になり
     * 「最初に visible だった 1 件」 で固定する。
     */
    spotlightCap?: number;
    /** pool 候補の上限 (= candidate に入れる最大カード数)。 default 999 (= 実質無制限)。 */
    poolCap?: number;
    /** rotation 間隔 ms。 default 15000 (15s、 Allmarks 流)。 */
    intervalMs?: number;
    /** spotlight 入り判定の visibility ratio 下限。 default 0.25。 */
    minRatio?: number;
    /**
     * 詳細モーダル等で一覧再生を一時停止したいときの外部入力。
     * default false。 Task 5 で Zustand store と接続予定。
     */
    lightboxOpen?: boolean;
}

export function HousingPlaybackProvider({
    children,
    spotlightCap = 1,
    poolCap = 999,
    intervalMs = 15000,
    minRatio = 0.25,
    lightboxOpen = false,
}: HousingPlaybackProviderProps): ReactElement {
    const { visibility, register, unregister } = useViewportPlaybackPool();
    const reduced = useReducedMotion();
    const isScrolling = useIsScrolling(150);
    const ambientOn = !reduced && !isScrolling && !lightboxOpen;

    const candidates = useMemo(
        () => new Set(selectActivePlayers(visibility, poolCap, minRatio)),
        [visibility, poolCap, minRatio],
    );
    const effectiveSpotlightCap = ambientOn ? spotlightCap : 0;
    const playing = useSpotlightRotation(candidates, effectiveSpotlightCap, intervalMs);

    const value = useMemo<HousingPlaybackContextValue>(
        () => ({ playing, ambientOn, register, unregister }),
        [playing, ambientOn, register, unregister],
    );

    return (
        <HousingPlaybackContext.Provider value={value}>
            {children}
        </HousingPlaybackContext.Provider>
    );
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
