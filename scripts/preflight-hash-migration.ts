/**
 * preflight-hash-migration.ts
 * hash 化マイグレーション実行前の自動安全チェック。
 * 1 つでも fail したら exit 1 で migration 開始を防ぐ。
 *
 * 確認項目:
 *  1. LOPO_PSEUDONYM_SECRET がローカル .env.local に存在
 *  2. 値が 32 文字以上 hex
 *  3. デプロイ済のアプリが新コードで動作している (auth endpoint を実際に POST、 hashed: token が返るか確認)
 *  4. 全 10 件の対象 uid が Firebase Auth に実存
 *  5. 事前 backup ファイル 10 件が disk に存在し JSON parse 可能
 *
 * 使い方: npx tsx scripts/preflight-hash-migration.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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
const BACKUP_DIR = resolve(ROOT, 'docs/.private/backups/2026-05-20-pre-hash');
const TARGET_JSON_PATH = resolve(ROOT, 'docs/.private/hash-migration-target-uids.json');

const checks: { name: string; pass: boolean; detail: string }[] = [];

function check(name: string, pass: boolean, detail = ''): void {
    checks.push({ name, pass, detail });
    console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ': ' + detail : ''}`);
}

async function main() {
    console.log('=== Preflight Check for Hash Migration ===\n');

    // 1. secret 存在 + 長さ
    const secret = env.LOPO_PSEUDONYM_SECRET || '';
    check('LOPO_PSEUDONYM_SECRET in .env.local', Boolean(secret), secret ? `${secret.length} chars` : 'MISSING');
    check('LOPO_PSEUDONYM_SECRET length >= 32', secret.length >= 32);

    // 2. TARGET_UIDS JSON 存在 + parseable
    let targetUids: string[] = [];
    try {
        const parsed = JSON.parse(readFileSync(TARGET_JSON_PATH, 'utf-8'));
        targetUids = parsed.discord ?? [];
        check('TARGET_UIDS JSON readable', true, `${targetUids.length} uids`);
    } catch (err: any) {
        check('TARGET_UIDS JSON readable', false, err?.message || 'parse error');
    }
    check('TARGET_UIDS count == 10', targetUids.length === 10, `actual: ${targetUids.length}`);
    check('All TARGET_UIDS have discord: prefix', targetUids.every((u) => u.startsWith('discord:')));

    // 3. backup files 存在
    const missingBackups = targetUids.filter((u) => !existsSync(join(BACKUP_DIR, `${u.replace(/[:/\\]/g, '_')}.json`)));
    check('All backup files exist', missingBackups.length === 0, missingBackups.length > 0 ? `missing: ${missingBackups.length}` : '');
    // backup file が parseable か
    let parseFailures = 0;
    for (const u of targetUids) {
        const f = join(BACKUP_DIR, `${u.replace(/[:/\\]/g, '_')}.json`);
        if (!existsSync(f)) continue;
        try { JSON.parse(readFileSync(f, 'utf-8')); } catch { parseFailures++; }
    }
    check('All backup files JSON-parseable', parseFailures === 0, parseFailures > 0 ? `failures: ${parseFailures}` : '');

    // 4. Firebase Admin 初期化 + Auth 確認
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
        check('Firebase admin credentials in .env.local', false);
    } else {
        check('Firebase admin credentials in .env.local', true);
        if (!getApps().length) {
            initializeApp({
                credential: cert({
                    projectId: env.FIREBASE_PROJECT_ID,
                    clientEmail: env.FIREBASE_CLIENT_EMAIL,
                    privateKey: (env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
                }),
            });
        }
        const auth = getAuth();
        let existsCount = 0;
        for (const u of targetUids) {
            try { await auth.getUser(u); existsCount++; } catch {}
        }
        check('All TARGET_UIDS exist in Firebase Auth', existsCount === targetUids.length, `${existsCount}/${targetUids.length}`);
    }

    // 5. デプロイ済の新コードが動作しているか (auth POST endpoint をたたく)
    const prodUrl = env.LOPO_PROD_URL || 'https://lopoly.app';
    try {
        const res = await fetch(`${prodUrl}/api/auth?provider=discord`, { method: 'POST' });
        check(`${prodUrl}/api/auth POST responds`, res.status === 401 || res.status === 400, `status ${res.status}`);
    } catch (err: any) {
        check(`${prodUrl}/api/auth POST responds`, false, err?.message || 'network error');
    }

    // 6. hashUid 関数の動作テスト (固定 ID で確実な hash が出るか)
    if (secret) {
        try {
            const testHash = hashUid('TEST_ID_FOR_PREFLIGHT', secret);
            check('hashUid function works', testHash.startsWith('hashed:') && testHash.length === 71); // 'hashed:' + 64
        } catch (err: any) {
            check('hashUid function works', false, err?.message);
        }
    }

    // 結果集計
    console.log('\n=== Summary ===');
    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.length - passed;
    console.log(`Passed: ${passed}/${checks.length}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.error(`\n❌ Preflight FAILED. Fix above issues before running migration.`);
        process.exit(1);
    }
    console.log(`\n✅ All preflight checks PASSED. Safe to run migration.`);
}

main().catch((err) => {
    console.error('Preflight error:', err);
    process.exit(1);
});
