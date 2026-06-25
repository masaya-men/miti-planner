# iOS 非ログイン向けローカルデータ安全性強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS 非ログインユーザーに確実に警告を自動表示し、Web Share で実際に動く全プラン一括バックアップを提供する。

**Architecture:** Layout 最上位に常時マウントする `LocalDataSafetyAutoPrompt` が iOS 条件成立時に既存の警告モーダルを1回自動表示。バックアップは `shareBackupFile`(Web Share=ローカル完結・URL/サーバーなし) を iOS の主役にし、PC は revoke バグを直した download。巨大データは textarea 全文描画を避ける。

**Tech Stack:** TypeScript / React / Zustand / Vitest / i18next / Web Share API。

## Global Constraints

- 「共有」= OS の Web Share のみ。アプリの「表を共有」リンク(`/api/share`)とは無関係・本実装では一切使わない。
- バックアップは選択した全プランを1個の JSON にまとめたもの(既定全選択)。Web Share はその1ファイルを共有シートに渡すだけ(URL なし・サーバー保存なし・ゴミなし)。
- 自動ポップ条件: `iOS && 非ログイン && 表1件以上 && 未読(seen=false) && チュートリアル中でない`。成立で1回だけ表示し `markSeen()`(localStorage 永続)。
- 既存の控えめバー(LocalDataSafetyBar)・復元モーダル・ダメージ計算・他画面には触らない。
- `LARGE_BACKUP_CHARS = 100_000`(これ超で textarea 全文描画をやめる)。
- i18n は ja/en/ko/zh の4言語 parity。該当ブロックだけ textual 編集。
- push 前に `npm run build` + `npx vitest run` 必須(既存 failure=housing TopBar 4件+HousingWorkspace 1件のみ許容)。

---

### Task 1: `isIOS` 共通ユーティリティ + 既存モーダルの参照差し替え

**Files:**
- Create: `src/utils/isIOS.ts`
- Modify: `src/components/LocalDataSafetyModal.tsx:12-19`(ローカル `isIOS` を共通版へ)
- Test: `src/utils/__tests__/isIOS.test.ts`

**Interfaces:**
- Produces: `isIOS(): boolean`(UA ベース・非ブラウザ false)。Task 4/5 が参照。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/isIOS.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest';
import { isIOS } from '../isIOS';

const setUA = (ua: string) =>
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
const original = navigator.userAgent;
afterEach(() => setUA(original));

describe('isIOS', () => {
    it('iPhone UA → true', () => {
        setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)');
        expect(isIOS()).toBe(true);
    });
    it('iPad UA → true', () => {
        setUA('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)');
        expect(isIOS()).toBe(true);
    });
    it('Windows UA → false', () => {
        setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
        expect(isIOS()).toBe(false);
    });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/utils/__tests__/isIOS.test.ts`
Expected: FAIL（`isIOS` モジュール未作成）

- [ ] **Step 3: 実装**

`src/utils/isIOS.ts`:
```ts
/** iOS(iPad/iPhone/iPod)判定。UA ベース(SSR/非ブラウザは false)。 */
export function isIOS(): boolean {
    return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}
```

`src/components/LocalDataSafetyModal.tsx` の先頭 import 群に追加し、ローカル定義を削除する。

置換前(12-13行):
```tsx
const isIOS = (): boolean =>
  typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
```
置換後（その2行を削除し、4行目あたりの import 群末尾に次を追加）:
```tsx
import { isIOS } from '../utils/isIOS';
```

- [ ] **Step 4: 緑確認**

Run: `npx vitest run src/utils/__tests__/isIOS.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/isIOS.ts src/utils/__tests__/isIOS.test.ts src/components/LocalDataSafetyModal.tsx
git commit -m "refactor(safety): isIOS を共通ユーティリティ化"
```

---

### Task 2: 自動ポップ条件 `shouldAutoPromptLocalSafety`

**Files:**
- Create: `src/utils/localSafetyAutoPrompt.ts`
- Test: `src/utils/__tests__/localSafetyAutoPrompt.test.ts`

**Interfaces:**
- Produces: `shouldAutoPromptLocalSafety(p: { isIOS: boolean; isLoggedIn: boolean; planCount: number; seen: boolean; tutorialActive: boolean }): boolean`。Task 5 が参照。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/localSafetyAutoPrompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shouldAutoPromptLocalSafety } from '../localSafetyAutoPrompt';

const base = { isIOS: true, isLoggedIn: false, planCount: 1, seen: false, tutorialActive: false };

describe('shouldAutoPromptLocalSafety', () => {
    it('全条件成立で true', () => {
        expect(shouldAutoPromptLocalSafety(base)).toBe(true);
    });
    it('iOS でなければ false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, isIOS: false })).toBe(false);
    });
    it('ログイン済なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, isLoggedIn: true })).toBe(false);
    });
    it('表 0 件なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, planCount: 0 })).toBe(false);
    });
    it('既読なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, seen: true })).toBe(false);
    });
    it('チュートリアル中なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, tutorialActive: true })).toBe(false);
    });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/utils/__tests__/localSafetyAutoPrompt.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`src/utils/localSafetyAutoPrompt.ts`:
```ts
/**
 * iOS 非ログインユーザーへローカルデータ安全性の警告モーダルを自動表示すべきか。
 * iOS かつ 非ログイン かつ 表1件以上 かつ 未読 かつ チュートリアル中でない、で true。
 */
export function shouldAutoPromptLocalSafety(p: {
    isIOS: boolean;
    isLoggedIn: boolean;
    planCount: number;
    seen: boolean;
    tutorialActive: boolean;
}): boolean {
    return p.isIOS && !p.isLoggedIn && p.planCount > 0 && !p.seen && !p.tutorialActive;
}
```

- [ ] **Step 4: 緑確認**

Run: `npx vitest run src/utils/__tests__/localSafetyAutoPrompt.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/localSafetyAutoPrompt.ts src/utils/__tests__/localSafetyAutoPrompt.test.ts
git commit -m "feat(safety): 自動ポップ条件 shouldAutoPromptLocalSafety を追加"
```

---

### Task 3: `shareBackupFile` 追加 + `downloadBackupFile` の即時 revoke バグ修正

**Files:**
- Modify: `src/utils/backupService.ts:104-112`(download 修正・share 追加)
- Test: `src/utils/__tests__/backupService.test.ts`

**Interfaces:**
- Produces:
  - `shareBackupFile(json: string, filename: string): Promise<'shared' | 'cancelled' | 'unsupported' | 'failed'>`
  - `downloadBackupFile(json: string, filename: string): void`(挙動修正・シグネチャ不変)
- Task 4(BackupExportModal)が両方を参照。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/backupService.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareBackupFile, downloadBackupFile } from '../backupService';

describe('shareBackupFile', () => {
    const origCanShare = (navigator as any).canShare;
    const origShare = (navigator as any).share;
    afterEach(() => {
        (navigator as any).canShare = origCanShare;
        (navigator as any).share = origShare;
        vi.restoreAllMocks();
    });

    it('canShare/share 未対応 → unsupported', async () => {
        (navigator as any).canShare = undefined;
        (navigator as any).share = undefined;
        expect(await shareBackupFile('{}', 'b.json')).toBe('unsupported');
    });

    it('canShare(files)===false → unsupported', async () => {
        (navigator as any).canShare = () => false;
        (navigator as any).share = vi.fn();
        expect(await shareBackupFile('{}', 'b.json')).toBe('unsupported');
    });

    it('share 成功 → shared (File 入りで呼ばれる)', async () => {
        (navigator as any).canShare = () => true;
        const share = vi.fn().mockResolvedValue(undefined);
        (navigator as any).share = share;
        expect(await shareBackupFile('{"a":1}', 'b.json')).toBe('shared');
        expect(share).toHaveBeenCalledTimes(1);
        const arg = share.mock.calls[0][0];
        expect(arg.files[0]).toBeInstanceOf(File);
        expect(arg.files[0].name).toBe('b.json');
    });

    it('AbortError → cancelled', async () => {
        (navigator as any).canShare = () => true;
        (navigator as any).share = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
        expect(await shareBackupFile('{}', 'b.json')).toBe('cancelled');
    });

    it('その他エラー → failed', async () => {
        (navigator as any).canShare = () => true;
        (navigator as any).share = vi.fn().mockRejectedValue(new Error('boom'));
        expect(await shareBackupFile('{}', 'b.json')).toBe('failed');
    });
});

describe('downloadBackupFile', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        if (!URL.createObjectURL) (URL as any).createObjectURL = () => '';
        if (!URL.revokeObjectURL) (URL as any).revokeObjectURL = () => {};
    });
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('即時に revokeObjectURL を呼ばない（遅延 revoke）', () => {
        const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        downloadBackupFile('{"a":1}', 'b.json');
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(revokeSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(10000);
        expect(revokeSpy).toHaveBeenCalledWith('blob:test');
    });
});
```

- [ ] **Step 2: 失敗確認**

Run: `npx vitest run src/utils/__tests__/backupService.test.ts`
Expected: FAIL（`shareBackupFile` 未エクスポート / download が即時 revoke）

- [ ] **Step 3: 実装**

`src/utils/backupService.ts` の `downloadBackupFile`(104-112行)を置き換え、その下に `shareBackupFile` を追加:
```ts
/**
 * JSONファイルをダウンロードする（平文JSON、透明性のため圧縮しない）。
 * iOS Safari 等で click 直後の即時 revoke が保存を壊すため、DOM 挿入 + 遅延 revoke にする。
 */
export function downloadBackupFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // click のナビゲーションが非同期に走る環境で URL を奪わないよう遅延して revoke する。
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * バックアップJSONを Web Share でファイルとして共有する（iOS で「ファイルに保存」等が選べる）。
 * ローカル完結＝URL も作らずサーバーにも送らない。全プラン入りの1ファイルをそのまま渡す。
 * @returns 'shared'=共有した / 'cancelled'=ユーザーが共有シートを閉じた / 'unsupported'=非対応 / 'failed'=失敗
 */
export async function shareBackupFile(
  json: string,
  filename: string,
): Promise<'shared' | 'cancelled' | 'unsupported' | 'failed'> {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return 'unsupported';
    const file = new File([json], filename, { type: 'application/json' });
    if (!navigator.canShare({ files: [file] })) return 'unsupported';
    await navigator.share({ files: [file], title: filename });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}
```

- [ ] **Step 4: 緑確認**

Run: `npx vitest run src/utils/__tests__/backupService.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/backupService.ts src/utils/__tests__/backupService.test.ts
git commit -m "feat(backup): Web Share によるファイル共有を追加+download即時revokeバグ修正"
```

---

### Task 4: BackupExportModal を共有ボタン・巨大データ対策・i18n に対応

**Files:**
- Modify: `src/locales/ja.json:1858` / `src/locales/en.json:1837` / `src/locales/ko.json:1802` / `src/locales/zh.json:1802`(いずれも `download_success` 行の直後に3キー追加)
- Modify: `src/components/BackupExportModal.tsx`(import・handleShare・本文 textarea ガード・フッターボタン出し分け)

**Interfaces:**
- Consumes: Task1 `isIOS`、Task3 `shareBackupFile`/`downloadBackupFile`、i18n `backup.share_button`/`backup.share_success`/`backup.export_large_notice`。

- [ ] **Step 1: i18n キーを4言語に追加**

各ロケールの `download_success` 行の直後に3キーを追加する。

`src/locales/ja.json`（`"download_success": "ダウンロードしました",` の直後）:
```json
        "share_button": "共有",
        "share_success": "共有しました",
        "export_large_notice": "データが大きいためプレビューは省略しています。下のボタンで保存・コピーできます。",
```
`src/locales/en.json`（`"download_success": "Downloaded",` の直後）:
```json
        "share_button": "Share",
        "share_success": "Shared",
        "export_large_notice": "Preview hidden because the data is large. Use the buttons below to save or copy.",
```
`src/locales/ko.json`（`"download_success": "다운로드 완료",` の直後）:
```json
        "share_button": "공유",
        "share_success": "공유했습니다",
        "export_large_notice": "데이터가 커서 미리보기를 생략했습니다. 아래 버튼으로 저장/복사하세요.",
```
`src/locales/zh.json`（`"download_success": "已下载",` の直後）:
```json
        "share_button": "分享",
        "share_success": "已分享",
        "export_large_notice": "数据较大，已省略预览。请用下方按钮保存或复制。",
```

- [ ] **Step 2: JSON parse 確認**

Run: `node -e "for (const f of ['ja','en','ko','zh']) { JSON.parse(require('fs').readFileSync('src/locales/'+f+'.json','utf8')); console.log(f,'OK'); }"`
Expected: `ja OK` / `en OK` / `ko OK` / `zh OK`

- [ ] **Step 3: import と定数・handleShare を追加**

`src/components/BackupExportModal.tsx`:

(3a) import 行を変更。置換前(4行目・8行目):
```tsx
import { X, Copy, Download, Loader, CheckSquare, Square } from 'lucide-react';
```
置換後:
```tsx
import { X, Copy, Download, Share2, Loader, CheckSquare, Square } from 'lucide-react';
```
置換前(8行目):
```tsx
import { createBackupJson, downloadBackupFile } from '../utils/backupService';
```
置換後:
```tsx
import { createBackupJson, downloadBackupFile, shareBackupFile } from '../utils/backupService';
import { isIOS } from '../utils/isIOS';
```

(3b) ファイル冒頭の import 群の直後（`interface Props {` の直前）に定数を追加:
```tsx
/** これを超える JSON はプレビュー textarea に全文描画しない（スマホ固まり防止）。 */
const LARGE_BACKUP_CHARS = 100_000;
```

(3c) `handleDownload`(105-110行)の直後に `handleShare` と派生値を追加:
```tsx
  const handleShare = async () => {
    if (selectedCount === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    const filename = `lopo-backup-${date}.json`;
    const result = await shareBackupFile(json, filename);
    if (result === 'shared') { showToast(t('backup.share_success')); return; }
    if (result === 'cancelled') return;
    // 非対応 / 失敗 → ダウンロードにフォールバック
    downloadBackupFile(json, filename);
    showToast(t('backup.download_success'));
  };

  const iosShare = isIOS();
  const isLarge = json.length > LARGE_BACKUP_CHARS;
```

- [ ] **Step 4: 本文 textarea を巨大データガード**

置換前(186-191行):
```tsx
              <textarea
                data-backup-json
                readOnly
                value={json}
                className="w-full h-28 bg-app-bg border border-app-border rounded-lg p-3 text-[16px] md:text-app-xs text-app-text-muted font-mono resize-none focus:outline-none"
              />
```
置換後:
```tsx
              {isLarge ? (
                <p className="text-app-xs text-app-text-muted px-1 py-2">
                  {t('backup.export_large_notice')}
                </p>
              ) : (
                <textarea
                  data-backup-json
                  readOnly
                  value={json}
                  className="w-full h-28 bg-app-bg border border-app-border rounded-lg p-3 text-[16px] md:text-app-xs text-app-text-muted font-mono resize-none focus:outline-none"
                />
              )}
```

- [ ] **Step 5: フッターのダウンロードボタンを iOS=共有/PC=ダウンロードに出し分け**

置換前(207-214行):
```tsx
            <button
              onClick={handleDownload}
              disabled={selectedCount === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              {t('backup.download_button')}
            </button>
```
置換後:
```tsx
            {iosShare ? (
              <button
                onClick={handleShare}
                disabled={selectedCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Share2 size={14} />
                {t('backup.share_button')}
              </button>
            ) : (
              <button
                onClick={handleDownload}
                disabled={selectedCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-app-border text-app-text text-app-sm font-bold hover:bg-glass-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                {t('backup.download_button')}
              </button>
            )}
```

- [ ] **Step 6: 型チェック + ビルド**

Run: `npm run build`
Expected: 成功（未使用 import なし・型エラーなし）

- [ ] **Step 7: コミット**

```bash
git add src/components/BackupExportModal.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(backup): iOSは共有ボタン/PCはDL・巨大データはtextarea省略・i18n追加"
```

---

### Task 5: `LocalDataSafetyAutoPrompt` を作成し Layout に常時マウント

**Files:**
- Create: `src/components/LocalDataSafetyAutoPrompt.tsx`
- Modify: `src/components/Layout.tsx`（import 追加 + `<ShareImportSheet />` の直後にマウント）

**Interfaces:**
- Consumes: Task1 `isIOS`、Task2 `shouldAutoPromptLocalSafety`、既存 `LocalDataSafetyModal`/`BackupExportModal`/各ストア。
- Produces: `LocalDataSafetyAutoPrompt`（props なし）。

- [ ] **Step 1: コンポーネント作成**

`src/components/LocalDataSafetyAutoPrompt.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlanStore } from '../store/usePlanStore';
import { useLocalSafetySeenStore } from '../store/useLocalSafetySeenStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { isIOS } from '../utils/isIOS';
import { shouldAutoPromptLocalSafety } from '../utils/localSafetyAutoPrompt';
import { LocalDataSafetyModal } from './LocalDataSafetyModal';
import { BackupExportModal } from './BackupExportModal';

/**
 * iOS 非ログインユーザーへローカルデータ安全性の警告を確実に届けるための
 * 常時マウント型プロンプト。サイドバー/メニューに依存せず Layout 最上位で動く。
 * 条件成立で1回だけモーダルを自動表示し、即 markSeen() で再表示を止める。
 */
export const LocalDataSafetyAutoPrompt: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const planCount = usePlanStore((s) => s.plans.length);
  const seen = useLocalSafetySeenStore((s) => s.seen);
  const markSeen = useLocalSafetySeenStore((s) => s.markSeen);
  const tutorialActive = useTutorialStore((s) => s.isActive);
  const [modalOpen, setModalOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  useEffect(() => {
    if (
      shouldAutoPromptLocalSafety({
        isIOS: isIOS(),
        isLoggedIn: user !== null,
        planCount,
        seen,
        tutorialActive,
      })
    ) {
      setModalOpen(true);
      markSeen();
    }
  }, [user, planCount, seen, tutorialActive, markSeen]);

  return (
    <>
      <LocalDataSafetyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpenBackup={() => {
          setModalOpen(false);
          setBackupOpen(true);
        }}
      />
      <BackupExportModal isOpen={backupOpen} onClose={() => setBackupOpen(false)} />
    </>
  );
};
```

- [ ] **Step 2: Layout にマウント**

`src/components/Layout.tsx` の import 群（13行目 `import { Sidebar } from './Sidebar';` の付近）に追加:
```tsx
import { LocalDataSafetyAutoPrompt } from './LocalDataSafetyAutoPrompt';
```
`<ShareImportSheet />`(888行付近)の直後に追加。置換前:
```tsx
            <ShareImportSheet />
```
置換後:
```tsx
            <ShareImportSheet />
            <LocalDataSafetyAutoPrompt />
```

- [ ] **Step 3: 型チェック + ビルド**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 全テスト + ビルド最終確認**

Run: `npx vitest run`
Expected: 新規4テストファイル緑。失敗は既存 housing(TopBar 4 + HousingWorkspace 1)のみ。

- [ ] **Step 5: コミット**

```bash
git add src/components/LocalDataSafetyAutoPrompt.tsx src/components/Layout.tsx
git commit -m "feat(safety): iOS非ログインに警告を自動表示するLocalDataSafetyAutoPromptをLayoutに常設"
```

---

## 実機検証（実装後・本番投入前）
- iPhone Safari・非ログイン・表あり: 起動で警告モーダルが **1回** 自動表示 → 閉じると再表示されない。
- モーダル「バックアップ」→「共有」→「ファイルに保存」で .json が保存（全プラン入り）。「コピー」→ 復元の貼り付けで戻せる。保存ファイルを「ファイル選択」で復元できる。
- 大量プランでも書き出し画面が固まらない（textarea 省略表示）。
- PC: 従来どおり「ダウンロード」。チュートリアル中は自動ポップしない。ログインすると自動ポップしない。
- ログアウト状態の別端末(PC)では自動ポップは出ない(iOS のみ)。バーは従来どおり。

## Self-Review
- **Spec coverage**: A自動ポップ=Task5(+Task2条件)/常時マウント=Task5 Layout/seen再利用=Task5 markSeen/B share=Task3+Task4/download修正=Task3/iOS出し分け=Task4/巨大データ=Task4/i18n=Task4/isIOS共通化=Task1/復元非変更=触れない/②共有GC非スコープ=計画外(TODO別記)。全網羅。
- **Placeholder scan**: TBD/TODO なし。各 Step に実コード・実コマンド・期待値あり。
- **Type consistency**: `shareBackupFile` の戻り値 `'shared'|'cancelled'|'unsupported'|'failed'` は Task3 定義・Task4 で同じ分岐。`shouldAutoPromptLocalSafety` の引数キー(isIOS/isLoggedIn/planCount/seen/tutorialActive)は Task2 定義・Task5 呼び出しで一致。`isIOS()` は Task1 定義・Task4/5 参照で一致。i18n キー名 `backup.share_button`/`share_success`/`export_large_notice` は Task4 定義・同タスク内参照で一致。
