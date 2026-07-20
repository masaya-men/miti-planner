import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDoc, mockSetDoc, mockDoc } = vi.hoisted(() => ({
    mockGetDoc: vi.fn((..._args: unknown[]): Promise<{ exists: () => boolean; data: () => Record<string, unknown> }> =>
        Promise.resolve({ exists: () => false, data: () => ({}) })),
    mockSetDoc: vi.fn(async (..._args: unknown[]) => undefined),
    mockDoc: vi.fn((..._args: unknown[]) => ({ id: 'mock-doc' })),
}));

vi.mock('firebase/firestore', () => ({
    doc: mockDoc,
    getDoc: mockGetDoc,
    setDoc: mockSetDoc,
}));

vi.mock('../../lib/firebase', () => ({ db: {} }));

import { ensureUserDocument } from '../userDocHelper';

function makeUser(overrides: Record<string, unknown> = {}) {
    return {
        uid: 'test-uid',
        displayName: 'Test User',
        photoURL: null,
        providerData: [],
        ...overrides,
    } as any;
}

describe('ensureUserDocument', () => {
    beforeEach(() => {
        mockGetDoc.mockReset();
        mockSetDoc.mockClear();
    });

    it('ドキュメントが存在しない場合は必須フィールドを網羅して新規作成する', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
        await ensureUserDocument(makeUser());
        expect(mockSetDoc).toHaveBeenCalledTimes(1);
        const written = mockSetDoc.mock.calls[0][1];
        expect(written).toMatchObject({ provider: 'discord', settings: {} });
    });

    it('providerData が undefined でもクラッシュしない (回帰防止)', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
        await expect(ensureUserDocument(makeUser({ providerData: undefined }))).resolves.not.toThrow();
    });

    it('ドキュメントが存在し settings も揃っていれば書き込みしない', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ settings: {} }) });
        await ensureUserDocument(makeUser());
        expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('ドキュメントは存在するが settings が欠けていれば merge で補完する', async () => {
        mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
        await ensureUserDocument(makeUser());
        expect(mockSetDoc).toHaveBeenCalledTimes(1);
        const [, patch, opts] = mockSetDoc.mock.calls[0];
        expect(patch).toMatchObject({ settings: {} });
        expect(opts).toEqual({ merge: true });
    });
});
