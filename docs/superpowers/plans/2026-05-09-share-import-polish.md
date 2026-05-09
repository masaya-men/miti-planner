# Phase B-1.5 polish: ShareImportSheet UI/UX 仕上げ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ShareImportSheet と LimitResolutionSheet のレイアウト統一、 sweep アニメ採用、 上限ヒット演出、 シート 2 段階アニメ、 総上限事前判定、 キャンセルボタン追加を 1 PR で完成させる。

**Architecture:** SharePlanCard を中心の表示単位に置き、 sweep アニメは新規 SweepOverlay として共通化。 ShareImportProgressIndicator は削除 (sweep に統合)。 ShareImportSheet / LimitResolutionSheet は同一レイアウト (左狭リスト + 右広 preview)、 同一 spring transition (`stiffness: 300, damping: 28`)、 共に framer-motion `layout` prop で内容拡張時の高さアニメを自動化。 executeShareImport は冒頭で総上限事前判定を行い、 per_content limit hit 時は赤背景 → 800ms wait → 重ねシート開始のシーケンスを発火。

**Tech Stack:** React + TypeScript + framer-motion (layout prop, spring transition) + zustand + vitest + happy-dom

**Spec:** [docs/superpowers/specs/2026-05-09-share-import-polish-design.md](../specs/2026-05-09-share-import-polish-design.md)

---

## 注記: spec § 3.2 の prop リネームについて

Spec は「`title` → `contentLabel` + `planTitle` にリネーム」 と書いているが、 現状の `SharePlanCard` は既に `title` / `subtitle` の 2 prop を備えており、 既存テスト (`SharePlanCard.test.tsx`) も両 prop を expect している。 リネームは不要 — call site (`ShareImportSheet`, `LimitResolutionSheet`) で `title={contentLabel}` `subtitle={planTitle}` を渡せば spec 意図を満たせる。 本プランでは prop 名は変えず、 SharePlanCard には red flag / exit / sweep の **新 prop だけを追加** する方針で進める。

---

## File Structure (新規・変更ファイル一覧)

| ファイル | 区分 | 役割 |
|---|---|---|
| `src/components/SweepOverlay.tsx` | 新規 | B2 sweep アニメオーバーレイ (青/赤、 1200ms linear) |
| `src/components/__tests__/SweepOverlay.test.tsx` | 新規 | SweepOverlay の単体テスト |
| `src/components/SharePlanCard.tsx` | 変更 | red flag / exit / sweep の新 prop 追加 |
| `src/components/__tests__/SharePlanCard.test.tsx` | 変更 | 新 prop のテスト追加 |
| `src/components/ShareImportSheet.tsx` | 変更 | レイアウト統一 / キャンセルボタン / layout prop / spring 統一 |
| `src/components/__tests__/ShareImportSheet.test.tsx` | 変更 | 単一でも左カラム / キャンセル / 新 i18n key 用テスト |
| `src/components/LimitResolutionSheet.tsx` | 変更 | レイアウト統一 / max_total モード / sweep 赤 / カード退場 / spring 統一 |
| `src/components/__tests__/LimitResolutionSheet.test.tsx` | 変更 | mobile preview 表示 / max_total モード / sweep 表示 |
| `src/components/LocalImportDialog.tsx` | 変更 | renderSweep 内部関数削除 → SweepOverlay 利用 |
| `src/components/ShareImportProgressIndicator.tsx` | **削除** | sweep に統合され不要 |
| `src/components/__tests__/ShareImportProgressIndicator.test.tsx` | **削除** | 上記に対応 |
| `src/lib/shareImportTypes.ts` | 変更 | `LimitContext` 型追加 (existing 内には無い、 useShareImportFlow にあるのを移管) |
| `src/lib/executeShareImport.ts` | 変更 | 総上限事前判定 / per_content の赤背景シーケンス / onLimitHit に reason 引数追加 |
| `src/lib/__tests__/executeShareImport.test.ts` | 変更 | 事前判定 / 赤背景シーケンスのテスト追加 |
| `src/store/useShareImportFlow.ts` | 変更 | LimitContext.reason / redFlaggedPlanIds state / setRedFlag / clearRedFlag |
| `src/store/__tests__/useShareImportFlow.test.ts` | 変更 | red flag state / reason 拡張のテスト |
| `src/locales/{ja,en,ko,zh}.json` | 変更 | 14 キー削除 + 1 キー追加 |
| `docs/TODO.md` | 変更 | 完了報告 + #8 drop の記録 |

---

## Task 1: 型整理 + i18n キー削除/追加

**Files:**
- Modify: `src/lib/shareImportTypes.ts` — `LimitContext` 型をここに集約
- Modify: `src/store/useShareImportFlow.ts:23-29` — 既存 `LimitContext` インライン定義を削除、 `shareImportTypes` から import
- Modify: `src/locales/ja.json:190-197` (share_import.progress_*) / `:210-215` (limit_resolution.delete_*)
- Modify: `src/locales/en.json` / `ko.json` / `zh.json` (同じセクションの該当キー)

### Step 1: Modify `src/lib/shareImportTypes.ts` — `LimitContext` 型を追加

末尾に以下を追加:

```typescript
// 上限ヒット時に LimitResolutionSheet へ渡すコンテキスト。
// reason により表示モード (per content / 総上限) を分岐する。
export type LimitReason = 'max_per_content' | 'max_total';

export interface LimitContext {
  reason: LimitReason;
  /** max_total のときは null。 max_per_content のときは対象 contentId */
  contentId: string | null;
  /** 解消に必要な削除件数 (≧1) */
  neededCount: number;
  /** max_total のときは null。 max_per_content のときはヒットした取り込み対象の planId (= ShareImportItem.sourcePlanId ?? sourceShareId) */
  planId: string | null;
  resolve: (decision: 'resolved' | 'cancelled') => void;
}
```

### Step 2: Modify `src/store/useShareImportFlow.ts:23-29` — インライン型を import に置換

変更前:
```typescript
interface LimitContext {
  contentId: string;
  neededCount: number;
  planId: string;
  resolve: (decision: 'resolved' | 'cancelled') => void;
}
```

変更後:
```typescript
// LimitContext 型は shareImportTypes.ts に移動 (cross-module で参照されるため)
```

import 行を更新 (上部):
```typescript
import type {
  ShareImportItem,
  ProgressEvent,
  DeleteProgressEvent,
  SharedData,
  LimitContext,
} from '../lib/shareImportTypes';
```

### Step 3: i18n 不要キー削除 (ja.json)

`src/locales/ja.json` で以下を削除:

```diff
 "share_import": {
   "title": "共有された軽減表",
   "title_bundle": "共有された軽減表 ({{count}}件)",
   "loading": "読み込んでいます...",
   "not_found": "この共有 URL は見つかりませんでした",
   "error": "読み込みに失敗しました",
   "already_copied_badge": "取り込み済み",
   "button_import_single": "取り込む",
   "button_import_count": "{{count}} 件を取り込む",
-  "progress_check": "上限を確認しています...",
-  "progress_check_ok": "上限内です",
-  "progress_local": "あなたの端末に保存しています...",
-  "progress_local_ok": "あなたの端末に保存しました",
-  "progress_server": "サーバーに保存しています...",
-  "progress_server_ok": "サーバーに保存しました",
-  "progress_server_failed": "サーバー保存に失敗しました (端末には保存済みです、 後で自動で再試行します)",
-  "progress_local_failed": "端末への保存に失敗しました",
+  "button_cancel": "キャンセル",
   "done_summary": "{{count}} 件の軽減表を取り込みました",
   "cancelled_some": "{{cancelled}} 件はキャンセルしました"
 },
 "limit_resolution": {
   "title_per_content": "{{contentName}} は既に {{current}}/{{max}} 件です",
   "title_total": "総上限 {{current}}/{{max}} 件に達しています",
   "body": "整理する軽減表をチェックしてください。 残り {{count}} 件取り込めます。",
   "card_label_last_opened": "最終 {{date}}",
   "selection_count": "{{count}} 件選択中",
   "button_delete_and_resume": "{{count}} 件削除して再開",
   "button_delete_and_resume_disabled": "削除する軽減表をチェックしてください",
   "button_cancel": "キャンセル",
-  "delete_progress_local": "削除を準備中...",
-  "delete_progress_local_ok": "あなたの端末から削除しました",
-  "delete_progress_server": "サーバーから削除しています...",
-  "delete_progress_server_ok": "サーバーから削除しました",
-  "delete_capacity_freed": "容量空きました ({{current}}/{{max}})",
-  "delete_failed": "削除に失敗しました",
   "resume_message": "{{count}} 件の取り込みを再開します"
 },
```

### Step 4: 同じパターンを en.json / ko.json / zh.json に適用

各ファイルの `share_import` / `limit_resolution` セクションで:
- 同一 14 キー削除
- `share_import.button_cancel` 追加 (en: `"Cancel"`, ko: `"취소"`, zh: `"取消"`)

### Step 5: 検証

Run:
```bash
pnpm tsc --noEmit
```
Expected: clean (ShareImportProgressIndicator はまだ残ってるが i18n key を直接読んでいないので tsc は通る)

Run:
```bash
pnpm vitest run --reporter=verbose 2>&1 | tail -50
```
Expected: 既存 553 件まだ通る (i18n の参照は文字列キーで、 tsc は気付かない / 該当機能はまだ生きてる)

### Step 6: Commit

```bash
git add src/lib/shareImportTypes.ts src/store/useShareImportFlow.ts src/locales/
git commit -m "$(cat <<'EOF'
refactor(shareImportTypes): LimitContext を共通型に集約 + reason フィールド追加

- LimitContext を shareImportTypes.ts に移管 (executeShareImport / store / 各シートで参照)
- reason: 'max_per_content' | 'max_total' 追加 (#7 総上限事前判定向け)
- contentId / planId を nullable 化 (max_total 時は null)
- 不要 i18n キー 14 件削除 (sweep 統合で廃止) + share_import.button_cancel 追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: SweepOverlay コンポーネント新設

**Files:**
- Create: `src/components/SweepOverlay.tsx`
- Create: `src/components/__tests__/SweepOverlay.test.tsx`

### Step 1: Write failing test

Create `src/components/__tests__/SweepOverlay.test.tsx`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SweepOverlay } from '../SweepOverlay';

describe('SweepOverlay', () => {
    it('status="idle" のとき width: 0% で描画する', () => {
        const { container } = render(<SweepOverlay status="idle" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('0%');
    });

    it('status="active" のとき width: 100% で transition 付きで描画する', () => {
        const { container } = render(<SweepOverlay status="active" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('100%');
        expect(el.style.transition).toContain('1200ms');
    });

    it('status="success" のとき width: 100% で transition なし', () => {
        const { container } = render(<SweepOverlay status="success" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.width).toBe('100%');
        expect(el.style.transition).toBe('none');
    });

    it('color="blue" のとき青グラデ背景', () => {
        const { container } = render(<SweepOverlay status="active" color="blue" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.background).toContain('color-app-blue-dim');
    });

    it('color="red" + status="failed" のとき赤グラデ背景', () => {
        const { container } = render(<SweepOverlay status="failed" color="red" />);
        const el = container.firstChild as HTMLElement;
        expect(el.style.background).toContain('color-app-red-dim');
    });

    it('durationMs を渡すと transition の値に反映される', () => {
        const { container } = render(
            <SweepOverlay status="active" color="blue" durationMs={2000} />,
        );
        const el = container.firstChild as HTMLElement;
        expect(el.style.transition).toContain('2000ms');
    });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
pnpm vitest run src/components/__tests__/SweepOverlay.test.tsx
```
Expected: FAIL with "Cannot find module '../SweepOverlay'"

### Step 3: Implement `src/components/SweepOverlay.tsx`

```typescript
// LocalImportDialog で先行実装した B2 sweep アニメをコンポーネント化したもの。
// ShareImportSheet (青、 取り込み) と LimitResolutionSheet (赤、 削除) で共有する。
// 行の中で `position: relative` の親に `position: absolute` で重ねて使う想定。

interface SweepOverlayProps {
  /** idle: 描画前 (width 0%) / active: 走らせ中 (width 0→100%) / success / failed: 100% 維持 */
  status: 'idle' | 'active' | 'success' | 'failed';
  /** blue: 取り込み演出 / red: 削除演出 */
  color: 'blue' | 'red';
  /** sweep 1 本の所要時間 (ms)、 デフォルト 1200ms */
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 1200;

export function SweepOverlay({ status, color, durationMs = DEFAULT_DURATION_MS }: SweepOverlayProps) {
  const sweepActive = status === 'active' || status === 'success' || status === 'failed';
  const bg =
    color === 'red'
      ? 'var(--color-app-red-dim)'
      : 'var(--color-app-blue-dim)';
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: sweepActive ? '100%' : '0%',
        background: bg,
        // active のときだけ width 0→100% の linear アニメ。
        // success/failed/idle は瞬時 (transition なし)。
        transition: status === 'active' ? `width ${durationMs}ms linear` : 'none',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
```

### Step 4: Run test to verify it passes

Run:
```bash
pnpm vitest run src/components/__tests__/SweepOverlay.test.tsx
```
Expected: PASS (6 tests)

### Step 5: Commit

```bash
git add src/components/SweepOverlay.tsx src/components/__tests__/SweepOverlay.test.tsx
git commit -m "$(cat <<'EOF'
feat(SweepOverlay): B2 sweep アニメコンポーネント新設

LocalImportDialog の renderSweep をコンポーネント化、 ShareImportSheet
(青、 取り込み) / LimitResolutionSheet (赤、 削除) で共通利用する。
status (idle/active/success/failed) と color (blue/red) で分岐。
6 vitest PASS。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: SharePlanCard 拡張 (red flag / exit / sweep 新 prop)

**Files:**
- Modify: `src/components/SharePlanCard.tsx`
- Modify: `src/components/__tests__/SharePlanCard.test.tsx`

### Step 1: Write failing tests (追加)

`src/components/__tests__/SharePlanCard.test.tsx` の末尾 (`}` の前) に追加:

```typescript
    it('isRedFlagged=true のとき赤背景 class が付く', () => {
        const { container } = render(<SharePlanCard {...baseProps} isRedFlagged={true} />);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('app-red');
    });

    it('isExiting=true のとき退場アニメ wrapper を描画する', () => {
        const { container } = render(<SharePlanCard {...baseProps} isExiting={true} />);
        // motion.div の data-exiting マーカーで判定 (aria-hidden=true で SR から隠す)
        const card = container.firstChild as HTMLElement;
        expect(card.getAttribute('data-exiting')).toBe('true');
    });

    it('sweepStatus を渡すと SweepOverlay が描画される', () => {
        const { container } = render(
            <SharePlanCard {...baseProps} sweepStatus="active" sweepColor="blue" />,
        );
        // SweepOverlay は aria-hidden div、 child element として現れる
        const sweep = container.querySelector('[aria-hidden="true"]');
        expect(sweep).toBeTruthy();
    });

    it('sweepStatus 未指定のとき SweepOverlay は描画しない', () => {
        const { container } = render(<SharePlanCard {...baseProps} />);
        const sweep = container.querySelector('[aria-hidden="true"]');
        expect(sweep).toBeNull();
    });
```

### Step 2: Run test to verify it fails

Run:
```bash
pnpm vitest run src/components/__tests__/SharePlanCard.test.tsx
```
Expected: 新規 4 件 FAIL with "Property 'isRedFlagged' does not exist" 等

### Step 3: Implement props 拡張

`src/components/SharePlanCard.tsx` 全文を以下に置換:

```typescript
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SweepOverlay } from './SweepOverlay';

// チェックボックス関連プロパティの discriminated union。
type CheckboxProps =
    | { showCheckbox: false }
    | { showCheckbox: true; isChecked: boolean; onToggleCheck: () => void };

type SharePlanCardProps = {
    /** 主タイトル (現在の使い方: コンテンツ名) */
    title: string;
    /** 副タイトル (現在の使い方: プラン名) */
    subtitle?: string;
    isActive: boolean;
    badge?: ReactNode;
    onClickRow: () => void;
    children?: ReactNode;
    /** 上限ヒット時の赤背景フラグ (#4) */
    isRedFlagged?: boolean;
    /** カード退場アニメフラグ (#5: 削除完了後にフェードアウト) */
    isExiting?: boolean;
    /** sweep オーバーレイの状態 (#3, #5)。 undefined のとき非表示 */
    sweepStatus?: 'idle' | 'active' | 'success' | 'failed';
    /** sweep オーバーレイの色 (#3 取り込みで blue, #5 削除で red) */
    sweepColor?: 'blue' | 'red';
} & CheckboxProps;

// 共有取り込み (ShareImportSheet) と上限解消 (LimitResolutionSheet) で共通使用するカード行。
// レイアウト: [SweepOverlay (絶対配置の背景)] [チェックボックス?] [タイトル/サブタイトル] [バッジ?]
//             [children (任意の追加スロット)]
export function SharePlanCard(props: SharePlanCardProps) {
    const {
        title,
        subtitle,
        isActive,
        badge,
        onClickRow,
        children,
        isRedFlagged,
        isExiting,
        sweepStatus,
        sweepColor = 'blue',
    } = props;
    const baseClass = isExiting
        ? 'pointer-events-none'
        : isActive
          ? 'active bg-app-blue/10 border-app-blue/40'
          : isRedFlagged
            ? 'bg-app-red/15 border-app-red/40'
            : 'bg-app-surface2/30 border-app-border hover:bg-app-surface2/50';
    return (
        <motion.div
            data-testid="share-plan-card"
            data-exiting={isExiting ? 'true' : undefined}
            role="button"
            tabIndex={isExiting ? -1 : 0}
            onClick={isExiting ? undefined : onClickRow}
            onKeyDown={(e) => {
                if (isExiting) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClickRow();
                }
            }}
            // LayoutGroup と組み合わせて、 退場時に他カードがスムーズに詰まる
            layout
            initial={false}
            animate={
                isExiting
                    ? { opacity: 0, scale: 0.95, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }
                    : { opacity: 1, scale: 1 }
            }
            transition={{ duration: 0.3, ease: 'easeIn' }}
            className={`relative flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-blue overflow-hidden ${baseClass}`}
        >
            {sweepStatus !== undefined && (
                <SweepOverlay status={sweepStatus} color={sweepColor} />
            )}
            <div className="relative z-[1] flex items-center gap-2">
                {props.showCheckbox && (
                    <input
                        type="checkbox"
                        checked={props.isChecked}
                        onChange={props.onToggleCheck}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isExiting}
                        className="w-4 h-4 cursor-pointer accent-app-blue shrink-0 disabled:cursor-not-allowed"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-app-md text-app-text truncate">
                        {title}
                    </div>
                    {subtitle && (
                        <div className="text-app-sm text-app-text-muted truncate">{subtitle}</div>
                    )}
                </div>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {children && <div className="relative z-[1]">{children}</div>}
        </motion.div>
    );
}
```

### Step 4: Run all SharePlanCard tests to verify

Run:
```bash
pnpm vitest run src/components/__tests__/SharePlanCard.test.tsx
```
Expected: 既存 8 + 新規 4 = 12 PASS

### Step 5: Commit

```bash
git add src/components/SharePlanCard.tsx src/components/__tests__/SharePlanCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(SharePlanCard): red flag / exit / sweep の新 prop 追加

- isRedFlagged: 上限ヒット時の赤背景 (#4)
- isExiting: 削除完了後の退場アニメ (#5)
- sweepStatus + sweepColor: SweepOverlay 描画制御 (#3/#5)
- motion.div layout 採用で退場時の他カード詰めを framer-motion 自動化
- 12 vitest PASS (既存 8 + 新規 4)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: useShareImportFlow に redFlag state 追加

**Files:**
- Modify: `src/store/useShareImportFlow.ts`
- Modify: `src/store/__tests__/useShareImportFlow.test.ts`

### Step 1: Write failing tests (追加)

`src/store/__tests__/useShareImportFlow.test.ts` の末尾の `describe(...)` 内に追加:

```typescript
  describe('redFlaggedPlanIds', () => {
    beforeEach(() => {
      useShareImportFlow.getState().close();
    });

    it('setRedFlag(id) で planId が Set に追加される', () => {
      useShareImportFlow.getState().setRedFlag('plan-x');
      expect(useShareImportFlow.getState().redFlaggedPlanIds.has('plan-x')).toBe(true);
    });

    it('clearRedFlag(id) で planId が Set から削除される', () => {
      useShareImportFlow.getState().setRedFlag('plan-x');
      useShareImportFlow.getState().clearRedFlag('plan-x');
      expect(useShareImportFlow.getState().redFlaggedPlanIds.has('plan-x')).toBe(false);
    });

    it('close() で redFlaggedPlanIds が空 Set にリセットされる', () => {
      useShareImportFlow.getState().setRedFlag('plan-a');
      useShareImportFlow.getState().setRedFlag('plan-b');
      useShareImportFlow.getState().close();
      expect(useShareImportFlow.getState().redFlaggedPlanIds.size).toBe(0);
    });
  });

  describe('LimitContext.reason', () => {
    beforeEach(() => {
      useShareImportFlow.getState().close();
    });

    it('setLimitContext で reason="max_total" がそのまま state に入る', () => {
      const ctx = {
        reason: 'max_total' as const,
        contentId: null,
        neededCount: 3,
        planId: null,
        resolve: () => {},
      };
      useShareImportFlow.getState().setLimitContext(ctx);
      expect(useShareImportFlow.getState().limitContext?.reason).toBe('max_total');
      expect(useShareImportFlow.getState().limitContext?.contentId).toBe(null);
    });
  });
```

### Step 2: Run test to verify it fails

Run:
```bash
pnpm vitest run src/store/__tests__/useShareImportFlow.test.ts
```
Expected: 4 件 FAIL with "Property 'setRedFlag' does not exist" 等

### Step 3: Implement state extension

`src/store/useShareImportFlow.ts` の以下を更新:

State interface に追加 (既存 errorMessage の下):
```typescript
  errorMessage: string | null;

  /** 上限ヒット時に赤くマークするカード planId 集合 (#4) */
  redFlaggedPlanIds: Set<string>;
```

Actions interface に追加:
```typescript
  setStatus: (s: ShareImportStatus) => void;
  setLimitContext: (ctx: LimitContext | null) => void;
  /** カードを赤背景にマーク (上限ヒット視覚化、 #4) */
  setRedFlag: (planId: string) => void;
  /** 赤背景マークを外す (上限解消後、 #4) */
  clearRedFlag: (planId: string) => void;
  close: () => void;
```

create 内の初期 state に追加:
```typescript
  redFlaggedPlanIds: new Set(),
```

create 内の actions に追加:
```typescript
  setRedFlag: (planId) => {
    const next = new Set(get().redFlaggedPlanIds);
    next.add(planId);
    set({ redFlaggedPlanIds: next });
  },

  clearRedFlag: (planId) => {
    const next = new Set(get().redFlaggedPlanIds);
    next.delete(planId);
    set({ redFlaggedPlanIds: next });
  },
```

`close()` 内の reset block に追加:
```typescript
    set({
      status: 'idle',
      shareId: null,
      sharedData: null,
      importItems: [],
      selectedItemIds: new Set(),
      progressMap: new Map(),
      deleteProgressMap: new Map(),
      limitContext: null,
      errorMessage: null,
      redFlaggedPlanIds: new Set(),  // ← 追加
    });
```

### Step 4: Verify all useShareImportFlow tests pass

Run:
```bash
pnpm vitest run src/store/__tests__/useShareImportFlow.test.ts
```
Expected: 既存 + 新規 4 全 PASS

### Step 5: Commit

```bash
git add src/store/useShareImportFlow.ts src/store/__tests__/useShareImportFlow.test.ts
git commit -m "$(cat <<'EOF'
feat(useShareImportFlow): redFlaggedPlanIds state + setRedFlag/clearRedFlag actions

#4 上限ヒット時に該当カードを赤背景に切り替えるための state。
close() リセット時に空 Set に戻す。 setLimitContext は LimitContext 型
集約 (Task 1) の reason: 'max_total' を素通しできることを test で確認。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: executeShareImport 総上限事前判定 + 赤背景シーケンス

**Files:**
- Modify: `src/lib/executeShareImport.ts`
- Modify: `src/lib/__tests__/executeShareImport.test.ts`

### Step 1: Write failing tests (追加 + 既存更新)

新シグネチャ (onLimitHit に reason / contentId nullable / planId nullable を含むパラメータ) で test を書く。 既存 test の onLimitHit シグネチャは旧仕様 (`{ contentId: string, neededCount, planId: string }`) なので、 まずパラメータ型を新仕様に揃える更新が必要。

`src/lib/__tests__/executeShareImport.test.ts` の既存 onLimitHit mock シグネチャ箇所をすべて以下に揃える:

```typescript
const mockOnLimitHit = vi.fn<
  [{ reason: 'max_per_content' | 'max_total'; contentId: string | null; neededCount: number; planId: string | null }],
  Promise<'resolved' | 'cancelled'>
>();
```

末尾に新規 describe を追加:

```typescript
  describe('総上限 (max_total) 事前判定 (#7)', () => {
    beforeEach(() => {
      // 注: 既存テストの mock setup を踏襲。 PLAN_LIMITS.MAX_TOTAL_PLANS = 50。
      usePlanStore.setState({ plans: Array.from({ length: 49 }, (_, i) => ({
        id: `existing-${i}`,
        title: `existing-${i}`,
        contentId: 'm10s',
        ownerId: 'local',
        data: {} as any,
        updatedAt: i,
      })) } as any);
    });

    it('existing 49 + import 2 = 51 > 50 のとき max_total reason で onLimitHit が呼ばれる', async () => {
      mockOnLimitHit.mockResolvedValue('resolved');
      // resolved 後に plans を縮める (LimitResolutionSheet で削除されたとみなす)
      mockOnLimitHit.mockImplementationOnce(async () => {
        usePlanStore.setState({ plans: Array.from({ length: 48 }, (_, i) => ({
          id: `existing-${i}`,
          title: `existing-${i}`,
          contentId: 'm10s',
          ownerId: 'local',
          data: {} as any,
          updatedAt: i,
        })) } as any);
        return 'resolved';
      });
      const items = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm11s', title: 't1', planData: {} as any },
        { sourceShareId: 's2', sourcePlanId: 's2', contentId: 'm11s', title: 't2', planData: {} as any },
      ];
      await executeShareImport(items, null, '', vi.fn(), mockOnLimitHit);
      // 最初の呼び出しが max_total
      expect(mockOnLimitHit).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'max_total', contentId: null, planId: null, neededCount: 1 }),
      );
    });

    it('総上限事前判定で cancelled なら何も import されない', async () => {
      mockOnLimitHit.mockResolvedValue('cancelled');
      const onProgress = vi.fn();
      const items = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm11s', title: 't1', planData: {} as any },
        { sourceShareId: 's2', sourcePlanId: 's2', contentId: 'm11s', title: 't2', planData: {} as any },
      ];
      const results = await executeShareImport(items, null, '', onProgress, mockOnLimitHit);
      expect(results.every(r => r.status === 'cancelled')).toBe(true);
      expect(onProgress).not.toHaveBeenCalledWith(expect.objectContaining({ stage: 'local' }));
    });

    it('existing 49 + import 1 = 50 (== 上限) のときは事前判定を発火しない', async () => {
      const items = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm11s', title: 't1', planData: {} as any },
      ];
      await executeShareImport(items, null, '', vi.fn(), mockOnLimitHit);
      const totalCalls = mockOnLimitHit.mock.calls.filter(
        ([params]) => params.reason === 'max_total',
      );
      expect(totalCalls.length).toBe(0);
    });
  });

  describe('per_content 上限ヒット時の赤背景シーケンス (#4)', () => {
    it('per_content limit hit 時、 onLimitHit が reason="max_per_content" + planId 付きで呼ばれる', async () => {
      // contentId='m10s' に既に 5 件 (上限) ある状態
      usePlanStore.setState({
        plans: Array.from({ length: 5 }, (_, i) => ({
          id: `m10s-${i}`,
          title: `m10s-${i}`,
          contentId: 'm10s',
          ownerId: 'local',
          data: {} as any,
          updatedAt: i,
        })),
      } as any);
      mockOnLimitHit.mockImplementation(async () => {
        // resolved の後、 m10s から 1 件削除して上限を解消
        usePlanStore.setState({
          plans: Array.from({ length: 4 }, (_, i) => ({
            id: `m10s-${i}`,
            title: `m10s-${i}`,
            contentId: 'm10s',
            ownerId: 'local',
            data: {} as any,
            updatedAt: i,
          })),
        } as any);
        return 'resolved';
      });
      const items = [
        { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm10s', title: 't1', planData: {} as any },
      ];
      await executeShareImport(items, null, '', vi.fn(), mockOnLimitHit);
      expect(mockOnLimitHit).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'max_per_content', contentId: 'm10s', planId: 's1' }),
      );
    });
  });
```

### Step 2: Run test to verify it fails

Run:
```bash
pnpm vitest run src/lib/__tests__/executeShareImport.test.ts
```
Expected: 新規 4 件 FAIL (シグネチャ不一致 + 事前判定未実装)

### Step 3: Update onLimitHit シグネチャ + 事前判定実装

`src/lib/executeShareImport.ts` 全文を以下に置換:

```typescript
import { usePlanStore } from '../store/usePlanStore';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { checkPlanLimit } from '../utils/planLimitChecker';
import { buildNewPlan } from './buildShareImportItems';
import { PLAN_LIMITS } from '../types/firebase';
import type {
  ShareImportItem,
  ProgressEvent,
  ImportResult,
  LimitReason,
} from './shareImportTypes';

const MIN_DELAY_CHECK_MS = 400;
const MIN_DELAY_LOCAL_MS = 600;
const MIN_DELAY_SERVER_MS = 800;
/** 上限ヒット時、 該当カードを赤背景に切り替えてから重ねシートを開くまでの待機 (#4) */
const LIMIT_HIT_REVEAL_DELAY_MS = 800;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface OnLimitHitParams {
  reason: LimitReason;
  contentId: string | null;
  neededCount: number;
  planId: string | null;
}

export async function executeShareImport(
  plansToImport: ShareImportItem[],
  uid: string | null,
  displayName: string,
  onProgress: (event: ProgressEvent) => void,
  onLimitHit: (params: OnLimitHitParams) => Promise<'resolved' | 'cancelled'>,
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  // 1. 総上限事前判定 (#7)
  // existing + import > MAX_TOTAL なら、 1 件ずつヒットさせず最初に 1 度まとめて重ねシートを出す。
  const existingCount = usePlanStore.getState().plans.length;
  const importCount = plansToImport.length;
  if (existingCount + importCount > PLAN_LIMITS.MAX_TOTAL_PLANS) {
    const neededCount = (existingCount + importCount) - PLAN_LIMITS.MAX_TOTAL_PLANS;
    const decision = await onLimitHit({
      reason: 'max_total',
      contentId: null,
      neededCount,
      planId: null,
    });
    if (decision === 'cancelled') {
      // すべて cancelled として返す (個別 stage progress は出さない)
      return plansToImport.map(item => ({
        itemPlanId: item.sourcePlanId ?? item.sourceShareId,
        status: 'cancelled' as const,
      }));
    }
    // resolved → 削除済み state で per_content ループへ進む。
    // 再度総上限が超過していたら次の per_content check で発火するので無限ループにはならない。
  }

  // 2. per_content ループ (既存ロジック + 赤背景シーケンス追加)
  for (const item of plansToImport) {
    const itemPlanId = item.sourcePlanId ?? item.sourceShareId;

    // 2.1 上限チェック
    onProgress({ planId: itemPlanId, stage: 'check', status: 'in_progress' });
    await delay(MIN_DELAY_CHECK_MS);

    let limitResult = checkPlanLimit(usePlanStore.getState().plans, item.contentId);
    if (limitResult.exceeded) {
      // #4: 赤背景に切り替え → 800ms wait → 重ねシート起動の連続演出
      useShareImportFlow.getState().setRedFlag(itemPlanId);
      await delay(LIMIT_HIT_REVEAL_DELAY_MS);

      const decision = await onLimitHit({
        reason: 'max_per_content',
        contentId: item.contentId ?? null,
        neededCount: 1,
        planId: itemPlanId,
      });

      // 解消 / キャンセル いずれの場合も赤フラグは外す (見た目を元に戻す)
      useShareImportFlow.getState().clearRedFlag(itemPlanId);

      if (decision === 'cancelled') {
        onProgress({ planId: itemPlanId, stage: 'check', status: 'cancelled' });
        results.push({ itemPlanId, status: 'cancelled' });
        continue;
      }
      // 'resolved' → 再度上限チェック (最新 plans state で)
      limitResult = checkPlanLimit(usePlanStore.getState().plans, item.contentId);
      if (limitResult.exceeded) {
        onProgress({ planId: itemPlanId, stage: 'check', status: 'failed', error: 'still_exceeded' });
        results.push({ itemPlanId, status: 'failed', error: 'still_exceeded' });
        continue;
      }
    }
    onProgress({ planId: itemPlanId, stage: 'check', status: 'success' });

    // 2.2 端末保存
    onProgress({ planId: itemPlanId, stage: 'local', status: 'in_progress' });
    let newPlan;
    try {
      newPlan = buildNewPlan(item);
      usePlanStore.getState().addPlan(newPlan);
      await delay(MIN_DELAY_LOCAL_MS);
      onProgress({ planId: itemPlanId, stage: 'local', status: 'success' });
    } catch (err) {
      await delay(200);
      onProgress({ planId: itemPlanId, stage: 'local', status: 'failed', error: String(err) });
      results.push({ itemPlanId, status: 'failed', error: String(err) });
      continue;
    }

    // 2.3 サーバー保存
    if (uid) {
      onProgress({ planId: itemPlanId, stage: 'server', status: 'in_progress' });
      try {
        await usePlanStore.getState().syncToFirestore(uid, displayName, true, [newPlan.id]);
        await delay(MIN_DELAY_SERVER_MS);
        onProgress({ planId: itemPlanId, stage: 'server', status: 'success' });
      } catch (err) {
        await delay(400);
        onProgress({ planId: itemPlanId, stage: 'server', status: 'failed', error: String(err) });
      }
    } else {
      onProgress({ planId: itemPlanId, stage: 'server', status: 'skipped' });
    }

    results.push({ itemPlanId, newPlanId: newPlan.id, status: 'success' });
  }

  return results;
}
```

### Step 4: Run test to verify all pass

Run:
```bash
pnpm vitest run src/lib/__tests__/executeShareImport.test.ts
```
Expected: 既存 + 新規 4 全 PASS

### Step 5: Commit

```bash
git add src/lib/executeShareImport.ts src/lib/__tests__/executeShareImport.test.ts
git commit -m "$(cat <<'EOF'
feat(executeShareImport): 総上限事前判定 + per_content 赤背景シーケンス

#7: existing + import > 50 のとき冒頭で max_total モードの onLimitHit を
1 度だけ発火、 cancelled なら全件 cancelled で early return。

#4: per_content limit hit 時、 useShareImportFlow.setRedFlag → 800ms 待機
 → onLimitHit (reason: 'max_per_content') → clearRedFlag のシーケンスを
新設、 ユーザーが「どのカードが原因」 を視認する間を確保。

OnLimitHitParams 型を export、 contentId/planId を nullable 化、 reason
フィールドを追加。 既存呼び出し元 (ShareImportSheet) は次タスクで合わせる。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: LimitResolutionSheet polish (レイアウト統一 / max_total / sweep 赤 / カード退場)

**Files:**
- Modify: `src/components/LimitResolutionSheet.tsx`
- Modify: `src/components/__tests__/LimitResolutionSheet.test.tsx`

### Step 1: Write failing tests (追加 + 既存更新)

`src/components/__tests__/LimitResolutionSheet.test.tsx` の末尾の `describe(...)` 内に追加:

```typescript
    it('reason="max_total" のときリストは全コンテンツ横断で表示される', () => {
        useShareImportFlow.setState({
            limitContext: {
                reason: 'max_total',
                contentId: null,
                neededCount: 1,
                planId: null,
                resolve: () => {},
            },
        });
        usePlanStore.setState({
            plans: [
                { id: 'p1', title: 't1', contentId: 'm10s', ownerId: 'local', data: {} as any, updatedAt: 1 },
                { id: 'p2', title: 't2', contentId: 'm11s', ownerId: 'local', data: {} as any, updatedAt: 2 },
                { id: 'p3', title: 't3', contentId: 'm12s', ownerId: 'local', data: {} as any, updatedAt: 3 },
            ],
        } as any);
        render(<LimitResolutionSheet />);
        expect(screen.getByText('t1')).toBeInTheDocument();
        expect(screen.getByText('t2')).toBeInTheDocument();
        expect(screen.getByText('t3')).toBeInTheDocument();
    });

    it('reason="max_per_content" のときリストは contentId 一致のみ', () => {
        useShareImportFlow.setState({
            limitContext: {
                reason: 'max_per_content',
                contentId: 'm10s',
                neededCount: 1,
                planId: 'in1',
                resolve: () => {},
            },
        });
        usePlanStore.setState({
            plans: [
                { id: 'p1', title: 't1', contentId: 'm10s', ownerId: 'local', data: {} as any, updatedAt: 1 },
                { id: 'p2', title: 't2', contentId: 'm11s', ownerId: 'local', data: {} as any, updatedAt: 2 },
            ],
        } as any);
        render(<LimitResolutionSheet />);
        expect(screen.getByText('t1')).toBeInTheDocument();
        expect(screen.queryByText('t2')).toBeNull();
    });

    it('preview パネルは mobile でも描画される (hidden md:block 撤去確認)', () => {
        useShareImportFlow.setState({
            limitContext: {
                reason: 'max_per_content',
                contentId: 'm10s',
                neededCount: 1,
                planId: 'in1',
                resolve: () => {},
            },
        });
        usePlanStore.setState({
            plans: [
                { id: 'p1', title: 't1', contentId: 'm10s', ownerId: 'local', data: {} as any, updatedAt: 1 },
            ],
        } as any);
        render(<LimitResolutionSheet />);
        // preview スタブが必ず出る (hidden 修飾子が無いことを確認)
        expect(screen.getByTestId('preview')).toBeInTheDocument();
    });
```

### Step 2: Run test to verify it fails

Run:
```bash
pnpm vitest run src/components/__tests__/LimitResolutionSheet.test.tsx
```
Expected: 新規 3 件 FAIL (max_total 分岐未実装 / hidden md:block 残存)

### Step 3: Implement (LimitResolutionSheet 全体置換)

`src/components/LimitResolutionSheet.tsx` 全文を以下に置換:

```typescript
// 共有取り込みで「コンテンツあたり / 全体上限」 に達したときに重ねて開く
// ボトムシート。 ShareImportSheet (z=99991) の上に重ねるため z=99993。
//
// 仕様変更点 (Phase B-1.5 polish #4 #5 #7):
// - reason: 'max_per_content' | 'max_total' で表示モードを分岐
// - レイアウトを ShareImportSheet と同一 (左狭リスト + 右広 preview)、
//   mobile も preview 表示 (hidden md:block 撤去)
// - 削除進捗の 3 段テキストを廃止 → SweepOverlay (red) + ✓ ドロップイン + カード退場
// - spring 値を MitigationSheet と統一 (stiffness: 300, damping: 28)
// - motion.div に layout prop で内容拡張時の高さアニメ滑らか化
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { usePlanStore } from '../store/usePlanStore';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { SharePlanCard } from './SharePlanCard';
import { executePlanDeletions } from '../lib/executePlanDeletions';
import { PLAN_LIMITS } from '../types/firebase';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import type { DeleteProgressEvent } from '../lib/shareImportTypes';
import type { SavedPlan } from '../types';

const DELETE_STAGES: DeleteProgressEvent['stage'][] = [
    'local_delete',
    'server_delete',
    'capacity_freed',
];

function resolveSweepStatus(
    events: DeleteProgressEvent[],
    isDeleting: boolean,
): { sweepStatus: 'idle' | 'active' | 'success' | 'failed'; isExiting: boolean } {
    // 一覧 stage の最終状態から sweep status を決める。
    // - 削除開始前: idle
    // - 削除中で capacity_freed 未到達: active (sweep 走行)
    // - capacity_freed success: success → カード退場開始
    // - いずれかが failed: failed (赤 sweep 100% 維持、 退場しない)
    if (events.length === 0) return { sweepStatus: isDeleting ? 'active' : 'idle', isExiting: false };
    const failed = events.find(e => e.status === 'failed');
    if (failed) return { sweepStatus: 'failed', isExiting: false };
    const capacityFreed = events.find(e => e.stage === 'capacity_freed' && e.status === 'success');
    if (capacityFreed) return { sweepStatus: 'success', isExiting: true };
    return { sweepStatus: 'active', isExiting: false };
}

export function LimitResolutionSheet() {
    const { t, i18n } = useTranslation();
    const limitContext = useShareImportFlow(s => s.limitContext);
    const deleteProgressMap = useShareImportFlow(s => s.deleteProgressMap);
    const setDeleteProgress = useShareImportFlow(s => s.setDeleteProgress);
    const setLimitContext = useShareImportFlow(s => s.setLimitContext);
    const plans = usePlanStore(s => s.plans);
    const authUser = useAuthStore(s => s.user);

    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // reason に応じてリストを切り替え (#7)
    const targetPlans = useMemo<SavedPlan[]>(() => {
        if (!limitContext) return [];
        const all = plans.slice().sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
        if (limitContext.reason === 'max_total') return all;
        return all.filter(p => p.contentId === limitContext.contentId);
    }, [plans, limitContext]);

    if (!limitContext) return null;

    const activePlan: SavedPlan | undefined =
        targetPlans.find(p => p.id === activeId) ?? targetPlans[0];

    // contentId をユーザーフレンドリーなコンテンツ名に解決 (per_content モード時のヘッダ用)。
    const langSrc = i18n?.language ?? 'en';
    const lang = langSrc.startsWith('ja')
        ? 'ja'
        : langSrc.startsWith('zh')
            ? 'zh'
            : langSrc.startsWith('ko')
                ? 'ko'
                : 'en';
    const contentName = limitContext.contentId
        ? (getContentById(limitContext.contentId)?.name?.[lang]
            ?? getContentById(limitContext.contentId)?.name?.en
            ?? limitContext.contentId)
        : '';

    const maxPerContent = PLAN_LIMITS.MAX_PLANS_PER_CONTENT;
    const maxTotal = PLAN_LIMITS.MAX_TOTAL_PLANS;

    // ヘッダーのタイトル: reason に応じて分岐
    const titleText = limitContext.reason === 'max_total'
        ? t('limit_resolution.title_total', {
              current: targetPlans.length,
              max: maxTotal,
          })
        : t('limit_resolution.title_per_content', {
              contentName,
              current: targetPlans.length,
              max: maxPerContent,
          });

    const handleToggleCheck = (id: string) => {
        if (isDeleting) return;
        const next = new Set(checkedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setCheckedIds(next);
    };

    const handleCancel = () => {
        if (isDeleting) return;
        limitContext.resolve('cancelled');
        setLimitContext(null);
    };

    const handleDelete = async () => {
        if (checkedIds.size === 0 || isDeleting) return;
        setIsDeleting(true);
        try {
            await executePlanDeletions(
                Array.from(checkedIds),
                authUser?.uid ?? null,
                limitContext.contentId ?? '',
                setDeleteProgress,
            );
            limitContext.resolve('resolved');
            setLimitContext(null);
        } catch {
            const currentPlanIds = new Set(usePlanStore.getState().plans.map(p => p.id));
            setCheckedIds(prev => {
                const next = new Set<string>();
                prev.forEach(id => {
                    if (currentPlanIds.has(id)) next.add(id);
                });
                return next;
            });
            setIsDeleting(false);
        }
    };

    const checkedCount = checkedIds.size;

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="limit-resolution-backdrop"
                className="fixed inset-0 z-[99992] bg-black/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCancel}
            />
            <motion.div
                key="limit-resolution-sheet"
                data-testid="limit-resolution-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby="limit-resolution-title"
                className="glass-tier3 fixed bottom-0 left-0 right-0 z-[99993] rounded-t-2xl rounded-b-none flex flex-col max-h-[90vh] border-t border-app-red/30"
                layout
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 28,
                    layout: { type: 'spring', stiffness: 300, damping: 28 },
                }}
            >
                {/* Header */}
                <div className="px-5 pt-5 pb-3 shrink-0 border-b border-app-border">
                    <h2
                        id="limit-resolution-title"
                        className="text-app-2xl font-black text-app-text tracking-wide"
                    >
                        {titleText}
                    </h2>
                    <p className="text-app-md text-app-text-muted mt-1">
                        {t('limit_resolution.body', { count: limitContext.neededCount })}
                    </p>
                </div>

                {/* Body: ShareImportSheet と同一レイアウト (左狭リスト + 右広 preview)。
                    mobile (hidden md:block) を撤去、 全環境で flex-row。 */}
                <div className="flex-1 overflow-hidden flex flex-row min-h-0">
                    {/* リスト */}
                    <div className="flex-shrink-0 w-[140px] md:w-[200px] border-r border-app-border p-2 overflow-y-auto bg-app-surface2/30 flex flex-col gap-2">
                        <LayoutGroup>
                            <AnimatePresence>
                                {targetPlans.map(plan => {
                                    const checked = checkedIds.has(plan.id);
                                    const events: DeleteProgressEvent[] = DELETE_STAGES
                                        .map(stage => deleteProgressMap.get(`${plan.id}:${stage}`))
                                        .filter((e): e is DeleteProgressEvent => !!e)
                                        .filter(e => checkedIds.has(plan.id));  // チェック対象だけ進捗を反映
                                    const { sweepStatus, isExiting } = resolveSweepStatus(events, isDeleting && checked);
                                    const contentDef = plan.contentId ? getContentById(plan.contentId) : null;
                                    const contentLabel = contentDef
                                        ? getPhaseName(contentDef.name, i18n.language)
                                        : '';
                                    return (
                                        <SharePlanCard
                                            key={plan.id}
                                            title={contentLabel || plan.title}
                                            subtitle={contentLabel ? plan.title : undefined}
                                            isActive={activePlan?.id === plan.id}
                                            showCheckbox={true}
                                            isChecked={checked}
                                            onToggleCheck={() => handleToggleCheck(plan.id)}
                                            onClickRow={() => setActiveId(plan.id)}
                                            sweepStatus={isDeleting && checked ? sweepStatus : undefined}
                                            sweepColor="red"
                                            isExiting={isExiting}
                                        />
                                    );
                                })}
                            </AnimatePresence>
                        </LayoutGroup>
                    </div>

                    {/* プレビュー (mobile も表示) */}
                    <div className="flex-1 min-w-0 overflow-y-auto border-l border-app-border bg-app-surface2/30">
                        <MitigationSheetPreview
                            planData={activePlan?.data ?? null}
                            loading={false}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 shrink-0 border-t border-app-border flex items-center justify-between gap-3 bg-app-surface/40">
                    <span className="text-app-sm text-app-text-muted">
                        {t('limit_resolution.selection_count', { count: checkedCount })}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isDeleting}
                            aria-label={t('limit_resolution.button_cancel')}
                            className="px-4 py-1.5 rounded-md text-app-text border border-app-border hover:bg-app-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {t('limit_resolution.button_cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={checkedCount === 0 || isDeleting}
                            aria-label={
                                checkedCount === 0
                                    ? t('limit_resolution.button_delete_and_resume_disabled')
                                    : t('limit_resolution.button_delete_and_resume', { count: checkedCount })
                            }
                            className="px-4 py-1.5 rounded-md font-semibold text-white bg-app-red hover:bg-app-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {checkedCount === 0
                                ? t('limit_resolution.button_delete_and_resume_disabled')
                                : t('limit_resolution.button_delete_and_resume', { count: checkedCount })}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body,
    );
}
```

### Step 4: Run all LimitResolutionSheet tests

Run:
```bash
pnpm vitest run src/components/__tests__/LimitResolutionSheet.test.tsx
```
Expected: 既存テスト + 新規 3 全 PASS

### Step 5: Commit

```bash
git add src/components/LimitResolutionSheet.tsx src/components/__tests__/LimitResolutionSheet.test.tsx
git commit -m "$(cat <<'EOF'
feat(LimitResolutionSheet): レイアウト統一 / max_total / sweep 赤 / カード退場

#4: hidden md:block 撤去、 mobile でも preview 表示。 リスト幅
140px md:200px で ShareImportSheet と統一。
#5: 3 段テキスト (delete_progress_*) を SweepOverlay (red) に置き換え、
削除完了で SharePlanCard isExiting によるフェードアウト退場、 LayoutGroup
で他カードの詰めを framer-motion 自動化。
#7: reason='max_total' で targetPlans を全コンテンツ横断に分岐。
#6: spring 値を stiffness: 300 / damping: 28 に統一、 layout prop 追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: ShareImportSheet polish (レイアウト統一 / キャンセル / layout prop / spring)

**Files:**
- Modify: `src/components/ShareImportSheet.tsx`
- Modify: `src/components/__tests__/ShareImportSheet.test.tsx`

### Step 1: Write failing tests (追加 + 既存更新)

`I18N_TEMPLATES` にキャンセルキーを追加 (既存 mock 上部):
```typescript
    'share_import.button_cancel': 'share_import.button_cancel',
```

`src/components/__tests__/ShareImportSheet.test.tsx` の末尾の `describe(...)` 内に追加:

```typescript
    it('単一プランのときも左カラム (リスト) が描画される', () => {
        useShareImportFlow.setState({
            status: 'preview',
            importItems: [
                {
                    sourceShareId: 's1',
                    sourcePlanId: 's1',
                    contentId: 'm10s',
                    title: 'プランA',
                    planData: {} as any,
                },
            ],
            selectedItemIds: new Set(['s1']),
        });
        render(<ShareImportSheet />);
        // 左カラムにカード 1 件 + プレビューが両方描画される
        expect(screen.getAllByTestId('share-plan-card').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByTestId('preview')).toBeInTheDocument();
    });

    it('preview 状態のときキャンセルボタンが描画され enabled', () => {
        useShareImportFlow.setState({
            status: 'preview',
            importItems: [
                { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm10s', title: 't1', planData: {} as any },
            ],
            selectedItemIds: new Set(['s1']),
        });
        render(<ShareImportSheet />);
        const cancel = screen.getByLabelText('share_import.button_cancel');
        expect(cancel).toBeInTheDocument();
        expect(cancel).not.toBeDisabled();
    });

    it('importing 状態のときキャンセルボタンは disabled', () => {
        useShareImportFlow.setState({
            status: 'importing',
            importItems: [
                { sourceShareId: 's1', sourcePlanId: 's1', contentId: 'm10s', title: 't1', planData: {} as any },
            ],
            selectedItemIds: new Set(['s1']),
        });
        render(<ShareImportSheet />);
        const cancel = screen.getByLabelText('share_import.button_cancel');
        expect(cancel).toBeDisabled();
    });
```

### Step 2: Run test to verify it fails

Run:
```bash
pnpm vitest run src/components/__tests__/ShareImportSheet.test.tsx
```
Expected: 新規 3 件 FAIL (左カラム未描画 / cancel button 未存在)

### Step 3: Implement ShareImportSheet 改修

`src/components/ShareImportSheet.tsx` 全文を以下に置換:

```typescript
// 共有 URL を踏んだときに開くメインのボトムシート (Phase B-1.5 polish 後)。
// レイアウト: 単一 / バンドル / loading 全環境共通 「左狭リスト + 右広 preview」。
// アニメ: spring stiffness: 300 / damping: 28 + layout prop で内容拡張時の高さ滑らかアニメ。
//
// status === 'idle' のときは中身 (backdrop + sheet) を描画しないが、 ポータル/AnimatePresence は
// 残したまま children を null にする。 これにより exit アニメーション (slide-down) が正しく走る。
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useShareImportFlow } from '../store/useShareImportFlow';
import { useAuthStore } from '../store/useAuthStore';
import { MitigationSheetPreview } from './MitigationSheetPreview';
import { SharePlanCard } from './SharePlanCard';
import { executeShareImport } from '../lib/executeShareImport';
import { LimitResolutionSheet } from './LimitResolutionSheet';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import type { ProgressEvent } from '../lib/shareImportTypes';

const CLOSE_DELAY_AFTER_DONE_MS = 1200;

export function ShareImportSheet() {
    const { t, i18n } = useTranslation();
    const status = useShareImportFlow((s) => s.status);
    const importItems = useShareImportFlow((s) => s.importItems);
    const selectedItemIds = useShareImportFlow((s) => s.selectedItemIds);
    const progressMap = useShareImportFlow((s) => s.progressMap);
    const errorMessage = useShareImportFlow((s) => s.errorMessage);
    const redFlaggedPlanIds = useShareImportFlow((s) => s.redFlaggedPlanIds);
    const toggleSelect = useShareImportFlow((s) => s.toggleSelect);
    const setStatus = useShareImportFlow((s) => s.setStatus);
    const setProgress = useShareImportFlow((s) => s.setProgress);
    const setLimitContext = useShareImportFlow((s) => s.setLimitContext);
    const close = useShareImportFlow((s) => s.close);

    const authUser = useAuthStore((s) => s.user);

    const [activeItemId, setActiveItemId] = useState<string | null>(null);

    useEffect(() => {
        if (importItems.length === 0) return;
        const ids = new Set(
            importItems.map((i) => i.sourcePlanId ?? i.sourceShareId),
        );
        if (!activeItemId || !ids.has(activeItemId)) {
            const firstId =
                importItems[0].sourcePlanId ?? importItems[0].sourceShareId;
            setActiveItemId(firstId);
        }
    }, [importItems, activeItemId]);

    useEffect(() => {
        if (status !== 'done') return;
        const id = setTimeout(() => close(), CLOSE_DELAY_AFTER_DONE_MS);
        return () => clearTimeout(id);
    }, [status, close]);

    const isBundle = importItems.length > 1;
    const selectedCount = selectedItemIds.size;
    const activeItem =
        importItems.find(
            (i) => (i.sourcePlanId ?? i.sourceShareId) === activeItemId,
        ) ?? importItems[0];

    const handleBackdropClick = () => {
        if (status === 'importing' || status === 'limit_hit') return;
        close();
    };

    const handleImport = async () => {
        const itemsToImport = importItems.filter((i) =>
            selectedItemIds.has(i.sourcePlanId ?? i.sourceShareId),
        );
        setStatus('importing');
        await executeShareImport(
            itemsToImport,
            authUser?.uid ?? null,
            authUser?.displayName ?? '',
            setProgress,
            (params) =>
                new Promise((resolve) =>
                    setLimitContext({ ...params, resolve }),
                ),
        );
        setStatus('done');
    };

    /** ProgressEvent[] → sweep status の解決ロジック (取り込み 3 stage を 1 本の sweep に集約) */
    const resolveItemSweepStatus = (
        events: ProgressEvent[],
    ): 'idle' | 'active' | 'success' | 'failed' => {
        if (events.length === 0) return 'idle';
        const failed = events.find(e => e.status === 'failed');
        if (failed) return 'failed';
        const serverDone = events.find(e => e.stage === 'server' && (e.status === 'success' || e.status === 'skipped'));
        if (serverDone) return 'success';
        return 'active';
    };

    return createPortal(
        <AnimatePresence>
            {status !== 'idle' && (
                <Fragment key="share-import-sheet-fragment">
                    <motion.div
                        key="share-import-backdrop"
                        className="fixed inset-0 z-[99990] bg-black/60"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleBackdropClick}
                    />
                    <motion.div
                        key="share-import-sheet"
                        data-testid="share-import-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-import-title"
                        className="glass-tier3 fixed bottom-0 left-0 right-0 z-[99991] rounded-t-2xl rounded-b-none flex flex-col max-h-[90vh] border-t border-app-border"
                        layout
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 28,
                            layout: { type: 'spring', stiffness: 300, damping: 28 },
                        }}
                    >
                        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-app-border">
                            <h2
                                id="share-import-title"
                                className="text-app-2xl font-black text-app-text tracking-wide"
                            >
                                {isBundle
                                    ? t('share_import.title_bundle', { count: importItems.length })
                                    : t('share_import.title')}
                            </h2>
                        </div>

                        {status === 'loading' && (
                            <div className="p-8 text-center text-app-text-muted">
                                {t('share_import.loading')}
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="p-8 text-center text-app-red">
                                {errorMessage === 'not_found'
                                    ? t('share_import.not_found')
                                    : t('share_import.error')}
                            </div>
                        )}

                        {(status === 'preview' ||
                            status === 'importing' ||
                            status === 'limit_hit' ||
                            status === 'done') && (
                            <>
                                <div className="flex-1 overflow-hidden flex flex-row min-h-0">
                                    {/* Left list (#1: 単一でも常に描画) */}
                                    <div className="flex-shrink-0 w-[140px] md:w-[200px] border-r border-app-border p-2 overflow-y-auto bg-app-surface2/30 flex flex-col gap-2">
                                        <LayoutGroup>
                                            {importItems.map((item) => {
                                                const itemPlanId = item.sourcePlanId ?? item.sourceShareId;
                                                const isActive = activeItemId === itemPlanId;
                                                const itemEvents = Array.from(progressMap.values()).filter(
                                                    (e) => e.planId === itemPlanId,
                                                );
                                                const isChecked = selectedItemIds.has(itemPlanId);
                                                const isRedFlagged = redFlaggedPlanIds.has(itemPlanId);
                                                // #2: コンテンツ名を主タイトル、 プラン名を副タイトルに
                                                const contentDef = item.contentId
                                                    ? getContentById(item.contentId)
                                                    : null;
                                                const contentLabel = contentDef
                                                    ? getPhaseName(contentDef.name, i18n.language)
                                                    : '';
                                                // sweep は importing / done 時のみ表示
                                                const sweepStatus = (status === 'importing' || status === 'done')
                                                    ? resolveItemSweepStatus(itemEvents)
                                                    : undefined;
                                                return (
                                                    <SharePlanCard
                                                        key={itemPlanId}
                                                        title={contentLabel || item.title}
                                                        subtitle={contentLabel ? item.title : undefined}
                                                        isActive={isActive}
                                                        showCheckbox={status === 'preview'}
                                                        isChecked={isChecked}
                                                        onToggleCheck={() => toggleSelect(itemPlanId)}
                                                        onClickRow={() => setActiveItemId(itemPlanId)}
                                                        isRedFlagged={isRedFlagged}
                                                        sweepStatus={sweepStatus}
                                                        sweepColor="blue"
                                                    />
                                                );
                                            })}
                                        </LayoutGroup>
                                    </div>

                                    {/* Right preview */}
                                    <div className="flex-1 min-w-0 overflow-y-auto p-3">
                                        {activeItem && (
                                            <MitigationSheetPreview
                                                planData={activeItem.planData}
                                                loading={false}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Footer (キャンセルボタン追加) */}
                                <div className="px-5 py-3 shrink-0 border-t border-app-border flex items-center justify-between gap-3 bg-app-surface/40">
                                    {isBundle ? (
                                        <span className="text-app-sm text-app-text-muted">
                                            {t('limit_resolution.selection_count', { count: selectedCount })}
                                        </span>
                                    ) : (
                                        <span />
                                    )}
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={close}
                                            disabled={status !== 'preview'}
                                            aria-label={t('share_import.button_cancel')}
                                            className="px-4 py-2 rounded-md text-app-text border border-app-border hover:bg-app-surface2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {t('share_import.button_cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={selectedCount === 0 || status !== 'preview'}
                                            onClick={handleImport}
                                            aria-label={
                                                isBundle
                                                    ? t('share_import.button_import_count', { count: selectedCount })
                                                    : t('share_import.button_import_single')
                                            }
                                            className="px-5 py-2 rounded-md bg-app-blue text-white font-semibold uppercase hover:bg-app-blue-hover disabled:bg-app-text-muted/30 disabled:text-app-text-muted disabled:cursor-not-allowed active:scale-95 transition-all"
                                        >
                                            {isBundle
                                                ? t('share_import.button_import_count', { count: selectedCount })
                                                : t('share_import.button_import_single')}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                </Fragment>
            )}

            <LimitResolutionSheet />
        </AnimatePresence>,
        document.body,
    );
}
```

### Step 4: Run all ShareImportSheet tests

Run:
```bash
pnpm vitest run src/components/__tests__/ShareImportSheet.test.tsx
```
Expected: 既存テスト + 新規 3 全 PASS

### Step 5: Commit

```bash
git add src/components/ShareImportSheet.tsx src/components/__tests__/ShareImportSheet.test.tsx
git commit -m "$(cat <<'EOF'
feat(ShareImportSheet): レイアウト統一 / キャンセル / layout prop / spring 統一

#1: 単一プランでも左カラム描画 (常に flex-row)、 isBundle はフッター件数
表示にのみ残す。
#2: SharePlanCard に title=contentLabel, subtitle=planTitle で「コンテンツ名 +
プラン名」 2 行表示。
#3: ShareImportProgressIndicator 廃止、 sweep を 3 stage 集約
  (server stage success/skipped → success / 任意 stage failed → failed)。
#6: spring を stiffness 300 / damping 28 に統一、 motion.div に layout prop。
新規: キャンセルボタンを Footer に追加 (preview 中のみ enabled)。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: LocalImportDialog → SweepOverlay 移行

**Files:**
- Modify: `src/components/LocalImportDialog.tsx`

### Step 1: 既存 renderSweep を SweepOverlay に置換

`src/components/LocalImportDialog.tsx` で:

1. Import 行に追加 (上部 import 群):
   ```typescript
   import { SweepOverlay } from './SweepOverlay';
   ```

2. `renderSweep` 関数 (行 290 付近、 `const renderSweep = (status: PlanProgressStatus | undefined) => { ... }` 全体) を **削除**。

3. 利用箇所 (行 442 付近):
   ```diff
   - {isInProgress && !isOutOfImport && renderSweep(status)}
   + {isInProgress && !isOutOfImport && (
   +     <SweepOverlay
   +         status={
   +             status === 'pending' || !status
   +                 ? 'idle'
   +                 : status === 'uploading'
   +                     ? 'active'
   +                     : status  // 'success' | 'failed'
   +         }
   +         color="blue"
   +         durationMs={1200}
   +     />
   + )}
   ```

### Step 2: 既存テストが通ることを確認

Run:
```bash
pnpm vitest run src/components/__tests__/LocalImportDialog.test.tsx
```
Expected: 既存全 PASS (sweep の見え方は同じ、 内部実装が変わっただけ)

### Step 3: Commit

```bash
git add src/components/LocalImportDialog.tsx
git commit -m "$(cat <<'EOF'
refactor(LocalImportDialog): renderSweep を SweepOverlay コンポーネントに置換

LocalImportDialog 内部の sweep 描画ヘルパーを Task 2 で新設した
SweepOverlay コンポーネントに移行。 status マッピング (pending→idle /
uploading→active / success/failed そのまま) で互換性維持。 既存テスト
全 PASS。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: ShareImportProgressIndicator 削除

**Files:**
- Delete: `src/components/ShareImportProgressIndicator.tsx`
- Delete: `src/components/__tests__/ShareImportProgressIndicator.test.tsx`

### Step 1: ファイル削除

Run:
```bash
rm src/components/ShareImportProgressIndicator.tsx
rm src/components/__tests__/ShareImportProgressIndicator.test.tsx
```

### Step 2: 残存 import 参照の確認

`ShareImportProgressIndicator` の参照が残っていないか確認 (Grep ツール or rg):

```bash
rg ShareImportProgressIndicator src
```
Expected: ヒットなし (ShareImportSheet からの import は Task 7 で既に削除済み)

続けて型チェック:
```bash
pnpm tsc --noEmit
```
Expected: clean

### Step 3: 全テスト実行

Run:
```bash
pnpm vitest run --reporter=verbose 2>&1 | tail -10
```
Expected: 削除した 4 件分減って 549 PASS (元 553 件 - ShareImportProgressIndicator test 4 件)

### Step 4: Commit

```bash
git add -u src/components/ShareImportProgressIndicator.tsx src/components/__tests__/ShareImportProgressIndicator.test.tsx
git commit -m "$(cat <<'EOF'
refactor(ShareImportProgressIndicator): ファイル + テスト削除 (sweep に統合済)

Task 7 で ShareImportSheet が SweepOverlay 経由の sweep 演出に切り替わり、
3 段テキスト UI (✓ 上限OK / ✓ 端末保存 / ✓ サーバー保存) は不要になった。
コンポーネント本体 + 単体テスト 4 件をまとめて削除。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 最終検証 (vitest / tsc / build / 0 行 diff)

**Files:** (検証のみ、 修正がある場合に該当ファイルを変更)

### Step 1: 全 vitest

Run:
```bash
pnpm vitest run 2>&1 | tail -20
```
Expected: PASS (Task 9 で 4 件削除分を加味して、 既存 553 + 新規 (SweepOverlay 6 + SharePlanCard 4 + useShareImportFlow 4 + executeShareImport 4 + LimitResolutionSheet 3 + ShareImportSheet 3 = 24) - 削除 (4) = **573 件 PASS**)

### Step 2: tsc clean

Run:
```bash
pnpm tsc --noEmit 2>&1 | tail -5
```
Expected: clean (no errors)

### Step 3: build clean

Run:
```bash
pnpm run build 2>&1 | tail -20
```
Expected: build success, no errors

### Step 4: 触らない箇所 0 行 diff 検証

`spec §2.2` で挙げた以下のファイルが、 ベースブランチからの diff で **0 行** であることを確認:

```bash
git diff main -- \
    src/store/usePlanStore.ts \
    src/lib/planService.ts \
    src/utils/silentCompressStale.ts \
    src/utils/checkPlanLimit.ts \
    src/components/MitigationSheet.tsx \
    src/lib/buildShareImportItems.ts
```
Expected: 何も出力されない (= 0 行 diff)

注意: `LocalImportDialog.tsx` は Task 8 で renderSweep 削除のみ変更したため、 0 行 diff の対象から外す (= 想定通りの変更)。

### Step 5: docs/TODO.md 更新

`docs/TODO.md` 先頭の「最優先 2026-05-09 実機検証フィードバック」 セクションを完了報告に書き換える:

```diff
- - **【最優先 2026-05-09 実機検証フィードバック・Phase B-1.5 polish 8 点】**: ...
+ - **【完了 2026-05-09・Phase B-1.5 polish (#1-7 + キャンセルボタン)】**: 実機検証フィードバック 8 点中 7 点 + キャンセルボタンを 1 spec / 1 PR で完成。 #8 (PWA 既存タブ再利用) は技術調査の結果 Chrome の新タブ open 完全防止が不可と判明したためスコープ外 (drop)。 設計書 `docs/superpowers/specs/2026-05-09-share-import-polish-design.md`、 実装プラン `docs/superpowers/plans/2026-05-09-share-import-polish.md`。 全 vitest PASS / tsc clean / build clean / 触らない箇所 0 行 diff。 Vercel デプロイ待ち。
```

### Step 6: 最終コミット (TODO.md 更新)

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(todo): Phase B-1.5 polish 完了報告 + #8 drop 記録

#1-7 + キャンセルボタンを 1 PR で完成。 #8 (PWA 既存タブ再利用) は
Chrome の新タブ open 完全防止が技術的に不可と判明したためスコープ外。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Step 7: Push + Vercel デプロイ

```bash
git push origin main
```
ユーザーに「Vercel デプロイの確認お願い + 実機検証ポイント (下記) を試してほしい」と伝える。

### Step 8: 実機検証チェックリスト (ユーザーが Vercel デプロイ後に試す)

- [ ] **#1**: 単一 URL を踏むと左カラム + 1 件カード + preview が描画される (バンドル時と同じレイアウト)
- [ ] **#2**: 左カラムカードに「コンテンツ名」 + 「プラン名」 が 2 行で表示される
- [ ] **#3**: 取り込み中、 カード行に青 sweep が左→右で 1.2 秒充填される (テキスト 3 段が出ない)
- [ ] **#4**: 上限到達コンテンツの URL を踏むと、 該当カードが赤背景 → 800ms 後に重ねシート起動。 LimitResolutionSheet は mobile でも preview が見える
- [ ] **#5**: 削除確定でカードに赤 sweep → 完了でカードが滑らかにフェードアウト → 他カードが詰まる
- [ ] **#6**: シート起動時、 短い「読み込み中…」 シート → API 応答 → 高さがぐっと拡張 (spring) → preview 表示。 完了/キャンセルで一発引っ込み
- [ ] **#7**: 既存 49 件 + 2 件バンドルを踏むと、 1 件ずつヒットせず最初に LimitResolutionSheet が「全コンテンツ横断 + 総上限ヒット」 で開く
- [ ] **キャンセルボタン**: preview 中だけ enabled、 importing 中は disabled。 押すとシートが閉じる

---

## Self-Review (writing-plans skill 検査)

### Spec coverage

| spec 要件 | 実装タスク |
|---|---|
| §3.1 レイアウト統一 (#1, #4, #5) | Task 6 (LimitResolutionSheet), Task 7 (ShareImportSheet) |
| §3.2 SharePlanCard 情報拡充 (#2) | Task 3 (SharePlanCard 新 prop), Task 6/7 で title/subtitle 渡す |
| §3.3 SweepOverlay 共通化 (#3, #5) | Task 2 (SweepOverlay 新設), Task 8 (LocalImportDialog 移行), Task 9 (ShareImportProgressIndicator 削除) |
| §3.4 上限ヒット時の演出 (#4) | Task 4 (redFlag state), Task 5 (executeShareImport 800ms シーケンス) |
| §3.5 シート 2 段階アニメ (#6) | Task 6/7 (motion.div layout prop, transition.layout spring) |
| §3.6 総上限事前判定 (#7) | Task 5 (executeShareImport 冒頭判定), Task 6 (LimitResolutionSheet max_total 分岐) |
| §3.7 キャンセルボタン | Task 7 (ShareImportSheet Footer) |
| §4 i18n 削除/追加 | Task 1 |
| §5 型変更 | Task 1 (LimitContext), Task 4 (redFlaggedPlanIds) |
| §6 テスト方針 | Task 2/3/4/5/6/7 で TDD |
| §7 タイミング定数 | Task 2 (SWEEP_DURATION_MS), Task 5 (LIMIT_HIT_REVEAL_DELAY_MS), Task 6/7 (spring 値) |

ギャップ: なし。 全 spec 要件をタスクで網羅。

### Placeholder scan

- TBD / TODO / "implement later": 検出無し
- "appropriate" 等: 検出無し
- 各タスクで実コード提示済み

### Type consistency

- `LimitContext` の reason 型 (`LimitReason`): Task 1 で定義 → Task 4/5/6 で参照、 一致
- `OnLimitHitParams`: Task 5 で定義・export → ShareImportSheet (Task 7) は inline で同じ shape を使うので問題なし
- `redFlaggedPlanIds: Set<string>`: Task 4 定義 → Task 7 で参照、 一致
- `SweepOverlay` props (status / color / durationMs): Task 2 定義 → Task 3/6/7/8 で同じ enum を使用、 一致
- SharePlanCard 新 prop (`isRedFlagged`, `isExiting`, `sweepStatus`, `sweepColor`): Task 3 定義 → Task 6/7 で渡す、 一致

### 実装順序の検証

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 で依存関係矛盾なし:
- Task 1 (型) は他のすべてが参照
- Task 2 (SweepOverlay) は Task 3/6/7/8 が参照
- Task 3 (SharePlanCard) は Task 6/7 が参照
- Task 4 (redFlag state) は Task 5/7 が参照
- Task 5 (executeShareImport) は Task 7 (handleImport) で利用
- Task 8/9 は ShareImportSheet (Task 7) が SweepOverlay 経由になった後に整理可能

問題無し。

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-09-share-import-polish.md`.
