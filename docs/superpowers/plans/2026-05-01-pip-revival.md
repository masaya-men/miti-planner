# PiP（Floating Timeline）復活 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 過去に UI 非表示にしていた PiP カンペビューを復活させ、透過機能撤去・多選対応・全員フォールバック・背景カラーピッカーを追加する。

**Architecture:** 残存コードを最大限活かし、PipView.tsx 本体改修（多選 / 透過撤去 / カラーピッカー）+ UI 復活ポイント 2 箇所（Timeline.tsx の `false &&` 撤去 + MobileFAB.tsx のコメントアウト解除）で実現。フィルタロジックと初期選択ロジックは純粋関数として抽出し TDD で守る。

**Tech Stack:** React 19, TypeScript, Tailwind v4, Zustand, react-i18next, vitest, @testing-library/react, happy-dom

**設計書:** [docs/superpowers/specs/2026-05-01-pip-revival-design.md](../specs/2026-05-01-pip-revival-design.md)

---

## ファイル構造

| ファイル | 種類 | 責務 |
|----------|------|------|
| `src/utils/pipViewLogic.ts` | 新規 | フィルタ・初期選択の純粋関数（テスト容易性のため抽出） |
| `src/components/PipView.tsx` | 修正 | UI 本体（多選 / 透過撤去 / カラーピッカー / Popover） |
| `src/components/Timeline.tsx` | 修正 | PC 起動ボタン復活（1973 行付近） |
| `src/components/MobileFAB.tsx` | 修正 | モバイル FAB 項目復活 |
| `src/locales/{ja,en,ko,zh}.json` | 修正 | i18n キー追加 3 / 削除 2 |
| `src/__tests__/pipViewLogic.test.ts` | 新規 | 純粋関数のテスト |

PipView.tsx 自体の React コンポーネントテストは vitest + @testing-library/react で書けるが、Document Picture-in-Picture API のモック化が重く ROI が低い。ロジック層を純粋関数で抽出し、そちらを集中的にテストする方針。レンダリングテストは Task 9 で軽くスモークテストとして検討。

---

## Task 1: i18n キー追加・削除（4 言語）

**Files:**
- Modify: `src/locales/ja.json:364-370`
- Modify: `src/locales/en.json:360-365`
- Modify: `src/locales/ko.json:343-348`
- Modify: `src/locales/zh.json:343-348`

- [ ] **Step 1.1: ja.json 編集**

`src/locales/ja.json` の `pip_open_disabled` と `pip_opacity` を削除し、新キー 3 つを追加。

```diff
         "pip_open": "カンペを開く",
-        "pip_open_disabled": "自分のジョブを設定すると使えます",
         "pip_close": "閉じる",
-        "pip_opacity": "透過率",
         "pip_switch_job": "ジョブを切り替え",
         "pip_no_mitigations": "軽減が配置されていません",
         "pip_edit_hint": "ダブルタップで名前を編集",
+        "pip_select_all": "全員",
+        "pip_deselect_all": "解除",
+        "pip_bg_color": "背景色",
```

- [ ] **Step 1.2: en.json 編集**

```diff
         "pip_open": "Open cue sheet",
-        "pip_open_disabled": "Set your job first",
         "pip_close": "Close",
-        "pip_opacity": "Opacity",
         "pip_switch_job": "Switch job",
         "pip_no_mitigations": "No mitigations placed",
         "pip_edit_hint": "Double-tap to edit name",
+        "pip_select_all": "All",
+        "pip_deselect_all": "Clear",
+        "pip_bg_color": "Background color",
```

- [ ] **Step 1.3: ko.json 編集**

```diff
         "pip_open": "컨닝페이퍼 열기",
-        "pip_open_disabled": "자신의 직업을 설정해주세요",
         "pip_close": "닫기",
-        "pip_opacity": "투명도",
         "pip_switch_job": "직업 전환",
         "pip_no_mitigations": "경감이 배치되지 않았습니다",
         "pip_edit_hint": "더블 탭으로 이름 편집",
+        "pip_select_all": "전체",
+        "pip_deselect_all": "해제",
+        "pip_bg_color": "배경색",
```

- [ ] **Step 1.4: zh.json 編集**

```diff
         "pip_open": "打开小抄",
-        "pip_open_disabled": "请先设置自己的职业",
         "pip_close": "关闭",
-        "pip_opacity": "透明度",
         "pip_switch_job": "切换职业",
         "pip_no_mitigations": "未放置任何减伤",
         "pip_edit_hint": "双击编辑名称",
+        "pip_select_all": "全部",
+        "pip_deselect_all": "清除",
+        "pip_bg_color": "背景颜色",
```

- [ ] **Step 1.5: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(pip): i18n keys for multi-select and bg-color picker (4 langs)"
```

---

## Task 2: 純粋関数 `computeCueItems` を TDD で実装

選択メンバー集合 + イベント + 軽減から、表示すべきカンペ行を計算する純粋関数。

**Files:**
- Create: `src/utils/pipViewLogic.ts`
- Test: `src/__tests__/pipViewLogic.test.ts`

- [ ] **Step 2.1: 失敗テストを書く**

```typescript
// src/__tests__/pipViewLogic.test.ts
import { describe, it, expect } from 'vitest';
import { computeCueItems } from '../utils/pipViewLogic';
import type { TimelineEvent, AppliedMitigation } from '../types';

const evt = (id: string, time: number, name = id): TimelineEvent => ({
    id,
    time,
    name: { ja: name, en: name, ko: name, zh: name },
} as TimelineEvent);

const miti = (id: string, time: number, ownerId: string, mitigationId: string): AppliedMitigation => ({
    id,
    time,
    ownerId,
    mitigationId,
} as AppliedMitigation);

describe('computeCueItems', () => {
    it('returns empty when no member is selected', () => {
        const events = [evt('e1', 10)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        expect(computeCueItems(events, mitigations, new Set())).toEqual([]);
    });

    it('returns only events that have mitigations from selected members', () => {
        const events = [evt('e1', 10), evt('e2', 20), evt('e3', 30)];
        const mitigations = [
            miti('m1', 10, 'MT', 'rampart'),
            miti('m2', 20, 'H1', 'sacred_soil'),
            miti('m3', 30, 'D1', 'feint'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT', 'H1']));
        expect(result.map(r => r.event.id)).toEqual(['e1', 'e2']);
    });

    it('merges mitigations from multiple selected members at the same time', () => {
        const events = [evt('e1', 10)];
        const mitigations = [
            miti('m1', 10, 'MT', 'rampart'),
            miti('m2', 10, 'H1', 'sacred_soil'),
            miti('m3', 10, 'D1', 'feint'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT', 'H1', 'D1']));
        expect(result).toHaveLength(1);
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart', 'sacred_soil', 'feint']);
    });

    it('ignores mitigations from non-selected members', () => {
        const events = [evt('e1', 10)];
        const mitigations = [
            miti('m1', 10, 'MT', 'rampart'),
            miti('m2', 10, 'H1', 'sacred_soil'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });

    it('sorts events by time ascending', () => {
        const events = [evt('e1', 30), evt('e2', 10), evt('e3', 20)];
        const mitigations = [
            miti('m1', 30, 'MT', 'rampart'),
            miti('m2', 10, 'MT', 'reprisal'),
            miti('m3', 20, 'MT', 'arms_length'),
        ];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result.map(r => r.event.time)).toEqual([10, 20, 30]);
    });

    it('handles event with no mitigation owner match (skipped)', () => {
        const events = [evt('e1', 10), evt('e2', 20)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['H1']));
        expect(result).toEqual([]);
    });
});
```

- [ ] **Step 2.2: テスト実行（失敗確認）**

```bash
npx vitest run src/__tests__/pipViewLogic.test.ts
```

期待: モジュール未存在で失敗。

- [ ] **Step 2.3: 純粋関数を実装**

```typescript
// src/utils/pipViewLogic.ts
import type { TimelineEvent, AppliedMitigation } from '../types';

export interface CueItem {
    event: TimelineEvent;
    mitigations: AppliedMitigation[];
}

/**
 * 選択メンバー集合に紐づく軽減を時刻ごとにマージし、
 * 軽減が配置されたイベントだけを時刻昇順で返す。
 */
export function computeCueItems(
    events: TimelineEvent[],
    mitigations: AppliedMitigation[],
    selectedMemberIds: Set<string>,
): CueItem[] {
    if (selectedMemberIds.size === 0) return [];

    const filteredMitis = mitigations.filter(m => selectedMemberIds.has(m.ownerId));
    if (filteredMitis.length === 0) return [];

    const mitiTimes = new Set(filteredMitis.map(m => m.time));

    return events
        .filter(e => mitiTimes.has(e.time))
        .sort((a, b) => a.time - b.time)
        .map(event => ({
            event,
            mitigations: filteredMitis.filter(m => m.time === event.time),
        }));
}
```

- [ ] **Step 2.4: テスト実行（PASS 確認）**

```bash
npx vitest run src/__tests__/pipViewLogic.test.ts
```

期待: 6 件 PASS。

- [ ] **Step 2.5: コミット**

```bash
rtk git add src/utils/pipViewLogic.ts src/__tests__/pipViewLogic.test.ts
rtk git commit -m "feat(pip): extract computeCueItems pure function with TDD"
```

---

## Task 3: 純粋関数 `computeInitialSelection` を TDD で実装

`myMemberId` の有無に応じて初期選択メンバー集合を返す純粋関数。

**Files:**
- Modify: `src/utils/pipViewLogic.ts`
- Modify: `src/__tests__/pipViewLogic.test.ts`

- [ ] **Step 3.1: 失敗テストを追加**

```typescript
// src/__tests__/pipViewLogic.test.ts に追加
import { computeCueItems, computeInitialSelection } from '../utils/pipViewLogic';

describe('computeInitialSelection', () => {
    const activeMembers = [
        { id: 'MT', jobId: 'PLD' },
        { id: 'ST', jobId: 'WAR' },
        { id: 'H1', jobId: 'WHM' },
        { id: 'D1', jobId: 'NIN' },
    ];

    it('returns set with myMemberId when it matches an active member', () => {
        expect(computeInitialSelection('H1', activeMembers)).toEqual(new Set(['H1']));
    });

    it('returns all active member ids when myMemberId is null', () => {
        expect(computeInitialSelection(null, activeMembers)).toEqual(new Set(['MT', 'ST', 'H1', 'D1']));
    });

    it('returns all active member ids when myMemberId is empty string', () => {
        expect(computeInitialSelection('', activeMembers)).toEqual(new Set(['MT', 'ST', 'H1', 'D1']));
    });

    it('returns all active member ids when myMemberId does not match any active member', () => {
        expect(computeInitialSelection('UNKNOWN', activeMembers)).toEqual(new Set(['MT', 'ST', 'H1', 'D1']));
    });

    it('returns empty set when no active members and no myMemberId', () => {
        expect(computeInitialSelection(null, [])).toEqual(new Set());
    });

    it('skips members without jobId (treated as not active)', () => {
        const partial = [
            { id: 'MT', jobId: 'PLD' },
            { id: 'ST', jobId: null },
        ];
        expect(computeInitialSelection(null, partial as any)).toEqual(new Set(['MT']));
    });
});
```

- [ ] **Step 3.2: テスト実行（失敗確認）**

```bash
npx vitest run src/__tests__/pipViewLogic.test.ts
```

期待: `computeInitialSelection is not exported` で失敗。

- [ ] **Step 3.3: 純粋関数を実装（追加）**

```typescript
// src/utils/pipViewLogic.ts に追加
export interface MemberLike {
    id: string;
    jobId: string | null;
}

/**
 * 初期選択メンバー集合を決定する。
 * myMemberId がアクティブメンバー（jobId 設定済み）と一致すれば自分のみ、
 * そうでなければ全アクティブメンバーを返す。
 */
export function computeInitialSelection(
    myMemberId: string | null,
    members: MemberLike[],
): Set<string> {
    const activeIds = members.filter(m => m.jobId).map(m => m.id);
    if (myMemberId && activeIds.includes(myMemberId)) {
        return new Set([myMemberId]);
    }
    return new Set(activeIds);
}
```

- [ ] **Step 3.4: テスト実行（PASS 確認）**

```bash
npx vitest run src/__tests__/pipViewLogic.test.ts
```

期待: 12 件 PASS（既存 6 + 新規 6）。

- [ ] **Step 3.5: コミット**

```bash
rtk git add src/utils/pipViewLogic.ts src/__tests__/pipViewLogic.test.ts
rtk git commit -m "feat(pip): extract computeInitialSelection pure function with TDD"
```

---

## Task 4: 純粋関数 `getDefaultBgColor` を TDD で実装

テーマと localStorage を考慮した初期背景色を返す純粋関数。

**Files:**
- Modify: `src/utils/pipViewLogic.ts`
- Modify: `src/__tests__/pipViewLogic.test.ts`

- [ ] **Step 4.1: 失敗テストを追加**

```typescript
// src/__tests__/pipViewLogic.test.ts に追加
import { computeCueItems, computeInitialSelection, getDefaultBgColor } from '../utils/pipViewLogic';

describe('getDefaultBgColor', () => {
    it('returns dark default when theme=dark and no stored color', () => {
        expect(getDefaultBgColor('dark', null)).toBe('#0F0F10');
    });

    it('returns light default when theme=light and no stored color', () => {
        expect(getDefaultBgColor('light', null)).toBe('#FAFAFA');
    });

    it('prefers stored color over theme default', () => {
        expect(getDefaultBgColor('dark', '#445566')).toBe('#445566');
        expect(getDefaultBgColor('light', '#112233')).toBe('#112233');
    });

    it('falls back to theme default when stored value is invalid', () => {
        expect(getDefaultBgColor('dark', 'not-a-color')).toBe('#0F0F10');
        expect(getDefaultBgColor('light', '#XYZ')).toBe('#FAFAFA');
        expect(getDefaultBgColor('dark', '')).toBe('#0F0F10');
    });
});
```

- [ ] **Step 4.2: テスト実行（失敗確認）**

```bash
npx vitest run src/__tests__/pipViewLogic.test.ts
```

期待: `getDefaultBgColor is not exported` で失敗。

- [ ] **Step 4.3: 純粋関数を実装**

```typescript
// src/utils/pipViewLogic.ts に追加
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * PiP 背景色のデフォルト値を返す。
 * localStorage に有効な色が保存されていればそれを優先、
 * なければテーマに応じてダーク/ライト用デフォルトを返す。
 */
export function getDefaultBgColor(theme: 'dark' | 'light', stored: string | null): string {
    if (stored && HEX_COLOR_RE.test(stored)) return stored;
    return theme === 'light' ? '#FAFAFA' : '#0F0F10';
}
```

- [ ] **Step 4.4: テスト実行（PASS 確認）**

```bash
npx vitest run src/__tests__/pipViewLogic.test.ts
```

期待: 16 件 PASS（既存 12 + 新規 4）。

- [ ] **Step 4.5: コミット**

```bash
rtk git add src/utils/pipViewLogic.ts src/__tests__/pipViewLogic.test.ts
rtk git commit -m "feat(pip): extract getDefaultBgColor pure function with TDD"
```

---

## Task 5: PipView.tsx 多選フィルタ + 透過撤去

PipView.tsx 本体を改修し、`computeCueItems` / `computeInitialSelection` を利用した多選表示に切り替え、透過機能を撤去する。

**Files:**
- Modify: `src/components/PipView.tsx`

- [ ] **Step 5.1: 多選 state とフィルタを差し替え**

`src/components/PipView.tsx` を以下の差分で書き換える：

```typescript
// import 行に追加
import { useThemeStore } from '../store/useThemeStore';
import { computeCueItems, computeInitialSelection, getDefaultBgColor } from '../utils/pipViewLogic';
```

state 部を変更：

```diff
-    // 表示中のメンバーID（デフォルトは自分のジョブ）
-    const [selectedMemberId, setSelectedMemberId] = useState<string>(myMemberId || 'MT');
-    const [opacity, setOpacity] = useState(0.85);
     const [jobMenuOpen, setJobMenuOpen] = useState(false);
     const [editingEventId, setEditingEventId] = useState<string | null>(null);
     const editInputRef = useRef<HTMLInputElement>(null);
+
+    // 多選: メンバーIDの集合
+    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
+        () => computeInitialSelection(myMemberId, partyMembers),
+    );
+
+    // 背景色（localStorage 永続化）
+    const theme = useThemeStore(s => s.theme);
+    const [bgColor, setBgColor] = useState<string>(() => {
+        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pip-bg-color') : null;
+        return getDefaultBgColor(theme, stored);
+    });
+    const colorInputRef = useRef<HTMLInputElement>(null);
+
+    const handleBgColorChange = useCallback((color: string) => {
+        setBgColor(color);
+        try { localStorage.setItem('pip-bg-color', color); } catch { /* quota etc */ }
+    }, []);
+
+    // ジョブピッカー トグル
+    const toggleMemberSelection = useCallback((memberId: string) => {
+        setSelectedMemberIds(prev => {
+            const next = new Set(prev);
+            if (next.has(memberId)) next.delete(memberId);
+            else next.add(memberId);
+            return next;
+        });
+    }, []);
+
+    const selectAllMembers = useCallback(() => {
+        setSelectedMemberIds(new Set(partyMembers.filter(m => m.jobId).map(m => m.id)));
+    }, [partyMembers]);
+
+    const deselectAllMembers = useCallback(() => {
+        setSelectedMemberIds(new Set());
+    }, []);
```

`selectedJob` と `cueItems` を差し替え：

```diff
-    // 選択中メンバーのジョブ
-    const selectedJob = useMemo(() => {
-        const member = partyMembers.find(m => m.id === selectedMemberId);
-        return member ? JOBS.find(j => j.id === member.jobId) : null;
-    }, [partyMembers, selectedMemberId, JOBS]);
-
-    // 選択メンバーの軽減 → 該当イベントだけ抽出
-    const cueItems = useMemo(() => {
-        const memberMitis = timelineMitigations.filter(m => m.ownerId === selectedMemberId);
-        // ... (中略、長い既存ロジック)
-    }, [timelineEvents, timelineMitigations, selectedMemberId, MITIGATIONS]);
+    // 選択中ボタンに表示する代表ジョブ（先頭の1ジョブ）
+    const representativeJob = useMemo(() => {
+        const firstId = [...selectedMemberIds][0];
+        if (!firstId) return null;
+        const member = partyMembers.find(m => m.id === firstId);
+        return member ? JOBS.find(j => j.id === member.jobId) : null;
+    }, [partyMembers, selectedMemberIds, JOBS]);
+
+    // 純粋関数で多選フィルタ
+    const cueItemsRaw = useMemo(
+        () => computeCueItems(timelineEvents, timelineMitigations, selectedMemberIds),
+        [timelineEvents, timelineMitigations, selectedMemberIds],
+    );
+
+    // CueItem に MITIGATIONS の definition を hydrate
+    const cueItems = useMemo(() => cueItemsRaw.map(({ event, mitigations }) => ({
+        event,
+        mitigations: mitigations
+            .map(m => {
+                const def = MITIGATIONS.find(d => d.id === m.mitigationId);
+                return def ? { applied: m, definition: def } : null;
+            })
+            .filter(Boolean) as { applied: AppliedMitigation; definition: typeof MITIGATIONS[number] }[],
+    })), [cueItemsRaw, MITIGATIONS]);
```

ツールバーを書き換え（透過スライダー削除 + 多選 Popover + カラーピッカー追加）：

```typescript
// 既存の <div className="flex items-center gap-1.5 px-2 py-1 ...">  全体を以下に置き換え
return (
    <div
        className="flex flex-col h-full select-none"
        style={{ background: bgColor }}
    >
        {/* ── ツールバー ── */}
        <div className="flex items-center gap-1.5 px-2 py-1 shrink-0 border-b border-white/10">
            {/* ジョブピッカー（多選 Popover） */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setJobMenuOpen(!jobMenuOpen)}
                    className="h-6 min-w-[24px] px-1 rounded border border-white/20 flex items-center gap-0.5 cursor-pointer hover:border-white/40 transition-colors"
                    aria-label={t('timeline.pip_switch_job')}
                >
                    {representativeJob ? (
                        <img src={representativeJob.icon} className="w-4 h-4 object-contain" alt="" />
                    ) : (
                        <span className="text-[9px] text-white/50">?</span>
                    )}
                    {selectedMemberIds.size > 1 && (
                        <span className="text-[9px] text-white/70 font-bold">
                            +{selectedMemberIds.size - 1}
                        </span>
                    )}
                </button>

                {jobMenuOpen && (
                    <div className="absolute top-7 left-0 z-50 bg-black/95 border border-white/20 rounded-md p-1 w-[180px]">
                        {/* 全員 / 解除 ボタン */}
                        <div className="flex gap-1 mb-1">
                            <button
                                onClick={selectAllMembers}
                                className="flex-1 px-1 py-0.5 text-[9px] text-white/80 hover:bg-white/10 rounded cursor-pointer"
                            >
                                {t('timeline.pip_select_all')}
                            </button>
                            <button
                                onClick={deselectAllMembers}
                                className="flex-1 px-1 py-0.5 text-[9px] text-white/80 hover:bg-white/10 rounded cursor-pointer"
                            >
                                {t('timeline.pip_deselect_all')}
                            </button>
                        </div>
                        {/* メンバー候補 */}
                        <div className="flex flex-wrap gap-0.5">
                            {activeMembers.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => toggleMemberSelection(m.id)}
                                    className={clsx(
                                        "w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors",
                                        selectedMemberIds.has(m.id)
                                            ? "bg-white/25 ring-1 ring-white/40"
                                            : "hover:bg-white/10"
                                    )}
                                    title={m.id}
                                >
                                    {m.job && <img src={m.job.icon} className="w-4 h-4 object-contain" alt="" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* スペーサー */}
            <div className="flex-1" />

            {/* 背景カラーピッカー */}
            <button
                onClick={() => colorInputRef.current?.click()}
                className="w-4 h-4 rounded-full border border-white/40 cursor-pointer hover:border-white/70 transition-colors shrink-0"
                style={{ background: bgColor }}
                aria-label={t('timeline.pip_bg_color')}
            />
            <input
                ref={colorInputRef}
                type="color"
                value={bgColor}
                onChange={(e) => handleBgColorChange(e.target.value)}
                className="absolute opacity-0 pointer-events-none w-0 h-0"
                tabIndex={-1}
                aria-hidden
            />

            {/* 閉じるボタン */}
            <button
                onClick={onClose}
                className="w-5 h-5 rounded flex items-center justify-center cursor-pointer text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={t('timeline.pip_close')}
            >
                <X size={10} />
            </button>
        </div>

        {/* ── カンペリスト（既存と同じ） ── */}
        {/* ...既存のカンペリストJSX を維持... */}
    </div>
);
```

- [ ] **Step 5.2: ビルドチェック**

```bash
npx tsc --noEmit
```

期待: エラーなし。

- [ ] **Step 5.3: ユニットテスト全体実行**

```bash
npx vitest run
```

期待: 既存 312 + 新規 16 = 全 PASS。

- [ ] **Step 5.4: コミット**

```bash
rtk git add src/components/PipView.tsx
rtk git commit -m "feat(pip): multi-select members, drop opacity, add bg color picker"
```

---

## Task 6: PC 起動ボタン復活（Timeline.tsx）

**Files:**
- Modify: `src/components/Timeline.tsx:1972-1990`

- [ ] **Step 6.1: `false &&` 撤去 + disable 撤去**

[Timeline.tsx:1972-1990](../../src/components/Timeline.tsx#L1972) を以下に書き換え：

```diff
-                                {/* PiP カンペビュー — 透過ウィンドウ未実現のため非表示（コードは保持） */}
-                                {false && pipSupported && (
-                                    <Tooltip content={myMemberId ? t('timeline.pip_open') : t('timeline.pip_open_disabled')}>
-                                        <button
-                                            onClick={pipWindow ? handleClosePip : handleOpenPip}
-                                            disabled={!myMemberId}
-                                            className={clsx(
-                                                "p-1 rounded transition-all duration-150",
-                                                !myMemberId
-                                                    ? "text-app-text-muted cursor-default opacity-40"
-                                                    : pipWindow
-                                                        ? "text-app-blue cursor-pointer hover:bg-app-blue/10"
-                                                        : "text-app-text-muted cursor-pointer hover:bg-app-surface2 hover:text-app-text"
-                                            )}
-                                        >
-                                            <PictureInPicture2 size={12} />
-                                        </button>
-                                    </Tooltip>
-                                )}
+                                {/* PiP カンペビュー */}
+                                {pipSupported && (
+                                    <Tooltip content={t('timeline.pip_open')}>
+                                        <button
+                                            onClick={pipWindow ? handleClosePip : handleOpenPip}
+                                            className={clsx(
+                                                "p-1 rounded transition-all duration-150 cursor-pointer",
+                                                pipWindow
+                                                    ? "text-app-blue hover:bg-app-blue/10"
+                                                    : "text-app-text-muted hover:bg-app-surface2 hover:text-app-text"
+                                            )}
+                                        >
+                                            <PictureInPicture2 size={12} />
+                                        </button>
+                                    </Tooltip>
+                                )}
```

- [ ] **Step 6.2: ビルドチェック**

```bash
npx tsc --noEmit
```

期待: エラーなし。`myMemberId` が PipView 内で使われているので Timeline.tsx の import は維持される（既存 588 行で使用継続）。

- [ ] **Step 6.3: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(pip): revive PC launch button (drop disabled gate)"
```

---

## Task 7: モバイル FAB 起動項目復活（MobileFAB.tsx）

**Files:**
- Modify: `src/components/MobileFAB.tsx:133`
- Modify: `src/components/MobileFAB.tsx:236-244`

- [ ] **Step 7.1: lucide-react から PictureInPicture2 を import**

[src/components/MobileFAB.tsx:4-9](../../src/components/MobileFAB.tsx#L4) の lucide-react import に `PictureInPicture2` を追加：

```diff
 import {
     MoreHorizontal, X, List, Tag, Search,
     Cloud, CloudCheck, CloudUpload, CloudAlert,
     Globe, Sun, Moon,
-    Rows3, AlignJustify,
+    Rows3, AlignJustify, PictureInPicture2,
 } from 'lucide-react';
```

- [ ] **Step 7.2: `myMemberId` import コメント削除**

[src/components/MobileFAB.tsx:133](../../src/components/MobileFAB.tsx#L133) の行を削除（disable 不要なので import 不要）：

```diff
-    // const myMemberId = useMitigationStore(s => s.myMemberId); // PiP復活時に使用
```

- [ ] **Step 7.3: navItems に cueSheet 項目を復活**

[src/components/MobileFAB.tsx:236-244](../../src/components/MobileFAB.tsx#L236) のコメントアウトを解除し、disable を撤去：

```diff
-        // PiP カンペビュー — 透過ウィンドウ未実現のため非表示（コードは保持）
-        // {
-        //     key: 'cueSheet',
-        //     label: t('app.fab_cue_sheet'),
-        //     icon: <PictureInPicture2 size={20} />,
-        //     onClick: () => { close(); window.dispatchEvent(new Event('mobile:open-cue-sheet')); },
-        //     accent: false,
-        //     disabled: !myMemberId,
-        // },
+        {
+            key: 'cueSheet',
+            label: t('app.fab_cue_sheet'),
+            icon: <PictureInPicture2 size={20} />,
+            onClick: () => { close(); window.dispatchEvent(new Event('mobile:open-cue-sheet')); },
+            accent: false,
+        },
```

- [ ] **Step 7.4: `useMitigationStore` の未使用 import チェック**

```bash
npx tsc --noEmit 2>&1 | rtk grep "MobileFAB"
```

期待: エラーなし。`useMitigationStore` 自体は他で使われていないため、Step 7.2 で唯一の参照が消えると未使用 import エラーになる。その場合は import 文も削除：

```bash
rtk grep "useMitigationStore" src/components/MobileFAB.tsx
```

検索結果で 1 件（import 文だけ）残るなら、import 文も削除：

```diff
-import { useMitigationStore } from '../store/useMitigationStore';
```

- [ ] **Step 7.5: `app.fab_cue_sheet` i18n キー存在確認**

```bash
rtk grep "fab_cue_sheet" src/locales/
```

4 言語で存在することを確認。無ければ追加：

```json
"fab_cue_sheet": "カンペ" // ja
"fab_cue_sheet": "Cue" // en
"fab_cue_sheet": "컨닝" // ko
"fab_cue_sheet": "小抄" // zh
```

- [ ] **Step 7.6: ビルドチェック**

```bash
npx tsc --noEmit
```

期待: エラーなし。

- [ ] **Step 7.7: コミット**

```bash
rtk git add src/components/MobileFAB.tsx
# i18n も追加した場合は src/locales/ も追加
rtk git commit -m "feat(pip): revive mobile FAB launch (drop disabled gate)"
```

---

## Task 8: 全体ビルド + テスト + 実機確認準備

**Files:** なし（検証のみ）

- [ ] **Step 8.1: TypeScript 厳密チェック**

```bash
npx tsc --noEmit
```

期待: エラー 0 件。

- [ ] **Step 8.2: ユニットテスト全体実行**

```bash
npx vitest run
```

期待: 全 PASS（既存 + Task 2-4 で追加した 16 件 ≈ 328 件）。

- [ ] **Step 8.3: プロダクションビルド**

```bash
rtk npm run build
```

期待: ビルド成功、ワーニングのみ許容。

- [ ] **Step 8.4: 動作確認チェックリスト（手動、ローカル `npm run dev`）**

- [ ] PC: Chrome で `npm run dev` 起動 → タイムライン上部の PiP ボタンが見える、disable 状態でない
- [ ] PC: PiP ボタン押下 → 別ウィンドウが開く
- [ ] PC: ジョブピッカークリック → 多選 Popover、「全員 / 解除」ボタンと各メンバートグルが動く
- [ ] PC: メンバー多選で軽減アイコンが連結表示される
- [ ] PC: 自ジョブ未設定時に PiP 開く → 全員初期選択される
- [ ] PC: 軽減ゼロのプランで PiP 開く → 空状態メッセージが出る、クラッシュしない
- [ ] PC: 背景色丸ボタン押下 → OS 標準カラーピッカー → 色変更で背景反映
- [ ] PC: 色変更後ウィンドウ閉じて再度開く → localStorage で色が永続している
- [ ] PC: ダーク/ライトテーマで初回起動の背景色が分岐する（localStorage クリア後確認）
- [ ] スマホ: モバイル FAB → カンペ項目が見える、disable 状態でない
- [ ] スマホ: 押すとフルスクリーン PiP が下から開く
- [ ] スマホ: 同様の多選 / 空状態 / 背景色変更が動く
- [ ] メモ機能: 攻撃名ダブルクリック/ダブルタップで編集モード、保存、再読み込みで永続

- [ ] **Step 8.5: 必要に応じて `useMitigationStore` の Timeline.tsx import 整理**

仕様変更後 `myMemberId` が PipView.tsx の中だけで参照されている可能性があるため、Timeline.tsx の `myMemberId` import が未使用になっていないか確認：

```bash
rtk grep "myMemberId" src/components/Timeline.tsx
```

PipView.tsx 内部でしか使わないなら import 削除も検討。本タスクでは追加変更なしで OK（既存構造維持）。

---

## Task 9（任意）: PipView.tsx スモークテスト

時間に余裕があれば、PipView.tsx の最小限レンダリングテストを追加する。React 19 + happy-dom 環境で `documentPictureInPicture` API は不要（`mode='fullscreen'` で開けばよい）。

**Files:**
- Create: `src/__tests__/PipView.test.tsx`

- [ ] **Step 9.1: スモークテスト**

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PipView from '../components/PipView';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'ja' },
    }),
}));

vi.mock('../store/useMitigationStore', () => ({
    useMitigationStore: (selector: any) => selector({
        timelineEvents: [],
        timelineMitigations: [],
        partyMembers: [],
        myMemberId: null,
    }),
}));

vi.mock('../store/usePlanStore', () => ({
    usePlanStore: () => 'plan-test',
}));

vi.mock('../store/useThemeStore', () => ({
    useThemeStore: () => 'dark',
}));

vi.mock('../hooks/useSkillsData', () => ({
    useJobs: () => [],
    useMitigations: () => [],
}));

describe('PipView smoke', () => {
    beforeEach(() => localStorage.clear());

    it('renders empty state when no mitigations are placed', () => {
        render(<PipView mode="fullscreen" onClose={() => {}} />);
        expect(screen.getByText('timeline.pip_no_mitigations')).toBeTruthy();
    });

    it('reads stored bg color from localStorage on mount', () => {
        localStorage.setItem('pip-bg-color', '#445566');
        const { container } = render(<PipView mode="fullscreen" onClose={() => {}} />);
        const root = container.firstChild as HTMLElement;
        expect(root.style.background).toContain('rgb(68, 85, 102)');
    });
});
```

- [ ] **Step 9.2: テスト実行**

```bash
npx vitest run src/__tests__/PipView.test.tsx
```

期待: 2 件 PASS。失敗した場合はモック範囲を調整するか、本タスクは skip して main に乗せても良い（純粋関数テストでロジックは守られている）。

- [ ] **Step 9.3: コミット**

```bash
rtk git add src/__tests__/PipView.test.tsx
rtk git commit -m "test(pip): smoke test for empty state and bg color persistence"
```

---

## Task 10: push + Vercel デプロイ

**Files:** なし

- [ ] **Step 10.1: push 前の最終 build + test**

```bash
rtk npm run build && npx vitest run
```

期待: 全 PASS。

- [ ] **Step 10.2: push**

```bash
rtk git push origin main
```

- [ ] **Step 10.3: Vercel デプロイ確認**

Vercel ダッシュボードでデプロイ成功を確認。

- [ ] **Step 10.4: 本番実機確認**

`https://lopoly.app/miti` で Task 8 のチェックリストを再実行。

- [ ] **Step 10.5: docs/TODO.md と TODO_COMPLETED.md 更新**

`docs/TODO.md` の「次にやること」から「PiP（Floating Timeline）復活 実装着手」を削除し、`docs/TODO_COMPLETED.md` に完了として記載。

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(todo): mark PiP revival as complete"
rtk git push origin main
```

---

## 完了基準

- [ ] PC: PiP ボタンが見える + 別ウィンドウ起動が動く
- [ ] スマホ: FAB の カンペ項目から フルスクリーン起動が動く
- [ ] 多選 Popover が動作（トグル / 全員 / 解除）
- [ ] 自ジョブ未設定で全員フォールバック動作
- [ ] 背景カラーピッカーで色変更 + localStorage 永続化
- [ ] テーマ別デフォルト色（ダーク `#0F0F10` / ライト `#FAFAFA`）
- [ ] 既存メモ機能維持
- [ ] tsc clean / vitest 全 PASS / npm run build 成功
- [ ] 本番デプロイ + 実機確認 OK

---

## リスク・落とし穴メモ

- **`useMitigationStore` の `useShallow` 既存パターン**: 多選化で state 増えても既存 useShallow で OK（再レンダ過敏化は無さそうだが、Set を comparison に渡すと参照比較で毎回新規扱いになる注意）。`selectedMemberIds` 自体は store 外の `useState` なので影響なし
- **`PartyMember` 型の `jobId`**: nullable なので `computeInitialSelection` のフィルタは型安全。実装中に型エラーが出たら `m.jobId != null` で揃える
- **i18n 4 言語の整合性**: `pip_select_all` を 4 言語追加し忘れ無いよう Task 1 を最初にまとめて済ます
- **`onChange` の同期性**: native color picker は OS 依存で「ドラッグ中も発火」する場合あり、localStorage 書き込みが頻発するが軽量なので問題なし
- **PiP ウィンドウ内での localStorage 共有**: Document Picture-in-Picture API は親ドキュメントの localStorage を共有する（同一 origin）。`pip-bg-color` の永続化は親側操作と同等で動作
- **Document Picture-in-Picture が `<input type="color">` を呼べるか**: PiP ウィンドウ内で OS ダイアログを開くのは Chrome で動作確認済みの想定。動かない場合は Task 9 で代替検討
