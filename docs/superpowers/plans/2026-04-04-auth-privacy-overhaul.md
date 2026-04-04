# 認証プライバシー改善 + ユーザープロフィール設定UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OAuthで取得される個人情報（displayName, avatar等）を一切使用・保存せず、ユーザー自身が名前・アイコンを設定する方式に変更する。Googleログインを廃止しFirebase Authにメアドが残らないようにする。

**Architecture:** Discord/Twitter OAuthハンドラーでIDのみ取り出し他を即破棄。初回ログイン時にウェルカム画面でユーザー名を設定。アバターはreact-easy-cropで丸枠クロップ→Canvas APIで128x128 WebP変換→Firebase Storageにアップロード。既存のuser.displayName/user.photoURL参照を全てFirestore users/{uid}のカスタムフィールドに切り替え。

**Tech Stack:** React, Firebase Auth (Custom Token), Firestore, Firebase Storage, react-easy-crop, Canvas API

---

## ファイル構成

### 新規作成
| ファイル | 責務 |
|---------|------|
| `src/components/WelcomeSetup.tsx` | 初回ログイン時のユーザー名入力 + アバター設定案内画面 |
| `src/components/AvatarCropModal.tsx` | 画像選択→丸枠クロップ→プレビューのモーダル |
| `src/utils/avatarUpload.ts` | アバター画像のリサイズ・WebP変換・Storageアップロード |

### 主要変更
| ファイル | 変更内容 |
|---------|---------|
| `api/auth/_discordHandler.ts` | displayName/avatarUrl をクライアントに送らない。idのみ使用 |
| `api/auth/_twitterHandler.ts` | 同上 |
| `src/store/useAuthStore.ts` | Googleログイン削除、processPendingAuth変更、Firestoreからプロフィール取得、初回判定 |
| `src/components/LoginModal.tsx` | Googleボタン削除、ログイン済み画面にアバター・名前変更UI追加 |
| `src/components/ConsolidatedHeader.tsx` | user.photoURL → Firestoreのカスタムavatarを参照 |
| `src/components/MobileBottomNav.tsx` | 同上 |
| `src/components/Layout.tsx` | WelcomeSetup表示ロジック追加 |
| `src/lib/planService.ts` | ownerDisplayName をFirestoreプロフィールから取得 |
| `src/utils/logoUpload.ts` | provider判定からgoogle削除 |
| `src/types/firebase.ts` | FirestoreUser型にavatarUrl追加確認、provider型変更 |
| `firestore.rules` | users/{uid}のprovider許可値からgoogle削除、avatarUrl許可 |
| `storage.rules` | avatar用のパス追加 |
| `src/locales/ja.json` | ウェルカム画面・プライバシーポリシー更新 |
| `src/locales/en.json` | 同上 |

---

## Task 1: OAuthハンドラーからの個人情報除去

**Files:**
- Modify: `api/auth/_discordHandler.ts:136-186`
- Modify: `api/auth/_twitterHandler.ts:163-215`

- [ ] **Step 1: Discord handler — idのみ取得に変更**

`api/auth/_discordHandler.ts` の callback 処理を変更。
`/users/@me` のレスポンスから `id` だけを取り出し、displayName/avatarUrl をクライアントに送らない。

```typescript
// 行144: 変更前
// const discordUser = await userRes.json();
// 変更後: id のみ取り出し、他は破棄
const { id: discordUserId } = await userRes.json();

// 行147-154: firebaseUid 生成（変更なし）
const firebaseUid = `discord:${discordUserId}`;
const customToken = await getAuth().createCustomToken(firebaseUid, {
    provider: 'discord',
});
// ↑ discordId, avatar を Custom Claims から削除

// 行169-174: localStorage に書き込む内容を最小化
// 変更前: token, displayName, photoURL
// 変更後: token のみ
localStorage.setItem('lopo_auth_pending', JSON.stringify({
    provider: 'discord',
    token: ${JSON.stringify(customToken)}
}));
```

- [ ] **Step 2: Twitter handler — idのみ取得に変更**

`api/auth/_twitterHandler.ts` の callback 処理を変更。
`/2/users/me` の user.fields パラメータを削除し、返却データから id のみ使用。

```typescript
// 行169: user.fields パラメータを削除
const userRes = await fetch(TWITTER_USER_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
});

// 行174-177: id のみ取得
const { data } = await userRes.json();
const twitterUserId = data.id;
// displayName, photoURL は取得しない

// 行198-202: localStorage に書き込む内容を最小化
localStorage.setItem('lopo_auth_pending', JSON.stringify({
    provider: 'twitter',
    token: ${JSON.stringify(customToken)}
}));
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add api/auth/_discordHandler.ts api/auth/_twitterHandler.ts
git commit -m "security: OAuthハンドラーからdisplayName/avatar除去 — idのみ使用"
```

---

## Task 2: Googleログイン削除 + useAuthStore改修

**Files:**
- Modify: `src/store/useAuthStore.ts:63-130, 247-320`
- Modify: `src/components/LoginModal.tsx:17-52, 77-79`
- Modify: `src/types/firebase.ts:16-31`
- Modify: `firestore.rules:29-44`

- [ ] **Step 1: useAuthStore — Googleログインケース削除**

`src/store/useAuthStore.ts` の `signInWith` メソッドから `case 'google'` ブロック（行65-91）を削除。
型を `AuthProvider = 'discord' | 'twitter'` に変更。

- [ ] **Step 2: useAuthStore — processPendingAuth変更**

displayName/photoURL をFirebase Auth profileに書き込まないようにする。

```typescript
async function processPendingAuth() {
    const pendingRaw = localStorage.getItem('lopo_auth_pending');
    if (!pendingRaw) {
        localStorage.removeItem('lopo_auth_redirecting');
        return;
    }

    localStorage.removeItem('lopo_auth_pending');
    try {
        const pending = JSON.parse(pendingRaw);
        await signInWithCustomToken(auth, pending.token);
        // displayName/photoURL の updateProfile は行わない
        localStorage.removeItem('lopo_auth_redirecting');
    } catch (err) {
        console.error('Auth restore error:', err);
        localStorage.removeItem('lopo_auth_redirecting');
    }
}
```

- [ ] **Step 3: useAuthStore — PWA Google redirect削除**

`getRedirectResult(auth)` 呼び出し（行308-320）を削除。Google関連のimport（`GoogleAuthProvider`, `signInWithPopup`, `signInWithRedirect`, `getRedirectResult`）も削除。

- [ ] **Step 4: useAuthStore — Firestoreからプロフィール取得**

`onAuthStateChanged` 内で `users/{uid}` からdisplayName, avatarUrlを取得し、ストアに保存する。

```typescript
// AuthState に追加
interface AuthState {
    // ... 既存
    profileDisplayName: string | null;  // Firestoreの表示名
    profileAvatarUrl: string | null;    // Firestoreのアバター
    isNewUser: boolean;                 // 初回ログイン判定
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = tokenResult.claims.role === 'admin';
        useAuthStore.setState({ user, loading: false, isAdmin });

        // Firestoreからプロフィール読み込み
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            useAuthStore.setState({
                profileDisplayName: data.displayName || null,
                profileAvatarUrl: data.avatarUrl || null,
                teamLogoUrl: data.teamLogoUrl || null,
                isNewUser: false,
            });
        } else {
            // Firestoreにドキュメントがない = 初回ログイン
            useAuthStore.setState({ isNewUser: true });
        }
    } else {
        useAuthStore.setState({
            user: null, loading: false, isAdmin: false,
            profileDisplayName: null, profileAvatarUrl: null,
            teamLogoUrl: null, isNewUser: false,
        });
    }
});
```

- [ ] **Step 5: LoginModal — Googleボタン削除**

`src/components/LoginModal.tsx` の providers 配列（行29-41）から Google エントリーを削除。
`handleSignIn` の型を `'discord' | 'twitter'` に変更。

- [ ] **Step 6: FirestoreUser型 — provider更新**

`src/types/firebase.ts` の `FirestoreUser.provider` 型から `'google'` を削除。

```typescript
provider: 'discord' | 'twitter';
```

- [ ] **Step 7: firestore.rules — provider許可値更新**

```
// 行37: google を削除
&& request.resource.data.provider in ['discord', 'twitter'];
```

- [ ] **Step 8: logoUpload.ts — provider判定更新**

`src/utils/logoUpload.ts` 行79-81 の provider 判定から google を削除。

- [ ] **Step 9: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 10: コミット**

```bash
git add src/store/useAuthStore.ts src/components/LoginModal.tsx src/types/firebase.ts firestore.rules src/utils/logoUpload.ts
git commit -m "security: Googleログイン廃止、Firestoreベースのプロフィール管理に切替"
```

---

## Task 3: アバターアップロードユーティリティ

**Files:**
- Create: `src/utils/avatarUpload.ts`
- Modify: `storage.rules`

- [ ] **Step 1: storage.rules にアバターパス追加**

```
// users/{userId}/avatar.webp を許可
match /users/{userId}/{file} {
    allow read: if true;
    allow delete: if request.auth != null && request.auth.uid == userId;
    allow create, update: if request.auth != null
                    && request.auth.uid == userId
                    && file.matches('(team-logo\\.(jpg|webp)|avatar\\.webp)')
                    && request.resource.size < 2 * 1024 * 1024
                    && request.resource.contentType.matches('image/.*');
}
```

- [ ] **Step 2: avatarUpload.ts 作成**

```typescript
/**
 * アバター画像のクロップ・リサイズ・WebP変換・Storageアップロード
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { storage, db, auth } from '../lib/firebase';
import { COLLECTIONS } from '../types/firebase';

/** アップロード前の元ファイル最大サイズ（50MB — ブラウザ処理なのでサーバーに影響なし） */
const MAX_ORIGINAL_SIZE = 50 * 1024 * 1024;
/** リサイズ後のアバターサイズ（正方形、px） */
const AVATAR_SIZE = 128;
/** 受け付ける画像MIME Type */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * 元ファイルのバリデーション
 * エラー時はi18nキーを返す
 */
export function validateAvatarFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return 'avatar.error_invalid_type';
    if (file.size > MAX_ORIGINAL_SIZE) return 'avatar.error_too_large';
    return null;
}

/**
 * クロップ済み画像データを128x128 WebPに変換
 * @param imageSrc クロップ後の画像（data URL or blob URL）
 * @param cropArea { x, y, width, height } ピクセル座標
 */
export async function cropAndResize(
    imageSrc: string,
    cropArea: { x: number; y: number; width: number; height: number },
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = AVATAR_SIZE;
            canvas.height = AVATAR_SIZE;
            const ctx = canvas.getContext('2d')!;

            ctx.drawImage(
                img,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, AVATAR_SIZE, AVATAR_SIZE,
            );

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(img.src);
                    blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'));
                },
                'image/webp',
                0.85,
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Image load failed'));
        };
        img.src = imageSrc;
    });
}

/**
 * アバターをFirebase Storageにアップロードし、FirestoreにURLを保存
 */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
    const storageRef = ref(storage, `users/${userId}/avatar.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    const url = await getDownloadURL(storageRef);

    // Firestoreに保存
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        await updateDoc(userRef, { avatarUrl: url, updatedAt: new Date().toISOString() });
    }
    // ドキュメント未作成の場合はWelcomeSetupで作成するので、ここでは更新のみ

    return url;
}

/**
 * アバターを削除
 */
export async function deleteAvatar(userId: string): Promise<void> {
    try {
        await deleteObject(ref(storage, `users/${userId}/avatar.webp`));
    } catch {
        // ファイルが存在しない場合は無視
    }
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        await updateDoc(userRef, { avatarUrl: null, updatedAt: new Date().toISOString() });
    }
}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/utils/avatarUpload.ts storage.rules
git commit -m "feat: アバターアップロードユーティリティ追加（128px WebP変換）"
```

---

## Task 4: アバタークロップモーダル

**Files:**
- Create: `src/components/AvatarCropModal.tsx`
- Install: `react-easy-crop`

- [ ] **Step 1: react-easy-crop インストール**

Run: `npm install react-easy-crop`

- [ ] **Step 2: AvatarCropModal.tsx 作成**

Discord風の丸枠クロップUI。ピンチ・ドラッグ対応。

```typescript
import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react';
import clsx from 'clsx';
import { cropAndResize, validateAvatarFile } from '../utils/avatarUpload';

interface AvatarCropModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (blob: Blob) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
    isOpen, onClose, onComplete,
}) => {
    const { t } = useTranslation();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedArea, setCroppedArea] = useState<Area | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedArea(croppedAreaPixels);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateAvatarFile(file);
        if (validationError) {
            setError(t(validationError));
            return;
        }

        setError(null);
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleConfirm = async () => {
        if (!imageSrc || !croppedArea) return;
        const blob = await cropAndResize(imageSrc, croppedArea);
        URL.revokeObjectURL(imageSrc);
        onComplete(blob);
        handleReset();
    };

    const handleReset = () => {
        if (imageSrc) URL.revokeObjectURL(imageSrc);
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedArea(null);
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={handleReset} />
            <div className="relative w-[380px] max-w-[90vw] rounded-2xl glass-tier3 overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <h2 className="text-app-xl font-bold text-app-text">
                        {t('avatar.crop_title')}
                    </h2>
                    <button onClick={handleReset}
                        className="p-1.5 rounded-lg text-app-text hover:bg-app-text hover:text-app-bg transition-all cursor-pointer">
                        <X size={16} />
                    </button>
                </div>

                {!imageSrc ? (
                    /* ファイル選択 */
                    <div className="px-6 pb-6">
                        <label className={clsx(
                            "flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed cursor-pointer",
                            "border-app-border hover:border-app-text/30 transition-colors"
                        )}>
                            <span className="text-app-md text-app-text-muted">
                                {t('avatar.select_image')}
                            </span>
                            <span className="text-app-base text-app-text-muted/50">
                                {t('avatar.max_size')}
                            </span>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </label>
                        {error && (
                            <p className="mt-2 text-app-base text-red-400">{error}</p>
                        )}
                    </div>
                ) : (
                    /* クロップ画面 */
                    <>
                        <div className="relative w-full aspect-square bg-black">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>
                        {/* ズームスライダー */}
                        <div className="px-6 py-3">
                            <input
                                type="range"
                                min={1} max={3} step={0.01}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full accent-app-text"
                            />
                        </div>
                        {/* 確定ボタン */}
                        <div className="px-6 pb-5">
                            <button
                                onClick={handleConfirm}
                                className={clsx(
                                    "w-full py-2.5 rounded-xl text-app-lg font-bold flex items-center justify-center gap-2 cursor-pointer",
                                    "bg-app-text text-app-bg hover:opacity-90 transition-all active:scale-[0.98]"
                                )}
                            >
                                <Check size={16} />
                                {t('avatar.confirm')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/AvatarCropModal.tsx package.json package-lock.json
git commit -m "feat: アバタークロップモーダル追加（react-easy-crop、丸枠UI）"
```

---

## Task 5: 初回ログイン ウェルカム画面

**Files:**
- Create: `src/components/WelcomeSetup.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: WelcomeSetup.tsx 作成**

初回ログイン時にユーザー名入力 + アバター設定案内を表示する全画面モーダル。

```typescript
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import clsx from 'clsx';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../types/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { AvatarCropModal } from './AvatarCropModal';
import { uploadAvatar } from '../utils/avatarUpload';

interface WelcomeSetupProps {
    onComplete: () => void;
}

export const WelcomeSetup: React.FC<WelcomeSetupProps> = ({ onComplete }) => {
    const { t } = useTranslation();
    const user = useAuthStore(s => s.user);
    const [displayName, setDisplayName] = useState('');
    const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [saving, setSaving] = useState(false);

    if (!user) return null;

    const initial = displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : '?';

    const handleAvatarComplete = (blob: Blob) => {
        setAvatarBlob(blob);
        setAvatarPreview(URL.createObjectURL(blob));
        setShowCropModal(false);
    };

    const handleSubmit = async () => {
        const name = displayName.trim();
        if (!name || name.length > 30) return;

        setSaving(true);
        try {
            // アバターアップロード（設定した場合のみ）
            let avatarUrl: string | null = null;
            if (avatarBlob) {
                avatarUrl = await uploadAvatar(user.uid, avatarBlob);
            }

            // Firestoreにユーザードキュメント作成
            const provider = user.uid.startsWith('discord:') ? 'discord' : 'twitter';
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                displayName: name,
                avatarUrl,
                provider,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                settings: {},
            });

            // ストア更新
            useAuthStore.setState({
                profileDisplayName: name,
                profileAvatarUrl: avatarUrl,
                isNewUser: false,
            });

            onComplete();
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-app-bg/95">
            <div className="w-[380px] max-w-[90vw] px-6">
                <h1
                    className="text-app-4xl text-app-text text-center mb-2"
                    style={{ fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif", fontWeight: 700 }}
                >
                    {t('welcome.title')}
                </h1>
                <p className="text-app-md text-app-text-muted text-center mb-8">
                    {t('welcome.subtitle')}
                </p>

                {/* アバター */}
                <div className="flex justify-center mb-6">
                    <button
                        onClick={() => setShowCropModal(true)}
                        className="relative w-20 h-20 rounded-full overflow-hidden cursor-pointer group"
                    >
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-app-text/10 flex items-center justify-center">
                                <span className="text-3xl font-bold text-app-text/60">{initial}</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera size={20} className="text-white" />
                        </div>
                    </button>
                </div>

                {/* ユーザー名入力 */}
                <label className="block mb-1 text-app-base text-app-text-muted">
                    {t('welcome.name_label')}
                </label>
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                    placeholder={t('welcome.name_placeholder')}
                    className={clsx(
                        "w-full px-4 py-3 rounded-xl text-app-xl text-app-text bg-transparent",
                        "border border-app-border focus:border-app-text/50 outline-none transition-colors"
                    )}
                    autoFocus
                />
                <p className="mt-1 text-app-base text-app-text-muted/50 text-right">
                    {displayName.length}/30
                </p>

                {/* 確定ボタン */}
                <button
                    onClick={handleSubmit}
                    disabled={!displayName.trim() || saving}
                    className={clsx(
                        "w-full mt-4 py-3 rounded-xl text-app-xl font-bold cursor-pointer transition-all active:scale-[0.98]",
                        displayName.trim()
                            ? "bg-app-text text-app-bg hover:opacity-90"
                            : "bg-app-text/10 text-app-text/30 cursor-not-allowed"
                    )}
                >
                    {saving ? '...' : t('welcome.start')}
                </button>

                <p className="mt-4 text-app-base text-app-text-muted/50 text-center">
                    {t('welcome.avatar_hint')}
                </p>
            </div>

            <AvatarCropModal
                isOpen={showCropModal}
                onClose={() => setShowCropModal(false)}
                onComplete={handleAvatarComplete}
            />
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: Layout.tsx にウェルカム表示ロジック追加**

`src/components/Layout.tsx` で `isNewUser` を監視し、WelcomeSetup を表示。

```typescript
// Layout.tsx 内の return の直前に追加
const isNewUser = useAuthStore(s => s.isNewUser);

// JSX 内に追加（他のモーダルと同じ階層）
{isNewUser && <WelcomeSetup onComplete={() => useAuthStore.setState({ isNewUser: false })} />}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/WelcomeSetup.tsx src/components/Layout.tsx
git commit -m "feat: 初回ログイン時のウェルカム画面（ユーザー名設定 + アバター設定案内）"
```

---

## Task 6: 既存UIのプロフィール参照先切替

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx:233-248`
- Modify: `src/components/MobileBottomNav.tsx:55-64`
- Modify: `src/components/LoginModal.tsx:106-135`
- Modify: `src/lib/planService.ts` (ownerDisplayName)
- Modify: `src/components/SyncButton.tsx` (displayName)
- Modify: `src/components/Layout.tsx` (sync呼び出し)
- Modify: `src/components/BackupExportModal.tsx`
- Modify: `src/components/BackupRestoreModal.tsx`

- [ ] **Step 1: ConsolidatedHeader — Firestoreプロフィール参照**

`user.photoURL` → `profileAvatarUrl`、`user.displayName` → `profileDisplayName` に切替。

```typescript
// ConsolidatedHeader.tsx 内
const profileDisplayName = useAuthStore(s => s.profileDisplayName);
const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);

// 行233: Tooltip
<Tooltip content={user ? (profileDisplayName || 'Account') : t('app.sign_in') || 'Sign In'}>
// 行238: アバター画像
{profileAvatarUrl ? (
    <img src={profileAvatarUrl} alt="" className="w-6 h-6 rounded-full" />
) : user ? (
    <div className="w-6 h-6 rounded-full bg-app-text/15 flex items-center justify-center">
        <span className="text-app-base font-black text-app-text">
            {(profileDisplayName || 'U').charAt(0).toUpperCase()}
        </span>
    </div>
) : (
    <LogIn size={16} />
)}
```

- [ ] **Step 2: MobileBottomNav — 同様に切替**

```typescript
const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);

// アイコン表示部分
icon: profileAvatarUrl ? (
    <img src={profileAvatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
) : (
    <LogIn size={20} />
),
```

- [ ] **Step 3: LoginModal — ログイン済み画面の切替**

```typescript
const profileDisplayName = useAuthStore(s => s.profileDisplayName);
const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);

// ヘッダータイトル
{user ? (profileDisplayName || 'Account') : t('login.title')}

// アバター表示
{profileAvatarUrl ? (
    <img src={profileAvatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0" />
) : (
    <div className="w-10 h-10 rounded-full bg-app-text/15 flex items-center justify-center shrink-0">
        <span className="text-app-xl font-bold text-app-text">
            {(profileDisplayName || 'U').charAt(0).toUpperCase()}
        </span>
    </div>
)}

// 名前表示
<div className="text-app-xl font-bold text-app-text truncate">
    {profileDisplayName || 'User'}
</div>
```

- [ ] **Step 4: LoginModal — アバター・名前変更ボタン追加**

ログイン済みセクションにアバター変更と名前変更のリンクを追加。
（アバタークロップモーダルを再利用）

- [ ] **Step 5: planService / SyncButton / Layout / Backup — displayName切替**

Firestore同期時に `user.displayName` の代わりに `useAuthStore.getState().profileDisplayName` を使用。

全ファイルで `user.displayName || 'Guest'` → `useAuthStore.getState().profileDisplayName || 'User'` に統一。

対象箇所:
- `src/components/Layout.tsx` 行146, 153, 309
- `src/components/SyncButton.tsx` 行31
- `src/components/BackupExportModal.tsx`
- `src/components/BackupRestoreModal.tsx`
- `src/store/useAuthStore.ts` 行148 (signOut内のforceSyncAll)

- [ ] **Step 6: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/ConsolidatedHeader.tsx src/components/MobileBottomNav.tsx src/components/LoginModal.tsx src/lib/planService.ts src/components/SyncButton.tsx src/components/Layout.tsx src/components/BackupExportModal.tsx src/components/BackupRestoreModal.tsx src/store/useAuthStore.ts
git commit -m "refactor: 全UIのプロフィール参照をFirebaseAuth→Firestoreに切替"
```

---

## Task 7: i18n キー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: ja.json にウェルカム・アバター・プライバシーキー追加**

```json
"welcome": {
    "title": "ようこそ LoPo へ",
    "subtitle": "あなたの名前を決めてください",
    "name_label": "表示名",
    "name_placeholder": "好きな名前を入力",
    "start": "はじめる",
    "avatar_hint": "アイコンはあとからでも設定できます"
},
"avatar": {
    "crop_title": "アイコンを設定",
    "select_image": "画像を選んでタップ",
    "max_size": "PNG / JPEG / WebP（50MBまで）",
    "confirm": "この画像にする",
    "change": "アイコンを変更",
    "error_invalid_type": "PNG・JPEG・WebP画像のみ対応しています",
    "error_too_large": "50MB以下の画像を選んでください"
}
```

- [ ] **Step 2: プライバシーポリシー更新（ja.json）**

以下のキーを更新:

```json
"privacy_section1_auth_items": "あなたが自分で設定した表示名,あなたが自分でアップロードしたアイコン画像,ログイン方法の種類（Discord・Xのいずれか）"
```

```json
"privacy_message": "ログインにはDiscordまたはXアカウントを使用します。メールアドレスなどの個人情報はサーバーに保存されません。"
```

セクション1の後ろ、セクション2の前に新セクションを追加:

```json
"privacy_section1b_title": "ログイン時に外部サービスから受け取る情報について",
"privacy_section1b_body": "DiscordやXでログインする際、認証の仕組み上、外部サービスのAPIからあなたのアカウント情報（ユーザーID・表示名・アイコン画像URLなど）がサーバーに一時的に届きます。しかし、本サービスではユーザーIDのみを取り出し、それ以外の情報は一切保存・記録せず即座に破棄します。表示名やアイコンは、あなたが自分で設定したものだけを使用します。"
```

セクション2を更新:
```json
"privacy_section2_items": "メールアドレス（外部サービスでのログイン時にもサーバーには届きません）,本名・住所・電話番号などの個人情報,お支払い情報（支援はKo-fiというサービスを通じて行われ、本サービスが決済情報を扱うことはありません）,ゲーム内のキャラクター名やプレイデータ,外部サービス（Discord・X）の表示名やアイコン画像（APIから届いても即座に破棄します）"
```

- [ ] **Step 3: en.json に同様のキー追加**

（日本語版と同じ構造で英語翻訳を追加）

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "i18n: ウェルカム画面・アバター・プライバシーポリシー更新キー追加"
```

---

## Task 8: 管理者UID移行

**Files:**
- Modify: `api/admin/_roleHandler.ts`
- 手動操作: Firebase Console

- [ ] **Step 1: 管理者にDiscordでログインしてもらい新UIDを確認**

ブラウザのDevToolsコンソールで:
```javascript
firebase.auth().currentUser.uid
```
または LoginModal内で表示されるUIDを確認。

- [ ] **Step 2: 新UIDにadmin Claimsを付与**

Firebase Admin SDKで:
```typescript
await getAuth().setCustomUserClaims('discord:XXXXX', { role: 'admin' });
```
既存のAPIエンドポイント `/api/admin?action=setRole` を使用可能。

- [ ] **Step 3: 旧Google UIDのadmin Claims削除**

```typescript
await getAuth().setCustomUserClaims('（旧管理者UID）', {});
```

- [ ] **Step 4: TODO.mdの管理者UID更新**

`docs/TODO.md` の「管理者UID」を新しいものに更新。

- [ ] **Step 5: コミット**

```bash
git add docs/TODO.md
git commit -m "admin: 管理者UIDをDiscord認証に移行"
```

---

## Task 9: 既存ユーザーのマイグレーション対応

**Files:**
- Modify: `src/store/useAuthStore.ts`

- [ ] **Step 1: 既存Googleユーザーへの対応方針**

Google認証の既存ユーザーは再ログインが必要。ローカルのプランデータはlocalStorageに残っているので、Discord/Twitterで再ログイン後に自動マイグレーションされる。

ただし、Firestoreのプラン（旧Google UID所有）は孤立する。
これは少数ユーザーのため、手動対応 or 自然消滅で問題ないか判断が必要。

- [ ] **Step 2: onAuthStateChanged内でFirestoreドキュメント未存在時のWelcomeSetup表示**

Task 2で実装済み。Firestoreに `users/{uid}` が存在しない場合 = 初回ログイン = WelcomeSetup表示。
既存Discord/Twitterユーザーでもusersドキュメント未作成の場合があるため、この方式で全て対応できる。

- [ ] **Step 3: コミット（変更がある場合のみ）**

---

## Task 10: ドキュメント更新

**Files:**
- Modify: `docs/TODO.md`
- Modify: `docs/DESIGN_DECISIONS.md`

- [ ] **Step 1: TODO.md更新**

「現在の状態」セクションを更新。完了タスクをTODO_COMPLETED.mdに移動。

- [ ] **Step 2: DESIGN_DECISIONS.md に認証方針を追記**

```markdown
## 認証プライバシー方針（2026-04-04確定）

### 決定事項
- Googleログインを廃止。Discord/Twitterのみ（カスタムトークン方式でFirebase Authにメアドが残らない）
- OAuthで外部APIから返る個人情報（displayName, avatar等）はサーバーでidのみ取り出し即破棄
- ユーザーの表示名・アイコンはユーザー自身が設定（SNSからの自動取得をやめる）
- 初回ログイン時にウェルカム画面でユーザー名入力
- アバターはreact-easy-cropで丸枠クロップ→128x128 WebP変換→Firebase Storage保存

### 背景
- Firebase Auth（Google認証）はメアドを内部DBに自動保存する
- カスタムトークン方式（Discord/Twitter）ならメアドはFirebase Authに残らない
- GitHub Public化に向けて「個人情報を取得しない」と誠実に言える状態を目指す

### 技術的な正直な開示
- OAuth認証の構造上、外部APIレスポンスがサーバーRAMに数ミリ秒間存在する（保存・記録はしない）
- これを回避するにはOAuth自体を使わない方式（パスキー等）が必要だが、現時点ではFirebase非対応
- プライバシーポリシーにこの事実を正直に記載
```

- [ ] **Step 3: コミット**

```bash
git add docs/TODO.md docs/DESIGN_DECISIONS.md
git commit -m "docs: 認証プライバシー方針をDESIGN_DECISIONS.mdに記録"
```

---

## 実行順序の注意

1. **Task 8（管理者UID移行）は Task 2（Googleログイン削除）の前に行う必要がある。** Googleログインを消す前に管理者がDiscordでログインし、新UIDにadmin権限を移す。
2. Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 の順は依存関係に基づく。
3. Task 9 は全体完了後に確認。
