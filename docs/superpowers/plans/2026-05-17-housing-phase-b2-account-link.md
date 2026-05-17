# Housing Phase B-2: Account Link (Discord ↔ X) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discord と X (Twitter) を 1 つの primaryUid に紐づけ、どちらのプロバイダでログインしても同じユーザーデータにアクセスできるようにする。LoPo の「個人情報を Firebase Auth に持たない」原則を遵守し、自前マッピングテーブル `account_links/{provider:id} → primaryUid` 方式で実装する。

**Architecture:**
- Firestore に新規コレクション `account_links/{provider:id}` を作成、 `primaryUid` と `linkedAt` を保存
- セキュリティルールはクライアント直接アクセス全禁止 (read/write false)、 全てサーバー (Vercel API) 経由
- 既存 `api/auth/?provider=discord|twitter` ハンドラに `mode=link` 分岐を追加 (新エンドポイント増やさない)、 通常ログインにも `account_links` lookup を組み込む
- 新規 `api/auth/links` エンドポイント (GET=連携状態取得 / POST=解除 の統合) を 1 つ追加 (Vercel 関数枠 9/12 → 10/12)
- クライアント側は `src/lib/accountLinks.ts` (API client) + `src/components/AccountLinkSection.tsx` (UI) を LoginModal 内に配置

**Tech Stack:** TypeScript / React / Vite / Firebase Admin SDK / Vercel Functions / Firestore / react-i18next

**Reference spec:** [docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md](../specs/2026-05-08-housing-phase-b-account-link-design.md) §6 (全コードあり)

**Reference memory:**
- `feedback_auth_privacy.md` — Firebase 標準 OAuth API 使用禁止、 カスタムトークン方式維持
- `project_housing_phase_status.md` — B-1/B-3 完了、 B-2 のみ残り

**Risks:**
- 既存ログインフローへの回帰 → 各タスクで既存テスト + 既存ログイン動作確認
- Firestore セキュリティルール緩過ぎ → クライアントから一切書けないことを emulator で検証
- account_links 二重書き込みでアカウント乗っ取り → タスク 4-5 で必ず既存ドキュメント存在チェック追加

---

## File Structure

**New files:**
- `src/lib/accountLinks.ts` — クライアント API ラッパー (~80 行)
- `src/lib/__tests__/accountLinks.test.ts` — ユニットテスト
- `api/auth/links.ts` — 連携状態取得 / 解除統合 API (~120 行)
- `src/components/AccountLinkSection.tsx` — LoginModal 内 UI (~220 行)
- `src/components/AccountLinkSection.test.tsx` — コンポーネントテスト

**Modified files:**
- `firestore.rules` — `account_links` match block 追加 (~6 行)
- `api/auth/_discordHandler.ts` — mode=link POST 分岐 + callback 分岐 + 通常 lookup 分岐 (~80 行追加)
- `api/auth/_twitterHandler.ts` — 同上 (~80 行追加)
- `src/components/LoginModal.tsx` — AccountLinkSection 配置 (~30 行追加)
- `src/locales/{ja,en,ko,zh}.json` — i18n キー追加 (~15 キー × 4 言語)

**Existing files referenced (no change):**
- `src/store/useAuthStore.ts` — 認証状態 + apiFetch utility
- `src/lib/appCheckVerify.ts` — App Check 検証
- `src/components/ConfirmDialog.tsx` — 確認ダイアログ (連携前 / 解除前で流用)

---

## Implementation Order

依存関係順:

1. T1: Firestore rules (基盤)
2. T2: クライアント API `accountLinks.ts` (型定義 + ラッパー)
3. T3: サーバー API `api/auth/links.ts` (GET/POST 統合)
4. T4: Discord handler 改修 (mode=link POST + callback + lookup)
5. T5: Twitter handler 改修 (同パターン)
6. T6: i18n キー追加 (4 言語)
7. T7: AccountLinkSection コンポーネント
8. T8: LoginModal に配置
9. T9: 実機検証 + Vercel デプロイ

---

### Task 1: Firestore rules で account_links を全クライアント禁止

**Files:**
- Modify: `firestore.rules` (末尾 `}` の直前に新規 match block 追加)

**Goal:** クライアント SDK から `account_links/` への read/write を一切禁止。Admin SDK (サーバー) のみアクセス可能にする。

- [ ] **Step 1: 既存 rules 末尾を確認**

Read `firestore.rules`、 既存の最後の `match` ブロックの直後に追加できる位置を特定。

- [ ] **Step 2: account_links 用 match block を追加**

```javascript
    // ========================================
    // account_links コレクション
    // クライアントから直接アクセス不可、 Admin SDK (api/auth/*.ts) のみ
    // ========================================
    match /account_links/{key} {
      allow read: if false;
      allow write: if false;
    }
```

- [ ] **Step 3: emulator (or 既存テスト) で確認**

ローカル emulator が設定されていれば次で確認、 なければデプロイ後の手動確認に回す:

```bash
# emulator 起動済みなら
firebase emulators:exec --only firestore "echo 'rules deploy test'"
```

期待: rule syntax error なし。

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "$(cat <<'EOF'
feat(housing-b2): account_links Firestore コレクションを全クライアント禁止

クライアント SDK から read/write 不可、Admin SDK (api/auth/*) 経由のみアクセス可能。
B-2 アカウントリンク機能の前提条件。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: src/lib/accountLinks.ts — クライアント API ラッパー

**Files:**
- Create: `src/lib/accountLinks.ts`

**Goal:** UI 層から呼び出せる型付き API ラッパー。 内部で `/api/auth/links` を fetch、 App Check トークン + Firebase ID Token を付与。

- [ ] **Step 1: 既存 apiFetch パターンを確認**

```bash
# useAuthStore.ts で App Check + ID Token をどう付けてるか
```

Read `src/store/useAuthStore.ts` で fetch 周りのパターン (App Check ヘッダー / Authorization Bearer) を確認。

- [ ] **Step 2: accountLinks.ts を作成**

```typescript
// src/lib/accountLinks.ts
import { getAuth } from 'firebase/auth';
import { getToken } from 'firebase/app-check';
import { appCheck } from './firebase';

export type LinkProvider = 'discord' | 'twitter';

export interface LinkedProviders {
  discord: boolean;
  twitter: boolean;
}

/**
 * 現在ログイン中ユーザーの連携状態を取得。
 * 戻り値: discord/twitter それぞれが連携済みか
 * 例: Discord でログイン中で X 連携済み → { discord: true, twitter: true }
 */
export async function getLinkedProviders(): Promise<LinkedProviders> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not logged in');

  const idToken = await user.getIdToken();
  const appCheckToken = (await getToken(appCheck, false)).token;

  const res = await fetch('/api/auth/links', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`getLinkedProviders failed: ${res.status} ${body}`);
  }
  return res.json();
}

/**
 * 指定プロバイダとの連携を解除する。
 * 現在ログイン中の primaryUid に紐づく `account_links/{provider}:*` 全件を削除。
 */
export async function unlinkAccount(provider: LinkProvider): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not logged in');

  const idToken = await user.getIdToken();
  const appCheckToken = (await getToken(appCheck, false)).token;

  const res = await fetch('/api/auth/links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`unlinkAccount failed: ${res.status} ${body}`);
  }
}

/**
 * mode=link で OAuth を開始する URL を取得 → window.location.href で遷移。
 * 既存の signIn() と同様のパターン。
 */
export async function startLinkFlow(provider: LinkProvider): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not logged in');

  const idToken = await user.getIdToken();
  const appCheckToken = (await getToken(appCheck, false)).token;

  // 連携完了後に戻ってくる URL
  localStorage.setItem('lopo_auth_return_url', window.location.pathname);

  const res = await fetch(`/api/auth?provider=${provider}&mode=link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken,
    },
  });

  if (!res.ok) {
    throw new Error(`startLinkFlow failed: ${res.status}`);
  }
  const { url } = await res.json();
  window.location.href = url;
}
```

- [ ] **Step 3: 既存 apiFetch utility があれば置換**

step 1 で確認した pattern に合わせる。 useAuthStore.ts 内に共通 helper があればそれを import、 なければ上の inline 実装で OK。

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

期待: エラーなし。

- [ ] **Step 5: Commit**

```bash
git add src/lib/accountLinks.ts
git commit -m "$(cat <<'EOF'
feat(housing-b2): accountLinks クライアント API ラッパー追加

getLinkedProviders / unlinkAccount / startLinkFlow の 3 関数を提供。
全て App Check + Firebase ID Token 付きで /api/auth/links と /api/auth?mode=link を呼ぶ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: api/auth/links.ts — 連携状態取得 / 解除 統合 API

**Files:**
- Create: `api/auth/links.ts`

**Goal:** GET = 現在 uid の連携状態、 POST = 指定プロバイダの連携解除。 同一ファイルに統合して Vercel 関数枠を節約。

- [ ] **Step 1: api/auth/links.ts を作成**

```typescript
// api/auth/links.ts
/**
 * 連携状態取得 (GET) + 連携解除 (POST) 統合エンドポイント
 *
 * GET  /api/auth/links              → { discord: boolean, twitter: boolean }
 * POST /api/auth/links  body: { provider: 'discord'|'twitter' }  → { ok: true }
 *
 * 両方とも Firebase ID Token + App Check 必須。
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

function initAdmin() {
  if (!getApps().length) {
    let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
    if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
    pk = pk.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: pk,
      }),
    });
  }
}

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin)
    || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

async function getUidFromIdToken(req: any): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const idToken = auth.slice(7);
  initAdmin();
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(await verifyAppCheck(req, res))) return;

  const uid = await getUidFromIdToken(req);
  if (!uid) return res.status(401).json({ error: 'Invalid or missing ID token' });

  initAdmin();
  const db = getFirestore();

  if (req.method === 'GET') {
    // 現在 uid に紐づく account_links を逆引き
    const snapshot = await db.collection('account_links')
      .where('primaryUid', '==', uid)
      .get();

    const result = { discord: false, twitter: false };
    for (const doc of snapshot.docs) {
      if (doc.id.startsWith('discord:')) result.discord = true;
      if (doc.id.startsWith('twitter:')) result.twitter = true;
    }
    // 現在ログイン中のプロバイダも連携扱い
    if (uid.startsWith('discord:')) result.discord = true;
    if (uid.startsWith('twitter:')) result.twitter = true;

    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    let body: any;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    const { provider } = body || {};
    if (provider !== 'discord' && provider !== 'twitter') {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // 現在 uid のログイン経路と一致するプロバイダは解除拒否 (即ログアウト UX 不整合回避)
    if (uid.startsWith(`${provider}:`)) {
      return res.status(400).json({ error: 'Cannot unlink current login provider' });
    }

    // 該当プロバイダの account_links を削除
    const snapshot = await db.collection('account_links')
      .where('primaryUid', '==', uid)
      .get();

    let deletedCount = 0;
    for (const doc of snapshot.docs) {
      if (doc.id.startsWith(`${provider}:`)) {
        await doc.ref.delete();
        deletedCount++;
      }
    }

    return res.status(200).json({ ok: true, deletedCount });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

- [ ] **Step 2: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Vercel 関数枠を確認**

`api/` ディレクトリを ls して関数数を確認、 10/12 に収まることを確認:

```bash
find api -name "*.ts" -not -name "_*" | wc -l
```

期待: 10 (新規 1 個追加分含む)。

- [ ] **Step 4: Commit**

```bash
git add api/auth/links.ts
git commit -m "$(cat <<'EOF'
feat(housing-b2): /api/auth/links 連携状態取得+解除エンドポイント追加

GET  → { discord, twitter } の bool ペア
POST → 指定プロバイダの account_links を削除 (現在ログイン経路は解除拒否)
両方 App Check + Firebase ID Token 必須、Admin SDK 経由で account_links を操作。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: api/auth/_discordHandler.ts — mode=link 分岐 + lookup 分岐

**Files:**
- Modify: `api/auth/_discordHandler.ts`

**Goal:** 既存 Discord ログインに次の 3 動作を追加:
1. POST `?mode=link` → ID Token 検証して primaryUid を cookie に保持 + 通常通り Discord 認可URL返却
2. GET callback で cookie が `link:` で始まれば → `account_links` に書き込み → 完了画面
3. 通常 GET callback で `account_links/discord:<discordUserId>` を lookup → 該当あれば finalUid = primaryUid でカスタムトークン発行

- [ ] **Step 1: POST 部に mode=link 分岐追加**

[api/auth/_discordHandler.ts:64](api/auth/_discordHandler.ts#L64) の `if (req.method === 'POST')` ブロック先頭で:

```typescript
if (req.method === 'POST') {
  if (!(await verifyAppCheck(req, res))) return;

  const isLinkMode = req.query?.mode === 'link';
  let primaryUid: string | null = null;

  if (isLinkMode) {
    // Authorization: Bearer <Firebase ID Token> から uid を確定
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Firebase ID token for link mode' });
    }
    initAdmin();
    try {
      const decoded = await getAuth().verifyIdToken(authHeader.slice(7));
      primaryUid = decoded.uid;
    } catch {
      return res.status(401).json({ error: 'Invalid Firebase ID token' });
    }
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Server configuration error' });
  }
  const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth?provider=discord`;
  const stateParam = crypto.randomBytes(16).toString('hex');

  // link mode の場合は cookie 値に primaryUid を埋め込む (callback で取り出す)
  const cookieValue = isLinkMode ? `link:${primaryUid}:${stateParam}` : stateParam;

  res.setHeader('Set-Cookie',
    `discord_oauth_state=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state: stateParam, // Discord には stateParam のみ渡す
  });
  return res.status(200).json({ url: `https://discord.com/oauth2/authorize?${params}` });
}
```

- [ ] **Step 2: GET callback の state 検証で link cookie 対応**

[api/auth/_discordHandler.ts:96](api/auth/_discordHandler.ts#L96) `const savedState = cookies['discord_oauth_state']` 以降を:

```typescript
const cookies = parseCookies(req.headers.cookie || '');
const savedState = cookies['discord_oauth_state'];

// link mode 判定 (cookie 値が link:<primaryUid>:<stateParam> 形式)
let linkPrimaryUid: string | null = null;
let expectedState: string;
if (savedState?.startsWith('link:')) {
  const parts = savedState.split(':');
  // parts = ['link', '<provider>:<id>' or single, '<stateParam>']
  // primaryUid 自体に ':' を含む (例: discord:D1) ため最後の要素を stateParam として扱う
  expectedState = parts[parts.length - 1];
  linkPrimaryUid = parts.slice(1, -1).join(':');
} else {
  expectedState = savedState || '';
}

if (!savedState || state !== expectedState) {
  return res.status(400).json({ error: 'State mismatch. Please try again.' });
}
```

- [ ] **Step 3: Discord トークン交換と user info 取得は既存ロジック流用**

既存 [api/auth/_discordHandler.ts:104-145](api/auth/_discordHandler.ts#L104-L145) のクッキークリア〜 `const { id: discordUserId } = ...` までは変更不要。

- [ ] **Step 4: link callback 処理を分岐 (lookup より前)**

`const firebaseUid = ...` を作る直前に link 分岐を追加:

```typescript
const { id: discordUserId } = await userRes.json();
const candidateUid = `discord:${discordUserId}`;

// === link mode の callback ===
if (linkPrimaryUid) {
  // 自分自身に紐づけようとした (同一 provider) → 拒否
  if (candidateUid === linkPrimaryUid) {
    return sendErrorPage(res, 'cannot_link_self');
  }

  // 既に他人に紐づけられているかチェック (乗っ取り防止)
  initAdmin();
  const linkRef = getFirestore().doc(`account_links/${candidateUid}`);
  const existing = await linkRef.get();
  if (existing.exists && existing.data()!.primaryUid !== linkPrimaryUid) {
    return sendErrorPage(res, 'already_linked_to_another');
  }

  // primaryUid に紐付け書き込み
  await linkRef.set({
    primaryUid: linkPrimaryUid,
    linkedAt: FieldValue.serverTimestamp(),
  });

  // 完了画面 → return_url にリダイレクト
  res.setHeader('Content-Type', 'text/html');
  return res.send(`
    <!DOCTYPE html>
    <html><head><title>LoPo - 連携完了</title></head>
    <body>
      <script>
        localStorage.setItem('lopo_link_completed', JSON.stringify({ provider: 'discord' }));
        var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
        localStorage.removeItem('lopo_auth_return_url');
        try {
          var u = new URL(returnUrl, window.location.origin);
          if (u.origin !== window.location.origin) returnUrl = '/';
        } catch(e) { returnUrl = '/'; }
        window.location.href = returnUrl;
      </script>
      <p>連携完了... リダイレクトしています</p>
    </body></html>
  `);
}
```

`sendErrorPage` ヘルパーをファイル末尾に追加:

```typescript
function sendErrorPage(res: any, errorCode: string): any {
  res.setHeader('Content-Type', 'text/html');
  return res.send(`
    <!DOCTYPE html>
    <html><head><title>LoPo - 連携エラー</title></head>
    <body>
      <script>
        localStorage.setItem('lopo_link_error', ${JSON.stringify(errorCode)});
        var returnUrl = localStorage.getItem('lopo_auth_return_url') || '/';
        localStorage.removeItem('lopo_auth_return_url');
        try {
          var u = new URL(returnUrl, window.location.origin);
          if (u.origin !== window.location.origin) returnUrl = '/';
        } catch(e) { returnUrl = '/'; }
        window.location.href = returnUrl;
      </script>
      <p>連携エラー... リダイレクトしています</p>
    </body></html>
  `);
}
```

- [ ] **Step 5: 通常ログインの lookup 分岐追加**

link mode で return しなかった = 通常ログイン継続。 `firebaseUid` 作成前に lookup:

```typescript
// === 通常ログインの lookup ===
initAdmin();
const linkDoc = await getFirestore().doc(`account_links/${candidateUid}`).get();
const finalUid = linkDoc.exists ? linkDoc.data()!.primaryUid : candidateUid;

const customToken = await getAuth().createCustomToken(finalUid, {
  provider: 'discord',
});
```

既存の `firebaseUid` 変数を `finalUid` で置換、 `createCustomToken(firebaseUid, ...)` → `createCustomToken(finalUid, ...)`。

- [ ] **Step 6: import 追加**

ファイル先頭 import:

```typescript
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
```

- [ ] **Step 7: TypeScript チェック + 既存テスト**

```bash
npx tsc --noEmit
npx vitest run --reporter=verbose 2>&1 | tail -30
```

期待: エラーなし、 既存テスト全 pass。

- [ ] **Step 8: 既存ログインへの回帰がないことを目視確認**

ローカル `npm run dev` で起動 → Discord ログイン → 既存通り通常ログインできるか確認 (link mode は通らないので影響ゼロのはず)。

- [ ] **Step 9: Commit**

```bash
git add api/auth/_discordHandler.ts
git commit -m "$(cat <<'EOF'
feat(housing-b2): Discord ハンドラに mode=link + account_links lookup 分岐追加

- POST ?mode=link: Firebase ID Token から primaryUid を確定し cookie に保持
- GET callback (link mode): account_links/discord:* に書き込み → 完了画面
- GET callback (通常): account_links lookup → 該当あれば finalUid でカスタムトークン発行
- 自己リンク・既存他人リンクは拒否 (乗っ取り防止)

既存通常ログインの動作は不変。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: api/auth/_twitterHandler.ts — 同じパターンを Twitter にも適用

**Files:**
- Modify: `api/auth/_twitterHandler.ts`

**Goal:** Task 4 と全く同じパターンを Twitter ハンドラにも追加。 Twitter は OAuth 2.0 + PKCE なので cookie に `code_verifier` も保存される (既存)。 link mode 用の cookie 値だけ拡張。

- [ ] **Step 1: 既存 Twitter ハンドラ構造確認**

Read `api/auth/_twitterHandler.ts` で state cookie の名前と PKCE 部分の構造を確認。

- [ ] **Step 2: POST 部に mode=link 分岐追加**

Task 4 step 1 と同じパターン。 cookie 名は `twitter_oauth_state` (Discord ハンドラとは別)。`stateParam` の代わりに既存 PKCE 用 cookie と並列で `twitter_oauth_link` cookie を追加するか、 もしくは既存 state cookie 値に prefix を埋め込むパターンで実装。

設計書 [§6.1.1](docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md) のパターンに合わせて cookie 値に `link:<primaryUid>:<stateParam>` 形式を採用 (Twitter 側も):

```typescript
const cookieValue = isLinkMode ? `link:${primaryUid}:${stateParam}` : stateParam;
res.setHeader('Set-Cookie',
  `twitter_oauth_state=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`
);
```

PKCE 用 `code_verifier` の別 cookie は既存通り維持。

- [ ] **Step 3: GET callback で link prefix 検出 + link 処理**

Task 4 step 2-4 と同じパターン。 Twitter user id 取得後、 `candidateUid = twitter:${twitterUserId}` で account_links 書き込み。

- [ ] **Step 4: 通常ログイン lookup 追加**

Task 4 step 5 同様、 `createCustomToken` の前に lookup。

- [ ] **Step 5: import + sendErrorPage helper 追加**

Discord 同様。 helper は別ファイル (`api/auth/_linkHelpers.ts`) に切り出すか、 両ハンドラに DRY コピーかの判断。 **plan として: 別ファイル化** が望ましいが、 関数枠カウントには影響しない (アンダースコア prefix は Vercel に function として認識されない)。

- [ ] **Step 6: TypeScript + 既存テスト**

```bash
npx tsc --noEmit
npx vitest run 2>&1 | tail -30
```

- [ ] **Step 7: 既存 Twitter ログインの回帰チェック**

ローカル dev で Twitter ログインが通常通り動くか確認。

- [ ] **Step 8: Commit**

```bash
git add api/auth/_twitterHandler.ts api/auth/_linkHelpers.ts
git commit -m "$(cat <<'EOF'
feat(housing-b2): Twitter ハンドラに mode=link + account_links lookup 分岐追加

Discord 側と同じパターン:
- POST ?mode=link: Firebase ID Token 検証 + primaryUid を state cookie に埋め込み
- GET callback (link mode): account_links/twitter:* 書き込み
- GET callback (通常): account_links lookup → finalUid でカスタムトークン発行
- 共通ヘルパー sendLinkCompletePage / sendLinkErrorPage を api/auth/_linkHelpers.ts に切り出し

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: i18n キー追加 (4 言語)

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

**Goal:** AccountLinkSection で使う翻訳キーを 4 言語追加。 設計書 §6.6 の 15 キーを基にする。

- [ ] **Step 1: ja.json に account_link セクション追加**

既存ファイル末尾近くに追加。 既存の置き場所 (例: `housing` セクションの近く or `common` 等) を確認してから insert:

```json
"account_link": {
  "linked_section": "連携済み",
  "unlinked_section": "他のSNSと連携",
  "current_login_badge": "ログイン中",
  "benefit_text": "どちらで入っても同じデータが見られます",
  "link_button": "連携する",
  "unlink_button": "解除",
  "confirm_link_title": "{{provider}} と連携しますか?",
  "confirm_link_body": "{{provider}} でアカウントを連携すると、次回から {{provider}} でログインしても同じデータが見られるようになります。",
  "confirm_link_warning": "過去に {{provider}} 単独でログインして別のデータを作っていた場合、それは見えなくなります。",
  "confirm_link_cta": "連携する",
  "confirm_link_cancel": "キャンセル",
  "confirm_unlink_title": "{{provider}} との連携を解除しますか?",
  "confirm_unlink_body": "解除すると、{{provider}} で次にログインした時は別のアカウント扱いになります。",
  "toast_link_success": "{{provider}} と連携しました",
  "toast_unlink_success": "{{provider}} との連携を解除しました",
  "toast_link_error": "連携に失敗しました",
  "toast_unlink_error": "解除に失敗しました"
}
```

- [ ] **Step 2: en.json に同キーを英訳して追加**

```json
"account_link": {
  "linked_section": "Linked",
  "unlinked_section": "Link another account",
  "current_login_badge": "Signed in",
  "benefit_text": "Sign in with either, see the same data",
  "link_button": "Link",
  "unlink_button": "Unlink",
  "confirm_link_title": "Link {{provider}}?",
  "confirm_link_body": "Once linked, signing in with {{provider}} will show the same data as your current account.",
  "confirm_link_warning": "Any data previously stored under a separate {{provider}} account will become inaccessible.",
  "confirm_link_cta": "Link account",
  "confirm_link_cancel": "Cancel",
  "confirm_unlink_title": "Unlink {{provider}}?",
  "confirm_unlink_body": "After unlinking, signing in with {{provider}} again will create a fresh, separate account.",
  "toast_link_success": "Linked {{provider}}",
  "toast_unlink_success": "Unlinked {{provider}}",
  "toast_link_error": "Failed to link account",
  "toast_unlink_error": "Failed to unlink account"
}
```

- [ ] **Step 3: ko.json に韓国語訳を追加**

```json
"account_link": {
  "linked_section": "연결됨",
  "unlinked_section": "다른 SNS와 연결",
  "current_login_badge": "로그인 중",
  "benefit_text": "어느 쪽으로 들어와도 같은 데이터를 볼 수 있습니다",
  "link_button": "연결하기",
  "unlink_button": "해제",
  "confirm_link_title": "{{provider}}와 연결하시겠습니까?",
  "confirm_link_body": "{{provider}}를 연결하면, 다음번부터 {{provider}}로 로그인해도 같은 데이터를 볼 수 있게 됩니다.",
  "confirm_link_warning": "과거에 {{provider}} 단독으로 로그인하여 다른 데이터를 만들었던 경우, 그 데이터는 볼 수 없게 됩니다.",
  "confirm_link_cta": "연결하기",
  "confirm_link_cancel": "취소",
  "confirm_unlink_title": "{{provider}}와의 연결을 해제하시겠습니까?",
  "confirm_unlink_body": "해제하면, 다음번 {{provider}}로 로그인할 때 별도의 계정으로 처리됩니다.",
  "toast_link_success": "{{provider}}와 연결되었습니다",
  "toast_unlink_success": "{{provider}}와의 연결이 해제되었습니다",
  "toast_link_error": "연결에 실패했습니다",
  "toast_unlink_error": "해제에 실패했습니다"
}
```

- [ ] **Step 4: zh.json に簡体字訳を追加**

```json
"account_link": {
  "linked_section": "已关联",
  "unlinked_section": "关联其他 SNS",
  "current_login_badge": "登录中",
  "benefit_text": "无论使用哪个登录，都能看到相同的数据",
  "link_button": "关联",
  "unlink_button": "解除",
  "confirm_link_title": "要关联 {{provider}} 吗？",
  "confirm_link_body": "关联后，下次使用 {{provider}} 登录也能看到相同的数据。",
  "confirm_link_warning": "如果过去单独使用 {{provider}} 登录创建过其他数据，将无法再访问。",
  "confirm_link_cta": "关联",
  "confirm_link_cancel": "取消",
  "confirm_unlink_title": "要解除与 {{provider}} 的关联吗？",
  "confirm_unlink_body": "解除后，下次使用 {{provider}} 登录将作为单独的账号处理。",
  "toast_link_success": "已关联 {{provider}}",
  "toast_unlink_success": "已解除与 {{provider}} 的关联",
  "toast_link_error": "关联失败",
  "toast_unlink_error": "解除失败"
}
```

- [ ] **Step 5: JSON 構文チェック**

```bash
for f in src/locales/{ja,en,ko,zh}.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"; done
```

期待: 4 ファイル全 OK。

- [ ] **Step 6: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "$(cat <<'EOF'
i18n(housing-b2): account_link キー 4 言語追加 (15 キー × 4 = 60 翻訳)

連携セクション、連携ボタン、解除確認、トーストのテキスト。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: AccountLinkSection コンポーネント新規

**Files:**
- Create: `src/components/AccountLinkSection.tsx`

**Goal:** LoginModal 内に配置する連携セクション UI。 連携済み / 未連携を出し分け、 連携ボタン → 警告ダイアログ → OAuth 開始、 解除ボタン → 解除確認 → 削除 + トースト。

- [ ] **Step 1: コンポーネント雛形作成**

```typescript
// src/components/AccountLinkSection.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLinkedProviders, unlinkAccount, startLinkFlow, type LinkProvider, type LinkedProviders } from '../lib/accountLinks';
import { useAuthStore } from '../store/useAuthStore';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '../hooks/useToast';

const PROVIDER_LABEL: Record<LinkProvider, string> = {
  discord: 'Discord',
  twitter: 'X (Twitter)',
};

export function AccountLinkSection() {
  const { t } = useTranslation();
  const { profileProvider } = useAuthStore();
  const toast = useToast();
  const [links, setLinks] = useState<LinkedProviders | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkConfirm, setLinkConfirm] = useState<LinkProvider | null>(null);
  const [unlinkConfirm, setUnlinkConfirm] = useState<LinkProvider | null>(null);

  // 初回マウント時に連携状態取得
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getLinkedProviders();
        if (!cancelled) setLinks(result);
      } catch (e) {
        console.error('getLinkedProviders failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 連携完了 / エラーは localStorage 経由で通知 (callback page で書かれる)
  useEffect(() => {
    const completed = localStorage.getItem('lopo_link_completed');
    if (completed) {
      try {
        const { provider } = JSON.parse(completed);
        toast(t('account_link.toast_link_success', { provider: PROVIDER_LABEL[provider as LinkProvider] }));
      } catch {}
      localStorage.removeItem('lopo_link_completed');
    }
    const errorCode = localStorage.getItem('lopo_link_error');
    if (errorCode) {
      toast(t('account_link.toast_link_error'), { tone: 'error' });
      localStorage.removeItem('lopo_link_error');
    }
  }, [toast, t]);

  const handleLink = async (provider: LinkProvider) => {
    setLinkConfirm(null);
    try {
      await startLinkFlow(provider);
      // 遷移するのでこの後の return には来ない
    } catch (e) {
      console.error('startLinkFlow failed', e);
      toast(t('account_link.toast_link_error'), { tone: 'error' });
    }
  };

  const handleUnlink = async (provider: LinkProvider) => {
    setUnlinkConfirm(null);
    try {
      await unlinkAccount(provider);
      // 再取得
      const result = await getLinkedProviders();
      setLinks(result);
      toast(t('account_link.toast_unlink_success', { provider: PROVIDER_LABEL[provider] }));
    } catch (e) {
      console.error('unlinkAccount failed', e);
      toast(t('account_link.toast_unlink_error'), { tone: 'error' });
    }
  };

  if (loading || !links) return null;

  const isCurrent = (p: LinkProvider) => profileProvider === p;
  const linkedProviders = (['discord', 'twitter'] as const).filter(p => links[p]);
  const unlinkedProviders = (['discord', 'twitter'] as const).filter(p => !links[p]);

  return (
    <div className="space-y-4">
      {/* 連携済みセクション */}
      {linkedProviders.length > 0 && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-app-text-muted mb-2">
            {t('account_link.linked_section')}
          </h3>
          <ul className="space-y-2">
            {linkedProviders.map(p => (
              <li key={p} className="flex items-center justify-between px-3 py-2 rounded border border-app-border">
                <span className="text-sm">
                  ✓ {PROVIDER_LABEL[p]}
                  {isCurrent(p) && (
                    <span className="ml-2 text-xs text-app-text-muted">
                      ({t('account_link.current_login_badge')})
                    </span>
                  )}
                </span>
                {!isCurrent(p) && (
                  <button
                    onClick={() => setUnlinkConfirm(p)}
                    className="text-xs text-app-red hover:bg-app-red-dim px-2 py-1 rounded transition-colors"
                  >
                    {t('account_link.unlink_button')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 未連携セクション */}
      {unlinkedProviders.length > 0 && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-app-text-muted mb-2">
            {t('account_link.unlinked_section')}
          </h3>
          <p className="text-xs text-app-text-muted/70 mb-2">
            {t('account_link.benefit_text')}
          </p>
          <ul className="space-y-2">
            {unlinkedProviders.map(p => (
              <li key={p} className="flex items-center justify-between px-3 py-2 rounded border border-app-border">
                <span className="text-sm">{PROVIDER_LABEL[p]}</span>
                <button
                  onClick={() => setLinkConfirm(p)}
                  className="text-xs px-3 py-1 rounded border border-app-border hover:bg-app-surface2 transition-colors"
                >
                  {t('account_link.link_button')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 連携確認ダイアログ */}
      {linkConfirm && (
        <ConfirmDialog
          title={t('account_link.confirm_link_title', { provider: PROVIDER_LABEL[linkConfirm] })}
          body={
            <>
              <p>{t('account_link.confirm_link_body', { provider: PROVIDER_LABEL[linkConfirm] })}</p>
              <p className="text-app-yellow text-xs mt-2">⚠ {t('account_link.confirm_link_warning', { provider: PROVIDER_LABEL[linkConfirm] })}</p>
            </>
          }
          confirmLabel={t('account_link.confirm_link_cta')}
          cancelLabel={t('account_link.confirm_link_cancel')}
          onConfirm={() => handleLink(linkConfirm)}
          onCancel={() => setLinkConfirm(null)}
        />
      )}

      {/* 解除確認ダイアログ */}
      {unlinkConfirm && (
        <ConfirmDialog
          title={t('account_link.confirm_unlink_title', { provider: PROVIDER_LABEL[unlinkConfirm] })}
          body={<p>{t('account_link.confirm_unlink_body', { provider: PROVIDER_LABEL[unlinkConfirm] })}</p>}
          confirmLabel={t('account_link.unlink_button')}
          cancelLabel={t('account_link.confirm_link_cancel')}
          onConfirm={() => handleUnlink(unlinkConfirm)}
          onCancel={() => setUnlinkConfirm(null)}
          dangerous
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: ConfirmDialog の props を実際の既存実装に合わせる**

ConfirmDialog の正確な props は `src/components/ConfirmDialog.tsx` を Read して確認。 props 名 (title/body/onConfirm/onCancel/confirmLabel/cancelLabel/dangerous など) を実際の interface に合わせて修正。

- [ ] **Step 3: useToast の正確な API を確認**

`src/hooks/useToast.ts` を Read。 もし `tone: 'error'` プロパティが無ければエラー用の別関数 (`toastError` 等) を使う。

- [ ] **Step 4: TypeScript チェック**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/AccountLinkSection.tsx
git commit -m "$(cat <<'EOF'
feat(housing-b2): AccountLinkSection コンポーネント追加

LoginModal 内の連携セクション UI。
- 連携済み / 未連携を分けて表示
- 現在ログイン中のプロバイダは「ログイン中」バッジ付きで解除ボタン非表示
- 連携クリック → 警告 → OAuth フロー開始 (window.location 遷移)
- 解除クリック → 確認 → 削除 API → 状態再取得 + トースト
- callback page から localStorage 経由で完了/エラー通知を拾う

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: LoginModal に AccountLinkSection 配置

**Files:**
- Modify: `src/components/LoginModal.tsx`

**Goal:** LoginModal のログイン済み画面に AccountLinkSection を配置。 既存のアバター/表示名セクション (B-3) の下、 ローカル取り込みボタン (B-1) の上に挿入する。

- [ ] **Step 1: LoginModal の現状構造を確認**

Read `src/components/LoginModal.tsx`、 ログイン済み画面の JSX 構造を把握 (どこにアバターセクション、 どこにログアウトボタンがあるか)。

- [ ] **Step 2: AccountLinkSection を import + 配置**

```typescript
import { AccountLinkSection } from './AccountLinkSection';

// ログイン済み画面の JSX 内、アバター/表示名セクションの下に挿入:
<AccountLinkSection />
```

配置先の判断:
- 上: アバター + 表示名編集 (B-3)
- ここ: 連携セクション (B-2、今回)
- 下: ローカルプラン取り込み明示ボタン (B-1、 既存)
- 最下: ログアウト / アカウント削除

- [ ] **Step 3: TypeScript チェック + 既存 LoginModal テスト**

```bash
npx tsc --noEmit
npx vitest run src/components/LoginModal 2>&1 | tail -10
```

期待: 既存テスト全 pass。

- [ ] **Step 4: ローカル dev で目視確認**

```bash
npm run dev
```

ブラウザで /miti などを開いて LoginModal を開き、 ログイン済み状態で連携セクションが表示されるか確認 (ログインしていない場合は表示されないこと)。

- [ ] **Step 5: Commit**

```bash
git add src/components/LoginModal.tsx
git commit -m "$(cat <<'EOF'
feat(housing-b2): LoginModal に AccountLinkSection を配置

ログイン済み画面のアバター/表示名セクション下、ローカル取り込みボタン上に挿入。
未ログインユーザーには表示されない。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 実機検証 + Vercel デプロイ

**Files:** (なし、 ビルド + デプロイ操作のみ)

**Goal:** ローカル + Vercel preview / production で動作検証。 既存ログインへの回帰がないこと、 連携・解除・lookup の 3 経路全動作確認。

- [ ] **Step 1: ローカルでビルド確認**

```bash
npm run build
```

期待: build 成功、 type error なし。

- [ ] **Step 2: ローカルで vitest run**

```bash
npx vitest run 2>&1 | tail -20
```

期待: 全 pass。

- [ ] **Step 3: Firestore rules デプロイ**

```bash
firebase deploy --only firestore:rules
```

期待: 成功。

- [ ] **Step 4: Vercel デプロイ (main push)**

```bash
git push origin main
```

→ Vercel が自動デプロイ。

- [ ] **Step 5: 本番実機検証チェックリスト**

設計書 §9.4 の B-2 関連を実機で:

- [ ] Discord でログイン中、 LoginModal を開く → 連携セクションに「✓ Discord (ログイン中)」+「X 連携」 ボタンが見える
- [ ] X 連携ボタン押下 → 警告ダイアログ表示 → 「連携する」 押下 → X OAuth 画面遷移 → 承認 → アプリに戻る → 連携完了トースト表示
- [ ] LoginModal を開き直し → 「✓ X」 が連携済みセクションに表示、 解除ボタンあり
- [ ] ログアウト → X でログイン → Discord 側のデータが見える (account_links lookup が機能)
- [ ] LoginModal で X (今ログイン経路) は解除ボタン非表示、 Discord (元の) は解除ボタンあり
- [ ] Discord 解除 → トースト → 再度 Discord でログイン → 別アカウント扱い (空データ)
- [ ] 既存ログインフロー (連携なし) が回帰してないか: 新規 Twitter ログインで通常通り `twitter:T` uid でログインできる
- [ ] 同時 2 言語 (ja/en) で UI 文字列が全て表示

- [ ] **Step 6: 不具合があれば修正 → 別 commit**

実機で問題発生時は別タスクとして対応。 ここで OK ならフェーズ完了。

- [ ] **Step 7: TODO.md 更新 + memory 更新**

```bash
# TODO.md の「次セッション最優先」 を更新
# project_housing_phase_status.md memory を更新 (B-2 完了)
```

- [ ] **Step 8: 完了報告 commit**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(housing-b2): Phase B-2 アカウントリンク 完了

Discord ↔ X 自前マッピング方式で連携機能を実装。
- account_links Firestore コレクション + クライアント禁止ルール
- mode=link OAuth 分岐 (Discord/Twitter 両ハンドラ)
- /api/auth/links GET/POST 統合エンドポイント
- AccountLinkSection を LoginModal 内に配置
- i18n 4 言語完備

これで Phase B 全 (B-1/B-2/B-3) 完了。次は Sub-spec 2B (Gallery & Search)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- §3.2 新規ファイル (5 個) — T2, T3, T4, T5, T7 でカバー ✅
- §4.1 AccountLink データモデル — T1 (ルール) + T4/T5 (書き込み箇所) ✅
- §6.1 mode=link OAuth フロー — T4 (Discord), T5 (Twitter) ✅
- §6.2 解除フロー — T3 ✅
- §6.3 状態取得 — T3 ✅
- §6.4 セキュリティルール — T1 ✅
- §6.5 UI — T7 ✅
- §6.6 i18n — T6 ✅
- §6.7 動作シナリオ — T9 で検証 ✅
- §10.1 関数枠 — T3 で確認 ✅

**Placeholder scan:**
- Task 2 step 1 「既存 apiFetch パターンを確認」 → 確認 step として OK (engineer が読んで動ける)
- Task 5 step 5 「helper を別ファイルに切り出す」 → ファイル名明示済 ✅
- Task 7 step 2-3 「ConfirmDialog/useToast の実際の props 確認」 → 既存資産確認 step として OK

**Type consistency:**
- `LinkProvider = 'discord' | 'twitter'` (Task 2) → Task 7 で使用 ✅
- `LinkedProviders` (Task 2) → Task 7 で使用 ✅
- `getLinkedProviders` / `unlinkAccount` / `startLinkFlow` 名称統一 ✅

Plan complete.
