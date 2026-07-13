// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Module mocks must be declared before importing the SUT
vi.mock('../../../store/useAuthStore', () => ({
    useAuthStore: Object.assign(
        vi.fn((sel: any) => sel({
            user: { uid: 'test-uid-123' },
            signOut: vi.fn(),
            deleteAccount: vi.fn(),
            updateDisplayName: vi.fn(),
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('../../../utils/avatarUpload', () => ({
    uploadAvatar: vi.fn(async () => 'https://example.com/avatar.webp'),
    deleteAvatar: vi.fn(async () => {}),
}));

// ハウジンガープロフィール追従同期 (名前/アイコン変更後に呼ばれる)。
// 実体は firebase/firestore・buildHousingHeaders を経由するため、このテストでは
// 呼び出しの有無だけを検証するスタブに差し替える。
vi.mock('../../../lib/housing/housingerProfileService', () => ({
    syncHousingerProfileBestEffort: vi.fn(),
}));

import { useAccountActions } from '../useAccountActions';
import { uploadAvatar, deleteAvatar } from '../../../utils/avatarUpload';
import { useAuthStore } from '../../../store/useAuthStore';
import { syncHousingerProfileBestEffort } from '../../../lib/housing/housingerProfileService';

describe('useAccountActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 5 actions (uploadAvatar, removeAvatar, updateDisplayName, signOut, deleteAccount)', () => {
        const { result } = renderHook(() => useAccountActions());
        expect(typeof result.current.uploadAvatar).toBe('function');
        expect(typeof result.current.removeAvatar).toBe('function');
        expect(typeof result.current.updateDisplayName).toBe('function');
        expect(typeof result.current.signOut).toBe('function');
        expect(typeof result.current.deleteAccount).toBe('function');
    });

    it('uploadAvatar uploads then updates profile state + ハウジンガープロフィールへ追従同期', async () => {
        const { result } = renderHook(() => useAccountActions());
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
        await act(async () => {
            await result.current.uploadAvatar(blob);
        });
        expect(uploadAvatar).toHaveBeenCalledWith('test-uid-123', blob);
        expect((useAuthStore as any).setState).toHaveBeenCalledWith({
            profileAvatarUrl: 'https://example.com/avatar.webp',
        });
        expect(syncHousingerProfileBestEffort).toHaveBeenCalledTimes(1);
    });

    it('removeAvatar deletes then clears profile state + ハウジンガープロフィールへ追従同期', async () => {
        const { result } = renderHook(() => useAccountActions());
        await act(async () => {
            await result.current.removeAvatar();
        });
        expect(deleteAvatar).toHaveBeenCalledWith('test-uid-123');
        expect((useAuthStore as any).setState).toHaveBeenCalledWith({
            profileAvatarUrl: null,
        });
        expect(syncHousingerProfileBestEffort).toHaveBeenCalledTimes(1);
    });

    it('updateDisplayName 成功後にハウジンガープロフィールへ追従同期する', async () => {
        const { result } = renderHook(() => useAccountActions());
        await act(async () => {
            await result.current.updateDisplayName('新しい名前');
        });
        expect(syncHousingerProfileBestEffort).toHaveBeenCalledTimes(1);
    });

    it('uploadAvatar without user throws', async () => {
        const { useAuthStore } = await import('../../../store/useAuthStore');
        (useAuthStore as any).mockImplementation((sel: any) =>
            sel({ user: null, signOut: vi.fn(), deleteAccount: vi.fn(), updateDisplayName: vi.fn() }),
        );

        const { result } = renderHook(() => useAccountActions());
        const blob = new Blob([], { type: 'image/webp' });
        await expect(result.current.uploadAvatar(blob)).rejects.toThrow('not_signed_in');
    });
});
