/**
 * fix-avatar-urls-for-uid.ts
 * migration 後に avatarUrl / teamLogoUrl が古いパスを指したままになっているのを修正。
 *
 * 使い方:
 *   npx tsx scripts/fix-avatar-urls-for-uid.ts --uid=hashed:<newUid>
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

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
const bucket = getStorage().bucket();

async function generateDownloadUrl(filePath: string): Promise<string | null> {
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    let token = (metadata.metadata as any)?.firebaseStorageDownloadTokens;
    if (!token) {
        // copy で token が引き継がれなかった場合、 新規生成
        token = randomUUID();
        await file.setMetadata({
            metadata: { firebaseStorageDownloadTokens: token },
        });
    }
    const encodedPath = encodeURIComponent(filePath);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
}

async function main() {
    const uidArg = process.argv.find((a) => a.startsWith('--uid='))?.slice('--uid='.length);
    if (!uidArg || !uidArg.startsWith('hashed:')) {
        console.error('Usage: npx tsx scripts/fix-avatar-urls-for-uid.ts --uid=hashed:<newUid>');
        process.exit(1);
    }

    const userDoc = await db.collection('users').doc(uidArg).get();
    if (!userDoc.exists) {
        console.error(`User doc not found: ${uidArg}`);
        process.exit(1);
    }
    const data = userDoc.data()!;
    console.log(`Current avatarUrl: ${data.avatarUrl ?? '(none)'}`);
    console.log(`Current teamLogoUrl: ${data.teamLogoUrl ?? '(none)'}`);

    const updates: Record<string, string> = {};

    // Avatar: users/<uid>/avatar.webp
    if (data.avatarUrl) {
        const newAvatarUrl = await generateDownloadUrl(`users/${uidArg}/avatar.webp`);
        if (newAvatarUrl) {
            updates.avatarUrl = newAvatarUrl;
            console.log(`✅ New avatarUrl generated`);
        } else {
            console.log(`⚠️ users/${uidArg}/avatar.webp not found, avatarUrl will be cleared`);
            updates.avatarUrl = '';
        }
    }

    // Team logo: users/<uid>/team-logo.{jpg,webp}
    if (data.teamLogoUrl) {
        // ext を url から推測
        const oldUrl = data.teamLogoUrl as string;
        const ext = oldUrl.includes('team-logo.webp') ? 'webp' : 'jpg';
        const newLogoUrl = await generateDownloadUrl(`users/${uidArg}/team-logo.${ext}`);
        if (newLogoUrl) {
            updates.teamLogoUrl = newLogoUrl;
            console.log(`✅ New teamLogoUrl generated (ext: ${ext})`);
        } else {
            // 他 ext も試す
            const altExt = ext === 'jpg' ? 'webp' : 'jpg';
            const altUrl = await generateDownloadUrl(`users/${uidArg}/team-logo.${altExt}`);
            if (altUrl) {
                updates.teamLogoUrl = altUrl;
                console.log(`✅ New teamLogoUrl generated (ext: ${altExt}, fallback)`);
            } else {
                console.log(`⚠️ team-logo file not found, teamLogoUrl will be cleared`);
                updates.teamLogoUrl = '';
            }
        }
    }

    if (Object.keys(updates).length === 0) {
        console.log('No URL updates needed.');
        return;
    }

    await db.collection('users').doc(uidArg).update(updates);
    console.log(`\n✅ Updated users/${uidArg}`);
    console.log(JSON.stringify(updates, null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
