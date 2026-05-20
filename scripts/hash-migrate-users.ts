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

    interface UserBackup {
        oldUid: string;
        auth: {
            exists: boolean;
            customClaims: Record<string, unknown> | null;
            providerData: unknown[];
            metadata: unknown;
        };
        firestore: {
            users: unknown | null;
            plans: unknown[];
            sharedPlanMeta: unknown[];
            sharedPlans: unknown[];
            sharedPlansCopiedBy: unknown[];
            sharedPlansAnonCopiedBy: unknown[];
            userPlanCounts: unknown | null;
            housingUserMeta: unknown | null;
            housingListings: unknown[];
            housingListingsReports: { listingId: string; reports: unknown[] }[];
            housingFavoritesItems: unknown[];
            housingTours: unknown[];
            featureSessions: unknown[];
            crossRefCopiedBy: { sharedPlanId: string; data: unknown }[];
            crossRefReports: { listingId: string; reports: unknown[] }[];
        };
        storage: { path: string; metadata: unknown }[];
        timestamp: string;
    }

    async function backupSingleUser(uid: string): Promise<UserBackup> {
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

    interface PreCount {
        users: number;
        plans: number;
        sharedPlanMeta: number;
        sharedPlans: number;
        sharedPlansCopiedBy: number;
        sharedPlansAnonCopiedBy: number;
        userPlanCounts: number;
        housingUserMeta: number;
        housingListings: number;
        housingListingsReports: number;
        housingFavoritesItems: number;
        housingTours: number;
        featureSessions: number;
        crossRefCopiedBy: number;
        crossRefReports: number;
        storageFiles: number;
        authExists: boolean;
        isAdmin: boolean;
    }

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
        } catch (err: any) {
            if (err?.code !== 'auth/user-not-found') throw err;
        }
        return c;
    }

    async function runDryRunMode(targetUids: string[], filterOnly: string | undefined): Promise<void> {
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

        let totals = {
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

    async function runBackupMode(targetUids: string[]): Promise<void> {
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

        // execute / rollback は後続 Task で実装
        console.log(`(Mode ${flags.mode} の処理は未実装)`);
    }

    await main().then(() => process.exit(0)).catch((err: unknown) => {
        console.error('エラー:', err);
        process.exit(1);
    });
}
