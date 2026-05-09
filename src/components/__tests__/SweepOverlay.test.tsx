// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SweepOverlay } from '../SweepOverlay';

describe('SweepOverlay', () => {
    it('status="idle" のとき width: 0% で描画する', () => {
        const { container } = render(<SweepOverlay status="idle" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('0%');
    });

    it('status="active" のとき width: 100% で transition 付きで描画する', () => {
        const { container } = render(<SweepOverlay status="active" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('100%');
        expect(el.style.transition).toContain('1200ms');
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
