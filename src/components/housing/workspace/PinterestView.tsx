/**
 * Phase 3: 物件カードグリッド (Allmarks 流 masonry)
 *
 * - computeHousingMasonry で各カードの絶対座標を計算 (最短列・高さ=幅÷縦横比)
 * - 画面内+上下バッファだけ描画 (windowing) → 画面外は描画/画像読込/動画再生なし
 * - 位置変化は el.animate の FLIP でスライド。新規は登場、削除はフェードアウト。
 * - reduced-motion 時はアニメ無しで即配置。
 *
 * クリックで /housing/listing/:id へ (背景に一覧を残すモーダル遷移)。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { MockListing } from '../../../data/housing/mockListings';
import { HousingCard } from './HousingCard';
import { computeHousingMasonry, type MasonryPosition } from '../../../lib/housing/computeHousingMasonry';
import { resolveCoverAspectRatio } from '../../../lib/housing/resolveCoverAspectRatio';
import { useReducedMotion } from '../../../lib/housing/useReducedMotion';

const GAP = 12;
const TARGET_COLUMN_UNIT = 220; // 列数の目安幅 (2〜4 列、実機で微調整可)
const REFLOW_MS = 300;
const ENTER_MS = 300;
const EXIT_MS = 200; // .housing-pinterest-item--exiting の CSS animation と一致させること
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export interface PinterestViewProps {
    listings: MockListing[];
    /** 旧 /housing/p/:id 用。Phase 3 では未使用。 */
    initialExpandedId?: string;
}

interface ExitingCard extends MasonryPosition {
    listing: MockListing;
}

export const PinterestView: React.FC<PinterestViewProps> = ({ listings }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const reduceMotion = useReducedMotion();

    const openDetail = useCallback(
        (id: string) => {
            navigate(`/housing/listing/${id}`, { state: { backgroundLocation: location } });
        },
        [navigate, location],
    );

    const gridRef = useRef<HTMLDivElement | null>(null);
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const prevPosRef = useRef<Record<string, MasonryPosition>>({});
    const prevIdsRef = useRef<Set<string>>(new Set());
    const prevVisibleIdsRef = useRef<Set<string>>(new Set());
    const lastListingByIdRef = useRef<Record<string, MockListing>>({});
    const exitTimersRef = useRef<number[]>([]);

    const [containerWidth, setContainerWidth] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportH, setViewportH] = useState(0);
    const [exiting, setExiting] = useState<ExitingCard[]>([]);

    // スクロール祖先 (.housing-center-area-scroll) を測定根にする。
    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        const scrollEl = grid.closest('.housing-center-area-scroll') as HTMLElement | null;
        if (!scrollEl) return;

        const measure = () => {
            const cs = window.getComputedStyle(grid);
            const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            setContainerWidth(Math.max(0, grid.clientWidth - padX));
            setViewportH(scrollEl.clientHeight);
        };
        measure();
        setScrollTop(scrollEl.scrollTop);

        const ro = new ResizeObserver(measure);
        ro.observe(grid);
        ro.observe(scrollEl);

        let raf = 0;
        const onScroll = () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                raf = 0;
                setScrollTop(scrollEl.scrollTop);
            });
        };
        scrollEl.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            ro.disconnect();
            scrollEl.removeEventListener('scroll', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, []);

    // アンマウント時に未処理の削除フェードタイマーを全クリア。
    useEffect(() => () => {
        for (const t of exitTimersRef.current) clearTimeout(t);
        exitTimersRef.current = [];
    }, []);

    const masonry = useMemo(() => {
        const cards = listings.map((l) => ({ id: l.id, aspectRatio: resolveCoverAspectRatio(l) }));
        return computeHousingMasonry({ cards, containerWidth, gap: GAP, targetColumnUnit: TARGET_COLUMN_UNIT });
    }, [listings, containerWidth]);

    // windowing: 可視 Y 範囲 + 上下 1 画面分バッファに交差するカードだけ描画。
    const visibleListings = useMemo(() => {
        if (containerWidth <= 0 || viewportH <= 0) return listings; // 未測定の初回は全件 (1 フレームのみ)
        const buffer = viewportH;
        const minY = scrollTop - buffer;
        const maxY = scrollTop + viewportH + buffer;
        return listings.filter((l) => {
            const p = masonry.positions[l.id];
            if (!p) return false;
            return !(p.y + p.h < minY || p.y > maxY);
        });
    }, [listings, masonry, scrollTop, viewportH, containerWidth]);

    // 配置適用 + FLIP + 登場 + 削除検出。すべてを 1 つの useLayoutEffect に集約し、
    // 台帳 GC が削除フェードの座標読み出しより先に走るバグを防ぐ。
    useLayoutEffect(() => {
        const currentIds = new Set(listings.map((l) => l.id));

        // 1. 削除検出: 前回 id にあって今回無い → 直前座標でフェードアウト用に積む。
        if (!reduceMotion) {
            const removed: ExitingCard[] = [];
            for (const id of prevIdsRef.current) {
                if (currentIds.has(id)) continue;
                const pos = prevPosRef.current[id];
                const listing = lastListingByIdRef.current[id];
                if (pos && listing) removed.push({ listing, ...pos });
            }
            if (removed.length > 0) {
                setExiting((cur) => [...cur, ...removed]);
                const ids = new Set(removed.map((r) => r.listing.id));
                const timer = window.setTimeout(() => {
                    setExiting((cur) => cur.filter((c) => !ids.has(c.listing.id)));
                }, EXIT_MS);
                exitTimersRef.current.push(timer);
            }
        }

        // 2. 可視カードに位置を適用 + アニメ。
        for (const l of visibleListings) {
            const el = cardRefs.current[l.id];
            const p = masonry.positions[l.id];
            if (!el || !p) continue;
            const prev = prevPosRef.current[l.id];

            const wasVisible = prevVisibleIdsRef.current.has(l.id);
            if (prev && (prev.x !== p.x || prev.y !== p.y)) {
                // 前サイクルで実際に見えていたカードだけ FLIP スライド。
                // 画面外にいた間に並びが変わったカードは、再描画時に古い座標から
                // 滑ってくる誤演出になるので、その場合はアニメなしで即配置。
                if (!reduceMotion && wasVisible) {
                    el.animate(
                        [
                            { transform: `translate(${prev.x - p.x}px, ${prev.y - p.y}px)` },
                            { transform: 'translate(0, 0)' },
                        ],
                        { duration: REFLOW_MS, easing: EASING, fill: 'none' },
                    );
                }
            } else if (!prev) {
                const isNew = !prevIdsRef.current.has(l.id);
                if (isNew && !reduceMotion) {
                    el.animate(
                        [
                            { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
                            { opacity: 1, transform: 'translateY(0) scale(1)' },
                        ],
                        { duration: ENTER_MS, easing: EASING, fill: 'none' },
                    );
                } else if (isNew && reduceMotion) {
                    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out', fill: 'none' });
                }
                // それ以外 (prev 無し & 既存 id = windowing 流入) → アニメなしで即配置。
            }

            prevPosRef.current[l.id] = p;
        }

        // 3. 台帳更新 + GC (現在の listing 以外の座標エントリを削除)。
        prevIdsRef.current = currentIds;
        const nextMap: Record<string, MockListing> = {};
        for (const l of listings) nextMap[l.id] = l;
        lastListingByIdRef.current = nextMap;
        for (const id of Object.keys(prevPosRef.current)) {
            if (!currentIds.has(id)) delete prevPosRef.current[id];
        }
        prevVisibleIdsRef.current = new Set(visibleListings.map((l) => l.id));
    }, [visibleListings, masonry, listings, reduceMotion]);

    return (
        <div ref={gridRef} className="housing-pinterest-grid" style={{ height: `${masonry.totalHeight}px` }}>
            {visibleListings.map((l) => {
                const p = masonry.positions[l.id];
                if (!p) return null;
                return (
                    <div
                        key={l.id}
                        ref={(el) => { cardRefs.current[l.id] = el; }}
                        className="housing-pinterest-item"
                        style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.h}px` }}
                    >
                        <HousingCard listing={l} onClick={() => openDetail(l.id)} />
                    </div>
                );
            })}
            {exiting.map((c) => (
                <div
                    key={`exit-${c.listing.id}`}
                    className="housing-pinterest-item housing-pinterest-item--exiting"
                    style={{ left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` }}
                >
                    <HousingCard listing={c.listing} onClick={() => {}} />
                </div>
            ))}
        </div>
    );
};
