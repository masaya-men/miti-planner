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
import { readFileSync } from 'node:fs';
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

// スクリプトとして直接実行されたときのみ Firebase 初期化・処理を行う。
// import されたとき（vitest 等）は pure function のみエクスポートする。
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

if (isMain) {
    const { TARGET_JSON_PATH } = await import('./hash-migrate-users/context.js');
    const { runBackupMode } = await import('./hash-migrate-users/backup.js');
    const { runDryRunMode } = await import('./hash-migrate-users/dryrun.js');
    const { runExecuteMode } = await import('./hash-migrate-users/execute.js');
    const { runRollbackMode } = await import('./hash-migrate-users/rollback.js');
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

        if (flags.mode === 'backup') {
            await runBackupMode(targetUids);
            return;
        }

        if (flags.mode === 'dry-run') {
            await runDryRunMode(targetUids, flags.only);
            return;
        }

        if (flags.mode === 'execute') {
            await runExecuteMode(targetUids, flags.only);
            return;
        }

        if (flags.mode === 'rollback') {
            await runRollbackMode(flags.uid!);
            return;
        }
    }

    await main().then(() => process.exit(0)).catch((err: unknown) => {
        console.error('エラー:', err);
        process.exit(1);
    });
}
