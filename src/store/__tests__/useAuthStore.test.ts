import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockAuth = vi.hoisted(() => ({
    currentUser: { uid: 'test-uid' } as { uid: string } | null,
}));

vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn(() => () => undefined),
    signInWithCustomToken: vi.fn(),
    signOut: vi.fn(),
    deleteUser: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(() => ({})),
    ref: vi.fn(),
    deleteObject: vi.fn(),
}));

vi.mock('firebase/analytics', () => ({
    getAnalytics: vi.fn(() => ({})),
    isSupported: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('../../lib/appCheck', () => ({
    initAppCheck: vi.fn(() => null),
}));

vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({ id: 'mock-doc' })),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    writeBatch: vi.fn(() => ({
        delete: vi.fn(),
        commit: vi.fn(async () => undefined),
    })),
    updateDoc: vi.fn(async () => undefined),
}));

vi.mock('../../lib/firebase', () => ({
    get auth() { return mockAuth; },
    db: {},
    storage: {},
}));

vi.mock('../usePlanStore', () => ({
    usePlanStore: {
        getState: vi.fn(() => ({ currentPlanId: null })),
        setState: vi.fn(),
    },
}));

vi.mock('../useMitigationStore', () => ({
    useMitigationStore: {
        getState: vi.fn(() => ({ getSnapshot: vi.fn(), resetForTutorial: vi.fn() })),
    },
}));

vi.mock('../../utils/logoUpload', () => ({
    deleteTeamLogo: vi.fn(),
}));

vi.mock('../../utils/avatarUpload', () => ({
    deleteAvatar: vi.fn(),
}));

vi.mock('../../lib/apiClient', () => ({
    apiFetch: vi.fn(),
}));

import { useAuthStore } from '../useAuthStore';

describe('useAuthStore.updateDisplayName', () => {
    beforeEach(() => {
        mockAuth.currentUser = { uid: 'test-uid' };
        useAuthStore.setState({
            user: { uid: 'test-uid' } as any,
            profileDisplayName: 'OldName',
        });
    });

    it('成功時に profileDisplayName を更新する', async () => {
        await useAuthStore.getState().updateDisplayName('NewName');
        expect(useAuthStore.getState().profileDisplayName).toBe('NewName');
    });

    it('空文字は拒否してエラーを投げる', async () => {
        await expect(useAuthStore.getState().updateDisplayName('')).rejects.toThrow();
        expect(useAuthStore.getState().profileDisplayName).toBe('OldName');
    });

    it('31 文字以上は拒否してエラーを投げる', async () => {
        const tooLong = 'a'.repeat(31);
        await expect(useAuthStore.getState().updateDisplayName(tooLong)).rejects.toThrow();
        expect(useAuthStore.getState().profileDisplayName).toBe('OldName');
    });

    it('未ログイン時は拒否してエラーを投げる', async () => {
        mockAuth.currentUser = null;
        await expect(useAuthStore.getState().updateDisplayName('AnyName')).rejects.toThrow();
    });

    it('前後の空白をトリムして保存する', async () => {
        await useAuthStore.getState().updateDisplayName('  Trimmed  ');
        expect(useAuthStore.getState().profileDisplayName).toBe('Trimmed');
    });
});
