/**
 * fetchUserPlans 墓標除外テスト (2026-06-03)
 *
 * ソフトデリート導入後、リモートには live と墓標 (deleted:true) が混在する。
 * - fetchUserPlans は live のみ返す (墓標は表示・カウント対象外)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/firestore', () => {
    class Timestamp {
        ms: number;
        constructor(ms: number) { this.ms = ms; }
        toMillis() { return this.ms; }
    }
    return {
        doc: vi.fn(() => ({})),
        collection: vi.fn(() => ({})),
        query: vi.fn(() => ({})),
        where: vi.fn(() => ({})),
        orderBy: vi.fn(() => ({})),
        getDocs: vi.fn(async () => ({ docs: [] })),
        getDocsFromServer: vi.fn(async () => ({ docs: [] })),
        getDoc: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
        getDocFromServer: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
        setDoc: vi.fn(async () => {}),
        writeBatch: vi.fn(() => ({ update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) })),
        serverTimestamp: vi.fn(() => 'ts'),
        increment: vi.fn((n: number) => n),
        Timestamp,
    };
});

vi.mock('../firebase', () => ({ db: {} }));

import { planService } from '../planService';
import * as fs from 'firebase/firestore';

const UID = 'user-123';

function remoteDoc(id: string, deleted = false) {
    return {
        id,
        data: () => ({
            ownerId: UID, ownerDisplayName: '', title: id, contentId: 'm1s',
            isPublic: false, shareId: null, copyCount: 0, useCount: 0,
            data: {}, version: 1, createdAt: undefined, updatedAt: undefined,
            ...(deleted ? { deleted: true } : {}),
        }),
    };
}

beforeEach(() => {
    vi.mocked(fs.getDocsFromServer).mockResolvedValue({ docs: [] } as any);
});

describe('fetchUserPlans 墓標除外', () => {
    it('deleted:true の墓標を除外し live のみ返す', async () => {
        vi.mocked(fs.getDocsFromServer).mockResolvedValue({
            docs: [remoteDoc('live1'), remoteDoc('tomb1', true), remoteDoc('live2')],
        } as any);

        const plans = await planService.fetchUserPlans(UID);

        expect(plans.map(p => p.id).sort()).toEqual(['live1', 'live2']);
    });
});
