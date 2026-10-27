import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hashUid, secret, db, auth, BACKUP_DIR } from './context.js';
import type { UserBackup } from './types.js';
import { deleteSubcollection, deleteDocsByQuery, deleteStorage } from './firestore-ops.js';

/** バックアップ JSON 内の「ドキュメント id + データ」1 件分(復元時の型付け用)。 */
type BackupDoc = { id: string; sharedPlanId: string; data: FirebaseFirestore.DocumentData };

    export async function runRollbackMode(targetUid: string): Promise<void> {
        const backupFile = join(BACKUP_DIR, `${targetUid.replace(/[:/\\]/g, '_')}.json`);
        if (!existsSync(backupFile)) {
            console.error(`❌ Backup file not found: ${backupFile}`);
            process.exit(1);
        }
        const backup: UserBackup = JSON.parse(readFileSync(backupFile, 'utf-8'));
        const oldUid = backup.oldUid;
        const discordId = oldUid.replace('discord:', '');
        const newUid = hashUid(discordId, secret);

        console.log(`\n=== ROLLBACK: ${oldUid} ===`);
        console.log(`From backup: ${backupFile}`);
        console.log(`Backup timestamp: ${backup.timestamp}`);
        console.log(`Computed newUid: ${newUid.slice(0, 32)}...`);
        console.log(`Starting in 5 seconds (Ctrl-C to abort)...\n`);
        await new Promise((r) => setTimeout(r, 5000));

        // 1. 新 uid 側を全削除
        console.log(`Step 1: Deleting newUid side...`);
        await auth.deleteUser(newUid).catch(() => {});
        await db.collection('users').doc(newUid).delete().catch(() => {});
        await db.collection('userPlanCounts').doc(newUid).delete().catch(() => {});
        await db.collection('housing_user_meta').doc(newUid).delete().catch(() => {});
        await deleteSubcollection(db.collection('housing_favorites').doc(newUid), 'items');
        await db.collection('housing_favorites').doc(newUid).delete().catch(() => {});
        await deleteSubcollection(db.collection('users').doc(newUid), 'featureSessions');
        await deleteDocsByQuery(db.collection('plans').where('ownerId', '==', newUid));
        await deleteDocsByQuery(db.collection('sharedPlanMeta').where('ownerId', '==', newUid));
        await deleteDocsByQuery(db.collection('shared_plans').where('ownerId', '==', newUid));
        await deleteDocsByQuery(db.collection('housing_listings').where('ownerUid', '==', newUid));
        await deleteDocsByQuery(db.collection('housing_tours').where('ownerUid', '==', newUid));
        // Cross-references: newUid 側を全削除 (oldUid に戻す前のクリーンアップ)
        const allListingsForRb = await db.collection('housing_listings').get();
        for (const doc of allListingsForRb.docs) {
            await deleteDocsByQuery(doc.ref.collection('reports').where('reporterUid', '==', newUid));
        }
        const allSharedForRb = await db.collection('shared_plans').get();
        for (const doc of allSharedForRb.docs) {
            await doc.ref.collection('copiedBy').doc(newUid).delete().catch(() => {});
        }
        await deleteStorage(newUid);

        // 2. 旧 uid 側を backup から復元
        console.log(`Step 2: Restoring oldUid from backup...`);
        if (backup.auth.exists) {
            await auth.createUser({ uid: oldUid });
            if (backup.auth.customClaims) {
                await auth.setCustomUserClaims(oldUid, backup.auth.customClaims);
            }
        }
        if (backup.firestore.users) {
            await db.collection('users').doc(oldUid).set(backup.firestore.users as Record<string, unknown>);
        }
        if (backup.firestore.userPlanCounts) {
            await db.collection('userPlanCounts').doc(oldUid).set(backup.firestore.userPlanCounts as Record<string, unknown>);
        }
        if (backup.firestore.housingUserMeta) {
            await db.collection('housing_user_meta').doc(oldUid).set(backup.firestore.housingUserMeta as Record<string, unknown>);
        }
        for (const item of backup.firestore.housingFavoritesItems) {
            await db.collection('housing_favorites').doc(oldUid).collection('items').doc((item as BackupDoc).id).set((item as BackupDoc).data);
        }
        for (const sess of backup.firestore.featureSessions) {
            await db.collection('users').doc(oldUid).collection('featureSessions').doc((sess as BackupDoc).id).set((sess as BackupDoc).data);
        }
        for (const p of backup.firestore.plans) {
            await db.collection('plans').doc((p as BackupDoc).id).set((p as BackupDoc).data);
        }
        for (const m of backup.firestore.sharedPlanMeta) {
            await db.collection('sharedPlanMeta').doc((m as BackupDoc).id).set((m as BackupDoc).data);
        }
        for (const sp of backup.firestore.sharedPlans) {
            await db.collection('shared_plans').doc((sp as BackupDoc).id).set((sp as BackupDoc).data);
        }
        for (const cb of backup.firestore.sharedPlansCopiedBy) {
            await db.collection('shared_plans').doc((cb as BackupDoc).sharedPlanId).collection('copiedBy').doc((cb as BackupDoc).id).set((cb as BackupDoc).data);
        }
        for (const l of backup.firestore.housingListings) {
            await db.collection('housing_listings').doc((l as BackupDoc).id).set((l as BackupDoc).data);
        }
        for (const lr of backup.firestore.housingListingsReports) {
            for (const r of lr.reports) {
                await db.collection('housing_listings').doc(lr.listingId).collection('reports').doc((r as BackupDoc).id).set((r as BackupDoc).data);
            }
        }
        for (const t of backup.firestore.housingTours) {
            await db.collection('housing_tours').doc((t as BackupDoc).id).set((t as BackupDoc).data);
        }
        // cross-refs
        for (const cr of backup.firestore.crossRefCopiedBy) {
            await db.collection('shared_plans').doc(cr.sharedPlanId).collection('copiedBy').doc(oldUid).set(cr.data as Record<string, unknown>);
        }
        for (const cr of backup.firestore.crossRefReports) {
            for (const r of cr.reports) {
                await db.collection('housing_listings').doc(cr.listingId).collection('reports').doc((r as BackupDoc).id).set((r as BackupDoc).data);
            }
        }

        // 3. Storage は復元できない (backup には metadata のみ、 ファイル実体は無い)
        if (backup.storage.length > 0) {
            console.log(`Step 3: Storage rollback NOT POSSIBLE (backup contains metadata only, not actual files).`);
            console.log(`  Storage files lost: ${backup.storage.map((s) => s.path).join(', ')}`);
            console.log(`  ユーザーには再アップロードを依頼してください。`);
        }

        console.log(`\n✅ Rollback complete for ${oldUid}`);
    }
