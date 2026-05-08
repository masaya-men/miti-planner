// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisplayNameEditor } from '../DisplayNameEditor';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('DisplayNameEditor', () => {
    it('初期値を input に表示する', () => {
        render(<DisplayNameEditor value="InitialName" onSave={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByDisplayValue('InitialName') as HTMLInputElement;
        expect(input).toBeDefined();
    });

    it('30 文字以内では保存ボタンが有効', () => {
        render(<DisplayNameEditor value="InitialName" onSave={vi.fn()} onCancel={vi.fn()} />);
        const saveBtn = screen.getByRole('button', { name: /profile.save/i });
        expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('空文字では保存ボタンが無効', () => {
        render(<DisplayNameEditor value="" onSave={vi.fn()} onCancel={vi.fn()} />);
        const saveBtn = screen.getByRole('button', { name: /profile.save/i });
        expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('保存ボタンクリックで onSave(trimmed) が呼ばれる', () => {
        const onSave = vi.fn();
        render(<DisplayNameEditor value="  Hello  " onSave={onSave} onCancel={vi.fn()} />);
        const saveBtn = screen.getByRole('button', { name: /profile.save/i });
        fireEvent.click(saveBtn);
        expect(onSave).toHaveBeenCalledWith('Hello');
    });

    it('キャンセルボタンクリックで onCancel が呼ばれる', () => {
        const onCancel = vi.fn();
        render(<DisplayNameEditor value="InitialName" onSave={vi.fn()} onCancel={onCancel} />);
        const cancelBtn = screen.getByRole('button', { name: /profile.cancel/i });
        fireEvent.click(cancelBtn);
        expect(onCancel).toHaveBeenCalled();
    });

    it('Enter キーで保存実行', () => {
        const onSave = vi.fn();
        render(<DisplayNameEditor value="Hello" onSave={onSave} onCancel={vi.fn()} />);
        const input = screen.getByDisplayValue('Hello');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSave).toHaveBeenCalledWith('Hello');
    });

    it('Escape キーでキャンセル実行', () => {
        const onCancel = vi.fn();
        render(<DisplayNameEditor value="Hello" onSave={vi.fn()} onCancel={onCancel} />);
        const input = screen.getByDisplayValue('Hello');
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(onCancel).toHaveBeenCalled();
    });

    it('文字数カウンタを表示する (例: 5/30)', () => {
        render(<DisplayNameEditor value="Hello" onSave={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByText('5/30')).toBeDefined();
    });
});
