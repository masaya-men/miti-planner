// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalShell } from '../ModalShell';
import { ModalHeader, ModalButton, CloseButton } from '../ModalParts';

describe('ModalShell の枠', () => {
    it('既定で浮かぶものの素材(float-surface)・角丸 2xl の枠を付ける(2026-10-28 統一)', () => {
        render(<ModalShell isOpen onClose={() => {}} className="w-[400px]"><p /></ModalShell>);
        const d = screen.getByRole('dialog');
        expect(d.className).toContain('float-surface');
        expect(d.className).toContain('rounded-2xl');
        expect(d.className).toContain('w-[400px]');
    });

    it('frame={false} なら枠を付けない', () => {
        render(<ModalShell isOpen onClose={() => {}} frame={false}><p /></ModalShell>);
        expect(screen.getByRole('dialog').className).not.toContain('float-surface');
    });
});

describe('ModalParts', () => {
    it('見出しは太字だけ(縦の棒・大文字なし)', () => {
        render(<ModalHeader title="軽減表を保存" onClose={() => {}} closeLabel="閉じる" />);
        const h = screen.getByRole('heading', { name: '軽減表を保存' });
        expect(h.className).toContain('font-bold');
        expect(h.className).not.toContain('uppercase');
    });

    it('× は角丸の四角で、押すと onClose', () => {
        const onClose = vi.fn();
        render(<ModalHeader title="t" onClose={onClose} closeLabel="閉じる" />);
        const x = screen.getByRole('button', { name: '閉じる' });
        expect(x.className).toContain('rounded-lg');
        fireEvent.click(x);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('× を無効にできる(取り込み中など)', () => {
        const onClick = vi.fn();
        render(<CloseButton onClick={onClick} label="閉じる" disabled />);
        fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('決定は青・キャンセルは枠なし', () => {
        render(<>
            <ModalButton variant="primary">保存する</ModalButton>
            <ModalButton>キャンセル</ModalButton>
        </>);
        expect(screen.getByRole('button', { name: '保存する' }).className).toContain('bg-app-blue');
        const cancel = screen.getByRole('button', { name: 'キャンセル' }).className;
        expect(cancel).toContain('border-transparent');
        expect(cancel).toContain('bg-transparent');
    });

    it('ボタンは既定で type=button(フォーム内で誤送信しない)', () => {
        render(<ModalButton>x</ModalButton>);
        expect(screen.getByRole('button').getAttribute('type')).toBe('button');
    });
});
