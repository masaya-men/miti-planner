# ハウジング ログイン UI 整備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング (`/housing`) に Discord ログイン UI 一式 (LoginModal / AccountModal / TopBar ボタン / URL 駆動の登録モーダル復元 / モーダルスタッキング) を導入する。

**Architecture:** ハウジング独自トンマナ (ハニーゴールド) で新規 UI を作り、 認証データ操作ロジックは hook (`useAccountActions`) として LoPo と共通化。 モーダル開閉は新規 Zustand store + URL クエリ (`?register=open`) で管理し、 ブラウザバックで自然に閉じる業界水準 UX を実現。

**Tech Stack:** React 18 / TypeScript / Zustand / react-router-dom / react-i18next / Firebase (Auth + Firestore + Storage) / Vitest / Tailwind v4 / Vite

**設計書**: [2026-05-20-housing-login-ui-design.md](../specs/2026-05-20-housing-login-ui-design.md)

---

## PR 単位の分割

| PR | 内容 | Task |
|---|---|---|
| **PR 1** | hooks 抽出 + LoPo LoginModal refactor (動作変更ゼロ) | Task 1.x |
| **PR 2** | `useHousingModalStore` + URL クエリ駆動 + `saveReturnUrl` 拡張 (内部実装変更、 UI 変化なし) | Task 2.x |
| **PR 3** | 新規ハウジング UI (LoginModal / AccountModal / TopBar) + ログイン誘導フロー + i18n | Task 3.x |

---

## File Structure

### PR 1 範囲

| 種別 | パス | 責任 |
|---|---|---|
| 新規 | `src/hooks/auth/useAccountActions.ts` | アバター / displayName / ログアウト / 退会 の 4 操作を hook 化 |
| 新規 | `src/hooks/auth/__tests__/useAccountActions.test.ts` | hook の vitest テスト |
| 修正 | `src/components/LoginModal.tsx` | 直接呼んでた処理を hook 経由に置換 (動作変更なし) |

### PR 2 範囲

| 種別 | パス | 責任 |
|---|---|---|
| 新規 | `src/store/useHousingModalStore.ts` | ハウジング モーダル開閉 (login / account / register) を URL と sync |
| 新規 | `src/store/__tests__/useHousingModalStore.test.ts` | store のテスト |
| 修正 | `src/store/useAuthStore.ts` | `signInWith` に `withRegisterFlag` オプション追加 + `saveReturnUrl` 拡張 |
| 修正 | `src/components/housing/workspace/HousingWorkspace.tsx` | local useState 廃止 → store + URL sync 採用 |

### PR 3 範囲

| 種別 | パス | 責任 |
|---|---|---|
| 新規 | `src/components/housing/login/HousingLoginModal.tsx` | 未ログイン時のログイン誘導モーダル |
| 新規 | `src/components/housing/login/HousingAccountModal.tsx` | ログイン済時のアカウント設定モーダル |
| 新規 | `src/components/housing/login/__tests__/HousingLoginModal.test.tsx` | LoginModal render テスト |
| 新規 | `src/components/housing/login/__tests__/HousingAccountModal.test.tsx` | AccountModal render テスト |
| 修正 | `src/components/housing/workspace/TopBar.tsx` | 右端に未/ログイン済切替ボタン追加 |
| 修正 | `src/components/housing/register/HousingRegisterFormModal.tsx` | 「ログインしてください」 部分を `openLogin({ fromRegister: true })` に接続 |
| 修正 | `src/styles/housing.css` | 新 token + 新 CSS クラス (`housing-login-*` / `housing-account-*` / `housing-top-login-btn` / `housing-top-avatar-btn`) |
| 修正 | `src/locales/ja.json` | `housing.login.*` / `housing.account.*` / `housing.topbar.login|account` キー追加 |
| 修正 | `src/locales/en.json` / `ko.json` / `zh.json` | 同じキーで空値追加 (ja フォールバック) |

### 流用方針 (重要)

PR 3 のハウジング AccountModal で使う以下のサブコンポーネントは **LoPo 版をそのまま流用** する。 ハウジング版を新規作成しない (YAGNI):

- `src/components/DisplayNameEditor.tsx` (表示名編集 UI)
- `src/components/AvatarCropModal.tsx` (アバタートリミング)
- `src/components/ConfirmDialog.tsx` (退会確認)

理由: これらは機能的な UI で、 ハウジングのモックアップ (mockup/index.html) にも該当物なし。 LoPo 既存実装が機能ロジックを含むため二重実装を避ける。 将来モックアップに該当 UI が追加されたら新規作成する。

---

# PR 1: hooks 抽出 + LoPo refactor

## Task 1.1: `useAccountActions.ts` の作成

**Files:**
- Create: `src/hooks/auth/useAccountActions.ts`
- Test: `src/hooks/auth/__tests__/useAccountActions.test.ts`

- [ ] **Step 1: ディレクトリ作成と空ファイル設置**

```bash
mkdir -p src/hooks/auth/__tests__
```

- [ ] **Step 2: 失敗テストを書く**

`src/hooks/auth/__tests__/useAccountActions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Module mocks must be declared before importing the SUT
vi.mock('../../../store/useAuthStore', () => ({
    useAuthStore: Object.assign(
        vi.fn((sel: any) => sel({
            user: { uid: 'test-uid-123' },
            signOut: vi.fn(),
            deleteAccount: vi.fn(),
            updateDisplayName: vi.fn(),
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('../../../utils/avatarUpload', () => ({
    uploadAvatar: vi.fn(async () => 'https://example.com/avatar.webp'),
    deleteAvatar: vi.fn(async () => {}),
}));

import { useAccountActions } from '../useAccountActions';
import { uploadAvatar, deleteAvatar } from '../../../utils/avatarUpload';

describe('useAccountActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 5 actions (uploadAvatar, removeAvatar, updateDisplayName, signOut, deleteAccount)', () => {
        const { result } = renderHook(() => useAccountActions());
        expect(typeof result.current.uploadAvatar).toBe('function');
        expect(typeof result.current.removeAvatar).toBe('function');
        expect(typeof result.current.updateDisplayName).toBe('function');
        expect(typeof result.current.signOut).toBe('function');
        expect(typeof result.current.deleteAccount).toBe('function');
    });

    it('uploadAvatar uploads then updates profile state', async () => {
        const { result } = renderHook(() => useAccountActions());
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
        await act(async () => {
            await result.current.uploadAvatar(blob);
        });
        expect(uploadAvatar).toHaveBeenCalledWith('test-uid-123', blob);
    });

    it('removeAvatar deletes then clears profile state', async () => {
        const { result } = renderHook(() => useAccountActions());
        await act(async () => {
            await result.current.removeAvatar();
        });
        expect(deleteAvatar).toHaveBeenCalledWith('test-uid-123');
    });

    it('uploadAvatar without user throws', async () => {
        const { useAuthStore } = await import('../../../store/useAuthStore');
        (useAuthStore as any).mockImplementation((sel: any) =>
            sel({ user: null, signOut: vi.fn(), deleteAccount: vi.fn(), updateDisplayName: vi.fn() }),
        );

        const { result } = renderHook(() => useAccountActions());
        const blob = new Blob([], { type: 'image/webp' });
        await expect(result.current.uploadAvatar(blob)).rejects.toThrow('not_signed_in');
    });
});
```

- [ ] **Step 3: テストが fail することを確認**

Run: `rtk vitest run src/hooks/auth/__tests__/useAccountActions.test.ts`
Expected: FAIL (`Cannot find module '../useAccountActions'`)

- [ ] **Step 4: hook 本体を実装**

`src/hooks/auth/useAccountActions.ts`:

```typescript
import { useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { uploadAvatar as uploadAvatarUtil, deleteAvatar as deleteAvatarUtil } from '../../utils/avatarUpload';

/**
 * Account 設定操作 (アバター / displayName / ログアウト / 退会) を一箇所にまとめる hook。
 *
 * LoPo `LoginModal` と Housing `HousingAccountModal` の両方から使う。
 * UI は各モーダルで独自実装、 データ操作のみ共通化。
 */
export function useAccountActions() {
    const user = useAuthStore(s => s.user);
    const storeSignOut = useAuthStore(s => s.signOut);
    const storeDeleteAccount = useAuthStore(s => s.deleteAccount);
    const storeUpdateDisplayName = useAuthStore(s => s.updateDisplayName);

    const uploadAvatar = useCallback(async (blob: Blob): Promise<string> => {
        if (!user) throw new Error('not_signed_in');
        const url = await uploadAvatarUtil(user.uid, blob);
        useAuthStore.setState({ profileAvatarUrl: url });
        return url;
    }, [user]);

    const removeAvatar = useCallback(async (): Promise<void> => {
        if (!user) throw new Error('not_signed_in');
        await deleteAvatarUtil(user.uid);
        useAuthStore.setState({ profileAvatarUrl: null });
    }, [user]);

    const updateDisplayName = useCallback(async (newName: string): Promise<void> => {
        await storeUpdateDisplayName(newName);
    }, [storeUpdateDisplayName]);

    const signOut = useCallback(async (): Promise<void> => {
        await storeSignOut();
    }, [storeSignOut]);

    const deleteAccount = useCallback(async (): Promise<void> => {
        await storeDeleteAccount();
    }, [storeDeleteAccount]);

    return { uploadAvatar, removeAvatar, updateDisplayName, signOut, deleteAccount };
}
```

- [ ] **Step 5: テストが pass することを確認**

Run: `rtk vitest run src/hooks/auth/__tests__/useAccountActions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: commit**

```bash
rtk git add src/hooks/auth/useAccountActions.ts src/hooks/auth/__tests__/useAccountActions.test.ts
rtk git commit -m "feat(auth): useAccountActions hook を抽出 (avatar/displayName/signOut/delete)

LoPo LoginModal と housing AccountModal の両方から同じ認証データ操作を呼べるよう、
共通 hook として分離。 UI は各モーダルで独自実装、 ロジックのみ共通化する戦略の第一歩。"
```

## Task 1.2: LoPo `LoginModal.tsx` を hook 使用に refactor

**Files:**
- Modify: `src/components/LoginModal.tsx` (主に 89-119 行と 121-131 行)

- [ ] **Step 1: refactor 前の動作確認**

Run: `rtk vitest run src/components/__tests__/LoginModal.test.tsx`
Expected: 既存テストが全て pass (refactor 前のベースライン)

LoginModal の既存テストが無い場合: 手動テストで以下を確認してメモする (refactor 後の比較用):
- LoPo で未ログインから Discord ボタンクリック → サインイン成功
- ログイン済で表示名編集 → 保存
- アバター編集 → トリミング → アップロード成功
- ローカル取込ボタン押下 → ダイアログ表示
- ログアウト → ログイン画面に戻る
- 退会確認 → キャンセル (実際の退会は実行しない)

- [ ] **Step 2: LoginModal で hook を使用するよう書き換える**

`src/components/LoginModal.tsx` の以下の部分を置換する:

(1) **import 文に追加** (既存 import 群の後に追記):

```typescript
import { useAccountActions } from '../hooks/auth/useAccountActions';
```

(2) **コンポーネント内 (37-52 行付近) で hook を呼ぶ**:

```typescript
// useAccountActions 経由で 5 操作を取得 (内部で useAuthStore も使う)
const accountActions = useAccountActions();
```

(3) **`handleAvatarComplete` (89-103 行) を hook 経由に置換**:

```typescript
const handleAvatarComplete = async (blob: Blob) => {
    if (!user) return;
    setIsAvatarBusy(true);
    setShowAvatarCrop(false);
    try {
        await accountActions.uploadAvatar(blob);
        showToast(t('avatar.toast_uploaded'));
    } catch (err) {
        console.error('Avatar upload error:', err);
        showToast(t('avatar.toast_upload_error'), 'error');
    } finally {
        setIsAvatarBusy(false);
    }
};
```

(4) **`handleDeleteAvatar` (105-119 行) を hook 経由に置換**:

```typescript
const handleDeleteAvatar = async () => {
    if (!user) return;
    setIsAvatarBusy(true);
    setShowDeleteAvatarConfirm(false);
    try {
        await accountActions.removeAvatar();
        showToast(t('avatar.toast_deleted'));
    } catch (err) {
        console.error('Avatar delete error:', err);
        showToast(t('avatar.toast_delete_error'), 'error');
    } finally {
        setIsAvatarBusy(false);
    }
};
```

(5) **`handleDeleteAccount` (121-131 行) を hook 経由に置換**:

```typescript
const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
        await accountActions.deleteAccount();
        onClose();
        navigate('/');
    } finally {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
    }
};
```

(6) **`handleSaveDisplayName` (54-66 行) を hook 経由に置換**:

```typescript
const handleSaveDisplayName = async (newName: string) => {
    setIsSavingName(true);
    try {
        await accountActions.updateDisplayName(newName);
        setEditingName(false);
        showToast(t('profile.toast_name_updated'));
    } catch (err) {
        console.error('Display name update error:', err);
        showToast(t('profile.toast_name_error'), 'error');
    } finally {
        setIsSavingName(false);
    }
};
```

(7) **ログアウトボタン (281-290 行) を hook 経由に置換**:

```typescript
<button
    onClick={async () => { await accountActions.signOut(); onClose(); }}
    className={clsx(
        "w-full px-4 py-2.5 rounded-xl text-app-lg font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
        "text-app-red border border-app-red-border hover:bg-app-red-dim hover:border-app-red"
    )}
>
    <LogOut size={14} />
    {t('app.sign_out')}
</button>
```

(8) **古い import を削除** (もし `uploadAvatar` / `deleteAvatar` の直接 import を残しているなら):

`src/components/LoginModal.tsx` の 15 行目:
```typescript
import { uploadAvatar, deleteAvatar } from '../utils/avatarUpload';
```
を削除する (hook 経由なので直接呼ばない)。

`signOut`, `deleteAccount`, `updateDisplayName` の useAuthStore destructure も hook に移譲したので、 destructure 文から削除:

40 行目:
```typescript
const { user, signInWith, signOut, deleteAccount, isAdmin } = useAuthStore();
```
を以下に置換:
```typescript
const { user, signInWith, isAdmin } = useAuthStore();
```

48 行目の `updateDisplayName` 取得行:
```typescript
const updateDisplayName = useAuthStore(s => s.updateDisplayName);
```
を削除する (hook 経由)。

- [ ] **Step 3: TypeScript エラーがないことを確認**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: vitest run で全テスト pass 確認**

Run: `rtk vitest run`
Expected: PASS (新規 hook test 含めて全部)

- [ ] **Step 5: 手動テストで refactor 前と同じ挙動を確認**

ローカル開発サーバー起動:
```bash
rtk pnpm dev
```

Step 1 でメモした項目を全部実行し、 全て成功することを確認。 何か挙動が変わったら refactor の取り違えがあるので、 該当箇所を再確認。

- [ ] **Step 6: commit**

```bash
rtk git add src/components/LoginModal.tsx
rtk git commit -m "refactor(login): LoPo LoginModal を useAccountActions hook 経由に書き換え

動作変更なし、 内部実装変更のみ。 同じ hook をハウジング AccountModal でも使えるよう
責任分離を完了。 直 import していた uploadAvatar / deleteAvatar / signOut / deleteAccount /
updateDisplayName の呼び出し点を hook の戻り値経由に統一。"
```

## Task 1.3: PR 1 の最終確認

- [ ] **Step 1: build 通過確認**

Run: `rtk npm run build`
Expected: ビルド成功 (Vercel 用 production build)

- [ ] **Step 2: vitest 全 pass 確認**

Run: `rtk vitest run`
Expected: 全 test PASS

- [ ] **Step 3: push (任意、 PR 1 単独で main merge する場合)**

PR を分けて段階デプロイする場合:
```bash
rtk git push origin main
```

PR 1, 2, 3 をまとめて 1 push でデプロイする方針なら、 ここでは push しない (Task 3.x の最後でまとめる)。 Vercel ビルド回数節約のため、 まとめ push 推奨 (memory `feedback_vercel_builds.md`)。

---

# PR 2: useHousingModalStore + URL クエリ駆動 + saveReturnUrl 拡張

## Task 2.1: `useHousingModalStore.ts` の作成

**Files:**
- Create: `src/store/useHousingModalStore.ts`
- Test: `src/store/__tests__/useHousingModalStore.test.ts`

- [ ] **Step 1: 失敗テストを書く**

`src/store/__tests__/useHousingModalStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingModalStore } from '../useHousingModalStore';

describe('useHousingModalStore', () => {
    beforeEach(() => {
        // 各テスト前に store を初期化
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: false },
            register: { open: false },
        });
    });

    it('initial state: all modals closed', () => {
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(false);
        expect(s.account.open).toBe(false);
        expect(s.register.open).toBe(false);
    });

    it('openLogin sets login.open = true with fromRegister default false', () => {
        useHousingModalStore.getState().openLogin();
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(true);
        expect(s.login.fromRegister).toBe(false);
    });

    it('openLogin({ fromRegister: true }) sets fromRegister flag', () => {
        useHousingModalStore.getState().openLogin({ fromRegister: true });
        expect(useHousingModalStore.getState().login.fromRegister).toBe(true);
    });

    it('closeLogin when fromRegister=false only closes login', () => {
        useHousingModalStore.setState({
            login: { open: true, fromRegister: false },
            register: { open: true },
            account: { open: false },
        });
        useHousingModalStore.getState().closeLogin();
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(false);
        expect(s.register.open).toBe(true);  // register stays open
    });

    it('closeLogin when fromRegister=true also closes register', () => {
        useHousingModalStore.setState({
            login: { open: true, fromRegister: true },
            register: { open: true },
            account: { open: false },
        });
        useHousingModalStore.getState().closeLogin();
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(false);
        expect(s.register.open).toBe(false);
        expect(s.login.fromRegister).toBe(false);  // reset
    });

    it('openAccount sets account.open = true', () => {
        useHousingModalStore.getState().openAccount();
        expect(useHousingModalStore.getState().account.open).toBe(true);
    });

    it('closeAccount sets account.open = false', () => {
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: true },
            register: { open: false },
        });
        useHousingModalStore.getState().closeAccount();
        expect(useHousingModalStore.getState().account.open).toBe(false);
    });

    it('openRegister sets register.open = true', () => {
        useHousingModalStore.getState().openRegister();
        expect(useHousingModalStore.getState().register.open).toBe(true);
    });

    it('closeRegister sets register.open = false', () => {
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: false },
            register: { open: true },
        });
        useHousingModalStore.getState().closeRegister();
        expect(useHousingModalStore.getState().register.open).toBe(false);
    });

    it('syncFromUrl reads ?register=open and opens register', () => {
        const params = new URLSearchParams('?register=open');
        useHousingModalStore.getState().syncFromUrl(params);
        expect(useHousingModalStore.getState().register.open).toBe(true);
    });

    it('syncFromUrl with no register param closes register', () => {
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: false },
            register: { open: true },
        });
        const params = new URLSearchParams('');
        useHousingModalStore.getState().syncFromUrl(params);
        expect(useHousingModalStore.getState().register.open).toBe(false);
    });
});
```

- [ ] **Step 2: テスト fail 確認**

Run: `rtk vitest run src/store/__tests__/useHousingModalStore.test.ts`
Expected: FAIL (`Cannot find module '../useHousingModalStore'`)

- [ ] **Step 3: store 本体を実装**

`src/store/useHousingModalStore.ts`:

```typescript
import { create } from 'zustand';

/**
 * ハウジング画面のモーダル開閉状態を管理する store。
 *
 * - login / account: 短命なステート (URL に含めない)
 * - register: URL クエリ `?register=open` と双方向 sync (ブラウザバックで閉じる)
 *
 * URL ↔ store の sync は HousingWorkspace 側で navigate + syncFromUrl を呼んで実現する
 * (store 自体は navigate を持たない = test 可能性のため)。
 */

interface LoginState {
    open: boolean;
    fromRegister: boolean;
}

interface RegisterState {
    open: boolean;
}

interface AccountState {
    open: boolean;
}

interface HousingModalState {
    login: LoginState;
    account: AccountState;
    register: RegisterState;

    openLogin: (opts?: { fromRegister?: boolean }) => void;
    closeLogin: () => void;
    openAccount: () => void;
    closeAccount: () => void;
    openRegister: () => void;
    closeRegister: () => void;
    syncFromUrl: (searchParams: URLSearchParams) => void;
}

export const useHousingModalStore = create<HousingModalState>((set, get) => ({
    login: { open: false, fromRegister: false },
    account: { open: false },
    register: { open: false },

    openLogin: (opts) => {
        set({ login: { open: true, fromRegister: opts?.fromRegister ?? false } });
    },

    closeLogin: () => {
        const { login } = get();
        if (login.fromRegister) {
            // 経路 B: 登録モーダル経由で開いていたら、 登録モーダルも一緒に閉じる
            set({
                login: { open: false, fromRegister: false },
                register: { open: false },
            });
        } else {
            // 経路 A: TopBar から直接開いたら、 login だけ閉じる
            set({ login: { open: false, fromRegister: false } });
        }
    },

    openAccount: () => set({ account: { open: true } }),
    closeAccount: () => set({ account: { open: false } }),

    openRegister: () => set({ register: { open: true } }),
    closeRegister: () => set({ register: { open: false } }),

    syncFromUrl: (searchParams) => {
        const shouldOpenRegister = searchParams.get('register') === 'open';
        set({ register: { open: shouldOpenRegister } });
    },
}));
```

- [ ] **Step 4: テスト pass 確認**

Run: `rtk vitest run src/store/__tests__/useHousingModalStore.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: commit**

```bash
rtk git add src/store/useHousingModalStore.ts src/store/__tests__/useHousingModalStore.test.ts
rtk git commit -m "feat(housing): useHousingModalStore で login/account/register モーダル状態を一元化

URL クエリ ?register=open との双方向 sync をサポート (syncFromUrl)。
closeLogin は fromRegister フラグで分岐し、 登録モーダル経由なら両方閉じる。"
```

## Task 2.2: `useAuthStore.signInWith` に `withRegisterFlag` オプション追加

**Files:**
- Modify: `src/store/useAuthStore.ts`

- [ ] **Step 1: 失敗テストを書く (任意 — 既存 useAuthStore の test 構造に合わせる)**

既存テストファイル `src/store/__tests__/useAuthStore.test.ts` がなければ作る。 既存 mock 機能が複雑なので、 ここでは `saveReturnUrl` だけを独立した pure function にすることでテスタブルにする。

`src/store/__tests__/useAuthStore.test.ts` に以下を追加 (既存ファイルなら describe ブロック追加、 新規ならファイル作成):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { buildReturnUrl } from '../useAuthStore';  // 後で export 追加

describe('buildReturnUrl', () => {
    it('returns current URL when withRegisterFlag is false', () => {
        const result = buildReturnUrl('https://example.com/housing', false);
        expect(result).toBe('https://example.com/housing');
    });

    it('appends ?register=open when withRegisterFlag is true', () => {
        const result = buildReturnUrl('https://example.com/housing', true);
        expect(result).toBe('https://example.com/housing?register=open');
    });

    it('preserves existing query and adds register=open', () => {
        const result = buildReturnUrl('https://example.com/housing?foo=bar', true);
        expect(result).toBe('https://example.com/housing?foo=bar&register=open');
    });

    it('does not duplicate register=open if already present', () => {
        const result = buildReturnUrl('https://example.com/housing?register=open', true);
        expect(result).toBe('https://example.com/housing?register=open');
    });
});
```

- [ ] **Step 2: テスト fail 確認**

Run: `rtk vitest run src/store/__tests__/useAuthStore.test.ts`
Expected: FAIL (`buildReturnUrl` not exported)

- [ ] **Step 3: `useAuthStore.ts` を修正**

`src/store/useAuthStore.ts` の以下を変更:

(1) **`saveReturnUrl` 関数を `buildReturnUrl` + `saveReturnUrl` の 2 段構成に変更** (28-31 行):

```typescript
/** 戻り URL に register=open を付ける必要があるかを判定して URL を組み立てる純粋関数 (testable) */
export function buildReturnUrl(href: string, withRegisterFlag: boolean): string {
    if (!withRegisterFlag) return href;
    const url = new URL(href);
    url.searchParams.set('register', 'open');
    return url.toString();
}

/** リダイレクト前に現在のURLを保存（Discord用） */
function saveReturnUrl(withRegisterFlag = false) {
    const url = buildReturnUrl(window.location.href, withRegisterFlag);
    localStorage.setItem('lopo_auth_return_url', url);
}
```

(2) **`signInWith` のシグネチャ拡張** (48 行と 66-87 行):

interface の定義 (48 行付近):
```typescript
signInWith: (provider: AuthProvider, opts?: { withRegisterFlag?: boolean }) => void;
```

実装 (66-87 行):
```typescript
signInWith: (provider: AuthProvider, opts?: { withRegisterFlag?: boolean }) => {
    switch (provider) {
        case 'discord':
            saveReturnUrl(opts?.withRegisterFlag ?? false);
            localStorage.setItem('lopo_auth_redirecting', 'true');
            apiFetch('/api/auth?provider=discord', { method: 'POST' })
                .then(r => r.json())
                .then(data => {
                    if (data.url) {
                        window.location.href = data.url;
                    } else {
                        console.error('Discord OAuth: URL not received');
                        localStorage.removeItem('lopo_auth_redirecting');
                    }
                })
                .catch(err => {
                    console.error('Discord login error:', err);
                    localStorage.removeItem('lopo_auth_redirecting');
                });
            break;
    }
},
```

- [ ] **Step 4: テスト pass 確認**

Run: `rtk vitest run src/store/__tests__/useAuthStore.test.ts`
Expected: PASS (4 buildReturnUrl tests)

- [ ] **Step 5: 既存 LoPo の signInWith 呼出が影響を受けないことを確認**

Run: `rtk grep "signInWith\(" src/`
全呼出を確認: 引数なしか、 `signInWith('discord')` のみのはず。 `opts?` は optional なので破壊変更なし。

Run: `rtk vitest run`
Expected: 全テスト PASS

- [ ] **Step 6: commit**

```bash
rtk git add src/store/useAuthStore.ts src/store/__tests__/useAuthStore.test.ts
rtk git commit -m "feat(auth): signInWith に withRegisterFlag オプション追加

ハウジング登録モーダル経由でログインに進む場合、 戻り URL に ?register=open を付与する。
buildReturnUrl を export して unit test 可能に。 既存呼出は引数なしで動作変わらず."
```

## Task 2.3: `HousingWorkspace.tsx` を store + URL sync 採用に書き換え

**Files:**
- Modify: `src/components/housing/workspace/HousingWorkspace.tsx`

- [ ] **Step 1: 現状確認**

Read: `src/components/housing/workspace/HousingWorkspace.tsx`

L32 付近: `const [registerOpen, setRegisterOpen] = useState(false);` (local state)
これを store + URL sync に置き換える。

- [ ] **Step 2: HousingWorkspace を書き換え**

(1) **import 追加**:

```typescript
import { useSearchParams } from 'react-router-dom';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
```

(2) **local useState を削除**:

```typescript
// 削除:
const [registerOpen, setRegisterOpen] = useState(false);
```

(3) **store と URL sync を導入** (`useState` の置換位置):

```typescript
const [searchParams, setSearchParams] = useSearchParams();

const registerOpen = useHousingModalStore(s => s.register.open);
const openRegisterAction = useHousingModalStore(s => s.openRegister);
const closeRegisterAction = useHousingModalStore(s => s.closeRegister);
const syncFromUrl = useHousingModalStore(s => s.syncFromUrl);

// URL → store: マウント時 / ブラウザバック時に URL クエリを読んで store に反映
useEffect(() => {
    syncFromUrl(searchParams);
}, [searchParams, syncFromUrl]);

// store → URL: register.open が変わったら URL も同期
const handleOpenRegister = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set('register', 'open');
    setSearchParams(params);
    openRegisterAction();
}, [searchParams, setSearchParams, openRegisterAction]);

const handleCloseRegister = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('register');
    setSearchParams(params);
    closeRegisterAction();
}, [searchParams, setSearchParams, closeRegisterAction]);
```

(4) **既存の `setRegisterOpen(true)` 呼出を `handleOpenRegister()` に置換、 `setRegisterOpen(false)` を `handleCloseRegister()` に置換**:

ファイル内で grep して全置換:
```bash
rtk grep "setRegisterOpen" src/components/housing/workspace/HousingWorkspace.tsx
```

各呼出を上記のハンドラに置き換える。

(5) **登録モーダルコンポーネントの props を更新**:

`HousingRegisterFormModal` (or `HousingRegisterModal`) の `open` prop と `onClose` prop を:
```tsx
<HousingRegisterFormModal
    open={registerOpen}
    onClose={handleCloseRegister}
    ...
/>
```

- [ ] **Step 3: TypeScript エラー確認**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 既存テスト + 新規テスト全 pass 確認**

Run: `rtk vitest run`
Expected: 全テスト PASS

- [ ] **Step 5: 手動テスト**

Run: `rtk pnpm dev`

ブラウザで以下を確認:
1. `/housing` を開いて、 TopBar の登録ボタンクリック → 登録モーダル開く + URL が `/housing?register=open` になる
2. モーダル × ボタンクリック → モーダル閉じる + URL から `?register=open` 消える
3. 再度モーダル開いてブラウザの戻るボタン → モーダル閉じる (β 方式の動作確認)
4. `/housing?register=open` を直接 URL バーに入れて開く → 登録モーダル auto open

- [ ] **Step 6: commit**

```bash
rtk git add src/components/housing/workspace/HousingWorkspace.tsx
rtk git commit -m "refactor(housing): 登録モーダル開閉を local useState → store + URL クエリ駆動

?register=open で開閉、 ブラウザバックで閉じる。 store (useHousingModalStore) と
URL を双方向 sync。 既存の UX は維持しつつ、 ログイン後の戻りで URL から復元する
基盤を整える。"
```

## Task 2.4: PR 2 の最終確認

- [ ] **Step 1: build 通過確認**

Run: `rtk npm run build`
Expected: ビルド成功

- [ ] **Step 2: vitest 全 pass**

Run: `rtk vitest run`
Expected: 全テスト PASS

---

# PR 3: 新規ハウジング UI + ログイン誘導フロー

## Task 3.1: i18n キー追加 (ja + 他言語空キー)

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

- [ ] **Step 1: `src/locales/ja.json` に新規キーを追加**

既存 `housing` キーがあるはず。 その内側に追加:

```json
{
    "housing": {
        "...existing keys...": "...",
        "login": {
            "title": "LoPo にログイン",
            "notice": {
                "intro": "LoPo を気持ちよく使ってもらうためのお願いです。",
                "item1": "偽の情報や嫌がらせ目的の登録で家探しが台無しにならないよう、登録時には Discord ログインをお願いしています。",
                "item2": "LoPo が受け取るのは Discord アカウントの ID (ハッシュ値) だけです。メールアドレス・ユーザー名・アバター画像は受け取りません。元の Discord ID は LoPo 内部でも復元できない形で保存されます。",
                "item3": "「ちがった」ボタンを気軽に押してもらえるよう、逆に嫌がらせ通報を繰り返すアカウントは裏側で記録しています。度を越した行為があった場合、そのアカウントの利用を制限することがあります。"
            },
            "discordButton": "Discord でログイン",
            "closeLabel": "ログイン画面を閉じる"
        },
        "account": {
            "title": "アカウント",
            "avatarChange": "アバターを変更",
            "avatarDelete": "削除",
            "displayNameLabel": "表示名",
            "displayNameEdit": "表示名を編集",
            "adminLink": "管理画面へ",
            "signOut": "ログアウト",
            "deleteAccount": "退会する",
            "deleteConfirmTitle": "本当に退会しますか?",
            "deleteConfirmBody": "アカウントを削除すると、登録した物件・お気に入り・アバター画像など全てのデータが完全に削除されます。この操作は取り消せません。",
            "deleteConfirmYes": "退会する",
            "deleteConfirmNo": "やめる",
            "closeLabel": "アカウント画面を閉じる"
        },
        "topbar": {
            "login": "ログイン",
            "account": "アカウント"
        }
    }
}
```

- [ ] **Step 2: `src/locales/en.json` / `ko.json` / `zh.json` に同じキーを空文字で追加**

i18next の fallback で ja が表示される。 後で値だけ埋める運用にする。

3 ファイルそれぞれに以下を追加 (キー構造は ja と同じ、 値は全て空文字):

```json
{
    "housing": {
        "login": {
            "title": "",
            "notice": {
                "intro": "",
                "item1": "",
                "item2": "",
                "item3": ""
            },
            "discordButton": "",
            "closeLabel": ""
        },
        "account": {
            "title": "",
            "avatarChange": "",
            "avatarDelete": "",
            "displayNameLabel": "",
            "displayNameEdit": "",
            "adminLink": "",
            "signOut": "",
            "deleteAccount": "",
            "deleteConfirmTitle": "",
            "deleteConfirmBody": "",
            "deleteConfirmYes": "",
            "deleteConfirmNo": "",
            "closeLabel": ""
        },
        "topbar": {
            "login": "",
            "account": ""
        }
    }
}
```

- [ ] **Step 3: i18next 設定が空文字を fallback 対象とするか確認**

`src/i18n/config.ts` または `src/lib/i18n.ts` を read して `returnEmptyString` 設定を確認:

```typescript
i18n.init({
    returnEmptyString: false,  // ← これが false なら空文字でも fallback が動く
    fallbackLng: 'ja',
    // ...
});
```

`returnEmptyString` が true (デフォルト) なら、 空文字を「翻訳済み」 と扱ってしまう。 false に変更する必要がある。

設定変更が必要な場合:
```typescript
i18n.init({
    returnEmptyString: false,
    fallbackLng: 'ja',
    // ...
});
```

- [ ] **Step 4: 動作確認**

Run: `rtk pnpm dev`

ブラウザで言語を en に切り替えて、 ハウジング画面の登録モーダルから「ログインしてください」 リンクを開く想定で、 `t('housing.login.title')` が ja の「LoPo にログイン」 として表示されることを確認 (注: LoginModal 実装は次タスク以降なので、 ここでは i18n キーの解決確認のため一時的に既存コンポーネントに `t('housing.login.title')` を埋める or DevTools で確認)。

実装上の確認は次の Task 3.3 で LoginModal を実装した後で行う。 ここでは JSON 構造として valid かだけ確認:
```bash
rtk grep "housing.login" src/locales/ja.json
```

- [ ] **Step 5: commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(i18n): ハウジング login/account 用 i18n キーを追加 (ja 値のみ)

en/ko/zh は空文字で先行追加。 returnEmptyString=false 設定で ja にフォールバック。
将来の翻訳追加は値を埋めるだけで完了する仕組み。"
```

## Task 3.2: `src/styles/housing.css` に新 token + CSS クラス追加

**Files:**
- Modify: `src/styles/housing.css`

- [ ] **Step 1: 既存 token と命名規則を確認**

Read: `src/styles/housing.css` の `.housing-workspace` ブロック (token 集約場所)

既存の `housing-panel-*` / `housing-chip-*` の命名を確認。 honey 色や candle 色の token (`--housing-honey-*`) を確認する。

- [ ] **Step 2: 新 token + クラスを追加**

`src/styles/housing.css` の末尾 (or 適切な位置) に以下を追加:

```css
/* ===========================================
 * Login / Account / TopBar ボタン用 token
 * =========================================== */
.housing-workspace {
    /* (既存 token に追加) */
    --housing-login-modal-width: 480px;
    --housing-login-pill-bg: var(--housing-honey);
    --housing-login-pill-bg-hover: var(--housing-honey-glow);
    --housing-login-pill-text: rgba(20, 12, 4, 0.92);
    --housing-login-pill-shadow: 0 4px 12px rgba(255, 178, 90, 0.35);
    --housing-avatar-ring: rgba(255, 226, 179, 0.55);
    --housing-avatar-ring-hover: rgba(255, 226, 179, 0.85);
    --housing-account-button-bg: rgba(255, 226, 179, 0.08);
    --housing-account-button-bg-hover: rgba(255, 226, 179, 0.16);
    --housing-account-button-border: rgba(255, 226, 179, 0.22);
    --housing-account-danger-text: rgba(255, 130, 130, 0.85);
    --housing-account-danger-bg-hover: rgba(255, 130, 130, 0.12);
    --housing-divider: rgba(255, 226, 179, 0.18);
}

/* ===========================================
 * TopBar 右端 ログイン / アバターボタン
 * =========================================== */
.housing-top-login-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--housing-login-pill-bg);
    color: var(--housing-login-pill-text);
    font-size: var(--housing-text-sm);
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: background 180ms ease, transform 120ms ease;
    box-shadow: var(--housing-login-pill-shadow);
}
.housing-top-login-btn:hover {
    background: var(--housing-login-pill-bg-hover);
    transform: translateY(-1px);
}
.housing-top-login-btn:active {
    transform: scale(0.96);
}

.housing-top-avatar-btn {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    overflow: hidden;
    border: 1.5px solid var(--housing-avatar-ring);
    background: rgba(0, 0, 0, 0.2);
    cursor: pointer;
    padding: 0;
    transition: border-color 180ms ease, transform 120ms ease;
}
.housing-top-avatar-btn:hover {
    border-color: var(--housing-avatar-ring-hover);
}
.housing-top-avatar-btn:active {
    transform: scale(0.94);
}
.housing-top-avatar-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

/* ===========================================
 * Login Modal
 * =========================================== */
.housing-login-notice {
    color: var(--housing-text-soft);
    font-size: var(--housing-text-sm);
    line-height: 1.7;
    margin-bottom: 24px;
}
.housing-login-notice-intro {
    margin-bottom: 12px;
}
.housing-login-notice-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.housing-login-notice-list li {
    padding-left: 16px;
    position: relative;
}
.housing-login-notice-list li::before {
    content: '・';
    position: absolute;
    left: 0;
    color: var(--housing-honey);
}
.housing-login-discord-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--housing-login-pill-bg);
    color: var(--housing-login-pill-text);
    font-size: var(--housing-text-base);
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: background 180ms ease, transform 120ms ease;
    box-shadow: var(--housing-login-pill-shadow);
}
.housing-login-discord-btn:hover {
    background: var(--housing-login-pill-bg-hover);
}
.housing-login-discord-btn:active {
    transform: scale(0.98);
}

/* ===========================================
 * Account Modal
 * =========================================== */
.housing-account-profile {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border-radius: 12px;
    background: var(--housing-account-button-bg);
    border: 1px solid var(--housing-account-button-border);
    margin-bottom: 20px;
}
.housing-account-avatar {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    overflow: hidden;
    border: 2px solid var(--housing-avatar-ring);
    flex-shrink: 0;
    cursor: pointer;
}
.housing-account-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.housing-account-info {
    flex: 1;
    min-width: 0;
}
.housing-account-divider {
    height: 1px;
    background: var(--housing-divider);
    margin: 20px 0;
}
.housing-account-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--housing-account-button-bg);
    color: var(--housing-text);
    font-size: var(--housing-text-sm);
    font-weight: 500;
    border: 1px solid var(--housing-account-button-border);
    cursor: pointer;
    transition: background 180ms ease;
    margin-bottom: 8px;
}
.housing-account-button:hover {
    background: var(--housing-account-button-bg-hover);
}
.housing-account-button-danger {
    color: var(--housing-account-danger-text);
    border-color: rgba(255, 130, 130, 0.25);
}
.housing-account-button-danger:hover {
    background: var(--housing-account-danger-bg-hover);
}
.housing-account-delete-link {
    display: block;
    width: 100%;
    text-align: center;
    background: transparent;
    border: none;
    color: rgba(255, 226, 179, 0.5);
    font-size: var(--housing-text-xs);
    padding: 8px;
    margin-top: 12px;
    cursor: pointer;
    transition: color 180ms ease;
}
.housing-account-delete-link:hover {
    color: rgba(255, 130, 130, 0.85);
}
```

注: 上記の token 名 (`--housing-text-sm`, `--housing-text-soft`, `--housing-text` 等) は既存 housing.css の token を再利用する想定。 存在しない token があれば既存ファイルから対応するものを探して置換、 または新規追加する。

- [ ] **Step 3: ビルド通過確認**

Run: `rtk npm run build`
Expected: ビルド成功 (Tailwind v4 の Lightning CSS が backdrop-filter 直書きを削除するルール (memory `css-rules.md`) に違反していないか)

- [ ] **Step 4: commit**

```bash
rtk git add src/styles/housing.css
rtk git commit -m "feat(housing): login/account/topbar 用 CSS token とクラス追加

ハニーゴールド pill ボタン (TopBar ログイン)、 アバター丸 (TopBar 済み)、
LoginModal 文言ブロック、 AccountModal の 5 機能ボタン (signOut / delete / etc) の
スタイルを housing.css に統一集約。 全色 token 経由でハードコードゼロ。"
```

## Task 3.3: `HousingLoginModal.tsx` の実装

**Files:**
- Create: `src/components/housing/login/HousingLoginModal.tsx`
- Test: `src/components/housing/login/__tests__/HousingLoginModal.test.tsx`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p src/components/housing/login/__tests__
```

- [ ] **Step 2: 失敗テストを書く**

`src/components/housing/login/__tests__/HousingLoginModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HousingLoginModal } from '../HousingLoginModal';

const mockSignInWith = vi.fn();

vi.mock('../../../../store/useAuthStore', () => ({
    useAuthStore: Object.assign(
        vi.fn(() => ({ signInWith: mockSignInWith })),
        { setState: vi.fn(), getState: vi.fn(() => ({ signInWith: mockSignInWith })) },
    ),
}));

vi.mock('../../../../store/useHousingModalStore', () => ({
    useHousingModalStore: Object.assign(
        vi.fn((sel: any) => sel({
            login: { open: true, fromRegister: false },
            closeLogin: vi.fn(),
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

describe('HousingLoginModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title and Discord button when open', () => {
        render(
            <MemoryRouter>
                <HousingLoginModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.login.title')).toBeInTheDocument();
        expect(screen.getByText('housing.login.discordButton')).toBeInTheDocument();
    });

    it('renders 3 notice items', () => {
        render(
            <MemoryRouter>
                <HousingLoginModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.login.notice.item1')).toBeInTheDocument();
        expect(screen.getByText('housing.login.notice.item2')).toBeInTheDocument();
        expect(screen.getByText('housing.login.notice.item3')).toBeInTheDocument();
    });

    it('clicking Discord button calls signInWith with withRegisterFlag based on fromRegister', () => {
        render(
            <MemoryRouter>
                <HousingLoginModal />
            </MemoryRouter>,
        );
        fireEvent.click(screen.getByText('housing.login.discordButton'));
        expect(mockSignInWith).toHaveBeenCalledWith('discord', { withRegisterFlag: false });
    });
});
```

- [ ] **Step 3: テスト fail 確認**

Run: `rtk vitest run src/components/housing/login/__tests__/HousingLoginModal.test.tsx`
Expected: FAIL (`Cannot find module '../HousingLoginModal'`)

- [ ] **Step 4: 本体実装**

`src/components/housing/login/HousingLoginModal.tsx`:

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HousingPanelModal } from '../HousingPanelModal';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';

/**
 * ハウジング画面の未ログインユーザー向けログイン誘導モーダル。
 *
 * - HousingPanelModal をラッパーとして流用
 * - Discord ボタンクリックで useAuthStore.signInWith('discord', { withRegisterFlag })
 *   を呼ぶ。 fromRegister=true なら戻り URL に ?register=open を含める
 */
export const HousingLoginModal: React.FC = () => {
    const { t } = useTranslation();
    const open = useHousingModalStore(s => s.login.open);
    const fromRegister = useHousingModalStore(s => s.login.fromRegister);
    const closeLogin = useHousingModalStore(s => s.closeLogin);
    const signInWith = useAuthStore(s => s.signInWith);

    const handleDiscordClick = () => {
        signInWith('discord', { withRegisterFlag: fromRegister });
    };

    if (!open) return null;

    return (
        <HousingPanelModal
            open={open}
            onClose={closeLogin}
            title={t('housing.login.title')}
            closeLabel={t('housing.login.closeLabel')}
            maxWidth={480}
            maxHeightRatio={0.86}
        >
            <div className="housing-login-notice">
                <p className="housing-login-notice-intro">
                    {t('housing.login.notice.intro')}
                </p>
                <ul className="housing-login-notice-list">
                    <li>{t('housing.login.notice.item1')}</li>
                    <li>{t('housing.login.notice.item2')}</li>
                    <li>{t('housing.login.notice.item3')}</li>
                </ul>
            </div>
            <button
                type="button"
                className="housing-login-discord-btn"
                onClick={handleDiscordClick}
            >
                <DiscordIcon />
                {t('housing.login.discordButton')}
            </button>
        </HousingPanelModal>
    );
};

const DiscordIcon: React.FC = () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
);
```

- [ ] **Step 5: テスト pass 確認**

Run: `rtk vitest run src/components/housing/login/__tests__/HousingLoginModal.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: commit**

```bash
rtk git add src/components/housing/login/HousingLoginModal.tsx src/components/housing/login/__tests__/HousingLoginModal.test.tsx
rtk git commit -m "feat(housing): HousingLoginModal を新規作成

未ログインユーザー向けの Discord ログイン誘導モーダル。
HousingPanelModal を流用しつつ、 hash 化後の「LoPo は連絡できない」
真実を反映した文言を 3 項目で説明。 fromRegister フラグで戻り URL に
?register=open を付与するため、 登録経由のログイン後に登録モーダルが
自動復元される。"
```

## Task 3.4: `HousingAccountModal.tsx` の実装

**Files:**
- Create: `src/components/housing/login/HousingAccountModal.tsx`
- Test: `src/components/housing/login/__tests__/HousingAccountModal.test.tsx`

- [ ] **Step 1: 失敗テストを書く**

`src/components/housing/login/__tests__/HousingAccountModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HousingAccountModal } from '../HousingAccountModal';

vi.mock('../../../../store/useAuthStore', () => ({
    useAuthStore: Object.assign(
        vi.fn((sel: any) => sel({
            user: { uid: 'test-uid' },
            isAdmin: false,
            profileDisplayName: 'Test User',
            profileAvatarUrl: null,
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('../../../../store/useHousingModalStore', () => ({
    useHousingModalStore: Object.assign(
        vi.fn((sel: any) => sel({
            account: { open: true },
            closeAccount: vi.fn(),
        })),
        { setState: vi.fn(), getState: vi.fn() },
    ),
}));

vi.mock('../../../../hooks/auth/useAccountActions', () => ({
    useAccountActions: () => ({
        uploadAvatar: vi.fn(),
        removeAvatar: vi.fn(),
        updateDisplayName: vi.fn(),
        signOut: vi.fn(),
        deleteAccount: vi.fn(),
    }),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k }),
}));

describe('HousingAccountModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders title and 5 sections', () => {
        render(
            <MemoryRouter>
                <HousingAccountModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.account.title')).toBeInTheDocument();
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('housing.account.signOut')).toBeInTheDocument();
        expect(screen.getByText('housing.account.deleteAccount')).toBeInTheDocument();
    });

    it('does not render admin link when isAdmin is false', () => {
        render(
            <MemoryRouter>
                <HousingAccountModal />
            </MemoryRouter>,
        );
        expect(screen.queryByText('housing.account.adminLink')).not.toBeInTheDocument();
    });

    it('renders admin link when isAdmin is true', async () => {
        const { useAuthStore } = await import('../../../../store/useAuthStore');
        (useAuthStore as any).mockImplementation((sel: any) =>
            sel({
                user: { uid: 'test-uid' },
                isAdmin: true,
                profileDisplayName: 'Admin User',
                profileAvatarUrl: null,
            }),
        );

        render(
            <MemoryRouter>
                <HousingAccountModal />
            </MemoryRouter>,
        );
        expect(screen.getByText('housing.account.adminLink')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: テスト fail 確認**

Run: `rtk vitest run src/components/housing/login/__tests__/HousingAccountModal.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: 本体実装**

`src/components/housing/login/HousingAccountModal.tsx`:

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, LogOut, Settings, Camera } from 'lucide-react';
import { HousingPanelModal } from '../HousingPanelModal';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { useAccountActions } from '../../../hooks/auth/useAccountActions';
import { ConfirmDialog } from '../../ConfirmDialog';
import { DisplayNameEditor } from '../../DisplayNameEditor';
import { AvatarCropModal } from '../../AvatarCropModal';
import { showToast } from '../../Toast';

/**
 * ハウジング画面のログイン済みユーザー向けアカウント設定モーダル。
 *
 * 5 機能:
 * - アバター編集 (AvatarCropModal 流用)
 * - 表示名編集 (DisplayNameEditor 流用)
 * - 管理画面リンク (admin のみ表示)
 * - ログアウト
 * - 退会 (ConfirmDialog 流用で確認ダイアログ)
 *
 * UI は housing トンマナで独立実装。 ロジックは useAccountActions 経由で LoPo と共通化。
 * サブコンポーネント (ConfirmDialog / DisplayNameEditor / AvatarCropModal) は
 * LoPo 版を流用 (ハウジング版は将来必要なら追加)。
 */
export const HousingAccountModal: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const open = useHousingModalStore(s => s.account.open);
    const closeAccount = useHousingModalStore(s => s.closeAccount);
    const isAdmin = useAuthStore(s => s.isAdmin);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);
    const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);
    const actions = useAccountActions();

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [isSavingName, setIsSavingName] = useState(false);
    const [showAvatarCrop, setShowAvatarCrop] = useState(false);
    const [isAvatarBusy, setIsAvatarBusy] = useState(false);

    const handleSaveName = async (newName: string) => {
        setIsSavingName(true);
        try {
            await actions.updateDisplayName(newName);
            setEditingName(false);
            showToast(t('profile.toast_name_updated'));
        } catch (err) {
            console.error('Display name update error:', err);
            showToast(t('profile.toast_name_error'), 'error');
        } finally {
            setIsSavingName(false);
        }
    };

    const handleAvatarComplete = async (blob: Blob) => {
        setIsAvatarBusy(true);
        setShowAvatarCrop(false);
        try {
            await actions.uploadAvatar(blob);
            showToast(t('avatar.toast_uploaded'));
        } catch (err) {
            console.error('Avatar upload error:', err);
            showToast(t('avatar.toast_upload_error'), 'error');
        } finally {
            setIsAvatarBusy(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await actions.deleteAccount();
            closeAccount();
            navigate('/');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleSignOut = async () => {
        await actions.signOut();
        closeAccount();
    };

    const handleAdminLink = () => {
        navigate('/admin');
        closeAccount();
    };

    if (!open) return null;

    return (
        <>
            <HousingPanelModal
                open={open}
                onClose={closeAccount}
                title={t('housing.account.title')}
                closeLabel={t('housing.account.closeLabel')}
                maxWidth={480}
                maxHeightRatio={0.86}
            >
                <div className="housing-account-profile">
                    <button
                        type="button"
                        className="housing-account-avatar"
                        onClick={() => setShowAvatarCrop(true)}
                        disabled={isAvatarBusy}
                        aria-label={t('housing.account.avatarChange')}
                    >
                        {profileAvatarUrl ? (
                            <img src={profileAvatarUrl} alt="" />
                        ) : (
                            <Camera size={24} />
                        )}
                    </button>
                    <div className="housing-account-info">
                        {editingName ? (
                            <DisplayNameEditor
                                value={profileDisplayName || ''}
                                onSave={handleSaveName}
                                onCancel={() => setEditingName(false)}
                                isSaving={isSavingName}
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong>{profileDisplayName || 'User'}</strong>
                                <button
                                    type="button"
                                    onClick={() => setEditingName(true)}
                                    aria-label={t('housing.account.displayNameEdit')}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: 4,
                                    }}
                                >
                                    <Pencil size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {isAdmin && (
                    <button
                        type="button"
                        className="housing-account-button"
                        onClick={handleAdminLink}
                    >
                        <Settings size={14} />
                        {t('housing.account.adminLink')}
                    </button>
                )}

                <button
                    type="button"
                    className="housing-account-button housing-account-button-danger"
                    onClick={handleSignOut}
                >
                    <LogOut size={14} />
                    {t('housing.account.signOut')}
                </button>

                <button
                    type="button"
                    className="housing-account-delete-link"
                    onClick={() => setShowDeleteConfirm(true)}
                >
                    {t('housing.account.deleteAccount')}
                </button>
            </HousingPanelModal>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                title={t('housing.account.deleteConfirmTitle')}
                message={isDeleting ? '...' : t('housing.account.deleteConfirmBody')}
                confirmLabel={t('housing.account.deleteConfirmYes')}
                variant="danger"
            />

            <AvatarCropModal
                isOpen={showAvatarCrop}
                onClose={() => setShowAvatarCrop(false)}
                onComplete={handleAvatarComplete}
            />
        </>
    );
};
```

注: 上記の `style={{ ... }}` 直書きは housing-design.md のハードコード禁止に抵触するため、 実装時に housing.css へ移行する。 ここでは構造を示すため意図的に inline で書いた。 commit 前に housing.css へ移して clean な状態にする。

- [ ] **Step 4: inline style を housing.css に移行**

`src/styles/housing.css` に追加:

```css
.housing-account-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
}
.housing-account-name-edit-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: var(--housing-text-soft);
}
.housing-account-name-edit-btn:hover {
    color: var(--housing-honey);
}
```

`HousingAccountModal.tsx` 内の inline style を className に置換:

```tsx
<div className="housing-account-name-row">
    <strong>{profileDisplayName || 'User'}</strong>
    <button
        type="button"
        onClick={() => setEditingName(true)}
        aria-label={t('housing.account.displayNameEdit')}
        className="housing-account-name-edit-btn"
    >
        <Pencil size={14} />
    </button>
</div>
```

- [ ] **Step 5: テスト pass 確認**

Run: `rtk vitest run src/components/housing/login/__tests__/HousingAccountModal.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: ハードコード自己レビュー**

Run: `rtk grep "rgb\(|rgba\(|#[0-9a-f]{3,8}|px;" src/components/housing/login/HousingAccountModal.tsx`
Run: `rtk grep "rgb\(|rgba\(|#[0-9a-f]{3,8}|px;" src/components/housing/login/HousingLoginModal.tsx`

Expected: 結果ゼロ (housing-design.md のハードコード禁止ルール準拠)

- [ ] **Step 7: commit**

```bash
rtk git add src/components/housing/login/HousingAccountModal.tsx src/components/housing/login/__tests__/HousingAccountModal.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing): HousingAccountModal を新規作成

ログイン済みユーザー向けアカウント設定モーダル。 5 機能 (avatar / displayName /
admin / signOut / delete) を housing トンマナで実装。 ロジックは useAccountActions
経由で LoPo と共通化。 サブコンポーネント (ConfirmDialog / DisplayNameEditor /
AvatarCropModal) は LoPo 版を流用 (YAGNI で housing 版は作らない)。"
```

## Task 3.5: TopBar 右端にログイン/アバターボタン追加

**Files:**
- Modify: `src/components/housing/workspace/TopBar.tsx`

- [ ] **Step 1: 現状確認**

Read: `src/components/housing/workspace/TopBar.tsx`

右側のボタン配置 (約 L109 付近) を確認。 「右パネルトグル」 の隣に新ボタンを追加する。

- [ ] **Step 2: import 追加**

```typescript
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
```

- [ ] **Step 3: コンポーネント内で hook 呼出**

TopBar コンポーネント内に追加:

```typescript
const user = useAuthStore(s => s.user);
const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);
const openLogin = useHousingModalStore(s => s.openLogin);
const openAccount = useHousingModalStore(s => s.openAccount);
```

- [ ] **Step 4: 右端ボタンを JSX に追加**

「右パネルトグル」 の直後 (右端) に以下を追加:

```tsx
{user ? (
    <button
        type="button"
        className="housing-top-avatar-btn"
        onClick={openAccount}
        aria-label={t('housing.topbar.account')}
        title={t('housing.topbar.account')}
    >
        {profileAvatarUrl ? (
            <img src={profileAvatarUrl} alt="" />
        ) : (
            <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
            }}>👤</span>
        )}
    </button>
) : (
    <button
        type="button"
        className="housing-top-login-btn"
        onClick={() => openLogin()}
    >
        {t('housing.topbar.login')}
    </button>
)}
```

inline style を housing.css に移行:

`src/styles/housing.css`:
```css
.housing-top-avatar-btn .housing-avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: var(--housing-text-base);
}
```

TopBar.tsx の inline style 部分を:
```tsx
<span className="housing-avatar-fallback">👤</span>
```

- [ ] **Step 5: モーダル本体を `HousingWorkspace` か `TopBar` に mount**

`HousingLoginModal` と `HousingAccountModal` は単一の DOM ツリーに 1 度だけ mount される必要がある。 一番自然なのは `HousingWorkspace.tsx` の root に追加:

```tsx
import { HousingLoginModal } from '../login/HousingLoginModal';
import { HousingAccountModal } from '../login/HousingAccountModal';

// ... HousingWorkspace JSX 内 (root の他 modal と並ぶ位置):
<HousingLoginModal />
<HousingAccountModal />
```

- [ ] **Step 6: 動作確認**

Run: `rtk pnpm dev`

ブラウザで `/housing` を開く:

1. 未ログイン状態: TopBar 右端に「ログイン」 pill ボタン → クリック → ログインモーダル開く → × → 閉じる
2. (Discord OAuth は次の Task で繋ぐので、 ここでは「ボタンが見えて開閉する」 のみ確認)

- [ ] **Step 7: commit**

```bash
rtk git add src/components/housing/workspace/TopBar.tsx src/components/housing/workspace/HousingWorkspace.tsx src/styles/housing.css
rtk git commit -m "feat(housing): TopBar 右端に login/account 切替ボタン追加

未ログイン → pill 形 'ログイン' ボタン、 ログイン済 → アバター丸。
HousingWorkspace に HousingLoginModal / HousingAccountModal を mount。
useAuthStore.user で表示分岐、 クリックで対応モーダル open。"
```

## Task 3.6: 登録モーダル内「ログインしてください」 を HousingLoginModal に接続

**Files:**
- Modify: `src/components/housing/register/HousingRegisterFormModal.tsx` (or `HousingRegisterForm.tsx` の未ログイン時表示部分)

- [ ] **Step 1: 現状調査**

Run: `rtk grep "ログイン" src/components/housing/register/`
Run: `rtk grep "signInWith\|signIn" src/components/housing/register/`

未ログイン時にユーザーへログインを促すリンク・ボタンを特定する。 該当箇所が複数あれば全て修正対象。

- [ ] **Step 2: ログインリンクのハンドラを openLogin に置換**

該当箇所で:

(変更前 例):
```tsx
<button onClick={() => signInWith('discord')}>{t('login.signInWith')}</button>
```

(変更後):
```tsx
import { useHousingModalStore } from '../../../store/useHousingModalStore';
// ...
const openLogin = useHousingModalStore(s => s.openLogin);

<button onClick={() => openLogin({ fromRegister: true })}>
    {t('housing.login.title')}
</button>
```

`fromRegister: true` を付けることで、 ログインモーダルから Discord ボタンを押した時に戻り URL に `?register=open` が含まれ、 OAuth 完了後に登録モーダルが auto open する。

- [ ] **Step 3: 動作確認**

Run: `rtk pnpm dev`

ブラウザで `/housing` (未ログイン状態):
1. TopBar の「登録」 ボタン → 登録モーダル開く → URL が `/housing?register=open`
2. 登録モーダル内の「ログインしてください」 リンク (該当があれば) → HousingLoginModal 開く (スタッキング)
3. ログインモーダルの × → 登録モーダルも一緒に閉じる + URL クリア (経路 B × b 挙動)
4. もう一度同じ流れで Discord ボタン → OAuth → 戻り後に登録モーダル auto open + TopBar アバター丸表示

- [ ] **Step 4: commit**

```bash
rtk git add src/components/housing/register/
rtk git commit -m "feat(housing): 登録モーダルのログイン誘導を HousingLoginModal に接続

openLogin({ fromRegister: true }) で経路 B フラグを立てる。 OAuth 戻り後の
登録モーダル auto open を実現する最終結合。"
```

## Task 3.7: モーダルスタッキング (z-index 調整)

**Files:**
- Modify: `src/styles/housing.css`

- [ ] **Step 1: 現状の z-index 確認**

Run: `rtk grep "z-index" src/styles/housing.css`

`housing-panel-modal-backdrop` の z-index を確認 (デフォルトで設定済のはず)。 通常 50 程度。

- [ ] **Step 2: z-index を 2 段階に分ける**

`src/styles/housing.css`:

```css
/* 登録モーダル (背後にロックされる) */
.housing-panel-modal-backdrop[data-modal-role="register"] {
    z-index: var(--housing-z-modal-base, 50);
}

/* ログインモーダル (手前にスタック) */
.housing-panel-modal-backdrop[data-modal-role="login"] {
    z-index: var(--housing-z-modal-stack, 60);
}

/* アカウントモーダル (login と同階層、 同時に開かれない前提) */
.housing-panel-modal-backdrop[data-modal-role="account"] {
    z-index: var(--housing-z-modal-stack, 60);
}
```

`.housing-workspace` ブロック内:
```css
--housing-z-modal-base: 50;
--housing-z-modal-stack: 60;
```

- [ ] **Step 3: 各モーダルに `data-modal-role` 属性を渡す**

HousingPanelModal の props を拡張するか、 各モーダルが open 時に backdrop に attribute を付けるか。

最小変更案: HousingPanelModal の props に `modalRole?: string` を追加し、 backdrop の `<div>` に `data-modal-role={modalRole}` を付ける。

`src/components/housing/HousingPanelModal.tsx`:

```typescript
export interface HousingPanelModalProps {
    // ... 既存 props ...
    modalRole?: 'register' | 'login' | 'account';
}

// ... コンポーネント内:
<div
    className="housing-panel-modal-backdrop"
    data-modal-role={modalRole}
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onClick={handleBackdropClick}
>
```

各モーダル呼出側で `modalRole` を渡す:
- `HousingLoginModal`: `modalRole="login"`
- `HousingAccountModal`: `modalRole="account"`
- 登録モーダル: `modalRole="register"`

- [ ] **Step 4: 動作確認**

Run: `rtk pnpm dev`

ブラウザで:
1. 登録モーダル開く → 登録モーダル背景 + 登録モーダル本体表示
2. 登録モーダル内のログインリンクを click → ログインモーダルが**登録モーダルの上**に重なって表示される
3. 登録モーダル本体 (背後) はクリックしても反応しない (重なってる ログインモーダルが捕捉)

- [ ] **Step 5: commit**

```bash
rtk git add src/styles/housing.css src/components/housing/HousingPanelModal.tsx src/components/housing/login/HousingLoginModal.tsx src/components/housing/login/HousingAccountModal.tsx src/components/housing/register/
rtk git commit -m "feat(housing): モーダルスタッキング (z-index 50/60) 対応

登録モーダル背後 (50) + ログインモーダル手前 (60) の 2 層構造。
HousingPanelModal に modalRole prop 追加し、 backdrop の data-modal-role
属性で CSS から z-index を切り替え。"
```

## Task 3.8: 最終確認とデプロイ

- [ ] **Step 1: build 通過確認**

Run: `rtk npm run build`
Expected: ビルド成功

- [ ] **Step 2: vitest 全 pass**

Run: `rtk vitest run`
Expected: 全 test PASS

- [ ] **Step 3: housing 配下のハードコード自己レビュー**

Run: `rtk grep "rgb\(|rgba\(|#[0-9a-f]{3,8}|px;" src/components/housing/login/`
Run: `rtk grep "rgb\(|rgba\(|#[0-9a-f]{3,8}|px;" src/components/housing/workspace/TopBar.tsx`

Expected: 結果ゼロ。 残っていたら token 化する。

- [ ] **Step 4: 全シナリオ手動テスト (人柱)**

masaya-men さん本人で以下を実行:

| シナリオ | 期待動作 |
|---|---|
| 未ログインで TopBar の「ログイン」 ボタン → × | LoginModal 開く → 閉じる (経路 A) |
| 未ログインで TopBar の「登録」 → 「ログインしてください」 → × | 両方閉じる + URL クリア (経路 B × b) |
| 上記の続きで Discord ボタン → OAuth | 戻ってきたら登録モーダル auto open + アバター丸 |
| ログイン済で TopBar のアバター丸 → AccountModal | アバター・displayName 編集 + 管理画面 (admin) + ログアウト |
| AccountModal で退会リンク → ConfirmDialog → キャンセル | 退会されない |
| 登録モーダル開いてブラウザバック | モーダル閉じる (β 方式) |
| `/housing?register=open` を直接 URL バーに | 登録モーダル auto open |
| 言語切替 (en/ko/zh) で LoginModal | ja の文言がフォールバックで表示される |

- [ ] **Step 5: Vercel preview デプロイ**

```bash
rtk git push origin main
```

(注: PR 1, 2, 3 を 1 push にまとめている場合は、 これが本番デプロイ)

Vercel ダッシュボードでビルド成功確認。

- [ ] **Step 6: 本番動作確認**

本番 URL で Step 4 のシナリオを再確認 (本人 admin claim での退会は実行しない)。

- [ ] **Step 7: docs/TODO.md 更新**

「次セッション最優先: ハウジング ログイン UI 整備の再開」 を [TODO_COMPLETED.md](../../TODO_COMPLETED.md) に移動。 「次セッション最優先」 を Phase 2B (マップ書き起こし) に更新。

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(housing-login): 完了記録 + 次セッション最優先を Phase 2B に更新"
rtk git push origin main
```

---

## Self-Review Notes

実装時の注意点:

1. **HousingPanelModal の modalRole 属性は data attribute なので React は string で受ける**: TypeScript の union 型でも `data-*` 属性として渡せば DOM 上は string になる。

2. **i18next の returnEmptyString**: 既存設定で `true` (デフォルト) のままなら、 en/ko/zh の空文字が「翻訳済み」 と解釈されてフォールバック動作しない。 設定確認とドキュメント反映を Task 3.1 で必ず行う。

3. **HousingAccountModal の inline style 残留チェック**: Task 3.4 Step 4 で housing.css に移行したが、 実装過程で新たに inline style を書かないよう grep 確認 (Task 3.4 Step 6, Task 3.8 Step 3)。

4. **既存「ハウジング 6 項目」 のうち、 fieldState.confirm() バグや UX 磨き等は本プラン対象外**: TODO.md L33-36 のリストの他項目は別タスクとして残す。

5. **Vercel ビルド回数の節約**: PR 1, 2, 3 を分けて push せず、 全 Task 完了後に 1 回にまとめて push する (memory `feedback_vercel_builds.md`)。
