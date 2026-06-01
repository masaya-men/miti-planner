# 動画でタイムライン作成 PiP 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動画を見ながら攻撃を記録し現在の軽減表(プラン)へワンボタンで書き込める PC 専用 Document PiP を追加する。

**Architecture:** EventModal のフォーム本体を `EventForm` に抽出して再利用し(チュートリアル DOM ごと移植)、新規 `PipRecorder`(手動ストップウォッチ + PiP 版フォーム)を既存 Document PiP 基盤に載せる。カンペボタンはポップアップ化して「カンペ / レコーダー」を選ばせる。

**Tech Stack:** React + TypeScript / Zustand / react-i18next / Document Picture-in-Picture API / vitest + @testing-library/react (happy-dom)

設計書: `docs/superpowers/specs/2026-06-02-pip-timeline-recorder-design.md`

---

## ファイル構成

- **新規** `src/utils/stopwatch.ts` — 純粋関数 `computeElapsed` / `formatStopwatch`(テスト容易)
- **新規** `src/utils/__tests__/stopwatch.test.ts`
- **新規** `src/components/EventForm.tsx` — EventModal から抽出したフォーム本体(全フィールド+逆算計算+チュートリアル DOM)
- **新規** `src/components/PipRecorder.tsx` — タイマー画面 ⇄ フォーム画面
- **新規** `src/components/__tests__/PipRecorder.test.tsx`
- **改修** `src/components/EventModal.tsx` — 外枠だけの薄いラッパーに縮小
- **改修** `src/components/Timeline.tsx` — カンペボタンのポップアップ化 + `pipMode` + Portal 出し分け
- **改修** `src/locales/{ja,en,zh,ko}.json` — `timeline.recorder.*` キー追加

---

## Task 1: i18n キー追加 (`timeline.recorder.*`)

**Files:**
- Modify: `src/locales/ja.json`(`timeline` オブジェクト内、既存 `pip_*` キーの近く)
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: ja.json にキー追加**

`src/locales/ja.json` の `"timeline": { ... }` 内(例: `pip_switch_event` の直後)に追記:

```json
"recorder": {
    "menu_cue": "カンペを表示",
    "menu_record": "動画でタイムライン作成",
    "unsupported": "このブラウザは非対応です (Chrome / Edge / Firefox 推奨)",
    "no_plan": "先に軽減表(プラン)を開いてください",
    "start": "スタート",
    "pause": "一時停止",
    "reset": "リセット",
    "add_event": "＋ イベントを追加",
    "undo": "取消",
    "recorded_count": "記録済み {{count}} 件",
    "cancel": "キャンセル",
    "write": "表に書き込む"
}
```

- [ ] **Step 2: en.json に同じキー構成で追加**

```json
"recorder": {
    "menu_cue": "Show cue sheet",
    "menu_record": "Build timeline from video",
    "unsupported": "Not supported in this browser (use Chrome / Edge / Firefox)",
    "no_plan": "Open a sheet (plan) first",
    "start": "Start",
    "pause": "Pause",
    "reset": "Reset",
    "add_event": "+ Add event",
    "undo": "Undo",
    "recorded_count": "{{count}} recorded",
    "cancel": "Cancel",
    "write": "Add to sheet"
}
```

- [ ] **Step 3: zh.json に追加**

```json
"recorder": {
    "menu_cue": "显示提示表",
    "menu_record": "看视频构建时间轴",
    "unsupported": "此浏览器不支持 (建议使用 Chrome / Edge / Firefox)",
    "no_plan": "请先打开一个减伤表 (方案)",
    "start": "开始",
    "pause": "暂停",
    "reset": "重置",
    "add_event": "＋ 添加事件",
    "undo": "撤销",
    "recorded_count": "已记录 {{count}} 条",
    "cancel": "取消",
    "write": "写入表"
}
```

- [ ] **Step 4: ko.json に追加**

```json
"recorder": {
    "menu_cue": "컨닝표 표시",
    "menu_record": "영상 보며 타임라인 작성",
    "unsupported": "이 브라우저는 지원되지 않습니다 (Chrome / Edge / Firefox 권장)",
    "no_plan": "먼저 경감표(플랜)를 열어 주세요",
    "start": "시작",
    "pause": "일시정지",
    "reset": "초기화",
    "add_event": "＋ 이벤트 추가",
    "undo": "취소",
    "recorded_count": "{{count}}건 기록됨",
    "cancel": "취소",
    "write": "표에 기록"
}
```

- [ ] **Step 5: ビルドで JSON 妥当性確認**

Run: `npm run build`
Expected: 成功(JSON 構文エラーが無い)

- [ ] **Step 6: Commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
rtk git commit -m "feat(i18n): PiP レコーダー用 timeline.recorder.* キーを4言語追加"
```

---

## Task 2: ストップウォッチ純粋関数 (TDD)

**Files:**
- Create: `src/utils/stopwatch.ts`
- Test: `src/utils/__tests__/stopwatch.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/stopwatch.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeElapsed, formatStopwatch } from '../stopwatch';

describe('computeElapsed', () => {
    it('停止中(startedAt=null)は accumulated をそのまま秒で返す', () => {
        expect(computeElapsed(3000, null, 999999)).toBe(3);
    });
    it('計測中は accumulated + (now - startedAt) を秒で返す', () => {
        expect(computeElapsed(1000, 5000, 8000)).toBe(4); // 1s + 3s
    });
    it('ゼロから計測中', () => {
        expect(computeElapsed(0, 1000, 1500)).toBe(0.5);
    });
});

describe('formatStopwatch', () => {
    it('0 秒は 00:00.00', () => {
        expect(formatStopwatch(0)).toBe('00:00.00');
    });
    it('83.45 秒は 01:23.45', () => {
        expect(formatStopwatch(83.45)).toBe('01:23.45');
    });
    it('小数2位までで切り捨て(端数は伸ばさない)', () => {
        expect(formatStopwatch(83.459)).toBe('01:23.45');
    });
    it('分が2桁になる(例 600.0 → 10:00.00)', () => {
        expect(formatStopwatch(600)).toBe('10:00.00');
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/stopwatch.test.ts`
Expected: FAIL（`stopwatch` モジュールが存在しない）

- [ ] **Step 3: 最小実装**

`src/utils/stopwatch.ts`:

```ts
/** 経過秒数を算出する純粋関数。startedAt が null なら停止中。
 *  @param accumulatedMs これまでに溜まった経過(ミリ秒)
 *  @param startedAt 計測再開時刻(performance.now 値)。停止中は null
 *  @param now 現在時刻(performance.now 値) */
export function computeElapsed(accumulatedMs: number, startedAt: number | null, now: number): number {
    const totalMs = startedAt === null ? accumulatedMs : accumulatedMs + (now - startedAt);
    return totalMs / 1000;
}

/** 秒(小数可)を MM:SS.CC 形式へ。端数は切り捨て(伸ばさない)。 */
export function formatStopwatch(seconds: number): string {
    const safe = Math.max(0, seconds);
    const totalCentis = Math.floor(safe * 100);
    const cc = totalCentis % 100;
    const totalSecs = Math.floor(totalCentis / 100);
    const ss = totalSecs % 60;
    const mm = Math.floor(totalSecs / 60);
    const p2 = (n: number) => n.toString().padStart(2, '0');
    return `${p2(mm)}:${p2(ss)}.${p2(cc)}`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/stopwatch.test.ts`
Expected: PASS（7 件）

- [ ] **Step 5: Commit**

```bash
rtk git add src/utils/stopwatch.ts src/utils/__tests__/stopwatch.test.ts
rtk git commit -m "feat(stopwatch): PiP レコーダー用の経過時間/表示の純粋関数を追加"
```

---

## Task 3: EventModal → EventForm 抽出(挙動不変リファクタ + 新 props)

> **狙い:** EventModal のフォーム本体を `EventForm` に切り出し、EventModal は外枠(Portal/背景/位置/ヘッダ/モバイル navbar)だけのラッパーにする。**既存の見た目・挙動・チュートリアルを一切変えない**。その上で PiP 用の `variant` / `reverseOnly` / `labels` / `onCancel` props を足す。

**Files:**
- Create: `src/components/EventForm.tsx`
- Modify: `src/components/EventModal.tsx`

- [ ] **Step 1: EventForm.tsx を作成し、現行フォーム本体を移植**

`src/components/EventForm.tsx` を新規作成。現行 `src/components/EventModal.tsx` から以下を**そのまま移植**する:

- import 群(`toHalfWidthNumber` / `stripVariantSuffix` / 各 hook / `SegmentButton` / `Tooltip` / `calculateMemberValues` 等)
- 全 state(`name` / `time` / `damageType` / `damageAmount` / `target` / `inputMode` / `calcActualDamage` / `selectedMitigations` / `mitigationTargets` / `visibleMitigations` / `isMobile`)
- 全 effect(IntersectionObserver、initialData/initialTime 反映、逆算 auto-calc、**チュートリアル監視 effect 群すべて**)
- ロジック(`toggleMitigation` / `setMitigationTarget` / `getSortKey` / `isPureHealOnly` / `uniqueMitigations` / `sortedMitigations` / `handleCalculate` / `getTooltipText` / `handleSubmit` / 各 icon useMemo)
- JSX は **現行の `<form id="event-modal-form"> ... </form>`(現 702〜1040 行)をそのまま**。`#event-modal-form` / `#mitigation-grid-container` / `data-tutorial-*` / `data-mitigation-id` は変更しない(チュートリアルのセレクタ維持)

`EventForm` の props は以下:

```tsx
export interface EventFormLabels {
    /** 保存ボタンの文言(i18n キー)。未指定なら 'mechanic_modal.add_button' */
    saveButtonKey?: string;
}

interface EventFormProps {
    onSave: (event: Omit<import('../types').TimelineEvent, 'id'>) => void;
    onDelete?: () => void;
    /** PiP のキャンセル等、フォームを閉じる用。指定時のみキャンセルボタンを表示 */
    onCancel?: () => void;
    initialData?: import('../types').TimelineEvent | null;
    initialTime?: number;
    /** 'modal'(従来) | 'pip'(コンパクト) */
    variant?: 'modal' | 'pip';
    /** true で逆算/直接トグルを隠し inputMode='reverse' 固定(PiP 用) */
    reverseOnly?: boolean;
    labels?: EventFormLabels;
}
```

`handleSubmit` は現行どおり `onSave({ name, time, damageType, damageAmount, target })` を呼ぶ。`handleBackdropClick` は**ラッパー側へ移す**(EventForm は背景を持たない)。`useEscapeClose` も**ラッパー側**へ残す。`createPortal` の外枠も**移植しない**(EventForm は `<form>` を直接返す)。

`EventForm` の戻り値は `createPortal(...)` ではなく、`<form ref={formRef} id="event-modal-form" ...>...</form>` を直接返す(現行 702〜1040 行に相当)。

- [ ] **Step 2: reverseOnly でトグルを隠す**

EventForm 内、現行の入力モードトグル(現 703〜712 行の `<SegmentButton ... value={inputMode} onChange={setInputMode} />`)を条件付きに:

```tsx
{!reverseOnly && (
    <SegmentButton
        options={[
            { value: 'reverse', label: t('modal.mode_reverse', '逆算入力 (Reverse)'), icon: <Calculator size={14} /> },
            { value: 'direct', label: t('modal.mode_direct', '直接入力 (Direct)') },
        ]}
        value={inputMode}
        onChange={setInputMode}
        className={isMobile ? 'mb-3' : 'mb-6'}
    />
)}
```

`reverseOnly` のとき `inputMode` を常に `'reverse'` に固定するため、initialData 反映の effect 内および初期化で `reverseOnly ? 'reverse' : ...` を使う(直接入力に切り替わらないよう `setInputMode('reverse')` を保証)。

- [ ] **Step 3: 保存ボタン文言とキャンセルボタンを props 化**

EventForm 下部アクション(現 1001〜1039 行)を改修:

```tsx
{/* 保存ボタンの文言は labels で差し替え可能 */}
<button data-tutorial="event-save-btn" type="submit" className={/* 既存クラス */}>
    <Save size={isMobile ? 18 : 16} />
    {t(labels?.saveButtonKey ?? 'mechanic_modal.add_button')}
</button>
```

`onCancel` が渡された場合のみ、削除ボタンの位置(削除が無い pip 用)にキャンセルボタンを表示:

```tsx
{onCancel ? (
    <button type="button" onClick={onCancel} className={/* セカンダリボタン: border + hover、トークン経由 */}>
        {t('timeline.recorder.cancel')}
    </button>
) : (onDelete && initialData ? (/* 既存の削除ボタン */) : <div className="hidden sm:block" />)}
```

- [ ] **Step 4: variant='pip' のコンパクト寸法**

`variant === 'pip'` のとき、PiP の狭い窓に収める。現行は `isMobile` でボトムシート寸法に分岐しているので、`const compact = variant === 'pip' || isMobile;` を導入し、padding / フォント / グリッド高さの分岐に `compact` を使う(`isMobile` 単独参照を `compact` へ置換。ただしモバイル専用のボトムシート位置・ドラッグハンドル・iOS navbar はラッパー側に残すため EventForm では扱わない)。軽減グリッドの `max-h-[160px]` は pip では `max-h-[120px]` 程度に。

- [ ] **Step 5: EventModal.tsx をラッパーに縮小**

`src/components/EventModal.tsx` を、外枠だけ残して中身を `<EventForm>` に置き換える。保持するもの: `useEscapeClose`、`createPortal`、背景 div(`handleBackdropClick`)、PC カーソル追従/中央/モバイルボトムシートの位置決め、ドラッグハンドル、PC ヘッダ、モバイル iOS navbar。`isMobile` 判定はラッパーに残す(位置決めに必要)。フォーム部分を以下に:

```tsx
<EventForm
    variant="modal"
    initialData={initialData}
    initialTime={initialTime}
    onSave={(ev) => { onSave(ev); onClose(); }}
    onDelete={onDelete}
/>
```

注意: 現行 `handleSubmit` は保存後 `onClose()` も呼んでいる。EventForm の `onSave` は閉じないので、ラッパーの `onSave` で `onClose()` を呼ぶ(上記)。`handleBackdropClick`(名前入力済みなら保存して閉じる)はラッパーに残し、`name` を EventForm が持つため、**ラッパーは EventForm の submit に委譲する形へ単純化**: 背景クリックで `onClose()` のみ行う(チュートリアル中は無視)。※従来の「背景クリックで自動保存」は、PiP 化に伴う簡素化として許容(設計書の non-goal 範囲・実機確認で違和感あれば後日復帰)。

> モバイル navbar の保存ボタンは `type="submit" form="event-modal-form"` で EventForm 内 form を submit するため、EventForm が同じ `id="event-modal-form"` を保持していれば従来どおり動く。

- [ ] **Step 6: 型チェック + ビルド**

Run: `npm run build`
Expected: 成功(未使用 import / 型不足なし。memory `feedback_vercel_tsc_strict`)

- [ ] **Step 7: 既存テスト green 確認**

Run: `npx vitest run`
Expected: 既存テスト全 PASS(EventModal を import するテストがあれば壊れていないこと)

- [ ] **Step 8: チュートリアル回帰の手動確認(必須)**

`npm run dev` で起動し、チュートリアルのイベント追加系ステップを1周:
- `add-1-name`(技名入力でアルテマ→次へ) / `add-2-damage`(実ダメージ入力で次へ) / `add-3-miti`(リプライザル+アドル+野戦治療で次へ) / `add-4-save`(保存) / `create-8-miti`(学者プリセット+リプライザル検知)
Expected: 各ステップが従来どおり進行する(DOM id とハイライトが効いている)

- [ ] **Step 9: Commit**

```bash
rtk git add src/components/EventForm.tsx src/components/EventModal.tsx
rtk git commit -m "refactor(event): EventModal のフォーム本体を EventForm へ抽出 (チュートリアル DOM 維持 + pip/reverseOnly props 追加)"
```

---

## Task 4: PipRecorder コンポーネント

**Files:**
- Create: `src/components/PipRecorder.tsx`
- Test: `src/components/__tests__/PipRecorder.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/__tests__/PipRecorder.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, opt?: any) => (opt?.count !== undefined ? `${key}:${opt.count}` : key), i18n: { language: 'ja' } }),
}));

import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import PipRecorder from '../PipRecorder';

beforeEach(() => {
    // プランあり状態にする
    usePlanStore.setState({ currentPlanId: 'plan_test' } as any);
    useMitigationStore.setState({ timelineEvents: [] } as any);
});

describe('PipRecorder', () => {
    it('プラン未選択時は案内を表示し、イベント追加ボタンを出さない', () => {
        usePlanStore.setState({ currentPlanId: null } as any);
        render(<PipRecorder />);
        expect(screen.getByText('timeline.recorder.no_plan')).toBeTruthy();
        expect(screen.queryByText('timeline.recorder.add_event')).toBeNull();
    });

    it('タイマー画面でスタート/イベント追加ボタンが見える', () => {
        render(<PipRecorder />);
        expect(screen.getByText('timeline.recorder.start')).toBeTruthy();
        expect(screen.getByText('timeline.recorder.add_event')).toBeTruthy();
    });

    it('イベント追加→フォームで保存すると addEvent され timelineEvents が増える', () => {
        render(<PipRecorder />);
        fireEvent.click(screen.getByText('timeline.recorder.add_event'));
        // フォームの保存(EventForm の submit ボタン文言 = labels.write)
        const writeBtn = screen.getByText('timeline.recorder.write');
        // 技名は必須(required)だが happy-dom では submit が発火するので name を入れる
        const nameInput = document.querySelector('[data-tutorial="event-name-input"]') as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'テスト攻撃' } });
        fireEvent.click(writeBtn);
        expect(useMitigationStore.getState().timelineEvents.length).toBe(1);
    });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/PipRecorder.test.tsx`
Expected: FAIL（`PipRecorder` 未実装）

- [ ] **Step 3: PipRecorder を実装**

`src/components/PipRecorder.tsx`:

```tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RotateCcw, Plus, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import EventForm from './EventForm';
import { computeElapsed, formatStopwatch } from '../utils/stopwatch';
import type { TimelineEvent } from '../types';

const genId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).slice(2, 9);

const PipRecorder: React.FC = () => {
    const { t } = useTranslation();
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const addEvent = useMitigationStore(s => s.addEvent);
    const undo = useMitigationStore(s => s.undo);
    const eventCount = useMitigationStore(s => s.timelineEvents.length);

    // ストップウォッチ state
    const accumulatedRef = useRef(0);          // 溜まった経過(ms)
    const startedAtRef = useRef<number | null>(null);
    const [running, setRunning] = useState(false);
    const [display, setDisplay] = useState('00:00.00');

    // フォーム画面の制御(null=タイマー画面)
    const [formTime, setFormTime] = useState<number | null>(null);

    const readElapsed = useCallback(
        () => computeElapsed(accumulatedRef.current, startedAtRef.current, performance.now()),
        [],
    );

    // 表示更新ループ(running 中のみ)
    useEffect(() => {
        if (!running) return;
        let raf = 0;
        const tick = () => {
            setDisplay(formatStopwatch(readElapsed()));
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [running, readElapsed]);

    const start = useCallback(() => {
        if (running) return;
        startedAtRef.current = performance.now();
        setRunning(true);
    }, [running]);

    const pause = useCallback(() => {
        if (!running) return;
        accumulatedRef.current = readElapsed() * 1000;
        startedAtRef.current = null;
        setRunning(false);
        setDisplay(formatStopwatch(accumulatedRef.current / 1000));
    }, [running, readElapsed]);

    const reset = useCallback(() => {
        accumulatedRef.current = 0;
        startedAtRef.current = null;
        setRunning(false);
        setDisplay('00:00.00');
    }, []);

    // イベント追加: ストップウォッチを止めて、その時刻でフォームを開く
    const openForm = useCallback(() => {
        const elapsed = readElapsed();
        accumulatedRef.current = elapsed * 1000;
        startedAtRef.current = null;
        setRunning(false);
        setDisplay(formatStopwatch(elapsed));
        setFormTime(Math.round(elapsed * 100) / 100);
    }, [readElapsed]);

    const writeToSheet = useCallback((ev: Omit<TimelineEvent, 'id'>) => {
        addEvent({ ...ev, id: genId() });
        setFormTime(null); // タイマー画面へ戻る(停止のまま)
    }, [addEvent]);

    if (!currentPlanId) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-center text-app-text/70 text-app-md">
                {t('timeline.recorder.no_plan')}
            </div>
        );
    }

    // フォーム画面
    if (formTime !== null) {
        return (
            <div className="h-full overflow-y-auto bg-app-bg text-app-text">
                <EventForm
                    variant="pip"
                    reverseOnly
                    initialTime={formTime}
                    labels={{ saveButtonKey: 'timeline.recorder.write' }}
                    onSave={writeToSheet}
                    onCancel={() => setFormTime(null)}
                />
            </div>
        );
    }

    // タイマー画面
    return (
        <div className="flex h-full flex-col items-center justify-between gap-3 bg-app-bg p-3 text-app-text">
            {/* 時刻表示: tabular-nums + 固定枠でガタつき防止 */}
            <div
                className="w-full text-center font-barlow font-bold tracking-tight"
                style={{ fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontFeatureSettings: '"tnum" 1' }}
            >
                {display}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={running ? pause : start}
                    className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer"
                >
                    {running ? <Pause size={16} /> : <Play size={16} />}
                    {running ? t('timeline.recorder.pause') : t('timeline.recorder.start')}
                </button>
                <button
                    onClick={reset}
                    className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer"
                >
                    <RotateCcw size={16} /> {t('timeline.recorder.reset')}
                </button>
            </div>

            <button
                onClick={openForm}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-blue py-4 text-app-2xl font-bold text-white hover:bg-app-blue-hover active:scale-95 cursor-pointer"
            >
                <Plus size={20} /> {t('timeline.recorder.add_event')}
            </button>

            <div className="flex w-full items-center justify-between text-app-base text-app-text/60">
                <span>{t('timeline.recorder.recorded_count', { count: eventCount })}</span>
                <button
                    onClick={() => undo()}
                    className="flex items-center gap-1 rounded px-2 py-1 hover:bg-app-text/10 active:scale-95 cursor-pointer"
                >
                    <Undo2 size={14} /> {t('timeline.recorder.undo')}
                </button>
            </div>
        </div>
    );
};

export default PipRecorder;
```

> 注: `undo` がストアに存在することを確認すること(`src/store/useMitigationStore.ts` の undo/redo 実装、`timelineEvents: previous.timelineEvents` 付近)。アクション名が異なる場合は実体に合わせる。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/PipRecorder.test.tsx`
Expected: PASS（3 件）

- [ ] **Step 5: 型チェック**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/PipRecorder.tsx src/components/__tests__/PipRecorder.test.tsx
rtk git commit -m "feat(pip): 動画記録用 PipRecorder (手動ストップウォッチ + EventForm pip 版) を追加"
```

---

## Task 5: Timeline 統合(カンペボタンのポップアップ化 + モード出し分け)

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: PipRecorder の lazy import を追加**

現行 `const PipView = React.lazy(() => import('./PipView'));`([Timeline.tsx:28](../../../src/components/Timeline.tsx))の直後に:

```tsx
const PipRecorder = React.lazy(() => import('./PipRecorder'));
```

- [ ] **Step 2: pipMode と メニュー開閉 state を追加**

現行 PiP state(`pipWindow` / `pipContainer` / `pipSupported`、[Timeline.tsx:603-605](../../../src/components/Timeline.tsx))の近くに:

```tsx
const [pipMode, setPipMode] = useState<'cue' | 'recorder' | null>(null);
const [pipMenuOpen, setPipMenuOpen] = useState(false);
```

- [ ] **Step 3: handleOpenPip をモード引数対応に**

現行 `handleOpenPip`([Timeline.tsx:988-1031](../../../src/components/Timeline.tsx))を改修。`requestWindow` のサイズをモード別にし、`setPipMode(mode)` を保存。`pagehide` で `setPipMode(null)` も行う:

```tsx
const handleOpenPip = useCallback(async (mode: 'cue' | 'recorder') => {
    if (!pipSupported) return;
    try {
        const dpip = (window as any).documentPictureInPicture;
        const size = mode === 'recorder' ? { width: 360, height: 480 } : { width: 1, height: 200 };
        const win: Window = await dpip.requestWindow(size);

        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        styles.forEach(s => win.document.head.appendChild(s.cloneNode(true)));
        win.document.documentElement.classList.add(...document.documentElement.classList);
        win.document.documentElement.style.background = 'transparent';
        win.document.documentElement.style.height = '100%';
        win.document.body.style.margin = '0';
        win.document.body.style.height = '100%';
        win.document.body.style.overflow = 'hidden';
        win.document.body.style.background = 'transparent';

        const container = win.document.createElement('div');
        container.id = 'pip-root';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.position = 'relative';
        win.document.body.appendChild(container);

        setPipMode(mode);
        setPipWindow(win);
        setPipContainer(container);
        win.addEventListener('pagehide', () => {
            setPipWindow(null);
            setPipContainer(null);
            setPipMode(null);
        });
    } catch (e) {
        console.warn('PiP open failed:', e);
    }
}, [pipSupported]);
```

`handleClosePip`([Timeline.tsx:1033-1037](../../../src/components/Timeline.tsx))にも `setPipMode(null);` を追記。

- [ ] **Step 4: カンペボタンをポップアップトリガに変更**

既存のカンペ起動ボタン([Timeline.tsx:2233](../../../src/components/Timeline.tsx) の `onClick={pipWindow ? handleClosePip : handleOpenPip}`、アイコン `PictureInPicture2` は 2241 行)を改修。PiP 開いている時は閉じ、閉じている時はメニューを開く:`onClick={() => pipWindow ? handleClosePip() : setPipMenuOpen(o => !o)}`。ボタンを内包する要素を `relative` にし、直後にメニューを追加(`handleOpenPip` は引数 `'cue'|'recorder'` を取るようになった点に注意):

```tsx
{pipMenuOpen && (
    <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl glass-tier3 border border-glass-border/40 shadow-lg">
        <button
            onClick={() => { setPipMenuOpen(false); handleOpenPip('cue'); }}
            disabled={!pipSupported}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-app-md text-app-text hover:bg-glass-hover disabled:opacity-40 cursor-pointer"
        >
            {t('timeline.recorder.menu_cue')}
        </button>
        <button
            onClick={() => { setPipMenuOpen(false); handleOpenPip('recorder'); }}
            disabled={!pipSupported}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-app-md text-app-text hover:bg-glass-hover disabled:opacity-40 cursor-pointer"
        >
            {t('timeline.recorder.menu_record')}
        </button>
        {!pipSupported && (
            <p className="px-4 py-2 text-app-base text-app-text/50">{t('timeline.recorder.unsupported')}</p>
        )}
    </div>
)}
```

外側クリックで閉じるため、`useEffect` で `document` の `click` を購読し、メニュー外なら `setPipMenuOpen(false)`(既存の同様パターンがあれば踏襲)。

- [ ] **Step 5: Portal の中身をモードで出し分け**

現行の PiP Portal([Timeline.tsx:3779-3784](../../../src/components/Timeline.tsx))を:

```tsx
{pipContainer && createPortal(
    <React.Suspense fallback={null}>
        {pipMode === 'recorder' ? <PipRecorder /> : <PipView mode="pip" onClose={handleClosePip} />}
    </React.Suspense>,
    pipContainer
)}
```

- [ ] **Step 6: 型チェック + ビルド**

Run: `npm run build`
Expected: 成功

- [ ] **Step 7: 既存テスト green**

Run: `npx vitest run`
Expected: 全 PASS(特に `Timeline.layout.test.tsx`)

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(pip): カンペボタンをポップアップ化し カンペ/レコーダーを選択可能に"
```

---

## Task 6: 総合検証(実機 E2E)

**Files:** なし(検証のみ)

- [ ] **Step 1: ビルド + 全テスト**

Run: `npm run build && npx vitest run`
Expected: 両方成功(memory `feedback_vercel_tsc_strict` / `reference_vitest_vmthreads_hang` の安全手順に従う。出力をパイプしない)

- [ ] **Step 2: Chrome 実機 E2E**

`npm run dev` → Chrome で:
1. 新規プランを作成(NewPlanModal で `custom` または `ultimate`、空タイムライン)
2. カンペボタン → 「動画でタイムライン作成」 → PiP 窓が開く
3. 別タブ/別窓で動画を再生し、PiP を最前面に
4. スタート → 数字がガタつかず進む(`MM:SS.CC`)
5. ＋イベントを追加 → ストップウォッチ停止 + 時刻自動入力 → 技名/タイプ/対象/実ダメージ入力 → 「表に書き込む」
6. 本体タイムラインに行が増える / 記録済み件数が増える
7. 取消(Undo) → 直前の行が消える
8. プラン未選択で開くと案内が出る
Expected: すべて期待どおり

- [ ] **Step 3: チュートリアル回帰(再確認)**

Task 3 Step 8 と同じくチュートリアルのイベント追加系ステップを1周。
Expected: 従来どおり進行

- [ ] **Step 4: 完了タスクの記録 + TODO 更新**

`docs/TODO.md` の「現在の状態」を更新(本機能の実装完了を反映)。`docs/TODO_COMPLETED.md` へ移動すべき項目があれば移動。

- [ ] **Step 5: 最終コミット + push**

```bash
rtk git add -A
rtk git commit -m "docs: PiP タイムライン作成機能の実装完了を TODO へ反映"
rtk git push
```

---

## Self-Review(計画作成者によるチェック結果)

- **Spec coverage:** 入口ポップアップ(Task5)/ 2画面 PiP(Task4)/ 手動ストップウォッチ+小数2位+ガタつき防止 CSS(Task2,4)/ 逆算固定(Task3)/ addEvent 書き込み(Task4)/ 前提プラン+未選択案内(Task4)/ Undo(Task4)/ PiP 専用文言・本体無変更・4言語(Task1,3)/ EventForm 抽出+チュートリアル DOM 維持(Task3)/ ブラウザ対応・非対応無効化(Task5)/ 検証・チュートリアル回帰(Task3,6)。spec の全項目に対応タスクあり。
- **Placeholder scan:** TODO/TBD なし。コードは各 step に実体を記載。EventForm 抽出は「現行 N 行を移植」と具体行参照 + 差分コードを明示(1000 行の逐語再掲は誤転記リスクのため避け、移植対象+変更点を完全提示)。
- **Type consistency:** `computeElapsed`/`formatStopwatch`(Task2)、`EventFormProps`(Task3)、`PipRecorder`(Task4)、`pipMode: 'cue'|'recorder'|null`(Task5)で名称・シグネチャ一貫。`addEvent({...ev, id})` は既存ストアと一致。`undo()` はストア実体名を Task4 Step3 で要確認と明記。
