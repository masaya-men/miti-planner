import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { db, auth, bucket, BACKUP_DIR } from './context.js';
import type { UserBackup } from './types.js';

    export async function backupSingleUser(uid: string): Promise<UserBackup> {
        const backup: UserBackup = {
            oldUid: uid,
            auth: { exists: false, customClaims: null, providerData: [], metadata: {} },
            firestore: {
                users: null,
                plans: [],
                sharedPlanMeta: [],
                sharedPlans: [],
                sharedPlansCopiedBy: [],
                sharedPlansAnonCopiedBy: [],
                userPlanCounts: null,
                housingUserMeta: null,
                housingListings: [],
                housingListingsReports: [],
                housingFavoritesItems: [],
                housingTours: [],
                featureSessions: [],
                crossRefCopiedBy: [],
                crossRefReports: [],
            },
            storage: [],
            timestamp: new Date().toISOString(),
        };

        // Auth
        try {
            const user = await auth.getUser(uid);
            backup.auth.exists = true;
            backup.auth.customClaims = user.customClaims ?? null;
            backup.auth.providerData = user.providerData.map((p) => ({
                providerId: p.providerId,
                uid: p.uid,
            }));
            backup.auth.metadata = {
                creationTime: user.metadata.creationTime,
                lastSignInTime: user.metadata.lastSignInTime,
            };
        } catch (err: unknown) {
            if ((err as { code?: string })?.code !== 'auth/user-not-found') throw err;
        }

        // Firestore: doc id が uid
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) backup.firestore.users = userDoc.data();

        const countDoc = await db.collection('userPlanCounts').doc(uid).get();
        if (countDoc.exists) backup.firestore.userPlanCounts = countDoc.data();

        const housingMetaDoc = await db.collection('housing_user_meta').doc(uid).get();
        if (housingMetaDoc.exists) backup.firestore.housingUserMeta = housingMetaDoc.data();

        const favItemsSnap = await db.collection('housing_favorites').doc(uid).collection('items').get();
        backup.firestore.housingFavoritesItems = favItemsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

        const sessSnap = await db.collection('users').doc(uid).collection('featureSessions').get();
        backup.firestore.featureSessions = sessSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

        // Firestore: フィールド値が uid
        const plansSnap = await db.collection('plans').where('ownerId', '==', uid).get();
        backup.firestore.plans = plansSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

        const metaSnap = await db.collection('sharedPlanMeta').where('ownerId', '==', uid).get();
        backup.firestore.sharedPlanMeta = metaSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

        const sharedSnap = await db.collection('shared_plans').where('ownerId', '==', uid).get();
        backup.firestore.sharedPlans = sharedSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
        for (const doc of sharedSnap.docs) {
            const cbSnap = await doc.ref.collection('copiedBy').get();
            for (const d of cbSnap.docs) {
                backup.firestore.sharedPlansCopiedBy.push({ sharedPlanId: doc.id, id: d.id, data: d.data() } as unknown);
            }
            const anonSnap = await doc.ref.collection('anonCopiedBy').get();
            for (const d of anonSnap.docs) {
                backup.firestore.sharedPlansAnonCopiedBy.push({ sharedPlanId: doc.id, id: d.id, data: d.data() } as unknown);
            }
        }

        const listingsSnap = await db.collection('housing_listings').where('ownerUid', '==', uid).get();
        backup.firestore.housingListings = listingsSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
        for (const doc of listingsSnap.docs) {
            const reportsSnap = await doc.ref.collection('reports').get();
            backup.firestore.housingListingsReports.push({
                listingId: doc.id,
                reports: reportsSnap.docs.map((r) => ({ id: r.id, data: r.data() })),
            });
        }

        const toursSnap = await db.collection('housing_tours').where('ownerUid', '==', uid).get();
        backup.firestore.housingTours = toursSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

        // Cross-references (= 他人のデータに残る oldUid)
        const allShared = await db.collection('shared_plans').get();
        for (const doc of allShared.docs) {
            const cbRef = doc.ref.collection('copiedBy').doc(uid);
            const snap = await cbRef.get();
            if (snap.exists) {
                backup.firestore.crossRefCopiedBy.push({ sharedPlanId: doc.id, data: snap.data() });
            }
        }

        const allListings = await db.collection('housing_listings').get();
        for (const doc of allListings.docs) {
            const repSnap = await doc.ref.collection('reports').where('reporterUid', '==', uid).get();
            if (!repSnap.empty) {
                backup.firestore.crossRefReports.push({
                    listingId: doc.id,
                    reports: repSnap.docs.map((r) => ({ id: r.id, data: r.data() })),
                });
            }
        }

        // Storage
        const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
        for (const f of files) {
            const [meta] = await f.getMetadata();
            backup.storage.push({ path: f.name, metadata: meta });
        }

        return backup;
    }

    export async function runBackupMode(targetUids: string[]): Promise<void> {
        if (!existsSync(BACKUP_DIR)) {
            mkdirSync(BACKUP_DIR, { recursive: true });
        }
        console.log(`\nBackup directory: ${BACKUP_DIR}\n`);

        let created = 0;
        let skipped = 0;
        for (let i = 0; i < targetUids.length; i++) {
            const uid = targetUids[i];
            const file = join(BACKUP_DIR, `${uid.replace(/[:/\\]/g, '_')}.json`);
            if (existsSync(file)) {
                console.log(`[${i + 1}/${targetUids.length}] SKIP (exists): ${uid}`);
                skipped++;
                continue;
            }
            console.log(`[${i + 1}/${targetUids.length}] Backup: ${uid}...`);
            const backup = await backupSingleUser(uid);
            writeFileSync(file, JSON.stringify(backup, null, 2));
            console.log(`  ✅ ${file}`);
            created++;
        }
        console.log(`\n=== Backup Summary ===`);
        console.log(`Created: ${created}, Skipped (existing): ${skipped}, Total: ${targetUids.length}`);
    }
