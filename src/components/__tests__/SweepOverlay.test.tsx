// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { SweepOverlay } from '../SweepOverlay';

describe('SweepOverlay', () => {
    it('status="idle" のとき width: 0% で描画する', () => {
        const { container } = render(<SweepOverlay status="idle" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('0%');
    });

    it('status="active" は初期 width: 0% で mount し、 次フレームで 100% に flip (#4 fix-2)', async () => {
        // 旧バグ: mount 時に width=100% で出るため CSS transition が値変化を検知できず
        // 0→100% の充填アニメが視認できなかった。
        // 新挙動: useState で 0% で mount → useEffect + rAF で 100% に flip → transition 起動。
        const { container } = render(<SweepOverlay status="active" color="blue" />);
        const el = container.firstChild as HTMLElement;
        // 初期 render は 0% (transition の起点)
        expect(el.style.width).toBe('0%');
        expect(el.style.transition).toContain('1200ms');
        // rAF 後に 100% に flip → transition 発火
        await waitFor(() => {
            expect(el.style.width).toBe('100%');
        });
    });

    it('status="success" のとき width: 100% で transition なし', () => {
        const { container } = render(<SweepOverlay status="success" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('100%');
        expect(el.style.transition).toBe('none');
    });

    it('color="blue" のとき青グラデ背景', () => {
        const { container } = render(<SweepOverlay status="active" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.background).toContain('color-app-blue-dim');
    });

    it('color="red" + status="failed" のとき赤グラデ背景', () => {
        const { container } = render(<SweepOverlay status="failed" color="red" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.background).toContain('color-app-red-dim');
    });

    it('durationMs を渡すと transition の値に反映される', () => {
        const { container } = render(
            <SweepOverlay status="active" color="blue" durationMs={2000} />,
        );
        const el = container.firstChild as HTMLElement;
        expect(el.style.transition).toContain('2000ms');
    });
});
