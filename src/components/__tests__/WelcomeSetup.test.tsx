// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// --- モック定義 ---
// setDocとuploadAvatarの呼び出し順序を検証する。
// mock.invocationCallOrder はグローバル通番のため、2つのモック関数間で
// 直接大小比較すれば「どちらが先に呼ばれたか」を判定できる。
const setDocMock = vi.fn().mockResolvedValue(undefined);
const uploadAvatarMock = vi.fn().mockResolvedValue('https://storage.example.com/avatar.webp');

vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
    setDoc: (...args: unknown[]) => setDocMock(...args),
}));

vi.mock('../../lib/firebase', () => ({ db: {} }));

vi.mock('../../utils/avatarUpload', () => ({
    uploadAvatar: (...args: unknown[]) => uploadAvatarMock(...args),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

// AvatarCropModalは実UIを介さずavatarBlobを設定するため、
// isOpen時に「クロップ完了」ボタンを描画してonCompleteを即座に呼べるようにする。
vi.mock('../AvatarCropModal', () => ({
    AvatarCropModal: ({ isOpen, onComplete }: { isOpen: boolean; onComplete: (blob: Blob) => void }) => {
        if (!isOpen) return null;
        return (
            <button
                type="button"
                onClick={() => onComplete(new Blob(['fake-avatar'], { type: 'image/webp' }))}
            >
                mock-crop-complete
            </button>
        );
    },
}));

const mockUser = { uid: 'user-1' };
const signOutMock = vi.fn();
const setStateMock = vi.fn();

vi.mock('../../store/useAuthStore', () => {
    const useAuthStoreFn = (selector: (s: unknown) => unknown) =>
        selector({ user: mockUser, signOut: signOutMock });
    useAuthStoreFn.setState = (...args: unknown[]) => setStateMock(...args);
    useAuthStoreFn.getState = () => ({ signOut: signOutMock });
    return { useAuthStore: useAuthStoreFn };
});

import { WelcomeSetup } from '../WelcomeSetup';

describe('WelcomeSetup handleSubmit', () => {
    beforeEach(() => {
        setDocMock.mockClear();
        uploadAvatarMock.mockClear();
        setStateMock.mockClear();
        if (!URL.createObjectURL) (URL as any).createObjectURL = () => 'blob:mock';
        if (!URL.revokeObjectURL) (URL as any).revokeObjectURL = () => {};
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    it('avatarBlobが設定された状態で送信すると、setDocがuploadAvatarより先に呼ばれる', async () => {
        render(<WelcomeSetup />);

        // アバターエリアをクリックしてクロップモーダルを開く
        // (DOM順序: [×ボタン, アバターボタン, 送信ボタン, キャンセルリンク] のうち index 1 がアバターボタン)
        fireEvent.click(screen.getAllByRole('button')[1]);
        // モック化したクロップモーダルの「完了」ボタンでavatarBlobを設定する
        fireEvent.click(screen.getByText('mock-crop-complete'));

        // 表示名を入力
        const input = screen.getByPlaceholderText('welcome.display_name_placeholder');
        fireEvent.change(input, { target: { value: 'TestUser' } });

        // 送信
        fireEvent.click(screen.getByText('welcome.start_button'));

        await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(uploadAvatarMock).toHaveBeenCalledTimes(1));

        // 呼び出し順序: setDocが先、uploadAvatarが後(回帰防止の本丸)
        expect(setDocMock.mock.invocationCallOrder[0]).toBeLessThan(
            uploadAvatarMock.mock.invocationCallOrder[0],
        );
    });

    it('setDoc作成時のavatarUrlはnull(uploadAvatar未実行時点)で、ドキュメント作成後にuploadAvatarが呼ばれる', async () => {
        render(<WelcomeSetup />);

        fireEvent.click(screen.getAllByRole('button')[1]);
        fireEvent.click(screen.getByText('mock-crop-complete'));

        const input = screen.getByPlaceholderText('welcome.display_name_placeholder');
        fireEvent.change(input, { target: { value: 'TestUser2' } });
        fireEvent.click(screen.getByText('welcome.start_button'));

        await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1));

        expect(setDocMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ avatarUrl: null }),
        );

        await waitFor(() => expect(uploadAvatarMock).toHaveBeenCalledWith('user-1', expect.any(Blob)));
    });
});
