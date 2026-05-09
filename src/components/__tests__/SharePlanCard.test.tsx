// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SharePlanCard } from '../SharePlanCard';

describe('SharePlanCard', () => {
    const baseProps = {
        title: 'P1 P2 終了後',
        subtitle: '最終 2 日前',
        isActive: false,
        isChecked: true,
        showCheckbox: true,
        onClickRow: vi.fn(),
        onToggleCheck: vi.fn(),
    };

    it('title と subtitle を描画する', () => {
        render(<SharePlanCard {...baseProps} />);
        expect(screen.getByText('P1 P2 終了後')).toBeInTheDocument();
        expect(screen.getByText('最終 2 日前')).toBeInTheDocument();
    });

    it('showCheckbox=true のときチェックボックスを表示する', () => {
        render(<SharePlanCard {...baseProps} />);
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('showCheckbox=false のときチェックボックスを表示しない', () => {
        render(<SharePlanCard {...baseProps} showCheckbox={false} />);
        expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('行ボディクリックで onClickRow が呼ばれる', () => {
        const onClickRow = vi.fn();
        render(<SharePlanCard {...baseProps} onClickRow={onClickRow} />);
        fireEvent.click(screen.getByText('P1 P2 終了後'));
        expect(onClickRow).toHaveBeenCalledTimes(1);
    });

    it('チェックボックスクリックでは onToggleCheck のみ呼ばれ、 onClickRow は呼ばれない', () => {
        const onClickRow = vi.fn();
        const onToggleCheck = vi.fn();
        render(
            <SharePlanCard
                {...baseProps}
                onClickRow={onClickRow}
                onToggleCheck={onToggleCheck}
            />,
        );
        fireEvent.click(screen.getByRole('checkbox'));
        expect(onToggleCheck).toHaveBeenCalledTimes(1);
        expect(onClickRow).not.toHaveBeenCalled();
    });

    it('isActive=true のときアクティブスタイル class を付与する', () => {
        const { container } = render(<SharePlanCard {...baseProps} isActive={true} />);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('active');
    });
});
