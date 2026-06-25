# ローカルデータ安全性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログインせずローカル保存だけで軽減表を使うユーザーを、ブラウザのストレージ消去から守る（persist 要求＋控えめな案内＋復元バグ修正）。

**Architecture:** 既存の通知バー（SystemNotificationBar）のトンマナを踏襲した常設バー＋説明モーダルを非ログイン且つ表あり時に出す。起動時に `navigator.storage.persist()` を裏で要求。圧縮プラン入りバックアップが復元できないバグを検証緩和で直す。

**Tech Stack:** React + TypeScript, zustand, react-i18next, vitest(happy-dom) + @testing-library/react, Tailwind(app-text トークン), lucide-react。

**正典:** 設計書 `docs/superpowers/specs/2026-06-25-local-data-safety-design.md` / 調査 `docs/.private/2026-06-25-local-data-safety-research.md`

## Global Constraints

- 色・サイズは **トークン経由**（`app-text` / `app-bg` 系）。ハードコード色禁止。ライトテーマで白基調になること。
- UI テキストは **必ず i18n キー経由**（ja/en を作成、ko/zh はいったん ja コピー）。ロケール JSON は **該当ブロックのみ textual 編集**（全体 parse→stringify 禁止）。
- 既存の軽減表本体・同期・共有ロジックには触れない（スコープ厳守）。
- 1ファイル1責務・小さく保つ。TDD・小コミット。
- テスト実行は `npx vitest run <file>`（出力をパイプしない）。push はしない（ユーザーがまとめて行う）。
- モーダルは `createPortal` で body 直下＋ライト白基調担保（glass 系は `--share-modal-bg` を使う）。

---

### Task 1: 復元バグ修正（parseBackupJson 検証緩和）

圧縮プラン（`data` 無し・`compressedData` あり）を含むバックアップが復元できない不具合を直す。最小・独立・高価値なので最初に。

**Files:**
- Modify: `src/utils/backupService.ts:53-57`
- Test: `src/utils/__tests__/backupService.test.ts`（無ければ Create）

**Interfaces:**
- Consumes: なし
- Produces: `parseBackupJson(json: string): BackupData | null` は `data` または `compressedData` のどちらかを持つプランを **有効** と判定する（シグネチャ変更なし）。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/backupService.test.ts` に追記（ファイルが無ければこの内容で新規作成し、先頭に `import { describe, expect, it } from 'vitest';` と `import { parseBackupJson } from '../backupService';` を置く）:

```ts
describe('parseBackupJson 圧縮プラン対応', () => {
  it('compressedData のみ(data 無し)のプランを含むバックアップを有効と判定する', () => {
    const json = JSON.stringify({
      version: 1,
      exportedAt: '2026-06-25T00:00:00.000Z',
      planCount: 2,
      plans: [
        { id: 'a', title: '通常', data: { currentLevel: 100 } },
        { id: 'b', title: '圧縮', compressedData: 'BASE64DUMMY' }, // data 無し
      ],
    });
    const result = parseBackupJson(json);
    expect(result).not.toBeNull();
    expect(result!.plans).toHaveLength(2);
  });

  it('data も compressedData も無いプランは無効(null)', () => {
    const json = JSON.stringify({
      version: 1, exportedAt: '', planCount: 1,
      plans: [{ id: 'x', title: 'no-data' }],
    });
    expect(parseBackupJson(json)).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/utils/__tests__/backupService.test.ts`
Expected: 1つ目が FAIL（現状 `!plan.data` で圧縮プランを弾き null）。

- [ ] **Step 3: 検証を緩める**

`src/utils/backupService.ts` の `parseBackupJson` 内ループ（現 53-57 行）を次に変更:

```ts
    // 各プランに最低限の必須フィールドがあるか検証
    // data か compressedData のどちらかあれば有効（圧縮プランも復元可能にする）
    for (const plan of data.plans) {
      if (!plan.id || !plan.title || (!plan.data && !plan.compressedData)) {
        return null;
      }
    }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/backupService.test.ts`
Expected: PASS（2件とも）。

- [ ] **Step 5: コミット**

```bash
git add src/utils/backupService.ts src/utils/__tests__/backupService.test.ts
git commit -m "fix(backup): 圧縮プラン入りバックアップを復元できない不具合を修正"
```

---

### Task 2: persist 要求ユーティリティ

起動時に `navigator.storage.persist()` を裏で要求する薄いラッパ。UI なし・冪等・例外安全。

**Files:**
- Create: `src/lib/requestPersistentStorage.ts`
- Test: `src/lib/__tests__/requestPersistentStorage.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `requestPersistentStorage(): Promise<boolean>` — 付与済み/付与成功で true、非対応/失敗で false。例外を投げない。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/__tests__/requestPersistentStorage.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { requestPersistentStorage } from '../requestPersistentStorage';

const setStorage = (storage: unknown) => {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
};

describe('requestPersistentStorage', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('navigator.storage が無ければ false を返し例外を投げない', async () => {
    setStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('既に persisted() が true なら persist() を呼ばず true', async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('persisted() が false なら persist() を呼びその結果を返す', async () => {
    setStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    });
    await expect(requestPersistentStorage()).resolves.toBe(true);
  });

  it('persist() が throw しても false を返す', async () => {
    setStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockRejectedValue(new Error('denied')),
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/__tests__/requestPersistentStorage.test.ts`
Expected: FAIL（モジュール未定義）。

- [ ] **Step 3: 実装する**

`src/lib/requestPersistentStorage.ts`:

```ts
/**
 * navigator.storage.persist() を冪等・例外安全に要求する。
 * Chrome/Firefox では「消去対象外」へ昇格できる（best-effort）。
 * Safari タブには付与されにくいため、これは保険の1枚に過ぎない。
 * @returns 永続化が有効か（非対応・失敗時は false）。呼び出し側は無視してよい。
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist || !navigator.storage?.persisted) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn('persist 要求に失敗:', err);
    return false;
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/__tests__/requestPersistentStorage.test.ts`
Expected: PASS（4件）。

- [ ] **Step 5: 起動時に呼ぶ**

`src/App.tsx` の起動 useEffect（現 143-147 行）を次に変更（import を先頭の他 import 群に追加）:

```tsx
import { requestPersistentStorage } from './lib/requestPersistentStorage';
```

```tsx
  // 起動時: archivedなのにdataが展開されているプランを再圧縮 + 未使用プランのサイレント圧縮
  useEffect(() => {
    const store = usePlanStore.getState();
    store.recompressStaleArchives();
    store.silentCompressStale();
    // ローカルデータを消去対象外へ昇格要求（best-effort・失敗無害）
    requestPersistentStorage();
  }, []);
```

- [ ] **Step 6: ビルド確認＆コミット**

Run: `npx vitest run src/lib/__tests__/requestPersistentStorage.test.ts`
Expected: PASS

```bash
git add src/lib/requestPersistentStorage.ts src/lib/__tests__/requestPersistentStorage.test.ts src/App.tsx
git commit -m "feat(storage): 起動時に navigator.storage.persist() を要求"
```

---

### Task 3: 既読フラグ ユーティリティ

案内モーダルを一度開いたか（＝赤ドットを消すか）を localStorage に記録。

**Files:**
- Create: `src/utils/localSafetySeen.ts`
- Test: `src/utils/__tests__/localSafetySeen.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `isLocalSafetySeen(): boolean` / `markLocalSafetySeen(): void`（localStorage キー `lopo_local_safety_seen`）。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/localSafetySeen.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import { isLocalSafetySeen, markLocalSafetySeen } from '../localSafetySeen';

describe('localSafetySeen', () => {
  beforeEach(() => localStorage.clear());

  it('初期状態は未読(false)', () => {
    expect(isLocalSafetySeen()).toBe(false);
  });

  it('mark 後は既読(true)', () => {
    markLocalSafetySeen();
    expect(isLocalSafetySeen()).toBe(true);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/utils/__tests__/localSafetySeen.test.ts`
Expected: FAIL（モジュール未定義）。

- [ ] **Step 3: 実装する**

`src/utils/localSafetySeen.ts`:

```ts
const KEY = 'lopo_local_safety_seen';

/** ローカルデータ安全性の説明を一度開いたか */
export function isLocalSafetySeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** 説明を開いたことを記録（赤ドットを消す） */
export function markLocalSafetySeen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // localStorage 不可環境では無視
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/localSafetySeen.test.ts`
Expected: PASS（2件）。

- [ ] **Step 5: コミット**

```bash
git add src/utils/localSafetySeen.ts src/utils/__tests__/localSafetySeen.test.ts
git commit -m "feat(storage): ローカル安全性案内の既読フラグ util"
```

---

### Task 4: i18n キー追加（bar + modal）

`local_safety.*` を ja/en に追加。ko/zh はいったん ja コピー。

**Files:**
- Modify: `src/locales/ja.json`（`"backup"` ブロックの直前または直後に挿入）
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`（ja コピー）
- Modify: `src/locales/zh.json`（ja コピー）

**Interfaces:**
- Produces: i18n キー `local_safety.bar.label` / `local_safety.bar.aria` / `local_safety.modal.title` / `.why_heading` / `.why_body` / `.protect_heading` / `.backup_button` / `.backup_desc` / `.ios_heading` / `.ios_body` / `.login_note` / `.close`

- [ ] **Step 1: ja.json に挿入**

`src/locales/ja.json` の `"backup": {` ブロックの直前に、該当箇所だけ textual 編集で次を挿入（末尾カンマに注意）:

```json
    "local_safety": {
        "bar": {
            "label": "⚠ 端末内のみ保存",
            "aria": "ローカルデータの安全性について（必ずお読みください）"
        },
        "modal": {
            "title": "この軽減表は「この端末の中」だけに保存されています",
            "why_heading": "なぜ消えることがあるの？",
            "why_body": "ログインしていない間、軽減表はお使いのブラウザの中だけに保存されます。ブラウザは空き容量や使用状況に応じて保存データを消すことがあり、とくに iPhone / Safari ではサイトを約1週間開かないと自動で消去されます。これはブラウザの仕様で、完全には防げません。",
            "protect_heading": "大切な軽減表を守るには",
            "backup_button": "バックアップを書き出す",
            "backup_desc": "ファイルに書き出して保管すれば、消えても復元できます（いちばん確実）。",
            "ios_heading": "iPhone / iPad の方へ",
            "ios_body": "Safari 下の共有ボタン → 「ホーム画面に追加」でアプリのように使うと、上記の自動消去を回避できます。",
            "login_note": "ログインすると自動でクラウドにも保存され、機種変更や別の端末でも残ります。",
            "close": "閉じる"
        }
    },
```

- [ ] **Step 2: en.json に挿入**（同じ位置）

```json
    "local_safety": {
        "bar": {
            "label": "⚠ Saved on this device only",
            "aria": "About your local data safety (please read)"
        },
        "modal": {
            "title": "This sheet is stored only inside this device",
            "why_heading": "Why can it disappear?",
            "why_body": "While you are not logged in, your sheets live only in this browser. Browsers may clear stored data depending on free space and usage — and on iPhone / Safari in particular, data is automatically erased if you don't open the site for about a week. This is browser behavior and cannot be fully prevented.",
            "protect_heading": "How to keep your sheets safe",
            "backup_button": "Export a backup",
            "backup_desc": "Export to a file and keep it — you can restore even if it's erased (most reliable).",
            "ios_heading": "For iPhone / iPad users",
            "ios_body": "Tap the Share button in Safari → \"Add to Home Screen\" to use it like an app and avoid the automatic erasure above.",
            "login_note": "Logging in also saves to the cloud automatically, so your sheets survive across devices.",
            "close": "Close"
        }
    },
```

- [ ] **Step 3: ko.json / zh.json に ja と同じ値で挿入**（暫定・後日翻訳）

ja.json の `"local_safety"` ブロックをそのまま同じ位置にコピー。

- [ ] **Step 4: ビルド型チェック**

Run: `npx vitest run src/utils/__tests__/localSafetySeen.test.ts`（JSON 構文崩れの早期検出に軽く回す）
Expected: PASS（既存テストが落ちなければ JSON は壊れていない）。

- [ ] **Step 5: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "i18n(local-safety): ローカルデータ安全性 案内の文言追加(ja/en, ko/zh暫定)"
```

---

### Task 5: 説明モーダル LocalDataSafetyModal

クリックで開く説明＋アクション。バックアップ書き出しは親から渡すコールバックで既存モーダルを開く。

**Files:**
- Create: `src/components/LocalDataSafetyModal.tsx`
- Test: `src/components/__tests__/LocalDataSafetyModal.test.tsx`

**Interfaces:**
- Consumes: i18n キー `local_safety.modal.*`
- Produces: `LocalDataSafetyModal: React.FC<{ isOpen: boolean; onClose: () => void; onOpenBackup: () => void }>`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/__tests__/LocalDataSafetyModal.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalDataSafetyModal } from '../LocalDataSafetyModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

describe('LocalDataSafetyModal', () => {
  it('isOpen=false なら何も描画しない', () => {
    const { container } = render(
      <LocalDataSafetyModal isOpen={false} onClose={() => {}} onOpenBackup={() => {}} />
    );
    expect(container.textContent).toBe('');
  });

  it('isOpen=true で見出しを描画する', () => {
    render(<LocalDataSafetyModal isOpen onClose={() => {}} onOpenBackup={() => {}} />);
    expect(screen.getByText('local_safety.modal.title')).toBeTruthy();
  });

  it('バックアップ書き出しボタンで onOpenBackup を呼ぶ', () => {
    const onOpenBackup = vi.fn();
    render(<LocalDataSafetyModal isOpen onClose={() => {}} onOpenBackup={onOpenBackup} />);
    fireEvent.click(screen.getByText('local_safety.modal.backup_button'));
    expect(onOpenBackup).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/components/__tests__/LocalDataSafetyModal.test.tsx`
Expected: FAIL（モジュール未定義）。

- [ ] **Step 3: 実装する**

`src/components/LocalDataSafetyModal.tsx`（既存 BackupExportModal のモーダル骨格＝`createPortal`＋`bg-app-bg`＋`border-app-border` を踏襲。色はトークンのみ。iOS のときは iOS 項目を上に出す）:

```tsx
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, ShieldAlert, Download, Smartphone, LogIn } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenBackup: () => void;
}

const isIOS = (): boolean =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

export const LocalDataSafetyModal: React.FC<Props> = ({ isOpen, onClose, onOpenBackup }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const iosFirst = isIOS();

  const backupBlock = (
    <button
      onClick={onOpenBackup}
      className="w-full flex items-start gap-3 p-3 rounded-lg border border-app-border hover:bg-glass-hover transition-colors cursor-pointer text-left"
    >
      <Download size={18} className="shrink-0 mt-0.5 text-app-text" />
      <span className="flex flex-col">
        <span className="text-app-sm font-bold text-app-text">{t('local_safety.modal.backup_button')}</span>
        <span className="text-app-xs text-app-text-muted">{t('local_safety.modal.backup_desc')}</span>
      </span>
    </button>
  );

  const iosBlock = (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-app-border">
      <Smartphone size={18} className="shrink-0 mt-0.5 text-app-text" />
      <span className="flex flex-col">
        <span className="text-app-sm font-bold text-app-text">{t('local_safety.modal.ios_heading')}</span>
        <span className="text-app-xs text-app-text-muted">{t('local_safety.modal.ios_body')}</span>
      </span>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-app-bg border border-app-border rounded-xl shadow-2xl w-[90vw] max-w-[520px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="flex items-center gap-2 text-app-lg font-bold text-app-text">
            <ShieldAlert size={18} aria-hidden="true" />
            {t('local_safety.modal.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('local_safety.modal.close')}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto">
          <section className="flex flex-col gap-1">
            <h3 className="text-app-sm font-bold text-app-text">{t('local_safety.modal.why_heading')}</h3>
            <p className="text-app-sm text-app-text-muted">{t('local_safety.modal.why_body')}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-app-sm font-bold text-app-text">{t('local_safety.modal.protect_heading')}</h3>
            {iosFirst ? <>{iosBlock}{backupBlock}</> : <>{backupBlock}{iosBlock}</>}
            <div className="flex items-start gap-3 p-3 rounded-lg">
              <LogIn size={18} className="shrink-0 mt-0.5 text-app-text-muted" />
              <span className="text-app-xs text-app-text-muted">{t('local_safety.modal.login_note')}</span>
            </div>
          </section>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-end px-5 py-4 border-t border-app-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-app-toggle text-app-toggle-text text-app-sm font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            {t('local_safety.modal.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/LocalDataSafetyModal.test.tsx`
Expected: PASS（3件）。

- [ ] **Step 5: コミット**

```bash
git add src/components/LocalDataSafetyModal.tsx src/components/__tests__/LocalDataSafetyModal.test.tsx
git commit -m "feat(local-safety): ローカルデータ消失の説明モーダル"
```

---

### Task 6: 案内バー LocalDataSafetyBar

非ログイン且つ表1つ以上で常設。未読なら赤ドット。クリックでモーダル＋既読化。

**Files:**
- Create: `src/components/LocalDataSafetyBar.tsx`
- Test: `src/components/__tests__/LocalDataSafetyBar.test.tsx`

**Interfaces:**
- Consumes: `isLocalSafetySeen` / `markLocalSafetySeen`（Task 3）、`LocalDataSafetyModal`（Task 5）、`useAuthStore`、`usePlanStore`、i18n `local_safety.bar.*`
- Produces: `LocalDataSafetyBar: React.FC<{ isCollapsed: boolean; onOpenBackup: () => void }>`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/__tests__/LocalDataSafetyBar.test.tsx`（ストアは可変変数で出し分け）:

```tsx
// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

let authUser: unknown = null;
let planCount = 0;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (sel: (s: { user: unknown }) => unknown) => sel({ user: authUser }),
}));
vi.mock('../../store/usePlanStore', () => ({
  usePlanStore: (sel: (s: { plans: unknown[] }) => unknown) =>
    sel({ plans: Array.from({ length: planCount }, () => ({})) }),
}));

import { LocalDataSafetyBar } from '../LocalDataSafetyBar';

describe('LocalDataSafetyBar', () => {
  beforeEach(() => {
    localStorage.clear();
    authUser = null;
    planCount = 0;
  });

  it('ログイン中は表示しない', () => {
    authUser = { uid: 'x' };
    planCount = 3;
    const { container } = render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('非ログインでも表0件なら表示しない', () => {
    authUser = null;
    planCount = 0;
    const { container } = render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('非ログイン且つ表1件以上で表示する', () => {
    authUser = null;
    planCount = 1;
    render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(screen.getByText('local_safety.bar.label')).toBeTruthy();
  });

  it('未読なら赤ドット(testid)を出し、クリックで消える', () => {
    authUser = null;
    planCount = 1;
    render(<LocalDataSafetyBar isCollapsed={false} onOpenBackup={() => {}} />);
    expect(screen.getByTestId('local-safety-unread-dot')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /local_safety.bar.aria/i }));
    expect(screen.queryByTestId('local-safety-unread-dot')).toBeNull();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/components/__tests__/LocalDataSafetyBar.test.tsx`
Expected: FAIL（モジュール未定義）。

- [ ] **Step 3: 実装する**

`src/components/LocalDataSafetyBar.tsx`（SystemNotificationBar の構造を踏襲・色はトークンのみ）:

```tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { isLocalSafetySeen, markLocalSafetySeen } from '../utils/localSafetySeen';
import { LocalDataSafetyModal } from './LocalDataSafetyModal';

interface Props {
  /** Sidebar 折りたたみ時 true。 アイコンのみ表示 */
  isCollapsed: boolean;
  /** 説明モーダルから既存バックアップ書き出しモーダルを開く */
  onOpenBackup: () => void;
}

export const LocalDataSafetyBar: React.FC<Props> = ({ isCollapsed, onOpenBackup }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const planCount = usePlanStore((s) => s.plans.length);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => isLocalSafetySeen());

  // 非ログイン且つ表1件以上のときだけ常設
  if (user || planCount === 0) return null;

  const handleOpen = () => {
    setOpen(true);
    if (!seen) {
      markLocalSafetySeen();
      setSeen(true);
    }
  };

  const handleBackup = () => {
    setOpen(false);
    onOpenBackup();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('local_safety.bar.aria')}
        className="w-full border-t border-b border-app-text/10 flex items-stretch min-h-9 select-none cursor-pointer hover:bg-app-text/5 transition-colors text-left"
      >
        <span className="shrink-0 px-3 py-1.5 flex items-center text-app-text">
          <span className="relative flex">
            <ShieldAlert size={16} aria-hidden="true" />
            {!seen && (
              <span
                data-testid="local-safety-unread-dot"
                className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-app-bg"
                aria-hidden="true"
              />
            )}
          </span>
        </span>
        {!isCollapsed && (
          <span className="flex-1 min-w-0 overflow-hidden py-1.5 flex items-center">
            <span className="text-app-sm text-app-text-muted truncate">{t('local_safety.bar.label')}</span>
          </span>
        )}
      </button>
      <LocalDataSafetyModal isOpen={open} onClose={() => setOpen(false)} onOpenBackup={handleBackup} />
    </>
  );
};
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/LocalDataSafetyBar.test.tsx`
Expected: PASS（4件）。

- [ ] **Step 5: コミット**

```bash
git add src/components/LocalDataSafetyBar.tsx src/components/__tests__/LocalDataSafetyBar.test.tsx
git commit -m "feat(local-safety): 非ログイン向け 控えめ案内バー(常設+未読ドット)"
```

---

### Task 7: Sidebar へ組み込み

案内バーを通知バーの隣に出し、バックアップ書き出しモーダルを開けるよう配線。

**Files:**
- Modify: `src/components/Sidebar.tsx`（import 追加 / 1565 付近にバー描画 / `setBackupExportOpen` を渡す）

**Interfaces:**
- Consumes: `LocalDataSafetyBar`（Task 6）、既存 `backupExportOpen` / `setBackupExportOpen` state（現 Sidebar.tsx:1920 で BackupExportModal に接続済み）

- [ ] **Step 1: import を追加**

`src/components/Sidebar.tsx` の import 群（59 行 `SystemNotificationBar` の近く）に追記:

```tsx
import { LocalDataSafetyBar } from './LocalDataSafetyBar';
```

- [ ] **Step 2: バーを描画**

`src/components/Sidebar.tsx` の SystemNotificationBar ブロック（現 1563-1568）の直後に追記:

```tsx
                    {/* ローカル保存のみユーザーへの安全性案内 (非ログイン且つ表あり時のみ) */}
                    {!multiSelect.isEnabled && (
                        <div className="shrink-0">
                            <LocalDataSafetyBar
                                isCollapsed={!isOpen}
                                onOpenBackup={() => setBackupExportOpen(true)}
                            />
                        </div>
                    )}
```

- [ ] **Step 3: ビルド＆既存テスト確認**

Run: `npx vitest run src/components/__tests__/LocalDataSafetyBar.test.tsx src/components/__tests__/SystemNotificationBar.test.tsx`
Expected: PASS（回帰なし）。

- [ ] **Step 4: 型チェック（push 前必須・Vercel は tsc 厳密）**

Run: `npm run build`
Expected: 成功（未使用 import / 型不足が無いこと）。

- [ ] **Step 5: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(local-safety): サイドバーに安全性案内バーを組み込み"
```

---

### Task 8: 全体テスト＆実機確認の手前まで

**Files:** なし（検証のみ）

- [ ] **Step 1: 関連テスト一括**

Run: `npx vitest run src/utils/__tests__/backupService.test.ts src/lib/__tests__/requestPersistentStorage.test.ts src/utils/__tests__/localSafetySeen.test.ts src/components/__tests__/LocalDataSafetyModal.test.tsx src/components/__tests__/LocalDataSafetyBar.test.tsx`
Expected: 全 PASS

- [ ] **Step 2: ビルド**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: ユーザー実機確認の依頼（自動スクショは行わない）**

確認ポイントをユーザーへ提示:
- 非ログイン＋表1つ以上でサイドバーに「⚠ 端末内のみ保存」バー＋赤ドットが出る
- クリックでモーダル → 一度開くと赤ドット消える（バーは残る）
- モーダルの「バックアップを書き出す」で既存バックアップモーダルが開く
- ライト/ダーク両テーマで白基調/暗基調が崩れない（特にモーダル）
- ログインするとバーが消える

- [ ] **Step 4: 確認後の最終コミット（必要なら）＆ push はユーザー判断**

---

## Self-Review

**Spec coverage:**
- ① persist 要求 → Task 2 ✅
- ② 案内バー（非ログイン且つ表1つ以上・常設・赤ドット・トンマナ） → Task 6 + Task 7 ✅
- ② 説明モーダル（why / backup / iOS ホーム画面 / login 軽く） → Task 5 ✅
- ② i18n（ja/en/ko/zh） → Task 4 ✅
- ③ 復元バグ修正（検証緩和＋回帰テスト） → Task 1 ✅
- 既読フラグ（必ず読ませる赤ドット） → Task 3 ✅
- ライト/ダーク目視＝ユーザー実機 → Task 8 ✅

**Placeholder scan:** TBD/TODO・曖昧指示なし。各コード step に実コードあり。

**Type consistency:** `requestPersistentStorage()` / `isLocalSafetySeen()` / `markLocalSafetySeen()` / `LocalDataSafetyModal`(isOpen,onClose,onOpenBackup) / `LocalDataSafetyBar`(isCollapsed,onOpenBackup) は定義タスクと利用タスクで一致。`setBackupExportOpen` は既存 Sidebar state（1920 行で確認済み）。
