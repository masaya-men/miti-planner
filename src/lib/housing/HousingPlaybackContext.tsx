import {
    useMemo,
    type ReactElement,
    type ReactNode,
} from 'react';
import { useViewportPlaybackPool } from './useViewportPlaybackPool';
import { useSpotlightRotation } from './useSpotlightRotation';
import { useReducedMotion } from './useReducedMotion';
import { useIsScrolling } from './useIsScrolling';
import { selectActivePlayers } from './viewportPlaybackPool';
import { HousingPlaybackContext, type HousingPlaybackContextValue } from './housingPlaybackState';

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

/**
 * ギャラリー ambient (スポットライト再生 + フレーム抽出) の ON/OFF スイッチ。
 * 2026-05-29: Twitter 動画プロキシを Cloudflare Worker (media.lopoly.app) に移設し、
 * 動画バイトが Vercel の Fast Origin Transfer を消費しなくなったため、止血で OFF に
 * していた ambient を ON に復帰。動画は buildTweetVideoProxyUrl 経由で CF を通る。
 */
const GALLERY_AMBIENT_ENABLED = true;

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
    const ambientOn = GALLERY_AMBIENT_ENABLED && !reduced && !isScrolling && !lightboxOpen;

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

