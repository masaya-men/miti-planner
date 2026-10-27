import type { Query, DocumentReference } from 'firebase-admin/firestore';
import { db, auth, bucket } from './context.js';

    // ===== Firestore helper functions =====

    export async function copyDocByQuery(
        sourceQuery: Query,
        fieldToUpdate: string,
        newUid: string
    ): Promise<number> {
        const BATCH_LIMIT = 499;
        const snap = await sourceQuery.get();
        if (snap.empty) return 0;
        for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
            const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            for (const doc of chunk) {
                batch.update(doc.ref, { [fieldToUpdate]: newUid });
            }
            await batch.commit();
        }
        return snap.size;
    }

    export async function copyDoc(srcRef: DocumentReference, dstRef: DocumentReference): Promise<boolean> {
        const src = await srcRef.get();
        if (!src.exists) return false;
        await dstRef.set(src.data()!);
        return true;
    }

    export async function copySubcollection(
        srcParent: DocumentReference,
        dstParent: DocumentReference,
        subName: string
    ): Promise<number> {
        const BATCH_LIMIT = 499;
        const snap = await srcParent.collection(subName).get();
        if (snap.empty) return 0;
        for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
            const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            for (const doc of chunk) {
                batch.set(dstParent.collection(subName).doc(doc.id), doc.data());
            }
            await batch.commit();
        }
        return snap.size;
    }

    export async function deleteSubcollection(parentRef: DocumentReference, name: string): Promise<number> {
        const BATCH_LIMIT = 499;
        const snap = await parentRef.collection(name).get();
        if (snap.empty) return 0;
        for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
            const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            for (const doc of chunk) batch.delete(doc.ref);
            await batch.commit();
        }
        return snap.size;
    }

    export async function deleteDocsByQuery(query: Query): Promise<number> {
        const BATCH_LIMIT = 499;
        const snap = await query.get();
        if (snap.empty) return 0;
        for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
            const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            for (const doc of chunk) batch.delete(doc.ref);
            await batch.commit();
        }
        return snap.size;
    }

    // ===== Storage helper functions =====

    export async function copyStorage(oldUid: string, newUid: string): Promise<{ copied: number; paths: string[] }> {
        const [files] = await bucket.getFiles({ prefix: `users/${oldUid}/` });
        const paths: string[] = [];
        for (const f of files) {
            const newPath = f.name.replace(`users/${oldUid}/`, `users/${newUid}/`);
            await f.copy(bucket.file(newPath));
            paths.push(newPath);
        }
        return { copied: files.length, paths };
    }

    export async function deleteStorage(uid: string): Promise<number> {
        const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
        for (const f of files) {
            await f.delete({ ignoreNotFound: true });
        }
        return files.length;
    }

    // ===== 「窓」 sweeper =====

    export async function handlePreExistingNewUid(newUid: string): Promise<{ existed: boolean; preservedData: FirebaseFirestore.DocumentData | null }> {
        try {
            const user = await auth.getUser(newUid);
            // 既に新 uid が存在 = デプロイ後 migration 前に誰かが先回りログインした
            console.log(`  ⚠️ Pre-existing newUid found: ${newUid}`);
            const preservedData: FirebaseFirestore.DocumentData = { authMeta: user.metadata, customClaims: user.customClaims };
            // 新 uid 側に何かデータがある場合は保全 (通常はゼロ件のはず)
            const userDoc = await db.collection('users').doc(newUid).get();
            if (userDoc.exists) preservedData.userDoc = userDoc.data();
            const plansSnap = await db.collection('plans').where('ownerId', '==', newUid).get();
            if (!plansSnap.empty) preservedData.plans = plansSnap.docs.map((d) => ({ id: d.id, data: d.data() }));

            // 既存空アカウントを削除
            await auth.deleteUser(newUid);
            await db.collection('users').doc(newUid).delete().catch(() => {});
            return { existed: true, preservedData };
        } catch (err) {
            if ((err as { code?: string })?.code === 'auth/user-not-found') {
                return { existed: false, preservedData: null };
            }
            throw err;
        }
    }
