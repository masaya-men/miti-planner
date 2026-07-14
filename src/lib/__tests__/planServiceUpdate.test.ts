/**
 * updatePlan / syncDirtyPlans の墓標対応テスト (2026-06-03)
 *
 * ソフトデリート導入後:
 * - リモートが墓標 (deleted:true) なら updatePlan は復活させず 'deleted_remotely' を返す。
 * - リモートに doc が無い (未同期) なら createPlan で upload する (= 消失させない)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = { setDoc: 0, createdViaSetDoc: [] as any[] };

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
        setDoc: vi.fn(async (ref: any, data: any) => { calls.setDoc++; calls.createdViaSetDoc.push({ ref, data }); }),
        writeBatch: vi.fn(() => ({ update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}) })),
        serverTimestamp: vi.fn(() => 'ts'),
        increment: vi.fn((n: number) => n),
        Timestamp,
    };
});

vi.mock('../firebase', () => ({ db: {} }));

import { planService } from '../planService';
import * as fs from 'firebase/firestore';
import type { SavedPlan } from '../../types';

const UID = 'user-123';

function makePlan(id: string, ownerId: string, updatedAt = 2000): SavedPlan {
    return {
        id, ownerId, ownerDisplayName: '', title: id, contentId: 'm1s',
        isPublic: false, copyCount: 0, useCount: 0,
        data: {} as any, createdAt: 1000, updatedAt,
    };
}

beforeEach(() => {
    calls.setDoc = 0;
    calls.createdViaSetDoc = [];
    vi.mocked(fs.getDocFromServer).mockResolvedValue({ exists: () => false, data: () => undefined } as any);
});

describe('updatePlan 墓標対応', () => {
    it('リモートが墓標 (deleted:true) のとき復活させず deleted_remotely を返す', async () => {
        const Timestamp = (fs as any).Timestamp;
        vi.mocked(fs.getDocFromServer).mockResolvedValue({
            exists: () => true,
            data: () => ({
                ownerId: UID, version: 1, updatedAt: new Timestamp(9999),
                deleted: true,
            }),
        } as any);

        const result = await planService.updatePlan(makePlan('p1', UID, 1000), UID);

        expect(result).toBe('deleted_remotely');
        // setDoc (= 書き戻し) は呼ばれない
        expect(calls.setDoc).toBe(0);
    });

    it('リモートに doc が無い (未同期) ときは NOT_EXISTS を投げる (呼び出し側で create)', async () => {
        vi.mocked(fs.getDocFromServer).mockResolvedValue({ exists: () => false, data: () => undefined } as any);

        await expect(planService.updatePlan(makePlan('p2', UID, 1000), UID)).rejects.toThrow('NOT_EXISTS');
    });
});

describe('updatePlan 偽競合コピー防止 (共同編集の serverTimestamp 追い越し)', () => {
    const shared = () => ({
        currentLevel: 90,
        timelineMitigations: [{ id: 'm1', skillId: 's1', time: 5 }],
        timelineEvents: [], phases: [], partyMembers: [],
        aaSettings: { damage: 100, type: 'magical', target: 'MT' },
        schAetherflowPatterns: {},
    });

    it('リモートが新しくても共有中身が同一なら skipped_same_content を返し書き戻さない', async () => {
        const Timestamp = (fs as any).Timestamp;
        vi.mocked(fs.getDocFromServer).mockResolvedValue({
            exists: () => true,
            data: () => ({ ownerId: UID, version: 1, updatedAt: new Timestamp(9999), data: shared() }),
        } as any);

        const local = { ...makePlan('p5', UID, 1000), data: shared() as any };
        const result = await planService.updatePlan(local, UID);

        expect(result).toBe('skipped_same_content');
        // 後勝ち上書き合戦を避けるため書き戻さない
        expect(calls.setDoc).toBe(0);
    });

    it('リモートが新しく共有中身が異なるなら skipped_newer_remote (本物の乖離の退避コピーを残す)', async () => {
        const Timestamp = (fs as any).Timestamp;
        const remoteData = shared();
        const localData = { ...shared(), timelineMitigations: [{ id: 'm1', skillId: 's1', time: 5 }, { id: 'm2', skillId: 's2', time: 20 }] };
        vi.mocked(fs.getDocFromServer).mockResolvedValue({
            exists: () => true,
            data: () => ({ ownerId: UID, version: 1, updatedAt: new Timestamp(9999), data: remoteData }),
        } as any);

        const local = { ...makePlan('p6', UID, 1000), data: localData as any };
        const result = await planService.updatePlan(local, UID);

        expect(result).toBe('skipped_newer_remote');
        expect(calls.setDoc).toBe(0);
    });
});

describe('migrateLocalPlansToFirestore 墓標/ローカル削除対応', () => {
    it('ローカル既知削除ID はリモートに live で存在しても復活させない', async () => {
        // サーバには live で残っている (削除が未同期) プラン
        vi.mocked(fs.getDocsFromServer).mockResolvedValue({
            docs: [{ id: 'p10', data: () => ({
                ownerId: UID, ownerDisplayName: '', title: 'p10', contentId: 'm1s',
                isPublic: false, shareId: null, copyCount: 0, useCount: 0,
                data: {}, version: 1, createdAt: undefined, updatedAt: undefined,
            }) }],
        } as any);

        const { merged } = await planService.migrateLocalPlansToFirestore(
            [], UID, new Set(['p10']),
        );

        expect(merged.map(p => p.id)).not.toContain('p10');
    });
});

describe('syncDirtyPlans 墓標対応', () => {
    it('未同期 (リモート未存在) の dirty プランは createPlan で upload し、deletedRemotely に入れない', async () => {
        // updatePlan は NOT_EXISTS で throw → createPlan フォールバック (setDoc される)
        vi.mocked(fs.getDocFromServer).mockResolvedValue({ exists: () => false, data: () => undefined } as any);

        const plan = makePlan('p3', UID, 1000);
        const { deletedRemotely } = await planService.syncDirtyPlans(
            new Set(['p3']), [plan], UID, 'Name',
        );

        expect(deletedRemotely).not.toContain('p3');
        // createPlan が setDoc でプラン本体を書いた
        expect(calls.createdViaSetDoc.some(c => c.ref.id === 'p3')).toBe(true);
    });

    it('リモートが墓標の dirty プランは deletedRemotely に入る (復活させない)', async () => {
        const Timestamp = (fs as any).Timestamp;
        vi.mocked(fs.getDocFromServer).mockResolvedValue({
            exists: () => true,
            data: () => ({ ownerId: UID, version: 1, updatedAt: new Timestamp(9999), deleted: true }),
        } as any);

        const plan = makePlan('p4', UID, 1000);
        const { deletedRemotely, conflicted } = await planService.syncDirtyPlans(
            new Set(['p4']), [plan], UID, 'Name',
        );

        expect(deletedRemotely).toContain('p4');
        expect(conflicted.map(p => p.id)).not.toContain('p4');
    });
});

describe('syncDirtyPlans 偽競合コピー防止 (共同編集)', () => {
    const shared = () => ({
        currentLevel: 90,
        timelineMitigations: [{ id: 'm1', skillId: 's1', time: 5 }],
        timelineEvents: [], phases: [], partyMembers: [],
        aaSettings: { damage: 100, type: 'magical', target: 'MT' },
        schAetherflowPatterns: {},
    });

    it('共有中身が同一の dirty プランは conflicted に入らない (偽コピーを作らない)', async () => {
        const Timestamp = (fs as any).Timestamp;
        vi.mocked(fs.getDocFromServer).mockResolvedValue({
            exists: () => true,
            data: () => ({ ownerId: UID, version: 1, updatedAt: new Timestamp(9999), data: shared() }),
        } as any);

        const plan = { ...makePlan('p7', UID, 1000), data: shared() as any };
        const { conflicted, deletedRemotely } = await planService.syncDirtyPlans(
            new Set(['p7']), [plan], UID, 'Name',
        );

        expect(conflicted).toHaveLength(0);
        expect(deletedRemotely).toHaveLength(0);
        expect(calls.setDoc).toBe(0);
    });

    it('共有中身が異なる dirty プランは conflicted に入る (本物の乖離の退避コピーを残す)', async () => {
        const Timestamp = (fs as any).Timestamp;
        const localData = { ...shared(), timelineMitigations: [{ id: 'm1', skillId: 's1', time: 5 }, { id: 'm2', skillId: 's2', time: 20 }] };
        vi.mocked(fs.getDocFromServer).mockResolvedValue({
            exists: () => true,
            data: () => ({ ownerId: UID, version: 1, updatedAt: new Timestamp(9999), data: shared() }),
        } as any);

        const plan = { ...makePlan('p8', UID, 1000), data: localData as any };
        const { conflicted } = await planService.syncDirtyPlans(
            new Set(['p8']), [plan], UID, 'Name',
        );

        expect(conflicted.map(p => p.id)).toContain('p8');
    });
});
