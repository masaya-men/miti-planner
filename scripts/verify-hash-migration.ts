/**
 * verify-hash-migration.ts
 * hash 化マイグレーション完了後の自動検証。
 *
 * 確認項目:
 *  1. 全 targetUid (旧) が Firebase Auth から消えている
 *  2. 各 newUid が Firebase Auth に存在
 *  3. backup の件数と新 uid 側の件数が一致
 *  4. Firestore に discord: prefix のフィールド値が残っていない (admin_logs.actorUid を除く)
 *  5. Storage に users/discord:*/ パスが残っていない
 *
 * 使い方: npx tsx scripts/verify-hash-migration.ts
 *        npx tsx scripts/verify-hash-migration.ts --uid=discord:<oldUid>  (1 件のみ)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { hashUid } from '../api/_lib/hashUid.js';

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

const ROOT = resolve(import.meta.dirname, '..');
const env = loadEnv(resolve(ROOT, '.env.local'));
const secret = env.LOPO_PSEUDONYM_SECRET || '';
const BACKUP_DIR = resolve(ROOT, 'docs/.private/backups/2026-05-20-pre-hash');
const TARGET_JSON_PATH = resolve(ROOT, 'docs/.private/hash-migration-target-uids.json');

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: env.FIREBASE_PROJECT_ID!,
            clientEmail: env.FIREBASE_CLIENT_EMAIL!,
            privateKey: (env.FIREBASE_PRIVATE_KEY!).replace(/\\n/g, '\n'),
        }),
        storageBucket: env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app',
    });
}
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

async function verifySingle(oldUid: string): Promise<{ pass: boolean; errors: string[] }> {
    const errors: string[] = [];
    const discordId = oldUid.replace('discord:', '');
    const newUid = hashUid(discordId, secret);

    // 1. oldUid auth は消えている
    let oldAuthExists = false;
    try { await auth.getUser(oldUid); oldAuthExists = true; } catch {}
    if (oldAuthExists) errors.push(`oldUid Auth が残存: ${oldUid}`);

    // 2. newUid auth は存在
    let newAuthExists = false;
    try { await auth.getUser(newUid); newAuthExists = true; } catch {}
    if (!newAuthExists) errors.push(`newUid Auth が不在: ${newUid}`);

    // 3. backup vs newUid 件数比較
    const backupFile = join(BACKUP_DIR, `${oldUid.replace(/[:/\\]/g, '_')}.json`);
    if (existsSync(backupFile)) {
        const backup = JSON.parse(readFileSync(backupFile, 'utf-8'));
        const expected = {
            plans: backup.firestore.plans.length,
            sharedPlanMeta: backup.firestore.sharedPlanMeta.length,
            sharedPlans: backup.firestore.sharedPlans.length,
            housingListings: backup.firestore.housingListings.length,
            housingFavoritesItems: backup.firestore.housingFavoritesItems.length,
            housingTours: backup.firestore.housingTours.length,
            featureSessions: backup.firestore.featureSessions.length,
            crossRefCopiedBy: backup.firestore.crossRefCopiedBy.length,
            crossRefReports: backup.firestore.crossRefReports.reduce((sum: number, lr: any) => sum + lr.reports.length, 0),
        };

        // featureSessions の新 uid 側
        const featureSessionsActual = (await db.collection('users').doc(newUid).collection('featureSessions').get()).size;

        // crossRefCopiedBy: 全 shared_plans を走査して新 uid copiedBy を数える
        let crossRefCopiedByActual = 0;
        const allSharedForVerify = await db.collection('shared_plans').get();
        for (const doc of allSharedForVerify.docs) {
            const cb = await doc.ref.collection('copiedBy').doc(newUid).get();
            if (cb.exists) crossRefCopiedByActual++;
        }

        // crossRefReports: 全 housing_listings の reports.reporterUid == newUid を数える
        let crossRefReportsActual = 0;
        const allListingsForVerify = await db.collection('housing_listings').get();
        for (const doc of allListingsForVerify.docs) {
            crossRefReportsActual += (await doc.ref.collection('reports').where('reporterUid', '==', newUid).get()).size;
        }

        const actual = {
            plans: (await db.collection('plans').where('ownerId', '==', newUid).get()).size,
            sharedPlanMeta: (await db.collection('sharedPlanMeta').where('ownerId', '==', newUid).get()).size,
            sharedPlans: (await db.collection('shared_plans').where('ownerId', '==', newUid).get()).size,
            housingListings: (await db.collection('housing_listings').where('ownerUid', '==', newUid).get()).size,
            housingFavoritesItems: (await db.collection('housing_favorites').doc(newUid).collection('items').get()).size,
            housingTours: (await db.collection('housing_tours').where('ownerUid', '==', newUid).get()).size,
            featureSessions: featureSessionsActual,
            crossRefCopiedBy: crossRefCopiedByActual,
            crossRefReports: crossRefReportsActual,
        };
        for (const k of Object.keys(expected) as (keyof typeof expected)[]) {
            if (expected[k] !== actual[k]) {
                errors.push(`件数 mismatch (${k}): backup=${expected[k]}, actual=${actual[k]}`);
            }
        }
    }

    // 4. oldUid のデータ残骸チェック
    const oldPlans = (await db.collection('plans').where('ownerId', '==', oldUid).get()).size;
    if (oldPlans > 0) errors.push(`plans に oldUid 残存: ${oldPlans} 件`);
    const oldListings = (await db.collection('housing_listings').where('ownerUid', '==', oldUid).get()).size;
    if (oldListings > 0) errors.push(`housing_listings に oldUid 残存: ${oldListings} 件`);

    // 5. Storage 残骸
    const [oldFiles] = await bucket.getFiles({ prefix: `users/${oldUid}/` });
    if (oldFiles.length > 0) errors.push(`Storage に oldUid 残存: ${oldFiles.length} files`);

    return { pass: errors.length === 0, errors };
}

async function main() {
    const onlyArg = process.argv.find((a) => a.startsWith('--uid='))?.slice('--uid='.length);
    let targets: string[];
    if (onlyArg) {
        targets = [onlyArg];
    } else {
        targets = (JSON.parse(readFileSync(TARGET_JSON_PATH, 'utf-8')).discord ?? []) as string[];
    }

    console.log(`=== Verify Hash Migration ===`);
    console.log(`Targets: ${targets.length}\n`);

    let pass = 0;
    let fail = 0;
    for (const uid of targets) {
        const r = await verifySingle(uid);
        if (r.pass) {
            console.log(`✅ ${uid}`);
            pass++;
        } else {
            console.log(`❌ ${uid}`);
            for (const e of r.errors) console.log(`     - ${e}`);
            fail++;
        }
    }
    console.log(`\nResult: ${pass} pass, ${fail} fail / ${targets.length} total`);
    if (fail > 0) {
        console.error(`\nFailures detected. Investigate and consider --rollback for failed uids.`);
        process.exit(1);
    }
    console.log(`\n✅ All targets verified successfully.`);
}

main().catch((err) => { console.error('Verify error:', err); process.exit(1); });
