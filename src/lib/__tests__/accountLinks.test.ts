// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Firebase 関連の副作用を抑止 (accountLinks → ./firebase → initializeApp が走るのを防ぐ)
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({})),
}));
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn(() => () => undefined),
}));
vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(() => ({})),
}));
vi.mock('firebase/analytics', () => ({
    getAnalytics: vi.fn(() => ({})),
    isSupported: vi.fn(() => Promise.resolve(false)),
}));
vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
}));
vi.mock('firebase/app-check', () => ({
    initializeAppCheck: vi.fn(() => ({})),
    ReCaptchaEnterpriseProvider: vi.fn(),
    getToken: vi.fn(async () => ({ token: 'mock-token' })),
}));
vi.mock('../../lib/appCheck', () => ({
    initAppCheck: vi.fn(() => null),
}));

// vi.mock() factory はファイル先頭にホイストされるため、 通常の const は参照できない。
// vi.hoisted() で同じタイミングに評価して、 factory からも tests からも参照できるハンドルを作る。
const { mockAuth, mockApiFetch } = vi.hoisted(() => {
    const mockAuth: { currentUser: { getIdToken: () => Promise<string> } | null } = {
        currentUser: null,
    };
    const mockApiFetch = vi.fn();
    return { mockAuth, mockApiFetch };
});

vi.mock('../../lib/firebase', () => ({
    auth: mockAuth,
    db: {},
    storage: {},
    appCheck: {},
}));

// apiFetch をモック (内部の App Check / IDToken 取得は別途検証済み)
vi.mock('../../lib/apiClient', () => ({
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { getLinkedProviders, unlinkAccount, startLinkFlow } from '../accountLinks';

beforeEach(() => {
    mockAuth.currentUser = null;
    mockApiFetch.mockReset();
    localStorage.clear();
    // window.location.href の書き込みで jsdom/happy-dom が遷移エラーを投げないよう、
    // location を差し替え可能なオブジェクトにする。
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: { pathname: '/housing/foo', href: 'https://lopoly.app/housing/foo' },
    });
});

describe('getLinkedProviders', () => {
    it('未ログイン時に throw する', async () => {
        await expect(getLinkedProviders()).rejects.toThrow('Not logged in');
        expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('成功時に JSON を返し、 /api/auth/links に GET する', async () => {
        mockAuth.currentUser = { getIdToken: async () => 'id-token' };
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ discord: true, twitter: false }),
        });

        const result = await getLinkedProviders();

        expect(result).toEqual({ discord: true, twitter: false });
        expect(mockApiFetch).toHaveBeenCalledTimes(1);
        expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/links', { method: 'GET' });
    });

    it('非 ok 時に status + body を含む Error を投げる', async () => {
        mockAuth.currentUser = { getIdToken: async () => 'id-token' };
        mockApiFetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => 'unauthorized',
        });

        await expect(getLinkedProviders()).rejects.toThrow(/401 unauthorized/);
    });
});

describe('unlinkAccount', () => {
    it('未ログイン時に throw する', async () => {
        await expect(unlinkAccount('discord')).rejects.toThrow('Not logged in');
        expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('成功時に provider を body に詰めて POST する', async () => {
        mockAuth.currentUser = { getIdToken: async () => 'id-token' };
        mockApiFetch.mockResolvedValueOnce({ ok: true });

        await unlinkAccount('twitter');

        expect(mockApiFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockApiFetch.mock.calls[0];
        expect(url).toBe('/api/auth/links');
        expect(init).toMatchObject({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        expect(JSON.parse(init.body)).toEqual({ provider: 'twitter' });
    });

    it('非 ok 時に status + body を含む Error を投げる', async () => {
        mockAuth.currentUser = { getIdToken: async () => 'id-token' };
        mockApiFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'server-error',
        });

        await expect(unlinkAccount('discord')).rejects.toThrow(/500 server-error/);
    });
});

describe('startLinkFlow', () => {
    it('未ログイン時に throw する', async () => {
        await expect(startLinkFlow('discord')).rejects.toThrow('Not logged in');
        expect(mockApiFetch).not.toHaveBeenCalled();
        expect(localStorage.getItem('lopo_auth_return_url')).toBeNull();
    });

    it('return URL を保存し、 mode=link で POST し、 取得 URL に遷移する', async () => {
        mockAuth.currentUser = { getIdToken: async () => 'id-token' };
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ url: 'https://discord.com/oauth?state=xyz' }),
        });

        await startLinkFlow('discord');

        expect(localStorage.getItem('lopo_auth_return_url')).toBe('/housing/foo');
        expect(mockApiFetch).toHaveBeenCalledWith(
            '/api/auth?provider=discord&mode=link',
            { method: 'POST' },
        );
        expect(window.location.href).toBe('https://discord.com/oauth?state=xyz');
    });

    it('レスポンスに url が無ければ throw する', async () => {
        mockAuth.currentUser = { getIdToken: async () => 'id-token' };
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
        });

        await expect(startLinkFlow('twitter')).rejects.toThrow(/no url/);
    });

    it('非 ok 時に status を含む Error を投げる', async () => {
        mockAuth.currentUser = { getIdToken: async () => 'id-token' };
        mockApiFetch.mockResolvedValueOnce({ ok: false, status: 403 });

        await expect(startLinkFlow('discord')).rejects.toThrow(/403/);
    });
});
