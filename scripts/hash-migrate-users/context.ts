import { resolve } from 'node:path';
import { loadEnv } from './env.js';

    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');
    const { getStorage } = await import('firebase-admin/storage');
    export const { hashUid } = await import('../../api/_lib/hashUid.js');

    const ROOT = resolve(import.meta.dirname, '../..');
    const env = loadEnv(resolve(ROOT, '.env.local'));

    const projectId = env.FIREBASE_PROJECT_ID;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const storageBucket = env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app';
    export const secret = env.LOPO_PSEUDONYM_SECRET || '';

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
    export const db = getFirestore();
    export const auth = getAuth();
    export const bucket = getStorage().bucket();

    export const BACKUP_DIR = resolve(ROOT, 'docs/.private/backups/2026-05-20-pre-hash');
    export const TARGET_JSON_PATH = resolve(ROOT, 'docs/.private/hash-migration-target-uids.json');
