// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalShell } from '../ModalShell';

const clickBackdrop = (el: Element) => {
    fireEvent.pointerDown(el);
    fireEvent.pointerUp(el);
    fireEvent.click(el);
};
const backdrop = () => document.querySelector('[data-modal-backdrop]')!;

describe('ModalShell', () => {
    it('閉じているときは何も描かない', () => {
        render(<ModalShell isOpen={false} onClose={() => {}}><p>中身</p></ModalShell>);
        expect(screen.queryByText('中身')).toBeNull();
    });

    it('body 直下に描き、dialog として名乗る', () => {
        render(<ModalShell isOpen onClose={() => {}}><p>中身</p></ModalShell>);
        const dialog = screen.getByRole('dialog');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.closest('[data-modal-shell]')?.parentElement).toBe(document.body);
    });

    it('後ろの幕は共通の .modal-scrim(10-29 から暗さ無し)+ふわっと開く', () => {
        render(<ModalShell isOpen onClose={() => {}}><p>中身</p></ModalShell>);
        expect(backdrop().className).toContain('modal-scrim');
        expect(backdrop().className).toContain('animate-[fadeIn_150ms_ease-out]');
        expect(screen.getByRole('dialog').className).toContain('animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]');
    });

    it('重なり順は 3 段', () => {
        const { rerender } = render(<ModalShell isOpen onClose={() => {}}><p /></ModalShell>);
        const shell = () => document.querySelector('[data-modal-shell]')!;
        expect(shell().className).toContain('z-[10000]');
        rerender(<ModalShell isOpen onClose={() => {}} layer="confirm"><p /></ModalShell>);
        expect(shell().className).toContain('z-[99999]');
        rerender(<ModalShell isOpen onClose={() => {}} layer="top"><p /></ModalShell>);
        expect(shell().className).toContain('z-[100000]');
    });

    it('Esc で閉じる', () => {
        const onClose = vi.fn();
        render(<ModalShell isOpen onClose={onClose}><p /></ModalShell>);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('重なっていたら Esc は一番上だけ閉じる', () => {
        const lower = vi.fn();
        const upper = vi.fn();
        render(<>
            <ModalShell isOpen onClose={lower}><p /></ModalShell>
            <ModalShell isOpen onClose={upper} layer="confirm"><p /></ModalShell>
        </>);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(upper).toHaveBeenCalledTimes(1);
        expect(lower).not.toHaveBeenCalled();
    });

    it('外側クリックで閉じる・窓の中のクリックでは閉じない', () => {
        const onClose = vi.fn();
        render(<ModalShell isOpen onClose={onClose}><button>中</button></ModalShell>);
        clickBackdrop(screen.getByText('中'));
        expect(onClose).not.toHaveBeenCalled();
        clickBackdrop(backdrop());
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('入力があると外側クリックでは閉じない', () => {
        const onClose = vi.fn();
        render(<ModalShell isOpen onClose={onClose}><input aria-label="名前" /></ModalShell>);
        fireEvent.input(screen.getByLabelText('名前'), { target: { value: 'a' } });
        clickBackdrop(backdrop());
        expect(onClose).not.toHaveBeenCalled();
    });

    it('locked の間は Esc も外側クリックも効かない', () => {
        const onClose = vi.fn();
        render(<ModalShell isOpen onClose={onClose} locked><p /></ModalShell>);
        fireEvent.keyDown(document, { key: 'Escape' });
        clickBackdrop(backdrop());
        expect(onClose).not.toHaveBeenCalled();
    });

    it('上の窓が locked でも Esc は下の窓へ抜けない', () => {
        const lower = vi.fn();
        render(<>
            <ModalShell isOpen onClose={lower}><p /></ModalShell>
            <ModalShell isOpen onClose={() => {}} locked><p /></ModalShell>
        </>);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(lower).not.toHaveBeenCalled();
    });

    it('closeOnBackdrop=false なら外側クリックでは閉じない(Esc は効く)', () => {
        const onClose = vi.fn();
        render(<ModalShell isOpen onClose={onClose} closeOnBackdrop={false}><p /></ModalShell>);
        clickBackdrop(backdrop());
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
