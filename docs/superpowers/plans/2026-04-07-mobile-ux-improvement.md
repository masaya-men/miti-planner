# スマホUX改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ表示を2行カードレイアウト+FABメニューで大幅改善する。PC表示には一切影響を与えない。

**Architecture:** TimelineRow.tsx は一切変更せず、新規 MobileTimelineRow.tsx を作成してTimeline.tsx で条件分岐。FABメニューは MobileFAB.tsx として新規作成し、MobileHeaderから設定ボタンを削除。

**Tech Stack:** React, TypeScript, Tailwind CSS v4, framer-motion, Zustand, Lucide icons, vitest

**設計書:** `docs/superpowers/specs/2026-04-07-mobile-ux-improvement-design.md`

---

## ファイル構成

### 新規作成
| ファイル | 責務 |
|---------|------|
| `src/components/MobileTimelineRow.tsx` | スマホ専用タイムライン行（80px、2行レイアウト） |
| `src/components/MobileFAB.tsx` | 右下FABメニュー（6項目、展開式） |

### 変更
| ファイル | 変更内容 |
|---------|---------|
| `src/components/Timeline.tsx` | isMobile分岐（pixelsPerSecond, レンダリング） |
| `src/components/MobileHeader.tsx` | 右側3ボタン削除 |
| `src/components/SyncButton.tsx` | PC用テキストラベル追加 |
| `src/components/Toast.tsx` | 'info' タイプ追加 |
| `src/components/Layout.tsx` | 同期時showToast呼び出し追加、MobileFABレンダリング |
| `src/locales/ja.json` | 同期トースト・FAB用翻訳キー追加 |
| `src/locales/en.json` | 同上（英語） |
| `src/locales/zh.json` | 同上（中国語） |
| `src/locales/ko.json` | 同上（韓国語） |

### 変更禁止（PC影響ゼロの保証）
- `src/components/TimelineRow.tsx` — **絶対に変更しない**
- `src/components/ConsolidatedHeader.tsx`

---

## Task 1: Toast.tsx に 'info' タイプ追加

**Files:**
- Modify: `src/components/Toast.tsx`

小さく独立した変更から始める。後のタスクで使う基盤。

- [ ] **Step 1: Toast.tsx に 'info' タイプを追加**

```tsx
// src/components/Toast.tsx
// 行6-10: ToastItem の type に 'info' を追加
interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

// 行13: addToastFn の型を更新
let addToastFn: ((message: string, type: 'success' | 'error' | 'info') => void) | null = null;
// 行14: pendingQueue の型を更新
const pendingQueue: { message: string; type: 'success' | 'error' | 'info' }[] = [];

// 行17: showToast の型を更新
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {

// 行29: addToastFn の型を更新
addToastFn = (message: string, type: 'success' | 'error' | 'info') => {

// 行57-60: アイコン表示に info を追加（InfoアイコンをLucideからインポート）
import { CheckCircle, XCircle, Info } from 'lucide-react';

// アイコン描画部分を修正:
{toast.type === 'error'
    ? <XCircle size={15} className="text-red-500 shrink-0" />
    : toast.type === 'info'
    ? <Info size={15} className="text-blue-400 shrink-0" />
    : <CheckCircle size={15} className="text-emerald-500 shrink-0" />
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: ビルド成功（型エラーなし）

- [ ] **Step 3: コミット**

```bash
git add src/components/Toast.tsx
git commit -m "feat: Toast に info タイプ追加"
```

---

## Task 2: i18n — 翻訳キー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: 4言語に翻訳キーを追加**

各ファイルの適切な位置（sync セクション付近）に追加:

```json
// ja.json
"sync_push_success": "クラウドに保存しました",
"sync_push_error": "同期できませんでした",
"sync_pull_success": "最新データを取得しました",
"sync_pull_error": "データ取得に失敗しました",
"sync_saved": "保存済み",
"sync_pending": "同期する",
"sync_syncing": "同期中...",
"sync_error_label": "エラー",
"fab_phase": "フェーズ",
"fab_label": "ラベル",
"fab_search": "攻撃名検索",
"fab_sync": "同期",
"fab_language": "言語",
"fab_theme": "テーマ",
"mobile_same_time": "〃",
"mobile_lethal": "致死"
```

```json
// en.json
"sync_push_success": "Saved to cloud",
"sync_push_error": "Sync failed",
"sync_pull_success": "Latest data loaded",
"sync_pull_error": "Failed to load data",
"sync_saved": "Saved",
"sync_pending": "Sync",
"sync_syncing": "Syncing...",
"sync_error_label": "Error",
"fab_phase": "Phase",
"fab_label": "Label",
"fab_search": "Search",
"fab_sync": "Sync",
"fab_language": "Language",
"fab_theme": "Theme",
"mobile_same_time": "〃",
"mobile_lethal": "Lethal"
```

```json
// zh.json
"sync_push_success": "已保存到云端",
"sync_push_error": "同步失败",
"sync_pull_success": "已获取最新数据",
"sync_pull_error": "获取数据失败",
"sync_saved": "已保存",
"sync_pending": "同步",
"sync_syncing": "同步中...",
"sync_error_label": "错误",
"fab_phase": "阶段",
"fab_label": "标签",
"fab_search": "搜索技能",
"fab_sync": "同步",
"fab_language": "语言",
"fab_theme": "主题",
"mobile_same_time": "〃",
"mobile_lethal": "致死"
```

```json
// ko.json
"sync_push_success": "클라우드에 저장했습니다",
"sync_push_error": "동기화 실패",
"sync_pull_success": "최신 데이터를 가져왔습니다",
"sync_pull_error": "데이터 가져오기 실패",
"sync_saved": "저장됨",
"sync_pending": "동기화",
"sync_syncing": "동기화 중...",
"sync_error_label": "오류",
"fab_phase": "페이즈",
"fab_label": "라벨",
"fab_search": "기술 검색",
"fab_sync": "동기화",
"fab_language": "언어",
"fab_theme": "테마",
"mobile_same_time": "〃",
"mobile_lethal": "치사"
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: スマホUX改善用の翻訳キー追加（4言語）"
```

---

## Task 3: MobileTimelineRow.tsx — 新規作成

**Files:**
- Create: `src/components/MobileTimelineRow.tsx`

TimelineRow.tsx と同じ props を受け取るが、80px高の2行レイアウトで描画する。TimelineRow.tsx は一切触らない。

- [ ] **Step 1: MobileTimelineRow.tsx を作成**

```tsx
// src/components/MobileTimelineRow.tsx
import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { getPhaseName } from '../types';
import type { TimelineEvent, PartyMember, AppliedMitigation, DamageInfo } from '../types';
import { JOBS } from '../data/jobs';

interface MobileTimelineRowProps {
    time: number;
    top: number;
    damages: (DamageInfo | null)[];
    events: TimelineEvent[];
    partyMembers: PartyMember[];
    activeMitigations: AppliedMitigation[];
    onMobileDamageClick?: (time: number, e: React.MouseEvent) => void;
    phaseColumnCollapsed?: boolean;
    hasPhases?: boolean;
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    previewEndTime?: number | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
    // 2イベント分離: eventIndex で何番目のイベントか指定（undefinedなら全イベント表示）
    eventIndex?: number;
    isSecondEvent?: boolean;
}

/** スマホ専用タイムライン行（80px、2行カードレイアウト） */
export const MobileTimelineRow: React.FC<MobileTimelineRowProps> = React.memo(({
    time, top, damages, events, partyMembers, activeMitigations,
    onMobileDamageClick, phaseColumnCollapsed, hasPhases,
    timelineSelectMode, labelSelectMode, previewEndTime,
    onTimelineSelect, onTimelineSelectHover,
    eventIndex, isSecondEvent,
}) => {
    const { t } = useTranslation();
    const { contentLanguage } = useThemeStore();
    const myJobHighlight = useMitigationStore(s => s.myJobHighlight);
    const myMemberId = useMitigationStore(s => s.myMemberId);

    // eventIndex が指定されている場合、そのイベントだけ表示
    const displayEvents = eventIndex !== undefined ? [events[eventIndex]] : events;
    const displayDamages = eventIndex !== undefined ? [damages[eventIndex]] : damages;
    const event = displayEvents[0];
    const damage = displayDamages[0];

    const getEventName = (ev: TimelineEvent) =>
        ev.name ? getPhaseName(ev.name, contentLanguage) : ev.name;

    const formatDmg = (val: number) => {
        if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return String(val);
    };

    const formattedTime = (() => {
        if (isSecondEvent) return t('mobile_same_time', '〃');
        const abs = Math.abs(time);
        const mm = Math.floor(abs / 60);
        const ss = (abs % 60).toString().padStart(2, '0');
        const display = `${mm}:${ss}`;
        if (time < 0 && time > -60) return `-0:${ss}`;
        if (time < 0) return `-${display}`;
        return display;
    })();

    const handleTap = (e: React.MouseEvent) => {
        if (timelineSelectMode || labelSelectMode) {
            onTimelineSelect?.(time);
            e.stopPropagation();
            return;
        }
        if (onMobileDamageClick && event) {
            onMobileDamageClick(time, e);
        }
    };

    // 致死判定
    const isLethal = (() => {
        if (!event || !damage || damage.unmitigated <= 0) return false;
        let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
        if (event.target === 'MT' || event.target === 'ST') {
            maxHp = partyMembers.find(m => m.id === event.target)?.stats.hp || 1;
        }
        return damage.mitigated >= maxHp;
    })();

    const isHighlighted = timelineSelectMode
        && previewEndTime !== null
        && time >= timelineSelectMode.startTime
        && time <= (previewEndTime ?? 0);

    const isLabelHighlighted = labelSelectMode
        && previewEndTime !== null
        && time >= labelSelectMode.startTime
        && time <= (previewEndTime ?? 0);

    // 軽減スキルアイコン
    const mitigationIcons = activeMitigations
        .filter(m => m.time === time || eventIndex === undefined)
        .map(m => {
            const member = partyMembers.find(p => p.id === m.memberId);
            const job = member ? JOBS.find(j => j.id === member.jobId) : null;
            const skill = job?.skills.find(s => s.id === m.skillId);
            return skill ? { id: m.id, icon: skill.icon, name: getPhaseName(skill.name, contentLanguage) } : null;
        })
        .filter(Boolean);

    // 対象バッジの色
    const targetBadgeStyle = (target: string) => {
        if (target === 'MT') return 'bg-cyan-400/12 text-cyan-400';
        if (target === 'ST') return 'bg-amber-400/12 text-amber-400';
        return 'bg-app-blue/12 text-app-blue';
    };

    return (
        <div
            data-time-row={time}
            className={clsx(
                "absolute left-0 w-full flex h-[80px] transition-colors duration-75",
                (timelineSelectMode || labelSelectMode) && "cursor-pointer",
                isSecondEvent && "bg-app-text/[0.015]",
            )}
            style={{ top: `${top}px` }}
            onClick={handleTap}
            onMouseEnter={() => {
                if (timelineSelectMode || labelSelectMode) {
                    onTimelineSelectHover?.(time);
                }
            }}
        >
            {/* フェーズ/ラベル列 — 左端24px、既存ロジック踏襲 */}
            {!phaseColumnCollapsed && (
                <div
                    className={clsx(
                        "w-[24px] min-w-[24px] border-r border-app-border/40 h-full flex items-center justify-center",
                        (isHighlighted || isLabelHighlighted) && "bg-app-blue/10"
                    )}
                />
            )}

            {/* メインカード領域 */}
            <div className="flex-1 flex flex-col justify-center px-3 py-1.5 border-b border-app-border/40 active:bg-app-text/5 transition-colors duration-150">
                {event ? (
                    <>
                        {/* 上段: 時間 + 種別 + 攻撃名 + 対象 */}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-app-text/50 text-[15px] font-semibold font-mono min-w-[38px] tracking-tight">
                                {formattedTime}
                            </span>
                            {event.damageType === 'magical' && (
                                <img src="/icons/type_magic.png" className="w-[15px] h-[15px] rounded flex-shrink-0" alt="" />
                            )}
                            {event.damageType === 'physical' && (
                                <img src="/icons/type_phys.png" className="w-[15px] h-[15px] rounded flex-shrink-0" alt="" />
                            )}
                            {event.damageType === 'unavoidable' && (
                                <img src="/icons/type_dark.png" className="w-[15px] h-[15px] rounded flex-shrink-0" alt="" />
                            )}
                            <span className="text-app-text text-[15px] font-semibold flex-1 truncate tracking-wide">
                                {getEventName(event)}
                            </span>
                            <span className={clsx(
                                "text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0",
                                targetBadgeStyle(event.target)
                            )}>
                                {event.target}
                            </span>
                        </div>

                        {/* 下段: ダメージ + 軽減% + スキルアイコン */}
                        <div className="flex items-center gap-1.5">
                            {damage && damage.unmitigated > 0 ? (
                                <>
                                    <span className="min-w-[38px] text-app-text/30 text-[12px] font-mono tracking-tight">
                                        {formatDmg(damage.unmitigated)}
                                    </span>
                                    <span className="text-app-text/20 text-[11px]">→</span>
                                    <span className={clsx(
                                        "text-[15px] font-extrabold font-mono tracking-tight transition-colors duration-300",
                                        isLethal ? "text-red-400" : "text-green-400"
                                    )}>
                                        {formatDmg(damage.mitigated)}
                                    </span>
                                    {damage.mitigationPercent > 0 && (
                                        <span className="text-app-text/25 text-[10px] font-medium">
                                            ▼{damage.mitigationPercent}%
                                        </span>
                                    )}
                                    {isLethal && (
                                        <span className="text-red-400 text-[9px] ml-auto bg-red-400/10 px-2 py-0.5 rounded-md font-semibold">
                                            {t('mobile_lethal', '致死')}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="min-w-[38px]" />
                            )}

                            {/* 軽減スキルアイコン */}
                            {!isLethal && mitigationIcons.length > 0 && (
                                <div className="flex gap-1 ml-auto">
                                    {mitigationIcons.map((m, i) => m && (
                                        <img
                                            key={m.id || i}
                                            src={m.icon}
                                            alt={m.name}
                                            className="w-[22px] h-[22px] rounded-md bg-app-text/5"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* 空行: 時間のみ表示 */
                    <div className="flex items-center opacity-40">
                        <span className="text-app-text-muted text-[15px] font-semibold font-mono">
                            {formattedTime}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
});
MobileTimelineRow.displayName = 'MobileTimelineRow';
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: ビルド成功（未使用importエラーがあれば修正）。型が合わない場合はimport元を確認して修正。

- [ ] **Step 3: コミット**

```bash
git add src/components/MobileTimelineRow.tsx
git commit -m "feat: MobileTimelineRow 新規作成（スマホ専用2行カード）"
```

---

## Task 4: Timeline.tsx — isMobile 分岐

**Files:**
- Modify: `src/components/Timeline.tsx`

TimelineRow.tsx は一切触らない。Timeline.tsx に isMobile 分岐を追加。

- [ ] **Step 1: MobileTimelineRow の import を追加**

Timeline.tsx の先頭 import セクションに追加:
```tsx
import { MobileTimelineRow } from './MobileTimelineRow';
```

- [ ] **Step 2: pixelsPerSecond を isMobile 分岐に変更**

行638 の `const pixelsPerSecond = 50;` を変更:
```tsx
// 行638: スマホは80px、PCは50px（PC側の値は変更しない）
const isMobileTimeline = typeof window !== 'undefined' && window.innerWidth < 768;
const pixelsPerSecond = isMobileTimeline ? 80 : 50;
```

- [ ] **Step 3: レンダリング部分で条件分岐**

行2000-2038 の `<TimelineRow>` レンダリングを条件分岐:

```tsx
// 行1998の timeToYMap.set(time, currentY); の後に:

if (isMobileTimeline) {
    // スマホ: 2イベント時は別カードに分離
    if (rowEvents.length >= 2) {
        // 1つ目のイベント
        renderItems.push(
            <MobileTimelineRow
                key={`${time}-0`}
                time={time}
                top={currentY}
                damages={rowDamages}
                events={rowEvents}
                partyMembers={sortedPartyMembers}
                activeMitigations={activeMitigationsForRow}
                onMobileDamageClick={handleMobileDamageClick}
                phaseColumnCollapsed={phaseColumnCollapsed}
                hasPhases={phases.length > 0}
                timelineSelectMode={timelineSelectMode}
                labelSelectMode={labelSelectMode}
                previewEndTime={previewEndTime}
                onTimelineSelect={(time) => {
                    if (labelSelectMode) {
                        updateLabelEndTime(labelSelectMode.labelId, time);
                        setLabelSelectMode(null);
                        setPreviewEndTime(null);
                        return;
                    }
                    if (timelineSelectMode) {
                        updatePhaseEndTime(timelineSelectMode.phaseId, time);
                        setTimelineSelectMode(null);
                        setPreviewEndTime(null);
                    }
                }}
                onTimelineSelectHover={(time) => {
                    if (timelineSelectMode || labelSelectMode) setPreviewEndTime(time);
                }}
                eventIndex={0}
            />
        );
        currentY += pixelsPerSecond;
        // 2つ目のイベント
        renderItems.push(
            <MobileTimelineRow
                key={`${time}-1`}
                time={time}
                top={currentY}
                damages={rowDamages}
                events={rowEvents}
                partyMembers={sortedPartyMembers}
                activeMitigations={activeMitigationsForRow}
                onMobileDamageClick={handleMobileDamageClick}
                phaseColumnCollapsed={phaseColumnCollapsed}
                hasPhases={phases.length > 0}
                timelineSelectMode={timelineSelectMode}
                labelSelectMode={labelSelectMode}
                previewEndTime={previewEndTime}
                onTimelineSelect={(time) => {
                    if (labelSelectMode) {
                        updateLabelEndTime(labelSelectMode.labelId, time);
                        setLabelSelectMode(null);
                        setPreviewEndTime(null);
                        return;
                    }
                    if (timelineSelectMode) {
                        updatePhaseEndTime(timelineSelectMode.phaseId, time);
                        setTimelineSelectMode(null);
                        setPreviewEndTime(null);
                    }
                }}
                onTimelineSelectHover={(time) => {
                    if (timelineSelectMode || labelSelectMode) setPreviewEndTime(time);
                }}
                eventIndex={1}
                isSecondEvent
            />
        );
    } else {
        // 1イベント以下: 通常カード
        renderItems.push(
            <MobileTimelineRow
                key={time}
                time={time}
                top={currentY}
                damages={rowDamages}
                events={rowEvents}
                partyMembers={sortedPartyMembers}
                activeMitigations={activeMitigationsForRow}
                onMobileDamageClick={handleMobileDamageClick}
                phaseColumnCollapsed={phaseColumnCollapsed}
                hasPhases={phases.length > 0}
                timelineSelectMode={timelineSelectMode}
                labelSelectMode={labelSelectMode}
                previewEndTime={previewEndTime}
                onTimelineSelect={(time) => {
                    if (labelSelectMode) {
                        updateLabelEndTime(labelSelectMode.labelId, time);
                        setLabelSelectMode(null);
                        setPreviewEndTime(null);
                        return;
                    }
                    if (timelineSelectMode) {
                        updatePhaseEndTime(timelineSelectMode.phaseId, time);
                        setTimelineSelectMode(null);
                        setPreviewEndTime(null);
                    }
                }}
                onTimelineSelectHover={(time) => {
                    if (timelineSelectMode || labelSelectMode) setPreviewEndTime(time);
                }}
            />
        );
    }
} else {
    // PC: 既存の TimelineRow を完全にそのまま使用
    renderItems.push(
        <TimelineRow
            key={time}
            // ... 既存の props をそのまま（行2001-2038の内容を変更せずコピー）
        />
    );
}

currentY += pixelsPerSecond;
```

**重要:** PC側の `<TimelineRow>` の props は既存コードから一文字も変更しないこと。`else` ブロック内に既存の行2001-2038をそのまま置く。2イベント分離時は1つ目のイベント後に `currentY += pixelsPerSecond;` を追加し、最後の共通 `currentY += pixelsPerSecond;` もそのまま残す。

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 既存テスト実行**

Run: `npx vitest run`
Expected: 全テスト PASS（TimelineRow.tsx 未変更のため影響なし）

- [ ] **Step 6: ブラウザ確認**

Run: `npm run dev`
- PC幅（≥768px）で開く → 従来と全く同じ表示であることを確認
- スマホ幅（<768px、DevToolsで375px）で開く → 80px高の2行カードが表示されることを確認
- 2イベント行が別カードに分離されていることを確認

- [ ] **Step 7: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: Timeline.tsx にスマホ用 MobileTimelineRow 分岐追加"
```

---

## Task 5: MobileFAB.tsx — FABメニュー新規作成

**Files:**
- Create: `src/components/MobileFAB.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: MobileFAB.tsx を作成**

```tsx
// src/components/MobileFAB.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, X, List, Tag, Search, Cloud, Globe, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';
import { useThemeStore } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';

interface MobileFABProps {
    onToggleTheme: () => void;
    theme: string;
    onPhaseJump?: () => void;
    onLabelJump?: () => void;
    onMechanicSearch?: () => void;
}

const fabItems = [
    { id: 'phase', icon: List, labelKey: 'fab_phase', group: 'nav' },
    { id: 'label', icon: Tag, labelKey: 'fab_label', group: 'nav' },
    { id: 'search', icon: Search, labelKey: 'fab_search', group: 'nav' },
    { id: 'sync', icon: Cloud, labelKey: 'fab_sync', group: 'settings', accent: true },
    { id: 'language', icon: Globe, labelKey: 'fab_language', group: 'settings' },
    { id: 'theme', icon: Sun, labelKey: 'fab_theme', group: 'settings' },
] as const;

export const MobileFAB: React.FC<MobileFABProps> = ({
    onToggleTheme, theme, onPhaseJump, onLabelJump, onMechanicSearch,
}) => {
    const { t, i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const user = useAuthStore(s => s.user);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);
    const currentPlanId = usePlanStore(s => s.currentPlanId);

    const handleItemClick = (id: string) => {
        setIsOpen(false);
        switch (id) {
            case 'phase': onPhaseJump?.(); break;
            case 'label': onLabelJump?.(); break;
            case 'search': onMechanicSearch?.(); break;
            case 'sync': {
                if (!user || !currentPlanId) return;
                const planStore = usePlanStore.getState();
                const snapshot = useMitigationStore.getState().getSnapshot();
                planStore.updatePlan(currentPlanId, { data: snapshot });
                planStore.manualSync(user.uid, profileDisplayName || 'User');
                break;
            }
            case 'language': {
                // 言語サイクル: ja → en → zh → ko → ja
                const langs = ['ja', 'en', 'zh', 'ko'];
                const current = i18n.language;
                const idx = langs.indexOf(current);
                const next = langs[(idx + 1) % langs.length];
                i18n.changeLanguage(next);
                break;
            }
            case 'theme': onToggleTheme(); break;
        }
    };

    const ThemeIcon = theme === 'dark' ? Sun : Moon;

    return (
        <>
            {/* 背景オーバーレイ */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed inset-0 bg-black/50 z-[9000] md:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* FABコンテナ */}
            <div className="fixed bottom-5 right-5 z-[9001] md:hidden flex flex-col items-end gap-2">
                {/* メニュー項目 */}
                <AnimatePresence>
                    {isOpen && fabItems.map((item, index) => {
                        const Icon = item.id === 'theme' ? ThemeIcon : item.icon;
                        const isNavGroup = item.group === 'nav';
                        const showDivider = index === 2; // nav と settings の間

                        return (
                            <React.Fragment key={item.id}>
                                {showDivider && (
                                    <motion.div
                                        className="w-[44px] h-px bg-app-border/40 self-end"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                    />
                                )}
                                <motion.div
                                    className="flex items-center gap-2"
                                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 400,
                                        damping: 25,
                                        delay: (fabItems.length - 1 - index) * 0.03,
                                    }}
                                >
                                    <span className="text-app-text/80 text-[12px] font-medium bg-black/80 px-2.5 py-1 rounded-lg">
                                        {t(item.labelKey)}
                                    </span>
                                    <button
                                        onClick={() => handleItemClick(item.id)}
                                        className={clsx(
                                            "w-[44px] h-[44px] rounded-[14px] flex items-center justify-center border transition-colors active:scale-95",
                                            item.accent
                                                ? "bg-app-blue/12 border-app-blue/20 text-app-blue"
                                                : "bg-app-text/6 border-app-text/10 text-app-text/60"
                                        )}
                                    >
                                        <Icon size={18} />
                                    </button>
                                </motion.div>
                            </React.Fragment>
                        );
                    })}
                </AnimatePresence>

                {/* FABメインボタン */}
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    className={clsx(
                        "w-[52px] h-[52px] rounded-2xl flex items-center justify-center",
                        "bg-app-text/12 border border-app-text/15 shadow-lg shadow-black/40",
                        "active:scale-95 transition-transform"
                    )}
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                    {isOpen
                        ? <X size={22} className="text-app-text" />
                        : <MoreHorizontal size={22} className="text-app-text" />
                    }
                </motion.button>
            </div>
        </>
    );
};
```

- [ ] **Step 2: Layout.tsx に MobileFAB を追加**

Layout.tsx で MobileFAB をレンダリング。Timeline のジャンプ機能へのコールバックは後でTimeline.tsxから受け取る形にする（一旦undefinedでOK）。

```tsx
// Layout.tsx: import追加
import { MobileFAB } from './MobileFAB';

// Layout.tsx: return内、</main>の直前あたりに追加（md:hidden なのでPC表示に影響なし）
{isMobile && (
    <MobileFAB
        onToggleTheme={toggleTheme}
        theme={theme}
    />
)}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: ブラウザ確認**

Run: `npm run dev`
- スマホ幅で右下にFABボタンが表示されること
- タップで6項目が展開されること
- テーマ切替、言語切替が動作すること
- PC幅では非表示であること

- [ ] **Step 5: コミット**

```bash
git add src/components/MobileFAB.tsx src/components/Layout.tsx
git commit -m "feat: MobileFAB 新規作成（6項目展開式メニュー）"
```

---

## Task 6: MobileHeader — 右側ボタン削除

**Files:**
- Modify: `src/components/MobileHeader.tsx`

- [ ] **Step 1: 右側の3ボタンを削除**

`src/components/MobileHeader.tsx` の行146-156を変更:

```tsx
// 変更前:
{/* 右: テーマ + 同期 + 言語 */}
<div className="flex items-center gap-1 shrink-0">
    <button
        data-tutorial-always
        onClick={onToggleTheme}
        className="p-1 w-7 h-7 rounded-md text-app-text hover:bg-app-surface2 flex items-center justify-center cursor-pointer"
    >
        {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
    </button>
    <SyncButton size={14} className="w-7 h-7" />
    <LanguageSwitcher />
</div>

// 変更後: 空のスペーサー（ヘッダーの左右バランス維持）
<div className="w-8 shrink-0" />
```

不要になった import も削除: `Sun`, `Moon`, `SyncButton`, `LanguageSwitcher`（他で使われていないか確認してから）。

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: ビルド成功（未使用import警告がないこと）

- [ ] **Step 3: コミット**

```bash
git add src/components/MobileHeader.tsx
git commit -m "feat: MobileHeader 右側ボタン削除（FABに移行）"
```

---

## Task 7: SyncButton — PC用テキストラベル追加

**Files:**
- Modify: `src/components/SyncButton.tsx`

- [ ] **Step 1: テキストラベルを追加**

```tsx
// src/components/SyncButton.tsx 全体を書き換え
import React from 'react';
import { CloudCheck, CloudUpload, CloudAlert, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { usePlanStore } from '../store/usePlanStore';
import { useMitigationStore } from '../store/useMitigationStore';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';

export const SyncButton: React.FC<{ size?: number; className?: string; showLabel?: boolean }> = React.memo(({ size = 16, className, showLabel = false }) => {
    const { t } = useTranslation();
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const cloudStatus = usePlanStore(s => s._cloudStatus);
    const user = useAuthStore(s => s.user);
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);

    if (!currentPlanId || !user) return null;

    const handleSync = () => {
        const planStore = usePlanStore.getState();
        if (planStore.currentPlanId) {
            const snapshot = useMitigationStore.getState().getSnapshot();
            planStore.updatePlan(planStore.currentPlanId, { data: snapshot });
        }
        planStore.manualSync(user.uid, profileDisplayName || 'User');
    };

    let Icon = CloudCheck;
    let iconClass = 'text-blue-400';
    let animate = '';
    let label = t('sync_saved', '保存済み');
    let labelClass = 'text-app-text-muted';

    if (cloudStatus === 'syncing') {
        Icon = CloudUpload;
        iconClass = 'text-app-text/40';
        animate = 'animate-pulse';
        label = t('sync_syncing', '同期中...');
    } else if (cloudStatus === 'error') {
        Icon = CloudAlert;
        iconClass = 'text-red-400';
        label = t('sync_error_label', 'エラー');
        labelClass = 'text-red-400';
    } else if (cloudStatus === 'pending') {
        Icon = RefreshCw;
        iconClass = 'text-app-text/40';
        label = t('sync_pending', '同期する');
    }

    return (
        <button
            onClick={handleSync}
            disabled={cloudStatus === 'syncing'}
            className={clsx(
                "flex items-center justify-center gap-1.5 rounded transition-all duration-200 hover:bg-app-text/10 active:scale-90 disabled:pointer-events-none",
                iconClass,
                className,
            )}
            style={{ flexShrink: 0 }}
        >
            <Icon size={size} className={animate} />
            {showLabel && (
                <span className={clsx("text-app-sm font-medium hidden md:inline", labelClass)}>
                    {label}
                </span>
            )}
        </button>
    );
});
SyncButton.displayName = 'SyncButton';
```

- [ ] **Step 2: ConsolidatedHeader.tsx で showLabel を渡す**

ConsolidatedHeader.tsx 内の `<SyncButton>` 呼び出しに `showLabel` を追加:
```tsx
<SyncButton size={16} className="..." showLabel />
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: コミット**

```bash
git add src/components/SyncButton.tsx src/components/ConsolidatedHeader.tsx
git commit -m "feat: SyncButton にPC用テキストラベル追加"
```

---

## Task 8: 同期トースト通知

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Layout.tsx の同期処理に showToast 呼び出しを追加**

Layout.tsx の同期関連コードを確認し、PUSH成功/失敗、PULL成功/失敗の各箇所に showToast を追加する。

```tsx
// Layout.tsx: import追加
import { showToast } from './Toast';

// 同期PUSH成功時（manualSync の .then() 内、または cloudStatus が 'synced' に変わった後）
showToast(t('sync_push_success'), 'success');

// 同期PUSH失敗時
showToast(t('sync_push_error'), 'error');

// タブ復帰PULL成功時（loadSnapshot の .then() 内）
showToast(t('sync_pull_success'), 'info');

// タブ復帰PULL失敗時
showToast(t('sync_pull_error'), 'error');
```

具体的な挿入箇所は Layout.tsx の同期フロー（visibilitychange ハンドラ、manualSync コールバック）を読んで特定する。自動同期（5分クールダウン）には showToast を追加しない。

- [ ] **Step 2: Toast.tsx の bottom 位置を FAB と被らないよう調整**

```tsx
// Toast.tsx: bottom-6 → bottom-24（FABの上に表示）
<div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-2 pointer-events-none">
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 4: コミット**

```bash
git add src/components/Layout.tsx src/components/Toast.tsx
git commit -m "feat: 同期フィードバックのトースト通知追加"
```

---

## Task 9: iOSズーム防止 + 最終確認

**Files:**
- Potentially modify: 複数の input/select を含むコンポーネント

- [ ] **Step 1: モバイルの input/select を監査**

以下のコマンドで font-size が 16px 未満の input/select を検索:
```bash
grep -rn "text-app-sm\|text-app-base\|text-app-xs\|text-\[10px\]\|text-\[11px\]\|text-\[12px\]\|text-\[13px\]\|text-\[14px\]\|text-\[15px\]" src/components/ | grep -i "input\|select\|textarea"
```

見つかったモバイル表示のinput/select/textareaに `text-[16px]` を追加（`md:text-[元のサイズ]` でPC表示は維持）。

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 3: 全テスト実行**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 4: 最終ブラウザ確認**

Run: `npm run dev`
確認項目:
- PC幅: TimelineRow が従来と完全に同じ表示・動作
- PC幅: SyncButton にテキストラベルが表示
- スマホ幅: MobileTimelineRow の2行カード表示
- スマホ幅: 2イベント行が分離
- スマホ幅: FABメニューの展開・各機能の動作
- スマホ幅: トースト通知（手動同期時）
- スマホ幅: input フォーカスでズームしない

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: iOSズーム防止 + スマホUX改善最終調整"
```

---

## Task 10: TODO.md 更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: TODO.md を更新**

「スマホUX改善」の完了タスクにチェックを入れ、「現在の状態」セクションを更新。

- [ ] **Step 2: コミット + プッシュ**

```bash
git add docs/TODO.md
git commit -m "docs: スマホUX改善タスク完了を反映"
git push
```
