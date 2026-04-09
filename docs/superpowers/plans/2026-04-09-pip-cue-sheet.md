# PiP カンペビュー 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自分のジョブの軽減配置だけを時系列リスト表示する「カンペ」ビューを、PCではDocument PiP別窓、スマホではフルスクリーンで提供する。

**Architecture:** `PipView.tsx` にカンペ表示の全UIを集約。PC版は `documentPictureInPicture.requestWindow()` で別窓を開き、ReactPortalでPipViewをレンダリング。スマホ版はフルスクリーンオーバーレイとして同じPipViewを表示。攻撃名メモはカスタムフック `usePipNotes.ts` でlocalStorage管理。

**Tech Stack:** React 19, Zustand, Document Picture-in-Picture API, Popover API, framer-motion (SPRING tokens), localStorage, i18next

**参照設計書:** `docs/superpowers/specs/2026-04-09-pip-cue-sheet-design.md`

---

## ファイル構成

| ファイル | 役割 |
|----------|------|
| 新規: `src/hooks/usePipNotes.ts` | localStorage メモ管理フック |
| 新規: `src/components/PipView.tsx` | カンペ表示コンポーネント（PC/スマホ共通） |
| 変更: `src/locales/ja.json` | PiP関連i18nキー追加 |
| 変更: `src/locales/en.json` | PiP関連i18nキー追加 |
| 変更: `src/locales/zh.json` | PiP関連i18nキー追加 |
| 変更: `src/locales/ko.json` | PiP関連i18nキー追加 |
| 変更: `src/components/Timeline.tsx` | 起動ボタン差し替え + PiPウィンドウ管理 |
| 変更: `src/components/MobileFAB.tsx` | スマホ用カンペ起動ボタン追加 |

---

### Task 1: usePipNotes フック

**Files:**
- Create: `src/hooks/usePipNotes.ts`
- Create: `src/__tests__/usePipNotes.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// src/__tests__/usePipNotes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getPipNotes, setPipNote, clearPipNotes } from '../hooks/usePipNotes';

describe('usePipNotes', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns empty object for unknown planId', () => {
        expect(getPipNotes('plan-123')).toEqual({});
    });

    it('sets and gets a note for an event', () => {
        setPipNote('plan-123', 'event-1', '散開');
        expect(getPipNotes('plan-123')).toEqual({ 'event-1': '散開' });
    });

    it('overwrites existing note', () => {
        setPipNote('plan-123', 'event-1', '散開');
        setPipNote('plan-123', 'event-1', '頭割り');
        expect(getPipNotes('plan-123')).toEqual({ 'event-1': '頭割り' });
    });

    it('clears a note when set to empty string', () => {
        setPipNote('plan-123', 'event-1', '散開');
        setPipNote('plan-123', 'event-1', '');
        expect(getPipNotes('plan-123')).toEqual({});
    });

    it('isolates notes per planId', () => {
        setPipNote('plan-A', 'event-1', 'メモA');
        setPipNote('plan-B', 'event-1', 'メモB');
        expect(getPipNotes('plan-A')).toEqual({ 'event-1': 'メモA' });
        expect(getPipNotes('plan-B')).toEqual({ 'event-1': 'メモB' });
    });

    it('clearPipNotes removes all notes for a plan', () => {
        setPipNote('plan-123', 'event-1', 'メモ1');
        setPipNote('plan-123', 'event-2', 'メモ2');
        clearPipNotes('plan-123');
        expect(getPipNotes('plan-123')).toEqual({});
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/usePipNotes.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: usePipNotes を実装**

```typescript
// src/hooks/usePipNotes.ts
import { useState, useCallback } from 'react';

const STORAGE_PREFIX = 'pip-notes:';

/** localStorage から指定プランのメモを取得 */
export function getPipNotes(planId: string): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + planId);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/** 指定プラン・イベントのメモを保存（空文字で削除） */
export function setPipNote(planId: string, eventId: string, text: string): void {
    const notes = getPipNotes(planId);
    if (text) {
        notes[eventId] = text;
    } else {
        delete notes[eventId];
    }
    localStorage.setItem(STORAGE_PREFIX + planId, JSON.stringify(notes));
}

/** 指定プランのメモをすべて削除 */
export function clearPipNotes(planId: string): void {
    localStorage.removeItem(STORAGE_PREFIX + planId);
}

/** Reactフック: PipView 内で使用 */
export function usePipNotes(planId: string | null) {
    const [notes, setNotes] = useState<Record<string, string>>(() =>
        planId ? getPipNotes(planId) : {}
    );

    const updateNote = useCallback((eventId: string, text: string) => {
        if (!planId) return;
        setPipNote(planId, eventId, text);
        setNotes(getPipNotes(planId));
    }, [planId]);

    return { notes, updateNote };
}
```

- [ ] **Step 4: テストがパスすることを確認**

Run: `npx vitest run src/__tests__/usePipNotes.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/hooks/usePipNotes.ts src/__tests__/usePipNotes.test.ts
git commit -m "feat: add usePipNotes hook for PiP cue sheet memos"
```

---

### Task 2: i18n キー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: ja.json に PiP 関連キーを追加**

`timeline` セクション内に追加（`secret_feature` を差し替え）:

```json
"pip_open": "カンペを開く",
"pip_open_disabled": "自分のジョブを設定すると使えます",
"pip_close": "閉じる",
"pip_opacity": "透過率",
"pip_switch_job": "ジョブを切り替え",
"pip_no_mitigations": "軽減が配置されていません",
"pip_edit_hint": "ダブルタップで名前を編集"
```

`app` セクション内に追加:

```json
"fab_cue_sheet": "カンペ"
```

- [ ] **Step 2: en.json に対応キーを追加**

`timeline` セクション:

```json
"pip_open": "Open Cue Sheet",
"pip_open_disabled": "Set your job first",
"pip_close": "Close",
"pip_opacity": "Opacity",
"pip_switch_job": "Switch job",
"pip_no_mitigations": "No mitigations placed",
"pip_edit_hint": "Double-tap to edit name"
```

`app` セクション:

```json
"fab_cue_sheet": "Cue Sheet"
```

- [ ] **Step 3: zh.json / ko.json にも対応キーを追加**

zh.json `timeline` セクション:

```json
"pip_open": "打开提示表",
"pip_open_disabled": "请先设置自己的职业",
"pip_close": "关闭",
"pip_opacity": "透明度",
"pip_switch_job": "切换职业",
"pip_no_mitigations": "未配置减伤",
"pip_edit_hint": "双击编辑名称"
```

zh.json `app` セクション:

```json
"fab_cue_sheet": "提示表"
```

ko.json `timeline` セクション:

```json
"pip_open": "큐 시트 열기",
"pip_open_disabled": "자신의 직업을 설정해주세요",
"pip_close": "닫기",
"pip_opacity": "투명도",
"pip_switch_job": "직업 변경",
"pip_no_mitigations": "경감이 배치되지 않았습니다",
"pip_edit_hint": "더블탭으로 이름 편집"
```

ko.json `app` セクション:

```json
"fab_cue_sheet": "큐 시트"
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: add i18n keys for PiP cue sheet"
```

---

### Task 3: PipView コンポーネント

**Files:**
- Create: `src/components/PipView.tsx`

このコンポーネントは PC/スマホ共通のカンペ表示UI。呼び出し元がPC別窓 or スマホオーバーレイのどちらにレンダリングするか決める。

- [ ] **Step 1: PipView の基本構造を作成**

```tsx
// src/components/PipView.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { useJobs, useMitigations } from '../hooks/useSkillsData';
import { usePipNotes } from '../hooks/usePipNotes';
import { useShallow } from 'zustand/react/shallow';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { TimelineEvent, AppliedMitigation } from '../types';

/** 時間(秒)を mm:ss 形式に変換 */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PipViewProps {
    /** PC版: 透過率スライダーと閉じるボタンを表示 */
    mode: 'pip' | 'fullscreen';
    onClose: () => void;
}

const PipView: React.FC<PipViewProps> = ({ mode, onClose }) => {
    const { t, i18n } = useTranslation();
    const JOBS = useJobs();
    const MITIGATIONS = useMitigations();

    const { timelineEvents, timelineMitigations, partyMembers, myMemberId } = useMitigationStore(
        useShallow(s => ({
            timelineEvents: s.timelineEvents,
            timelineMitigations: s.timelineMitigations,
            partyMembers: s.partyMembers,
            myMemberId: s.myMemberId,
        }))
    );

    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const { notes, updateNote } = usePipNotes(currentPlanId);
    const lang = (i18n.language || 'ja') as 'ja' | 'en' | 'zh' | 'ko';

    // 表示中のメンバーID（デフォルトは自分のジョブ）
    const [selectedMemberId, setSelectedMemberId] = useState<string>(myMemberId || 'MT');
    const [opacity, setOpacity] = useState(0.85);
    const [jobMenuOpen, setJobMenuOpen] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const jobButtonRef = useRef<HTMLButtonElement>(null);

    // 選択中メンバーのジョブ
    const selectedJob = useMemo(() => {
        const member = partyMembers.find(m => m.id === selectedMemberId);
        return member ? JOBS.find(j => j.id === member.jobId) : null;
    }, [partyMembers, selectedMemberId, JOBS]);

    // 選択メンバーの軽減 → 該当イベントだけ抽出
    const cueItems = useMemo(() => {
        const memberMitis = timelineMitigations.filter(m => m.ownerId === selectedMemberId);
        if (memberMitis.length === 0) return [];

        // 軽減が配置されているイベント時間のセットを作る
        const mitiTimes = new Set(memberMitis.map(m => m.time));

        // イベントを時間順にフィルタ
        const events = timelineEvents
            .filter(e => mitiTimes.has(e.time))
            .sort((a, b) => a.time - b.time);

        return events.map(event => ({
            event,
            mitigations: memberMitis
                .filter(m => m.time === event.time)
                .map(m => {
                    const mitDef = MITIGATIONS.find(d => d.id === m.mitigationId);
                    return mitDef ? { applied: m, definition: mitDef } : null;
                })
                .filter(Boolean) as { applied: AppliedMitigation; definition: typeof MITIGATIONS[number] }[],
        }));
    }, [timelineEvents, timelineMitigations, selectedMemberId, MITIGATIONS]);

    // 攻撃名のダブルクリック → 編集モードに
    const handleDoubleClick = useCallback((eventId: string) => {
        setEditingEventId(eventId);
    }, []);

    // 編集確定
    const handleEditConfirm = useCallback((eventId: string, value: string) => {
        updateNote(eventId, value.trim());
        setEditingEventId(null);
    }, [updateNote]);

    // 編集中にフォーカス
    useEffect(() => {
        if (editingEventId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingEventId]);

    // ジョブがセットされているメンバーだけ切替対象
    const activeMembers = useMemo(() =>
        partyMembers.filter(m => m.jobId).map(m => ({
            ...m,
            job: JOBS.find(j => j.id === m.jobId),
        })),
        [partyMembers, JOBS]
    );

    return (
        <div
            className="flex flex-col h-full select-none"
            style={mode === 'pip' ? { backgroundColor: `rgba(15, 15, 16, ${opacity})` } : undefined}
        >
            {/* ── ツールバー ── */}
            <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-white/10">
                {/* ジョブアイコン + Popover切替 */}
                <button
                    ref={jobButtonRef}
                    onClick={() => setJobMenuOpen(!jobMenuOpen)}
                    className="w-7 h-7 rounded-md border border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
                >
                    {selectedJob ? (
                        <img src={selectedJob.icon} className="w-5 h-5 object-contain" />
                    ) : (
                        <span className="text-xs text-white/50">?</span>
                    )}
                </button>

                {/* 透過率スライダー（PC PiPモードのみ） */}
                {mode === 'pip' && (
                    <input
                        type="range"
                        min={0.2}
                        max={1}
                        step={0.05}
                        value={opacity}
                        onChange={(e) => setOpacity(Number(e.target.value))}
                        className="flex-1 h-1 accent-white/70 cursor-pointer"
                    />
                )}

                {/* スマホモードではスペーサー */}
                {mode === 'fullscreen' && <div className="flex-1" />}

                {/* 閉じるボタン */}
                <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>

            {/* ── ジョブ切替 Popover ── */}
            {jobMenuOpen && (
                <div className="absolute top-12 left-3 z-50 bg-black/90 border border-white/20 rounded-lg p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95">
                    {activeMembers.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { setSelectedMemberId(m.id); setJobMenuOpen(false); }}
                            className={clsx(
                                "flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors",
                                m.id === selectedMemberId
                                    ? "bg-white/20 text-white"
                                    : "text-white/70 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            {m.job && <img src={m.job.icon} className="w-5 h-5 object-contain" />}
                            <span className="font-bold">{m.id}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── カンペリスト ── */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
                {cueItems.length === 0 ? (
                    <p className="text-white/40 text-sm text-center mt-8">
                        {t('timeline.pip_no_mitigations')}
                    </p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {cueItems.map(({ event, mitigations }) => (
                            <div key={event.id} className="flex items-center gap-2 min-h-[32px]">
                                {/* 時間 */}
                                <span className="text-white/50 text-xs font-mono w-10 shrink-0 text-right">
                                    {formatTime(event.time)}
                                </span>

                                {/* 攻撃名（ダブルクリックで編集） */}
                                {editingEventId === event.id ? (
                                    <input
                                        ref={editInputRef}
                                        defaultValue={notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                        onBlur={(e) => handleEditConfirm(event.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleEditConfirm(event.id, (e.target as HTMLInputElement).value);
                                            if (e.key === 'Escape') setEditingEventId(null);
                                        }}
                                        className="flex-1 min-w-0 bg-white/10 border border-white/30 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                                    />
                                ) : (
                                    <span
                                        onDoubleClick={() => handleDoubleClick(event.id)}
                                        className={clsx(
                                            "flex-1 min-w-0 text-xs truncate cursor-default",
                                            notes[event.id] ? "text-yellow-300" : "text-white/90"
                                        )}
                                        title={t('timeline.pip_edit_hint')}
                                    >
                                        {notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                    </span>
                                )}

                                {/* 軽減スキルアイコン */}
                                <div className="flex items-center gap-0.5 shrink-0">
                                    {mitigations.map(({ applied, definition }) => (
                                        <img
                                            key={applied.id}
                                            src={definition.icon}
                                            className="w-5 h-5 object-contain"
                                            title={definition.name[lang] || definition.name.ja || definition.name.en || ''}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ヒントテキスト（最下部） */}
            <div className="px-3 py-1 text-center shrink-0">
                <span className="text-white/25 text-[9px]">{t('timeline.pip_edit_hint')}</span>
            </div>
        </div>
    );
};

export default PipView;
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: ビルド成功（PipViewはまだどこからもimportされていないが、tscチェックは通る）

- [ ] **Step 3: コミット**

```bash
git add src/components/PipView.tsx
git commit -m "feat: add PipView cue sheet component"
```

---

### Task 4: Timeline.tsx — PC版 PiP 起動ボタンと窓管理

**Files:**
- Modify: `src/components/Timeline.tsx:1714-1721` (disabled Listボタン → PiP起動ボタン)
- Modify: `src/components/Timeline.tsx` (PiPウィンドウ管理state + 起動ロジック追加)

- [ ] **Step 1: import追加**

Timeline.tsxの先頭 import に追加:

```tsx
import { PictureInPicture2 } from 'lucide-react';  // Listアイコンの代わり（Listは他で使用中なので残す）
```

PipViewは動的import:

```tsx
const PipView = React.lazy(() => import('./PipView'));
```

- [ ] **Step 2: PiPウィンドウ管理stateを追加**

Timeline関数コンポーネント内（既存のstate群の近く）に追加:

```tsx
// PiP カンペビュー
const [pipWindow, setPipWindow] = useState<Window | null>(null);
const [pipContainer, setPipContainer] = useState<HTMLDivElement | null>(null);
const pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
```

- [ ] **Step 3: PiP起動関数を追加**

```tsx
const handleOpenPip = useCallback(async () => {
    if (!pipSupported) return;
    try {
        const dpip = (window as any).documentPictureInPicture;
        const win: Window = await dpip.requestWindow({
            width: 380,
            height: 520,
        });

        // スタイルをPiPウィンドウにコピー
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(s => win.document.head.appendChild(s.cloneNode(true)));

        // ダークテーマclass をコピー
        win.document.documentElement.classList.add(...document.documentElement.classList);
        win.document.body.style.margin = '0';
        win.document.body.style.overflow = 'hidden';
        win.document.body.style.background = 'transparent';

        // Reactマウントポイント
        const container = win.document.createElement('div');
        container.id = 'pip-root';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.position = 'relative';
        win.document.body.appendChild(container);

        setPipWindow(win);
        setPipContainer(container);

        // ウィンドウ閉じられた時のクリーンアップ
        win.addEventListener('pagehide', () => {
            setPipWindow(null);
            setPipContainer(null);
        });
    } catch (e) {
        console.warn('PiP open failed:', e);
    }
}, [pipSupported]);

const handleClosePip = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
    setPipContainer(null);
}, [pipWindow]);
```

- [ ] **Step 4: PiPウィンドウへのReactPortalレンダリング**

Timeline の return 文の末尾（既存の閉じタグの直前）に追加:

```tsx
{/* PiP カンペビュー — 別窓にReactPortalでレンダリング */}
{pipContainer && createPortal(
    <React.Suspense fallback={null}>
        <PipView mode="pip" onClose={handleClosePip} />
    </React.Suspense>,
    pipContainer
)}
```

- [ ] **Step 5: disabled Listボタンを PiP起動ボタンに差し替え**

Timeline.tsx 行1714-1721 の既存コード:

```tsx
<Tooltip content={t('timeline.secret_feature')}>
    <button
        className="p-1 rounded transition-all duration-150 text-app-text-muted cursor-default opacity-40"
        disabled
    >
        <List size={12} />
    </button>
</Tooltip>
```

を以下に差し替え:

```tsx
{pipSupported && (
    <Tooltip content={myMemberId ? t('timeline.pip_open') : t('timeline.pip_open_disabled')}>
        <button
            onClick={pipWindow ? handleClosePip : handleOpenPip}
            disabled={!myMemberId}
            className={clsx(
                "p-1 rounded transition-all duration-150",
                !myMemberId
                    ? "text-app-text-muted cursor-default opacity-40"
                    : pipWindow
                        ? "text-app-blue cursor-pointer hover:bg-app-blue/10"
                        : "text-app-text-muted cursor-pointer hover:bg-app-surface2 hover:text-app-text"
            )}
        >
            <PictureInPicture2 size={12} />
        </button>
    </Tooltip>
)}
```

- [ ] **Step 6: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 7: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: add PiP cue sheet launch button and window management"
```

---

### Task 5: スマホ版 — MobileFAB にカンペ起動ボタン追加

**Files:**
- Modify: `src/components/MobileFAB.tsx`
- Modify: `src/components/Layout.tsx`（スマホフルスクリーンオーバーレイ管理）

- [ ] **Step 1: MobileFAB.tsx に navItem 追加**

import追加:

```tsx
import { PictureInPicture2 } from 'lucide-react';
```

`navItems` 配列の末尾（`search` の後）に追加:

```tsx
{
    key: 'cueSheet',
    label: t('app.fab_cue_sheet'),
    icon: <PictureInPicture2 size={20} />,
    onClick: () => { close(); window.dispatchEvent(new Event('mobile:open-cue-sheet')); },
    accent: false,
    disabled: !myMemberId,
},
```

`myMemberId` を取得するために、MobileFABコンポーネント内に追加:

```tsx
const myMemberId = useMitigationStore(s => s.myMemberId);
```

- [ ] **Step 2: Layout.tsx にスマホ用カンペオーバーレイ state 追加**

import追加:

```tsx
const PipView = React.lazy(() => import('./PipView'));
```

Layout コンポーネント内にstate追加:

```tsx
const [mobileCueSheet, setMobileCueSheet] = useState(false);
```

イベントリスナー追加（既存のuseEffect群の近く）:

```tsx
useEffect(() => {
    const open = () => setMobileCueSheet(true);
    window.addEventListener('mobile:open-cue-sheet', open);
    return () => window.removeEventListener('mobile:open-cue-sheet', open);
}, []);
```

- [ ] **Step 3: Layout.tsx にフルスクリーンオーバーレイを追加**

Layoutの return 文内（他のモーダル群の近く）に追加:

```tsx
{/* スマホ用カンペビュー（フルスクリーン） */}
{mobileCueSheet && (
    <div className="fixed inset-0 z-[9999] bg-app-bg md:hidden">
        <React.Suspense fallback={null}>
            <PipView mode="fullscreen" onClose={() => setMobileCueSheet(false)} />
        </React.Suspense>
    </div>
)}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 全テスト確認**

Run: `npx vitest run`
Expected: 全テストPASS（既存116 + 新規6 = 122テスト）

- [ ] **Step 6: コミット**

```bash
git add src/components/MobileFAB.tsx src/components/Layout.tsx
git commit -m "feat: add mobile cue sheet fullscreen view"
```

---

### Task 6: 最終統合テスト・i18nキー削除・クリーンアップ

**Files:**
- Modify: `src/locales/ja.json` (`secret_feature` キーを `pip_open` 等に置換済みのため削除可能か確認)
- 全体ビルド・テスト

- [ ] **Step 1: `secret_feature` キーの使用箇所確認**

Timeline.tsx で `secret_feature` がまだ使われていないことを grep で確認。Task 4 で差し替え済みなら、i18nキー `secret_feature` は削除してよい。ただし他言語ファイルにも残っていれば一括削除。

- [ ] **Step 2: 最終ビルド確認**

Run: `npm run build`
Expected: ビルド成功、警告のみ（既存のchunk size警告は許容）

- [ ] **Step 3: 全テスト確認**

Run: `npx vitest run`
Expected: 全テストPASS

- [ ] **Step 4: 最終コミット**

```bash
git add -A
git commit -m "feat: PiP cue sheet - cleanup and final integration"
```
