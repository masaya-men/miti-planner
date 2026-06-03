/**
 * 同期マージ 回帰テスト (2026-06-03)
 *
 * もともと「別端末で消失」「削除→復活」を再現するための characterization テストだったが、
 * ソフトデリート (墓標) 導入で根治したため、回帰ガードに昇格した。
 *
 * 検証する正しい挙動 (墓標ベース):
 * - 未同期ローカル (リモート live 無し + 墓標無し) → 残す (消失の根治)
 * - 墓標があるローカル / 墓標のみリモート → 除去・復活させない (復活の根治)
 * - リモートのみ live → 追加 (他端末作成)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase/firestore を最小モック (planService が import する named export を全て用意)
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

// 実 Firebase 初期化を避ける
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

/**
 * getDocsFromServer (= fetchUserPlans の取得元) が返すリモートを差し替える。
 * deleted:true を渡すと墓標として扱われる。
 */
function setRemote(plans: Array<SavedPlan & { deleted?: boolean }>) {
    const docs = plans.map(p => ({ id: p.id, data: () => ({ ...p }) }));
    vi.mocked(fs.getDocsFromServer).mockResolvedValue({ docs } as any);
}

beforeEach(() => {
    setRemote([]);
});

describe('同期マージ 回帰テスト (墓標ベース)', () => {
    it('【消失の根治】未同期のログイン作成プラン (ownerId=uid・リモート未存在・墓標無し) は残る', async () => {
        const local = [makePlan('p1', UID)];
        setRemote([]); // まだ一度も同期されていない

        const { merged } = await planService.fetchAndMerge(local, UID);

        // 墓標が無い = 未同期。drop せず残す (= 次回アップロード対象)。
        expect(merged.map(p => p.id)).toContain('p1');
    });

    it('【参考: ローカル作成 ownerId=local も残る】', async () => {
        const local = [makePlan('p2', 'local')];
        setRemote([]);

        const { merged } = await planService.fetchAndMerge(local, UID);

        expect(merged.map(p => p.id)).toContain('p2');
    });

    it('【復活の根治】墓標 (deleted:true) のみリモートに残っていても復活しない', async () => {
        const tombstone = { ...makePlan('p3', UID), deleted: true };
        setRemote([tombstone]); // 削除済みだが GC 前で doc が残っている

        const { merged } = await planService.fetchAndMerge([], UID);

        // 墓標は live ではないので追加しない。
        expect(merged.map(p => p.id)).not.toContain('p3');
    });

    it('【復活の根治2】ローカルに残っていても墓標があれば除去される', async () => {
        const local = [makePlan('p4', UID)];
        const tombstone = { ...makePlan('p4', UID), deleted: true };
        setRemote([tombstone]);

        const { merged } = await planService.fetchAndMerge(local, UID);

        expect(merged.map(p => p.id)).not.toContain('p4');
    });

    it('【正常: 他端末作成】リモートのみの live プランは追加される', async () => {
        const remoteLive = makePlan('p5', UID);
        setRemote([remoteLive]);

        const { merged } = await planService.fetchAndMerge([], UID);

        expect(merged.map(p => p.id)).toContain('p5');
    });
});
