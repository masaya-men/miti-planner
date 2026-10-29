// @vitest-environment happy-dom
/**
 * 共通の殻(窓・下から出るシート・ツールチップ・通知)が素材 float-surface で描かれる(2026-10-28)。
 * 設計書 = docs/superpowers/specs/2026-10-28-floating-surface-unify-design.md
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

import { ModalShell } from '../ModalShell';
import { TOOLTIP_BOX_CLASS } from '../Tooltip';
import { MobileBottomSheet } from '../../MobileBottomSheet';
import { ToastContainer } from '../../Toast';
import { showToast } from '../../toastBus';

describe('共通の殻は素材 float-surface', () => {
    it('窓の枠は float-surface を持ち、古いガラスとライトの白地指定を持たない', () => {
        render(<ModalShell isOpen onClose={() => {}}><p>中身</p></ModalShell>);
        const dialog = screen.getByRole('dialog');
        expect(dialog.className).toContain('float-surface');
        expect(dialog.className).not.toContain('frame-surface');
        expect(dialog.getAttribute('style') ?? '').not.toContain('--frame-surface-bg');
    });

    it('枠を自前で描く窓(frame={false})には付けない', () => {
        render(<ModalShell isOpen onClose={() => {}} frame={false}><p>中身</p></ModalShell>);
        expect(screen.getByRole('dialog').className).not.toContain('float-surface');
    });

    it('ツールチップの箱は float-surface で、角丸 8px(rounded-lg)', () => {
        expect(TOOLTIP_BOX_CLASS).toContain('float-surface');
        expect(TOOLTIP_BOX_CLASS).toContain('rounded-lg');
        expect(TOOLTIP_BOX_CLASS).not.toContain('frame-surface');
    });

    it('下から出るシートは float-surface で、シート独自の背景色を inline で持たない', () => {
        render(<MobileBottomSheet isOpen onClose={() => {}} title="t"><p>中身</p></MobileBottomSheet>);
        const sheet = screen.getByText('中身').closest('.fixed') as HTMLElement;
        expect(sheet.className).toContain('float-surface');
        expect(sheet.getAttribute('style') ?? '').not.toContain('--color-sheet-bg');
    });

    it('独自の見た目のシート(ハウジング)は bare で素材を付けない', () => {
        render(<MobileBottomSheet isOpen onClose={() => {}} title="t" bare className="housing-mobile-sheet"><p>中身</p></MobileBottomSheet>);
        const sheet = screen.getByText('中身').closest('.fixed') as HTMLElement;
        expect(sheet.className).not.toContain('float-surface');
        expect(sheet.getAttribute('style') ?? '').toContain('--color-sheet-bg');
    });

    it('通知は float-surface で、古いガラスを持たない', () => {
        render(<ToastContainer />);
        act(() => { showToast('保存しました'); });
        const box = screen.getByText('保存しました').parentElement as HTMLElement;
        expect(box.className).toContain('float-surface');
        expect(box.className).not.toContain('frame-surface');
    });
});
