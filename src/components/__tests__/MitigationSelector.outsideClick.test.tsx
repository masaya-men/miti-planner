// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MitigationSelector } from '../MitigationSelector';
import { useTutorialStore } from '../../store/useTutorialStore';

// 軽減追加の窓の外側クリック(2026-10-27)。
// 本番(〜9/9 版)は document の mousedown で閉じた直後、押した表のマスの click で窓が開き直り「閉じない」と見えていた。
// 今は透明な全画面の背景が押下を受け止め、閉じるだけで下のマスへは届かない。その動きをここで固定する。

const renderSelector = (props: Partial<React.ComponentProps<typeof MitigationSelector>> = {}) => {
    const onClose = vi.fn();
    const onCellClick = vi.fn();
    const utils = render(
        <>
            <button data-testid="cell" onClick={onCellClick}>cell</button>
            <MitigationSelector isOpen onClose={onClose} onSelect={vi.fn()} jobId={null} position={{ x: 100, y: 100 }} {...props} />
        </>,
    );
    const backdrop = utils.container.querySelector<HTMLElement>('.fixed.inset-0.pointer-events-auto.cursor-default');
    const panel = utils.container.querySelector<HTMLElement>('[data-tutorial-modal]');
    return { ...utils, onClose, onCellClick, backdrop, panel };
};

const pressAndRelease = (down: HTMLElement, up: HTMLElement, clickTarget: HTMLElement) => {
    fireEvent.pointerDown(down);
    fireEvent.pointerUp(up);
    fireEvent.click(clickTarget);
};

describe('軽減追加の窓: 外側クリック', () => {
    beforeEach(() => {
        useTutorialStore.setState({ isActive: false });
    });

    it('押した位置に出る形: 透明な全画面の背景があり、外側を押すと閉じる', () => {
        const { backdrop, onClose } = renderSelector();
        expect(backdrop).not.toBeNull();
        pressAndRelease(backdrop!, backdrop!, backdrop!);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('下の要素の押し下げでは閉じない(document の mousedown 方式に戻っていない)', () => {
        const { getByTestId, onClose } = renderSelector();
        fireEvent.mouseDown(getByTestId('cell'));
        fireEvent.pointerDown(getByTestId('cell'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('窓の中で押して外で離しても閉じない', () => {
        const { backdrop, panel, onClose } = renderSelector();
        pressAndRelease(panel!, backdrop!, backdrop!);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('窓の中のクリックでは閉じない', () => {
        const { panel, onClose } = renderSelector();
        pressAndRelease(panel!, panel!, panel!);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('チュートリアル中は外側を押しても閉じない', () => {
        useTutorialStore.setState({ isActive: true });
        const { backdrop, onClose } = renderSelector();
        pressAndRelease(backdrop!, backdrop!, backdrop!);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('中央表示(スマホ等): 暗い背景を押すと閉じる', () => {
        const { container, onClose } = renderSelector({ isCentered: true });
        const overlay = container.querySelector<HTMLElement>('.fixed.inset-0.modal-scrim');
        expect(overlay).not.toBeNull();
        pressAndRelease(overlay!, overlay!, overlay!);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
