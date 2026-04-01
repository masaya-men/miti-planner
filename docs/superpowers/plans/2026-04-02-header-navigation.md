# 表ヘッダーナビゲーション機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムライン表のPhase/Time/Mechanic列ヘッダーをクリック可能にし、フェーズジャンプ・時刻ジャンプ・攻撃名検索ジャンプの3機能を提供する。

**Architecture:** 3つの独立したドロップダウンコンポーネントを新規作成し、Timeline.tsxのヘッダー部分に組み込む。既存のAASettingsPopoverパターン（createPortal + useEscapeClose + クリック外閉じ）を踏襲。フェーズ列折りたたみはuseState + ローカルストレージで永続化。

**Tech Stack:** React, TypeScript, Tailwind CSS, react-i18next, Zustand（既存store参照のみ）, createPortal, lucide-react

**設計書:** `docs/superpowers/specs/2026-04-02-header-navigation-design.md`

---

## ファイル構成

| ファイル | 操作 | 責務 |
|---------|------|------|
| `src/components/HeaderPhaseDropdown.tsx` | 新規 | フェーズ選択ドロップダウン + 折りたたみトグル |
| `src/components/HeaderTimeInput.tsx` | 新規 | 時間入力ジャンプ |
| `src/components/HeaderMechanicSearch.tsx` | 新規 | 検索付き2段階攻撃名ドロップダウン |
| `src/components/Timeline.tsx` | 修正 | ヘッダー部分にコンポーネント組み込み + 折りたたみ状態管理 |
| `src/components/TimelineRow.tsx` | 修正 | フェーズ列折りたたみ対応 |
| `src/locales/ja.json` | 修正 | 翻訳キー追加 |
| `src/locales/en.json` | 修正 | 翻訳キー追加 |

---

## Task 1: i18n翻訳キー追加

**Files:**
- Modify: `src/locales/ja.json:270-290`
- Modify: `src/locales/en.json` (対応箇所)

- [ ] **Step 1: ja.jsonにtimeline.nav_*キーを追加**

`src/locales/ja.json` の `"timeline"` オブジェクト内、`"end_phase"` の前（行289付近）に以下を追加:

```json
"nav_phase_jump": "フェーズにジャンプ",
"nav_phase_collapse": "フェーズ列を非表示",
"nav_phase_expand": "フェーズ列を表示",
"nav_time_placeholder": "秒数 or 分:秒",
"nav_time_jump": "時間にジャンプ",
"nav_time_invalid": "無効な時間です",
"nav_mechanic_search": "攻撃名を検索...",
"nav_mechanic_jump": "攻撃にジャンプ",
"nav_mechanic_count": "×{{count}}",
"nav_no_phases": "フェーズなし",
"nav_no_results": "該当なし",
```

- [ ] **Step 2: en.jsonに対応する英語キーを追加**

```json
"nav_phase_jump": "Jump to phase",
"nav_phase_collapse": "Hide phase column",
"nav_phase_expand": "Show phase column",
"nav_time_placeholder": "sec or min:sec",
"nav_time_jump": "Jump to time",
"nav_time_invalid": "Invalid time",
"nav_mechanic_search": "Search mechanics...",
"nav_mechanic_jump": "Jump to mechanic",
"nav_mechanic_count": "×{{count}}",
"nav_no_phases": "No phases",
"nav_no_results": "No results",
```

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat: ヘッダーナビゲーション用i18nキーを追加"
```

---

## Task 2: HeaderPhaseDropdown コンポーネント

**Files:**
- Create: `src/components/HeaderPhaseDropdown.tsx`

- [ ] **Step 1: HeaderPhaseDropdownコンポーネントを作成**

```tsx
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import type { Phase } from '../types';

interface HeaderPhaseDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    onOpen: () => void;
    phases: Phase[];
    onJump: (time: number) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    triggerRef: React.RefObject<HTMLElement | null>;
}

export const HeaderPhaseDropdown: React.FC<HeaderPhaseDropdownProps> = ({
    isOpen, onClose, onOpen, phases, onJump, isCollapsed, onToggleCollapse, triggerRef
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    useEscapeClose(isOpen, onClose);

    // クリック外閉じ
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                if (triggerRef?.current && triggerRef.current.contains(event.target as Node)) return;
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    // 位置計算
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isPositioned, setIsPositioned] = useState(false);

    useLayoutEffect(() => {
        if (isOpen && triggerRef?.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left });
            setIsPositioned(true);
        } else if (!isOpen) {
            setIsPositioned(false);
        }
    }, [isOpen, triggerRef]);

    if (!isOpen) return null;

    const handlePhaseClick = (phaseIndex: number) => {
        const startTime = phaseIndex === 0 ? 0 : phases[phaseIndex - 1].endTime;
        onJump(startTime);
        onClose();
    };

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed w-[200px] glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
                !isPositioned ? "opacity-0" : "opacity-100"
            )}
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                <span className="text-xs font-black text-app-text uppercase tracking-wider">
                    {t('timeline.nav_phase_jump')}
                </span>
                <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                    <X size={14} />
                </button>
            </div>

            {/* フェーズリスト */}
            <div className="max-h-[240px] overflow-y-auto">
                {phases.length === 0 ? (
                    <div className="px-3 py-4 text-center text-app-text-muted text-xs">
                        {t('timeline.nav_no_phases')}
                    </div>
                ) : (
                    phases.map((phase, index) => (
                        <button
                            key={phase.id}
                            onClick={() => handlePhaseClick(index)}
                            className="w-full px-3 py-2.5 text-left text-sm text-app-text hover:bg-glass-hover border-b border-glass-border last:border-b-0 cursor-pointer transition-colors"
                        >
                            {phase.name.split('\n').join(' ')}
                        </button>
                    ))
                )}
            </div>

            {/* 折りたたみトグル */}
            <div className="border-t border-glass-border">
                <button
                    onClick={() => { onToggleCollapse(); onClose(); }}
                    className="w-full px-3 py-2.5 text-left text-xs text-app-text-muted hover:bg-glass-hover cursor-pointer transition-colors flex items-center gap-2"
                >
                    {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                    {isCollapsed ? t('timeline.nav_phase_expand') : t('timeline.nav_phase_collapse')}
                </button>
            </div>
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/HeaderPhaseDropdown.tsx
git commit -m "feat: HeaderPhaseDropdown コンポーネントを追加"
```

---

## Task 3: HeaderTimeInput コンポーネント

**Files:**
- Create: `src/components/HeaderTimeInput.tsx`

- [ ] **Step 1: HeaderTimeInputコンポーネントを作成**

```tsx
import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface HeaderTimeInputProps {
    isOpen: boolean;
    onClose: () => void;
    onJump: (time: number) => void;
    triggerRef: React.RefObject<HTMLElement | null>;
    maxTime: number; // タイムラインの最大時刻（秒）
}

/** "2:30" → 150, "120" → 120, 無効 → null */
function parseTimeInput(input: string): number | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.includes(':')) {
        const parts = trimmed.split(':');
        if (parts.length !== 2) return null;
        const min = parseInt(parts[0], 10);
        const sec = parseInt(parts[1], 10);
        if (isNaN(min) || isNaN(sec) || min < 0 || sec < 0 || sec >= 60) return null;
        return min * 60 + sec;
    }

    const seconds = parseInt(trimmed, 10);
    if (isNaN(seconds) || seconds < 0) return null;
    return seconds;
}

export const HeaderTimeInput: React.FC<HeaderTimeInputProps> = ({
    isOpen, onClose, onJump, triggerRef, maxTime
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();
    const [value, setValue] = useState('');
    const [error, setError] = useState(false);
    useEscapeClose(isOpen, onClose);

    // オートフォーカス
    useEffect(() => {
        if (isOpen) {
            setValue('');
            setError(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // クリック外閉じ
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                if (triggerRef?.current && triggerRef.current.contains(event.target as Node)) return;
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    // 位置計算
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isPositioned, setIsPositioned] = useState(false);

    useLayoutEffect(() => {
        if (isOpen && triggerRef?.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left });
            setIsPositioned(true);
        } else if (!isOpen) {
            setIsPositioned(false);
        }
    }, [isOpen, triggerRef]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const time = parseTimeInput(value);
        if (time === null || time > maxTime) {
            setError(true);
            return;
        }
        onJump(time);
        onClose();
    };

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed w-[200px] glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
                !isPositioned ? "opacity-0" : "opacity-100"
            )}
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
            <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                <span className="text-xs font-black text-app-text uppercase tracking-wider">
                    {t('timeline.nav_time_jump')}
                </span>
                <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                    <X size={14} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="p-3">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(false); }}
                    placeholder={t('timeline.nav_time_placeholder')}
                    className={clsx(
                        "w-full px-3 py-2 rounded-md bg-app-bg border text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1",
                        error ? "border-red-500 focus:ring-red-500" : "border-app-border focus:ring-app-text"
                    )}
                />
                {error && (
                    <p className="mt-1 text-xs text-red-500">{t('timeline.nav_time_invalid')}</p>
                )}
            </form>
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/HeaderTimeInput.tsx
git commit -m "feat: HeaderTimeInput コンポーネントを追加"
```

---

## Task 4: HeaderMechanicSearch コンポーネント

**Files:**
- Create: `src/components/HeaderMechanicSearch.tsx`

- [ ] **Step 1: HeaderMechanicSearchコンポーネントを作成**

```tsx
import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import type { TimelineEvent, Phase } from '../types';
import { useMitigationStore } from '../store/useMitigationStore';

interface MechanicOccurrence {
    time: number;
    phaseName: string;
    formattedTime: string;
}

interface MechanicEntry {
    name: string;
    occurrences: MechanicOccurrence[];
}

interface HeaderMechanicSearchProps {
    isOpen: boolean;
    onClose: () => void;
    events: TimelineEvent[];
    phases: Phase[];
    onJump: (time: number) => void;
    triggerRef: React.RefObject<HTMLElement | null>;
}

function formatTime(seconds: number): string {
    const m = Math.floor(Math.abs(seconds) / 60);
    const s = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function getPhaseName(time: number, phases: Phase[]): string {
    for (let i = 0; i < phases.length; i++) {
        const start = i === 0 ? 0 : phases[i - 1].endTime;
        if (time >= start && time < phases[i].endTime) {
            return phases[i].name.split('\n')[0];
        }
    }
    return '';
}

export const HeaderMechanicSearch: React.FC<HeaderMechanicSearchProps> = ({
    isOpen, onClose, events, phases, onJump, triggerRef
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [selectedMechanic, setSelectedMechanic] = useState<string | null>(null);
    useEscapeClose(isOpen, onClose);

    const contentLanguage = useMitigationStore(s => s.contentLanguage);

    // オートフォーカス
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedMechanic(null);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // クリック外閉じ
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                if (triggerRef?.current && triggerRef.current.contains(event.target as Node)) return;
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    // 位置計算
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [isPositioned, setIsPositioned] = useState(false);

    useLayoutEffect(() => {
        if (isOpen && triggerRef?.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left });
            setIsPositioned(true);
        } else if (!isOpen) {
            setIsPositioned(false);
        }
    }, [isOpen, triggerRef]);

    // ユニーク攻撃名リスト構築（AA除外）
    const mechanics: MechanicEntry[] = useMemo(() => {
        const map = new Map<string, MechanicOccurrence[]>();
        const getEventName = (ev: TimelineEvent) =>
            contentLanguage === 'en' && ev.name?.en ? ev.name.en : ev.name?.ja;

        events
            .filter(ev => {
                const name = getEventName(ev);
                return name && name !== 'AA';
            })
            .sort((a, b) => a.time - b.time)
            .forEach(ev => {
                const name = getEventName(ev)!;
                if (!map.has(name)) map.set(name, []);
                map.get(name)!.push({
                    time: ev.time,
                    phaseName: getPhaseName(ev.time, phases),
                    formattedTime: formatTime(ev.time),
                });
            });

        return Array.from(map.entries()).map(([name, occurrences]) => ({ name, occurrences }));
    }, [events, phases, contentLanguage]);

    // 検索フィルタ
    const filtered = useMemo(() => {
        if (!query.trim()) return mechanics;
        const q = query.toLowerCase();
        return mechanics.filter(m => m.name.toLowerCase().includes(q));
    }, [mechanics, query]);

    if (!isOpen) return null;

    const handleMechanicClick = (entry: MechanicEntry) => {
        if (entry.occurrences.length === 1) {
            onJump(entry.occurrences[0].time);
            onClose();
        } else {
            setSelectedMechanic(selectedMechanic === entry.name ? null : entry.name);
        }
    };

    const handleOccurrenceClick = (time: number) => {
        onJump(time);
        onClose();
    };

    return createPortal(
        <div
            ref={popoverRef}
            className={clsx(
                "fixed glass-tier3 rounded-lg z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-sm transition-opacity",
                !isPositioned ? "opacity-0" : "opacity-100"
            )}
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: selectedMechanic ? '420px' : '240px',
            }}
        >
            <div className="flex">
                {/* 1段目: 攻撃名リスト */}
                <div className="w-[240px] flex-shrink-0">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between px-3 py-2 bg-glass-header border-b border-glass-border">
                        <span className="text-xs font-black text-app-text uppercase tracking-wider">
                            {t('timeline.nav_mechanic_jump')}
                        </span>
                        <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                            <X size={14} />
                        </button>
                    </div>

                    {/* 検索ボックス */}
                    <div className="p-2 border-b border-glass-border">
                        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-app-bg border border-app-border">
                            <Search size={14} className="text-app-text-muted flex-shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setSelectedMechanic(null); }}
                                placeholder={t('timeline.nav_mechanic_search')}
                                className="w-full bg-transparent text-sm text-app-text placeholder:text-app-text-muted focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* リスト */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-center text-app-text-muted text-xs">
                                {t('timeline.nav_no_results')}
                            </div>
                        ) : (
                            filtered.map(entry => (
                                <button
                                    key={entry.name}
                                    onClick={() => handleMechanicClick(entry)}
                                    className={clsx(
                                        "w-full px-3 py-2.5 text-left text-sm border-b border-glass-border last:border-b-0 cursor-pointer transition-colors flex items-center justify-between",
                                        selectedMechanic === entry.name
                                            ? "bg-glass-active text-app-text"
                                            : "text-app-text hover:bg-glass-hover"
                                    )}
                                >
                                    <span className="truncate">{entry.name}</span>
                                    <span className="text-xs text-app-text-muted flex-shrink-0 ml-2">
                                        {entry.occurrences.length > 1 && (
                                            <>{t('timeline.nav_mechanic_count', { count: entry.occurrences.length })} ▸</>
                                        )}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* 2段目: 出現箇所サブリスト */}
                {selectedMechanic && (
                    <div className="w-[180px] border-l border-glass-border flex-shrink-0">
                        <div className="px-3 py-2 bg-glass-header border-b border-glass-border">
                            <span className="text-xs font-bold text-app-text truncate block">
                                {selectedMechanic}
                            </span>
                        </div>
                        <div className="max-h-[340px] overflow-y-auto">
                            {mechanics.find(m => m.name === selectedMechanic)?.occurrences.map((occ, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleOccurrenceClick(occ.time)}
                                    className="w-full px-3 py-2.5 text-left text-sm text-app-text hover:bg-glass-hover border-b border-glass-border last:border-b-0 cursor-pointer transition-colors flex items-center justify-between"
                                >
                                    <span className="text-app-text-muted text-xs truncate">{occ.phaseName}</span>
                                    <span className="font-mono text-xs">{occ.formattedTime}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/HeaderMechanicSearch.tsx
git commit -m "feat: HeaderMechanicSearch コンポーネントを追加（2段階ドロップダウン）"
```

---

## Task 5: Timeline.tsxにヘッダーナビゲーションを組み込む

**Files:**
- Modify: `src/components/Timeline.tsx:1-50` (import追加)
- Modify: `src/components/Timeline.tsx:568-600` (state追加)
- Modify: `src/components/Timeline.tsx:1612-1635` (ヘッダーUI変更)

- [ ] **Step 1: importを追加**

`src/components/Timeline.tsx` の既存import群の末尾に追加:

```tsx
import { HeaderPhaseDropdown } from './HeaderPhaseDropdown';
import { HeaderTimeInput } from './HeaderTimeInput';
import { HeaderMechanicSearch } from './HeaderMechanicSearch';
import { ChevronDown } from 'lucide-react';
```

- [ ] **Step 2: state・ref・ハンドラーを追加**

Timeline関数コンポーネント内、既存のuseState群の近く（行593付近、`jobPickerMemberId`の後）に追加:

```tsx
// ヘッダーナビゲーション
const [phaseDropdownOpen, setPhaseDropdownOpen] = useState(false);
const [timeInputOpen, setTimeInputOpen] = useState(false);
const [mechanicSearchOpen, setMechanicSearchOpen] = useState(false);
const [phaseColumnCollapsed, setPhaseColumnCollapsed] = useState(() => {
    try { return localStorage.getItem('lopo-phase-col-collapsed') === 'true'; } catch { return false; }
});
const phaseHeaderRef = useRef<HTMLDivElement>(null);
const timeHeaderRef = useRef<HTMLDivElement>(null);
const mechanicHeaderRef = useRef<HTMLDivElement>(null);

const handleTogglePhaseCollapse = () => {
    setPhaseColumnCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem('lopo-phase-col-collapsed', String(next)); } catch {}
        return next;
    });
};

const handleNavJump = (time: number) => {
    if (!scrollContainerRef.current) return;
    const targetY = timeToYMapRef.current.get(time);
    if (targetY !== undefined) {
        scrollContainerRef.current.scrollTo({ top: targetY, behavior: 'smooth' });
    } else {
        // timeToYMapにない場合、最も近い時刻を探す
        const offsetTime = showPreStart ? -10 : 0;
        const y = Math.max(0, (time - offsetTime)) * pixelsPerSecond;
        scrollContainerRef.current.scrollTo({ top: y, behavior: 'smooth' });
    }
};

// タイムラインの最大時刻を計算
const maxTime = useMemo(() => {
    let max = 0;
    timelineEvents.forEach(ev => { if (ev.time > max) max = ev.time; });
    return max;
}, [timelineEvents]);
```

- [ ] **Step 3: ヘッダーUI部分を変更**

`src/components/Timeline.tsx` のヘッダー行（行1619-1632付近）を置き換え。

**フェーズ列ヘッダー**（行1619-1622）を以下に置き換え:

```tsx
{!phaseColumnCollapsed ? (
    <div
        ref={phaseHeaderRef}
        className="w-[24px] min-w-[24px] md:w-[100px] md:min-w-[100px] md:max-w-[100px] flex-none border-r border-app-border h-full flex items-center justify-center text-app-text-muted font-black bg-transparent text-[8px] md:text-[11px] md:cursor-pointer md:hover:text-app-text transition-colors"
        onClick={() => { if (window.innerWidth >= 768) setPhaseDropdownOpen(!phaseDropdownOpen); }}
    >
        <span className="md:hidden">{t('timeline.header_phase_short')}</span>
        <span className="hidden md:inline md:flex md:items-center md:gap-1">
            {t('timeline.header_phase')}
            <ChevronDown size={12} />
        </span>
    </div>
) : (
    <div
        className="w-[6px] min-w-[6px] max-w-[6px] flex-none border-r border-app-border h-full hidden md:flex items-center justify-center cursor-pointer hover:bg-app-surface2 transition-colors"
        onClick={() => handleTogglePhaseCollapse()}
        title={t('timeline.nav_phase_expand')}
    >
        <div className="w-[2px] h-[16px] bg-app-text-muted rounded-full" />
    </div>
)}
```

**時間列ヘッダー**（行1623）を以下に置き換え:

```tsx
<div
    ref={timeHeaderRef}
    className="w-[36px] min-w-[36px] md:w-[70px] md:min-w-[70px] md:max-w-[70px] flex-none border-r border-app-border h-full flex items-center justify-center bg-transparent text-app-text-muted font-black text-[8px] md:text-[10px] md:cursor-pointer md:hover:text-app-text transition-colors"
    onClick={() => { if (window.innerWidth >= 768) setTimeInputOpen(!timeInputOpen); }}
>
    <span className="hidden md:inline md:flex md:items-center md:gap-0.5">
        {t('timeline.header_time')}
        <ChevronDown size={10} />
    </span>
    <span className="md:hidden">{t('timeline.header_time')}</span>
</div>
```

**敵の攻撃列ヘッダー**（行1624）を以下に置き換え:

```tsx
<div
    ref={mechanicHeaderRef}
    className="flex-1 md:flex-none md:w-[200px] md:min-w-[200px] md:max-w-[200px] border-r border-app-border h-full flex items-center bg-transparent text-app-text-muted text-[9px] md:text-[10px] pl-2 justify-start font-black cursor-pointer hover:text-app-text transition-colors"
    onClick={() => setMechanicSearchOpen(!mechanicSearchOpen)}
>
    <span className="flex items-center gap-0.5 md:gap-1">
        {t('timeline.header_mechanic')}
        <ChevronDown size={10} className="md:block" />
    </span>
</div>
```

- [ ] **Step 4: ドロップダウンコンポーネントをレンダリング**

Timeline.tsxのreturn末尾（他のモーダル/ポップオーバーの近く、例えばPhaseModal の直前あたり）に追加:

```tsx
<HeaderPhaseDropdown
    isOpen={phaseDropdownOpen}
    onClose={() => setPhaseDropdownOpen(false)}
    onOpen={() => setPhaseDropdownOpen(true)}
    phases={phases}
    onJump={handleNavJump}
    isCollapsed={phaseColumnCollapsed}
    onToggleCollapse={handleTogglePhaseCollapse}
    triggerRef={phaseHeaderRef}
/>
<HeaderTimeInput
    isOpen={timeInputOpen}
    onClose={() => setTimeInputOpen(false)}
    onJump={handleNavJump}
    triggerRef={timeHeaderRef}
    maxTime={maxTime}
/>
<HeaderMechanicSearch
    isOpen={mechanicSearchOpen}
    onClose={() => setMechanicSearchOpen(false)}
    events={timelineEvents}
    phases={phases}
    onJump={handleNavJump}
    triggerRef={mechanicHeaderRef}
/>
```

- [ ] **Step 5: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功（warning可、error不可）

- [ ] **Step 6: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: Timeline.tsxにヘッダーナビゲーション3機能を組み込み"
```

---

## Task 6: TimelineRow.tsxにフェーズ列折りたたみ対応

**Files:**
- Modify: `src/components/TimelineRow.tsx:85-98` (props追加)
- Modify: `src/components/TimelineRow.tsx:140-160` (フェーズ列条件分岐)
- Modify: `src/components/Timeline.tsx` (propsの受け渡し)

- [ ] **Step 1: TimelineRowにphaseColumnCollapsed propを追加**

`src/components/TimelineRow.tsx` のinterface定義に追加:

```tsx
phaseColumnCollapsed?: boolean;
```

コンポーネントの引数で受け取る。

- [ ] **Step 2: TimelineRowのフェーズ列を条件分岐**

フェーズ列のdiv（行140-160付近）を以下で囲む:

```tsx
{!phaseColumnCollapsed ? (
    <div
        className={clsx(
            "w-[24px] md:w-[100px] border-r h-full relative flex items-center justify-center group-hover:text-app-text",
            "border-app-border",
            "md:cursor-pointer md:hover:bg-app-surface2"
        )}
        onClick={(e) => {
            if (window.innerWidth < 768) {
                handleMobileTap(e);
            } else {
                onPhaseAdd(time, e);
            }
        }}
    >
        <Tooltip content={t('timeline.end_phase')} position="right">
            <div className="hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={16} />
            </div>
        </Tooltip>
    </div>
) : (
    <div className="w-[6px] min-w-[6px] max-w-[6px] border-r border-app-border h-full hidden md:block" />
)}
```

- [ ] **Step 3: Timeline.tsxからpropsを渡す**

Timeline.tsx内のTimelineRowレンダリング箇所に `phaseColumnCollapsed={phaseColumnCollapsed}` を追加。

- [ ] **Step 4: Timeline.tsxのフェーズバー描画を折りたたみ対応**

フェーズバー描画部分（行1778-1822付近）を `{!phaseColumnCollapsed && (` で囲む:

```tsx
{!phaseColumnCollapsed && (
    <>
        {phases.map((phase, index) => {
            // ... 既存のフェーズバー描画コード
        })}
    </>
)}
```

- [ ] **Step 5: ビルド確認**

```bash
npm run build
```

Expected: ビルド成功

- [ ] **Step 6: コミット**

```bash
git add src/components/TimelineRow.tsx src/components/Timeline.tsx
git commit -m "feat: フェーズ列折りたたみ対応（TimelineRow + フェーズバー）"
```

---

## Task 7: モバイル対応（Mechanic列ドロップダウン）

**Files:**
- Modify: `src/components/HeaderMechanicSearch.tsx`

- [ ] **Step 1: モバイル時の位置・サイズ調整**

HeaderMechanicSearch.tsx の useLayoutEffect 内、位置計算部分を修正:

```tsx
useLayoutEffect(() => {
    if (isOpen && triggerRef?.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            // モバイル: 画面幅に合わせてセンタリング
            const width = Math.min(window.innerWidth - 16, 320);
            setPosition({
                top: rect.bottom + 4,
                left: Math.max(8, (window.innerWidth - width) / 2),
            });
        } else {
            setPosition({ top: rect.bottom + 4, left: rect.left });
        }
        setIsPositioned(true);
    } else if (!isOpen) {
        setIsPositioned(false);
    }
}, [isOpen, triggerRef]);
```

ポータルのスタイルも修正 — モバイルではサブリストを下に展開:

```tsx
style={{
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: window.innerWidth < 768
        ? `${Math.min(window.innerWidth - 16, 320)}px`
        : selectedMechanic ? '420px' : '240px',
}}
```

flexの方向をモバイルでは縦にする:

```tsx
<div className={clsx("flex", window.innerWidth < 768 ? "flex-col" : "flex-row")}>
```

2段目のサブリストもモバイルでは幅100%:

```tsx
<div className={clsx(
    "flex-shrink-0",
    window.innerWidth < 768
        ? "w-full border-t border-glass-border"
        : "w-[180px] border-l border-glass-border"
)}>
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/components/HeaderMechanicSearch.tsx
git commit -m "feat: HeaderMechanicSearchのモバイルレイアウト対応"
```

---

## Task 8: 動作確認と微調整

- [ ] **Step 1: ローカルでdev serverを起動して動作確認**

```bash
npm run dev
```

確認項目:
- [ ] Phase列ヘッダークリック → フェーズドロップダウン表示 → フェーズ選択でジャンプ
- [ ] Phase列折りたたみ → 細いハンドル表示 → クリックで再展開
- [ ] Phase折りたたみ状態がリロード後も保持される
- [ ] Time列ヘッダークリック → 入力フィールド表示 → オートフォーカス確認
- [ ] 「120」入力 → 2:00にジャンプ
- [ ] 「2:00」入力 → 2:00にジャンプ
- [ ] 不正入力 → エラー表示
- [ ] Mechanic列ヘッダークリック → 検索ドロップダウン表示 → オートフォーカス確認
- [ ] 攻撃名検索 → 絞り込み動作
- [ ] 出現1回の攻撃 → 即ジャンプ
- [ ] 出現複数回の攻撃 → サブリスト展開 → 選択でジャンプ
- [ ] 全ドロップダウン: ESCで閉じる
- [ ] 全ドロップダウン: クリック外で閉じる
- [ ] ダークテーマ/ライトテーマ両方で表示確認
- [ ] モバイルビュー: Mechanic列のみ操作可能
- [ ] コンパクトモード（hideEmptyRows）でジャンプが正しく動作

- [ ] **Step 2: 問題があれば修正**

- [ ] **Step 3: 最終ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "fix: ヘッダーナビゲーション機能の動作確認修正"
```

（修正がない場合はスキップ）
