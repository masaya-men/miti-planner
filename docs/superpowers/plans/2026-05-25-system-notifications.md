# 運営からの通知バッジ機能 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軽減表アプリ Sidebar 下端に運営告知ベル+マーキー+viewport 中央モーダル を導入。 admin 画面から投稿/編集/公開停止/削除を可能にする。

**Architecture:** Firestore `system_notifications` collection (broadcast 型、 全ユーザー共通) を public read + admin API write で構築。 ユーザー側は onSnapshot 購読 + localStorage 既読管理。 軽減表既存トンマナ (白黒・Inter 禁止・honey 禁止) で UI 統合。

**Tech Stack:** Firebase Firestore + Firebase Admin SDK (serverless) / React 19 + Zustand / framer-motion / Tailwind v4 + LoPo design tokens / react-i18next (ja/en/ko/zh) / vitest (vmThreads pool)

**Spec:** [docs/superpowers/specs/2026-05-25-system-notifications-design.md](../specs/2026-05-25-system-notifications-design.md)

---

## File Structure

### 新規追加
- `src/types/systemNotification.ts` — 型定義 (LocalizedText, SystemNotification, ReadState)
- `src/lib/systemNotifLinks.ts` — X / Discord URL 定数
- `src/lib/localizedText.ts` — 多言語フォールバック純関数
- `src/lib/systemNotifReadStorage.ts` — localStorage 既読管理純関数
- `src/store/useSystemNotifications.ts` — Firestore 購読 + 既読管理 hook
- `src/components/SystemNotificationModal.tsx` — viewport 中央モーダル
- `src/components/SystemNotificationBar.tsx` — Sidebar 下端の ベル+マーキー枠
- `src/components/admin/AdminSystemNotifications.tsx` — 管理画面 (一覧 + 投稿 + 編集 + 公開停止 + 削除)
- `api/admin/system-notifications.ts` — serverless API (POST/PATCH/DELETE、 admin SDK)
- `src/lib/__tests__/localizedText.test.ts`
- `src/lib/__tests__/systemNotifReadStorage.test.ts`
- `src/store/__tests__/useSystemNotifications.test.ts`
- `src/components/__tests__/SystemNotificationBar.test.tsx`
- `src/components/__tests__/SystemNotificationModal.test.tsx`

### 既存ファイル変更
- `src/components/Sidebar.tsx` — 下端 (バックアップ/復元の上) に `<SystemNotificationBar />` 追加
- `src/components/admin/AdminLayout.tsx` — `NAV_ITEMS` に「通知」 追加
- `src/App.tsx` (or admin router) — `/admin/notifications` ルート登録 → AdminSystemNotifications
- `firestore.rules` — system_notifications: read=public, write=false (admin SDK が bypass)
- `src/locales/{ja,en,ko,zh}.json` — `system_notif.*` キー追加

### 責務まとめ

| ファイル | 責務 |
|---|---|
| types | 型定義のみ、 ランタイムロジック無し |
| systemNotifLinks | 定数のみ |
| localizedText | 純関数 `resolveLocalized(obj, lang) → string` のみ |
| systemNotifReadStorage | 純関数 (load/save/markRead/isRead) + localStorage I/O のみ |
| useSystemNotifications | Firestore 購読 + 既読 hook 統合、 React 依存 |
| SystemNotificationModal | UI: モーダル表示 + 閉じる時の markRead 呼び出し |
| SystemNotificationBar | UI: Sidebar 下端の ベル + マーキー + Modal open trigger |
| AdminSystemNotifications | UI: 管理画面 (一覧 + フォーム) + API 呼び出し |
| api/admin/system-notifications | サーバ: Firebase Admin SDK + Discord OAuth admin チェック |

---

## Task 1: 型定義

**Files:**
- Create: `src/types/systemNotification.ts`

- [ ] **Step 1: 型ファイルを作成**

```ts
// src/types/systemNotification.ts
/**
 * 運営からの通知 (broadcast 型、 全ユーザー共通)。
 * ハウジング側の HousingNotification (1-to-1 型) とは別系統。
 */

/** 4 言語の多言語テキスト。 ja/en は必須、 ko/zh は将来拡張用 optional。 */
export interface LocalizedText {
  ja: string;
  en: string;
  ko?: string;
  zh?: string;
}

/** Firestore system_notifications/{id} のスキーマ */
export interface SystemNotification {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  /** false にすると即時 UI から消える (削除と違い不可逆ではない) */
  published: boolean;
  /** 将来拡張用。 admin UI からは入力しない */
  link?: string;
  createdAt: number;
  updatedAt: number;
}

/** localStorage 'lopo:system_notifs:read' の保存形式 */
export interface SystemNotifReadState {
  readIds: string[];
  updatedAt: number;
}

/** Admin API のリクエストペイロード */
export interface SystemNotifCreatePayload {
  title: LocalizedText;
  body: LocalizedText;
  published: boolean;
}
export interface SystemNotifUpdatePayload extends Partial<SystemNotifCreatePayload> {
  /** undefined を Firestore で「変更なし」 として扱う */
}
```

- [ ] **Step 2: tsc check**

Run: `npx tsc --noEmit`
Expected: PASS (新規 export のみ、 既存に影響なし)

- [ ] **Step 3: Commit**

```bash
git add src/types/systemNotification.ts
git commit -m "feat(notif): 運営通知の型定義 (LocalizedText / SystemNotification / ReadState)"
```

---

## Task 2: X / Discord URL 定数

**Files:**
- Create: `src/lib/systemNotifLinks.ts`

- [ ] **Step 1: 定数ファイル作成**

```ts
// src/lib/systemNotifLinks.ts
/**
 * 運営告知モーダルのフッターで案内する外部リンク。
 * LP Footer ([Layout.tsx:652], [LandingFooter.tsx:115]) と同じ URL を使う。
 */
export const LOPO_X_URL = 'https://x.com/lopoly_app';
export const LOPO_DISCORD_URL = 'https://discord.gg/z7uypbJSnN';
```

- [ ] **Step 2: tsc check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/systemNotifLinks.ts
git commit -m "feat(notif): X/Discord URL 定数 (LP Footer と同 URL を共通化)"
```

---

## Task 3: 多言語フォールバック純関数

**Files:**
- Create: `src/lib/localizedText.ts`
- Test: `src/lib/__tests__/localizedText.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/__tests__/localizedText.test.ts
// globals: true モード (vitest.config.ts) に従い、 describe/it/expect はグローバル使用。
import { resolveLocalized } from '../localizedText';
import type { LocalizedText } from '../../types/systemNotification';

describe('resolveLocalized', () => {
  const full: LocalizedText = { ja: 'こんにちは', en: 'Hello', ko: '안녕', zh: '你好' };
  const ja_en_only: LocalizedText = { ja: 'こんにちは', en: 'Hello' };

  it('全言語埋まっているとき、 指定 lang をそのまま返す', () => {
    expect(resolveLocalized(full, 'ja')).toBe('こんにちは');
    expect(resolveLocalized(full, 'en')).toBe('Hello');
    expect(resolveLocalized(full, 'ko')).toBe('안녕');
    expect(resolveLocalized(full, 'zh')).toBe('你好');
  });

  it('ko/zh が未定義のとき en にフォールバックする', () => {
    expect(resolveLocalized(ja_en_only, 'ko')).toBe('Hello');
    expect(resolveLocalized(ja_en_only, 'zh')).toBe('Hello');
  });

  it('en も無いとき ja にフォールバックする (en 必須なので通常起きないがガード)', () => {
    const ja_only = { ja: 'こんにちは', en: '' } as LocalizedText;
    expect(resolveLocalized(ja_only, 'ko')).toBe('こんにちは');
  });

  it('不明な言語コードでも en or ja にフォールバックする', () => {
    expect(resolveLocalized(full, 'fr' as 'ja')).toBe('Hello');
  });
});
```

- [ ] **Step 2: テスト実行 (失敗確認)**

Run: `npx vitest run src/lib/__tests__/localizedText.test.ts --reporter=default`
Expected: FAIL with "Cannot find module '../localizedText'"

- [ ] **Step 3: 純関数を実装**

```ts
// src/lib/localizedText.ts
import type { LocalizedText } from '../types/systemNotification';

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh';

/**
 * 多言語テキストから指定 lang の文字列を取り出す。 順序: lang → en → ja。
 * en が空文字列 ('') の場合は ja にフォールバック。
 */
export function resolveLocalized(text: LocalizedText, lang: SupportedLang): string {
  const candidate = text[lang];
  if (candidate) return candidate;
  if (text.en) return text.en;
  return text.ja;
}
```

- [ ] **Step 4: テスト実行 (PASS 確認)**

Run: `npx vitest run src/lib/__tests__/localizedText.test.ts --reporter=default`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/localizedText.ts src/lib/__tests__/localizedText.test.ts
git commit -m "feat(notif): 多言語テキストのフォールバック純関数 (lang→en→ja)"
```

---

## Task 4: localStorage 既読管理純関数

**Files:**
- Create: `src/lib/systemNotifReadStorage.ts`
- Test: `src/lib/__tests__/systemNotifReadStorage.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/__tests__/systemNotifReadStorage.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadReadState,
  saveReadState,
  markRead,
  isRead,
  STORAGE_KEY,
} from '../systemNotifReadStorage';

describe('systemNotifReadStorage', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('初回 loadReadState は空の readIds を返す', () => {
    const state = loadReadState();
    expect(state.readIds).toEqual([]);
    expect(state.updatedAt).toBe(0);
  });

  it('saveReadState で永続化、 loadReadState で復元できる', () => {
    saveReadState({ readIds: ['a', 'b'], updatedAt: 123 });
    const state = loadReadState();
    expect(state.readIds).toEqual(['a', 'b']);
    expect(state.updatedAt).toBe(123);
  });

  it('markRead は id を追加して updatedAt を更新する', () => {
    const before = Date.now();
    markRead('notif-1');
    const state = loadReadState();
    expect(state.readIds).toContain('notif-1');
    expect(state.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('markRead は重複 id を追加しない', () => {
    markRead('notif-1');
    markRead('notif-1');
    const state = loadReadState();
    expect(state.readIds.filter((x) => x === 'notif-1')).toHaveLength(1);
  });

  it('isRead は readIds にあれば true、 無ければ false', () => {
    markRead('notif-1');
    expect(isRead('notif-1')).toBe(true);
    expect(isRead('notif-2')).toBe(false);
  });

  it('壊れた JSON が保存されていても loadReadState は空を返す', () => {
    localStorage.setItem(STORAGE_KEY, 'this is not json');
    const state = loadReadState();
    expect(state.readIds).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト実行 (失敗確認)**

Run: `npx vitest run src/lib/__tests__/systemNotifReadStorage.test.ts --reporter=default`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: 純関数実装**

```ts
// src/lib/systemNotifReadStorage.ts
import type { SystemNotifReadState } from '../types/systemNotification';

export const STORAGE_KEY = 'lopo:system_notifs:read';

const EMPTY: SystemNotifReadState = { readIds: [], updatedAt: 0 };

export function loadReadState(): SystemNotifReadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<SystemNotifReadState>;
    if (!Array.isArray(parsed.readIds)) return { ...EMPTY };
    return {
      readIds: parsed.readIds.filter((x): x is string => typeof x === 'string'),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveReadState(state: SystemNotifReadState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage 不可 (quota / private mode) は無視 — UI は引き続き機能、 ただし既読は session 限り
  }
}

export function markRead(id: string): void {
  const state = loadReadState();
  if (state.readIds.includes(id)) return;
  saveReadState({
    readIds: [...state.readIds, id],
    updatedAt: Date.now(),
  });
}

export function isRead(id: string): boolean {
  return loadReadState().readIds.includes(id);
}
```

- [ ] **Step 4: テスト実行 (PASS 確認)**

Run: `npx vitest run src/lib/__tests__/systemNotifReadStorage.test.ts --reporter=default`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/systemNotifReadStorage.ts src/lib/__tests__/systemNotifReadStorage.test.ts
git commit -m "feat(notif): localStorage 既読管理の純関数 (load/save/markRead/isRead)"
```

---

## Task 5: Firestore 購読 + 既読管理 hook

**Files:**
- Create: `src/store/useSystemNotifications.ts`
- Test: `src/store/__tests__/useSystemNotifications.test.ts`

参考既存パターン: [src/components/housing/notifications/useNotifications.ts](src/components/housing/notifications/useNotifications.ts) (onSnapshot + setItems パターン)

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/store/__tests__/useSystemNotifications.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// firebase/firestore を mock。 既存テスト (useShareImportFlow.test.ts 等) のパターン参考。
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    getFirestore: () => ({}),
    collection: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(),
  };
});

import { onSnapshot } from 'firebase/firestore';
import { useSystemNotifications } from '../useSystemNotifications';
import { STORAGE_KEY } from '../../lib/systemNotifReadStorage';

describe('useSystemNotifications', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    vi.clearAllMocks();
  });

  function setupSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
    (onSnapshot as ReturnType<typeof vi.fn>).mockImplementation((_q, cb) => {
      cb({
        docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
      });
      return () => {}; // unsub
    });
  }

  it('購読 doc を items として返す (新着順 = orderBy createdAt desc は mock 任せ)', () => {
    setupSnapshot([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 200, updatedAt: 200 } },
      { id: 'n2', data: { title: { ja: 'b', en: 'B' }, body: { ja: 'bb', en: 'BB' }, published: true, createdAt: 100, updatedAt: 100 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    expect(result.current.items).toHaveLength(2);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.latestUnread?.id).toBe('n1');
  });

  it('未読 0 なら latestUnread は null', () => {
    setupSnapshot([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 200, updatedAt: 200 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    act(() => result.current.markRead('n1'));
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.latestUnread).toBeNull();
  });

  it('markRead 後、 既読 id は localStorage に保存される', () => {
    setupSnapshot([
      { id: 'n1', data: { title: { ja: 'a', en: 'A' }, body: { ja: 'aa', en: 'AA' }, published: true, createdAt: 100, updatedAt: 100 } },
    ]);
    const { result } = renderHook(() => useSystemNotifications());
    act(() => result.current.markRead('n1'));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain('n1');
  });
});
```

- [ ] **Step 2: テスト実行 (失敗確認)**

Run: `npx vitest run src/store/__tests__/useSystemNotifications.test.ts --reporter=default`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: hook を実装**

```ts
// src/store/useSystemNotifications.ts
/**
 * 運営通知 (system_notifications) の購読 + 既読管理 hook。
 *
 * - Firestore 'system_notifications' を published===true で onSnapshot 購読
 * - 既読は localStorage で管理 (端末別)、 ログイン不要
 * - 認証不要で read 可 (Firestore Rules で公開 read)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import type { SystemNotification } from '../types/systemNotification';
import {
  loadReadState,
  markRead as persistMarkRead,
} from '../lib/systemNotifReadStorage';

export interface UseSystemNotificationsResult {
  items: SystemNotification[];
  unreadCount: number;
  /** 未読のうち最新 1 件。 全て既読なら null */
  latestUnread: SystemNotification | null;
  /** 既読化 (localStorage 更新 + re-render) */
  markRead: (id: string) => void;
}

export function useSystemNotifications(): UseSystemNotificationsResult {
  const [items, setItems] = useState<SystemNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => loadReadState().readIds);

  useEffect(() => {
    const ref = collection(getFirestore(), 'system_notifications');
    const q = query(ref, where('published', '==', true), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SystemNotification, 'id'>),
      }));
      setItems(next);
    });
    return () => unsub();
  }, []);

  const unread = useMemo(
    () => items.filter((n) => !readIds.includes(n.id)),
    [items, readIds]
  );

  const latestUnread = unread.length > 0 ? unread[0] : null;

  function markRead(id: string) {
    persistMarkRead(id);
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return {
    items,
    unreadCount: unread.length,
    latestUnread,
    markRead,
  };
}
```

- [ ] **Step 4: テスト実行 (PASS 確認)**

Run: `npx vitest run src/store/__tests__/useSystemNotifications.test.ts --reporter=default`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/store/useSystemNotifications.ts src/store/__tests__/useSystemNotifications.test.ts
git commit -m "feat(notif): system_notifications 購読 + 既読管理 hook"
```

---

## Task 6: SystemNotificationModal コンポーネント

**Files:**
- Create: `src/components/SystemNotificationModal.tsx`
- Test: `src/components/__tests__/SystemNotificationModal.test.tsx`

参考既存パターン: [src/components/NewPlanModal.tsx](src/components/NewPlanModal.tsx) (createPortal + framer-motion + useEscapeClose の基本パターン)

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/__tests__/SystemNotificationModal.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemNotificationModal } from '../SystemNotificationModal';
import type { SystemNotification } from '../../types/systemNotification';
import { LOPO_X_URL, LOPO_DISCORD_URL } from '../../lib/systemNotifLinks';

// react-i18next: 'ja' 固定
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ja' },
  }),
}));

const sample: SystemNotification = {
  id: 'n1',
  title: { ja: 'テンプレ更新', en: 'Template updated' },
  body: { ja: '最新版で軽減を引き継いで使えます', en: 'You can carry over mitigations' },
  published: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('SystemNotificationModal', () => {
  it('isOpen=false なら何も描画しない', () => {
    const { container } = render(
      <SystemNotificationModal isOpen={false} notif={sample} onClose={() => {}} />
    );
    expect(container.textContent).toBe('');
  });

  it('title と body を ja 表示し、 X/Discord リンクが正しい href を持つ', () => {
    render(<SystemNotificationModal isOpen={true} notif={sample} onClose={() => {}} />);
    expect(screen.getByText('テンプレ更新')).toBeTruthy();
    expect(screen.getByText('最新版で軽減を引き継いで使えます')).toBeTruthy();
    const xLink = screen.getByRole('link', { name: /X|Twitter/i });
    expect(xLink.getAttribute('href')).toBe(LOPO_X_URL);
    const discordLink = screen.getByRole('link', { name: /Discord/i });
    expect(discordLink.getAttribute('href')).toBe(LOPO_DISCORD_URL);
  });

  it('閉じるボタン押下で onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(<SystemNotificationModal isOpen={true} notif={sample} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /閉じる|close|既読/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: テスト実行 (失敗確認)**

Run: `npx vitest run src/components/__tests__/SystemNotificationModal.test.tsx --reporter=default`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: モーダルコンポーネント実装**

```tsx
// src/components/SystemNotificationModal.tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { resolveLocalized } from '../lib/localizedText';
import { LOPO_X_URL, LOPO_DISCORD_URL } from '../lib/systemNotifLinks';
import type { SystemNotification } from '../types/systemNotification';

interface Props {
  isOpen: boolean;
  notif: SystemNotification | null;
  /** モーダル閉じ操作 (× / ESC / backdrop / 「既読にする」 ボタン)。 既読化処理は親側で。 */
  onClose: () => void;
}

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh';

function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}

export const SystemNotificationModal: React.FC<Props> = ({ isOpen, notif, onClose }) => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);

  // ESC で閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !notif) return null;

  const title = resolveLocalized(notif.title, lang);
  const body = resolveLocalized(notif.body, lang);
  const dateStr = new Date(notif.createdAt).toLocaleDateString();

  const modal = (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-notif-title"
          className="relative w-[min(560px,calc(100vw-32px))] max-h-[80vh] overflow-auto rounded-lg border border-app-text/15 bg-app-bg text-app-text p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
        >
          {/* × 閉じる */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute top-3 right-3 p-1 rounded text-app-text-muted hover:text-app-text hover:bg-app-text/10 transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>

          {/* タイトル */}
          <h2 id="system-notif-title" className="text-app-xl font-bold pr-8">
            📢 {title}
          </h2>

          {/* 本文 (改行保持) */}
          <div className="mt-4 text-app-base whitespace-pre-wrap">{body}</div>

          {/* 投稿日 */}
          <div className="mt-4 text-app-sm text-app-text-muted">{dateStr}</div>

          {/* X / Discord フッター */}
          <div className="mt-6 pt-4 border-t border-app-text/10">
            <div className="text-app-sm text-app-text-muted mb-2">
              {t('system_notif.modal.footer_info')}
            </div>
            <div className="flex gap-3">
              <a
                href={LOPO_X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded border border-app-text/20 text-app-sm hover:bg-app-text/5 transition-colors"
              >
                {t('system_notif.modal.x')}
              </a>
              <a
                href={LOPO_DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded border border-app-text/20 text-app-sm hover:bg-app-text/5 transition-colors"
              >
                {t('system_notif.modal.discord')}
              </a>
            </div>
          </div>

          {/* 既読にする (= 閉じる) */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-app-text text-app-bg text-app-sm font-bold hover:opacity-90 transition-opacity"
            >
              {t('system_notif.modal.mark_read')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
};
```

- [ ] **Step 4: i18n キー仮置き (Task 8 で全 4 言語に展開、 今は ja のみ)**

`src/locales/ja.json` の末尾に system_notif セクションを追加 (既存 JSON 構造の末尾 `}` の直前に `,` 付きで挿入):

```json
"system_notif": {
  "modal": {
    "footer_info": "過去の通知や最新情報は",
    "x": "X (Twitter)",
    "discord": "Discord",
    "mark_read": "既読にする"
  }
}
```

- [ ] **Step 5: テスト実行 (PASS 確認)**

Run: `npx vitest run src/components/__tests__/SystemNotificationModal.test.tsx --reporter=default`
Expected: PASS, 3 tests

- [ ] **Step 6: Commit**

```bash
git add src/components/SystemNotificationModal.tsx src/components/__tests__/SystemNotificationModal.test.tsx src/locales/ja.json
git commit -m "feat(notif): viewport 中央モーダル + X/Discord フッター案内"
```

---

## Task 7: SystemNotificationBar コンポーネント

**Files:**
- Create: `src/components/SystemNotificationBar.tsx`
- Test: `src/components/__tests__/SystemNotificationBar.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/components/__tests__/SystemNotificationBar.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemNotificationBar } from '../SystemNotificationBar';
import * as hookModule from '../../store/useSystemNotifications';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

const markRead = vi.fn();
const noUnread = () => ({ items: [], unreadCount: 0, latestUnread: null, markRead });
const oneUnread = () => ({
  items: [],
  unreadCount: 1,
  latestUnread: {
    id: 'n1',
    title: { ja: '更新です', en: 'Update' },
    body: { ja: '本文', en: 'body' },
    published: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  markRead,
});

describe('SystemNotificationBar', () => {
  beforeEach(() => {
    markRead.mockReset();
  });

  it('未読 0 のとき null を返し何も描画しない', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(noUnread());
    const { container } = render(<SystemNotificationBar isCollapsed={false} />);
    expect(container.textContent).toBe('');
  });

  it('未読 1 件以上のとき ベルとマーキー (タイトル) を描画する', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(oneUnread());
    render(<SystemNotificationBar isCollapsed={false} />);
    expect(screen.getByText('更新です')).toBeTruthy();
    expect(screen.getByRole('button', { name: /通知|notification/i })).toBeTruthy();
  });

  it('collapsed=true のときマーキーは描画されない (ベルのみ)', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(oneUnread());
    render(<SystemNotificationBar isCollapsed={true} />);
    expect(screen.queryByText('更新です')).toBeNull();
    expect(screen.getByRole('button', { name: /通知|notification/i })).toBeTruthy();
  });

  it('クリックでモーダルが開き、 閉じると markRead が呼ばれる', () => {
    vi.spyOn(hookModule, 'useSystemNotifications').mockReturnValue(oneUnread());
    render(<SystemNotificationBar isCollapsed={false} />);
    fireEvent.click(screen.getByRole('button', { name: /通知|notification/i }));
    // モーダルの「閉じる」 (既読にする) を押下
    fireEvent.click(screen.getByRole('button', { name: /既読/i }));
    expect(markRead).toHaveBeenCalledWith('n1');
  });
});
```

- [ ] **Step 2: テスト実行 (失敗確認)**

Run: `npx vitest run src/components/__tests__/SystemNotificationBar.test.tsx --reporter=default`
Expected: FAIL

- [ ] **Step 3: Bar 実装**

```tsx
// src/components/SystemNotificationBar.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { useSystemNotifications } from '../store/useSystemNotifications';
import { SystemNotificationModal } from './SystemNotificationModal';
import { resolveLocalized } from '../lib/localizedText';

interface Props {
  /** Sidebar が折りたたまれているとき true。 マーキー非表示、 ベルのみに */
  isCollapsed: boolean;
}

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh';
function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}

export const SystemNotificationBar: React.FC<Props> = ({ isCollapsed }) => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);
  const { latestUnread, markRead } = useSystemNotifications();
  const [open, setOpen] = useState(false);

  // 未読 0 → バー枠ごと描画しない (Sidebar が縮む)
  if (!latestUnread) return null;

  const title = resolveLocalized(latestUnread.title, lang);

  function handleClose() {
    setOpen(false);
    if (latestUnread) markRead(latestUnread.id);
  }

  return (
    <>
      <div className="border-t border-b border-app-text/10 flex items-stretch min-h-9 select-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('system_notif.bar.aria_bell')}
          className="flex-shrink-0 px-3 py-1.5 flex items-center text-app-text hover:bg-app-text/5 transition-colors"
        >
          <Bell size={16} aria-hidden="true" />
        </button>
        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-1 min-w-0 overflow-hidden text-left py-1.5 hover:bg-app-text/5 transition-colors"
            aria-label={title}
          >
            <span className="inline-block whitespace-nowrap text-app-sm text-app-text-muted system-notif-marquee">
              📢 {title}
            </span>
          </button>
        )}
      </div>
      <SystemNotificationModal isOpen={open} notif={latestUnread} onClose={handleClose} />
    </>
  );
};
```

- [ ] **Step 4: マーキー CSS を index.css に追加**

`src/index.css` の末尾に追加:

```css
/* 運営通知 Bar の右→左マーキー */
@keyframes system-notif-marquee {
  0%   { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}
.system-notif-marquee {
  animation: system-notif-marquee 12s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .system-notif-marquee {
    animation: none;
    transform: translateX(0);
  }
}
```

- [ ] **Step 5: テスト実行 (PASS 確認)**

Run: `npx vitest run src/components/__tests__/SystemNotificationBar.test.tsx --reporter=default`
Expected: PASS, 4 tests

- [ ] **Step 6: i18n キー追加 (ja.json に system_notif.bar セクション)**

`src/locales/ja.json` の `system_notif` 内に追加:

```json
"bar": {
  "aria_bell": "運営からの通知"
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/SystemNotificationBar.tsx src/components/__tests__/SystemNotificationBar.test.tsx src/index.css src/locales/ja.json
git commit -m "feat(notif): Sidebar 下端のベル+マーキー Bar (未読 0 で消える)"
```

---

## Task 8: 4 言語 i18n キー完備

**Files:**
- Modify: `src/locales/ja.json` (既存に追加済 → 整理)
- Modify: `src/locales/en.json` (新規キー追加)
- Modify: `src/locales/ko.json` (ja コピーで仮配置)
- Modify: `src/locales/zh.json` (ja コピーで仮配置)

注意: ja.json の整形は既存の indent (4 space? 2 space?) に合わせる。 既存ファイル先頭を見て同じスタイル。 ja の system_notif セクションは既に Task 6/7 で追加済 → en/ko/zh に同等キーを足す。

- [ ] **Step 1: 共通の system_notif キーを定義 (各 4 言語)**

各 json の **同じ場所** (例: 既存 `housing` キーの直後) に挿入。 既存 indent を維持。

**ja.json**: (Task 6/7 で追加済の確認 + 不足分を追加)
```json
"system_notif": {
  "modal": {
    "footer_info": "過去の通知や最新情報は",
    "x": "X (Twitter)",
    "discord": "Discord",
    "mark_read": "既読にする"
  },
  "bar": {
    "aria_bell": "運営からの通知"
  },
  "admin": {
    "tab_label": "通知",
    "page_title": "運営通知",
    "list_empty": "通知がありません",
    "new_button": "新規投稿",
    "field_title_ja": "タイトル (ja)",
    "field_title_en": "タイトル (en)",
    "field_title_ko": "タイトル (ko) — optional",
    "field_title_zh": "タイトル (zh) — optional",
    "field_body_ja": "本文 (ja)",
    "field_body_en": "本文 (en)",
    "field_body_ko": "本文 (ko) — optional",
    "field_body_zh": "本文 (zh) — optional",
    "field_published": "公開する",
    "save": "保存",
    "cancel": "キャンセル",
    "edit": "編集",
    "delete": "削除",
    "delete_confirm": "この通知を削除します。 元に戻せません。 よろしいですか?",
    "publish_on": "公開中",
    "publish_off": "停止中",
    "toggle_publish": "公開停止 / 公開",
    "save_error": "保存に失敗しました"
  }
}
```

**en.json**: 同じキー構造、 英語訳:
```json
"system_notif": {
  "modal": {
    "footer_info": "For past notifications and latest news:",
    "x": "X (Twitter)",
    "discord": "Discord",
    "mark_read": "Mark as read"
  },
  "bar": {
    "aria_bell": "Notifications from team"
  },
  "admin": {
    "tab_label": "Notifications",
    "page_title": "System Notifications",
    "list_empty": "No notifications",
    "new_button": "New",
    "field_title_ja": "Title (ja)",
    "field_title_en": "Title (en)",
    "field_title_ko": "Title (ko) — optional",
    "field_title_zh": "Title (zh) — optional",
    "field_body_ja": "Body (ja)",
    "field_body_en": "Body (en)",
    "field_body_ko": "Body (ko) — optional",
    "field_body_zh": "Body (zh) — optional",
    "field_published": "Published",
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete",
    "delete_confirm": "Delete this notification? This cannot be undone.",
    "publish_on": "Published",
    "publish_off": "Hidden",
    "toggle_publish": "Toggle publish",
    "save_error": "Failed to save"
  }
}
```

**ko.json / zh.json**: ja の値をそのままコピー (memory `feedback_admin_design`、 後追い翻訳)。

- [ ] **Step 2: JSON 構文チェック**

Run: `node -e "['ja','en','ko','zh'].forEach(l => JSON.parse(require('fs').readFileSync('src/locales/' + l + '.json','utf8')))"`
Expected: 何も出力なし (= JSON 構文 OK)

- [ ] **Step 3: vitest で既存テスト破綻なし確認**

Run: `npx vitest run --reporter=default`
Expected: 既存 1042 pass を維持

- [ ] **Step 4: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(notif): i18n キー 4 言語追加 (ko/zh は ja コピーで仮配置)"
```

---

## Task 9: Sidebar.tsx に Bar 配置

**Files:**
- Modify: `src/components/Sidebar.tsx` (バックアップ/復元の上に配置、 isOpen を isCollapsed と読み替えて props 渡し)

- [ ] **Step 1: Sidebar.tsx の「バックアップ / 復元」 行を含むブロック箇所を特定**

Run: `grep -n "バックアップ\|backup" src/components/Sidebar.tsx | head -10`
Expected: 該当行 (BackupExportModal 開く button のあたり) が見つかる

- [ ] **Step 2: 該当ブロックの**直前**に SystemNotificationBar を挿入**

`src/components/Sidebar.tsx` の import 群に追加:

```ts
import { SystemNotificationBar } from './SystemNotificationBar';
```

「バックアップ / 復元」 ボタン群 (例: `<div className="..."> ... <button>...バックアップ</button> ... </div>` の包む div) の**直前**に挿入:

```tsx
<SystemNotificationBar isCollapsed={!isOpen} />
```

注: `isOpen` は SidebarProps の prop (前述 Sidebar.tsx:67)。 Sidebar 開いた状態 = isOpen true → isCollapsed false。

- [ ] **Step 3: 統合動作の sanity test (vitest 全体で既存テスト維持)**

Run: `npx vitest run --reporter=default`
Expected: 1042 + Task 5/6/7 で追加した分が全 pass

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(notif): Sidebar 下端 (バックアップ/復元の上) に通知 Bar を配置"
```

---

## Task 10: firestore.rules 追加

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: rules ファイルの最終行 (`}` `}` の直前) に system_notifications ブロック追加**

```
// ========================================
// system_notifications コレクション
// read: public (全ユーザー閲覧可)
// write: client から不可 (admin API + Firebase Admin SDK 経由のみ)
// ========================================
match /system_notifications/{id} {
  allow read: if true;
  allow write: if false;
}
```

- [ ] **Step 2: Firestore rules 文法チェック (firebase CLI があれば、 無ければ目視)**

Run: `npx firebase emulators:start --only firestore 2>&1 | head -5` (firebase CLI installed 前提)
Expected: rules 読み込みエラーなし。 (CLI 無ければ deploy 時に検出)

Skip OK: ローカルチェック手段が無ければ次に進む、 デプロイ時に確認。

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(notif): firestore.rules に system_notifications を追加 (read=public, write=admin SDK のみ)"
```

---

## Task 11: Admin serverless API

**Files:**
- Create: `api/admin/system-notifications.ts`

参考既存パターン: `api/housing/` 配下の admin API (Firebase Admin SDK + Discord OAuth 認証) — 既存の admin 認証 helper を流用。

- [ ] **Step 1: 既存 admin API の認証パターンを確認**

Run: `grep -l "isAdminUser\|verifyAdmin\|requireAdmin" api/` (or src/lib)
Expected: 既存 admin API ファイルが見つかる。 同じ helper を import して使う。

- [ ] **Step 2: API ファイル作成**

```ts
// api/admin/system-notifications.ts
/**
 * 運営通知の管理 API (POST 投稿 / PATCH 編集 / DELETE 削除)。
 * Firebase Admin SDK で system_notifications collection に直接書き込む
 * (firestore.rules で client write は完全に塞いでいるため、 admin 経由のみが唯一の書き込み手段)。
 * admin 認証は既存 admin API と同じ helper を使う。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminFirestore } from '../../src/lib/firebaseAdmin'; // 既存 helper を再利用
import { requireAdmin } from '../../src/lib/adminAuth';            // 既存 helper を再利用
import type { SystemNotifCreatePayload, SystemNotifUpdatePayload } from '../../src/types/systemNotification';

function isValidLocalizedText(obj: unknown, requireKoZh = false): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const t = obj as Record<string, unknown>;
  if (typeof t.ja !== 'string' || t.ja.length === 0) return false;
  if (typeof t.en !== 'string' || t.en.length === 0) return false;
  if (requireKoZh && (typeof t.ko !== 'string' || typeof t.zh !== 'string')) return false;
  // ko/zh が存在する場合は string 型でなければならない
  if ('ko' in t && t.ko !== undefined && typeof t.ko !== 'string') return false;
  if ('zh' in t && t.zh !== undefined && typeof t.zh !== 'string') return false;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAdmin(req); // 失敗で throw、 401/403 を別 catch で
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const db = getAdminFirestore();
  const col = db.collection('system_notifications');

  if (req.method === 'POST') {
    const payload = req.body as SystemNotifCreatePayload;
    if (!isValidLocalizedText(payload?.title) || !isValidLocalizedText(payload?.body)) {
      return res.status(400).json({ error: 'invalid_payload' });
    }
    const now = Date.now();
    const docRef = await col.add({
      title: payload.title,
      body: payload.body,
      published: payload.published !== false,
      createdAt: now,
      updatedAt: now,
    });
    return res.status(200).json({ id: docRef.id });
  }

  if (req.method === 'PATCH') {
    const { id, ...patch } = req.body as { id: string } & SystemNotifUpdatePayload;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid_id' });
    if (patch.title && !isValidLocalizedText(patch.title)) return res.status(400).json({ error: 'invalid_title' });
    if (patch.body && !isValidLocalizedText(patch.body)) return res.status(400).json({ error: 'invalid_body' });
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.title) update.title = patch.title;
    if (patch.body) update.body = patch.body;
    if (typeof patch.published === 'boolean') update.published = patch.published;
    await col.doc(id).update(update);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = (req.body || req.query) as { id: string };
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid_id' });
    await col.doc(id).delete();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
```

注: `getAdminFirestore` / `requireAdmin` の正確な path / 関数名は **Step 1** の grep で見つけた既存 helper に合わせる。 違う名前なら適宜置換。

- [ ] **Step 3: tsc check**

Run: `npx tsc --noEmit`
Expected: PASS (import path / helper 名が既存と一致しているか確認)

- [ ] **Step 4: Commit**

```bash
git add api/admin/system-notifications.ts
git commit -m "feat(notif): admin serverless API (POST/PATCH/DELETE) で system_notifications を書き換える"
```

---

## Task 12: AdminSystemNotifications コンポーネント

**Files:**
- Create: `src/components/admin/AdminSystemNotifications.tsx`

参考既存パターン: [src/components/admin/AdminContents.tsx](src/components/admin/AdminContents.tsx) (一覧 + 編集モーダル + 削除確認 のパターン)

- [ ] **Step 1: Admin ページ実装**

```tsx
// src/components/admin/AdminSystemNotifications.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collection,
  getFirestore,
  orderBy,
  query,
  onSnapshot,
} from 'firebase/firestore';
import type { SystemNotification, LocalizedText } from '../../types/systemNotification';
import { Pencil, Trash2, Eye, EyeOff, Plus } from 'lucide-react';

function emptyLocalized(): LocalizedText {
  return { ja: '', en: '' };
}

interface EditState {
  isOpen: boolean;
  editing: SystemNotification | null; // null = 新規
}

export const AdminSystemNotifications: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<SystemNotification[]>([]);
  const [edit, setEdit] = useState<EditState>({ isOpen: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 全 doc を新着順購読 (admin は published に関わらず全表示)
  useEffect(() => {
    const q = query(collection(getFirestore(), 'system_notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SystemNotification, 'id'>) }));
      setItems(next);
    });
    return () => unsub();
  }, []);

  function openNew() {
    setEdit({ isOpen: true, editing: null });
    setErrorMsg('');
  }

  function openEdit(item: SystemNotification) {
    setEdit({ isOpen: true, editing: item });
    setErrorMsg('');
  }

  async function save(payload: {
    title: LocalizedText;
    body: LocalizedText;
    published: boolean;
    id?: string;
  }) {
    setSaving(true);
    setErrorMsg('');
    try {
      const method = payload.id ? 'PATCH' : 'POST';
      const res = await fetch('/api/admin/system-notifications', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('save_failed');
      setEdit({ isOpen: false, editing: null });
    } catch {
      setErrorMsg(t('system_notif.admin.save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(item: SystemNotification) {
    await fetch('/api/admin/system-notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: item.id, published: !item.published }),
    });
  }

  async function remove(item: SystemNotification) {
    if (!confirm(t('system_notif.admin.delete_confirm'))) return;
    await fetch('/api/admin/system-notifications', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-app-2xl font-bold">{t('system_notif.admin.page_title')}</h1>
        <button
          type="button"
          onClick={openNew}
          className="px-3 py-2 rounded bg-app-text text-app-bg text-app-base font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
        >
          <Plus size={16} /> {t('system_notif.admin.new_button')}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-app-text-muted py-8 text-center">{t('system_notif.admin.list_empty')}</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="border border-app-text/15 rounded p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{item.title.ja}</div>
                <div className="text-app-sm text-app-text-muted truncate">{item.body.ja}</div>
                <div className="text-app-xs text-app-text-muted mt-1">
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-app-xs ${item.published ? 'bg-app-text/15' : 'bg-app-text/5 text-app-text-muted'}`}
              >
                {item.published ? t('system_notif.admin.publish_on') : t('system_notif.admin.publish_off')}
              </span>
              <button
                type="button"
                onClick={() => togglePublish(item)}
                aria-label={t('system_notif.admin.toggle_publish')}
                className="p-2 rounded hover:bg-app-text/10"
              >
                {item.published ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={() => openEdit(item)}
                aria-label={t('system_notif.admin.edit')}
                className="p-2 rounded hover:bg-app-text/10"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={t('system_notif.admin.delete')}
                className="p-2 rounded hover:bg-red-500/15 text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {edit.isOpen && (
        <EditModal
          initial={edit.editing}
          onCancel={() => setEdit({ isOpen: false, editing: null })}
          onSave={save}
          saving={saving}
          errorMsg={errorMsg}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// EditModal (内部コンポーネント)
// ─────────────────────────────────────────────

const EditModal: React.FC<{
  initial: SystemNotification | null;
  onCancel: () => void;
  onSave: (payload: {
    id?: string;
    title: LocalizedText;
    body: LocalizedText;
    published: boolean;
  }) => void;
  saving: boolean;
  errorMsg: string;
}> = ({ initial, onCancel, onSave, saving, errorMsg }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState<LocalizedText>(initial?.title ?? emptyLocalized());
  const [body, setBody] = useState<LocalizedText>(initial?.body ?? emptyLocalized());
  const [published, setPublished] = useState<boolean>(initial?.published ?? true);

  const valid = title.ja && title.en && body.ja && body.en;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-[min(640px,100%)] max-h-[90vh] overflow-auto bg-app-bg border border-app-text/15 rounded p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-app-xl font-bold mb-4">{initial ? t('system_notif.admin.edit') : t('system_notif.admin.new_button')}</h2>

        {(['ja', 'en', 'ko', 'zh'] as const).map((lang) => (
          <div key={`title-${lang}`} className="mb-3">
            <label className="block text-app-sm mb-1">{t(`system_notif.admin.field_title_${lang}`)}</label>
            <input
              type="text"
              value={title[lang] ?? ''}
              onChange={(e) => setTitle({ ...title, [lang]: e.target.value })}
              className="w-full px-2 py-1 bg-app-bg border border-app-text/20 rounded text-app-base"
            />
          </div>
        ))}

        {(['ja', 'en', 'ko', 'zh'] as const).map((lang) => (
          <div key={`body-${lang}`} className="mb-3">
            <label className="block text-app-sm mb-1">{t(`system_notif.admin.field_body_${lang}`)}</label>
            <textarea
              value={body[lang] ?? ''}
              onChange={(e) => setBody({ ...body, [lang]: e.target.value })}
              rows={4}
              className="w-full px-2 py-1 bg-app-bg border border-app-text/20 rounded text-app-base"
            />
          </div>
        ))}

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span className="text-app-base">{t('system_notif.admin.field_published')}</span>
        </label>

        {errorMsg && <div className="text-red-500 text-app-sm mb-3">{errorMsg}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-app-text/20"
          >
            {t('system_notif.admin.cancel')}
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => onSave({
              id: initial?.id,
              title,
              body,
              published,
            })}
            className="px-3 py-1.5 rounded bg-app-text text-app-bg font-bold disabled:opacity-50"
          >
            {t('system_notif.admin.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: tsc check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminSystemNotifications.tsx
git commit -m "feat(notif): 管理画面 (一覧/新規/編集/公開停止/削除) を実装"
```

---

## Task 13: Admin タブと Router 登録

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/App.tsx` (or admin router)

- [ ] **Step 1: AdminLayout.tsx の NAV_ITEMS 配列に追加**

```ts
// src/components/admin/AdminLayout.tsx (NAV_ITEMS の末尾近く)
{ path: '/admin/notifications', labelKey: 'system_notif.admin.tab_label', end: false },
```

- [ ] **Step 2: ルート登録 (src/App.tsx もしくは admin ルーター)**

既存の admin route 群と同じ箇所に追加:

```tsx
import { AdminSystemNotifications } from './components/admin/AdminSystemNotifications';

// ...既存の admin route 内に追加
<Route path="notifications" element={<AdminSystemNotifications />} />
```

具体的な書く場所は既存の `<Route path="contents" element={<AdminContents />} />` 等の隣に。

- [ ] **Step 3: tsc check + 既存 vitest 維持**

Run: `npx tsc --noEmit && npx vitest run --reporter=default`
Expected: tsc PASS、 vitest 既存 + 新規 全 pass

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat(notif): admin タブ「通知」 + /admin/notifications ルートを追加"
```

---

## Task 14: 統合動作確認 → build → push & デプロイ

**Files:** (なし、 確認 + push のみ)

- [ ] **Step 1: ローカル開発サーバで end-to-end 動作確認**

Run: `npm run dev`

ブラウザで:
1. `http://localhost:5173/admin/notifications` を開く (admin ログイン要)
2. 「新規投稿」 → ja/en に「テンプレ更新しました」 等を入力 → 公開 ON → 保存
3. `http://localhost:5173/` (軽減表アプリ) に移動
4. Sidebar 下端 (バックアップ/復元の上) にベル + マーキー (タイトル流れる) が表示されるか
5. クリック → viewport 中央モーダル開く (Sidebar 幅に偏らない)
6. 「既読にする」 押下 → モーダル閉じる → Sidebar の ベル + マーキー枠が**消える** (Sidebar が縮む)
7. F5 リロード → 既読状態は保持 (localStorage)
8. シークレットウィンドウで開く → 同じ通知がまた未読として表示 (端末別なので想定挙動)
9. admin で公開停止 toggle → ユーザー画面で即時消える
10. admin で 2 件目投稿 → 1 件目既読化後に 2 件目が表示される

Expected: 全項目想定通り

- [ ] **Step 2: tsc + build + vitest 最終チェック**

Run: `npx tsc --noEmit && npm run build && npx vitest run --reporter=default`
Expected: tsc PASS / build green / vitest 全 pass (1042 + 約 18 新規 = 約 1060)

- [ ] **Step 3: TODO.md と spec を「実装完了」 に更新**

`docs/TODO.md` の「現在の状態」 を更新、 通知バッジ機能完成を反映、 残作業 (将来拡張: ko/zh 翻訳 / 通知ジャンル分け / 既読端末同期 / Web Push / 予約投稿) を memo。

- [ ] **Step 4: 最終 commit + push**

```bash
git add docs/TODO.md
git commit -m "docs(todo): 運営通知バッジ機能 実装完了 → TODO 更新"
git push origin main
```

Vercel 自動デプロイ確認 (1〜2 分)、 本番 (`lopoly.app`) で動作確認:
- `/admin/notifications` で投稿
- `/sheet` (or 軽減表アプリ画面) Sidebar 下端に出るか
- 「既読にする」 で消えるか

---

## 自己レビューチェック (writing-plans skill 規定)

1. **Spec coverage**: spec の全セクションがタスクに対応
   - §2 データモデル → Task 1 (型), Task 10 (rules), Task 11 (API), Task 12 (admin UI)
   - §3 既読 localStorage → Task 4
   - §4 UI Sidebar 下端 + マーキー + 未読 0 で消える → Task 7, Task 9
   - §5 モーダル + X/Discord フッター + 既読化動作 → Task 6
   - §6 admin → Task 11, 12, 13
   - §7 ファイル構成 → File Structure セクション
   - §8 テスト → 各 task に test 含む

2. **Placeholder scan**: TBD / TODO / 「適切なエラーハンドリング」 等の placeholder 無し。 全 step 完全コード。

3. **Type consistency**:
   - `LocalizedText` Task 1 で定義 → Task 3/5/6/7/11/12 で同じ name 使用 ✅
   - `SystemNotification` 同 ✅
   - `STORAGE_KEY` Task 4 export → Task 5 test で import ✅
   - `useSystemNotifications` Task 5 → Task 7 / spy で参照 ✅
   - `resolveLocalized(text, lang)` Task 3 → Task 6/7 で `lang` を normalize 後渡す ✅
   - `markRead(id)` Task 4/5 → Task 7 で呼び出し ✅
   - i18n キー `system_notif.modal.x` 等 Task 6/7/8 で一貫 ✅

修正点なし、 plan 完了。
