# Phase startTime移行 + LocalizedString統一 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フェーズのデータモデルを endTime ベースから startTime ベースに変更し、Phase.name を LocalizedString に統一する（設計書の段階1）

**Architecture:** Phase型を `{ id, name: LocalizedString, startTime, endTime? }` に変更。既存データは読み込み時に自動変換。PhaseModalを多言語入力+終端時間変更UIに拡張。フェーズ・ラベル共用の編集モーダルとする。

**Tech Stack:** React, Zustand, TypeScript, Vite, Vitest, framer-motion, i18next

**設計書:** `docs/superpowers/specs/2026-04-07-phase-label-starttime-design.md`

---

## ファイル構造

| ファイル | 操作 | 責務 |
|---------|------|------|
| `src/types/index.ts` | 修正 | Phase型変更、getPhaseName簡素化 |
| `src/utils/phaseMigration.ts` | 新規 | 旧Phase→新Phase変換の純粋関数 |
| `src/utils/__tests__/phaseMigration.test.ts` | 新規 | 変換関数のテスト |
| `src/store/useMitigationStore.ts` | 修正 | Phase操作をstartTimeベースに、loadSnapshotに変換追加 |
| `src/components/BoundaryEditModal.tsx` | 新規 | 多言語入力+終端時間変更+TL選択。フェーズ・ラベル共用 |
| `src/components/PhaseModal.tsx` | 削除 | BoundaryEditModalに置き換え |
| `src/components/Timeline.tsx` | 修正 | フェーズオーバーレイ描画をstartTimeベースに、TL選択モード追加 |
| `src/components/TimelineRow.tsx` | 修正 | フェーズ列クリック時のハンドラ更新 |
| `src/components/HeaderPhaseDropdown.tsx` | 修正 | startTimeベースのジャンプ |
| `src/utils/fflogsMapper.ts` | 修正 | buildPhasesの戻り値をLocalizedString対応 |
| `src/components/Sidebar.tsx` | 修正 | テンプレート→プラン変換をstartTimeベースに |
| `src/store/usePlanStore.ts` | 修正 | 同上 |
| `src/utils/templateConversions.ts` | 修正 | convertPlanToTemplateのphase処理更新 |
| `src/data/templateLoader.ts` | 修正 | TemplateData型のphases.name更新 |
| `src/locales/ja.json` | 修正 | 新しいi18nキー追加 |
| `src/locales/en.json` | 修正 | 同上 |
| `src/locales/zh.json` | 修正 | 同上 |
| `src/locales/ko.json` | 修正 | 同上 |
| `src/utils/__tests__/templateConversions.test.ts` | 修正 | Phase型変更に伴うテスト更新 |

---

## Task 1: 型定義の変更

**Files:**
- Modify: `src/types/index.ts:1-92`

- [ ] **Step 1: Phase型をstartTimeベースに変更**

```typescript
// src/types/index.ts

// LocalizedString — 変更なし（行1-6）
export type LocalizedString = {
    ja: string;
    en: string;
    zh?: string;
    ko?: string;
};

// getPhaseName — 変更なし。string | LocalizedString のまま維持。
// この関数はフェーズ以外（軽減スキル名等）でも使われているため、
// 全てのユーザーがLocalizedStringに移行するまでstring受け入れを残す。
export function getPhaseName(name: string | LocalizedString, lang?: string): string {
    if (typeof name === 'string') return name;
    if (lang === 'ja' && name.ja) return name.ja;
    if (lang === 'en' && name.en) return name.en;
    if (lang === 'zh' && name.zh) return name.zh;
    if (lang === 'ko' && name.ko) return name.ko;
    return name.en || name.ja || '';
}

// normalizeLocalizedString — 変更なし（行19-23）

// Phase型 — endTime → startTime + optional endTime
export interface Phase {
    id: string;
    name: LocalizedString;
    startTime: number;
    endTime?: number;  // 未指定なら次のPhaseのstartTimeまで
}
```

- [ ] **Step 2: ビルドしてPhase型変更による型エラーを確認**

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: 多数の型エラー（endTime参照、string型のname等）。これは想定内で、以降のタスクで順次修正する。

- [ ] **Step 3: コミット**

```bash
git add src/types/index.ts
git commit -m "refactor: Phase型をstartTimeベースに変更、name: LocalizedStringに統一"
```

---

## Task 2: データ変換関数（純粋関数 + テスト）

**Files:**
- Create: `src/utils/phaseMigration.ts`
- Create: `src/utils/__tests__/phaseMigration.test.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
// src/utils/__tests__/phaseMigration.test.ts
import { describe, it, expect } from 'vitest';
import { migratePhases, isLegacyPhaseFormat } from '../phaseMigration';
import type { LocalizedString } from '../../types';

describe('isLegacyPhaseFormat', () => {
    it('endTimeがありstartTimeがないフェーズを旧形式と判定する', () => {
        const phases = [{ id: 'p1', name: 'Phase 1', endTime: 60 }];
        expect(isLegacyPhaseFormat(phases)).toBe(true);
    });

    it('startTimeがあるフェーズを新形式と判定する', () => {
        const phases = [{ id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 }];
        expect(isLegacyPhaseFormat(phases)).toBe(false);
    });

    it('空配列はfalse', () => {
        expect(isLegacyPhaseFormat([])).toBe(false);
    });
});

describe('migratePhases', () => {
    it('endTimeベースのフェーズをstartTimeベースに変換する', () => {
        const legacy = [
            { id: 'p1', name: 'Phase 1', endTime: 60 },
            { id: 'p2', name: 'Phase 2', endTime: 120 },
        ];
        const result = migratePhases(legacy);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: 'p1', name: { ja: 'Phase 1', en: '' }, startTime: 0 });
        expect(result[1]).toEqual({ id: 'p2', name: { ja: 'Phase 2', en: '' }, startTime: 60 });
    });

    it('LocalizedString名のフェーズも正しく変換する', () => {
        const legacy = [
            { id: 'p1', name: { ja: 'フェーズ1', en: 'Phase 1' }, endTime: 30 },
            { id: 'p2', name: { ja: 'フェーズ2', en: 'Phase 2' }, endTime: 90 },
        ];
        const result = migratePhases(legacy);
        expect(result[0]).toEqual({ id: 'p1', name: { ja: 'フェーズ1', en: 'Phase 1' }, startTime: 0 });
        expect(result[1]).toEqual({ id: 'p2', name: { ja: 'フェーズ2', en: 'Phase 2' }, startTime: 30 });
    });

    it('フェーズが1つの場合、startTime=0に変換する', () => {
        const legacy = [{ id: 'p1', name: 'Only Phase', endTime: 300 }];
        const result = migratePhases(legacy);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ id: 'p1', name: { ja: 'Only Phase', en: '' }, startTime: 0 });
    });

    it('[object Object]混入データをクリーニングする', () => {
        const legacy = [{ id: 'p1', name: 'Phase 1\n[object Object]', endTime: 60 }];
        const result = migratePhases(legacy);
        expect(result[0].name).toEqual({ ja: 'Phase 1', en: '' });
    });

    it('新形式のデータはそのまま返す', () => {
        const newFormat = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 60 },
        ];
        const result = migratePhases(newFormat);
        expect(result).toEqual(newFormat);
    });

    it('空配列は空配列を返す', () => {
        expect(migratePhases([])).toEqual([]);
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 変換関数を実装**

```typescript
// src/utils/phaseMigration.ts
import type { Phase, LocalizedString } from '../types';
import { normalizeLocalizedString } from '../types';

/** 旧形式（endTimeベース）かどうかを判定 */
export function isLegacyPhaseFormat(phases: any[]): boolean {
    if (phases.length === 0) return false;
    const first = phases[0];
    return ('endTime' in first) && !('startTime' in first);
}

/** Phase.name を string | LocalizedString から LocalizedString に正規化 */
function normalizePhaseName(name: any): LocalizedString {
    if (typeof name === 'string') {
        // [object Object] 混入をクリーニング
        const cleaned = name.replace(/\n?\[object Object\]/g, '');
        return { ja: cleaned, en: '' };
    }
    if (name && typeof name === 'object' && ('ja' in name || 'en' in name)) {
        return {
            ja: name.ja || '',
            en: name.en || '',
            ...(name.zh ? { zh: name.zh } : {}),
            ...(name.ko ? { ko: name.ko } : {}),
        };
    }
    return { ja: '', en: '' };
}

/**
 * 旧Phase（endTimeベース）→ 新Phase（startTimeベース）に変換。
 * 新形式のデータはそのまま返す。純粋関数。
 */
export function migratePhases(phases: any[]): Phase[] {
    if (phases.length === 0) return [];

    // 新形式ならそのまま返す
    if (!isLegacyPhaseFormat(phases)) {
        return phases.map(p => ({
            id: p.id,
            name: normalizePhaseName(p.name),
            startTime: p.startTime,
            ...(p.endTime !== undefined ? { endTime: p.endTime } : {}),
        }));
    }

    // 旧形式: endTime順にソート済みと仮定
    const sorted = [...phases].sort((a: any, b: any) => a.endTime - b.endTime);
    return sorted.map((p: any, i: number) => ({
        id: p.id,
        name: normalizePhaseName(p.name),
        startTime: i === 0 ? 0 : sorted[i - 1].endTime,
    }));
}
```

- [ ] **Step 4: テストを実行して全て通過を確認**

Run: `npx vitest run src/utils/__tests__/phaseMigration.test.ts`
Expected: 全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/utils/phaseMigration.ts src/utils/__tests__/phaseMigration.test.ts
git commit -m "feat: Phase旧→新形式の変換関数を実装（テスト付き）"
```

---

## Task 3: useMitigationStoreのPhase操作を更新

**Files:**
- Modify: `src/store/useMitigationStore.ts`

- [ ] **Step 1: インターフェースのPhase操作メソッド型を更新**

`MitigationActions` インターフェース内（行86-88付近）を以下に変更:

```typescript
addPhase: (startTime: number, name: LocalizedString) => void;
updatePhase: (id: string, name: LocalizedString) => void;
removePhase: (id: string) => void;
updatePhaseEndTime: (id: string, newEndTime: number) => void;
```

- [ ] **Step 2: normalizePhases関数をmigratePhases呼び出しに変更**

ファイル冒頭のimportに追加:
```typescript
import { migratePhases } from '../utils/phaseMigration';
```

旧 `normalizePhases` 関数（行11-17）を削除。

- [ ] **Step 3: addPhase実装を更新（行422-435付近）**

```typescript
addPhase: (startTime, name) => {
    const exists = get().phases.some(p => p.startTime === startTime);
    if (exists) return;
    pushHistory();
    set((state) => {
        const newPhase: Phase = {
            id: crypto.randomUUID(),
            name,
            startTime
        };
        return { phases: [...state.phases, newPhase].sort((a, b) => a.startTime - b.startTime) };
    });
},
```

- [ ] **Step 4: updatePhase実装を更新（行437-442付近）**

```typescript
updatePhase: (id, name) => {
    pushHistory();
    set((state) => ({
        phases: state.phases.map(p => p.id === id ? { ...p, name } : p)
    }));
},
```

- [ ] **Step 5: removePhase実装は変更不要（行444-449）。その下にupdatePhaseEndTimeを追加**

```typescript
updatePhaseEndTime: (id, newEndTime) => {
    pushHistory();
    set((state) => {
        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
        const idx = sorted.findIndex(p => p.id === id);
        if (idx < 0) return {};
        const nextPhase = sorted[idx + 1];
        // 次のフェーズのstartTimeを超えないようクリップ
        const clipped = nextPhase ? Math.min(newEndTime, nextPhase.startTime) : newEndTime;
        // 自分のstartTime以下にはしない
        const final = Math.max(clipped, sorted[idx].startTime + 1);
        return {
            phases: state.phases.map(p => p.id === id ? { ...p, endTime: final } : p)
        };
    });
},
```

- [ ] **Step 6: loadSnapshot内のphases処理を更新**

`loadSnapshot`内（行237-255付近）の `phases: normalizePhases(snapshot.phases)` を以下に変更:

```typescript
phases: migratePhases(snapshot.phases ?? []),
```

- [ ] **Step 7: コミット**

```bash
git add src/store/useMitigationStore.ts
git commit -m "refactor: useMitigationStoreのPhase操作をstartTimeベースに更新"
```

---

## Task 4: BoundaryEditModal（フェーズ・ラベル共用の編集モーダル）

**Files:**
- Create: `src/components/BoundaryEditModal.tsx`
- Delete: `src/components/PhaseModal.tsx`（Task 7でTimeline.tsxの参照を差し替えてから）

- [ ] **Step 1: BoundaryEditModalコンポーネントを作成**

```typescript
// src/components/BoundaryEditModal.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Trash2, Crosshair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../hooks/useEscapeClose';
import type { LocalizedString } from '../types';

interface BoundaryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: LocalizedString, endTime?: number) => void;
    onDelete?: () => void;
    onStartTimelineSelect?: () => void;  // TL選択モード開始
    initial?: { name: LocalizedString; endTime?: number };
    isEdit?: boolean;
    mode: 'phase' | 'label';
    position?: { x: number; y: number };
}

/** MM:SS形式を秒に変換 */
function parseTimeInput(value: string): number | null {
    const match = value.match(/^(\d+):(\d{1,2})$/);
    if (match) return parseInt(match[1]) * 60 + parseInt(match[2]);
    const num = parseInt(value);
    return isNaN(num) ? null : num;
}

/** 秒をMM:SS形式に変換 */
function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export const BoundaryEditModal: React.FC<BoundaryEditModalProps> = ({
    isOpen, onClose, onSave, onDelete, onStartTimelineSelect,
    initial, isEdit = false, mode, position
}) => {
    const { t } = useTranslation();
    useEscapeClose(isOpen, onClose);

    const [nameJa, setNameJa] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [nameZh, setNameZh] = useState('');
    const [nameKo, setNameKo] = useState('');
    const [endTimeInput, setEndTimeInput] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

    useEffect(() => {
        if (isOpen && initial) {
            setNameJa(initial.name.ja || '');
            setNameEn(initial.name.en || '');
            setNameZh(initial.name.zh || '');
            setNameKo(initial.name.ko || '');
            setEndTimeInput(initial.endTime !== undefined ? formatTime(initial.endTime) : '');
        } else if (isOpen) {
            setNameJa(''); setNameEn(''); setNameZh(''); setNameKo('');
            setEndTimeInput('');
        }
    }, [isOpen, initial]);

    if (!mounted) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const name: LocalizedString = {
            ja: nameJa.trim(), en: nameEn.trim(),
            ...(nameZh.trim() ? { zh: nameZh.trim() } : {}),
            ...(nameKo.trim() ? { ko: nameKo.trim() } : {}),
        };
        const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
        onSave(name, endTime);
        onClose();
    };

    const handleBackdropClick = () => {
        if (nameJa.trim() || nameEn.trim()) {
            const name: LocalizedString = {
                ja: nameJa.trim(), en: nameEn.trim(),
                ...(nameZh.trim() ? { zh: nameZh.trim() } : {}),
                ...(nameKo.trim() ? { ko: nameKo.trim() } : {}),
            };
            const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
            onSave(name, endTime);
        }
        onClose();
    };

    const titleKey = isEdit
        ? (mode === 'phase' ? 'boundary_modal.edit_phase' : 'boundary_modal.edit_label')
        : (mode === 'phase' ? 'boundary_modal.add_phase' : 'boundary_modal.add_label');

    const x = position ? Math.min(position.x, window.innerWidth - 420) : '50%';
    const y = position ? Math.min(position.y, window.innerHeight - 400) : '50%';
    const style = isMobile
        ? { bottom: 0, left: 0, right: 0, width: '100%', transform: 'none' }
        : (position ? { left: x, top: y } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] text-left pointer-events-none flex flex-col justify-end">
                    <div
                        className={`absolute inset-0 transition-opacity duration-100 pointer-events-auto ${isMobile ? 'bg-black/50 backdrop-blur-[2px]' : 'bg-transparent'}`}
                        onClick={handleBackdropClick}
                    />
                    <motion.div
                        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
                        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.1 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute shadow-sm overflow-hidden ring-1 ring-app-border glass-tier3 pointer-events-auto flex flex-col ${isMobile ? 'w-full rounded-t-2xl rounded-b-none border-b-0' : 'w-[400px] rounded-xl'}`}
                        style={style}
                    >
                        {isMobile && <div className="w-12 h-1 bg-app-border rounded-full mx-auto mt-3 shrink-0" />}

                        <div className="flex justify-between items-center px-6 py-4 border-b border-app-border bg-app-surface2/40 shrink-0">
                            <h2 className="text-app-2xl font-bold text-app-text">{t(titleKey)}</h2>
                            <button onClick={onClose} className="text-app-text p-1 rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 cursor-pointer active:scale-90">
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* 名前入力（多言語） */}
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.name_ja')}</label>
                                    <input type="text" value={nameJa} onChange={(e) => setNameJa(e.target.value)}
                                        className="w-full bg-app-surface2 border border-app-border rounded-lg p-2 text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                        placeholder={t('boundary_modal.name_ja_placeholder')} autoFocus />
                                </div>
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.name_en')}</label>
                                    <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                                        className="w-full bg-app-surface2 border border-app-border rounded-lg p-2 text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                        placeholder={t('boundary_modal.name_en_placeholder')} />
                                </div>
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.name_zh')}</label>
                                    <input type="text" value={nameZh} onChange={(e) => setNameZh(e.target.value)}
                                        className="w-full bg-app-surface2 border border-app-border rounded-lg p-2 text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                        placeholder={t('boundary_modal.name_zh_placeholder')} />
                                </div>
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.name_ko')}</label>
                                    <input type="text" value={nameKo} onChange={(e) => setNameKo(e.target.value)}
                                        className="w-full bg-app-surface2 border border-app-border rounded-lg p-2 text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                        placeholder={t('boundary_modal.name_ko_placeholder')} />
                                </div>
                            </div>

                            {/* 終端時間（編集時のみ表示） */}
                            {isEdit && (
                                <div>
                                    <label className="block text-app-sm font-medium text-app-text-muted mb-1">{t('boundary_modal.end_time')}</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)}
                                            className="flex-1 bg-app-surface2 border border-app-border rounded-lg p-2 text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                            placeholder="M:SS" />
                                        {onStartTimelineSelect && (
                                            <button type="button" onClick={() => { onStartTimelineSelect(); }}
                                                className="px-3 py-2 text-app-text rounded-lg border border-app-border hover:bg-app-surface2 transition-colors flex items-center gap-1.5 text-app-sm cursor-pointer">
                                                <Crosshair size={14} />
                                                <span>{t('boundary_modal.select_on_timeline')}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ボタン */}
                            <div className="flex justify-between items-center pt-2">
                                {isEdit && onDelete ? (
                                    <button type="button" onClick={() => { onDelete(); onClose(); }}
                                        className="px-3 py-1.5 text-app-red hover:text-app-red-hover hover:bg-app-red-dim rounded-md flex items-center gap-1.5 transition-colors text-app-lg cursor-pointer">
                                        <Trash2 size={14} />
                                        <span>{t('modal.delete')}</span>
                                    </button>
                                ) : <div />}
                                <div className="flex gap-2">
                                    <button type="button" onClick={onClose}
                                        className="px-4 py-1.5 text-app-text rounded-lg border border-transparent hover:bg-app-text hover:text-app-bg hover:border-app-text transition-all duration-200 text-app-lg font-medium cursor-pointer active:scale-95">
                                        {t('modal.cancel')}
                                    </button>
                                    <button type="submit"
                                        className="px-4 py-1.5 bg-app-blue text-white hover:bg-app-blue-hover rounded-md text-app-lg font-semibold transition-all uppercase cursor-pointer">
                                        {t('modal.save')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
```

- [ ] **Step 2: i18nキーを追加**

`src/locales/ja.json` に以下を追加（boundary_modal セクション）:
```json
"boundary_modal": {
    "add_phase": "フェーズを追加",
    "edit_phase": "フェーズを編集",
    "add_label": "ラベルを追加",
    "edit_label": "ラベルを編集",
    "name_ja": "日本語",
    "name_en": "English",
    "name_zh": "中文",
    "name_ko": "한국어",
    "name_ja_placeholder": "フェーズ名",
    "name_en_placeholder": "Phase name",
    "name_zh_placeholder": "阶段名称",
    "name_ko_placeholder": "페이즈 이름",
    "end_time": "終端時間",
    "select_on_timeline": "TL選択",
    "select_banner": "終端位置を選択してください（Escでキャンセル）"
}
```

`src/locales/en.json`:
```json
"boundary_modal": {
    "add_phase": "Add Phase",
    "edit_phase": "Edit Phase",
    "add_label": "Add Label",
    "edit_label": "Edit Label",
    "name_ja": "Japanese",
    "name_en": "English",
    "name_zh": "Chinese",
    "name_ko": "Korean",
    "name_ja_placeholder": "Phase name",
    "name_en_placeholder": "Phase name",
    "name_zh_placeholder": "Phase name",
    "name_ko_placeholder": "Phase name",
    "end_time": "End Time",
    "select_on_timeline": "Select on TL",
    "select_banner": "Select end position (Esc to cancel)"
}
```

`src/locales/zh.json` と `src/locales/ko.json` にも同様の構造で追加（翻訳は英語フォールバック）。

- [ ] **Step 3: コミット**

```bash
git add src/components/BoundaryEditModal.tsx src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: BoundaryEditModal（多言語入力+終端時間変更）を新規作成"
```

---

## Task 5: Timeline.tsxのフェーズ操作をstartTimeベースに更新

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: PhaseModalのimportをBoundaryEditModalに差し替え**

```typescript
// 旧: import { PhaseModal } from './PhaseModal';
import { BoundaryEditModal } from './BoundaryEditModal';
```

- [ ] **Step 2: selectedPhaseのstate型を更新**

```typescript
// 旧: const [selectedPhase, setSelectedPhase] = useState<{ id: string, name: string } | null>(null);
const [selectedPhase, setSelectedPhase] = useState<{ id: string; name: LocalizedString; endTime?: number } | null>(null);
```

タイムライン選択モード用のstateを追加:
```typescript
const [timelineSelectMode, setTimelineSelectMode] = useState<{
    phaseId: string;
    startTime: number;
} | null>(null);
const [previewEndTime, setPreviewEndTime] = useState<number | null>(null);
```

- [ ] **Step 3: handlePhaseAddを更新（クリック位置 = 新フェーズのstartTime）**

```typescript
const handlePhaseAdd = useCallback((time: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhaseModalPosition({ x: e.clientX, y: e.clientY });
    setSelectedPhaseTime(time);  // 旧: time + 1
    setSelectedPhase(null);
    setIsPhaseModalOpen(true);
}, []);
```

- [ ] **Step 4: handlePhaseEditを更新（LocalizedString対応）**

```typescript
const handlePhaseEdit = (phase: Phase, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhaseModalPosition({ x: e.clientX, y: e.clientY });
    // 実効endTime: 明示endTimeがなければ次のフェーズのstartTime
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    const idx = sorted.findIndex(p => p.id === phase.id);
    const nextPhase = sorted[idx + 1];
    const effectiveEndTime = phase.endTime ?? nextPhase?.startTime;
    setSelectedPhase({ id: phase.id, name: phase.name, endTime: effectiveEndTime });
    setIsPhaseModalOpen(true);
};
```

- [ ] **Step 5: handlePhaseSaveを更新**

```typescript
const handlePhaseSave = (name: LocalizedString, endTime?: number) => {
    if (selectedPhase) {
        updatePhase(selectedPhase.id, name);
        if (endTime !== undefined) {
            updatePhaseEndTime(selectedPhase.id, endTime);
        }
    } else {
        if (selectedPhaseTime !== undefined) {
            addPhase(selectedPhaseTime, name);
        }
    }
};
```

ストア接続にも `updatePhaseEndTime` を追加:
```typescript
const updatePhaseEndTime = useMitigationStore(s => s.updatePhaseEndTime);
```

- [ ] **Step 6: フェーズオーバーレイ描画をstartTimeベースに（行1972-2017付近）**

```typescript
{!phaseColumnCollapsed && phases.map((phase, index) => {
    const offsetTime = showPreStart ? -10 : 0;
    const sorted = [...phases].sort((a, b) => a.startTime - b.startTime);
    const startTime = phase.startTime;
    const nextPhase = sorted[index + 1];
    const endTime = phase.endTime ?? nextPhase?.startTime ?? (Math.max(...timelineEvents.map(e => e.time), 0) + 10);

    if (!showPreStart && endTime <= 0) return null;

    const effectiveStartTime = Math.max(startTime, offsetTime);
    const effectiveEndTime = Math.max(endTime, offsetTime);

    const startY = timeToYMap.get(effectiveStartTime) ?? (Math.max(0, effectiveStartTime - offsetTime) * pixelsPerSecond);
    const top = startY;
    const height = Math.max(0, (timeToYMap.get(effectiveEndTime) ?? (Math.max(0, effectiveEndTime - offsetTime) * pixelsPerSecond)) - startY);

    return (
        <div
            key={phase.id}
            className="absolute left-0 w-[24px] md:w-[60px] border-r border-b border-app-border bg-app-surface2 cursor-pointer hover:bg-app-surface2 pointer-events-auto z-10"
            style={{ top: `${top}px`, height: `${height}px` }}
            onClick={(e) => handlePhaseEdit(phase, e)}
        >
            {/* 既存の表示コードを維持（getPhaseName呼び出し） */}
            <Tooltip content={t('timeline.click_rename', 'クリックして名前を変更')} position="right" wrapperClassName="sticky top-0 w-full">
                <div className="w-full h-[100px] md:h-[150px] flex items-center justify-center pt-4 md:pt-6">
                    <div className="transform -rotate-90 overflow-visible px-2 drop-shadow-md origin-center flex flex-col items-center gap-0.5">
                        <span className="hidden md:block whitespace-nowrap text-app-xl font-bold text-app-text leading-none">
                            {t('timeline.phase_prefix', { index: index + 1 })}
                        </span>
                        {getPhaseName(phase.name, contentLanguage) !== t('timeline.phase_prefix', { index: index + 1 }) && (
                            <span className="hidden md:block whitespace-nowrap text-app-sm font-medium text-app-text/70 leading-none">
                                {getPhaseName(phase.name, contentLanguage)}
                            </span>
                        )}
                        <span className="md:hidden whitespace-nowrap text-app-base font-bold text-app-text leading-none">
                            {getPhaseName(phase.name, contentLanguage)}
                        </span>
                    </div>
                </div>
            </Tooltip>
        </div>
    );
})}
```

- [ ] **Step 7: PhaseModal呼び出しをBoundaryEditModalに差し替え**

```typescript
<BoundaryEditModal
    isOpen={isPhaseModalOpen}
    onClose={() => setIsPhaseModalOpen(false)}
    onSave={handlePhaseSave}
    onDelete={selectedPhase ? handlePhaseDelete : undefined}
    onStartTimelineSelect={selectedPhase ? () => {
        setTimelineSelectMode({ phaseId: selectedPhase.id, startTime: selectedPhase.endTime ?? 0 });
        setIsPhaseModalOpen(false);
    } : undefined}
    initial={selectedPhase ? { name: selectedPhase.name, endTime: selectedPhase.endTime } : undefined}
    isEdit={!!selectedPhase}
    mode="phase"
    position={phaseModalPosition}
/>
```

- [ ] **Step 8: タイムライン選択モードのバナーとハイライト**

ヘッダー領域（Timeline.tsx内の適切な位置）にバナーを追加:
```typescript
{timelineSelectMode && (
    <div className="fixed top-0 left-0 right-0 z-[9998] bg-app-blue/90 text-white text-center py-2 text-app-lg font-medium">
        {t('boundary_modal.select_banner')}
    </div>
)}
```

TimelineRow に選択モードのpropsを追加（次のTask 6で実装）。

Escキーで選択モードをキャンセル:
```typescript
// 既存のキーボードハンドラ内に追加
if (e.key === 'Escape' && timelineSelectMode) {
    setTimelineSelectMode(null);
    setPreviewEndTime(null);
    setIsPhaseModalOpen(true);  // モーダルに戻る
    return;
}
```

- [ ] **Step 9: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "refactor: Timeline.tsxのフェーズ操作をstartTimeベースに更新"
```

---

## Task 6: TimelineRow.tsxのフェーズ列更新 + TL選択ハイライト

**Files:**
- Modify: `src/components/TimelineRow.tsx`

- [ ] **Step 1: propsにTL選択モード関連を追加**

```typescript
interface TimelineRowProps {
    // ...既存props
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    previewEndTime?: number | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
}
```

- [ ] **Step 2: TL選択モード時のフェーズ列の動作を変更**

フェーズ列の onClick ハンドラを更新:
```typescript
onClick={(e) => {
    if (timelineSelectMode) {
        onTimelineSelect?.(time);
        return;
    }
    if (window.innerWidth < 768) {
        handleMobileTap(e);
    } else {
        onPhaseAdd(time, e);
    }
}}
onMouseEnter={() => {
    if (timelineSelectMode) {
        onTimelineSelectHover?.(time);
    }
}}
```

- [ ] **Step 3: ハイライト表示（選択モード時）**

行全体にハイライトクラスを追加:
```typescript
const isHighlighted = timelineSelectMode
    && previewEndTime !== null
    && time >= timelineSelectMode.startTime
    && time <= previewEndTime;

// 行のclassNameに追加:
className={clsx(
    // ...既存クラス
    isHighlighted && "bg-app-blue/10"
)}
```

- [ ] **Step 4: Timeline.tsxからTimelineRowへのprops受け渡し**

Timeline.tsx内のTimelineRow呼び出しに追加:
```typescript
timelineSelectMode={timelineSelectMode}
previewEndTime={previewEndTime}
onTimelineSelect={(time) => {
    if (timelineSelectMode) {
        updatePhaseEndTime(timelineSelectMode.phaseId, time);
        setTimelineSelectMode(null);
        setPreviewEndTime(null);
        // 元のフェーズのモーダルを再度開く
        const phase = phases.find(p => p.id === timelineSelectMode.phaseId);
        if (phase) {
            setSelectedPhase({ id: phase.id, name: phase.name, endTime: time });
            setIsPhaseModalOpen(true);
        }
    }
}}
onTimelineSelectHover={(time) => {
    if (timelineSelectMode) {
        setPreviewEndTime(time);
    }
}}
```

- [ ] **Step 5: コミット**

```bash
git add src/components/TimelineRow.tsx src/components/Timeline.tsx
git commit -m "feat: TimelineRow TL選択モード（ハイライト付き終端時間選択）"
```

---

## Task 7: HeaderPhaseDropdownをstartTimeベースに更新

**Files:**
- Modify: `src/components/HeaderPhaseDropdown.tsx`

- [ ] **Step 1: handlePhaseClickをstartTimeベースに**

```typescript
const handlePhaseClick = (phaseIndex: number) => {
    // 旧: const startTime = phaseIndex === 0 ? 0 : phases[phaseIndex - 1].endTime;
    const startTime = phases[phaseIndex].startTime;
    onJump(startTime);
    onClose();
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/HeaderPhaseDropdown.tsx
git commit -m "refactor: HeaderPhaseDropdownをstartTimeベースに更新"
```

---

## Task 8: FFLogsMapper + テンプレート変換の更新

**Files:**
- Modify: `src/utils/fflogsMapper.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/store/usePlanStore.ts`
- Modify: `src/utils/templateConversions.ts`
- Modify: `src/data/templateLoader.ts`

- [ ] **Step 1: buildPhasesの戻り値をLocalizedString対応に**

```typescript
// src/utils/fflogsMapper.ts
function buildPhases(fight: FFLogsFight): { id: number; startTimeSec: number; name: LocalizedString }[] {
    const transitions = fight.phaseTransitions;
    const phaseNames = fight.phaseNames;

    if (!transitions || transitions.length === 0) {
        const rawName = phaseNames?.[0]?.name;
        return [{ id: 1, startTimeSec: 0, name: { ja: '', en: cleanPhaseName(rawName) || 'P1' } }];
    }

    return transitions.map(pt => {
        const nameEntry = phaseNames?.find(p => p.id === pt.id);
        const cleaned = cleanPhaseName(nameEntry?.name) || `P${pt.id}`;
        return {
            id: pt.id,
            startTimeSec: Math.floor((pt.startTime - fight.startTime) / 1000),
            name: { ja: '', en: cleaned },
        };
    });
}
```

- [ ] **Step 2: TemplateData型のphases.name更新**

```typescript
// src/data/templateLoader.ts
export interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: LocalizedString }[];
  _warning?: string;
}
```

- [ ] **Step 3: Sidebar.tsxのテンプレート→プラン変換を更新**

```typescript
// src/components/Sidebar.tsx — テンプレートからプラン作成部分
phases: tpl.phases ? tpl.phases
    .filter(p => p.startTimeSec >= 0)
    .map((p, i) => ({
        id: `phase_${p.id}`,
        name: p.name
            ? (typeof p.name === 'string'
                ? { ja: p.name, en: '' }  // 旧テンプレート互換
                : {
                    ja: p.name.ja || `Phase ${i + 1}`,
                    en: p.name.en || `Phase ${i + 1}`,
                    ...(p.name.zh ? { zh: p.name.zh } : {}),
                    ...(p.name.ko ? { ko: p.name.ko } : {}),
                })
            : { ja: `Phase ${i + 1}`, en: `Phase ${i + 1}` },
        startTime: p.startTimeSec,
    })) : []
```

- [ ] **Step 4: usePlanStore.tsのcreatePlanFromTemplate内も同様に更新**

Sidebar.tsxのStep 3と同じ変換ロジックを適用。

- [ ] **Step 5: convertPlanToTemplateのphase処理を更新**

```typescript
// src/utils/templateConversions.ts — convertPlanToTemplate内
const templatePhases: TemplateData['phases'] = planData.phases.map((phase, index) => {
    const idMatch = phase.id.match(/\d+/);
    const numericId = idMatch ? parseInt(idMatch[0], 10) : index + 1;

    const result: TemplateData['phases'][number] = {
        id: numericId,
        startTimeSec: phase.startTime,
    };
    if (phase.name.ja || phase.name.en) {
        result.name = {
            ja: phase.name.ja,
            en: phase.name.en,
            ...(phase.name.zh ? { zh: phase.name.zh } : {}),
            ...(phase.name.ko ? { ko: phase.name.ko } : {}),
        };
    }
    return result;
});
```

- [ ] **Step 6: コミット**

```bash
git add src/utils/fflogsMapper.ts src/data/templateLoader.ts src/components/Sidebar.tsx src/store/usePlanStore.ts src/utils/templateConversions.ts
git commit -m "refactor: FFLogs・テンプレート変換をstartTime+LocalizedStringに更新"
```

---

## Task 9: 既存テストの更新

**Files:**
- Modify: `src/utils/__tests__/templateConversions.test.ts`
- Modify: `src/hooks/__tests__/useTemplateEditor.test.ts`

- [ ] **Step 1: templateConversions.test.tsのPhase関連テストを更新**

`convertPlanToTemplate` のテストで Phase 型を新形式に更新:
```typescript
// 旧: phases: [{ id: 'phase_1', name: 'Phase 1\nP1', endTime: 60 }]
// 新:
phases: [{ id: 'phase_1', name: { ja: 'P1', en: 'P1' }, startTime: 0 }]
```

フェーズ名ストリップテストは LocalizedString 用のみ残す（string型テストは不要になる）。

- [ ] **Step 2: useTemplateEditor.test.tsのPhase関連テストを更新**

テスト内の Phase データを新形式に変更。endTime参照をstartTimeに変更。

- [ ] **Step 3: テスト全体を実行して通過を確認**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add src/utils/__tests__/templateConversions.test.ts src/hooks/__tests__/useTemplateEditor.test.ts
git commit -m "test: 既存テストをPhase startTime新形式に更新"
```

---

## Task 10: PhaseModal.tsx削除 + ビルド確認 + デバッグログ削除

**Files:**
- Delete: `src/components/PhaseModal.tsx`
- Modify: `src/components/Timeline.tsx`（デバッグログ削除）

- [ ] **Step 1: PhaseModal.tsxを削除**

```bash
git rm src/components/PhaseModal.tsx
```

- [ ] **Step 2: PhaseModalのimportが他に残っていないか確認**

Run: `grep -r "PhaseModal" src/ --include="*.tsx" --include="*.ts"`
Expected: ヒットなし（Task 5で差し替え済み）

- [ ] **Step 3: Timeline.tsxのデバッグログを削除**

セッション冒頭で追加した `__DEBUG_LABELS` 関連のコードを削除。

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 5: 全テスト実行**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "chore: PhaseModal削除、デバッグログ削除、ビルド確認"
```

---

## Task 11: AdminGuardのデバッグバイパス削除

**Files:**
- Modify: `src/components/admin/AdminGuard.tsx`

- [ ] **Step 1: セッション冒頭で追加したDEVバイパスコードを削除**

```typescript
// この部分を削除:
// if (import.meta.env.DEV && import.meta.env.VITE_DEV_ADMIN === 'true') {
//     return <>{children}</>;
// }
```

- [ ] **Step 2: コミット**

```bash
git add src/components/admin/AdminGuard.tsx
git commit -m "chore: AdminGuardのデバッグバイパスを削除"
```

---

## 完了確認チェックリスト

- [ ] `npm run build` が成功する
- [ ] `npx vitest run` が全て通過する
- [ ] Phase型が `{ id, name: LocalizedString, startTime, endTime? }` になっている
- [ ] `string | LocalizedString` のunion型が Phase.name から排除されている
- [ ] 旧形式（endTimeベース）のデータが読み込み時に自動変換される
- [ ] BoundaryEditModalが多言語入力+終端時間変更+TL選択をサポートしている
- [ ] フェーズオーバーレイがstartTimeベースで正しく描画される
- [ ] HeaderPhaseDropdownがstartTimeベースでジャンプする
- [ ] FFLogsインポートのフェーズ名がLocalizedStringになっている
- [ ] テンプレート→プラン変換がstartTimeベースになっている
