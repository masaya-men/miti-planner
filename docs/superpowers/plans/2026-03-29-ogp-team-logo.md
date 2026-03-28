# OGP チームロゴ機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログインユーザーがチームロゴをアップロードし、共有時の OGP 画像にそのロゴを合成表示する機能を実装する。

**Architecture:** フロントエンドで Canvas API によるリサイズ・WebP変換を行い Firebase Storage にアップロード。Firestore の users ドキュメントに logoUrl を保存。共有モーダルにロゴトグル + アップロード UI を追加。OGP 生成 API（既存の api/og/index.ts）に logoUrl パラメータを追加し、Satori で合成。

**Tech Stack:** React 19 + TypeScript + Firebase Storage + Firestore + Satori (Vercel Edge) + Canvas API

**制約:**
- Vercel 関数 12/12（新規 API ファイル追加不可 → 既存 api/og/index.ts に統合）
- 色は白黒のみ（CLAUDE.md ルール）
- i18n 必須

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| 修正 | `storage.rules` | users/{uid}/ パスのセキュリティルール追加 |
| 修正 | `src/types/firebase.ts` | FirestoreUser に teamLogoUrl フィールド追加 |
| 作成 | `src/utils/logoUpload.ts` | Canvas リサイズ + Storage アップロード + Firestore 保存 |
| 修正 | `src/store/useAuthStore.ts` | ログイン時にロゴURL読み込み、状態管理 |
| 修正 | `src/locales/ja.json` | ロゴ関連 i18n キー追加 |
| 修正 | `src/locales/en.json` | 同上（英語） |
| 修正 | `src/components/ShareModal.tsx` | ロゴトグル + アップロード/削除 UI + OGP URL にロゴパラメータ付与 |
| 修正 | `api/og/index.ts` | logoUrl クエリ受付 + ロゴ画像の合成 |

---

### Task 1: i18n キー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: ja.json に team_logo セクションを追加**

```json
"team_logo": {
    "title": "チームロゴ",
    "upload": "ロゴをアップロード",
    "change": "ロゴを変更",
    "remove": "ロゴを削除",
    "show_on_ogp": "共有画像にロゴを表示",
    "uploading": "アップロード中...",
    "format_hint": "PNG / JPG / WebP（最大2MB）",
    "upload_success": "ロゴをアップロードしました",
    "remove_success": "ロゴを削除しました",
    "error_too_large": "ファイルサイズが大きすぎます（最大2MB）",
    "error_invalid_type": "対応していないファイル形式です",
    "error_upload_failed": "アップロードに失敗しました"
}
```

- [ ] **Step 2: en.json に同様のキーを追加**

```json
"team_logo": {
    "title": "Team Logo",
    "upload": "Upload Logo",
    "change": "Change Logo",
    "remove": "Remove Logo",
    "show_on_ogp": "Show logo on shared image",
    "uploading": "Uploading...",
    "format_hint": "PNG / JPG / WebP (max 2MB)",
    "upload_success": "Logo uploaded",
    "remove_success": "Logo removed",
    "error_too_large": "File is too large (max 2MB)",
    "error_invalid_type": "Unsupported file format",
    "error_upload_failed": "Upload failed"
}
```

- [ ] **Step 3: コミット**

---

### Task 2: Storage ルール + 型定義

**Files:**
- Modify: `storage.rules`
- Modify: `src/types/firebase.ts`

- [ ] **Step 1: storage.rules に users パスのルールを追加**

`match /icons/{allPaths=**}` の後に追加:

```
    // ユーザーのチームロゴ: 本人のみ読み書き可能
    match /users/{userId}/team-logo.webp {
      allow read: if true;  // OGP生成API等から読み取り可能
      allow write: if request.auth != null
                      && request.auth.uid == userId
                      && request.resource.size < 2 * 1024 * 1024
                      && request.resource.contentType.matches('image/.*');
    }
```

- [ ] **Step 2: FirestoreUser に teamLogoUrl を追加**

`src/types/firebase.ts` の `FirestoreUser` インターフェースに追加:

```typescript
teamLogoUrl?: string | null;  // Firebase Storage のダウンロードURL
```

- [ ] **Step 3: コミット**

---

### Task 3: ロゴアップロードユーティリティ

**Files:**
- Create: `src/utils/logoUpload.ts`

- [ ] **Step 1: Canvas リサイズ + Storage アップロード関数を作成**

```typescript
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const LOGO_SIZE = 400; // 400x400px
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Canvas APIで画像をリサイズしてWebPに変換
async function resizeToWebP(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = LOGO_SIZE;
            canvas.height = LOGO_SIZE;
            const ctx = canvas.getContext('2d')!;

            // アスペクト比を維持して中央にフィット
            const scale = Math.max(LOGO_SIZE / img.width, LOGO_SIZE / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (LOGO_SIZE - w) / 2;
            const y = (LOGO_SIZE - h) / 2;

            ctx.drawImage(img, x, y, w, h);
            canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
                'image/webp',
                0.85
            );
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = URL.createObjectURL(file);
    });
}

// バリデーション
export function validateLogoFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return 'error_invalid_type';
    if (file.size > MAX_SIZE) return 'error_too_large';
    return null;
}

// アップロード
export async function uploadTeamLogo(userId: string, file: File): Promise<string> {
    const blob = await resizeToWebP(file);
    const storageRef = ref(storage, `users/${userId}/team-logo.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    const url = await getDownloadURL(storageRef);

    // Firestore に URL を保存
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { teamLogoUrl: url });

    return url;
}

// 削除
export async function deleteTeamLogo(userId: string): Promise<void> {
    const storageRef = ref(storage, `users/${userId}/team-logo.webp`);
    try {
        await deleteObject(storageRef);
    } catch {
        // ファイルが存在しない場合は無視
    }
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { teamLogoUrl: null });
}
```

- [ ] **Step 2: コミット**

---

### Task 4: 認証ストアにロゴURL管理を追加

**Files:**
- Modify: `src/store/useAuthStore.ts`

- [ ] **Step 1: AuthState に teamLogoUrl を追加**

```typescript
interface AuthState {
    // ... 既存フィールド
    teamLogoUrl: string | null;
    setTeamLogoUrl: (url: string | null) => void;
}
```

- [ ] **Step 2: onAuthStateChanged でロゴURL を読み込み**

ログイン検知時に Firestore users/{uid} から teamLogoUrl を読み取り、ストアに保存。

- [ ] **Step 3: ログアウト時にクリア**

signOut() 内で `teamLogoUrl: null` にリセット。

- [ ] **Step 4: コミット**

---

### Task 5: ShareModal にロゴ UI を追加

**Files:**
- Modify: `src/components/ShareModal.tsx`

- [ ] **Step 1: ロゴトグル + アップロードボタンを追加**

ShareModal 内の「プラン名表示トグル」の近くに:
- チェックボックス: 「共有画像にロゴを表示」（teamLogoUrl がある場合のみ表示）
- アップロードボタン: ロゴがない場合は「ロゴをアップロード」、ある場合は「変更」「削除」
- hidden file input + ラベルパターン

- [ ] **Step 2: OGP URL に logoUrl パラメータを付与**

既存の OGP URL 生成ロジック（`/api/og?id={shareId}&showTitle={boolean}`）に、ロゴ表示 ON かつ teamLogoUrl がある場合:
```
/api/og?id={shareId}&showTitle={boolean}&logoUrl={encodeURIComponent(teamLogoUrl)}
```

- [ ] **Step 3: アップロードフロー実装**

ファイル選択 → validateLogoFile → uploadTeamLogo → ストア更新 → OGP プレビュー更新

- [ ] **Step 4: コミット**

---

### Task 6: OGP 生成 API にロゴ合成を追加

**Files:**
- Modify: `api/og/index.ts`

- [ ] **Step 1: logoUrl クエリパラメータ受付**

```typescript
const logoUrl = url.searchParams.get('logoUrl');
```

- [ ] **Step 2: ロゴ画像の取得と Base64 変換**

logoUrl がある場合、fetch して arrayBuffer → base64 data URI に変換（Satori は img src に data URI を使用）。

```typescript
let logoBase64: string | null = null;
if (logoUrl) {
    try {
        const res = await fetch(logoUrl);
        if (res.ok) {
            const buf = await res.arrayBuffer();
            const contentType = res.headers.get('content-type') || 'image/webp';
            logoBase64 = `data:${contentType};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
        }
    } catch { /* ロゴ取得失敗時はスキップ */ }
}
```

- [ ] **Step 3: Satori レイアウトにロゴを追加**

既存レイアウトの左上（または右上）にロゴを配置:

```tsx
{logoBase64 && (
    <img
        src={logoBase64}
        width={80}
        height={80}
        style={{
            position: 'absolute',
            top: 24,
            right: 24,
            borderRadius: 12,
        }}
    />
)}
```

- [ ] **Step 4: ビルド確認 + コミット**

---

### Task 7: 統合テスト + クリーンアップ

- [ ] **Step 1: 全フロー通し確認**

1. ログイン → ShareModal → ロゴアップロード → プレビューにロゴ表示
2. ロゴトグル OFF → プレビューからロゴ消滅
3. ロゴ変更 → プレビュー更新
4. ロゴ削除 → アップロードボタンに戻る
5. 未ログイン → ロゴ関連 UI 非表示
6. 英語モード確認

- [ ] **Step 2: ビルド + デプロイ確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**
