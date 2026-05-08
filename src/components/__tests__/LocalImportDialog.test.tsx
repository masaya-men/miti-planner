// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalImportDialog } from '../LocalImportDialog';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, any>) => {
            if (opts && 'count' in opts) return `${key}:${opts.count}`;
            return key;
        },
    }),
}));

vi.mock('../../hooks/useEscapeClose', () => ({ useEscapeClose: () => undefined }));

describe('LocalImportDialog', () => {
    it('isOpen=false のときは何も描画しない', () => {
        const { container } = render(
            <LocalImportDialog
                isOpen={false}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('isOpen=true でタイトルと件数を含む本文を表示する', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.getByText('local_import.title')).toBeDefined();
        expect(screen.getByText(/local_import\.body:3/)).toBeDefined();
    });

    it('ignoreDontShow=false ならチェックボックスを表示', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.getByLabelText('local_import.dont_show_again')).toBeDefined();
    });

    it('ignoreDontShow=true ならチェックボックスを表示しない', () => {
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={true}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        );
        expect(screen.queryByLabelText('local_import.dont_show_again')).toBeNull();
    });

    it('「取り込む」クリックで onConfirm({ dontShow: false }) を呼ぶ', () => {
        const onConfirm = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onConfirm).toHaveBeenCalledWith({ dontShow: false });
    });

    it('チェックを入れて「取り込む」クリックで onConfirm({ dontShow: true })', () => {
        const onConfirm = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByLabelText('local_import.dont_show_again'));
        fireEvent.click(screen.getByRole('button', { name: /local_import\.confirm/i }));
        expect(onConfirm).toHaveBeenCalledWith({ dontShow: true });
    });

    it('「取り込まない」クリックで onCancel({ dontShow }) を呼ぶ', () => {
        const onCancel = vi.fn();
        render(
            <LocalImportDialog
                isOpen={true}
                count={3}
                ignoreDontShow={false}
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />,
        );
        fireEvent.click(screen.getByLabelText('local_import.dont_show_again'));
        fireEvent.click(screen.getByRole('button', { name: /local_import\.cancel/i }));
        expect(onCancel).toHaveBeenCalledWith({ dontShow: true });
    });
});
