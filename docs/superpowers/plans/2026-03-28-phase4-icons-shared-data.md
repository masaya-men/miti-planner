# Phase 4: アイコン・共有データ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アイコンをFirebase Storageで管理可能にし、ハウジングツアーとの共有データ基盤を構築する

**Architecture:** Firebase Storage にアイコンを移行し、Vercel rewrite でプロキシ（関数枠を消費しない）。`/master/servers` にDC/サーバーデータを格納し、既存の管理APIに統合。

**Tech Stack:** Firebase Storage, Vercel rewrites, React, Zustand, firebase-admin

---

## 前提条件・制約

- Vercel Hobby プランの **12関数上限**に到達済み → 新規APIエンドポイント追加不可
- 全ての新機能は既存 `api/admin/templates/index.ts` に `?type=xxx` で統合
- `masterData.ts` は現在どこからもインポートされていない（ハウジングツアー専用）
- アイコンは `public/icons/` に127枚（2.1MB）存在
- 管理画面は白黒ベース、UIテキストはi18n必須

## ファイル構成

### 新規作成
| ファイル | 内容 |
|---------|------|
| `scripts/seed-icons.ts` | 既存127アイコンをFirebase Storageにアップロード |
| `scripts/seed-servers.ts` | masterData.ts → Firestore `/master/servers` シード |
| `src/components/admin/AdminServers.tsx` | DC/サーバー/ハウジング管理画面 |
| `src/hooks/useServerData.ts` | サーバーデータアクセスフック |

### 修正
| ファイル | 変更内容 |
|---------|---------|
| `src/lib/firebase.ts` | `getStorage` 初期化を追加 |
| `vercel.json` | `/icons/*` → Firebase Storage rewrite + Cache-Control追加 |
| `src/components/admin/AdminSkills.tsx` | アイコンアップロード機能を追加 |
| `src/components/admin/AdminLayout.tsx` | サーバー管理ナビ追加 |
| `src/App.tsx` | `/admin/servers` ルート追加 |
| `api/admin/templates/index.ts` | `?type=servers` CRUD追加 |
| `src/store/useMasterDataStore.ts` | `servers` フィールド追加 |
| `src/hooks/useMasterData.ts` | servers フェッチ追加 |
| `src/locales/ja.json` / `en.json` | admin.servers, admin.icons 関連キー追加 |

### 削除
| ファイル | 理由 |
|---------|------|
| `public/icons/*.png` | Firebase Storage移行後、Vercel rewriteで配信するため不要（バンドル2.1MB削減） |

---

## Part A: アイコン管理（優先）

### Task 1: Firebase Storage初期化

**Files:**
- Modify: `src/lib/firebase.ts`

- [ ] **Step 1: firebase.ts に Storage エクスポートを追加**

```typescript
// firebase.ts の先頭 import に追加
import { getStorage } from 'firebase/storage';

// ファイル末尾（appCheck の下）に追加
export const storage = getStorage(app);
```

- [ ] **Step 2: Firebase Console で Storage セキュリティルールを設定**

Firebase Console → Storage → Rules に以下を設定:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /icons/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
  }
}
```

- [ ] **Step 3: Firebase Console で CORS 設定**

`cors.json` を作成して適用（gsutil コマンド or Firebase Console）:

```json
[
  {
    "origin": ["https://lopoly.app", "http://localhost:5173"],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 86400,
    "responseHeader": ["Content-Type"]
  }
]
```

```bash
gsutil cors set cors.json gs://lopo-7793e.firebasestorage.app
```

gsutil が入っていない場合は Firebase Console の Cloud Storage → CORS設定 からも可能。

- [ ] **Step 4: ビルド確認**

```bash
npx vite build
```

期待: エラーなし。Storage の import が正しく解決される。

- [ ] **Step 5: コミット**

```bash
git add src/lib/firebase.ts
git commit -m "feat: Firebase Storage初期化を追加"
```

---

### Task 2: 既存アイコンのFirebase Storageアップロード

**Files:**
- Create: `scripts/seed-icons.ts`

- [ ] **Step 1: シードスクリプト作成**

```typescript
/**
 * seed-icons.ts
 * public/icons/ の全PNGを Firebase Storage /icons/ にアップロード
 *
 * 使い方: npx tsx scripts/seed-icons.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// .env.local 読み込み（seed-skills-stats.ts と同じヘルパー）
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

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

const storageBucket = env.FIREBASE_STORAGE_BUCKET || 'lopo-7793e.firebasestorage.app';

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  storageBucket,
});

const bucket = getStorage().bucket();
const iconsDir = resolve(ROOT, 'public/icons');
const files = readdirSync(iconsDir).filter((f) => f.endsWith('.png'));

console.log(`📦 ${files.length} 個のアイコンをアップロードします...`);

let uploaded = 0;
let skipped = 0;

for (const file of files) {
  const destination = `icons/${file}`;
  const filePath = resolve(iconsDir, file);

  try {
    // 既に存在するかチェック
    const [exists] = await bucket.file(destination).exists();
    if (exists) {
      skipped++;
      continue;
    }

    await bucket.upload(filePath, {
      destination,
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
    uploaded++;

    if (uploaded % 20 === 0) {
      console.log(`  ... ${uploaded}/${files.length} アップロード完了`);
    }
  } catch (err) {
    console.error(`❌ ${file} のアップロードに失敗:`, err);
  }
}

console.log(`\n✅ 完了: ${uploaded} アップロード / ${skipped} スキップ（既存）`);
```

- [ ] **Step 2: スクリプト実行**

```bash
npx tsx scripts/seed-icons.ts
```

期待: `✅ 完了: 127 アップロード / 0 スキップ` のような出力。

- [ ] **Step 3: Firebase Console で確認**

Firebase Console → Storage → icons/ フォルダに127枚のPNGが存在することを確認。

- [ ] **Step 4: コミット**

```bash
git add scripts/seed-icons.ts
git commit -m "feat: アイコンFirebase Storageアップロードスクリプト追加"
```

---

### Task 3: Vercel rewrite + キャッシュ設定 + public/icons 削除

**Files:**
- Modify: `vercel.json`
- Delete: `public/icons/*.png`（127ファイル）

- [ ] **Step 1: vercel.json にアイコン用 rewrite とキャッシュヘッダーを追加**

`vercel.json` を以下に更新:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/share/:id", "destination": "/api/share-page?id=:id" },
    {
      "source": "/icons/:path",
      "destination": "https://firebasestorage.googleapis.com/v0/b/lopo-7793e.firebasestorage.app/o/icons%2F:path?alt=media"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/icons/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
      ]
    }
  ]
}
```

**重要:** `/icons/:path` の rewrite は `/(.*) → /index.html` よりも前に配置すること。Vercel は rewrites を上から順に評価する。

- [ ] **Step 2: public/icons/ の全PNGを削除**

```bash
rm -rf public/icons/*.png
```

`public/icons/` ディレクトリ自体は残してもOK（.gitkeep 等）。Vercel は静的ファイルが存在しなくなるので rewrite が適用される。

- [ ] **Step 3: ローカルでビルド確認**

```bash
npx vite build
```

期待: ビルド成功。バンドルサイズが約2MB削減されていることを確認。

- [ ] **Step 4: デプロイして動作確認**

```bash
git add vercel.json public/icons/
git commit -m "feat: アイコンをFirebase Storage経由で配信（Vercel rewrite）"
git push origin main
```

デプロイ後、`https://lopoly.app/icons/Paladin.png` にアクセスしてアイコンが表示されることを確認。
レスポンスヘッダーに `Cache-Control: public, max-age=31536000, immutable` が含まれていることを確認。

**⚠️ ロールバック手順:** アイコンが表示されない場合、`git revert HEAD` で public/icons/ を復元してデプロイし直す。

---

### Task 4: AdminSkills にアイコンアップロード機能を統合

**Files:**
- Modify: `src/components/admin/AdminSkills.tsx`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: i18n キーを追加**

`src/locales/ja.json` の `admin` セクションに追加:

```json
"admin": {
  ...既存キー,
  "icon_upload": "アイコンを変更",
  "icon_uploading": "アップロード中...",
  "icon_upload_success": "アイコンを更新しました",
  "icon_upload_error": "アイコンのアップロードに失敗しました",
  "icon_current": "現在のアイコン",
  "icon_preview": "プレビュー"
}
```

`src/locales/en.json` の `admin` セクションに追加:

```json
"admin": {
  ...既存キー,
  "icon_upload": "Change icon",
  "icon_uploading": "Uploading...",
  "icon_upload_success": "Icon updated",
  "icon_upload_error": "Failed to upload icon",
  "icon_current": "Current icon",
  "icon_preview": "Preview"
}
```

- [ ] **Step 2: AdminSkills.tsx にアイコンアップロード機能を追加**

スキルのインライン編集フォーム内に、アイコンプレビュー + アップロードボタンを追加:

```typescript
// AdminSkills.tsx の先頭 import に追加
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';

// AdminSkills コンポーネント内に追加
const [uploadingIconFor, setUploadingIconFor] = useState<string | null>(null);

/** アイコンアップロード */
const handleIconUpload = async (skillId: string, file: File) => {
  if (!file.type.startsWith('image/')) return;
  try {
    setUploadingIconFor(skillId);
    // ファイル名をスキルIDベースに統一
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${skillId}.${ext}`;
    const storageRef = ref(storage, `icons/${filename}`);
    await uploadBytes(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    // パスを更新（Vercel rewrite経由で配信される）
    const iconPath = `/icons/${filename}`;
    updateSkill(skillId, 'icon', iconPath);
    showToast(t('admin.icon_upload_success'));
  } catch {
    showToast(t('admin.icon_upload_error'), 'error');
  } finally {
    setUploadingIconFor(null);
  }
};
```

インライン編集フォームの先頭（grid の前）にアイコンプレビュー + アップロードを追加:

```tsx
{/* アイコンプレビュー + アップロード */}
<div className="flex items-center gap-3 mb-3">
  <img
    src={skill.icon}
    alt={skill.name.ja}
    className="w-8 h-8 object-contain"
    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
  />
  <label className="px-3 py-1 text-xs border border-app-text/20 rounded cursor-pointer hover:bg-app-text/10 transition-colors">
    {uploadingIconFor === skill.id ? t('admin.icon_uploading') : t('admin.icon_upload')}
    <input
      type="file"
      accept="image/png,image/webp"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleIconUpload(skill.id, file);
        e.target.value = '';
      }}
    />
  </label>
  <span className="text-[10px] text-app-text-muted font-mono">{skill.icon}</span>
</div>
```

- [ ] **Step 3: ビルド確認**

```bash
npx vite build
```

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/AdminSkills.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat: AdminSkillsにアイコンアップロード機能を追加"
```

---

## Part B: 共有データ基盤（DC/サーバー）

> **注意:** `masterData.ts` は現在どこからもインポートされていない。この Part B はハウジングツアーアプリの準備であり、軽減プランナーの動作には影響しない。Phase 4の他タスクが完了した後に着手してよい。

### Task 5: /master/servers シーディング

**Files:**
- Create: `scripts/seed-servers.ts`

- [ ] **Step 1: シードスクリプト作成**

```typescript
/**
 * seed-servers.ts
 * masterData.ts のデータを Firestore /master/servers に書き込む
 *
 * 使い方: npx tsx scripts/seed-servers.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { serverMasterData, housingAreaMasterData, housingSizeMasterData, tagMasterData } from '../src/data/masterData';

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

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ .env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

console.log('✅ Firebase Admin 初期化完了');

const serversDoc = {
  datacenters: serverMasterData,
  housingAreas: housingAreaMasterData,
  housingSizes: housingSizeMasterData,
  tags: tagMasterData,
};

await db.doc('master/servers').set(serversDoc);
console.log('✅ /master/servers 書き込み完了');

await db.doc('master/config').set(
  { dataVersion: FieldValue.increment(1) },
  { merge: true },
);
console.log('✅ dataVersion インクリメント完了');

console.log('\n🎉 サーバーデータのシード完了！');
```

- [ ] **Step 2: スクリプト実行**

```bash
npx tsx scripts/seed-servers.ts
```

- [ ] **Step 3: コミット**

```bash
git add scripts/seed-servers.ts
git commit -m "feat: サーバーデータFirestoreシードスクリプト追加"
```

---

### Task 6: ストア・フック拡張（servers）

**Files:**
- Modify: `src/store/useMasterDataStore.ts`
- Modify: `src/hooks/useMasterData.ts`
- Create: `src/hooks/useServerData.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: 型定義を追加**

`src/types/index.ts` に追加:

```typescript
/** DC/サーバーマスターデータ */
export interface MasterServers {
  datacenters: Record<string, {
    aliases: string[];
    servers: Record<string, string[]>;
  }>;
  housingAreas: Record<string, {
    name_jp: string;
    apartment_name: string;
    aliases: string[];
  }>;
  housingSizes: Array<{
    id: string;
    label: string;
    aliases: string[];
  }>;
  tags: Record<string, string[]>;
}
```

- [ ] **Step 2: ストアに servers フィールドを追加**

`src/store/useMasterDataStore.ts` の `MasterDataState` interface に追加:

```typescript
servers: MasterServers | null;
```

`setData` の引数にも `servers` を追加し、ストアにセットするロジックを拡張。

- [ ] **Step 3: useMasterData.ts のフェッチ処理を拡張**

`useMasterDataInit()` 内の並列フェッチに `/master/servers` を追加:

```typescript
const [contents, skills, stats, servers] = await Promise.all([
  getDoc(doc(db, 'master', 'contents')),
  getDoc(doc(db, 'master', 'skills')),
  getDoc(doc(db, 'master', 'stats')),
  getDoc(doc(db, 'master', 'servers')),
]);
```

localStorageキャッシュにも servers を含める。

- [ ] **Step 4: useServerData.ts フックを作成**

```typescript
/**
 * サーバーデータアクセスフック
 * Firestoreから取得したDC/サーバーデータを返し、未取得時は静的ファイルにフォールバック
 */
import { useMasterDataStore } from '../store/useMasterDataStore';
import type { MasterServers } from '../types';
import {
  serverMasterData as STATIC_DATACENTERS,
  housingAreaMasterData as STATIC_HOUSING_AREAS,
  housingSizeMasterData as STATIC_HOUSING_SIZES,
  tagMasterData as STATIC_TAGS,
} from '../data/masterData';

const STATIC_SERVERS: MasterServers = {
  datacenters: STATIC_DATACENTERS,
  housingAreas: STATIC_HOUSING_AREAS,
  housingSizes: STATIC_HOUSING_SIZES,
  tags: STATIC_TAGS,
};

/** Reactフック */
export function useServerData(): MasterServers {
  const servers = useMasterDataStore((s) => s.servers);
  return servers ?? STATIC_SERVERS;
}

/** 非Reactコンテキスト用 */
export function getServerDataFromStore(): MasterServers {
  return useMasterDataStore.getState().servers ?? STATIC_SERVERS;
}
```

- [ ] **Step 5: ビルド確認**

```bash
npx vite build
```

- [ ] **Step 6: コミット**

```bash
git add src/types/index.ts src/store/useMasterDataStore.ts src/hooks/useMasterData.ts src/hooks/useServerData.ts
git commit -m "feat: サーバーデータのストア・フック拡張"
```

---

### Task 7: 管理API拡張（servers CRUD）

**Files:**
- Modify: `api/admin/templates/index.ts`

- [ ] **Step 1: GET ?type=servers を追加**

```typescript
// GET ハンドラ内に追加
if (type === 'servers') {
  const serversSnap = await db.doc('master/servers').get();
  return res.status(200).json(serversSnap.exists ? serversSnap.data() : {});
}
```

- [ ] **Step 2: PUT type=servers を追加**

```typescript
// PUT ハンドラ内に追加
if (body.type === 'servers') {
  const docRef = db.doc('master/servers');
  // バックアップ
  const current = await docRef.get();
  if (current.exists) {
    await db.collection('master_backups').add({
      documentPath: 'master/servers',
      previousData: current.data(),
      replacedAt: admin.firestore.FieldValue.serverTimestamp(),
      replacedBy: uid,
    });
  }
  const { type: _, ...serversData } = body;
  await docRef.set(serversData);
  // dataVersion インクリメント
  await db.doc('master/config').set(
    { dataVersion: admin.firestore.FieldValue.increment(1) },
    { merge: true },
  );
  return res.status(200).json({ success: true });
}
```

- [ ] **Step 3: ビルド確認**

```bash
npx vite build
```

- [ ] **Step 4: コミット**

```bash
git add api/admin/templates/index.ts
git commit -m "feat: 管理APIにservers CRUDを追加"
```

---

### Task 8: AdminServers管理画面

**Files:**
- Create: `src/components/admin/AdminServers.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/App.tsx`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: i18n キーを追加**

`ja.json`:
```json
"admin": {
  ...既存キー,
  "servers": "サーバー管理",
  "servers_dc": "データセンター",
  "servers_housing": "ハウジングエリア",
  "servers_sizes": "ハウジングサイズ",
  "servers_tags": "タグ",
  "servers_aliases": "表記揺れ",
  "servers_add_alias": "表記揺れ追加",
  "servers_server_count": "サーバー数"
}
```

`en.json`:
```json
"admin": {
  ...既存キー,
  "servers": "Server Management",
  "servers_dc": "Data Centers",
  "servers_housing": "Housing Areas",
  "servers_sizes": "Housing Sizes",
  "servers_tags": "Tags",
  "servers_aliases": "Aliases",
  "servers_add_alias": "Add alias",
  "servers_server_count": "Servers"
}
```

- [ ] **Step 2: AdminServers.tsx を作成**

AdminSkills.tsx と同じパターン:
- `GET /api/admin/templates?type=servers` でデータ取得
- タブ切り替え: DC一覧 / ハウジングエリア / サイズ / タグ
- インライン編集 + 保存ボタン
- `PUT /api/admin/templates { type: 'servers', ... }` で保存

```typescript
/**
 * サーバー管理画面
 * DC/サーバー/表記揺れ/ハウジング/タグの管理UI
 * GET /api/admin/templates?type=servers で取得
 * PUT /api/admin/templates { type: 'servers', ... } で保存
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';
import type { MasterServers } from '../../types';

type Tab = 'dc' | 'housing' | 'sizes' | 'tags';

export function AdminServers() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [data, setData] = useState<MasterServers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dc');

  // 選択中のDC
  const [selectedDc, setSelectedDc] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/templates?type=servers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      setData(json);
      if (json.datacenters && !selectedDc) {
        setSelectedDc(Object.keys(json.datacenters)[0] ?? null);
      }
      setDirty(false);
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [user, t, selectedDc]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      const token = await user?.getIdToken();
      const res = await apiFetch('/api/admin/templates', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'servers', ...data }),
      });
      if (!res.ok) throw new Error(res.statusText);
      showToast(t('admin.save_success'));
      setDirty(false);
    } catch {
      showToast(t('admin.error_save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text w-full';
  const tabClass = (tab: Tab) =>
    `px-3 py-1.5 text-xs border-b-2 transition-colors ${
      activeTab === tab ? 'border-app-text font-bold' : 'border-transparent text-app-text-muted hover:text-app-text'
    }`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">{t('admin.servers')}</h1>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-4 py-1.5 text-xs border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : t('admin.save')}
        </button>
      </div>

      {error && <p className="text-xs text-app-text-muted mb-4">{error}</p>}
      {loading && <p className="text-xs text-app-text-muted">...</p>}

      {!loading && data && (
        <>
          {/* タブ */}
          <div className="flex gap-1 mb-4 border-b border-app-text/10">
            <button className={tabClass('dc')} onClick={() => setActiveTab('dc')}>
              {t('admin.servers_dc')}
            </button>
            <button className={tabClass('housing')} onClick={() => setActiveTab('housing')}>
              {t('admin.servers_housing')}
            </button>
            <button className={tabClass('sizes')} onClick={() => setActiveTab('sizes')}>
              {t('admin.servers_sizes')}
            </button>
            <button className={tabClass('tags')} onClick={() => setActiveTab('tags')}>
              {t('admin.servers_tags')}
            </button>
          </div>

          {/* DC タブ */}
          {activeTab === 'dc' && (
            <div className="flex gap-4">
              {/* 左: DC一覧 */}
              <div className="w-48 shrink-0 border border-app-text/10 rounded">
                <div className="p-2 border-b border-app-text/10 text-[10px] text-app-text-muted font-bold">
                  {t('admin.servers_dc')}
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {Object.entries(data.datacenters).map(([dc, dcData]) => (
                    <button
                      key={dc}
                      onClick={() => setSelectedDc(dc)}
                      className={`w-full text-left px-3 py-2 text-xs border-b border-app-text/5 transition-colors ${
                        selectedDc === dc ? 'bg-app-text/10 font-bold' : 'hover:bg-app-text/5'
                      }`}
                    >
                      {dc}
                      <span className="ml-1 text-app-text-muted">
                        ({Object.keys(dcData.servers).length})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 右: 選択DCのサーバー一覧 */}
              <div className="flex-1 border border-app-text/10 rounded">
                {selectedDc && data.datacenters[selectedDc] && (
                  <>
                    <div className="p-2 border-b border-app-text/10 text-[10px] text-app-text-muted font-bold">
                      {selectedDc} — {t('admin.servers_aliases')}: {data.datacenters[selectedDc].aliases.join(', ')}
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {Object.entries(data.datacenters[selectedDc].servers).map(
                        ([server, aliases]) => (
                          <div
                            key={server}
                            className="px-3 py-2 text-xs border-b border-app-text/5"
                          >
                            <div className="font-bold">{server}</div>
                            <div className="text-app-text-muted mt-0.5">
                              {aliases.join(', ')}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ハウジング タブ */}
          {activeTab === 'housing' && (
            <div className="border border-app-text/10 rounded">
              {Object.entries(data.housingAreas).map(([area, areaData]) => (
                <div key={area} className="px-3 py-2 text-xs border-b border-app-text/5">
                  <div className="font-bold">{area} — {areaData.name_jp}</div>
                  <div className="text-app-text-muted mt-0.5">
                    アパルトメント: {areaData.apartment_name}
                  </div>
                  <div className="text-app-text-muted mt-0.5">
                    {t('admin.servers_aliases')}: {areaData.aliases.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* サイズ タブ */}
          {activeTab === 'sizes' && (
            <div className="border border-app-text/10 rounded">
              {data.housingSizes.map((size) => (
                <div key={size.id} className="px-3 py-2 text-xs border-b border-app-text/5">
                  <div className="font-bold">{size.id} — {size.label}</div>
                  <div className="text-app-text-muted mt-0.5">
                    {t('admin.servers_aliases')}: {size.aliases.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* タグ タブ */}
          {activeTab === 'tags' && (
            <div className="border border-app-text/10 rounded">
              {Object.entries(data.tags).map(([category, tags]) => (
                <div key={category} className="px-3 py-2 text-xs border-b border-app-text/5">
                  <div className="font-bold">{category}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[10px] border border-app-text/20 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: AdminLayout.tsx にナビ項目追加**

NAV_ITEMS 配列に追加:

```typescript
{ path: '/admin/servers', labelKey: 'admin.servers', end: false },
```

- [ ] **Step 4: App.tsx にルート追加**

```typescript
import { AdminServers } from './components/admin/AdminServers';

// admin ルート内に追加
<Route path="servers" element={<AdminServers />} />
```

- [ ] **Step 5: ビルド確認**

```bash
npx vite build
```

- [ ] **Step 6: コミット**

```bash
git add src/components/admin/AdminServers.tsx src/components/admin/AdminLayout.tsx src/App.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat: サーバー管理画面を追加（Phase 4）"
```

---

## 動作確認チェックリスト

### Part A: アイコン
- [ ] `https://lopoly.app/icons/Paladin.png` にアクセスしてアイコンが表示される
- [ ] アプリ起動時にアイコンが正常に表示される（タイムライン、ジョブ選択等）
- [ ] `/admin/skills` でスキルのアイコンプレビューが表示される
- [ ] `/admin/skills` でアイコンアップロードが成功し、変更後のアイコンが表示される
- [ ] レスポンスヘッダーに `Cache-Control: public, max-age=31536000, immutable` が含まれる

### Part B: サーバー管理
- [ ] `/admin/servers` でDC一覧が表示される
- [ ] DCをクリックするとサーバー一覧が表示される
- [ ] ハウジング/サイズ/タグの各タブが表示される
- [ ] データの編集・保存が成功する
