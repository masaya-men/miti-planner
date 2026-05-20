# hash 化マイグレーション (Step 2) 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord 10 件の Firebase uid を `discord:<生 ID>` → `hashed:<HMAC-SHA256(id+secret)>` に一斉移行し、 軽減表 / 共有プラン / ハウジング登録 / アバター / お気に入り / 通報履歴を一切壊さずに完了する。 失敗許容ゼロ。

**Architecture:** server-side HMAC-SHA256 ヘルパー (`api/_lib/hashUid.ts`) を中核に、 1 一回限りの本番マイグレーションスクリプト (`scripts/hash-migrate-users.ts`) と前提検証スクリプト (`scripts/preflight-hash-migration.ts`) と事後検証スクリプト (`scripts/verify-hash-migration.ts`) を分離。 コードデプロイ → migration → 検証の順で実施し、 失敗時は per-user 自動 rollback または `--rollback` 手動 rollback で復元。

**Tech Stack:** TypeScript / Node.js `crypto` (HMAC-SHA256) / `firebase-admin/firestore` / `firebase-admin/auth` / `firebase-admin/storage` / `npx tsx` 実行 / Vitest 4 (pure logic のみ) / Vercel sensitive 環境変数

---

## 重要前提

- **Step 1 完了が前提**: `scripts/check-admin-claims.ts` を事前に実行し、 prod に Discord 10 件のみ (Twitter/Google 残骸ゼロ) を確認
- **設計書**: [docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md](../specs/2026-05-20-hash-migration-step2-design.md) (commit 1445eb6)
- **準備メモ (gitignore)**: `docs/.private/2026-05-19-hash-migration-prep.md`
- **TARGET_UIDS の実値**: spec / plan には絶対書かない。 gitignore 配下の準備メモ + Phase 8 で人間が作成する JSON ファイル経由でのみ扱う

---

## File Structure (作成・変更するファイル全リスト)

### 新規作成 (コード)
| パス | 責任 |
|---|---|
| `api/_lib/hashUid.ts` | server-side 専用 HMAC-SHA256 ヘルパー。 `api/` 配下なのでクライアントバンドル混入リスクゼロ |
| `scripts/hash-migrate-users.ts` | migration 本体スクリプト (backup / dry-run / execute / rollback) |
| `scripts/preflight-hash-migration.ts` | migration 開始前の事前検証 (secret / deploy / target uid / backup) |
| `scripts/verify-hash-migration.ts` | migration 後の事後検証 (件数比較 / prefix 確認) |

### 新規作成 (テスト)
| パス | 責任 |
|---|---|
| `src/__tests__/hashUid.test.ts` | hashUid 関数の vitest unit テスト (src/ 配下に置くことで vitest config の include パターンに合致) |
| `src/__tests__/hash-migrate-users-flags.test.ts` | スクリプトの parseFlags / assertPrefixSafe 等の pure logic テスト |

### 新規作成 (gitignored / Phase 8 で人間が作成)
| パス | 責任 |
|---|---|
| `docs/.private/hash-migration-target-uids.json` | TARGET_UIDS 10 件の実値 |
| `docs/.private/backups/2026-05-20-pre-hash/<uid>.json` × 10 | 事前一括 backup の出力先 |

### 既存ファイル変更
| パス | 行 | 変更内容 |
|---|---|---|
| `api/auth/_discordHandler.ts` | 148 | `firebaseUid = \`discord:${id}\`` → `firebaseUid = hashUid(id, process.env.LOPO_PSEUDONYM_SECRET!)` |
| `src/components/LoginModal.tsx` | 240 | `{user.uid.startsWith('discord:') ? 'Discord' : ''}` → `{'Discord'}` |
| `src/components/WelcomeSetup.tsx` | 57 | `const provider = user.uid.startsWith('discord:') ? 'discord' : 'twitter'` → `const provider = 'discord' as const` |
| `src/utils/logoUpload.ts` | 78 | 同上 |
| `scripts/check-admin-claims.ts` | 52-58 | `detectProvider` を hashed: 対応に変更 |
| `vitest.config.ts` | include | `'src/**/__tests__/**/*.test.ts'` 既存の通り (新規テストは src/__tests__ 配下に置くことで対応) |
| `src/locales/ja.json` | privacy section | hash 化説明文を追加 |
| `src/locales/en.json` | privacy section | 同上 |
| `src/locales/ko.json` | privacy section | 同上 |
| `src/locales/zh.json` | privacy section | 同上 |
| `src/components/LegalPage.tsx` 等 | privacy 表示箇所 | 新 i18n キーを参照 |
| `docs/TODO.md` | 「現在の状態」「次セッション最優先」 | Step 2 完了状態に更新 |
| `docs/TODO_COMPLETED.md` | 先頭 | Step 2 完了記録を追加 |

---

## Phase 構造

| Phase | 種別 | 内容 | 実行者 |
|---|---|---|---|
| Phase 1 | コード | hashUid + テスト | subagent |
| Phase 2 | コード | auth handler 修正 (deploy しない) | subagent |
| Phase 3 | コード | prefix 判定 3 箇所 + check-admin-claims 修正 | subagent |
| Phase 4 | コード | migration スクリプト本体 (5 task に分解) | subagent |
| Phase 5 | コード | preflight check スクリプト | subagent |
| Phase 6 | コード | verify スクリプト | subagent |
| **Phase 7** | **人間** | コードレビュー (superpowers:requesting-code-review) | 人間 |
| **Phase 8** | **人間** | 本番準備 (secret 生成、 Vercel 投入、 TARGET_UIDS JSON 作成) | 人間 |
| **Phase 9** | **人間 + コマンド** | 事前 backup → dry-run → コードデプロイ | 人間 |
| **Phase 10** | **人間 + コマンド** | preflight → 人柱 migration → 自動検証 → 手動検証 | 人間 |
| **Phase 11** | **人間 + コマンド** | 残り 9 件 migration → 全件検証 | 人間 |
| Phase 12 | コード | プライバシーポリシー更新 | subagent |
| Phase 13 | コード | docs / memory 更新 + 最終 push | subagent |

---

## Phase 1: hashUid helper + unit テスト

**目的**: HMAC-SHA256 で `hashed:<hex>` 形式の uid を生成する純粋関数を実装。 テスト先行 (TDD)。

### Task 1: vitest テストを書く (RED)

**Files:**
- Create: `src/__tests__/hashUid.test.ts`

- [ ] **Step 1: テストファイルを作成**

Create `src/__tests__/hashUid.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hashUid } from '../../api/_lib/hashUid';

describe('hashUid', () => {
    const TEST_SECRET = 'a'.repeat(64); // 64 文字の固定 secret (テスト用)
    const TEST_DISCORD_ID = '000000000000000000';

    it('returns hashed: prefix + 64-char lowercase hex', () => {
        const result = hashUid(TEST_DISCORD_ID, TEST_SECRET);
        expect(result).toMatch(/^hashed:[0-9a-f]{64}$/);
    });

    it('is deterministic (same input → same output)', () => {
        const r1 = hashUid(TEST_DISCORD_ID, TEST_SECRET);
        const r2 = hashUid(TEST_DISCORD_ID, TEST_SECRET);
        expect(r1).toBe(r2);
    });

    it('produces different output for different discord IDs', () => {
        const r1 = hashUid('111111111111111111', TEST_SECRET);
        const r2 = hashUid('222222222222222222', TEST_SECRET);
        expect(r1).not.toBe(r2);
    });

    it('produces different output for different secrets', () => {
        const r1 = hashUid(TEST_DISCORD_ID, 'a'.repeat(64));
        const r2 = hashUid(TEST_DISCORD_ID, 'b'.repeat(64));
        expect(r1).not.toBe(r2);
    });

    it('throws when secret is empty', () => {
        expect(() => hashUid(TEST_DISCORD_ID, '')).toThrow(/LOPO_PSEUDONYM_SECRET/);
    });

    it('throws when secret is too short (< 32 chars)', () => {
        expect(() => hashUid(TEST_DISCORD_ID, 'a'.repeat(31))).toThrow(/32/);
    });

    it('accepts minimum 32-char secret', () => {
        const result = hashUid(TEST_DISCORD_ID, 'a'.repeat(32));
        expect(result).toMatch(/^hashed:[0-9a-f]{64}$/);
    });
});
```

- [ ] **Step 2: vitest を実行して FAIL を確認**

Run: `npm test -- hashUid`

Expected: FAIL (関数 `hashUid` が未定義のため import エラー)

### Task 2: hashUid を実装 (GREEN)

**Files:**
- Create: `api/_lib/hashUid.ts`

- [ ] **Step 1: ディレクトリ作成 + ファイル作成**

```bash
mkdir -p api/_lib
```

Create `api/_lib/hashUid.ts`:

```typescript
import { createHmac } from 'node:crypto';

/**
 * Discord ID を pseudonymous な Firebase uid に変換する。
 *
 * 元の Discord ID は LoPo 内部でも復元できない (one-way hash + server-side secret)。
 * secret が失われると過去全データの参照が永遠に不能になるので、 必ず多重バックアップすること。
 *
 * 設計書: docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md §2.1
 *
 * @param discordId - Discord OAuth から取得した数値 ID (17〜19 桁の数字文字列)
 * @param secret - LOPO_PSEUDONYM_SECRET 環境変数の値 (32 文字以上の hex)
 * @returns `hashed:` プレフィックス + HMAC-SHA256 hex (64 文字)
 */
export function hashUid(discordId: string, secret: string): string {
    if (!secret || secret.length < 32) {
        throw new Error('LOPO_PSEUDONYM_SECRET が未設定または短すぎます (32 文字以上の hex を期待)');
    }
    return 'hashed:' + createHmac('sha256', secret).update(discordId).digest('hex');
}
```

- [ ] **Step 2: vitest を再実行して PASS を確認**

Run: `npm test -- hashUid`

Expected: PASS (7 件全部 green)

- [ ] **Step 3: build が壊れないことを確認**

Run: `rtk tsc -b`

Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
rtk git add api/_lib/hashUid.ts src/__tests__/hashUid.test.ts
rtk git commit -m "feat(auth): hashUid ヘルパー追加 (HMAC-SHA256, server-only)"
```

---

## Phase 2: auth handler 修正 (まだ deploy しない)

**目的**: Discord OAuth ハンドラーが新しい hashed: uid を生成するように変更。 まだ push しない (Phase 9 でまとめてデプロイ)。

### Task 3: auth handler を hashUid 経由に変更

**Files:**
- Modify: `api/auth/_discordHandler.ts:148`

- [ ] **Step 1: import 追加**

Modify `api/auth/_discordHandler.ts`. import 部分 (1-12 行付近) に追加:

```typescript
import { hashUid } from '../_lib/hashUid.js';
```

- [ ] **Step 2: uid 生成ロジック変更**

`api/auth/_discordHandler.ts:148` の行を変更:

変更前:
```typescript
        // ステップ5: Firebase カスタムトークン生成
        const firebaseUid = `discord:${discordUserId}`;
```

変更後:
```typescript
        // ステップ5: Firebase カスタムトークン生成 (hash 化済、 元 Discord ID は LoPo 内部からも復元不能)
        const secret = process.env.LOPO_PSEUDONYM_SECRET;
        if (!secret) {
            console.error('LOPO_PSEUDONYM_SECRET 未設定');
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const firebaseUid = hashUid(discordUserId, secret);
```

- [ ] **Step 3: ビルド確認**

Run: `rtk tsc -b`

Expected: エラーなし

- [ ] **Step 4: vitest 全 PASS 確認**

Run: `npm test`

Expected: 全テスト PASS (既存テスト + hashUid 7 件)

- [ ] **Step 5: build 確認**

Run: `npm run build`

Expected: 成功 (Vite ビルドが通る = api/_lib/hashUid.ts がクライアントバンドルに混入していないことの保証)

- [ ] **Step 6: Commit**

```bash
rtk git add api/auth/_discordHandler.ts
rtk git commit -m "feat(auth): discord uid を hashUid 経由で生成 (デプロイは Phase 9 で実施)"
```

---

## Phase 3: prefix 判定 3 箇所修正 + check-admin-claims 修正

**目的**: 旧 `startsWith('discord:')` / `startsWith('twitter:')` 等の prefix 判定を撤廃 (Step 1 で Twitter は消滅、 Step 2 後は全 uid が hashed: になるため)。

### Task 4: LoginModal.tsx を修正

**Files:**
- Modify: `src/components/LoginModal.tsx:240`

- [ ] **Step 1: 該当行を確認**

Read `src/components/LoginModal.tsx`, around line 240.

期待する現状:
```typescript
                                                    {user.uid.startsWith('discord:') ? 'Discord' : ''}
```

- [ ] **Step 2: 修正**

変更後:
```typescript
                                                    {'Discord'}
```

(provider 表示は常に Discord で固定。 Step 1 で Twitter ユーザーは消滅済、 Step 2 後の hashed: uid も Discord 由来)

- [ ] **Step 3: 動作確認**

Run: `npm run build`

Expected: ビルド成功

### Task 5: WelcomeSetup.tsx を修正

**Files:**
- Modify: `src/components/WelcomeSetup.tsx:57`

- [ ] **Step 1: 該当行を確認**

期待する現状 (line 57 付近):
```typescript
            const provider = user.uid.startsWith('discord:') ? 'discord' : 'twitter';
```

- [ ] **Step 2: 修正**

変更後:
```typescript
            const provider = 'discord' as const;
```

### Task 6: logoUpload.ts を修正

**Files:**
- Modify: `src/utils/logoUpload.ts:78`

- [ ] **Step 1: 該当行を確認**

期待する現状 (line 78 付近):
```typescript
        const provider = user?.uid.startsWith('discord:') ? 'discord' : 'twitter';
```

- [ ] **Step 2: 修正**

変更後:
```typescript
        const provider = 'discord' as const;
```

### Task 7: check-admin-claims.ts の detectProvider を修正

**Files:**
- Modify: `scripts/check-admin-claims.ts:52-58`

- [ ] **Step 1: detectProvider 関数を修正**

変更前 (lines 52-58):
```typescript
function detectProvider(uid: string, providerData: any[]): string {
  if (uid.startsWith('discord:')) return 'discord';
  if (uid.startsWith('twitter:')) return 'twitter';
  const first = providerData[0]?.providerId;
  if (first) return first;
  return 'custom';
}
```

変更後:
```typescript
function detectProvider(uid: string, providerData: any[]): string {
  if (uid.startsWith('hashed:')) return 'discord (hashed)';
  if (uid.startsWith('discord:')) return 'discord (legacy)';
  if (uid.startsWith('twitter:')) return 'twitter';
  const first = providerData[0]?.providerId;
  if (first) return first;
  return 'custom';
}
```

(migration 後は 全件 `discord (hashed)` になる。 migration 中の hybrid 状態でも区別可能。 Step 1 後でも `twitter:` が再出現しないことを念のため残す = 残骸検出センサーとして)

- [ ] **Step 2: build + test 確認**

Run: `npm run build && npm test`

Expected: 全 PASS

- [ ] **Step 3: スクリプトの動作確認 (実行はしない、 dry-execute parse のみ)**

Run: `npx tsx --check scripts/check-admin-claims.ts` (TypeScript の syntax check)

Expected: エラーなし

- [ ] **Step 4: Commit (Phase 3 全体)**

```bash
rtk git add src/components/LoginModal.tsx src/components/WelcomeSetup.tsx src/utils/logoUpload.ts scripts/check-admin-claims.ts
rtk git commit -m "refactor(auth): prefix 判定を撤廃、 check-admin-claims を hashed: 対応"
```

---

## Phase 4: migration スクリプト本体

**目的**: backup / dry-run / execute / rollback の 4 モードを 1 ファイルに実装。 段階的に組み立て、 各 task で部分 commit。

### Task 8: スクリプト雛形 + 環境読込 + TARGET_UIDS ロード

**Files:**
- Create: `scripts/hash-migrate-users.ts`
- Create: `src/__tests__/hash-migrate-users-flags.test.ts`

- [ ] **Step 1: parseFlags / assertPrefixSafe / loadTargetUids の vitest テスト (RED)**

Create `src/__tests__/hash-migrate-users-flags.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFlags, assertPrefixSafe } from '../../scripts/hash-migrate-users';

describe('parseFlags', () => {
    it('returns defaults when no args', () => {
        expect(parseFlags([])).toEqual({
            mode: 'dry-run',
            backup: false,
            execute: false,
            confirm: false,
            rollback: false,
            only: undefined,
            uid: undefined,
        });
    });

    it('detects --backup', () => {
        expect(parseFlags(['--backup']).backup).toBe(true);
    });

    it('detects --execute --confirm', () => {
        const r = parseFlags(['--execute', '--confirm']);
        expect(r.execute).toBe(true);
        expect(r.confirm).toBe(true);
    });

    it('detects --only=<uid>', () => {
        expect(parseFlags(['--only=discord:123']).only).toBe('discord:123');
    });

    it('detects --rollback --uid=<uid>', () => {
        const r = parseFlags(['--rollback', '--uid=discord:123', '--confirm']);
        expect(r.rollback).toBe(true);
        expect(r.uid).toBe('discord:123');
    });
});

describe('assertPrefixSafe', () => {
    it('passes for all-discord uids', () => {
        expect(() => assertPrefixSafe(['discord:1', 'discord:2'])).not.toThrow();
    });

    it('throws if hashed: prefix found (already migrated)', () => {
        expect(() => assertPrefixSafe(['discord:1', 'hashed:abc'])).toThrow(/hashed:/);
    });

    it('throws if twitter: prefix found', () => {
        expect(() => assertPrefixSafe(['twitter:1'])).toThrow(/twitter:/);
    });

    it('throws if google: prefix found', () => {
        expect(() => assertPrefixSafe(['google:1'])).toThrow(/google:/);
    });

    it('throws if list is empty', () => {
        expect(() => assertPrefixSafe([])).toThrow(/empty/i);
    });
});
```

- [ ] **Step 2: vitest を実行 (FAIL を確認)**

Run: `npm test -- hash-migrate-users-flags`

Expected: FAIL (関数未定義)

- [ ] **Step 3: hash-migrate-users.ts の雛形作成**

Create `scripts/hash-migrate-users.ts`:

```typescript
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

    // 各モードの実装は後続 Task で追加
    console.log(`(Mode ${flags.mode} の処理は未実装)`);
}

main().then(() => process.exit(0)).catch((err) => {
    console.error('エラー:', err);
    process.exit(1);
});
```

- [ ] **Step 4: vitest を再実行 (PASS を確認)**

Run: `npm test -- hash-migrate-users-flags`

Expected: PASS (10 件全部 green)

- [ ] **Step 5: スクリプトの起動確認 (TARGET JSON 未作成なのでエラー期待)**

Run: `npx tsx scripts/hash-migrate-users.ts`

Expected: `❌ TARGET_UIDS ファイル ... が読めません` (まだ JSON 未作成のため)

- [ ] **Step 6: ダミー TARGET JSON 作成 + safetycheck 動作確認**

```bash
mkdir -p docs/.private
cat > docs/.private/hash-migration-target-uids.json <<EOF
{
  "_comment": "Step 2 (hash 化マイグレーション) の対象 uid。 docs/.private/2026-05-19-hash-migration-prep.md から転記。 .private/ gitignored。",
  "discord": [
    "discord:safetycheck_1",
    "discord:safetycheck_2"
  ]
}
EOF
```

Run: `npx tsx scripts/hash-migrate-users.ts`

Expected: `✅ prefix safety check passed` の後に `(Mode dry-run の処理は未実装)` が出る

- [ ] **Step 7: Commit**

```bash
rtk git add scripts/hash-migrate-users.ts src/__tests__/hash-migrate-users-flags.test.ts
rtk git commit -m "feat(scripts): hash-migrate-users.ts 雛形 + flags / prefix-assert テスト"
```

### Task 9: backup モードを実装

**Files:**
- Modify: `scripts/hash-migrate-users.ts`

- [ ] **Step 1: backup 関数を追加**

`scripts/hash-migrate-users.ts` の `loadTargetUids` の下に追加:

```typescript
interface UserBackup {
    oldUid: string;
    auth: {
        exists: boolean;
        customClaims: Record<string, any> | null;
        providerData: any[];
        metadata: any;
    };
    firestore: {
        users: any | null;
        plans: any[];
        sharedPlanMeta: any[];
        sharedPlans: any[];
        sharedPlansCopiedBy: any[];
        sharedPlansAnonCopiedBy: any[];
        userPlanCounts: any | null;
        housingUserMeta: any | null;
        housingListings: any[];
        housingListingsReports: { listingId: string; reports: any[] }[];
        housingFavoritesItems: any[];
        housingTours: any[];
        featureSessions: any[];
        crossRefCopiedBy: { sharedPlanId: string; data: any }[];
        crossRefReports: { listingId: string; reports: any[] }[];
    };
    storage: { path: string; metadata: any }[];
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
    } catch (err: any) {
        if (err?.code !== 'auth/user-not-found') throw err;
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
            backup.firestore.sharedPlansCopiedBy.push({ sharedPlanId: doc.id, id: d.id, data: d.data() } as any);
        }
        const anonSnap = await doc.ref.collection('anonCopiedBy').get();
        for (const d of anonSnap.docs) {
            backup.firestore.sharedPlansAnonCopiedBy.push({ sharedPlanId: doc.id, id: d.id, data: d.data() } as any);
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
```

- [ ] **Step 2: main() に backup モード分岐を追加**

`main()` の `(Mode ${flags.mode} の処理は未実装)` の行を以下に置き換え:

```typescript
    if (flags.mode === 'backup') {
        await runBackupMode(targetUids);
        return;
    }

    // dry-run / execute / rollback は後続 Task で実装
    console.log(`(Mode ${flags.mode} の処理は未実装)`);
```

- [ ] **Step 3: ダミー uid で backup の動作確認 (実 backup はしない、 safetycheck uids のまま)**

Run: `npx tsx scripts/hash-migrate-users.ts --backup`

Expected: 2 件分の JSON ファイルが出力される (内容は全部空 / not-found)。 `docs/.private/backups/2026-05-20-pre-hash/discord_safetycheck_1.json` 等が確認できる

- [ ] **Step 4: 出力ファイルを掃除 (実行前にダミーを除去)**

```bash
rm -rf docs/.private/backups/2026-05-20-pre-hash/
```

- [ ] **Step 5: Commit**

```bash
rtk git add scripts/hash-migrate-users.ts
rtk git commit -m "feat(scripts): hash-migrate-users backup モードを実装"
```

### Task 10: dry-run モード (件数 pre-count) を実装

**Files:**
- Modify: `scripts/hash-migrate-users.ts`

- [ ] **Step 1: 件数集計関数 + 整形出力を追加**

`runBackupMode` 関数の下に追加:

```typescript
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
```

- [ ] **Step 2: main() に dry-run 分岐を追加**

`main()` の backup 分岐の下に追加:

```typescript
    if (flags.mode === 'dry-run') {
        await runDryRunMode(targetUids, flags.only);
        return;
    }
```

- [ ] **Step 3: ダミー uid で動作確認**

Run: `npx tsx scripts/hash-migrate-users.ts`

Expected: 「事前 backup 不足: 2 件」 と出て exit (backup ファイル無いため)

- [ ] **Step 4: ダミー backup を作って再実行**

```bash
mkdir -p docs/.private/backups/2026-05-20-pre-hash
echo '{}' > docs/.private/backups/2026-05-20-pre-hash/discord_safetycheck_1.json
echo '{}' > docs/.private/backups/2026-05-20-pre-hash/discord_safetycheck_2.json
```

Run: `npx tsx scripts/hash-migrate-users.ts`

Expected: 2 件分の整形出力 + Summary (全部 0 件 / not found)

- [ ] **Step 5: 掃除**

```bash
rm -rf docs/.private/backups/2026-05-20-pre-hash/
```

- [ ] **Step 6: Commit**

```bash
rtk git add scripts/hash-migrate-users.ts
rtk git commit -m "feat(scripts): hash-migrate-users dry-run モードを実装"
```

### Task 11: execute モード本体 (per-user migration ロジック)

**Files:**
- Modify: `scripts/hash-migrate-users.ts`

このタスクは長いので Step ごとに細かく分ける。

- [ ] **Step 1: Firestore コピー関数を追加**

`runDryRunMode` の下に追加:

```typescript
async function copyDocByQuery(
    sourceQuery: FirebaseFirestore.Query,
    fieldToUpdate: string,
    newUid: string
): Promise<number> {
    const snap = await sourceQuery.get();
    if (snap.empty) return 0;
    const batch = db.batch();
    for (const doc of snap.docs) {
        batch.update(doc.ref, { [fieldToUpdate]: newUid });
    }
    await batch.commit();
    return snap.size;
}

async function copyDoc(srcRef: FirebaseFirestore.DocumentReference, dstRef: FirebaseFirestore.DocumentReference): Promise<boolean> {
    const src = await srcRef.get();
    if (!src.exists) return false;
    await dstRef.set(src.data()!);
    return true;
}

async function copySubcollection(
    srcParent: FirebaseFirestore.DocumentReference,
    dstParent: FirebaseFirestore.DocumentReference,
    subName: string
): Promise<number> {
    const snap = await srcParent.collection(subName).get();
    if (snap.empty) return 0;
    const batch = db.batch();
    for (const doc of snap.docs) {
        batch.set(dstParent.collection(subName).doc(doc.id), doc.data());
    }
    await batch.commit();
    return snap.size;
}

async function deleteDocsByQuery(query: FirebaseFirestore.Query): Promise<number> {
    const snap = await query.get();
    if (snap.empty) return 0;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    return snap.size;
}

async function deleteSubcollection(parentRef: FirebaseFirestore.DocumentReference, name: string): Promise<number> {
    const snap = await parentRef.collection(name).get();
    if (snap.empty) return 0;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    return snap.size;
}
```

- [ ] **Step 2: Storage コピー関数を追加**

続けて追加:

```typescript
async function copyStorage(oldUid: string, newUid: string): Promise<{ copied: number; paths: string[] }> {
    const [files] = await bucket.getFiles({ prefix: `users/${oldUid}/` });
    const paths: string[] = [];
    for (const f of files) {
        const newPath = f.name.replace(`users/${oldUid}/`, `users/${newUid}/`);
        await f.copy(bucket.file(newPath));
        paths.push(newPath);
    }
    return { copied: files.length, paths };
}

async function deleteStorage(uid: string): Promise<number> {
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
    for (const f of files) {
        await f.delete({ ignoreNotFound: true });
    }
    return files.length;
}
```

- [ ] **Step 3: 「窓」 対策関数を追加**

続けて追加:

```typescript
async function handlePreExistingNewUid(newUid: string): Promise<{ existed: boolean; preservedData: any | null }> {
    try {
        const user = await auth.getUser(newUid);
        // 既に新 uid が存在 = デプロイ後 migration 前に誰かが先回りログインした
        console.log(`  ⚠️ Pre-existing newUid found: ${newUid}`);
        const preservedData: any = { authMeta: user.metadata, customClaims: user.customClaims };
        // 新 uid 側に何かデータがある場合は保全 (通常はゼロ件のはず)
        const userDoc = await db.collection('users').doc(newUid).get();
        if (userDoc.exists) preservedData.userDoc = userDoc.data();
        const plansSnap = await db.collection('plans').where('ownerId', '==', newUid).get();
        if (!plansSnap.empty) preservedData.plans = plansSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
        // 上記同様に他の collection も保全したい場合はここに追加 (基本は空想定なのでスキップ可能)

        // 既存空アカウントを削除
        await auth.deleteUser(newUid);
        await db.collection('users').doc(newUid).delete().catch(() => {});
        return { existed: true, preservedData };
    } catch (err: any) {
        if (err?.code === 'auth/user-not-found') {
            return { existed: false, preservedData: null };
        }
        throw err;
    }
}
```

- [ ] **Step 4: per-user migration メイン関数を追加**

続けて追加:

```typescript
interface MigrateResult {
    oldUid: string;
    newUid: string;
    success: boolean;
    error: string | null;
    counts: {
        firestoreCopied: number;
        firestoreDeleted: number;
        storageCopied: number;
        storageDeleted: number;
        crossRefUpdated: number;
        windowSweepData: any | null;
    };
}

async function migrateSingleUser(oldUid: string): Promise<MigrateResult> {
    const discordId = oldUid.replace('discord:', '');
    const newUid = hashUid(discordId, secret);
    const result: MigrateResult = {
        oldUid, newUid, success: false, error: null,
        counts: { firestoreCopied: 0, firestoreDeleted: 0, storageCopied: 0, storageDeleted: 0, crossRefUpdated: 0, windowSweepData: null },
    };

    try {
        // Step 0: 「窓」 対策
        const windowCheck = await handlePreExistingNewUid(newUid);
        if (windowCheck.existed) {
            result.counts.windowSweepData = windowCheck.preservedData;
            console.log(`  Window sweep: pre-existing newUid removed (data preserved in result)`);
        }

        // Step 1: 旧 uid の Auth 確認 (既に migration 済なら skip)
        const oldUser = await auth.getUser(oldUid).catch((err) => {
            if (err?.code === 'auth/user-not-found') return null;
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

        // shared_plans の copiedBy/{oldUid} → copiedBy/{newUid} (自分が作った shared_plans の中)
        const ownSharedSnap = await db.collection('shared_plans').where('ownerId', '==', newUid).get(); // 既に newUid に更新されている
        for (const doc of ownSharedSnap.docs) {
            const oldCb = await doc.ref.collection('copiedBy').doc(oldUid).get();
            if (oldCb.exists) {
                await doc.ref.collection('copiedBy').doc(newUid).set(oldCb.data()!);
                await oldCb.ref.delete();
                result.counts.firestoreCopied++;
            }
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

        // Step 8: Verify (件数一致)
        const oldPlansAfter = (await db.collection('plans').where('ownerId', '==', oldUid).get()).size;
        const newPlans = (await db.collection('plans').where('ownerId', '==', newUid).get()).size;
        if (oldPlansAfter !== 0) {
            throw new Error(`Verify failed: oldUid plans 残存 ${oldPlansAfter} 件 (should be 0)`);
        }
        // (詳細な verify は verify-hash-migration.ts で行う)

        // Step 9: 旧 uid 全削除
        // Firestore
        await db.collection('users').doc(oldUid).delete().catch(() => {});
        await db.collection('userPlanCounts').doc(oldUid).delete().catch(() => {});
        await db.collection('housing_user_meta').doc(oldUid).delete().catch(() => {});
        await deleteSubcollection(db.collection('housing_favorites').doc(oldUid), 'items');
        await db.collection('housing_favorites').doc(oldUid).delete().catch(() => {});
        await deleteSubcollection(db.collection('users').doc(oldUid), 'featureSessions');
        result.counts.firestoreDeleted += 5;
        // Storage
        result.counts.storageDeleted = await deleteStorage(oldUid);
        // Auth
        await auth.deleteUser(oldUid);

        result.success = true;
    } catch (err: any) {
        result.error = err?.message || String(err);
        result.success = false;
        // per-user 自動 rollback
        console.error(`  ❌ FAILED: ${result.error}`);
        console.error(`  Initiating per-user auto-rollback...`);
        await autoRollbackOnFailure(oldUid, newUid);
    }

    return result;
}

async function autoRollbackOnFailure(oldUid: string, newUid: string): Promise<void> {
    // 新 uid 側を全部消す (旧 uid 側は migration が完了する前なので手付かずのはず)
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
        await deleteStorage(newUid);
        console.error(`  ✅ Auto-rollback complete for ${oldUid}`);
    } catch (rollbackErr: any) {
        console.error(`  ❌ AUTO-ROLLBACK FAILED: ${rollbackErr?.message || rollbackErr}`);
        console.error(`  Manual intervention required. Run: npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid=${oldUid}`);
    }
}
```

- [ ] **Step 5: execute モードのループを追加**

続けて追加:

```typescript
async function runExecuteMode(targetUids: string[], filterOnly: string | undefined): Promise<void> {
    const filtered = filterOnly ? targetUids.filter((u) => u === filterOnly) : targetUids;
    if (filterOnly && filtered.length === 0) {
        console.error(`❌ --only=${filterOnly} は TARGET_UIDS に存在しません`);
        process.exit(1);
    }

    // backup 存在 verify (dry-run と同じチェック)
    const missingBackups = filtered.filter((u) => !existsSync(join(BACKUP_DIR, `${u.replace(/[:/\\]/g, '_')}.json`)));
    if (missingBackups.length > 0) {
        console.error(`❌ 事前 backup 不足: ${missingBackups.length} 件。 --backup を先に実行してください`);
        process.exit(1);
    }

    console.log(`\n=== EXECUTE: Hash Migration ===`);
    console.log(`Target: ${filtered.length} uids${filterOnly ? ` (only=${filterOnly})` : ''}`);
    console.log(`Starting in 5 seconds (Ctrl-C to abort)...\n`);
    await new Promise((r) => setTimeout(r, 5000));

    const results: MigrateResult[] = [];
    for (let i = 0; i < filtered.length; i++) {
        const uid = filtered[i];
        console.log(`\n[${(i + 1).toString().padStart(2)}/${filtered.length}] Migrating ${uid}...`);
        const result = await migrateSingleUser(uid);
        results.push(result);

        if (result.success) {
            console.log(`  ✅ Done: ${uid} → ${result.newUid.slice(0, 32)}...`);
            console.log(`     firestore: ${result.counts.firestoreCopied} copied, ${result.counts.firestoreDeleted} deleted`);
            console.log(`     storage: ${result.counts.storageCopied} copied, ${result.counts.storageDeleted} deleted`);
            console.log(`     cross-ref: ${result.counts.crossRefUpdated} updated`);
        } else {
            console.error(`  ❌ FAILED on ${uid}: ${result.error}`);
            console.error(`  Stopping execution. ${filtered.length - i - 1} uids unprocessed.`);
            break;
        }
    }

    const success = results.filter((r) => r.success).length;
    const failed = results.length - success;
    console.log(`\n=== Migration Summary ===`);
    console.log(`Success: ${success}/${filtered.length}`);
    console.log(`Failed: ${failed}`);
    if (success > 0) {
        console.log(`\n次のステップ: npx tsx scripts/verify-hash-migration.ts で件数比較検証`);
    }
}
```

- [ ] **Step 6: main() に execute 分岐を追加**

```typescript
    if (flags.mode === 'execute') {
        await runExecuteMode(targetUids, flags.only);
        return;
    }
```

- [ ] **Step 7: ダミー uid で動作確認 (実 Firestore 書き込みなし、 ただし auth.getUser は実際呼ばれるので user-not-found を返す)**

```bash
mkdir -p docs/.private/backups/2026-05-20-pre-hash
echo '{}' > docs/.private/backups/2026-05-20-pre-hash/discord_safetycheck_1.json
echo '{}' > docs/.private/backups/2026-05-20-pre-hash/discord_safetycheck_2.json
```

Run: `npx tsx scripts/hash-migrate-users.ts --execute --confirm`

Expected: 「Starting in 5 seconds...」 → 5 秒後に 1 件目で `oldUid does not exist in Firebase Auth` → failed → break。 Summary に Success: 0, Failed: 1。

- [ ] **Step 8: --execute だけで confirm 無しの場合は abort 確認**

Run: `npx tsx scripts/hash-migrate-users.ts --execute`

Expected: `❌ --execute を指定するときは --confirm も必須です`

- [ ] **Step 9: 掃除**

```bash
rm -rf docs/.private/backups/2026-05-20-pre-hash/
```

- [ ] **Step 10: Commit**

```bash
rtk git add scripts/hash-migrate-users.ts
rtk git commit -m "feat(scripts): hash-migrate-users execute モード本体を実装 (per-user migration + auto-rollback)"
```

### Task 12: rollback モード (手動復元) を実装

**Files:**
- Modify: `scripts/hash-migrate-users.ts`

- [ ] **Step 1: rollback 関数を追加**

`runExecuteMode` の下に追加:

```typescript
async function runRollbackMode(targetUid: string): Promise<void> {
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
        await db.collection('users').doc(oldUid).set(backup.firestore.users);
    }
    if (backup.firestore.userPlanCounts) {
        await db.collection('userPlanCounts').doc(oldUid).set(backup.firestore.userPlanCounts);
    }
    if (backup.firestore.housingUserMeta) {
        await db.collection('housing_user_meta').doc(oldUid).set(backup.firestore.housingUserMeta);
    }
    for (const item of backup.firestore.housingFavoritesItems) {
        await db.collection('housing_favorites').doc(oldUid).collection('items').doc((item as any).id).set((item as any).data);
    }
    for (const sess of backup.firestore.featureSessions) {
        await db.collection('users').doc(oldUid).collection('featureSessions').doc((sess as any).id).set((sess as any).data);
    }
    for (const p of backup.firestore.plans) {
        await db.collection('plans').doc((p as any).id).set((p as any).data);
    }
    for (const m of backup.firestore.sharedPlanMeta) {
        await db.collection('sharedPlanMeta').doc((m as any).id).set((m as any).data);
    }
    for (const sp of backup.firestore.sharedPlans) {
        await db.collection('shared_plans').doc((sp as any).id).set((sp as any).data);
    }
    for (const cb of backup.firestore.sharedPlansCopiedBy) {
        await db.collection('shared_plans').doc((cb as any).sharedPlanId).collection('copiedBy').doc((cb as any).id).set((cb as any).data);
    }
    for (const l of backup.firestore.housingListings) {
        await db.collection('housing_listings').doc((l as any).id).set((l as any).data);
    }
    for (const lr of backup.firestore.housingListingsReports) {
        for (const r of lr.reports) {
            await db.collection('housing_listings').doc(lr.listingId).collection('reports').doc(r.id).set(r.data);
        }
    }
    for (const t of backup.firestore.housingTours) {
        await db.collection('housing_tours').doc((t as any).id).set((t as any).data);
    }
    // cross-refs
    for (const cr of backup.firestore.crossRefCopiedBy) {
        await db.collection('shared_plans').doc(cr.sharedPlanId).collection('copiedBy').doc(oldUid).set(cr.data);
    }
    for (const cr of backup.firestore.crossRefReports) {
        for (const r of cr.reports) {
            await db.collection('housing_listings').doc(cr.listingId).collection('reports').doc(r.id).set(r.data);
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
```

- [ ] **Step 2: main() に rollback 分岐を追加**

```typescript
    if (flags.mode === 'rollback') {
        await runRollbackMode(flags.uid!);
        return;
    }
```

- [ ] **Step 3: rollback の動作確認 (ダミー uid + 空 backup file)**

```bash
mkdir -p docs/.private/backups/2026-05-20-pre-hash
cat > docs/.private/backups/2026-05-20-pre-hash/discord_safetycheck_1.json <<EOF
{
  "oldUid": "discord:safetycheck_1",
  "auth": { "exists": false, "customClaims": null, "providerData": [], "metadata": {} },
  "firestore": {
    "users": null, "plans": [], "sharedPlanMeta": [], "sharedPlans": [],
    "sharedPlansCopiedBy": [], "sharedPlansAnonCopiedBy": [],
    "userPlanCounts": null, "housingUserMeta": null,
    "housingListings": [], "housingListingsReports": [],
    "housingFavoritesItems": [], "housingTours": [], "featureSessions": [],
    "crossRefCopiedBy": [], "crossRefReports": []
  },
  "storage": [],
  "timestamp": "2026-05-20T00:00:00.000Z"
}
EOF
```

Run: `npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid=discord:safetycheck_1`

Expected: 5 秒待機 → 「Step 1: Deleting newUid side...」 → 「Step 2: Restoring oldUid from backup...」 (実 IO はほぼゼロ件のはず) → `✅ Rollback complete`

- [ ] **Step 4: 掃除**

```bash
rm -rf docs/.private/backups/2026-05-20-pre-hash/
```

- [ ] **Step 5: Commit**

```bash
rtk git add scripts/hash-migrate-users.ts
rtk git commit -m "feat(scripts): hash-migrate-users rollback モード (--rollback --uid=) を実装"
```

---

## Phase 5: preflight check スクリプト

**目的**: migration 実行直前に「全前提が満たされているか」 を自動チェック。 1 つでも fail したら migration 開始を防ぐ。

### Task 13: preflight-hash-migration.ts を作成

**Files:**
- Create: `scripts/preflight-hash-migration.ts`

- [ ] **Step 1: スクリプト本体を作成**

Create `scripts/preflight-hash-migration.ts`:

```typescript
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
    // POST /api/auth?provider=discord で App Check token がない → 401 expected
    // 401 が返れば「endpoint が live」 と判断 (内部実装の hashUid 呼び出しは OAuth コールバック側だが、
    // POST の段階で deploy 状態は確認可能)。 ただし新コードか旧コードかは判別できないので、
    // 補助的なチェックとして「Vercel に LOPO_PSEUDONYM_SECRET が反映されているか」 を別途確認したい。
    const prodUrl = env.LOPO_PROD_URL || 'https://lopoly.app';
    try {
        const res = await fetch(`${prodUrl}/api/auth?provider=discord`, { method: 'POST' });
        // App Check なしなので 401 or 400 が返る想定 (どちらも endpoint live を意味する)
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
```

- [ ] **Step 2: 動作確認 (TARGET_UIDS JSON 無しの状態で expected fail)**

Run: `npx tsx scripts/preflight-hash-migration.ts`

Expected: いくつか ❌ が出て exit 1。 「Preflight FAILED」

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/preflight-hash-migration.ts
rtk git commit -m "feat(scripts): preflight-hash-migration.ts (migration 前の自動安全チェック)"
```

---

## Phase 6: verify スクリプト

**目的**: migration 完了後に「件数が一致しているか」 「旧 uid が完全に消えているか」 を自動確認。

### Task 14: verify-hash-migration.ts を作成

**Files:**
- Create: `scripts/verify-hash-migration.ts`

- [ ] **Step 1: スクリプト本体を作成**

Create `scripts/verify-hash-migration.ts`:

```typescript
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
        };
        const actual = {
            plans: (await db.collection('plans').where('ownerId', '==', newUid).get()).size,
            sharedPlanMeta: (await db.collection('sharedPlanMeta').where('ownerId', '==', newUid).get()).size,
            sharedPlans: (await db.collection('shared_plans').where('ownerId', '==', newUid).get()).size,
            housingListings: (await db.collection('housing_listings').where('ownerUid', '==', newUid).get()).size,
            housingFavoritesItems: (await db.collection('housing_favorites').doc(newUid).collection('items').get()).size,
            housingTours: (await db.collection('housing_tours').where('ownerUid', '==', newUid).get()).size,
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
```

- [ ] **Step 2: TypeScript syntax check**

Run: `npx tsc --noEmit --strict scripts/verify-hash-migration.ts` (or `npm run build` で全体確認)

Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/verify-hash-migration.ts
rtk git commit -m "feat(scripts): verify-hash-migration.ts (migration 後の自動検証)"
```

---

## Phase 7: コードレビュー (人間チェックポイント)

**目的**: コード一式をコードレビュー専門 agent に評価させ、 セキュリティ・ロジック欠陥を洗い出す。

### Task 15: コードレビュー実施

> このタスクは subagent には任せず、 人間が `superpowers:requesting-code-review` を起動して進める。

- [ ] **Step 1: コードレビュー依頼**

人間が以下を実行 (Claude 経由 OK):

```
superpowers:requesting-code-review を起動。
レビュー対象: Phase 1 〜 Phase 6 の全 commit (4 〜 数 commit 分)。
重点項目:
- セキュリティ: secret 取り扱い、 hash アルゴリズム、 prefix チェック
- データ整合性: per-user migration の race condition、 atomic性
- 失敗時挙動: rollback の正確性、 error handling
- 「窓」 対策の効果: handlePreExistingNewUid のエッジケース
```

- [ ] **Step 2: フィードバックを反映**

レビューで出た指摘を 1 つずつ修正。 修正ごとに別 commit (1 指摘 = 1 commit)。 大きな設計変更が必要な場合は brainstorming に戻る。

- [ ] **Step 3: 再レビュー (必要なら)**

修正後にもう一度コードレビューを依頼。 「OK」 が出るまで繰り返す。

- [ ] **Step 4: レビュー pass の commit**

```bash
rtk git commit --allow-empty -m "review: code review pass for hash migration step 2"
```

(レビュー結果を git log に残すための marker commit)

---

## Phase 8: 本番準備 (人間チェックポイント)

**目的**: secret 生成、 Vercel 投入、 TARGET_UIDS JSON 作成。 人間が手動で実施。

### Task 16: secret 生成 + ローカル + 1Password 保管

> 人間操作。 subagent は補助のみ。

- [ ] **Step 1: secret 生成**

Run (Claude が出力):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Expected: 64 文字の hex (例 `a3b1f8c...`)。 標準出力に **絶対** ログ収集に流れない形でコピー (シェル history に残らないよう注意)。

- [ ] **Step 2: ローカル `.env.local` に追記**

`c:\Users\masay\Desktop\FF14Sim\.env.local` を開いて末尾に追加:

```
# Hash 化マイグレーション用 (rotation 不可、 紛失で全データ参照不能)
LOPO_PSEUDONYM_SECRET=<step1 で生成した 64 文字 hex>
```

注意: ファイルは gitignore 済を確認 (`git status` で `.env.local` が untracked にも staged にも出ないこと)

- [ ] **Step 3: 1Password 等に保管**

masaya-men さんが信頼するパスワードマネージャを開いて、 新規 secure note 作成:
- タイトル: `LoPo - LOPO_PSEUDONYM_SECRET (rotation 不可)`
- 内容: secret 値 + 「これを失うと LoPo の全ユーザーデータ参照不能になる」 の注意書き + 作成日 2026-05-20

### Task 17: Vercel 環境変数に投入

> 人間操作。

- [ ] **Step 1: Vercel ダッシュボード**

https://vercel.com/<masaya-men>/lopo-miti (or プロジェクト名) → Settings → Environment Variables

- [ ] **Step 2: 新規追加**

- Name: `LOPO_PSEUDONYM_SECRET`
- Value: (Task 16 Step 1 で生成した値)
- Environment: **Production / Preview / Development の全部にチェック**
- **Sensitive にチェック**
- Save

- [ ] **Step 3: 反映確認**

Vercel CLI を使う場合:
```bash
vercel env ls
```

Expected: `LOPO_PSEUDONYM_SECRET` が 3 環境とも sensitive で表示される

### Task 18: TARGET_UIDS JSON 作成

> 人間操作 (uid 値の取り扱いに注意)。

- [ ] **Step 1: 準備メモから 10 件の uid を確認**

`docs/.private/2026-05-19-hash-migration-prep.md` を開く (gitignore 配下)。 § 「23 ユーザー内訳」 の Discord セクションから 9 件 + Step 1 後の新規 signup 1 件 = 10 件をリストアップ。

新規 signup 1 件の uid は `scripts/check-admin-claims.ts` を再実行して取得:
```bash
npx tsx scripts/check-admin-claims.ts
```
出力の `[discord (legacy)]` セクションに 10 件並ぶ。 prep memo の 9 件と差分の 1 件が新規 signup。

- [ ] **Step 2: JSON 作成**

Create `docs/.private/hash-migration-target-uids.json` (gitignore 配下):

```json
{
  "_comment": "Step 2 (hash 化マイグレーション) の対象 uid 10 件。 LOPO_PSEUDONYM_SECRET と組合せて hashed: uid を生成する。",
  "_warning": "このファイルは個人特定可能な Discord ID 含む。 絶対に git commit しないこと。 .private/ が gitignored で守られている。",
  "_created": "2026-05-20",
  "discord": [
    "discord:<本人 uid>",
    "discord:<2 件目>",
    "discord:<3 件目>",
    "discord:<4 件目>",
    "discord:<5 件目>",
    "discord:<6 件目>",
    "discord:<7 件目>",
    "discord:<8 件目>",
    "discord:<9 件目>",
    "discord:<10 件目>"
  ]
}
```

`<...>` を実 uid に置換。

- [ ] **Step 3: 確認**

Run: `git status`

Expected: `docs/.private/hash-migration-target-uids.json` が**現れないこと** (gitignored)

```bash
cat docs/.private/hash-migration-target-uids.json | head -5
```

Expected: JSON 形式で 10 件 discord: prefix の uid が並ぶ

---

## Phase 9: 事前 backup + dry-run + コードデプロイ

**目的**: 全 10 件の backup を取り、 dry-run で計画を目視確認後、 アプリ側コードをデプロイ。

### Task 19: 事前 backup 取得

> 人間がコマンド実行 → 出力を確認。

- [ ] **Step 1: backup 実行**

Run: `npx tsx scripts/hash-migrate-users.ts --backup`

Expected:
- 各 uid について `[N/10] Backup: discord:...` → `✅ docs/.private/backups/2026-05-20-pre-hash/<sanitized>.json` のログ
- 最後に `Created: 10, Skipped: 0, Total: 10`

- [ ] **Step 2: backup ファイル確認**

Run:
```bash
ls -la docs/.private/backups/2026-05-20-pre-hash/
```

Expected: 10 個の JSON ファイル

- [ ] **Step 3: spot check (1 件だけ中身を見る)**

```bash
cat docs/.private/backups/2026-05-20-pre-hash/<first-uid>.json | head -50
```

Expected: `oldUid`, `auth.exists: true`, `firestore.users` 等のフィールドが埋まっている

### Task 20: dry-run + 内容確認

> 人間がコマンド実行 → 出力を目視確認。

- [ ] **Step 1: dry-run 実行**

Run: `npx tsx scripts/hash-migrate-users.ts`

Expected: `=== DRY RUN: Hash Migration (Step 2) ===` の見出し、 10 件分の整形出力、 Summary

- [ ] **Step 2: 出力を目視確認**

確認項目:
- ✅ Backup verified: 10/10 files
- ✅ Target uids: 10
- ✅ 各 uid の admin claim: 本人 1 件 = YES、 他 9 件 = none
- ✅ 各 uid の auth account: exists (provider: discord)
- ✅ 件数の合計が現実的 (Firestore writes が数百件以下、 Storage files が数十件以下)
- ✅ 想定外の cross-ref hits が極端に多くない

異常があれば調査 → 解決 → 再 dry-run。

### Task 21: アプリ側コードを Vercel にデプロイ

> 人間がコマンド実行。 ここから「窓」 が開く。

- [ ] **Step 1: 現在の commit 状態確認**

Run: `rtk git log --oneline -10`

Expected: Phase 1-6 の commit が全て積まれている (hashUid 追加、 auth handler 修正、 prefix 修正、 migration script 4 commit、 preflight、 verify、 review 等)

- [ ] **Step 2: ブランチ状態の最終確認**

Run: `rtk git status`

Expected: clean (uncommitted 変更なし)

- [ ] **Step 3: push**

Run: `rtk git push`

Expected: Vercel が自動でデプロイ開始

- [ ] **Step 4: Vercel デプロイ完了確認**

Vercel ダッシュボードを開く。 deploy が「Ready」 になるまで待つ (1-2 分)。

- [ ] **Step 5: デプロイ済の auth endpoint を確認**

Run:
```bash
curl -X POST https://lopoly.app/api/auth?provider=discord -v 2>&1 | head -30
```

Expected: 401 or 400 (App Check 無いため)。 endpoint が live であることの確認

これで「窓」 が開いた状態 (新コード live + migration 未実施)。 すぐに Phase 10 に進む。

---

## Phase 10: preflight + 人柱 migration + 検証

**目的**: preflight check → 本人 1 件のみ migration → 自動検証 → 手動検証 (実画面)。 失敗を検出したら即 rollback。

### Task 22: preflight check 実行

> 人間がコマンド実行。

- [ ] **Step 1: preflight 実行**

Run: `npx tsx scripts/preflight-hash-migration.ts`

Expected: 全 ✅ で「All preflight checks PASSED」

もし ❌ が出たら:
- secret 未配備 → Phase 8 を再実行
- TARGET_UIDS 件数違い → 準備メモを再確認
- backup 不足 → Phase 9 Task 19 を再実行
- 0auth endpoint dead → Phase 9 Task 21 を再実行

### Task 23: 人柱 migration (本人 uid のみ)

> 人間がコマンド実行 → 完了確認。

- [ ] **Step 1: 本人 uid を取得**

masaya-men さんが `docs/.private/hash-migration-target-uids.json` を開き、 自分の uid (admin の `discord:...`) を 1 つコピー。

- [ ] **Step 2: 人柱 execute**

Run (`<本人 uid>` は実値に置換):
```bash
npx tsx scripts/hash-migrate-users.ts --execute --confirm --only=discord:<本人 uid>
```

Expected:
- 5 秒のカウントダウン
- `[1/1] Migrating discord:<本人 uid>...`
- per-user 内部ログ (window check, copy各種, delete各種)
- `✅ Done: discord:<本人 uid> → hashed:<32 chars>...`
- Summary: Success: 1/1, Failed: 0

もし `❌ FAILED` が出たら:
- Auto-rollback が動いたか確認 (ログに `✅ Auto-rollback complete`)
- ❌ Auto-rollback も失敗の場合: `npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid=discord:<本人 uid>` を実行
- 原因を調査するまで Phase 11 に進まない

### Task 24: 自動検証 (verify スクリプト)

> 人間がコマンド実行。

- [ ] **Step 1: verify 実行**

Run:
```bash
npx tsx scripts/verify-hash-migration.ts --uid=discord:<本人 uid>
```

Expected: `✅ discord:<本人 uid>` + `Result: 1 pass, 0 fail`

もし fail なら、 出力の errors を読んで該当箇所を確認。 必要なら `--rollback` で復元 → 原因調査。

### Task 25: 手動検証 (本人が LoPo で実際に動作確認)

> 人間操作。 失敗許容ゼロの最重要チェックポイント。

- [ ] **Step 1: LoPo を再読み込み**

masaya-men さんが https://lopoly.app を開いて Cmd+Shift+R (or Ctrl+Shift+R) で完全リロード

Expected: 自動的にログアウト状態になる (旧 token 無効)

- [ ] **Step 2: Discord でログイン**

ログインボタン → Discord OAuth → 自動的にコールバック

Expected: ログイン成功して LoPo のホーム画面が出る

- [ ] **Step 3: 軽減表の中身を確認**

軽減表タブを開く → 既存の軽減表が 1 件以上見える → 1 件開いて中身 (job / mitigation 配置) が壊れていないか確認

Expected: 移行前と全く同じ表示

- [ ] **Step 4: ハウジング登録確認**

`/housing` を開く → 自分が登録した物件がある場合は見えるか、 自分のお気に入りが見えるか確認

Expected: 移行前と同じ

- [ ] **Step 5: アバター + admin 画面確認**

右上アバターが表示されているか確認。 `/admin` を開く → 管理画面に入れるか (admin claim が再付与されているか)

Expected: アバター表示 OK、 admin 画面アクセス OK

- [ ] **Step 6: 5-10 分操作観察**

このまま 5-10 分 LoPo を触り続けて、 不審なエラーや表示崩れがないか観察。 console (F12 開発者ツール) もエラーがないか確認。

- [ ] **Step 7: 判定**

- ✅ 全て OK → Phase 11 に進む
- ⚠️ 何か異常あり → 即座に Claude に報告 → `--rollback --uid=discord:<本人 uid>` で復元 → 原因調査
- ❌ 重大な異常 (データ消失等) → 即 rollback + 全 backup 再確認 → 設計見直し

---

## Phase 11: 残り 9 件 migration + 全件検証

**目的**: 人柱が成功したら、 残り 9 件を一気に migration。 完了後に全件検証。

### Task 26: 残り 9 件 execute

> 人間がコマンド実行。

- [ ] **Step 1: execute (全件、 本人 uid は skip される)**

Run: `npx tsx scripts/hash-migrate-users.ts --execute --confirm`

注意: スクリプトの per-user フロー Step 1 で「oldUid が存在せず newUid が存在」 = 「既に migration 済」 と判定 → `⏭️  Already migrated, skip` で次に進む (Task 11 Step 4 で実装済)。

Expected:
- `[1/10]` 本人 uid: `⏭️  Already migrated, skip` (1 行)
- `[2/10]` 〜 `[10/10]`: 各 uid の migration ログ (5 秒のカウントダウン後)
- Summary: Success: 10/10 (skip 含む)

- [ ] **Step 2: ログを保存**

ターミナル出力を全てコピーして `docs/.private/migration-log-2026-05-20.txt` に保存 (gitignored)。

### Task 27: 全件 verify

> 人間がコマンド実行。

- [ ] **Step 1: verify 全件**

Run: `npx tsx scripts/verify-hash-migration.ts`

Expected: `✅` が 10 件並び、 `Result: 10 pass, 0 fail`

- [ ] **Step 2: check-admin-claims 再実行**

Run: `npx tsx scripts/check-admin-claims.ts`

Expected:
- 総ユーザー数: **10**
- admin claim 付き: **1**
- `[discord (hashed)]` グループに 10 件 (admin が 1 件マーク付き)
- `[discord (legacy)]` グループは出現しない (= 旧 uid 残骸ゼロ)

- [ ] **Step 3: Firestore Console での spot check (任意)**

Firebase Console を開く → Firestore → `plans` collection → ownerId フィールドで `startsWith discord:` で query → 0 件であることを確認

同様に `housing_listings.ownerUid` も確認。

### Task 28: 全機能の手動検証

> 人間操作。 本人だけで全機能を再確認。

- [ ] **Step 1: 強制リロード → 再ログイン**

LoPo を強制リロード → Discord ボタンでログイン

- [ ] **Step 2: 全機能確認**

- ✅ 軽減表: 既存表示 + 新規作成 + 編集 + 削除
- ✅ ハウジング: 物件一覧 + お気に入り + 自分の登録物件
- ✅ アバター: 表示 + 編集 (アップロード)
- ✅ admin 画面: アクセス + ユーザー一覧表示
- ✅ ログアウト + 再ログイン: スムーズに動作

不審点があれば該当 uid を `--rollback` で復元 → 調査。

---

## Phase 12: プライバシーポリシー更新

**目的**: 「Discord ID は hash 化して保存」 をプライバシーポリシーに明記。 ja/en/ko/zh 全対応。

### Task 29: i18n キー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

- [ ] **Step 1: 既存の privacy section のキー構造を確認**

Run:
```bash
grep -n "privacy" src/locales/ja.json | head -30
```

Expected: 既存の privacy 関連 i18n キーが見つかる (例 `privacy.title`, `privacy.section1.title` 等)

- [ ] **Step 2: 新キー `privacy.hashedId` を 4 言語に追加**

ja.json の privacy section に追加 (実際の構造に合わせて調整):

```json
"privacy.hashedId.title": "Discord ID の hash 化保管について",
"privacy.hashedId.body": "LoPo は Discord のユーザー ID を、 サーバー側で保管している秘密鍵と組み合わせて HMAC-SHA256 で hash 化した値のみを保存します。 元の Discord ID は LoPo のデータベースには一切保存されず、 LoPo 運営者を含む LoPo 内部からも復元することはできません。 この hash 化により、 万が一 LoPo のデータが漏洩した場合でも、 利用者の Discord アカウントが特定されるリスクは極めて低くなります。"
```

en.json:
```json
"privacy.hashedId.title": "About Discord ID hashing",
"privacy.hashedId.body": "LoPo stores only the HMAC-SHA256 hash of your Discord user ID, combined with a server-side secret. The original Discord ID is never saved in LoPo's database, and cannot be recovered by anyone—including LoPo operators. As a result, even if LoPo's data were ever leaked, the risk of your Discord account being identified is extremely low."
```

ko.json:
```json
"privacy.hashedId.title": "Discord ID 해시화 보관에 대해",
"privacy.hashedId.body": "LoPo는 Discord 사용자 ID를 서버 측에 보관된 비밀 키와 결합해 HMAC-SHA256으로 해시화한 값만 저장합니다. 원본 Discord ID는 LoPo의 데이터베이스에 일절 저장되지 않으며 LoPo 운영자를 포함한 LoPo 내부에서도 복원할 수 없습니다. 이 해시화로 인해 만일 LoPo의 데이터가 유출되더라도 이용자의 Discord 계정이 특정될 위험은 극히 낮습니다."
```

zh.json:
```json
"privacy.hashedId.title": "关于 Discord ID 的哈希化保管",
"privacy.hashedId.body": "LoPo 仅保存 Discord 用户 ID 与服务器端密钥结合后的 HMAC-SHA256 哈希值。 原始 Discord ID 不会保存在 LoPo 数据库中, 包括 LoPo 运营者在内的任何人都无法从内部恢复。 通过这种哈希化, 即使 LoPo 数据发生泄露, 用户的 Discord 账号被识别的风险也极低。"
```

- [ ] **Step 3: build + test 確認**

Run: `npm run build && npm test`

Expected: 全 PASS

### Task 30: privacy ページに新 section を表示

**Files:**
- Modify: `src/components/LegalPage.tsx` (or プライバシーポリシーが表示されるコンポーネント)

- [ ] **Step 1: LegalPage 内の構造を確認**

Read `src/components/LegalPage.tsx` の privacy 表示部分

- [ ] **Step 2: 新 section を追加**

既存の privacy section 群の末尾あたりに追加:

```tsx
<section>
    <h2>{t('privacy.hashedId.title')}</h2>
    <p>{t('privacy.hashedId.body')}</p>
</section>
```

実際のコンポーネント構造に応じて調整。

- [ ] **Step 3: build + test**

Run: `npm run build && npm test`

Expected: 全 PASS

- [ ] **Step 4: ローカルで表示確認**

Run: `npm run dev`

ブラウザで `/legal/privacy` を開く → ja/en/ko/zh 切替えて新 section が表示されることを確認。

- [ ] **Step 5: Commit**

```bash
rtk git add src/locales/*.json src/components/LegalPage.tsx
rtk git commit -m "feat(privacy): hash 化に関する説明をプライバシーポリシーに追加 (ja/en/ko/zh)"
```

- [ ] **Step 6: push + デプロイ確認**

Run: `rtk git push`

Vercel ダッシュボードで deploy 完了を待つ → https://lopoly.app/legal/privacy で新 section が live に出ているか確認。

---

## Phase 13: docs / memory 更新 + 最終 push

**目的**: TODO.md / TODO_COMPLETED.md を Step 2 完了状態に更新。 memory の `project_hash_migration_status.md` も更新。

### Task 31: TODO.md 更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 「現在の状態」 セクションを Step 2 完了に更新**

`docs/TODO.md` の 「現在の状態 (次セッションはここから読む)」 を以下に置き換え:

```markdown
## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #41 (2026-05-20) で **hash 化マイグレーション Step 2 完了**
- **完了**: Discord 10 件全部の uid を `hashed:` 形式に移行。 全データ (軽減表 / 共有 / ハウジング / アバター) 無事
- **secret 保管**: `LOPO_PSEUDONYM_SECRET` を Vercel sensitive + ローカル .env.local + 1Password の 3 箇所にバックアップ済 (rotation 不可)
- **次は**: ハウジング ログイン UI 整備 (途中 6 項目あり、 準備メモ §「ハウジング ログイン UI 整備の 6 項目」 参照)
- **設計書 / プラン**: docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md / docs/superpowers/plans/2026-05-20-hash-migration-step2.md
- **注意**: ENFORCE_APP_CHECK=true、 Vercel 関数 11/12、 月 100 ビルド
```

「次セッション最優先」 セクションを以下に置き換え:

```markdown
## 次セッション最優先: ハウジング ログイン UI 整備の再開

1. 準備メモを再確認 ([docs/.private/2026-05-19-hash-migration-prep.md](docs/.private/2026-05-19-hash-migration-prep.md) の §「ハウジング ログイン UI 整備の 6 項目」)
2. hash 化完了で「LoPo は連絡できません」 が真になった状態でログイン文言を適用 (準備メモ §「ハウジング ログイン UI 文言 (hash 化完了後に適用)」)
3. 6 項目を順に実装:
   - ハウジング版 LoginModal
   - ハウジング版 AccountModal
   - TopBar 右上ボタン
   - モーダルスタッキング
   - ログイン後の登録モーダル復元
   - × で閉じた時の挙動
```

- [ ] **Step 2: 行数確認**

Run: `wc -l docs/TODO.md`

Expected: 100 行以内 (超過していたら不要セクションを TODO_COMPLETED.md か別ファイルに移動)

### Task 32: TODO_COMPLETED.md 追記

**Files:**
- Modify: `docs/TODO_COMPLETED.md`

- [ ] **Step 1: 先頭に Step 2 完了記録を追加**

`docs/TODO_COMPLETED.md` の先頭に追加:

```markdown
## 完了 (2026-05-20 セッション 41・hash 化マイグレーション Step 2 完了)

**目的**: Discord 10 件の Firebase uid を `discord:<生 ID>` → `hashed:<HMAC-SHA256(id+secret)>` に移行し、 LoPo 内部からも元 Discord ID を復元不能にする。 GDPR pseudonymization 完全達成。

### 完了内容

- 設計書: [docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md](superpowers/specs/2026-05-20-hash-migration-step2-design.md)
- 実装プラン: [docs/superpowers/plans/2026-05-20-hash-migration-step2.md](superpowers/plans/2026-05-20-hash-migration-step2.md)
- 新規ヘルパー: `api/_lib/hashUid.ts` (HMAC-SHA256, server-only)
- 新規スクリプト: `scripts/hash-migrate-users.ts` (backup/dry-run/execute/rollback)、 `scripts/preflight-hash-migration.ts`、 `scripts/verify-hash-migration.ts`
- 環境変数: `LOPO_PSEUDONYM_SECRET` を Vercel sensitive + .env.local + 1Password の 3 箇所に保管 (rotation 不可)
- アプリ側変更: `api/auth/_discordHandler.ts` (hashUid 経由)、 `src/components/LoginModal.tsx` / `src/components/WelcomeSetup.tsx` / `src/utils/logoUpload.ts` の prefix 判定撤廃、 `scripts/check-admin-claims.ts` の hashed: 対応
- プライバシーポリシー文書更新 (ja/en/ko/zh)
- prod 実行: Discord 10 件全部を移行、 失敗ゼロ
- 検証: `scripts/check-admin-claims.ts` で総ユーザー数 10、 admin 1 件、 全て `discord (hashed)` を確認

### 結果

LoPo の認証システムが「個人情報を持たない」 大原則を完全達成。 プライバシーポリシーの主張が文字通り真になった。
```

### Task 33: memory 更新

**Files:**
- Modify: `C:\Users\masay\.claude\projects\c--Users-masay-Desktop-FF14Sim\memory\project_hash_migration_status.md`

- [ ] **Step 1: memory を Step 2 完了状態に更新**

`project_hash_migration_status.md` の内容を以下に置き換え:

```markdown
---
name: ハッシュ化マイグレーション (Step 1 + Step 2 完了)
description: Discord 10 件の uid を hashed:<HMAC-SHA256(id+secret)> 形式に移行完了。 LoPo 内部からも元 Discord ID 復元不能 (= GDPR pseudonymization 達成)。
type: project
---
2026-05-20 セッション #41 で hash 化マイグレーション Step 2 完了。 prod の Discord 10 件は全て hashed: prefix。

**Why:** LoPo 内部から元 Discord ID 復元可能だった (= LoPo 運営者が DM 送信可能) という個人情報保有問題を解決するため。

**Step 1 (完了 2026-05-20)**:
- Twitter 12 + Google 2 = 14 件の廃止プロバイダーユーザーを関連データごと削除
- prod は Discord 10 件のみに

**Step 2 (完了 2026-05-20)**:
- HMAC-SHA256 + サーバー側 secret (`LOPO_PSEUDONYM_SECRET`) で hash 化
- 10 件全部の uid を一斉移行、 関連データ (軽減表 / 共有 / ハウジング / アバター / お気に入り / 通報) も全部 newUid に持ち越し
- `api/auth/_discordHandler.ts` を hashUid 経由に変更
- プライバシーポリシー文書も更新 (ja/en/ko/zh)
- 設計書: `docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md`
- 実装プラン: `docs/superpowers/plans/2026-05-20-hash-migration-step2.md`

**重要な持続事項**:
- `LOPO_PSEUDONYM_SECRET` は **rotation 不可**。 紛失すると全データ参照不能。 Vercel sensitive + .env.local + 1Password の 3 箇所にバックアップ済
- `admin_logs.actorUid` は移行対象外 (= 過去 audit log の uid は `discord:` のまま、 admin 本人のみで個人特定リスク低)

**How to apply (次セッション)**:
- 次は **ハウジング ログイン UI 整備** に戻る (準備メモ §「ハウジング ログイン UI 整備の 6 項目」 参照)
- 「LoPo は連絡できません」 という主張が事実として真になったので、 hash 化前提のログインモーダル文言が使える
```

### Task 34: 最終 commit + push

- [ ] **Step 1: commit**

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(hash-migration): Step 2 完了、 次セッション最優先をハウジング ログイン UI に更新"
```

- [ ] **Step 2: memory のフルパスを push しない (= memory は別管理、 commit 対象外)**

memory の `project_hash_migration_status.md` 更新は Claude のセッション管理経由で実施済。 git status に出ないことを確認。

- [ ] **Step 3: 最終 push**

```bash
rtk git push
```

Expected: Vercel デプロイは scripts/ のみの変更も含むが、 src/locales と src/components 修正もあるため通常 deploy 1 回。

- [ ] **Step 4: deploy 完了確認**

Vercel ダッシュボードで「Ready」 を待つ。

---

## 完了の定義 (Step 2 全体)

- ✅ Discord 10 件全ての uid が `hashed:` prefix になっている
- ✅ `scripts/check-admin-claims.ts` 出力で 「総ユーザー数 10、 admin 1 (本人 hashed: uid)」 を確認できる
- ✅ Firestore に `discord:` prefix で始まる ownerId / actorUid (admin_logs を除く) / reporterUid 等のフィールドが残っていない
- ✅ Firebase Storage に `users/discord:*` パスが残っていない
- ✅ masaya-men さんの全機能 (軽減表 / 共有 / ハウジング / アバター / admin) が正常動作
- ✅ アプリ側コード変更がデプロイ済
- ✅ プライバシーポリシー更新が ja/en/ko/zh の 4 言語で deploy 済
- ✅ `LOPO_PSEUDONYM_SECRET` が 1Password + .env.local + Vercel 環境変数の 3 箇所にバックアップ済
- ✅ TODO.md / TODO_COMPLETED.md / memory が Step 2 完了状態を反映
- ✅ verify スクリプト全件 PASS

---

## 失敗時の rollback コマンドリファレンス

### 1 件だけ rollback したい場合

```bash
npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid=discord:<対象 uid>
```

Expected:
- 5 秒待機
- `Step 1: Deleting newUid side...`
- `Step 2: Restoring oldUid from backup...`
- `✅ Rollback complete for discord:<uid>`

### 全件 rollback したい場合

10 件分の `--rollback` を順に実行:
```bash
for uid in $(jq -r '.discord[]' docs/.private/hash-migration-target-uids.json); do
    npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid="$uid"
done
```

### コードも revert したい場合

```bash
# Phase 1 〜 6 の commit を全部 revert (Phase 7 の review marker commit 含む)
rtk git revert <first-commit-hash>..<last-commit-hash>
rtk git push
```

(Vercel が自動で旧版を再デプロイ → migrating 中だった hashed: uid は次回ログインで discord: uid に戻る)

---

## App Check / PWA cache / CDN cache の二次影響

| 項目 | 影響 | 対策 |
|---|---|---|
| App Check token | uid とは別管理 (端末ベース)、 影響なし | 何もしない |
| PWA SW cache | 旧 token がキャッシュされている可能性、 ハードリロードで解決 | masaya-men さんに「強制リロード or SW 再登録」 と伝える (Phase 10 Task 25 Step 1) |
| Avatar 画像の CDN cache | URL が `users/discord:.../avatar.webp` → `users/hashed:.../avatar.webp` に変わる、 旧 URL は 404 | アバター URL を参照する箇所は user.uid を動的に組み立てているため自動追従。 CDN cache は数分でクリアされる |
| Firestore offline cache | クライアント側に新 uid のデータが順次同期される、 ハイブリッド状態 (古い ownerId と新 ownerId が混在) を経験する可能性 | masaya-men さんに「再ログイン後に強制リロード」 を案内 |
| Vercel Edge cache | API レスポンスは uid 個別 = cache されない | 何もしない |

---

## 想定 Q&A

**Q. 移行中に新規ユーザーが Discord で signup したら?**
A. Phase 9 デプロイ後 = 新コードが動いている → hashed: uid が即座に作られる。 移行対象 (TARGET_UIDS 10 件) には含まれないが、 そもそも hashed: で生成されているので migration 不要。 安全。

**Q. 移行中に既存ユーザーが Vercel preview にアクセスしたら?**
A. preview も同じ Firebase + 同じ secret を使うので、 prod と同じ挙動。 影響なし。

**Q. 本人 1 名だけ migration して中断した場合、 残り 9 件はどう扱う?**
A. 残り 9 件は `discord:` のまま、 新コードは `hashed:` token を生成。 次回ログインで「hashed: uid の空アカウント」 が作られる「窓」 リスクが継続する。 速やかに残り 9 件の migration を実施するか、 全件 rollback して旧コードに戻す。

**Q. プライバシーポリシー更新を忘れたらどうなる?**
A. 法的には「真実とは異なる記載」 になる (= データを hash 化しているのに、 ポリシーには明記されていない)。 Phase 12 で確実に実施。

---

## 参照リンク

- 設計書: [../specs/2026-05-20-hash-migration-step2-design.md](../specs/2026-05-20-hash-migration-step2-design.md)
- Step 1 設計書: [../specs/2026-05-20-legacy-user-cleanup-design.md](../specs/2026-05-20-legacy-user-cleanup-design.md)
- Step 1 実装プラン: [2026-05-20-legacy-user-cleanup.md](2026-05-20-legacy-user-cleanup.md)
- 準備メモ (gitignore): `docs/.private/2026-05-19-hash-migration-prep.md`
- vitest config: [../../vitest.config.ts](../../vitest.config.ts)
- 認証フロー: [api/auth/_discordHandler.ts](../../../api/auth/_discordHandler.ts) / [src/store/useAuthStore.ts](../../../src/store/useAuthStore.ts)
- Firestore Rules: [../../firestore.rules](../../firestore.rules)
- 既存 prefix チェック箇所: [src/components/LoginModal.tsx:240](../../../src/components/LoginModal.tsx#L240) / [src/components/WelcomeSetup.tsx:57](../../../src/components/WelcomeSetup.tsx#L57) / [src/utils/logoUpload.ts:78](../../../src/utils/logoUpload.ts#L78)
- memory: `project_hash_migration_status.md`, `feedback_auth_privacy.md`
