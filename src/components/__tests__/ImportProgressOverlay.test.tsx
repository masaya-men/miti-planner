// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportProgressOverlay } from '../ImportProgressOverlay';

describe('ImportProgressOverlay', () => {
    const baseProps = {
        visible: true,
        percent: 50,
        label: '取り込み中…',
        color: 'blue' as const,
    };

    it('visible=true でラベルとバーが描画される', () => {
        render(<ImportProgressOverlay {...baseProps} />);
        expect(screen.getByTestId('import-progress-overlay')).toBeInTheDocument();
        expect(screen.getByText('取り込み中…')).toBeInTheDocument();
        expect(screen.getByTestId('import-progress-bar-fill')).toBeInTheDocument();
    });

    it('visible=false で何も描画しない', () => {
        const { container } = render(
            <ImportProgressOverlay {...baseProps} visible={false} />,
        );
        expect(container.querySelector('[data-testid="import-progress-overlay"]')).toBeNull();
    });

    it('percent=37 でバー幅が 37% になる', () => {
        render(<ImportProgressOverlay {...baseProps} percent={37} />);
        const fill = screen.getByTestId('import-progress-bar-fill') as HTMLElement;
        expect(fill.style.width).toBe('37%');
    });

    it('percent=-10 でも 0% にクランプされる', () => {
        render(<ImportProgressOverlay {...baseProps} percent={-10} />);
        const fill = screen.getByTestId('import-progress-bar-fill') as HTMLElement;
        expect(fill.style.width).toBe('0%');
    });

    it('percent=150 でも 100% にクランプされる', () => {
        render(<ImportProgressOverlay {...baseProps} percent={150} />);
        const fill = screen.getByTestId('import-progress-bar-fill') as HTMLElement;
        expect(fill.style.width).toBe('100%');
    });

    it('countLabel="3/5" のとき件数表示が出る', () => {
        render(<ImportProgressOverlay {...baseProps} countLabel="3/5" />);
        const count = screen.getByTestId('import-progress-count');
        expect(count.textContent).toBe('3/5');
    });

    it('countLabel 未指定のとき件数表示は出ない (単一取り込み想定)', () => {
        render(<ImportProgressOverlay {...baseProps} />);
        expect(screen.queryByTestId('import-progress-count')).toBeNull();
    });

    it('color="blue" で青バー class が付く', () => {
        render(<ImportProgressOverlay {...baseProps} color="blue" />);
        const fill = screen.getByTestId('import-progress-bar-fill') as HTMLElement;
        expect(fill.className).toContain('bg-app-blue');
    });

    it('color="red" で赤バー class が付く', () => {
        render(<ImportProgressOverlay {...baseProps} color="red" />);
        const fill = screen.getByTestId('import-progress-bar-fill') as HTMLElement;
        expect(fill.className).toContain('bg-app-red');
    });

    it('progressbar role と aria 属性が付く', () => {
        render(<ImportProgressOverlay {...baseProps} percent={42} />);
        const bar = screen.getByRole('progressbar');
        expect(bar.getAttribute('aria-valuenow')).toBe('42');
        expect(bar.getAttribute('aria-valuemin')).toBe('0');
        expect(bar.getAttribute('aria-valuemax')).toBe('100');
    });
});
