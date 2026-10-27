import { hashUid, secret, db, auth, bucket } from './context.js';
import type { MigrateResult } from './types.js';
import { copyDocByQuery, copyDoc, copySubcollection, deleteSubcollection, copyStorage, deleteStorage, handlePreExistingNewUid } from './firestore-ops.js';

    // ===== Core per-user migration =====

    export async function migrateSingleUser(oldUid: string): Promise<MigrateResult> {
        const discordId = oldUid.replace('discord:', '');
        const newUid = hashUid(discordId, secret);
        const result: MigrateResult = {
            oldUid, newUid, success: false, error: null,
            counts: { firestoreCopied: 0, firestoreDeleted: 0, storageCopied: 0, storageDeleted: 0, crossRefUpdated: 0, windowSweepData: null },
        };

        try {
            // Step 1 (順序修正): 旧 uid の Auth 確認 (既に migration 済なら skip) ← 「窓」 対策より先
            // 理由: 既に migration 済の uid を再 execute した場合、 newUid Auth は「正規の migrate 結果」
            // であり、 「窓で先回りログインした空アカウント」 ではない。 順序を間違えて window sweep を
            // 先にすると、 正規の newUid アカウントを誤って削除してしまう (2026-05-20 セッション 41 で発生)。
            const oldUser = await auth.getUser(oldUid).catch((err) => {
                if ((err as { code?: string })?.code === 'auth/user-not-found') return null;
                throw err;
            });
            if (!oldUser) {
                // 旧 uid が消えている = (a) 未 signup or (b) 既に migration 済の 2 パターン。 (b) を判定
                const newAuthExists = await auth.getUser(newUid).then(() => true).catch(() => false);
                if (newAuthExists) {
                    result.success = true;
                    result.error = 'already migrated (oldUid removed, newUid exists)';
                    console.log(`  ⏭️  Already migrated, skip: ${oldUid}`);
                    return result;
                }
                throw new Error(`oldUid ${oldUid} does not exist in Firebase Auth and newUid also missing`);
            }

            // Step 2 (順序修正): 「窓」 対策 — oldUid が存在することを確認した後に実施
            // (oldUid 存在 = まだ migration されてない状態。 newUid 存在ならデプロイ後 migration 前に
            // 先回りログインした空アカウントの可能性。 安全に削除可能)
            const windowCheck = await handlePreExistingNewUid(newUid);
            if (windowCheck.existed) {
                result.counts.windowSweepData = windowCheck.preservedData;
                console.log(`  Window sweep: pre-existing newUid removed (data preserved in result)`);
            }

            // Step 2: per-user 直前 backup (メモリ内のみ、 disk backup は事前 backup で実施済の前提)
            // (disk backup file の存在を確認することで二重防御とする = dry-run で verify 済)

            // Step 3: 新 Auth ユーザー作成
            await auth.createUser({
                uid: newUid,
                disabled: false,
            });

            // Step 4: admin claim 再付与
            if (oldUser.customClaims && Object.keys(oldUser.customClaims).length > 0) {
                await auth.setCustomUserClaims(newUid, oldUser.customClaims);
                console.log(`  ✅ admin claim re-applied: ${JSON.stringify(oldUser.customClaims)}`);
            }

            // Step 5: Firestore コピー (doc id が uid)
            const usersCopied = await copyDoc(db.collection('users').doc(oldUid), db.collection('users').doc(newUid));
            if (usersCopied) result.counts.firestoreCopied++;

            const countCopied = await copyDoc(db.collection('userPlanCounts').doc(oldUid), db.collection('userPlanCounts').doc(newUid));
            if (countCopied) result.counts.firestoreCopied++;

            const metaCopied = await copyDoc(db.collection('housing_user_meta').doc(oldUid), db.collection('housing_user_meta').doc(newUid));
            if (metaCopied) result.counts.firestoreCopied++;

            const favCopied = await copyDoc(db.collection('housing_favorites').doc(oldUid), db.collection('housing_favorites').doc(newUid));
            if (favCopied) result.counts.firestoreCopied++;
            result.counts.firestoreCopied += await copySubcollection(
                db.collection('housing_favorites').doc(oldUid),
                db.collection('housing_favorites').doc(newUid),
                'items'
            );

            result.counts.firestoreCopied += await copySubcollection(
                db.collection('users').doc(oldUid),
                db.collection('users').doc(newUid),
                'featureSessions'
            );

            // Step 6: Firestore コピー (フィールド値が uid)
            result.counts.firestoreCopied += await copyDocByQuery(
                db.collection('plans').where('ownerId', '==', oldUid),
                'ownerId', newUid
            );
            result.counts.firestoreCopied += await copyDocByQuery(
                db.collection('sharedPlanMeta').where('ownerId', '==', oldUid),
                'ownerId', newUid
            );
            result.counts.firestoreCopied += await copyDocByQuery(
                db.collection('shared_plans').where('ownerId', '==', oldUid),
                'ownerId', newUid
            );
            result.counts.firestoreCopied += await copyDocByQuery(
                db.collection('housing_listings').where('ownerUid', '==', oldUid),
                'ownerUid', newUid
            );
            result.counts.firestoreCopied += await copyDocByQuery(
                db.collection('housing_tours').where('ownerUid', '==', oldUid),
                'ownerUid', newUid
            );

            // housing_listings の reports.reporterUid (全 listing 走査)
            const allListings = await db.collection('housing_listings').get();
            for (const doc of allListings.docs) {
                result.counts.firestoreCopied += await copyDocByQuery(
                    doc.ref.collection('reports').where('reporterUid', '==', oldUid),
                    'reporterUid', newUid
                );
            }

            // Cross-references: 他人の shared_plans/*/copiedBy/{oldUid} → /{newUid}
            const allShared = await db.collection('shared_plans').get();
            for (const doc of allShared.docs) {
                const oldCbRef = doc.ref.collection('copiedBy').doc(oldUid);
                const snap = await oldCbRef.get();
                if (snap.exists) {
                    await doc.ref.collection('copiedBy').doc(newUid).set(snap.data()!);
                    await oldCbRef.delete();
                    result.counts.crossRefUpdated++;
                }
            }

            // Step 7: Storage コピー
            const storageResult = await copyStorage(oldUid, newUid);
            result.counts.storageCopied = storageResult.copied;

            // Step 7b: users/{newUid} doc 内の avatarUrl / teamLogoUrl の URL パスを更新
            // Storage ファイル実在チェック付き (存在しなければ URL をクリア = 壊れた URL を残さない)
            const newUserDocAfterCopy = await db.collection('users').doc(newUid).get();
            if (newUserDocAfterCopy.exists) {
                const userData = newUserDocAfterCopy.data()!;
                const urlUpdates: Record<string, string> = {};
                const oldEncoded = encodeURIComponent(oldUid);
                const newEncoded = encodeURIComponent(newUid);
                const clearedFields: string[] = [];

                if (typeof userData.avatarUrl === 'string' && userData.avatarUrl.includes(oldEncoded)) {
                    const [avatarExists] = await bucket.file(`users/${newUid}/avatar.webp`).exists();
                    if (avatarExists) {
                        urlUpdates.avatarUrl = userData.avatarUrl.replace(oldEncoded, newEncoded);
                    } else {
                        urlUpdates.avatarUrl = '';
                        clearedFields.push('avatarUrl');
                    }
                }

                if (typeof userData.teamLogoUrl === 'string' && userData.teamLogoUrl.includes(oldEncoded)) {
                    const ext = userData.teamLogoUrl.includes('team-logo.webp') ? 'webp' : 'jpg';
                    const [logoExists] = await bucket.file(`users/${newUid}/team-logo.${ext}`).exists();
                    if (logoExists) {
                        urlUpdates.teamLogoUrl = userData.teamLogoUrl.replace(oldEncoded, newEncoded);
                    } else {
                        urlUpdates.teamLogoUrl = '';
                        clearedFields.push('teamLogoUrl');
                    }
                }

                if (Object.keys(urlUpdates).length > 0) {
                    await db.collection('users').doc(newUid).update(urlUpdates);
                    const msg = clearedFields.length > 0
                        ? `cleared ${clearedFields.join('+')} (Storage missing, ユーザーに再アップロード依頼が必要)`
                        : `updated ${Object.keys(urlUpdates).join('+')}`;
                    console.log(`  ✅ Storage URLs: ${msg}`);
                    result.counts.firestoreCopied++;
                }
            }

            // Step 8: Verify (各 collection の oldUid 残存ゼロを確認)
            const verifyChecks = [
                { coll: 'plans', field: 'ownerId' },
                { coll: 'sharedPlanMeta', field: 'ownerId' },
                { coll: 'shared_plans', field: 'ownerId' },
                { coll: 'housing_listings', field: 'ownerUid' },
                { coll: 'housing_tours', field: 'ownerUid' },
            ];
            for (const v of verifyChecks) {
                const oldRemaining = (await db.collection(v.coll).where(v.field, '==', oldUid).get()).size;
                if (oldRemaining !== 0) {
                    throw new Error(`Verify failed: ${v.coll}.${v.field} に oldUid 残存 ${oldRemaining} 件 (should be 0)`);
                }
            }

            // Step 9: 旧 uid 全削除
            await db.collection('users').doc(oldUid).delete().catch(() => {});
            await db.collection('userPlanCounts').doc(oldUid).delete().catch(() => {});
            await db.collection('housing_user_meta').doc(oldUid).delete().catch(() => {});
            await deleteSubcollection(db.collection('housing_favorites').doc(oldUid), 'items');
            await db.collection('housing_favorites').doc(oldUid).delete().catch(() => {});
            await deleteSubcollection(db.collection('users').doc(oldUid), 'featureSessions');
            result.counts.firestoreDeleted += 5;
            result.counts.storageDeleted = await deleteStorage(oldUid);
            await auth.deleteUser(oldUid);

            result.success = true;
        } catch (err) {
            result.error = (err as { message?: string })?.message || String(err);
            result.success = false;
            console.error(`  ❌ FAILED: ${result.error}`);
            console.error(`  Initiating per-user auto-rollback...`);
            await autoRollbackOnFailure(oldUid, newUid);
        }

        return result;
    }

    async function autoRollbackOnFailure(oldUid: string, newUid: string): Promise<void> {
        try {
            await auth.deleteUser(newUid).catch(() => {});
            await db.collection('users').doc(newUid).delete().catch(() => {});
            await db.collection('userPlanCounts').doc(newUid).delete().catch(() => {});
            await db.collection('housing_user_meta').doc(newUid).delete().catch(() => {});
            await deleteSubcollection(db.collection('housing_favorites').doc(newUid), 'items');
            await db.collection('housing_favorites').doc(newUid).delete().catch(() => {});
            await deleteSubcollection(db.collection('users').doc(newUid), 'featureSessions');
            // フィールド値を newUid → oldUid に戻す
            await copyDocByQuery(db.collection('plans').where('ownerId', '==', newUid), 'ownerId', oldUid);
            await copyDocByQuery(db.collection('sharedPlanMeta').where('ownerId', '==', newUid), 'ownerId', oldUid);
            await copyDocByQuery(db.collection('shared_plans').where('ownerId', '==', newUid), 'ownerId', oldUid);
            await copyDocByQuery(db.collection('housing_listings').where('ownerUid', '==', newUid), 'ownerUid', oldUid);
            await copyDocByQuery(db.collection('housing_tours').where('ownerUid', '==', newUid), 'ownerUid', oldUid);
            // Cross-references: housing_listings/*/reports.reporterUid (newUid → oldUid) を全戻し
            const allListingsForRollback = await db.collection('housing_listings').get();
            for (const doc of allListingsForRollback.docs) {
                await copyDocByQuery(
                    doc.ref.collection('reports').where('reporterUid', '==', newUid),
                    'reporterUid', oldUid
                );
            }
            // Cross-references: shared_plans/*/copiedBy/{newUid} → copiedBy/{oldUid} を全戻し
            const allSharedForRollback = await db.collection('shared_plans').get();
            for (const doc of allSharedForRollback.docs) {
                const newCbRef = doc.ref.collection('copiedBy').doc(newUid);
                const snap = await newCbRef.get();
                if (snap.exists) {
                    await doc.ref.collection('copiedBy').doc(oldUid).set(snap.data()!);
                    await newCbRef.delete();
                }
            }
            await deleteStorage(newUid);
            console.error(`  ✅ Auto-rollback complete for ${oldUid}`);
        } catch (rollbackErr) {
            console.error(`  ❌ AUTO-ROLLBACK FAILED: ${(rollbackErr as { message?: string })?.message || rollbackErr}`);
            console.error(`  Manual intervention required. Run: npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid=${oldUid}`);
        }
    }
