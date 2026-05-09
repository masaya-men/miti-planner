# ハウジング Phase B-3: アバター/表示名変更 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LoginModal のログイン済み画面で、アバター画像と表示名をいつでも変更できるようにする (現状は初回ログイン時の WelcomeSetup でしか設定できない)

**Architecture:** 既存資産 (`AvatarCropModal` / `uploadAvatar` / `deleteAvatar` / `ConfirmDialog` / `showToast`) を LoginModal に配線するだけ。新規ロジックは表示名 update 関数のみ。

**Tech Stack:** React + TypeScript + Zustand (`useAuthStore`) + Firebase Storage/Firestore + react-i18next + Tailwind v4 + lucide-react + vitest + happy-dom

**設計書:** [docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md](../specs/2026-05-08-housing-phase-b-account-link-design.md) §7

---

## ファイル構造

| ファイル | 役割 | 操作 |
|---|---|---|
| `src/components/DisplayNameEditor.tsx` | 表示名のインライン編集 (input + 保存/キャンセル) | **新規作成** |
| `src/components/DisplayNameEditor.test.tsx` | DisplayNameEditor のユニットテスト | **新規作成** |
| `src/store/useAuthStore.ts` | `updateDisplayName(name)` action 追加 | **修正** ([useAuthStore.ts:38-52](../../../src/store/useAuthStore.ts#L38-L52) の AuthState インタフェース、`signOut` 関数の前後に action 追加) |
| `src/components/LoginModal.tsx` | アバタークリック化 + 表示名鉛筆編集 + アバター削除リンク | **修正** ([LoginModal.tsx:106-172](../../../src/components/LoginModal.tsx#L106-L172) ログイン済みブロック) |
| `src/locales/ja.json` | i18n キー追加 (`profile.*`, `avatar.delete_button`, `avatar.toast_*`) | **修正** |
| `src/locales/en.json` | 同上 (英訳) | **修正** |
| `src/locales/ko.json` | 同上 (韓訳) | **修正** |
| `src/locales/zh.json` | 同上 (中訳) | **修正** |

---

## Task 1: i18n キーを 4 言語に追加

**Files:**
- Modify: `src/locales/ja.json` (既存 `avatar` セクション末尾に追加 + `profile` セクション新規追加)
- Modify: `src/locales/en.json` (同上)
- Modify: `src/locales/ko.json` (同上)
- Modify: `src/locales/zh.json` (同上)

**説明:** B-3 で必要な i18n キーを 4 言語に追加する。既存の `avatar` セクションに削除/トースト関連を追記、新規 `profile` セクションで表示名編集関連を追加。

- [ ] **Step 1: ja.json に追加**

`src/locales/ja.json` の既存 `"avatar": { ... }` セクション内、`"error_too_large"` の **直後** に次のキーを追加:

```json
"delete_button": "アイコンを削除",
"delete_confirm_title": "アイコンを削除しますか?",
"delete_confirm_body": "削除すると、表示名の頭文字が代わりに表示されます。",
"delete_confirm_yes": "削除する",
"toast_uploaded": "アイコンを変更しました",
"toast_deleted": "アイコンを削除しました",
"toast_upload_error": "アップロードに失敗しました"
```

加えて `"avatar"` セクションの **直後** (新規セクション) に次を追加:

```json
"profile": {
    "edit_display_name": "表示名を編集",
    "save": "保存",
    "cancel": "キャンセル",
    "name_too_short": "表示名を入力してください",
    "name_too_long": "表示名は30文字以内で入力してください",
    "toast_name_updated": "表示名を変更しました",
    "toast_name_error": "表示名の変更に失敗しました"
},
```

- [ ] **Step 2: en.json に同じ構造で英訳を追加**

`avatar` セクション内に追加:
```json
"delete_button": "Remove avatar",
"delete_confirm_title": "Remove avatar?",
"delete_confirm_body": "Your display name initial will be shown instead.",
"delete_confirm_yes": "Remove",
"toast_uploaded": "Avatar updated",
"toast_deleted": "Avatar removed",
"toast_upload_error": "Upload failed"
```

新規 `profile` セクション:
```json
"profile": {
    "edit_display_name": "Edit display name",
    "save": "Save",
    "cancel": "Cancel",
    "name_too_short": "Display name is required",
    "name_too_long": "Display name must be 30 characters or fewer",
    "toast_name_updated": "Display name updated",
    "toast_name_error": "Failed to update display name"
},
```

- [ ] **Step 3: ko.json に韓訳を追加**

`avatar` セクション内:
```json
"delete_button": "아이콘 삭제",
"delete_confirm_title": "아이콘을 삭제하시겠습니까?",
"delete_confirm_body": "삭제하면 표시 이름의 첫 글자가 대신 표시됩니다.",
"delete_confirm_yes": "삭제",
"toast_uploaded": "아이콘이 변경되었습니다",
"toast_deleted": "아이콘이 삭제되었습니다",
"toast_upload_error": "업로드에 실패했습니다"
```

新規 `profile` セクション:
```json
"profile": {
    "edit_display_name": "표시 이름 편집",
    "save": "저장",
    "cancel": "취소",
    "name_too_short": "표시 이름을 입력해 주세요",
    "name_too_long": "표시 이름은 30자 이내로 입력해 주세요",
    "toast_name_updated": "표시 이름이 변경되었습니다",
    "toast_name_error": "표시 이름 변경에 실패했습니다"
},
```

- [ ] **Step 4: zh.json に中訳を追加**

`avatar` セクション内:
```json
"delete_button": "删除头像",
"delete_confirm_title": "确定要删除头像吗?",
"delete_confirm_body": "删除后将显示昵称首字符作为替代。",
"delete_confirm_yes": "删除",
"toast_uploaded": "头像已更新",
"toast_deleted": "头像已删除",
"toast_upload_error": "上传失败"
```

新規 `profile` セクション:
```json
"profile": {
    "edit_display_name": "编辑昵称",
    "save": "保存",
    "cancel": "取消",
    "name_too_short": "请输入昵称",
    "name_too_long": "昵称不能超过 30 个字符",
    "toast_name_updated": "昵称已更新",
    "toast_name_error": "昵称更新失败"
},
```

- [ ] **Step 5: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし (i18n キーは型推論されないので JSON 構文エラーがなければ通る)

- [ ] **Step 6: ビルド時に JSON が壊れていないか確認**

Run: `node -e "['ja','en','ko','zh'].forEach(l => JSON.parse(require('fs').readFileSync('src/locales/'+l+'.json','utf8')))"`
Expected: エラーなし、何も表示されない

- [ ] **Step 7: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "$(cat <<'EOF'
i18n(housing-b3): アバター削除と表示名編集の翻訳キーを 4 言語追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `useAuthStore.updateDisplayName` action を追加

**Files:**
- Modify: `src/store/useAuthStore.ts` (AuthState インタフェース + create() 内に追加)
- Modify or Create: `src/store/useAuthStore.test.ts` (テストファイル既存ならテストケース追加、なければ新規作成)

**説明:** Firestore `users/{uid}.displayName` を更新し、`profileDisplayName` state を更新する action を追加する。検証 (1〜30 文字) を含める。

- [ ] **Step 1: テストファイルの存在を確認**

Run: `ls src/store/useAuthStore.test.ts 2>/dev/null && echo EXISTS || echo NEW`

- 既存なら既存 describe ブロックに追加、新規なら新規ファイル作成

- [ ] **Step 2: テストを書く (失敗するテスト)**

`src/store/useAuthStore.test.ts` に下記テストケースを追加 (既存の場合は describe の中に追記、新規の場合は下記をファイル全体として作成):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';

// Firebase の updateDoc をモック化
vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
    return {
        ...actual,
        updateDoc: vi.fn(async () => undefined),
        doc: vi.fn(() => ({ id: 'mock-doc' })),
    };
});

vi.mock('../lib/firebase', () => ({
    auth: { currentUser: { uid: 'test-uid' } },
    db: {},
    storage: {},
}));

describe('useAuthStore.updateDisplayName', () => {
    beforeEach(() => {
        useAuthStore.setState({
            user: { uid: 'test-uid' } as any,
            profileDisplayName: 'OldName',
        });
    });

    it('成功時に profileDisplayName を更新する', async () => {
        await useAuthStore.getState().updateDisplayName('NewName');
        expect(useAuthStore.getState().profileDisplayName).toBe('NewName');
    });

    it('空文字は拒否してエラーを投げる', async () => {
        await expect(useAuthStore.getState().updateDisplayName('')).rejects.toThrow();
        expect(useAuthStore.getState().profileDisplayName).toBe('OldName');
    });

    it('31 文字以上は拒否してエラーを投げる', async () => {
        const tooLong = 'a'.repeat(31);
        await expect(useAuthStore.getState().updateDisplayName(tooLong)).rejects.toThrow();
        expect(useAuthStore.getState().profileDisplayName).toBe('OldName');
    });

    it('未ログイン時は拒否してエラーを投げる', async () => {
        useAuthStore.setState({ user: null });
        await expect(useAuthStore.getState().updateDisplayName('AnyName')).rejects.toThrow();
    });

    it('前後の空白をトリムして保存する', async () => {
        await useAuthStore.getState().updateDisplayName('  Trimmed  ');
        expect(useAuthStore.getState().profileDisplayName).toBe('Trimmed');
    });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npx vitest run src/store/useAuthStore.test.ts`
Expected: FAIL — `useAuthStore.getState().updateDisplayName is not a function`

- [ ] **Step 4: 実装を追加**

`src/store/useAuthStore.ts` の `AuthState` インタフェース ([useAuthStore.ts:38-52](../../../src/store/useAuthStore.ts#L38-L52)) に下記を追加 (`signOut: () => Promise<void>;` の **直前**):

```typescript
updateDisplayName: (newName: string) => Promise<void>;
```

`useAuthStore = create<AuthState>(...)` の中、`signOut: async () => { ... }` の **直前** (= `signInWith` action の後) に下記を追加:

```typescript
updateDisplayName: async (newName: string) => {
    const trimmed = newName.trim();
    if (trimmed.length < 1) throw new Error('name_too_short');
    if (trimmed.length > 30) throw new Error('name_too_long');

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('not_signed_in');

    const userRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
    await updateDoc(userRef, {
        displayName: trimmed,
        updatedAt: new Date().toISOString(),
    });

    set({ profileDisplayName: trimmed });
},
```

import に `updateDoc` が含まれていない場合は追加:

```typescript
import { doc, collection, getDocs, getDoc, query, where, writeBatch, updateDoc } from 'firebase/firestore';
```

- [ ] **Step 5: テストを実行して合格を確認**

Run: `npx vitest run src/store/useAuthStore.test.ts`
Expected: PASS — 5 tests passed

- [ ] **Step 6: 既存テスト全体に regression がないか確認**

Run: `npx vitest run`
Expected: 全件 PASS (既存 445 + 新規 5 = 450 程度)

- [ ] **Step 7: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
rtk git add src/store/useAuthStore.ts src/store/useAuthStore.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(auth): useAuthStore に updateDisplayName action を追加

Firestore users/{uid}.displayName を更新し、state.profileDisplayName を反映。
バリデーション (1-30 文字、未ログイン拒否、トリム) 含む。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: DisplayNameEditor コンポーネントを TDD で作成

**Files:**
- Create: `src/components/DisplayNameEditor.tsx`
- Create: `src/components/DisplayNameEditor.test.tsx`

**説明:** 表示名のインライン編集コンポーネント。input + 保存/キャンセルボタン + バリデーションエラー表示。LoginModal から `<DisplayNameEditor value={...} onSave={...} onCancel={...} />` で使う。

- [ ] **Step 1: テストファイルを書く (失敗するテスト)**

`src/components/DisplayNameEditor.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisplayNameEditor } from './DisplayNameEditor';

// i18n モック
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

describe('DisplayNameEditor', () => {
    it('初期値を input に表示する', () => {
        render(<DisplayNameEditor value="InitialName" onSave={vi.fn()} onCancel={vi.fn()} />);
        const input = screen.getByDisplayValue('InitialName') as HTMLInputElement;
        expect(input).toBeDefined();
    });

    it('30 文字以内では保存ボタンが有効', () => {
        render(<DisplayNameEditor value="InitialName" onSave={vi.fn()} onCancel={vi.fn()} />);
        const saveBtn = screen.getByRole('button', { name: /profile.save/i });
        expect((saveBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('空文字では保存ボタンが無効', () => {
        render(<DisplayNameEditor value="" onSave={vi.fn()} onCancel={vi.fn()} />);
        const saveBtn = screen.getByRole('button', { name: /profile.save/i });
        expect((saveBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('保存ボタンクリックで onSave(trimmed) が呼ばれる', () => {
        const onSave = vi.fn();
        render(<DisplayNameEditor value="  Hello  " onSave={onSave} onCancel={vi.fn()} />);
        const saveBtn = screen.getByRole('button', { name: /profile.save/i });
        fireEvent.click(saveBtn);
        expect(onSave).toHaveBeenCalledWith('Hello');
    });

    it('キャンセルボタンクリックで onCancel が呼ばれる', () => {
        const onCancel = vi.fn();
        render(<DisplayNameEditor value="InitialName" onSave={vi.fn()} onCancel={onCancel} />);
        const cancelBtn = screen.getByRole('button', { name: /profile.cancel/i });
        fireEvent.click(cancelBtn);
        expect(onCancel).toHaveBeenCalled();
    });

    it('Enter キーで保存実行', () => {
        const onSave = vi.fn();
        render(<DisplayNameEditor value="Hello" onSave={onSave} onCancel={vi.fn()} />);
        const input = screen.getByDisplayValue('Hello');
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSave).toHaveBeenCalledWith('Hello');
    });

    it('Escape キーでキャンセル実行', () => {
        const onCancel = vi.fn();
        render(<DisplayNameEditor value="Hello" onSave={vi.fn()} onCancel={onCancel} />);
        const input = screen.getByDisplayValue('Hello');
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(onCancel).toHaveBeenCalled();
    });

    it('文字数カウンタを表示する (例: 5/30)', () => {
        render(<DisplayNameEditor value="Hello" onSave={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getByText('5/30')).toBeDefined();
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/DisplayNameEditor.test.tsx`
Expected: FAIL — `Cannot find module './DisplayNameEditor'`

- [ ] **Step 3: DisplayNameEditor 実装を書く**

`src/components/DisplayNameEditor.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';

interface DisplayNameEditorProps {
    value: string;
    onSave: (trimmedName: string) => void;
    onCancel: () => void;
    isSaving?: boolean;
}

export const DisplayNameEditor: React.FC<DisplayNameEditorProps> = ({
    value, onSave, onCancel, isSaving = false,
}) => {
    const { t } = useTranslation();
    const [name, setName] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const trimmed = name.trim();
    const isValid = trimmed.length >= 1 && trimmed.length <= 30;

    const handleSave = () => {
        if (!isValid || isSaving) return;
        onSave(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onCancel();
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={e => {
                        if (e.target.value.length <= 30) setName(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    maxLength={30}
                    disabled={isSaving}
                    className={clsx(
                        "w-full px-3 py-2 rounded-lg text-[16px] md:text-app-lg text-app-text",
                        "bg-transparent border border-app-border",
                        "focus:outline-none focus:border-app-text/40 transition-colors",
                        "disabled:opacity-50"
                    )}
                />
                <span className={clsx(
                    "absolute right-2 bottom-2 text-app-base",
                    name.length >= 30 ? "text-yellow-500" : "text-app-text-muted/50"
                )}>
                    {name.length}/30
                </span>
            </div>
            <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label={t('profile.cancel')}
                    className={clsx(
                        "px-3 py-1.5 rounded-lg text-app-base flex items-center gap-1 transition-all duration-200 cursor-pointer",
                        "text-app-text-muted hover:text-app-text border border-app-border hover:border-app-text/40 active:scale-95"
                    )}
                >
                    <X size={14} />
                    {t('profile.cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!isValid || isSaving}
                    aria-label={t('profile.save')}
                    className={clsx(
                        "px-3 py-1.5 rounded-lg text-app-base flex items-center gap-1 transition-all duration-200",
                        isValid && !isSaving
                            ? "bg-app-toggle text-app-toggle-text hover:opacity-90 active:scale-95 cursor-pointer"
                            : "bg-app-text/20 text-app-text-muted cursor-not-allowed"
                    )}
                >
                    <Check size={14} />
                    {t('profile.save')}
                </button>
            </div>
        </div>
    );
};
```

- [ ] **Step 4: テストを実行して合格を確認**

Run: `npx vitest run src/components/DisplayNameEditor.test.tsx`
Expected: PASS — 8 tests passed

- [ ] **Step 5: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/DisplayNameEditor.tsx src/components/DisplayNameEditor.test.tsx
rtk git commit -m "$(cat <<'EOF'
feat(auth): DisplayNameEditor インライン編集コンポーネント追加

input + 保存/キャンセルボタン、Enter保存・Escapeキャンセル、文字数カウンタ。
WelcomeSetup と同じスタイル系統で統一。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: LoginModal に表示名編集を統合

**Files:**
- Modify: `src/components/LoginModal.tsx` (ログイン済み画面の表示名表示部分)

**説明:** ログイン済み画面で表示名の右に鉛筆アイコンを置き、クリックで `DisplayNameEditor` に切り替える。保存時に `useAuthStore.updateDisplayName()` を呼んでトーストを出す。

- [ ] **Step 1: import 追加**

`src/components/LoginModal.tsx` の import セクションに次を追加:

```typescript
import { Pencil } from 'lucide-react';
import { DisplayNameEditor } from './DisplayNameEditor';
import { showToast } from './Toast';
```

既存の `import { X, LogOut, Shield } from 'lucide-react';` 行は次のように修正:

```typescript
import { X, LogOut, Shield, Pencil } from 'lucide-react';
```

(既存の Settings は別 import 行なのでそのまま、Pencil は同じ行に追加)

- [ ] **Step 2: state 追加**

`LoginModal` 関数コンポーネント内、`const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);` の **直後** に追加:

```typescript
const [editingName, setEditingName] = React.useState(false);
const [isSavingName, setIsSavingName] = React.useState(false);
const updateDisplayName = useAuthStore(s => s.updateDisplayName);

const handleSaveDisplayName = async (newName: string) => {
    setIsSavingName(true);
    try {
        await updateDisplayName(newName);
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

- [ ] **Step 3: 表示名表示部分を編集モード対応に修正**

`<div className="min-w-0">` のブロック ([LoginModal.tsx:117-128](../../../src/components/LoginModal.tsx#L117-L128)) を次に置き換える:

```tsx
<div className="min-w-0 flex-1">
    {editingName ? (
        <DisplayNameEditor
            value={profileDisplayName || ''}
            onSave={handleSaveDisplayName}
            onCancel={() => setEditingName(false)}
            isSaving={isSavingName}
        />
    ) : (
        <>
            <div className="flex items-center gap-1.5">
                <div className="text-app-xl font-bold text-app-text truncate">
                    {profileDisplayName || 'User'}
                </div>
                <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    aria-label={t('profile.edit_display_name')}
                    title={t('profile.edit_display_name')}
                    className="p-1 rounded text-app-text-muted/60 hover:text-app-text hover:bg-app-surface2/50 transition-colors cursor-pointer shrink-0"
                >
                    <Pencil size={12} />
                </button>
            </div>
            <div className="text-app-md text-app-text-muted truncate flex items-center gap-1">
                {user.uid.startsWith('discord:') ? 'Discord'
                    : user.uid.startsWith('twitter:') ? 'X (Twitter)'
                        : ''}
                {t('app.sign_in_via')}
            </div>
        </>
    )}
</div>
```

- [ ] **Step 4: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: 既存テスト regression チェック**

Run: `npx vitest run`
Expected: 全件 PASS

- [ ] **Step 6: 開発サーバーで実機目視確認**

Run: `npm run dev` (別ターミナルで)
ブラウザで http://localhost:5173 を開いてログイン → アバターアイコンをクリックして LoginModal を開く → 表示名右の鉛筆アイコン押下 → 編集 UI 表示 → 保存トーストが出る → モーダル閉じて再度開いても新しい表示名が反映されている

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/LoginModal.tsx
rtk git commit -m "$(cat <<'EOF'
feat(auth): LoginModal に表示名インライン編集を統合

鉛筆アイコン押下で DisplayNameEditor に切り替え、保存時に Firestore 更新+トースト。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: LoginModal にアバタークリック化と削除リンクを統合

**Files:**
- Modify: `src/components/LoginModal.tsx`

**説明:** ログイン済み画面のアバター画像 (40x40) をクリック可能にして、押下で `AvatarCropModal` を開く。アップロード成功時に `uploadAvatar()` を呼んで state 更新。アバター設定済み時のみアバター直下に控えめな「アイコンを削除」リンクを表示し、押下で `ConfirmDialog` → `deleteAvatar()`。

- [ ] **Step 1: import 追加**

`src/components/LoginModal.tsx` の import セクションに次を追加:

```typescript
import { Camera } from 'lucide-react';
import { AvatarCropModal } from './AvatarCropModal';
import { uploadAvatar, deleteAvatar } from '../utils/avatarUpload';
```

既存 `import { X, LogOut, Shield, Pencil } from 'lucide-react';` 行に `Camera` を追加:

```typescript
import { X, LogOut, Shield, Pencil, Camera } from 'lucide-react';
```

- [ ] **Step 2: state 追加**

`LoginModal` 関数コンポーネント内、Task 4 で追加した state の直後に追加:

```typescript
const [showAvatarCrop, setShowAvatarCrop] = React.useState(false);
const [showDeleteAvatarConfirm, setShowDeleteAvatarConfirm] = React.useState(false);
const [isAvatarBusy, setIsAvatarBusy] = React.useState(false);

const handleAvatarComplete = async (blob: Blob) => {
    if (!user) return;
    setIsAvatarBusy(true);
    setShowAvatarCrop(false);
    try {
        const url = await uploadAvatar(user.uid, blob);
        useAuthStore.setState({ profileAvatarUrl: url });
        showToast(t('avatar.toast_uploaded'));
    } catch (err) {
        console.error('Avatar upload error:', err);
        showToast(t('avatar.toast_upload_error'), 'error');
    } finally {
        setIsAvatarBusy(false);
    }
};

const handleDeleteAvatar = async () => {
    if (!user) return;
    setIsAvatarBusy(true);
    setShowDeleteAvatarConfirm(false);
    try {
        await deleteAvatar(user.uid);
        useAuthStore.setState({ profileAvatarUrl: null });
        showToast(t('avatar.toast_deleted'));
    } catch (err) {
        console.error('Avatar delete error:', err);
        showToast(t('avatar.toast_upload_error'), 'error');
    } finally {
        setIsAvatarBusy(false);
    }
};
```

- [ ] **Step 3: アバター表示部分をクリッカブル化**

既存のアバター表示ブロック ([LoginModal.tsx:108-117](../../../src/components/LoginModal.tsx#L108-L117) 付近、`{profileAvatarUrl ? <img ... /> : <div ... />}` 部分) を次に置き換える:

```tsx
<div className="flex flex-col items-center gap-1 shrink-0">
    <button
        type="button"
        onClick={() => setShowAvatarCrop(true)}
        disabled={isAvatarBusy}
        aria-label={t('avatar.change')}
        title={t('avatar.change')}
        className={clsx(
            "relative w-10 h-10 rounded-full overflow-hidden cursor-pointer group",
            "border border-app-border hover:border-app-text/40 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
    >
        {profileAvatarUrl ? (
            <img src={profileAvatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
            <div className="w-full h-full bg-app-surface2 flex items-center justify-center">
                <span className="text-app-xl font-bold text-app-text">{(profileDisplayName || 'U').charAt(0).toUpperCase()}</span>
            </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera size={14} className="text-white" />
        </div>
    </button>
    {profileAvatarUrl && (
        <button
            type="button"
            onClick={() => setShowDeleteAvatarConfirm(true)}
            disabled={isAvatarBusy}
            className="text-[10px] text-app-text-muted/50 hover:text-app-text-muted transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {t('avatar.delete_button')}
        </button>
    )}
</div>
```

- [ ] **Step 4: モーダルの末尾 (return の Modal `</div>` の直前) に AvatarCropModal と削除確認 ConfirmDialog を追加**

LoginModal 関数の `return createPortal(...)` 内、ログイン済みブロックの **直後**、`</div>` (Modal 終端) の直前に次を追加:

```tsx
{user && (
    <>
        <AvatarCropModal
            isOpen={showAvatarCrop}
            onClose={() => setShowAvatarCrop(false)}
            onComplete={handleAvatarComplete}
        />
        <ConfirmDialog
            isOpen={showDeleteAvatarConfirm}
            onConfirm={handleDeleteAvatar}
            onCancel={() => setShowDeleteAvatarConfirm(false)}
            title={t('avatar.delete_confirm_title')}
            message={t('avatar.delete_confirm_body')}
            confirmLabel={t('avatar.delete_confirm_yes')}
            variant="danger"
        />
    </>
)}
```

- [ ] **Step 5: tsc 通過確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: 既存テスト regression チェック**

Run: `npx vitest run`
Expected: 全件 PASS

- [ ] **Step 7: ビルド確認**

Run: `npm run build`
Expected: 成功 (Vercel 厳密 tsc も通る確認)

- [ ] **Step 8: 開発サーバーで実機目視確認**

シナリオ:
1. ログイン → LoginModal を開く
2. アバター画像をクリック → AvatarCropModal が開く
3. 画像選択 → クロップ → 確定 → トースト「アイコンを変更しました」
4. LoginModal を閉じて再度開く → 新しいアバターが表示されている
5. アバター直下「アイコンを削除」リンクをクリック → 確認ダイアログ → 削除 → トースト「アイコンを削除しました」、イニシャル文字に戻る
6. 4 言語 (ja/en/ko/zh) で切り替えて文字が崩れないこと

- [ ] **Step 9: コミット**

```bash
rtk git add src/components/LoginModal.tsx
rtk git commit -m "$(cat <<'EOF'
feat(auth): LoginModal でアバター画像変更/削除を可能に

クリックで AvatarCropModal を開き uploadAvatar 呼び出し、控えめな削除リンクで
ConfirmDialog 経由 deleteAvatar 呼び出し。トースト通知付き。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 全体ビルド + デプロイ準備

**Files:** なし (ビルド/テスト/動作確認のみ)

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: 全件 PASS、新規テスト 13 件 (5 store + 8 editor) 増加

- [ ] **Step 2: tsc 厳密チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 本番ビルド**

Run: `npm run build`
Expected: 成功、warnings は許容 (既存のものなら無視)

- [ ] **Step 4: dev サーバーで最終確認**

Run: `npm run dev`

実機検証チェックリスト (`docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md` §9.4 の B-3 該当部分):
- [ ] LoginModal でアバタークリック → クロップ → 反映
- [ ] LoginModal で表示名鉛筆 → 編集 → 保存 → 反映
- [ ] 4 言語 (ja/en/ko/zh) で全 UI 文字列が表示 (英語/韓国語/中国語表示崩れチェック含む)

問題があればこのタスクは「pending」のまま、修正してから次に進める。

- [ ] **Step 5: docs/TODO.md 更新**

`docs/TODO.md` の「現在の状態」セクション最上部 (line 14 付近) に次のような新セクションを追加:

```markdown
- **最新セッション（2026-05-08 Phase B-3 完了・アバター/表示名変更）**: LoginModal でアバター画像をクリックするとクロップモーダルが開き変更可能、表示名横の鉛筆アイコンでインライン編集可能、アバター削除リンクで ConfirmDialog 経由削除可。i18n 4 言語追加 (avatar.delete_*, avatar.toast_*, profile.*)。新規テスト 13 件 PASS、tsc clean、build 成功、commit (i18n/store/editor/login-name/login-avatar) + TODO の計 6 個、push・デプロイ済み。次セッションは Phase B-1 (ローカル取り込み) のプラン作成 → 実装。
```

加えて「次にやること」セクションの Phase B 行 (line 58 付近) を次のように更新:

```markdown
- **【最優先】Phase B 認証体験向上 (B-3 完了 / B-1 次)**: B-3 完了 2026-05-08。次は B-1 (ローカル取り込み) のプラン作成 → 実装、その後 B-2 (アカウントリンク)。設計書 `docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md`。
```

- [ ] **Step 6: TODO.md コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "$(cat <<'EOF'
docs(todo): Phase B-3 (アバター/表示名変更) 完了記録

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: push + デプロイ確認**

```bash
rtk git push
```

Vercel 自動デプロイを待って、本番で動作確認。

---

## 完了判定

以下が全部揃っていれば B-3 完了:
- ✅ vitest 全件 PASS (新規 13 件含む)
- ✅ tsc 厳密モード通過
- ✅ npm run build 成功
- ✅ 実機で「アバター変更 / 表示名変更 / アバター削除」が 4 言語で動作
- ✅ コミット 5 個 (i18n / store / editor / login-name-edit / login-avatar) + TODO.md 1 個 = 6 commits
- ✅ Vercel デプロイ成功、本番動作確認

---

**完了後、B-1 (ローカル取り込み) のプランを書きます。** B-3 で確定した型・インポートパターンを踏まえてスコープを詰める。
