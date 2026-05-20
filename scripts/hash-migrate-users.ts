/**
 * hash-migrate-users.ts
 * Discord 10 件の Firebase uid を discord:<生 ID> → hashed:<HMAC-SHA256(id+secret)> に移行。
 *
 * モード:
 *   - npx tsx scripts/hash-migrate-users.ts --backup                               → 事前一括 backup
 *   - npx tsx scripts/hash-migrate-users.ts                                        → Dry-Run (デフォルト)
 *   - npx tsx scripts/hash-migrate-users.ts --execute --confirm --only=<oldUid>    → 人柱 (1 件のみ)
 *   - npx tsx scripts/hash-migrate-users.ts --execute --confirm                    → 全件 migration
 *   - npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid=<oldUid>    → 1 件 rollback
 *
 * 設計書: docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md
 * 実装プラン: docs/superpowers/plans/2026-05-20-hash-migration-step2.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ParsedFlags {
    mode: 'dry-run' | 'backup' | 'execute' | 'rollback';
    backup: boolean;
    execute: boolean;
    confirm: boolean;
    rollback: boolean;
    only: string | undefined;
    uid: string | undefined;
}

export function parseFlags(argv: string[]): ParsedFlags {
    const set = new Set(argv);
    const only = argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
    const uid = argv.find((a) => a.startsWith('--uid='))?.slice('--uid='.length);
    const backup = set.has('--backup');
    const execute = set.has('--execute');
    const confirm = set.has('--confirm');
    const rollback = set.has('--rollback');
    const mode = backup ? 'backup' : rollback ? 'rollback' : execute ? 'execute' : 'dry-run';
    return { mode, backup, execute, confirm, rollback, only, uid };
}

export function assertPrefixSafe(uids: string[]): void {
    if (uids.length === 0) {
        throw new Error('TARGET_UIDS is empty');
    }
    for (const uid of uids) {
        if (uid.startsWith('hashed:')) {
            throw new Error(`hashed: uid is not allowed in TARGET_UIDS (already migrated?): ${uid}`);
        }
        if (uid.startsWith('twitter:')) {
            throw new Error(`twitter: uid is not allowed in TARGET_UIDS (legacy provider): ${uid}`);
        }
        if (uid.startsWith('google:')) {
            throw new Error(`google: uid is not allowed in TARGET_UIDS (legacy provider): ${uid}`);
        }
        if (!uid.startsWith('discord:')) {
            throw new Error(`Unexpected prefix in TARGET_UIDS: ${uid}`);
        }
    }
}

export function loadTargetUids(jsonPath: string): string[] {
    let raw: string;
    try {
        raw = readFileSync(jsonPath, 'utf-8');
    } catch {
        throw new Error(`TARGET_UIDS ファイル ${jsonPath} が読めません。 docs/.private/2026-05-19-hash-migration-prep.md から uid を転記してください`);
    }
    const parsed = JSON.parse(raw) as { discord?: string[] };
    const uids = parsed.discord ?? [];
    if (uids.some((u) => u.includes('REPLACE_ME'))) {
        throw new Error(`TARGET_UIDS にプレースホルダー REPLACE_ME が残っています: ${jsonPath}`);
    }
    return uids;
}

function loadEnv(filePath: string): Record<string, string> {
    const text = readFileSync(filePath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }
    return env;
}

// スクリプトとして直接実行されたときのみ Firebase 初期化・処理を行う。
// import されたとき（vitest 等）は pure function のみエクスポートする。
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

if (isMain) {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');
    const { getStorage } = await import('firebase-admin/storage');
    const { hashUid } = await import('../api/_lib/hashUid.js');

    const ROOT = resolve(import.meta.dirname, '..');
    const env = loadEnv(resolve(ROOT, '.env.local'));

    const projectId = env.FIREBASE_PROJECT_ID;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const storageBucket = env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app';
    const secret = env.LOPO_PSEUDONYM_SECRET || '';

    if (!projectId || !clientEmail || !privateKey) {
        console.error('❌ FIREBASE 認証情報が .env.local にありません');
        process.exit(1);
    }
    if (!secret || secret.length < 32) {
        console.error('❌ LOPO_PSEUDONYM_SECRET が .env.local にありません (32 文字以上の hex を期待)');
        process.exit(1);
    }

    if (!getApps().length) {
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket });
    }
    const db = getFirestore();
    const auth = getAuth();
    const bucket = getStorage().bucket();

    const BACKUP_DIR = resolve(ROOT, 'docs/.private/backups/2026-05-20-pre-hash');
    const TARGET_JSON_PATH = resolve(ROOT, 'docs/.private/hash-migration-target-uids.json');

    // 将来の Task で使用する変数を参照して未使用警告を回避
    void db; void auth; void bucket; void hashUid;
    void writeFileSync; void existsSync; void mkdirSync; void join;
    void BACKUP_DIR;

    async function main() {
        const flags = parseFlags(process.argv.slice(2));
        const targetUids = loadTargetUids(TARGET_JSON_PATH);

        console.log(`Mode: ${flags.mode.toUpperCase()}`);
        console.log(`Target uids: ${targetUids.length}`);

        assertPrefixSafe(targetUids);
        console.log('✅ prefix safety check passed');

        if (flags.execute && !flags.confirm) {
            console.error('❌ --execute を指定するときは --confirm も必須です (誤起動防止)');
            process.exit(1);
        }
        if (flags.rollback && !flags.confirm) {
            console.error('❌ --rollback を指定するときは --confirm も必須です (誤起動防止)');
            process.exit(1);
        }
        if (flags.rollback && !flags.uid) {
            console.error('❌ --rollback には --uid=<oldUid> 必須');
            process.exit(1);
        }

        // 各モードの実装は後続 Task で追加
        console.log(`(Mode ${flags.mode} の処理は未実装)`);
    }

    await main().then(() => process.exit(0)).catch((err: unknown) => {
        console.error('エラー:', err);
        process.exit(1);
    });
}
