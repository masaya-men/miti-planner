/**
 * 同期マージ 再現テスト (2026-06-03)
 *
 * 目的: 「別端末で消失」「削除→復活」の根本原因を、本番コードを変えずに
 *       実際のマージ関数 (planService.fetchAndMerge) の挙動で実証する。
 *
 * 仮説: マージは「リモートに存在するか」だけで判断し、
 *       - 「未同期(まだ上げてない)」と「他端末で削除された」を区別できない
 *       → 未同期ローカルを drop (消失) / 削除済みリモートを re-add (復活)
 *
 * 本テストは現状の挙動を実証するためのもの。
 * - 【消失】は「望ましい安全挙動」をアサート → 現状 FAIL (=バグ再現)
 * - 【復活】は「現状の挙動」を固定 (characterization) → 現状 PASS (=復活の温床を確認)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// firebase/firestore を最小モック (planService が import する named export を全て用意)
vi.mock('firebase/firestore', () => {
    class Timestamp {
        constructor(public ms: number) {}
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

/** getDocsFromServer (= fetchUserPlans の取得元) が返すリモートを差し替える。 */
function setRemote(plans: SavedPlan[]) {
    const docs = plans.map(p => ({ id: p.id, data: () => ({ ...p }) }));
    vi.mocked(fs.getDocsFromServer).mockResolvedValue({ docs } as any);
}

beforeEach(() => {
    setRemote([]);
});

describe('同期マージ 再現テスト', () => {
    // it.fails: 現状は「消失バグ」で必ず失敗する。これを既知失敗として固定し、スイートは緑のまま。
    // 修正が入ってアサートが通るようになると it.fails が逆に失敗 → 「直った」合図になる。
    it.fails('【消失・既知バグ】未同期のログイン作成プラン (ownerId=uid・リモート未存在) が fetchAndMerge で残らない', async () => {
        const local = [makePlan('p1', UID)];
        setRemote([]); // まだ一度も同期されていない

        const { merged } = await planService.fetchAndMerge(local, UID);

        // 望ましい安全挙動: 未同期なら消さず残す (=次回アップロード対象)。
        // 現状はリモートに無い=削除と推測して drop するため、このアサートは FAIL する (=消失の再現)。
        expect(merged.map(p => p.id)).toContain('p1');
    });

    it('【参考: ローカル作成 ownerId=local は残る】', async () => {
        const local = [makePlan('p2', 'local')];
        setRemote([]);

        const { merged } = await planService.fetchAndMerge(local, UID);

        // ownerId='local' は「未ログイン作成」扱いで残る。ownerId=uid との差が消失の分かれ目。
        expect(merged.map(p => p.id)).toContain('p2');
    });

    it('【復活の温床】リモートにのみ存在するプランは無条件で re-add される (削除認識なし)', async () => {
        const deletedButStillRemote = makePlan('p3', UID);
        setRemote([deletedButStillRemote]); // 削除をリモート反映できないまま残っている想定

        const { merged } = await planService.fetchAndMerge([], UID);

        // fetchAndMerge は「これは削除済み」を知る手段(墓標)を持たないため、必ず復活する。
        // 現状の挙動を固定 (characterization)。
        expect(merged.map(p => p.id)).toContain('p3');
    });
});
