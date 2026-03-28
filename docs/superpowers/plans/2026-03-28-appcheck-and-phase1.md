# Firebase App Check + 管理基盤Phase 1 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firebase App Checkでアプリの正当性検証を追加し、管理基盤Phase 1としてコンテンツ・テンプレートをFirestoreに移行して管理画面から編集可能にする

**Architecture:** App CheckはreCAPTCHA Enterprise連携でフロントエンドにトークンを自動付与し、全Vercel APIでサーバーサイド検証を行う。Phase 1ではFirestoreの `/master/config`・`/master/contents`・`/templates/{contentId}` コレクションに既存データを移行し、バージョンベースのキャッシュ戦略で操作中のFirestoreアクセスをゼロにする。`useMasterData` フックで全消費元をFirestoreデータソースに切り替え、管理画面にコンテンツ・テンプレートCRUD UIを実装する。

**Tech Stack:** Firebase App Check (reCAPTCHA Enterprise) / Firebase Client SDK 12 / Firebase Admin SDK 13 / React 19 / Zustand / Vercel Serverless Functions

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `src/lib/appCheck.ts` | App Check初期化（フロントエンド） |
| `src/lib/apiClient.ts` | App Checkトークン付きfetchラッパー |
| `src/lib/appCheckVerify.ts` | App Checkトークン検証（サーバーサイド共通） |
| `src/hooks/useMasterData.ts` | マスターデータ取得・キャッシュ・配信フック |
| `src/store/useMasterDataStore.ts` | マスターデータのZustandストア |
| `scripts/seed-firestore.mjs` | 既存静的データをFirestoreに初期投入するスクリプト |
| `api/admin/contents/index.ts` | コンテンツCRUD API |
| `api/admin/templates/index.ts` | テンプレートCRUD API |
| `src/components/admin/AdminContents.tsx` | コンテンツ管理UI |
| `src/components/admin/AdminTemplates.tsx` | テンプレート管理UI |
| `src/components/admin/AdminContentForm.tsx` | コンテンツ追加/編集フォーム |

### 既存変更

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/firebase.ts` | App Check初期化の追加 |
| `src/lib/adminAuth.ts` | App Check検証メソッド追加 |
| `src/data/contentRegistry.ts` | Firestoreデータソースへの切り替え（ヘルパー関数はシグネチャ維持） |
| `src/data/templateLoader.ts` | Firestoreからのテンプレート読み込みに書き換え |
| `api/share/index.ts` | App Checkトークン検証を追加 |
| `api/popular/index.ts` | App Checkトークン検証を追加 |
| `api/admin/verify.ts` | App Checkトークン検証を追加 |
| `api/admin/set-role.ts` | App Checkトークン検証を追加 |
| `api/auth/discord/index.ts` | App Checkトークン検証を追加 |
| `api/auth/twitter/index.ts` | App Checkトークン検証を追加 |
| `api/fflogs/token/index.ts` | App Checkトークン検証を追加 |
| `firestore.rules` | `/master/**`、`/templates/**`、バックアップのルール追加 |
| `src/components/admin/AdminLayout.tsx` | コンテンツ・テンプレートのナビ項目追加 |
| `src/components/admin/AdminDashboard.tsx` | 統計表示の追加 |
| `src/App.tsx` | 管理画面サブルート追加 + MasterDataProvider |
| `src/locales/ja.json` | 管理画面i18nキー追加 |
| `src/locales/en.json` | 管理画面i18nキー追加 |
| `src/components/Sidebar.tsx` | useMasterData経由に切り替え |
| `src/components/NewPlanModal.tsx` | useMasterData経由に切り替え |

---

## Part A: Firebase App Check

### Task 1: App Checkフロントエンド初期化

**Files:**
- Create: `src/lib/appCheck.ts`
- Modify: `src/lib/firebase.ts`

- [ ] **Step 1: App Check初期化モジュールを作成**

```typescript
// src/lib/appCheck.ts
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase';

/**
 * Firebase App Check初期化
 * reCAPTCHA Enterpriseでアプリの正当性を検証
 * ローカル開発時はデバッグトークンを使用
 */
export function initAppCheck() {
  // デバッグモード: ローカル開発用
  if (import.meta.env.DEV) {
    // @ts-expect-error — Firebase App Checkデバッグトークン用のグローバル変数
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }

  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey) {
    console.warn('[AppCheck] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY が未設定。App Checkを無効化');
    return null;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
```

- [ ] **Step 2: firebase.tsからApp Checkを起動**

`src/lib/firebase.ts` の末尾に追加:

```typescript
// App Check（アプリの正当性検証）
import { initAppCheck } from './appCheck';
export const appCheck = initAppCheck();
```

- [ ] **Step 3: 動作確認**

`npm run dev` でブラウザコンソールに `[AppCheck] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY が未設定` の警告が出ることを確認（siteKeyは後で設定するため、今はこれが正常）。

- [ ] **Step 4: コミット**

```bash
git add src/lib/appCheck.ts src/lib/firebase.ts
git commit -m "feat: App Checkフロントエンド初期化モジュールを追加"
```

---

### Task 2: App Checkトークン付きAPIクライアント

**Files:**
- Create: `src/lib/apiClient.ts`

- [ ] **Step 1: APIクライアントを作成**

```typescript
// src/lib/apiClient.ts
import { getToken } from 'firebase/app-check';
import { appCheck } from './firebase';

/**
 * App Checkトークン付きfetchラッパー
 * 全てのVercel API呼び出しはこの関数を使う
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  // App Checkトークンをヘッダーに付与
  if (appCheck) {
    try {
      const { token } = await getToken(appCheck, /* forceRefresh */ false);
      headers.set('X-Firebase-AppCheck', token);
    } catch (err) {
      console.warn('[AppCheck] トークン取得失敗:', err);
      // トークンが取れなくてもリクエストは送る（サーバー側で拒否する）
    }
  }

  return fetch(url, { ...options, headers });
}
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/apiClient.ts
git commit -m "feat: App Checkトークン付きAPIクライアントを追加"
```

---

### Task 3: サーバーサイドApp Check検証

**Files:**
- Create: `src/lib/appCheckVerify.ts`
- Modify: `src/lib/adminAuth.ts`

- [ ] **Step 1: App Check検証ヘルパーを作成**

```typescript
// src/lib/appCheckVerify.ts
import { getAppCheck } from 'firebase-admin/app-check';
import { initAdmin } from './adminAuth';

/**
 * App Checkトークンを検証するミドルウェア関数
 * @returns true=検証OK（または開発環境でスキップ）、false=検証失敗（既に403を返却済み）
 */
export async function verifyAppCheck(req: any, res: any): Promise<boolean> {
  // App Check未設定時はスキップ（段階的導入のため）
  // 環境変数 ENFORCE_APP_CHECK=true で強制チェックに切り替え
  const enforced = process.env.ENFORCE_APP_CHECK === 'true';

  const token = req.headers['x-firebase-appcheck'] as string | undefined;
  if (!token) {
    if (enforced) {
      res.status(403).json({ error: 'App Check token missing' });
      return false;
    }
    return true; // 非強制モード: トークンなしでも通す
  }

  try {
    initAdmin();
    await getAppCheck().verifyToken(token);
    return true;
  } catch (err) {
    console.warn('[AppCheck] トークン検証失敗:', err);
    if (enforced) {
      res.status(403).json({ error: 'App Check token invalid' });
      return false;
    }
    return true; // 非強制モード: 検証失敗でも通す
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/appCheckVerify.ts
git commit -m "feat: サーバーサイドApp Check検証ヘルパーを追加"
```

---

### Task 4: 全APIエンドポイントにApp Check検証を追加

**Files:**
- Modify: `api/share/index.ts`
- Modify: `api/popular/index.ts`
- Modify: `api/admin/verify.ts`
- Modify: `api/admin/set-role.ts`
- Modify: `api/auth/discord/index.ts`
- Modify: `api/auth/twitter/index.ts`
- Modify: `api/fflogs/token/index.ts`

全てのAPIハンドラーの先頭（CORS処理の直後、OPTIONSチェックの後）に以下を追加:

- [ ] **Step 1: share API**

`api/share/index.ts` のhandler関数、`if (req.method === 'OPTIONS')` の後に追加:

```typescript
import { verifyAppCheck } from '../../src/lib/appCheckVerify';

// OPTIONSチェックの後、try の前に追加:
if (!(await verifyAppCheck(req, res))) return;
```

- [ ] **Step 2: popular API**

`api/popular/index.ts` — 同じパターンで追加:

```typescript
import { verifyAppCheck } from '../../src/lib/appCheckVerify';
// OPTIONSチェックの後に:
if (!(await verifyAppCheck(req, res))) return;
```

- [ ] **Step 3: admin/verify API**

`api/admin/verify.ts` — 同じパターンで追加:

```typescript
import { verifyAppCheck } from '../../src/lib/appCheckVerify';
// OPTIONSチェックの後に:
if (!(await verifyAppCheck(req, res))) return;
```

- [ ] **Step 4: admin/set-role API**

`api/admin/set-role.ts` — 同じパターンで追加。ただしこのAPIはcurlからも叩くのでADMIN_SECRET認証時はApp Checkをスキップ:

```typescript
import { verifyAppCheck } from '../../src/lib/appCheckVerify';
// secretによる認証の場合はApp Checkスキップ
const hasSecret = req.body?.secret;
if (!hasSecret && !(await verifyAppCheck(req, res))) return;
```

- [ ] **Step 5: auth/discord API**

`api/auth/discord/index.ts` — 同じパターンで追加

- [ ] **Step 6: auth/twitter API**

`api/auth/twitter/index.ts` — 同じパターンで追加

- [ ] **Step 7: fflogs/token API**

`api/fflogs/token/index.ts` — 同じパターンで追加

- [ ] **Step 8: ビルド確認**

```bash
npm run build
```

エラーがないことを確認。

- [ ] **Step 9: コミット**

```bash
git add api/
git commit -m "feat: 全APIエンドポイントにApp Check検証を追加"
```

---

### Task 5: フロントエンドのfetch呼び出しをapiFetchに置き換え

**Files:**
- Modify: 各コンポーネント・ストア内のfetch呼び出し

- [ ] **Step 1: 既存のfetch呼び出しを検索**

以下のパターンで検索: `fetch('/api/` または `fetch(\`/api/` または `fetch("https://lopoly.app/api/`

- [ ] **Step 2: 各呼び出しを `apiFetch` に置き換え**

各ファイルで:
```typescript
// Before
const res = await fetch('/api/share', { ... });

// After
import { apiFetch } from '../lib/apiClient';
const res = await apiFetch('/api/share', { ... });
```

対象ファイルの特定は実装時にgrepで確認すること。主な対象:
- `src/store/useAuthStore.ts` — admin/verify呼び出し
- 共有・人気プラン関連のAPI呼び出し
- FFLogsインポート関連

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/
git commit -m "feat: フロントエンドのAPI呼び出しにApp Checkトークンを付与"
```

---

## Part B: Firestoreセキュリティルール更新

### Task 6: マスターデータ・テンプレート用のセキュリティルール

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: ルールを追加**

`firestore.rules` の `admin_logs` ルールの後、catch-allルールの前に追加:

```javascript
    // ========================================
    // master コレクション
    // マスターデータ: 誰でも読める・直接書き込み不可（API経由のみ）
    // ========================================
    match /master/{docId} {
      allow read: if true;
      allow write: if false;
    }

    // ========================================
    // templates コレクション
    // テンプレート: 誰でも読める・直接書き込み不可
    // ========================================
    match /templates/{contentId} {
      allow read: if true;
      allow write: if false;
    }

    // ========================================
    // template_backups コレクション
    // テンプレートバックアップ: 管理者のみ読める・直接書き込み不可
    // ========================================
    match /template_backups/{docId} {
      allow read: if request.auth != null && request.auth.token.role == 'admin';
      allow write: if false;
    }

    // ========================================
    // master_backups コレクション
    // マスターバックアップ: 管理者のみ読める・直接書き込み不可
    // ========================================
    match /master_backups/{docId} {
      allow read: if request.auth != null && request.auth.token.role == 'admin';
      allow write: if false;
    }
```

- [ ] **Step 2: コミット**

```bash
git add firestore.rules
git commit -m "feat: マスターデータ・テンプレート用Firestoreルールを追加"
```

---

## Part C: マスターデータキャッシュ基盤

### Task 7: マスターデータストア（Zustand）

**Files:**
- Create: `src/store/useMasterDataStore.ts`

- [ ] **Step 1: ストアを作成**

```typescript
// src/store/useMasterDataStore.ts
import { create } from 'zustand';
import type { ContentDefinition, ContentSeries, LocalizedString, ContentCategory, ContentLevel } from '../types';
import type { TemplateData } from '../data/templateLoader';

/** /master/config のデータ構造 */
export interface MasterConfig {
  dataVersion: number;
  featureFlags: {
    useFirestore: boolean;
  };
  categoryLabels: Record<ContentCategory, LocalizedString>;
  levelLabels: Record<number, LocalizedString>;
}

/** /master/contents のデータ構造 */
export interface MasterContents {
  items: ContentDefinition[];
  series: ContentSeries[];
}

/** localStorageキャッシュのキー */
const CACHE_KEY = 'lopo-master-data';
const TEMPLATE_CACHE_PREFIX = 'lopo-template-';

interface CachedMasterData {
  version: number;
  config: MasterConfig;
  contents: MasterContents;
  timestamp: number;
}

interface MasterDataState {
  // 状態
  config: MasterConfig | null;
  contents: MasterContents | null;
  ready: boolean;
  error: string | null;

  // テンプレートキャッシュ（contentId → TemplateData）
  templateCache: Record<string, TemplateData>;

  // アクション
  setData: (config: MasterConfig, contents: MasterContents) => void;
  setError: (error: string) => void;
  setTemplate: (contentId: string, data: TemplateData) => void;
}

export const useMasterDataStore = create<MasterDataState>((set) => ({
  config: null,
  contents: null,
  ready: false,
  error: null,
  templateCache: {},

  setData: (config, contents) => set({ config, contents, ready: true, error: null }),
  setError: (error) => set({ error, ready: true }),
  setTemplate: (contentId, data) =>
    set((state) => ({
      templateCache: { ...state.templateCache, [contentId]: data },
    })),
}));

/** localStorageにキャッシュを保存 */
export function saveMasterCache(version: number, config: MasterConfig, contents: MasterContents) {
  try {
    const data: CachedMasterData = { version, config, contents, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[MasterData] キャッシュ保存失敗:', e);
  }
}

/** localStorageからキャッシュを読み込み */
export function loadMasterCache(): CachedMasterData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedMasterData;
  } catch {
    return null;
  }
}

/** テンプレートをlocalStorageに保存 */
export function saveTemplateCache(contentId: string, data: TemplateData) {
  try {
    localStorage.setItem(TEMPLATE_CACHE_PREFIX + contentId, JSON.stringify(data));
  } catch (e) {
    console.warn('[MasterData] テンプレートキャッシュ保存失敗:', e);
  }
}

/** テンプレートをlocalStorageから読み込み */
export function loadTemplateCache(contentId: string): TemplateData | null {
  try {
    const raw = localStorage.getItem(TEMPLATE_CACHE_PREFIX + contentId);
    if (!raw) return null;
    return JSON.parse(raw) as TemplateData;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add src/store/useMasterDataStore.ts
git commit -m "feat: マスターデータZustandストアを追加"
```

---

### Task 8: useMasterDataフック

**Files:**
- Create: `src/hooks/useMasterData.ts`

- [ ] **Step 1: フックを作成**

```typescript
// src/hooks/useMasterData.ts
import { useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  useMasterDataStore,
  saveMasterCache,
  loadMasterCache,
  saveTemplateCache,
  loadTemplateCache,
} from '../store/useMasterDataStore';
import type { MasterConfig, MasterContents } from '../store/useMasterDataStore';
import type { TemplateData } from '../data/templateLoader';

// 静的ファイルフォールバック用のインポート
import { CONTENT_DEFINITIONS as STATIC_CONTENT_DEFINITIONS, CONTENT_SERIES as STATIC_CONTENT_SERIES, CATEGORY_LABELS as STATIC_CATEGORY_LABELS, LEVEL_LABELS as STATIC_LEVEL_LABELS } from '../data/contentRegistry';

/**
 * Firestoreからマスターデータを取得し、キャッシュ経由で配信するフック
 * アプリ起動時に1回だけFirestoreを読み、以降はメモリで完結
 */
export function useMasterDataInit() {
  const { ready, setData, setError } = useMasterDataStore();

  useEffect(() => {
    if (ready) return; // 既に初期化済み

    let cancelled = false;

    async function init() {
      try {
        // 1. localStorageキャッシュを復元
        const cache = loadMasterCache();

        // 2. Firestoreのバージョン番号を確認
        const configSnap = await getDoc(doc(db, 'master', 'config'));

        if (!configSnap.exists()) {
          // Firestoreにデータがない → 静的ファイルにフォールバック
          console.info('[MasterData] Firestoreにデータなし。静的ファイルを使用');
          if (!cancelled) {
            setData(buildStaticConfig(), buildStaticContents());
          }
          return;
        }

        const config = configSnap.data() as MasterConfig;
        const remoteVersion = config.dataVersion;

        if (cache && cache.version === remoteVersion) {
          // 3a. バージョン同じ → キャッシュ使用（Firestoreアクセス0回追加）
          if (!cancelled) {
            setData(cache.config, cache.contents);
          }
          return;
        }

        // 3b. バージョン違う → 全データ再取得
        const contentsSnap = await getDoc(doc(db, 'master', 'contents'));
        if (!contentsSnap.exists()) {
          throw new Error('/master/contents ドキュメントが存在しない');
        }

        const contents = contentsSnap.data() as MasterContents;

        // 4. キャッシュ保存
        saveMasterCache(remoteVersion, config, contents);

        if (!cancelled) {
          setData(config, contents);
        }
      } catch (err) {
        console.error('[MasterData] 初期化失敗:', err);
        // エラー時: キャッシュがあればそれを使う、なければ静的フォールバック
        const cache = loadMasterCache();
        if (cache && !cancelled) {
          console.info('[MasterData] キャッシュから復旧');
          setData(cache.config, cache.contents);
        } else if (!cancelled) {
          console.info('[MasterData] 静的ファイルにフォールバック');
          setData(buildStaticConfig(), buildStaticContents());
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [ready, setData, setError]);
}

/** 静的ファイルからMasterConfigを構築（フォールバック用） */
function buildStaticConfig(): MasterConfig {
  return {
    dataVersion: 0,
    featureFlags: { useFirestore: false },
    categoryLabels: STATIC_CATEGORY_LABELS,
    levelLabels: STATIC_LEVEL_LABELS,
  };
}

/** 静的ファイルからMasterContentsを構築（フォールバック用） */
function buildStaticContents(): MasterContents {
  return {
    items: STATIC_CONTENT_DEFINITIONS,
    series: STATIC_CONTENT_SERIES,
  };
}

/**
 * マスターデータを同期的に取得するフック
 * useMasterDataInitの後に使う
 */
export function useMasterData() {
  const { config, contents, ready } = useMasterDataStore();
  return { config, contents, ready };
}

/**
 * テンプレートをオンデマンドで取得
 * Firestoreに存在すればFirestoreから、なければ静的ファイルにフォールバック
 */
export async function fetchTemplate(contentId: string): Promise<TemplateData | null> {
  const store = useMasterDataStore.getState();

  // 1. メモリキャッシュ確認
  if (store.templateCache[contentId]) {
    return store.templateCache[contentId];
  }

  // 2. localStorageキャッシュ確認
  const cached = loadTemplateCache(contentId);
  if (cached) {
    store.setTemplate(contentId, cached);
    return cached;
  }

  // 3. Firestoreから取得を試行
  try {
    const snap = await getDoc(doc(db, 'templates', contentId));
    if (snap.exists()) {
      const data = snap.data() as TemplateData;
      store.setTemplate(contentId, data);
      saveTemplateCache(contentId, data);
      return data;
    }
  } catch (err) {
    console.warn(`[MasterData] テンプレート ${contentId} のFirestore取得失敗:`, err);
  }

  // 4. 静的ファイルフォールバック（Vite glob import）
  try {
    const { getTemplate } = await import('../data/templateLoader');
    const staticData = await getTemplate(contentId);
    if (staticData) {
      store.setTemplate(contentId, staticData);
      return staticData;
    }
  } catch {
    // 静的ファイルもない
  }

  return null;
}
```

- [ ] **Step 2: コミット**

```bash
git add src/hooks/useMasterData.ts
git commit -m "feat: useMasterDataフック — Firestoreキャッシュ+静的フォールバック"
```

---

### Task 9: アプリ起動時のマスターデータ初期化

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: App.tsxにuseMasterDataInitを追加**

`src/App.tsx` のApp関数の先頭でフックを呼ぶ:

```typescript
import { useMasterDataInit } from './hooks/useMasterData';

function App() {
  const theme = useThemeStore((state) => state.theme);
  const { i18n } = useTranslation();

  // マスターデータの初期化（起動時にFirestoreから取得）
  useMasterDataInit();

  // ... 残りは変更なし
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/App.tsx
git commit -m "feat: アプリ起動時にマスターデータ初期化を実行"
```

---

## Part D: 初期シーディング

### Task 10: Firestore初期データ投入スクリプト

**Files:**
- Create: `scripts/seed-firestore.mjs`

- [ ] **Step 1: シーディングスクリプトを作成**

```javascript
// scripts/seed-firestore.mjs
// 使用方法: node scripts/seed-firestore.mjs
//
// 既存の静的データ（contents.json, contentRegistry.ts, templates/*.json）を
// Firestoreの /master/config, /master/contents, /templates/{contentId} に投入する。
//
// 環境変数が必要:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

config({ path: '.env.local' });

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = join(__dirname, '..');

// Firebase Admin初期化
let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
pk = pk.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: pk,
  }),
});

const db = getFirestore();

async function seed() {
  console.log('=== Firestoreシーディング開始 ===');

  // 1. contents.json を読み込み
  const contentsRaw = JSON.parse(readFileSync(join(rootDir, 'src/data/contents.json'), 'utf-8'));

  // 2. contentRegistryのラベルを手動定義（TypeScript fileはNode.jsで直接読めないため）
  const categoryLabels = {
    savage: { ja: '零式', en: 'Savage' },
    ultimate: { ja: '絶', en: 'Ultimate' },
    dungeon: { ja: 'ダンジョン', en: 'Dungeon' },
    raid: { ja: 'レイド', en: 'Raid' },
    custom: { ja: 'その他', en: 'Misc' },
  };

  const levelLabels = {
    70: { ja: 'Lv70 (紅蓮)', en: 'Lv70 (Stormblood)' },
    80: { ja: 'Lv80 (漆黒)', en: 'Lv80 (Shadowbringers)' },
    90: { ja: 'Lv90 (暁月)', en: 'Lv90 (Endwalker)' },
    100: { ja: 'Lv100 (黄金)', en: 'Lv100 (Dawntrail)' },
  };

  // 3. シリーズを動的に生成（contentRegistryの getSeriesMetadata ロジックを再現）
  const seriesMap = new Map();
  const contentItems = [];

  for (const rc of contentsRaw) {
    const meta = getSeriesMetadata(rc.id, rc.category);
    contentItems.push({
      id: rc.id,
      category: rc.category,
      level: rc.level,
      patch: rc.patch,
      name: { ja: rc.ja, en: rc.en },
      shortName: { ja: rc.shortNameJa || meta.shortJa, en: meta.shortEn },
      seriesId: meta.seriesId,
      order: meta.order,
      fflogsEncounterId: rc.fflogsEncounterId || null,
      hasCheckpoint: rc.hasCheckpoint || false,
    });

    const hasPhaseSuffix = /_p\d+$/.test(rc.id);
    if (!seriesMap.has(meta.seriesId) || !hasPhaseSuffix) {
      seriesMap.set(meta.seriesId, {
        id: meta.seriesId,
        name: rc.category === 'ultimate'
          ? { ja: rc.ja, en: rc.en }
          : { ja: meta.seriesJa, en: meta.seriesEn },
        category: rc.category,
        level: rc.level,
      });
    }
  }

  const seriesItems = Array.from(seriesMap.values());

  // 4. /master/config を書き込み
  await db.doc('master/config').set({
    dataVersion: 1,
    featureFlags: { useFirestore: true },
    categoryLabels,
    levelLabels,
  });
  console.log('✅ /master/config を書き込み');

  // 5. /master/contents を書き込み
  await db.doc('master/contents').set({
    items: contentItems,
    series: seriesItems,
  });
  console.log(`✅ /master/contents を書き込み（${contentItems.length}件 + ${seriesItems.length}シリーズ）`);

  // 6. テンプレートを書き込み
  const templatesDir = join(rootDir, 'src/data/templates');
  const templateFiles = readdirSync(templatesDir).filter(f => f.endsWith('.json'));

  for (const file of templateFiles) {
    const contentId = basename(file, '.json');
    const templateData = JSON.parse(readFileSync(join(templatesDir, file), 'utf-8'));
    await db.doc(`templates/${contentId}`).set({
      contentId,
      source: 'admin_manual',
      timelineEvents: templateData.timelineEvents || [],
      phases: templateData.phases || [],
      generatedAt: templateData.generatedAt || null,
      sourceLogsCount: templateData.sourceLogsCount || 0,
      lockedAt: null,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: 'seed-script',
    });
    console.log(`  ✅ /templates/${contentId}`);
  }

  console.log(`\n=== シーディング完了（テンプレート ${templateFiles.length}件） ===`);
}

// getSeriesMetadata の再現（contentRegistry.ts のロジックをそのまま移植）
function getSeriesMetadata(id, category) {
  if (category === 'ultimate') {
    const baseId = id.replace(/_p\d+$/, '');
    const pMatch = id.match(/_p(\d+)$/);
    const uppercase = baseId.toUpperCase();
    if (pMatch) {
      const pNum = parseInt(pMatch[1], 10);
      return { seriesId: baseId, seriesJa: '', seriesEn: '', order: pNum * 0.1, shortJa: `${uppercase}\nP${pNum}`, shortEn: `${uppercase}\nP${pNum}` };
    }
    return { seriesId: baseId, seriesJa: '', seriesEn: '', order: 1, shortJa: uppercase, shortEn: uppercase };
  }

  const floorMatch = id.match(/(\d+)s(?:_p(\d+))?$/);
  let absoluteOrder = 1;
  let phaseOffset = 0;
  if (floorMatch) {
    absoluteOrder = parseInt(floorMatch[1], 10);
    if (floorMatch[2]) phaseOffset = parseInt(floorMatch[2], 10) * 0.1;
  }

  let relativeOrder = absoluteOrder;
  let seriesInfo = { seriesId: 'misc', seriesJa: 'その他', seriesEn: 'Misc' };

  if (id.startsWith('m')) {
    if (absoluteOrder < 5) seriesInfo = { seriesId: 'aac_lhw', seriesJa: 'ライトヘビー級', seriesEn: 'Light-heavyweight' };
    else if (absoluteOrder < 9) { seriesInfo = { seriesId: 'aac_cruiser', seriesJa: 'クルーザー級', seriesEn: 'Cruiserweight' }; relativeOrder = absoluteOrder - 4; }
    else { seriesInfo = { seriesId: 'aac_heavy', seriesJa: 'ヘビー級', seriesEn: 'Heavyweight' }; relativeOrder = absoluteOrder - 8; }
  } else if (id.startsWith('p')) {
    if (absoluteOrder <= 4) seriesInfo = { seriesId: 'pandaemonium_asphodelos', seriesJa: '辺獄編', seriesEn: 'Asphodelos' };
    else if (absoluteOrder <= 8) { seriesInfo = { seriesId: 'pandaemonium_abyssos', seriesJa: '煉獄編', seriesEn: 'Abyssos' }; relativeOrder = absoluteOrder - 4; }
    else { seriesInfo = { seriesId: 'pandaemonium_anabaseios', seriesJa: '天獄編', seriesEn: 'Anabaseios' }; relativeOrder = absoluteOrder - 8; }
  } else if (id.startsWith('e')) {
    if (absoluteOrder <= 4) seriesInfo = { seriesId: 'eden_gate', seriesJa: '覚醒編', seriesEn: 'Gate' };
    else if (absoluteOrder <= 8) { seriesInfo = { seriesId: 'eden_verse', seriesJa: '共鳴編', seriesEn: 'Verse' }; relativeOrder = absoluteOrder - 4; }
    else { seriesInfo = { seriesId: 'eden_promise', seriesJa: '再生編', seriesEn: 'Promise' }; relativeOrder = absoluteOrder - 8; }
  } else if (id.startsWith('o')) {
    if (absoluteOrder <= 4) seriesInfo = { seriesId: 'omega_deltascape', seriesJa: 'デルタ編', seriesEn: 'Deltascape' };
    else if (absoluteOrder <= 8) { seriesInfo = { seriesId: 'omega_sigmascape', seriesJa: 'シグマ編', seriesEn: 'Sigmascape' }; relativeOrder = absoluteOrder - 4; }
    else { seriesInfo = { seriesId: 'omega_alphascape', seriesJa: 'アルファ編', seriesEn: 'Alphascape' }; relativeOrder = absoluteOrder - 8; }
  }

  const shortJa = Math.floor(relativeOrder) + '層' + (phaseOffset === 0.1 ? '\n前半' : phaseOffset === 0.2 ? '\n後半' : '');
  const shortEn = id.toUpperCase().replace('_', '\n').replace(' ', '\n');
  const orderForSorting = relativeOrder + phaseOffset;

  return { ...seriesInfo, order: orderForSorting, shortJa, shortEn };
}

seed().catch(err => {
  console.error('シーディングエラー:', err);
  process.exit(1);
});
```

- [ ] **Step 2: コミット**

```bash
git add scripts/seed-firestore.mjs
git commit -m "feat: Firestore初期データ投入スクリプトを追加"
```

- [ ] **Step 3: シーディング実行**

```bash
node scripts/seed-firestore.mjs
```

全件成功するか確認。Firebase Consoleで `/master/config`、`/master/contents`、`/templates/*` を目視確認。

---

## Part E: contentRegistry.tsをFirestoreデータソースに切り替え

### Task 11: contentRegistry.tsの書き換え

**Files:**
- Modify: `src/data/contentRegistry.ts`

- [ ] **Step 1: contentRegistry.tsを書き換え**

Firestoreデータがあればそちらを使い、なければ従来の静的ファイルにフォールバックする。ヘルパー関数のシグネチャは一切変えない（呼び出し元の変更不要）:

```typescript
// src/data/contentRegistry.ts
import { useMasterDataStore } from '../store/useMasterDataStore';
import { RAID_CONTENTS } from './contents';
import type {
    ContentCategory,
    ContentDefinition,
    ContentLevel,
    ContentSeries,
    LocalizedString,
} from '../types';

// ==========================================
// 静的フォールバック用ラベル（Firestoreにデータがないとき使う）
// ==========================================
const STATIC_CATEGORY_LABELS: Record<ContentCategory, LocalizedString> = {
    savage: { ja: '零式', en: 'Savage' },
    ultimate: { ja: '絶', en: 'Ultimate' },
    dungeon: { ja: 'ダンジョン', en: 'Dungeon' },
    raid: { ja: 'レイド', en: 'Raid' },
    custom: { ja: 'その他', en: 'Misc' },
};

const STATIC_LEVEL_LABELS: Record<ContentLevel, LocalizedString> = {
    70: { ja: 'Lv70 (紅蓮)', en: 'Lv70 (Stormblood)' },
    80: { ja: 'Lv80 (漆黒)', en: 'Lv80 (Shadowbringers)' },
    90: { ja: 'Lv90 (暁月)', en: 'Lv90 (Endwalker)' },
    100: { ja: 'Lv100 (黄金)', en: 'Lv100 (Dawntrail)' },
};

// ==========================================
// 静的データからのフォールバック生成（従来ロジック維持）
// ==========================================
function getSeriesMetadata(id: string, category: ContentCategory): { seriesId: string; seriesJa: string; seriesEn: string; order: number; shortJa: string; shortEn: string } {
    // ... 既存のgetSeriesMetadata関数をそのまま維持（変更なし）
}

const STATIC_CONTENT_DEFINITIONS: ContentDefinition[] = RAID_CONTENTS.map(rc => {
    const { seriesId, order, shortJa, shortEn } = getSeriesMetadata(rc.id, rc.category);
    return {
        id: rc.id,
        name: { ja: rc.ja, en: rc.en },
        shortName: { ja: rc.shortNameJa || shortJa, en: shortEn },
        seriesId,
        category: rc.category,
        level: rc.level,
        patch: rc.patch,
        order
    };
});

const staticSeriesMap = new Map<string, ContentSeries>();
RAID_CONTENTS.forEach(rc => {
    const { seriesId, seriesJa, seriesEn } = getSeriesMetadata(rc.id, rc.category);
    const hasPhaseSuffix = /_p\d+$/.test(rc.id);
    if (!staticSeriesMap.has(seriesId) || (!hasPhaseSuffix && staticSeriesMap.has(seriesId))) {
        staticSeriesMap.set(seriesId, {
            id: seriesId,
            name: rc.category === 'ultimate' ? { ja: rc.ja, en: rc.en } : { ja: seriesJa, en: seriesEn },
            category: rc.category,
            level: rc.level
        });
    }
});
const STATIC_CONTENT_SERIES: ContentSeries[] = Array.from(staticSeriesMap.values());

// ==========================================
// データアクセサ（Firestore優先 → 静的フォールバック）
// ==========================================

/** 現在のコンテンツ定義を取得 */
function getContentDefinitions(): ContentDefinition[] {
    const store = useMasterDataStore.getState();
    return store.contents?.items ?? STATIC_CONTENT_DEFINITIONS;
}

/** 現在のシリーズ定義を取得 */
function getContentSeries(): ContentSeries[] {
    const store = useMasterDataStore.getState();
    return store.contents?.series ?? STATIC_CONTENT_SERIES;
}

// 後方互換: 既存のexportを維持
export const CATEGORY_LABELS = STATIC_CATEGORY_LABELS;
export const LEVEL_LABELS = STATIC_LEVEL_LABELS;

/** @deprecated — getContentDefinitions() を使うこと。後方互換のため維持 */
export const CONTENT_DEFINITIONS = STATIC_CONTENT_DEFINITIONS;
export const CONTENT_SERIES = STATIC_CONTENT_SERIES;
export const PROJECT_LABELS: Record<string, LocalizedString> = {
    'aac': { ja: '至天の座アルカディア零式', en: 'AAC' },
    'pandaemonium': { ja: '万魔殿パンデモニウム零式', en: 'Pandaemonium' },
    'eden': { ja: '希望の園エデン零式', en: 'Eden' },
    'omega': { ja: '次元の狭間オメガ零式', en: 'Omega' },
};

// ==========================================
// Registry Helper Functions（シグネチャ維持・データソースのみ切り替え）
// ==========================================

export function getContentByLevel(level: ContentLevel): ContentDefinition[] {
    return getContentDefinitions().filter(c => c.level === level);
}

export function getSeriesByLevel(level: ContentLevel): ContentSeries[] {
    return getContentSeries().filter(s => s.level === level);
}

export function getContentBySeries(seriesId: string): ContentDefinition[] {
    return getContentDefinitions().filter(c => c.seriesId === seriesId).sort((a, b) => a.order - b.order);
}

export function getSeriesById(seriesId: string): ContentSeries | undefined {
    return getContentSeries().find(s => s.id === seriesId);
}

export function getContentById(contentId: string): ContentDefinition | undefined {
    return getContentDefinitions().find(c => c.id === contentId);
}

export function getCategoriesByLevel(_level: ContentLevel): ContentCategory[] {
    return ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];
}

export function getProjectLabel(level: ContentLevel, category: ContentCategory): LocalizedString | null {
    if (category !== 'savage') return null;
    const levelToProjectKey: Record<number, string> = { 100: 'aac', 90: 'pandaemonium', 80: 'eden', 70: 'omega' };
    const key = levelToProjectKey[level];
    return key ? PROJECT_LABELS[key] : null;
}

// カテゴリ・レベルラベルもFirestore対応
export function getCategoryLabel(category: ContentCategory): LocalizedString {
    const store = useMasterDataStore.getState();
    return store.config?.categoryLabels?.[category] ?? STATIC_CATEGORY_LABELS[category];
}

export function getLevelLabel(level: ContentLevel): LocalizedString {
    const store = useMasterDataStore.getState();
    return store.config?.levelLabels?.[level] ?? STATIC_LEVEL_LABELS[level];
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

呼び出し元に型エラーがないことを確認。

- [ ] **Step 3: コミット**

```bash
git add src/data/contentRegistry.ts
git commit -m "feat: contentRegistryをFirestoreデータソース対応に書き換え"
```

---

### Task 12: templateLoader.tsのFirestore対応

**Files:**
- Modify: `src/data/templateLoader.ts`

- [ ] **Step 1: templateLoader.tsを書き換え**

```typescript
// src/data/templateLoader.ts
import type { TimelineEvent } from '../types';
import { fetchTemplate as fetchFromFirestore } from '../hooks/useMasterData';

export interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: string; }[];
  _warning?: string;
}

// 静的ファイル（Vite glob import）— フォールバック用に維持
const templateModules = import.meta.glob('./templates/*.json');

/**
 * テンプレートが存在するか確認（同期）
 * Firestore版はメモリキャッシュのみ確認。完全な存在確認はgetTemplateを使う
 */
export function hasTemplate(contentId: string): boolean {
  // 静的ファイルの存在チェック（従来の動作を維持）
  return `./templates/${contentId}.json` in templateModules;
}

/**
 * テンプレートを取得（Firestore優先 → 静的ファイルフォールバック）
 */
export async function getTemplate(contentId: string): Promise<TemplateData | null> {
  // fetchFromFirestoreが内部でメモリ→localStorage→Firestore→静的ファイルの順で試す
  return fetchFromFirestore(contentId);
}
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/data/templateLoader.ts
git commit -m "feat: templateLoaderをFirestore対応に書き換え"
```

---

## Part F: 管理API

### Task 13: コンテンツCRUD API

**Files:**
- Create: `api/admin/contents/index.ts`

- [ ] **Step 1: APIを作成**

```typescript
// api/admin/contents/index.ts
/**
 * コンテンツCRUD API
 * GET    /api/admin/contents — 全コンテンツ取得
 * POST   /api/admin/contents — コンテンツ追加
 * PUT    /api/admin/contents — コンテンツ更新
 * DELETE /api/admin/contents?id=xxx — コンテンツ削除
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify';
import { applyRateLimit } from '../../../src/lib/rateLimit';
import { writeAuditLog } from '../../../src/lib/auditLog';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await verifyAppCheck(req, res))) return;
  if (!applyRateLimit(req, res, 30, 60_000)) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(403).json({ error: 'Forbidden' });

    const db = getAdminFirestore();

    if (req.method === 'GET') {
      const doc = await db.doc('master/contents').get();
      if (!doc.exists) return res.status(200).json({ items: [], series: [] });
      return res.status(200).json(doc.data());
    }

    if (req.method === 'POST') {
      const { item, series: newSeries } = req.body;

      // バリデーション
      if (!item?.id || !item?.name?.ja || !item?.name?.en || !item?.category || !item?.level) {
        return res.status(400).json({ error: '必須フィールドが不足しています' });
      }

      const doc = await db.doc('master/contents').get();
      const data = doc.exists ? doc.data()! : { items: [], series: [] };

      // ID重複チェック
      if (data.items.some((c: any) => c.id === item.id)) {
        return res.status(409).json({ error: `コンテンツID "${item.id}" は既に存在します` });
      }

      data.items.push(item);
      if (newSeries && !data.series.some((s: any) => s.id === newSeries.id)) {
        data.series.push(newSeries);
      }

      // バックアップ
      if (doc.exists) {
        await db.collection('master_backups').add({
          documentPath: '/master/contents',
          previousData: doc.data(),
          replacedAt: new Date(),
          replacedBy: adminUid,
        });
      }

      await db.doc('master/contents').set(data);
      await bumpVersion(db);
      await writeAuditLog(adminUid, 'create', `contents.${item.id}`, { before: null, after: item });

      return res.status(201).json({ success: true, item });
    }

    if (req.method === 'PUT') {
      const { item } = req.body;
      if (!item?.id) return res.status(400).json({ error: 'idが必要です' });

      const doc = await db.doc('master/contents').get();
      if (!doc.exists) return res.status(404).json({ error: 'データが存在しません' });

      const data = doc.data()!;
      const idx = data.items.findIndex((c: any) => c.id === item.id);
      if (idx === -1) return res.status(404).json({ error: `コンテンツ "${item.id}" が見つかりません` });

      const before = data.items[idx];
      data.items[idx] = { ...before, ...item };

      // バックアップ
      await db.collection('master_backups').add({
        documentPath: '/master/contents',
        previousData: doc.data(),
        replacedAt: new Date(),
        replacedBy: adminUid,
      });

      await db.doc('master/contents').set(data);
      await bumpVersion(db);
      await writeAuditLog(adminUid, 'update', `contents.${item.id}`, { before, after: data.items[idx] });

      return res.status(200).json({ success: true, item: data.items[idx] });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'idが必要です' });

      const doc = await db.doc('master/contents').get();
      if (!doc.exists) return res.status(404).json({ error: 'データが存在しません' });

      const data = doc.data()!;
      const idx = data.items.findIndex((c: any) => c.id === id);
      if (idx === -1) return res.status(404).json({ error: `コンテンツ "${id}" が見つかりません` });

      const before = data.items[idx];
      data.items.splice(idx, 1);

      // バックアップ
      await db.collection('master_backups').add({
        documentPath: '/master/contents',
        previousData: doc.data(),
        replacedAt: new Date(),
        replacedBy: adminUid,
      });

      await db.doc('master/contents').set(data);
      await bumpVersion(db);
      await writeAuditLog(adminUid, 'delete', `contents.${id}`, { before, after: null });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('admin contents error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** /master/config の dataVersion を +1 する */
async function bumpVersion(db: FirebaseFirestore.Firestore) {
  const configRef = db.doc('master/config');
  const configDoc = await configRef.get();
  const currentVersion = configDoc.exists ? (configDoc.data()?.dataVersion || 0) : 0;
  await configRef.set({ dataVersion: currentVersion + 1 }, { merge: true });
}
```

- [ ] **Step 2: コミット**

```bash
git add api/admin/contents/
git commit -m "feat: コンテンツCRUD APIを追加"
```

---

### Task 14: テンプレートCRUD API

**Files:**
- Create: `api/admin/templates/index.ts`

- [ ] **Step 1: APIを作成**

```typescript
// api/admin/templates/index.ts
/**
 * テンプレートCRUD API
 * GET    /api/admin/templates?id=xxx — テンプレート取得
 * POST   /api/admin/templates — テンプレートアップロード
 * PUT    /api/admin/templates — テンプレート更新
 * DELETE /api/admin/templates?id=xxx — テンプレート削除
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify';
import { applyRateLimit } from '../../../src/lib/rateLimit';
import { writeAuditLog } from '../../../src/lib/auditLog';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!(await verifyAppCheck(req, res))) return;
  if (!applyRateLimit(req, res, 30, 60_000)) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(403).json({ error: 'Forbidden' });

    const db = getAdminFirestore();

    if (req.method === 'GET') {
      const contentId = req.query?.id;
      if (contentId) {
        const doc = await db.doc(`templates/${contentId}`).get();
        if (!doc.exists) return res.status(404).json({ error: 'テンプレートが見つかりません' });
        return res.status(200).json(doc.data());
      }
      // 全テンプレート一覧（メタデータのみ）
      const snapshot = await db.collection('templates').get();
      const templates = snapshot.docs.map(d => ({
        contentId: d.id,
        source: d.data().source,
        eventCount: (d.data().timelineEvents || []).length,
        phaseCount: (d.data().phases || []).length,
        lockedAt: d.data().lockedAt,
        lastUpdatedAt: d.data().lastUpdatedAt,
        lastUpdatedBy: d.data().lastUpdatedBy,
      }));
      return res.status(200).json({ templates });
    }

    if (req.method === 'POST') {
      const { contentId, timelineEvents, phases, source } = req.body;
      if (!contentId || !timelineEvents) {
        return res.status(400).json({ error: 'contentIdとtimelineEventsが必要です' });
      }

      const templateData = {
        contentId,
        source: source || 'admin_manual',
        timelineEvents,
        phases: phases || [],
        lockedAt: null,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: adminUid,
      };

      // 既存テンプレートがあればバックアップ
      const existing = await db.doc(`templates/${contentId}`).get();
      if (existing.exists) {
        await db.collection('template_backups').add({
          contentId,
          previousData: existing.data(),
          replacedAt: new Date(),
          replacedBy: adminUid,
        });
      }

      await db.doc(`templates/${contentId}`).set(templateData);
      await bumpVersion(db);
      await writeAuditLog(adminUid, existing.exists ? 'update' : 'create', `templates.${contentId}`, {
        before: existing.exists ? existing.data() : null,
        after: templateData,
      });

      return res.status(201).json({ success: true, contentId });
    }

    if (req.method === 'PUT') {
      const { contentId, ...updates } = req.body;
      if (!contentId) return res.status(400).json({ error: 'contentIdが必要です' });

      const ref = db.doc(`templates/${contentId}`);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'テンプレートが見つかりません' });

      // バックアップ
      await db.collection('template_backups').add({
        contentId,
        previousData: doc.data(),
        replacedAt: new Date(),
        replacedBy: adminUid,
      });

      const updated = {
        ...doc.data(),
        ...updates,
        lastUpdatedAt: new Date(),
        lastUpdatedBy: adminUid,
      };
      await ref.set(updated);
      await bumpVersion(db);
      await writeAuditLog(adminUid, 'update', `templates.${contentId}`, { before: doc.data(), after: updated });

      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const contentId = req.query?.id || req.body?.contentId;
      if (!contentId) return res.status(400).json({ error: 'contentIdが必要です' });

      const ref = db.doc(`templates/${contentId}`);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'テンプレートが見つかりません' });

      // バックアップ
      await db.collection('template_backups').add({
        contentId,
        previousData: doc.data(),
        replacedAt: new Date(),
        replacedBy: adminUid,
      });

      await ref.delete();
      await bumpVersion(db);
      await writeAuditLog(adminUid, 'delete', `templates.${contentId}`, { before: doc.data(), after: null });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('admin templates error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function bumpVersion(db: FirebaseFirestore.Firestore) {
  const configRef = db.doc('master/config');
  const configDoc = await configRef.get();
  const currentVersion = configDoc.exists ? (configDoc.data()?.dataVersion || 0) : 0;
  await configRef.set({ dataVersion: currentVersion + 1 }, { merge: true });
}
```

- [ ] **Step 2: コミット**

```bash
git add api/admin/templates/
git commit -m "feat: テンプレートCRUD APIを追加"
```

---

## Part G: 管理画面UI

### Task 15: i18nキーの追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: 日本語キーを追加**

`ja.json` の `admin` セクションを拡張:

```json
"admin": {
    "dashboard": "ダッシュボード",
    "dashboard_placeholder": "管理機能はPhase 1以降で追加されます。",
    "back_to_app": "アプリに戻る",
    "contents": "コンテンツ管理",
    "templates": "テンプレート管理",
    "contents_title": "コンテンツ一覧",
    "contents_add": "コンテンツ追加",
    "contents_edit": "コンテンツ編集",
    "contents_delete_confirm": "「{{name}}」を削除しますか？",
    "contents_id": "コンテンツID",
    "contents_name_ja": "名前（日本語）",
    "contents_name_en": "名前（英語）",
    "contents_short_ja": "略称（日本語）",
    "contents_short_en": "略称（英語）",
    "contents_category": "カテゴリ",
    "contents_level": "レベル",
    "contents_patch": "パッチ",
    "contents_series": "シリーズ",
    "contents_fflogs_id": "FFLogs ID",
    "contents_order": "表示順",
    "contents_saved": "コンテンツを保存しました",
    "contents_deleted": "コンテンツを削除しました",
    "templates_title": "テンプレート一覧",
    "templates_upload": "JSONアップロード",
    "templates_events": "イベント数",
    "templates_phases": "フェーズ数",
    "templates_source": "ソース",
    "templates_locked": "ロック済み",
    "templates_unlocked": "未ロック",
    "templates_last_updated": "最終更新",
    "templates_delete_confirm": "「{{name}}」のテンプレートを削除しますか？",
    "templates_uploaded": "テンプレートをアップロードしました",
    "templates_deleted": "テンプレートを削除しました",
    "save": "保存",
    "delete": "削除",
    "edit": "編集",
    "add": "追加",
    "upload": "アップロード",
    "no_data": "データがありません",
    "error_load": "データの読み込みに失敗しました",
    "error_save": "保存に失敗しました",
    "stats_contents": "コンテンツ",
    "stats_templates": "テンプレート",
    "stats_version": "データバージョン"
}
```

- [ ] **Step 2: 英語キーを追加**

`en.json` の `admin` セクションに同じ構造の英語キーを追加。

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat: 管理画面Phase 1のi18nキーを追加"
```

---

### Task 16: コンテンツ管理UI

**Files:**
- Create: `src/components/admin/AdminContents.tsx`
- Create: `src/components/admin/AdminContentForm.tsx`

- [ ] **Step 1: コンテンツ一覧コンポーネント**

```typescript
// src/components/admin/AdminContents.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { AdminContentForm } from './AdminContentForm';
import type { ContentDefinition, ContentSeries } from '../../types';

export function AdminContents() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<ContentDefinition[]>([]);
  const [series, setSeries] = useState<ContentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContentDefinition | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function fetchContents() {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/contents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.items || []);
      setSeries(data.series || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchContents(); }, []);

  async function handleDelete(id: string) {
    const item = items.find(c => c.id === id);
    if (!confirm(t('admin.contents_delete_confirm', { name: item?.name?.ja || id }))) return;

    const token = await user?.getIdToken();
    const res = await fetch(`/api/admin/contents?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchContents();
    }
  }

  function handleEdit(item: ContentDefinition) {
    setEditing(item);
    setShowForm(true);
  }

  function handleAdd() {
    setEditing(null);
    setShowForm(true);
  }

  async function handleSave() {
    setShowForm(false);
    setEditing(null);
    await fetchContents();
  }

  if (loading) return <div className="text-sm animate-pulse">{t('common.loading')}</div>;
  if (error) return <div className="text-sm text-red-400">{t('admin.error_load')}: {error}</div>;

  if (showForm) {
    return (
      <AdminContentForm
        existing={editing}
        series={series}
        onSave={handleSave}
        onCancel={() => { setShowForm(false); setEditing(null); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">{t('admin.contents_title')}</h1>
        <button
          onClick={handleAdd}
          className="px-3 py-1 text-xs border border-app-text/20 rounded hover:bg-app-text/5 transition-colors"
        >
          + {t('admin.add')}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-app-text-muted">{t('admin.no_data')}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-app-text/10">
              <th className="py-2 text-left">ID</th>
              <th className="py-2 text-left">{t('admin.contents_name_ja')}</th>
              <th className="py-2 text-left">{t('admin.contents_category')}</th>
              <th className="py-2 text-left">{t('admin.contents_level')}</th>
              <th className="py-2 text-left">{t('admin.contents_patch')}</th>
              <th className="py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-app-text/5 hover:bg-app-text/3">
                <td className="py-2 font-mono">{item.id}</td>
                <td className="py-2">{item.name?.ja}</td>
                <td className="py-2">{item.category}</td>
                <td className="py-2">{item.level}</td>
                <td className="py-2">{item.patch}</td>
                <td className="py-2 text-right space-x-2">
                  <button onClick={() => handleEdit(item)} className="hover:underline">{t('admin.edit')}</button>
                  <button onClick={() => handleDelete(item.id)} className="hover:underline text-app-text-muted">{t('admin.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: コンテンツ追加/編集フォーム**

```typescript
// src/components/admin/AdminContentForm.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import type { ContentDefinition, ContentSeries, ContentCategory, ContentLevel } from '../../types';

interface Props {
  existing: ContentDefinition | null;
  series: ContentSeries[];
  onSave: () => void;
  onCancel: () => void;
}

const CATEGORIES: ContentCategory[] = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'];
const LEVELS: ContentLevel[] = [100, 90, 80, 70];

export function AdminContentForm({ existing, series, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    id: existing?.id || '',
    nameJa: existing?.name?.ja || '',
    nameEn: existing?.name?.en || '',
    shortNameJa: existing?.shortName?.ja || '',
    shortNameEn: existing?.shortName?.en || '',
    category: existing?.category || 'savage' as ContentCategory,
    level: existing?.level || 100 as ContentLevel,
    patch: existing?.patch || '',
    seriesId: existing?.seriesId || '',
    order: existing?.order || 1,
    fflogsEncounterId: (existing as any)?.fflogsEncounterId || '',
  });

  function updateField(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const item = {
      id: form.id,
      name: { ja: form.nameJa, en: form.nameEn },
      shortName: { ja: form.shortNameJa, en: form.shortNameEn },
      category: form.category,
      level: form.level,
      patch: form.patch,
      seriesId: form.seriesId,
      order: Number(form.order),
      fflogsEncounterId: form.fflogsEncounterId ? Number(form.fflogsEncounterId) : null,
      hasCheckpoint: false,
    };

    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/contents', {
        method: existing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ item }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }

      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">
        {existing ? t('admin.contents_edit') : t('admin.contents_add')}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-3 max-w-lg">
        {/* ID（新規時のみ編集可） */}
        <label className="block">
          <span className="text-xs text-app-text-muted">{t('admin.contents_id')}</span>
          <input
            type="text"
            value={form.id}
            onChange={e => updateField('id', e.target.value)}
            disabled={!!existing}
            required
            className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded disabled:opacity-50"
          />
        </label>

        {/* 名前 */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_name_ja')}</span>
            <input type="text" value={form.nameJa} onChange={e => updateField('nameJa', e.target.value)} required className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
          </label>
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_name_en')}</span>
            <input type="text" value={form.nameEn} onChange={e => updateField('nameEn', e.target.value)} required className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
          </label>
        </div>

        {/* 略称 */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_short_ja')}</span>
            <input type="text" value={form.shortNameJa} onChange={e => updateField('shortNameJa', e.target.value)} className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
          </label>
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_short_en')}</span>
            <input type="text" value={form.shortNameEn} onChange={e => updateField('shortNameEn', e.target.value)} className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
          </label>
        </div>

        {/* カテゴリ・レベル・パッチ */}
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_category')}</span>
            <select value={form.category} onChange={e => updateField('category', e.target.value)} className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_level')}</span>
            <select value={form.level} onChange={e => updateField('level', Number(e.target.value))} className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded">
              {LEVELS.map(l => <option key={l} value={l}>Lv{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_patch')}</span>
            <input type="text" value={form.patch} onChange={e => updateField('patch', e.target.value)} placeholder="7.40" className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
          </label>
        </div>

        {/* シリーズ・表示順・FFLogs ID */}
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_series')}</span>
            <input type="text" value={form.seriesId} onChange={e => updateField('seriesId', e.target.value)} list="series-list" className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
            <datalist id="series-list">
              {series.map(s => <option key={s.id} value={s.id}>{s.name?.ja}</option>)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_order')}</span>
            <input type="number" value={form.order} onChange={e => updateField('order', e.target.value)} min="0" step="0.1" className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
          </label>
          <label className="block">
            <span className="text-xs text-app-text-muted">{t('admin.contents_fflogs_id')}</span>
            <input type="number" value={form.fflogsEncounterId} onChange={e => updateField('fflogsEncounterId', e.target.value)} className="block w-full mt-1 px-2 py-1 text-sm bg-transparent border border-app-text/20 rounded" />
          </label>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-xs border border-app-text/20 rounded hover:bg-app-text/5 transition-colors disabled:opacity-50">
            {saving ? t('common.loading') : t('admin.save')}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-1.5 text-xs text-app-text-muted hover:underline">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: コミット**

```bash
git add src/components/admin/AdminContents.tsx src/components/admin/AdminContentForm.tsx
git commit -m "feat: コンテンツ管理UI（一覧・追加・編集・削除）を追加"
```

---

### Task 17: テンプレート管理UI

**Files:**
- Create: `src/components/admin/AdminTemplates.tsx`

- [ ] **Step 1: テンプレート一覧コンポーネント**

```typescript
// src/components/admin/AdminTemplates.tsx
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';

interface TemplateMeta {
  contentId: string;
  source: string;
  eventCount: number;
  phaseCount: number;
  lockedAt: any;
  lastUpdatedAt: any;
  lastUpdatedBy: string;
}

export function AdminTemplates() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const fileRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState('');

  async function fetchTemplates() {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates(data.templates || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTemplates(); }, []);

  async function handleUpload(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const contentId = uploadTarget || file.name.replace('.json', '');

      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contentId,
          timelineEvents: json.timelineEvents || [],
          phases: json.phases || [],
          source: 'admin_manual',
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      setUploadTarget('');
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(contentId: string) {
    if (!confirm(t('admin.templates_delete_confirm', { name: contentId }))) return;

    const token = await user?.getIdToken();
    const res = await fetch(`/api/admin/templates?id=${contentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await fetchTemplates();
  }

  if (loading) return <div className="text-sm animate-pulse">{t('common.loading')}</div>;
  if (error) return <div className="text-sm text-red-400">{t('admin.error_load')}: {error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">{t('admin.templates_title')}</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={uploadTarget}
            onChange={e => setUploadTarget(e.target.value)}
            placeholder="contentId"
            className="px-2 py-1 text-xs bg-transparent border border-app-text/20 rounded w-28"
          />
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1 text-xs border border-app-text/20 rounded hover:bg-app-text/5 transition-colors"
          >
            {t('admin.upload')}
          </button>
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-app-text-muted">{t('admin.no_data')}</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-app-text/10">
              <th className="py-2 text-left">contentId</th>
              <th className="py-2 text-left">{t('admin.templates_source')}</th>
              <th className="py-2 text-right">{t('admin.templates_events')}</th>
              <th className="py-2 text-right">{t('admin.templates_phases')}</th>
              <th className="py-2 text-left">{t('admin.templates_locked')}</th>
              <th className="py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {templates.map(tpl => (
              <tr key={tpl.contentId} className="border-b border-app-text/5 hover:bg-app-text/3">
                <td className="py-2 font-mono">{tpl.contentId}</td>
                <td className="py-2">{tpl.source}</td>
                <td className="py-2 text-right">{tpl.eventCount}</td>
                <td className="py-2 text-right">{tpl.phaseCount}</td>
                <td className="py-2">{tpl.lockedAt ? t('admin.templates_locked') : t('admin.templates_unlocked')}</td>
                <td className="py-2 text-right">
                  <button onClick={() => handleDelete(tpl.contentId)} className="hover:underline text-app-text-muted">
                    {t('admin.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/admin/AdminTemplates.tsx
git commit -m "feat: テンプレート管理UI（一覧・アップロード・削除）を追加"
```

---

### Task 18: 管理画面ルーティングとナビゲーション更新

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: AdminLayoutのナビ項目を追加**

`src/components/admin/AdminLayout.tsx` のNAV_ITEMSを更新:

```typescript
const NAV_ITEMS = [
  { path: '/admin', labelKey: 'admin.dashboard', end: true },
  { path: '/admin/contents', labelKey: 'admin.contents', end: false },
  { path: '/admin/templates', labelKey: 'admin.templates', end: false },
] as const;
```

- [ ] **Step 2: App.tsxにサブルートを追加**

```typescript
import { AdminContents } from './components/admin/AdminContents';
import { AdminTemplates } from './components/admin/AdminTemplates';

// /admin ルート内に追加:
<Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
  <Route index element={<AdminDashboard />} />
  <Route path="contents" element={<AdminContents />} />
  <Route path="templates" element={<AdminTemplates />} />
</Route>
```

- [ ] **Step 3: AdminDashboardに統計表示を追加**

```typescript
// src/components/admin/AdminDashboard.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';

export function AdminDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<{ contents: number; templates: number; version: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await user?.getIdToken();
        const [contentsRes, templatesRes] = await Promise.all([
          fetch('/api/admin/contents', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/templates', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const contentsData = await contentsRes.json();
        const templatesData = await templatesRes.json();
        setStats({
          contents: contentsData.items?.length || 0,
          templates: templatesData.templates?.length || 0,
          version: 0, // configから取得可能だが簡略化
        });
      } catch {
        // 統計表示は失敗してもダッシュボードは使える
      }
    }
    load();
  }, [user]);

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">{t('admin.dashboard')}</h1>
      {stats ? (
        <div className="grid grid-cols-3 gap-4 max-w-md">
          <div className="border border-app-text/10 rounded p-3">
            <div className="text-2xl font-bold">{stats.contents}</div>
            <div className="text-xs text-app-text-muted">{t('admin.stats_contents')}</div>
          </div>
          <div className="border border-app-text/10 rounded p-3">
            <div className="text-2xl font-bold">{stats.templates}</div>
            <div className="text-xs text-app-text-muted">{t('admin.stats_templates')}</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-app-text-muted animate-pulse">{t('common.loading')}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

- [ ] **Step 5: コミット**

```bash
git add src/App.tsx src/components/admin/AdminLayout.tsx src/components/admin/AdminDashboard.tsx
git commit -m "feat: 管理画面にコンテンツ・テンプレート管理のルーティングを追加"
```

---

### Task 19: Vercel APIルーティング更新

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: admin APIのルーティングを確認**

`vercel.json` の既存rewritesに `api/*` → `api/$1` があるか確認。Vercelの規約でファイルベースルーティングが使われるので、`api/admin/contents/index.ts` は自動で `/api/admin/contents` にマップされる。追加設定は不要の可能性が高い。

変更が必要な場合のみ修正する。

- [ ] **Step 2: コミット（変更がある場合のみ）**

---

### Task 20: 最終ビルド確認とデプロイ

- [ ] **Step 1: 全体ビルド**

```bash
npm run build
```

エラーがないことを確認。

- [ ] **Step 2: ローカル動作確認**

```bash
npm run dev
```

- アプリが正常に起動するか
- コンソールにApp Check関連の警告が出るか（siteKey未設定で正常）
- Firestoreにシーディング済みデータがある場合、コンテンツ一覧が正しく表示されるか
- `/admin/contents` と `/admin/templates` が表示されるか

- [ ] **Step 3: コミット**

最終的な修正があればコミット。

---

## 実装順序のまとめ

| Part | タスク | 依存 | 並列可 |
|------|--------|------|--------|
| A | Task 1-5: App Check | なし | Task 1-3は並列可 |
| B | Task 6: Firestoreルール | なし | Aと並列可 |
| C | Task 7-9: キャッシュ基盤 | なし | A・Bと並列可 |
| D | Task 10: シーディング | B（ルール必要） | C完了後 |
| E | Task 11-12: データソース切替 | C | D完了後 |
| F | Task 13-14: 管理API | B | Eと並列可 |
| G | Task 15-19: 管理画面UI | F | 順次 |
| - | Task 20: 最終確認 | 全完了 | - |
