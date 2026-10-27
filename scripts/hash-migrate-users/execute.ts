import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BACKUP_DIR } from './context.js';
import type { MigrateResult } from './types.js';
import { migrateSingleUser } from './migrate.js';

    // ===== runExecuteMode =====

    export async function runExecuteMode(targetUids: string[], filterOnly: string | undefined): Promise<void> {
        const filtered = filterOnly ? targetUids.filter((u) => u === filterOnly) : targetUids;
        if (filterOnly && filtered.length === 0) {
            console.error(`❌ --only=${filterOnly} は TARGET_UIDS に存在しません`);
            process.exit(1);
        }

        // backup 存在 verify (dry-run と同じチェック)
        const missingBackups = filtered.filter((u) => !existsSync(join(BACKUP_DIR, `${u.replace(/[:/\\]/g, '_')}.json`)));
        if (missingBackups.length > 0) {
            console.error(`❌ 事前 backup 不足: ${missingBackups.length} 件。 --backup を先に実行してください`);
            process.exit(1);
        }

        console.log(`\n=== EXECUTE: Hash Migration ===`);
        console.log(`Target: ${filtered.length} uids${filterOnly ? ` (only=${filterOnly})` : ''}`);
        console.log(`Starting in 5 seconds (Ctrl-C to abort)...\n`);
        await new Promise((r) => setTimeout(r, 5000));

        const results: MigrateResult[] = [];
        for (let i = 0; i < filtered.length; i++) {
            const uid = filtered[i];
            console.log(`\n[${(i + 1).toString().padStart(2)}/${filtered.length}] Migrating ${uid}...`);
            const result = await migrateSingleUser(uid);
            results.push(result);

            if (result.success) {
                console.log(`  ✅ Done: ${uid} → ${result.newUid.slice(0, 32)}...`);
                console.log(`     firestore: ${result.counts.firestoreCopied} copied, ${result.counts.firestoreDeleted} deleted`);
                console.log(`     storage: ${result.counts.storageCopied} copied, ${result.counts.storageDeleted} deleted`);
                console.log(`     cross-ref: ${result.counts.crossRefUpdated} updated`);
            } else {
                console.error(`  ❌ FAILED on ${uid}: ${result.error}`);
                console.error(`  Stopping execution. ${filtered.length - i - 1} uids unprocessed.`);
                break;
            }
        }

        const success = results.filter((r) => r.success).length;
        const failed = results.length - success;
        console.log(`\n=== Migration Summary ===`);
        console.log(`Success: ${success}/${filtered.length}`);
        console.log(`Failed: ${failed}`);
        if (success > 0) {
            console.log(`\n次のステップ: npx tsx scripts/verify-hash-migration.ts で件数比較検証`);
        }
    }
