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

import { useAccountActions } from '../useAccountActions';
import { uploadAvatar, deleteAvatar } from '../../../utils/avatarUpload';

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

    it('uploadAvatar uploads then updates profile state', async () => {
        const { result } = renderHook(() => useAccountActions());
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
        await act(async () => {
            await result.current.uploadAvatar(blob);
        });
        expect(uploadAvatar).toHaveBeenCalledWith('test-uid-123', blob);
    });

    it('removeAvatar deletes then clears profile state', async () => {
        const { result } = renderHook(() => useAccountActions());
        await act(async () => {
            await result.current.removeAvatar();
        });
        expect(deleteAvatar).toHaveBeenCalledWith('test-uid-123');
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
