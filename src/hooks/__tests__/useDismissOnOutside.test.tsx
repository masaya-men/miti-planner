// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { useDismissOnOutside } from '../useDismissOnOutside';
import { useTutorialStore } from '../../store/useTutorialStore';

type HarnessProps = {
    isOpen?: boolean;
    onDismiss: () => void;
    onToggle?: () => void;
    onBelow?: () => void;
    allowDuringTutorial?: boolean;
};

function Harness({ isOpen = true, onDismiss, onToggle, onBelow, allowDuringTutorial }: HarnessProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const childRef = useRef<HTMLDivElement>(null);
    useDismissOnOutside(isOpen, onDismiss, [panelRef, childRef], { allowDuringTutorial });
    return (
        <div>
            <button data-testid="opener" onClick={onToggle}>open</button>
            <div ref={panelRef} data-testid="panel"><span data-testid="inner">in</span></div>
            <div ref={childRef} data-testid="portal-child">child</div>
            <button data-testid="below" onClick={onBelow}>below</button>
        </div>
    );
}

// 実ブラウザと同じ順序で「押す→離す→click」を送る
function press(el: Element) {
    fireEvent.pointerDown(el);
    fireEvent.mouseUp(el);
    fireEvent.click(el);
}

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useTutorialStore.setState({ isActive: false });
});

describe('useDismissOnOutside', () => {
    it('外側を押すと閉じ、下のボタンの onClick は呼ばれない', () => {
        const onDismiss = vi.fn();
        const onBelow = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onBelow={onBelow} />);
        press(getByTestId('below'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onBelow).toHaveBeenCalledTimes(0);
    });

    it('中を押しても閉じない', () => {
        const onDismiss = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
        press(getByTestId('inner'));
        expect(onDismiss).toHaveBeenCalledTimes(0);
    });

    it('portal の子の中を押しても閉じない', () => {
        const onDismiss = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
        press(getByTestId('portal-child'));
        expect(onDismiss).toHaveBeenCalledTimes(0);
    });

    it('中で押して外で離しても閉じない', () => {
        const onDismiss = vi.fn();
        const onBelow = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onBelow={onBelow} />);
        fireEvent.pointerDown(getByTestId('inner'));
        fireEvent.click(getByTestId('below'));
        expect(onDismiss).toHaveBeenCalledTimes(0);
        expect(onBelow).toHaveBeenCalledTimes(1);
    });

    it('開くボタンを押すと閉じるだけで開き直さない', () => {
        const onDismiss = vi.fn();
        const onToggle = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onToggle={onToggle} />);
        press(getByTestId('opener'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onToggle).toHaveBeenCalledTimes(0);
    });

    it('止める click は 1 回だけ', () => {
        const onDismiss = vi.fn();
        const onBelow = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onBelow={onBelow} />);
        press(getByTestId('below'));
        fireEvent.click(getByTestId('below'));
        expect(onBelow).toHaveBeenCalledTimes(1);
    });

    it('離してから 400ms で止めを外す(click が来ない場合)', () => {
        vi.useFakeTimers();
        const onDismiss = vi.fn();
        const onBelow = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onBelow={onBelow} />);
        fireEvent.pointerDown(getByTestId('below'));
        fireEvent.pointerUp(getByTestId('below'));
        act(() => { vi.advanceTimersByTime(400); });
        fireEvent.click(getByTestId('below'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onBelow).toHaveBeenCalledTimes(1);
    });

    it('ゆっくり押しても開くボタンは開き直さない', () => {
        vi.useFakeTimers();
        const onDismiss = vi.fn();
        const onToggle = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onToggle={onToggle} />);
        fireEvent.pointerDown(getByTestId('opener'));
        act(() => { vi.advanceTimersByTime(500); });
        fireEvent.pointerUp(getByTestId('opener'));
        fireEvent.click(getByTestId('opener'));
        expect(onToggle).toHaveBeenCalledTimes(0);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('pointercancel の後の次のタップは届く', () => {
        const onDismiss = vi.fn();
        const onBelow = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onBelow={onBelow} />);
        fireEvent.pointerDown(getByTestId('below'));
        fireEvent.pointerCancel(getByTestId('below'));
        fireEvent.click(getByTestId('below'));
        expect(onBelow).toHaveBeenCalledTimes(1);
    });

    it('右ボタンで外を押すと閉じ、止めは置かない', () => {
        const onDismiss = vi.fn();
        const onBelow = vi.fn();
        const { getByTestId } = render(<Harness onDismiss={onDismiss} onBelow={onBelow} />);
        fireEvent.pointerDown(getByTestId('below'), { button: 2 });
        expect(onDismiss).toHaveBeenCalledTimes(1);
        fireEvent.click(getByTestId('below'));
        expect(onBelow).toHaveBeenCalledTimes(1);
    });

    it('重なりは手前だけ', () => {
        const back = vi.fn();
        const front = vi.fn();
        render(<Harness onDismiss={back} />);
        // 後から開いた方が手前
        const second = render(<Harness onDismiss={front} />);
        press(second.getAllByTestId('below')[0]);
        expect(front).toHaveBeenCalledTimes(1);
        expect(back).toHaveBeenCalledTimes(0);
    });

    it('チュートリアル中は閉じない(allowDuringTutorial なら閉じる)', () => {
        useTutorialStore.setState({ isActive: true });
        const blocked = vi.fn();
        const a = render(<Harness onDismiss={blocked} />);
        press(a.getByTestId('below'));
        expect(blocked).toHaveBeenCalledTimes(0);
        a.unmount();

        const allowed = vi.fn();
        const b = render(<Harness onDismiss={allowed} allowDuringTutorial />);
        press(b.getByTestId('below'));
        expect(allowed).toHaveBeenCalledTimes(1);
    });

    it('isOpen=false の時は何もしない', () => {
        const onDismiss = vi.fn();
        const onBelow = vi.fn();
        const { getByTestId } = render(<Harness isOpen={false} onDismiss={onDismiss} onBelow={onBelow} />);
        press(getByTestId('below'));
        expect(onDismiss).toHaveBeenCalledTimes(0);
        expect(onBelow).toHaveBeenCalledTimes(1);
    });
});
