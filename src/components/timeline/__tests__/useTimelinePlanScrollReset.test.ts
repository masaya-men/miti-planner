// @vitest-environment happy-dom
/**
 * プランを切り替えた直後の 1 回目の描画で、もう切り替え後の「空の行は隠す」を返すかの見張り(2026-10-28)。
 * 前は描いた後(useEffect)にストアを書き換えていたため、切り替え直後の 1 回は前の値(「出す」)で全行を描いていた。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimelinePlanScrollReset } from '../useTimelineScrollSync';
import { usePlanStore } from '../../../store/usePlanStore';
import { useTutorialStore } from '../../../store/useTutorialStore';

const plan = (id: string, n: number) => ({ id, data: { timelineEvents: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}` })) } });

beforeEach(() => {
    usePlanStore.setState({ plans: [plan('empty', 0), plan('full', 3)] as never });
    useTutorialStore.setState({ isActive: false });
});

describe('useTimelinePlanScrollReset の戻り値', () => {
    it('空のプラン(出す)→中身のあるプランへ切り替えた最初の描画で「隠す」を返す', () => {
        const seen: boolean[] = [];
        const { rerender } = renderHook(
            ({ id, stored }: { id: string; stored: boolean }) => {
                const v = useTimelinePlanScrollReset({ scrollContainerRef: { current: null }, currentPlanId: id, joinerRoomToken: null, hideEmptyRows: stored });
                seen.push(v);
                return v;
            },
            { initialProps: { id: 'empty', stored: false } },
        );
        seen.length = 0;
        rerender({ id: 'full', stored: false }); // ストアはまだ「出す」のまま
        expect(seen[0]).toBe(true);
    });

    it('切り替えが済んだ後は、ストアの値(利用者の切り替え)に従う', () => {
        const { result, rerender } = renderHook(
            ({ stored }: { stored: boolean }) => useTimelinePlanScrollReset({ scrollContainerRef: { current: null }, currentPlanId: 'full', joinerRoomToken: null, hideEmptyRows: stored }),
            { initialProps: { stored: true } },
        );
        rerender({ stored: false }); // 利用者が「出す」を押した
        expect(result.current).toBe(false);
    });

    it('空のプランを開いた最初の描画で「出す」を返す(軽減を置く時刻を見せる・今までどおり)', () => {
        const { result } = renderHook(() => useTimelinePlanScrollReset({ scrollContainerRef: { current: null }, currentPlanId: 'empty', joinerRoomToken: null, hideEmptyRows: true }));
        expect(result.current).toBe(false);
    });

    it('チュートリアル中はストアの値をそのまま使う', () => {
        useTutorialStore.setState({ isActive: true });
        const { result } = renderHook(() => useTimelinePlanScrollReset({ scrollContainerRef: { current: null }, currentPlanId: 'full', joinerRoomToken: null, hideEmptyRows: false }));
        expect(result.current).toBe(false);
    });
});
