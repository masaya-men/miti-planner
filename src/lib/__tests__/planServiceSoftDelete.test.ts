/**
 * deletePlan ソフトデリート (墓標化) テスト (2026-06-03)
 *
 * 物理削除 (batch.delete) をやめ、`deleted:true + deletedAt` の update に変える。
 * 復活防止のため doc は残す。カウンターは従来どおり減算する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// batch の操作を記録できるモック
const batchOps = { updates: [] as any[], deletes: [] as any[], commits: 0 };

vi.mock('firebase/firestore', () => {
    class Timestamp {
        ms: number;
        constructor(ms: number) { this.ms = ms; }
        toMillis() { return this.ms; }
    }
    return {
        doc: vi.fn((_db: any, col: string, id: string) => ({ col, id })),
        collection: vi.fn(() => ({})),
        query: vi.fn(() => ({})),
        where: vi.fn(() => ({})),
        orderBy: vi.fn(() => ({})),
        getDocs: vi.fn(async () => ({ docs: [] })),
        getDocsFromServer: vi.fn(async () => ({ docs: [] })),
        getDoc: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
        getDocFromServer: vi.fn(async () => ({ exists: () => false, data: () => undefined })),
        setDoc: vi.fn(async () => {}),
        writeBatch: vi.fn(() => ({
            update: vi.fn((ref: any, data: any) => { batchOps.updates.push({ ref, data }); }),
            delete: vi.fn((ref: any) => { batchOps.deletes.push({ ref }); }),
            commit: vi.fn(async () => { batchOps.commits++; }),
        })),
        serverTimestamp: vi.fn(() => '__SERVER_TS__'),
        increment: vi.fn((n: number) => ({ __increment: n })),
        Timestamp,
    };
});

vi.mock('../firebase', () => ({ db: {} }));

import { planService } from '../planService';

const UID = 'user-123';

beforeEach(() => {
    batchOps.updates = [];
    batchOps.deletes = [];
    batchOps.commits = 0;
});

describe('deletePlan ソフトデリート', () => {
    it('物理削除 (batch.delete) を呼ばない', async () => {
        await planService.deletePlan('p1', UID, 'm1s');
        expect(batchOps.deletes).toHaveLength(0);
    });

    it('プラン doc を deleted:true + deletedAt で update する (墓標化)', async () => {
        await planService.deletePlan('p1', UID, 'm1s');
        const planUpdate = batchOps.updates.find(u => u.ref.id === 'p1');
        expect(planUpdate).toBeDefined();
        expect(planUpdate.data.deleted).toBe(true);
        expect(planUpdate.data.deletedAt).toBe('__SERVER_TS__');
    });

    it('カウンターを total -1 で減算する', async () => {
        await planService.deletePlan('p1', UID, 'm1s');
        const countUpdate = batchOps.updates.find(u => u.ref.id === UID);
        expect(countUpdate).toBeDefined();
        expect(countUpdate.data.total).toEqual({ __increment: -1 });
    });

    it('バッチを commit する', async () => {
        await planService.deletePlan('p1', UID, 'm1s');
        expect(batchOps.commits).toBe(1);
    });
});
