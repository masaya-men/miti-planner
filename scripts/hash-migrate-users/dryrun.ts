import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hashUid, secret, db, auth, bucket, BACKUP_DIR } from './context.js';
import type { PreCount } from './types.js';

    async function preCount(uid: string): Promise<PreCount> {
        const c: PreCount = {
            users: 0, plans: 0, sharedPlanMeta: 0, sharedPlans: 0,
            sharedPlansCopiedBy: 0, sharedPlansAnonCopiedBy: 0,
            userPlanCounts: 0, housingUserMeta: 0,
            housingListings: 0, housingListingsReports: 0,
            housingFavoritesItems: 0, housingTours: 0,
            featureSessions: 0, crossRefCopiedBy: 0, crossRefReports: 0,
            storageFiles: 0, authExists: false, isAdmin: false,
        };

        const userDoc = await db.collection('users').doc(uid).get();
        c.users = userDoc.exists ? 1 : 0;
        c.plans = (await db.collection('plans').where('ownerId', '==', uid).get()).size;
        c.sharedPlanMeta = (await db.collection('sharedPlanMeta').where('ownerId', '==', uid).get()).size;
        const sharedSnap = await db.collection('shared_plans').where('ownerId', '==', uid).get();
        c.sharedPlans = sharedSnap.size;
        for (const doc of sharedSnap.docs) {
            c.sharedPlansCopiedBy += (await doc.ref.collection('copiedBy').get()).size;
            c.sharedPlansAnonCopiedBy += (await doc.ref.collection('anonCopiedBy').get()).size;
        }
        c.userPlanCounts = (await db.collection('userPlanCounts').doc(uid).get()).exists ? 1 : 0;
        c.housingUserMeta = (await db.collection('housing_user_meta').doc(uid).get()).exists ? 1 : 0;
        const listingsSnap = await db.collection('housing_listings').where('ownerUid', '==', uid).get();
        c.housingListings = listingsSnap.size;
        for (const doc of listingsSnap.docs) {
            c.housingListingsReports += (await doc.ref.collection('reports').get()).size;
        }
        c.housingFavoritesItems = (await db.collection('housing_favorites').doc(uid).collection('items').get()).size;
        c.housingTours = (await db.collection('housing_tours').where('ownerUid', '==', uid).get()).size;
        c.featureSessions = (await db.collection('users').doc(uid).collection('featureSessions').get()).size;

        const allShared = await db.collection('shared_plans').get();
        for (const doc of allShared.docs) {
            if ((await doc.ref.collection('copiedBy').doc(uid).get()).exists) c.crossRefCopiedBy++;
        }
        const allListings = await db.collection('housing_listings').get();
        for (const doc of allListings.docs) {
            c.crossRefReports += (await doc.ref.collection('reports').where('reporterUid', '==', uid).get()).size;
        }

        const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
        c.storageFiles = files.length;

        try {
            const u = await auth.getUser(uid);
            c.authExists = true;
            c.isAdmin = u.customClaims?.role === 'admin';
        } catch (err) {
            if ((err as { code?: string })?.code !== 'auth/user-not-found') throw err;
        }
        return c;
    }

    export async function runDryRunMode(targetUids: string[], filterOnly: string | undefined): Promise<void> {
        const filtered = filterOnly ? targetUids.filter((u) => u === filterOnly) : targetUids;
        if (filterOnly && filtered.length === 0) {
            console.error(`❌ --only=${filterOnly} は TARGET_UIDS に存在しません`);
            process.exit(1);
        }

        console.log(`\n=== DRY RUN: Hash Migration (Step 2) ===`);
        console.log(`Target uids: ${filtered.length}${filterOnly ? ` (filtered by --only=${filterOnly})` : ''}\n`);

        // backup 存在 verify
        const missingBackups = filtered.filter((u) => !existsSync(join(BACKUP_DIR, `${u.replace(/[:/\\]/g, '_')}.json`)));
        if (missingBackups.length > 0) {
            console.error(`❌ 事前 backup 不足: ${missingBackups.length} 件`);
            for (const u of missingBackups) console.error(`  - ${u}`);
            console.error(`先に \`--backup\` モードを実行してください`);
            process.exit(1);
        }
        console.log(`Backup verified: ${filtered.length}/${filtered.length} files ✓\n`);

        const totals = {
            firestore: 0, storage: 0, authCreate: 0, authDelete: 0, adminReapply: 0,
            crossRef: 0,
        };

        for (let i = 0; i < filtered.length; i++) {
            const uid = filtered[i];
            const newUid = hashUid(uid.replace('discord:', ''), secret);
            const c = await preCount(uid);

            const subtotalFirestore = c.users + c.plans + c.sharedPlanMeta + c.sharedPlans +
                c.sharedPlansCopiedBy + c.sharedPlansAnonCopiedBy + c.userPlanCounts +
                c.housingUserMeta + c.housingListings + c.housingListingsReports +
                c.housingFavoritesItems + c.housingTours + c.featureSessions;

            totals.firestore += subtotalFirestore;
            totals.storage += c.storageFiles;
            if (c.authExists) { totals.authCreate++; totals.authDelete++; }
            if (c.isAdmin) totals.adminReapply++;
            totals.crossRef += c.crossRefCopiedBy + c.crossRefReports;

            console.log(`[${(i + 1).toString().padStart(2)}/${filtered.length}] ${uid} → ${newUid.slice(0, 24)}...`);
            console.log(`  - users doc:                ${c.users === 1 ? 'exists' : 'not found'}`);
            console.log(`  - plans (ownerId match):    ${c.plans}`);
            console.log(`  - sharedPlanMeta:           ${c.sharedPlanMeta}`);
            console.log(`  - shared_plans:             ${c.sharedPlans} (copiedBy/anonCopiedBy: ${c.sharedPlansCopiedBy}/${c.sharedPlansAnonCopiedBy})`);
            console.log(`  - userPlanCounts:           ${c.userPlanCounts === 1 ? 'exists' : 'not found'}`);
            console.log(`  - housing_user_meta:        ${c.housingUserMeta === 1 ? 'exists' : 'not found'}`);
            console.log(`  - housing_listings:         ${c.housingListings} (reports: ${c.housingListingsReports})`);
            console.log(`  - housing_favorites items:  ${c.housingFavoritesItems}`);
            console.log(`  - housing_tours:            ${c.housingTours}`);
            console.log(`  - featureSessions:          ${c.featureSessions}`);
            console.log(`  - cross-ref copiedBy hits:  ${c.crossRefCopiedBy}`);
            console.log(`  - cross-ref reports hits:   ${c.crossRefReports}`);
            console.log(`  - Storage files:            ${c.storageFiles}`);
            console.log(`  - Auth account:             ${c.authExists ? 'exists (provider: discord)' : 'not found'}`);
            console.log(`  - admin claim:              ${c.isAdmin ? 'YES (will re-apply to new uid)' : 'none'}`);
            console.log('');
        }

        console.log(`=== Summary ===`);
        console.log(`Total Firestore writes (creates + updates + deletes): ~${totals.firestore * 2}`);
        console.log(`Total cross-ref updates: ${totals.crossRef}`);
        console.log(`Total Storage copy + delete: ${totals.storage * 2}`);
        console.log(`Total Auth create + delete: ${totals.authCreate} + ${totals.authDelete}`);
        console.log(`Admin claim re-applications: ${totals.adminReapply}`);
        console.log(`\nRe-run with --execute --confirm to perform migration.`);
        console.log(`Or with --execute --confirm --only=<oldUid> for single-uid (recommended first run).`);
    }
