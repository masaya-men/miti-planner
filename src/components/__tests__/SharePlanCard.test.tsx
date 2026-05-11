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

    it('activates row on Enter key', () => {
        const onClickRow = vi.fn();
        render(<SharePlanCard {...baseProps} onClickRow={onClickRow} />);
        const card = screen.getByTestId('share-plan-card');
        card.focus();
        fireEvent.keyDown(card, { key: 'Enter' });
        expect(onClickRow).toHaveBeenCalledTimes(1);
    });

    it('activates row on Space key', () => {
        const onClickRow = vi.fn();
        render(<SharePlanCard {...baseProps} onClickRow={onClickRow} />);
        const card = screen.getByTestId('share-plan-card');
        card.focus();
        fireEvent.keyDown(card, { key: ' ' });
        expect(onClickRow).toHaveBeenCalledTimes(1);
    });

    it('isRedFlagged=true のとき赤背景 class が付く', () => {
        const { container } = render(<SharePlanCard {...baseProps} isRedFlagged={true} />);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('app-red');
    });

    it('isExiting=true のとき退場アニメ wrapper を描画する', () => {
        const { container } = render(<SharePlanCard {...baseProps} isExiting={true} />);
        const card = container.firstChild as HTMLElement;
        expect(card.getAttribute('data-exiting')).toBe('true');
    });

    it('sweepStatus を渡すと SweepOverlay が描画される', () => {
        const { container } = render(
            <SharePlanCard {...baseProps} sweepStatus="active" sweepColor="blue" />,
        );
        const sweep = container.querySelector('[aria-hidden="true"]');
        expect(sweep).toBeTruthy();
    });

    it('sweepStatus 未指定のとき SweepOverlay は描画しない', () => {
        const { container } = render(<SharePlanCard {...baseProps} />);
        const sweep = container.querySelector('[aria-hidden="true"]');
        expect(sweep).toBeNull();
    });

    it('sweepStatus=active かつ isActive=true のとき isActive 青背景は抑制される (#4)', () => {
        // 真因 (#4): 青 sweep (取り込み演出 width 0→100%) と isActive の青背景が
        // 重なって sweep が視認できない問題。 sweep 中は isActive 背景を抑制し、
        // sweep オーバーレイ自体に視覚的主役を譲る。
        const { container } = render(
            <SharePlanCard
                {...baseProps}
                isActive={true}
                sweepStatus="active"
                sweepColor="blue"
            />,
        );
        const card = container.firstChild as HTMLElement;
        // 青背景クラス (bg-app-blue/10) と 'active' クラスが付与されていないこと
        expect(card.className).not.toContain('bg-app-blue');
        expect(card.className).not.toContain('active');
        // sweep 中の plain 背景クラスが付与されていること
        expect(card.className).toContain('bg-app-surface2/30');
    });

    it('sweepStatus=active かつ isRedFlagged=true のとき赤背景は保持される (#4 例外)', () => {
        // 上限ヒット赤フラグ (limit hit reveal 中) は sweep より優先して赤背景を保持。
        // 赤背景 + 青 sweep は色相が異なるため両方視認できる。
        const { container } = render(
            <SharePlanCard
                {...baseProps}
                isRedFlagged={true}
                sweepStatus="active"
                sweepColor="blue"
            />,
        );
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('app-red');
    });

    it('sweepStatus 未指定 + isActive=true は従来通り青背景を維持 (#4 既存挙動保護)', () => {
        // preview 状態など sweep が無いときは元通り isActive 青背景を出す。
        const { container } = render(
            <SharePlanCard {...baseProps} isActive={true} />,
        );
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('active');
        expect(card.className).toContain('bg-app-blue');
    });
});
