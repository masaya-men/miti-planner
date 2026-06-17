import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui/Tooltip';
import { computeConflictArrows, type ConflictPoint, type ArrowDescriptor } from './conflictArrows';

interface Props {
    /** 競合中インスタンスの位置情報(親が timelineMitigations + conflictingIds + レイアウトから算出) */
    points: ConflictPoint[];
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

/** 矢印ボタンの直径 */
const ARROW_SIZE = 24;
/** ビューポート端からのマージン */
const EDGE_MARGIN = 4;

/**
 * 競合相手が画面外にあるとき、その列の上端(∧)/下端(∨)に黄色脈動の矢印を出す。
 * クリックでその競合まで自動スクロール。PC タイムライン専用。
 *
 * 実装メモ:
 *   - 親が `position: sticky; top: 0; height: 0; overflow: visible` なコンテナで包む。
 *   - 上矢印は top = EDGE_MARGIN
 *   - 下矢印は top = viewportHeight - ARROW_SIZE - EDGE_MARGIN (= ビューポート下端から逆算)
 *   - いずれも sticky コンテナ(top: 0 固定)を基準とするため、スクロールと一緒に流れない。
 */
export function ConflictOffscreenArrows({ points, scrollContainerRef }: Props) {
    const { t } = useTranslation();
    const [arrows, setArrows] = useState<ArrowDescriptor[]>([]);
    const [viewportHeight, setViewportHeight] = useState(0);
    const rafRef = useRef(0);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const recompute = () => {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                setViewportHeight(el.clientHeight);
                setArrows(computeConflictArrows(points, {
                    scrollTop: el.scrollTop,
                    viewportHeight: el.clientHeight,
                }));
            });
        };
        recompute();
        el.addEventListener('scroll', recompute, { passive: true });
        const ro = new ResizeObserver(recompute);
        ro.observe(el);
        return () => {
            cancelAnimationFrame(rafRef.current);
            el.removeEventListener('scroll', recompute);
            ro.disconnect();
        };
    }, [points, scrollContainerRef]);

    const onClick = (a: ArrowDescriptor) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        el.scrollTo({ top: Math.max(0, a.targetY - el.clientHeight / 2), behavior: 'smooth' });
    };

    // viewportHeight が 0 の間は描画しない。
    // 初回レンダー時に clientHeight が未確定のため、下矢印が top:-28px で画面外上端に一瞬出るのを防ぐ。
    if (viewportHeight === 0) return null;

    return (
        <>
            {arrows.map(a => {
                // sticky コンテナ (height: 0, top: 0) を基準に top 値を決定。
                // 下矢印は「ビューポート高さ - ボタン径 - マージン」にして下端に貼り付ける。
                const topPx = a.direction === 'up'
                    ? EDGE_MARGIN
                    : viewportHeight - ARROW_SIZE - EDGE_MARGIN;
                const label = a.direction === 'up'
                    ? t('mitigation.conflict_above', { defaultValue: '競合あり (上へ)' })
                    : t('mitigation.conflict_below', { defaultValue: '競合あり (下へ)' });
                return (
                    // 外側 div が列中央 (a.x) への中央寄せ (-translate-x-1/2) を担う。
                    // 脈動 (scale) はボタン側にかけるので中央寄せと干渉しない。
                    <div
                        key={a.key}
                        className="absolute z-30 -translate-x-1/2"
                        style={{ left: a.x, top: topPx }}
                    >
                        <Tooltip content={label} wrapperClassName="pointer-events-auto">
                            <button
                                type="button"
                                onClick={() => onClick(a)}
                                aria-label={label}
                                className="animate-conflict-arrow-pulse flex items-center justify-center w-6 h-6 cursor-pointer text-amber-500 hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200"
                            >
                                {/* 太めのシェブロンのみ。グローはテーマ別 (.conflict-chevron / index.css) */}
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                                    aria-hidden="true" className="conflict-chevron">
                                    {a.direction === 'up'
                                        ? <polyline points="5 15 12 8 19 15" />
                                        : <polyline points="5 9 12 16 19 9" />}
                                </svg>
                            </button>
                        </Tooltip>
                    </div>
                );
            })}
        </>
    );
}
