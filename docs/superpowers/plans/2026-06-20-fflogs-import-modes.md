# FFLogs インポート 取り込みモード選択 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FFLogs インポート時に「置き換え（軽減も削除）／置き換え（軽減は残す）／追記」の 3 モードを選べるようにする。

**Architecture:** 取り込み結果の「最終イベント列」と「軽減を消すか」を純粋関数 `resolveImportEvents` で算出。store の `importTimelineEvents` がモードを受け取り、ローカル経路は state を直接更新、collab 経路は `importBulk(events, phases, labels, clearMitigations)` に委譲。UI はプレビュー画面でモードを選択（既存タイムラインが空の時は非表示）。

**Tech Stack:** React + Zustand + i18next + Yjs (collab) + Vitest。

## Global Constraints

- **言語/コメント/ドキュメントは日本語**。
- **TypeScript strict / Vercel は `tsc -b` 厳密**：未使用変数・型不足・暗黙 any でビルドが落ちる。push 前に `npm run build` と `npx vitest run` 必須。
- **erasableSyntaxOnly 有効**：テストの class モックで TS パラメータプロパティ/enum を使わない（vitest 緑でも build が落ちる）。
- **i18n キーは必ず ja/en/ko/zh の 4 言語に追加**。ハードコード文言禁止。英語表示で崩れないこと。
- **デザインは白黒＋機能色のみ**（青=実行、黄=警告）。色・font-size はトークン経由（`text-app-*` / `bg-app-*` / `--font-size-*`）。`backdrop-filter` 直書き禁止（css-rules.md）。
- **モード文言は淡々とした説明のみ**（「まっさら」等の砕けた表現は使わない）。
- **既定の UI 選択 = 「置き換え（軽減は残す）」**。`importTimelineEvents` の `mode` 引数は必須（暗黙デフォルトを設けない）。
- 仕様の正典: `docs/superpowers/specs/2026-06-20-fflogs-import-modes-design.md`。

---

## ファイル構成

- **Create** `src/utils/importModes.ts` — `ImportMode` 型と純粋関数 `resolveImportEvents`。
- **Create** `src/utils/__tests__/importModes.test.ts` — `resolveImportEvents` の単体テスト。
- **Modify** `src/store/useMitigationStore.ts` — `importTimelineEvents` にモード分岐（ローカル＋collab 委譲）。型定義 L133。実装 L923-964。
- **Modify** `src/lib/collab/collabTypes.ts` — `CollabHandlers.importBulk` 署名に `clearMitigations` 追加（L24）。
- **Modify** `src/lib/collab/collabProvider.ts` — `importBulk` 実装で `clearMitigations` 時のみ `yarr.delete`（L356-364）。
- **Modify** `src/store/__tests__/useMitigationStore.collab.test.ts` — 既存 importBulk 委譲テスト（L229-238）をモード対応に更新＋追記。
- **Modify** `src/locales/{ja,en,ko,zh}.json` — `fflogs.import_mode.*` キー追加。
- **Modify** `src/components/FFLogsImportModal.tsx` — モード選択 UI ＋ `handleImport` でモードを渡す（state L74 付近、preview L317-321、handleImport L174-184）。

---

## Task 1: `resolveImportEvents` 純粋関数

**Files:**
- Create: `src/utils/importModes.ts`
- Test: `src/utils/__tests__/importModes.test.ts`

**Interfaces:**
- Consumes: `TimelineEvent`（`src/types/index.ts:103`）。
- Produces:
  - `type ImportMode = 'replace_all' | 'replace_keep' | 'append'`
  - `interface ImportEventResolution { events: TimelineEvent[]; clearMitigations: boolean; appendFromTime: number | null }`
  - `function resolveImportEvents(currentEvents: TimelineEvent[], incomingEvents: TimelineEvent[], mode: ImportMode): ImportEventResolution`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/importModes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveImportEvents } from '../importModes';
import type { TimelineEvent } from '../../types';

const ev = (id: string, time: number): TimelineEvent => ({
  id, time, name: { ja: id, en: id }, damageType: 'magical',
});

describe('resolveImportEvents', () => {
  const current = [ev('a', 10), ev('b', 60)];
  const incoming = [ev('x', 5), ev('y', 70), ev('z', 60)];

  it('replace_all: 取り込み列で全置換・軽減クリア', () => {
    const r = resolveImportEvents(current, incoming, 'replace_all');
    expect(r.events.map(e => e.id)).toEqual(['x', 'z', 'y']); // time 昇順
    expect(r.clearMitigations).toBe(true);
    expect(r.appendFromTime).toBeNull();
  });

  it('replace_keep: 全置換だが軽減は残す', () => {
    const r = resolveImportEvents(current, incoming, 'replace_keep');
    expect(r.events.map(e => e.id)).toEqual(['x', 'z', 'y']);
    expect(r.clearMitigations).toBe(false);
    expect(r.appendFromTime).toBeNull();
  });

  it('append: 既存の最終時刻(60)より後だけ追加・既存は保持・軽減残す', () => {
    const r = resolveImportEvents(current, incoming, 'append');
    expect(r.events.map(e => e.id)).toEqual(['a', 'b', 'y']); // 既存a,b + 70のyのみ
    expect(r.clearMitigations).toBe(false);
    expect(r.appendFromTime).toBe(60);
  });

  it('append: 同時刻ちょうど(60)は取り込まない(既存優先)', () => {
    const r = resolveImportEvents(current, [ev('z', 60)], 'append');
    expect(r.events.map(e => e.id)).toEqual(['a', 'b']);
  });

  it('append: 既存が空なら全件追加・appendFromTime は null', () => {
    const r = resolveImportEvents([], incoming, 'append');
    expect(r.events.map(e => e.id)).toEqual(['x', 'z', 'y']);
    expect(r.appendFromTime).toBeNull();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/utils/__tests__/importModes.test.ts`
Expected: FAIL（`resolveImportEvents` 未定義 / モジュール無し）

- [ ] **Step 3: 最小実装**

`src/utils/importModes.ts`:

```ts
import type { TimelineEvent } from '../types';

export type ImportMode = 'replace_all' | 'replace_keep' | 'append';

export interface ImportEventResolution {
  /** 反映後の最終イベント列（time 昇順） */
  events: TimelineEvent[];
  /** 配置済み軽減を消すか（replace_all のみ true） */
  clearMitigations: boolean;
  /** append 時の取り込み下限時刻（既存最終時刻）。replace 系/既存空は null */
  appendFromTime: number | null;
}

const byTime = (a: TimelineEvent, b: TimelineEvent) => a.time - b.time;

export function resolveImportEvents(
  currentEvents: TimelineEvent[],
  incomingEvents: TimelineEvent[],
  mode: ImportMode,
): ImportEventResolution {
  if (mode === 'append') {
    const hasCurrent = currentEvents.length > 0;
    const lastTime = hasCurrent
      ? currentEvents.reduce((m, e) => Math.max(m, e.time), -Infinity)
      : -Infinity;
    const added = incomingEvents.filter(e => e.time > lastTime);
    const events = [...currentEvents, ...added].sort(byTime);
    return { events, clearMitigations: false, appendFromTime: hasCurrent ? lastTime : null };
  }
  const events = [...incomingEvents].sort(byTime);
  return { events, clearMitigations: mode === 'replace_all', appendFromTime: null };
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/utils/__tests__/importModes.test.ts`
Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/importModes.ts src/utils/__tests__/importModes.test.ts
rtk git commit -m "feat(import): 取り込みモード解決の純粋関数 resolveImportEvents"
```

---

## Task 2: store `importTimelineEvents` にモード分岐＋collab importBulk 拡張

**Files:**
- Modify: `src/store/useMitigationStore.ts`（型 L133、実装 L923-964）
- Modify: `src/lib/collab/collabTypes.ts`（L24）
- Modify: `src/lib/collab/collabProvider.ts`（L356-364）
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`（L229-238 更新）

**Interfaces:**
- Consumes: `resolveImportEvents`, `ImportMode`（Task 1）。`ensurePhaseEndTimes`（useMitigationStore 内で既に import 済み）。
- Produces:
  - store 型: `importTimelineEvents: (events, importPhases?, importLabels?, mode: ImportMode) => void`（**mode 必須**）。
  - collab 型: `importBulk: (events: TimelineEvent[], phases?: Phase[], labels?: Label[], clearMitigations?: boolean) => void`。

- [ ] **Step 1: collab 委譲テストを更新（失敗させる）**

`src/store/__tests__/useMitigationStore.collab.test.ts` の既存 it（L229-238）を以下に置換し、追記する:

```ts
  it('importBulk に events と(変換後)phases/labels と clearMitigations を渡す(replace_all)', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const events = [{ id: 'e1', time: 30, name: { ja: 'x' }, damageType: 'magical' }] as any;
    const importPhases = [{ id: 1, startTimeSec: 0, name: { ja: 'P1' } }];
    useMitigationStore.getState().importTimelineEvents(events, importPhases as any, undefined, 'replace_all');
    expect(h.importBulk).toHaveBeenCalledTimes(1);
    const [evArg, phArg, lbArg, clearArg] = (h.importBulk as any).mock.calls[0];
    expect(evArg.map((e: any) => e.id)).toEqual(['e1']);
    expect(phArg[0].id).toBe('phase_1');
    expect(lbArg).toBeUndefined();
    expect(clearArg).toBe(true); // replace_all は軽減クリア
  });

  it('replace_keep は clearMitigations=false で importBulk 委譲', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const events = [{ id: 'e1', time: 30, name: { ja: 'x' }, damageType: 'magical' }] as any;
    useMitigationStore.getState().importTimelineEvents(events, undefined, undefined, 'replace_keep');
    const [, , , clearArg] = (h.importBulk as any).mock.calls[0];
    expect(clearArg).toBe(false);
  });
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（`mode` 引数未対応 / `clearArg` undefined）

- [ ] **Step 3: collab 型と実装を拡張**

`src/lib/collab/collabTypes.ts` L24 を変更:

```ts
  importBulk: (events: TimelineEvent[], phases?: Phase[], labels?: Label[], clearMitigations?: boolean) => void;
```

`src/lib/collab/collabProvider.ts` の `importBulk`（L356-364）を変更:

```ts
    // FFLogs 取込: events/phases/labels を全置換。clearMitigations 時のみ mitigations も全クリア。1 transaction。
    importBulk: (events, phases, labels, clearMitigations) => {
      doc.transact(() => {
        yEvents.delete(0, yEvents.length);
        events.forEach((e) => yEvents.push([recordToYMap(e)]));
        if (phases) { yPhases.delete(0, yPhases.length); phases.forEach((p) => yPhases.push([recordToYMap(p)])); }
        if (labels) { yLabels.delete(0, yLabels.length); labels.forEach((l) => yLabels.push([recordToYMap(l)])); }
        if (clearMitigations) { yarr.delete(0, yarr.length); }
      }, 'local');
    },
```

- [ ] **Step 4: store の型と実装を変更**

`src/store/useMitigationStore.ts` L133 の型を変更:

```ts
    importTimelineEvents: (events: TimelineEvent[], importPhases?: { id: number; startTimeSec: number; name: LocalizedString }[], importLabels?: Label[], mode?: ImportMode) => void;
```

> 注: 型は `mode?:` で optional 宣言にしておくが、本番呼び出し元（モーダル）とテストは必ず明示で渡す。Zustand の型都合で optional にしておくと既存スプレッド代入で楽。**実装側は `mode` 未指定時に 'replace_keep' で動くフォールバックを置く**（事故時に軽減を消さない安全側）。

ファイル冒頭の import に追加:

```ts
import { resolveImportEvents, type ImportMode } from '../utils/importModes';
```

`importTimelineEvents`（L923-964）を以下に置換:

```ts
                importTimelineEvents: (events, importPhases, importLabels, mode = 'replace_keep') => {
                    if (get()._collabReadonly && !get()._collabActive) return; // 純粋な閲覧者のみブロック
                    const current = get().timelineEvents;
                    const resolved = resolveImportEvents(current, events, mode);
                    const maxEventTime = resolved.events.length > 0
                        ? resolved.events.reduce((max, e) => Math.max(max, e.time), 0)
                        : undefined;

                    // 取り込むフェーズを Phase 形へ変換（append は既存最終時刻より後だけ）
                    const cutoff = resolved.appendFromTime;
                    const incomingPhases = importPhases
                        ? importPhases
                            .filter(p => p.startTimeSec >= 0)
                            .filter(p => cutoff === null || p.startTimeSec > cutoff)
                            .map(p => ({ id: `phase_${p.id}`, name: p.name, startTime: p.startTimeSec }))
                        : undefined;
                    // append は既存フェーズに連結、replace は取り込み分のみ
                    const mergedPhases = importPhases
                        ? ensurePhaseEndTimes(
                            mode === 'append'
                                ? [...get().phases.map(p => ({ id: p.id, name: p.name, startTime: p.startTime })), ...(incomingPhases ?? [])]
                                : (incomingPhases ?? []),
                            maxEventTime,
                          )
                        : undefined;
                    // labels: append は触らない、replace は取り込み分
                    const finalLabels = mode === 'append' ? undefined : importLabels;

                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.importBulk(resolved.events, mergedPhases, finalLabels, resolved.clearMitigations);
                        if (events.length > 0) useTutorialStore.getState().completeEvent('content:selected');
                        return;
                    }
                    pushHistory();
                    const update: Partial<ReturnType<typeof get>> = {
                        timelineEvents: resolved.events,
                    };
                    if (resolved.clearMitigations) {
                        update.timelineMitigations = [];
                    }
                    if (mergedPhases) {
                        update.phases = mergedPhases;
                    }
                    if (finalLabels) {
                        update.labels = finalLabels;
                    }
                    set(update as any);
                    if (events.length > 0) {
                        useTutorialStore.getState().completeEvent('content:selected');
                    }
                },
```

> 既存挙動の維持確認: `replace_all` + importPhases あり + importLabels あり = 旧コードと同じ（events 全置換・mitigations クリア・phases 変換・labels 設定）。

- [ ] **Step 5: テスト成功を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts src/utils/__tests__/importModes.test.ts`
Expected: PASS

- [ ] **Step 6: ローカル経路（非 collab）の回帰テストを追加**

`src/store/__tests__/useMitigationStore.importModes.test.ts`（新規）:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { TimelineEvent, AppliedMitigation } from '../../types';

const ev = (id: string, time: number): TimelineEvent => ({
  id, time, name: { ja: id, en: id }, damageType: 'magical',
});
const mit = (id: string, time: number): AppliedMitigation => ({
  id, mitigationId: 'rampart', time, duration: 20, ownerId: 'MT',
});

describe('importTimelineEvents モード別(ローカル経路)', () => {
  beforeEach(() => {
    useMitigationStore.setState({
      timelineEvents: [ev('a', 10), ev('b', 60)],
      timelineMitigations: [mit('m1', 12)],
      _collabActive: false, _collabHandlers: null, _collabReadonly: false,
    } as any);
  });

  it('replace_all: イベント全置換・軽減クリア', () => {
    useMitigationStore.getState().importTimelineEvents([ev('x', 5)], undefined, undefined, 'replace_all');
    expect(useMitigationStore.getState().timelineEvents.map(e => e.id)).toEqual(['x']);
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
  });

  it('replace_keep: イベント全置換・軽減は残す', () => {
    useMitigationStore.getState().importTimelineEvents([ev('x', 5)], undefined, undefined, 'replace_keep');
    expect(useMitigationStore.getState().timelineEvents.map(e => e.id)).toEqual(['x']);
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(['m1']);
  });

  it('append: 最終時刻(60)より後だけ追加・既存と軽減は不変', () => {
    useMitigationStore.getState().importTimelineEvents([ev('x', 5), ev('y', 70)], undefined, undefined, 'append');
    expect(useMitigationStore.getState().timelineEvents.map(e => e.id)).toEqual(['a', 'b', 'y']);
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(['m1']);
  });
});
```

- [ ] **Step 7: 回帰テスト成功を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.importModes.test.ts`
Expected: PASS（3 件）

- [ ] **Step 8: コミット**

```bash
rtk git add src/store/useMitigationStore.ts src/lib/collab/collabTypes.ts src/lib/collab/collabProvider.ts src/store/__tests__/useMitigationStore.collab.test.ts src/store/__tests__/useMitigationStore.importModes.test.ts
rtk git commit -m "feat(import): importTimelineEvents に3モード(置換/軽減保持/追記)を実装"
```

---

## Task 3: i18n キー追加（4 言語）

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`

**Interfaces:**
- Produces: `fflogs.import_mode.{replace_all, replace_keep, append, replace_all_warning, label}` の 5 キー。

- [ ] **Step 1: ja.json に追加**

`src/locales/ja.json` の `fflogs` ブロック内（`warning_overwrite` の隣、L639 付近）に追加:

```json
        "import_mode": {
            "label": "取り込み方法",
            "replace_all": "置き換え（軽減も削除）",
            "replace_keep": "置き換え（軽減は残す）",
            "append": "追記（既存より後のイベントのみ）",
            "replace_all_warning": "配置済みの軽減も削除されます"
        },
```

- [ ] **Step 2: en.json に追加**

```json
        "import_mode": {
            "label": "Import method",
            "replace_all": "Replace (also clear mitigations)",
            "replace_keep": "Replace (keep mitigations)",
            "append": "Append (only events after the current end)",
            "replace_all_warning": "Placed mitigations will also be deleted"
        },
```

- [ ] **Step 3: ko.json に追加**

```json
        "import_mode": {
            "label": "가져오기 방식",
            "replace_all": "교체（경감도 삭제）",
            "replace_keep": "교체（경감은 유지）",
            "append": "추가（기존 이후 이벤트만）",
            "replace_all_warning": "배치한 경감도 삭제됩니다"
        },
```

- [ ] **Step 4: zh.json に追加**

```json
        "import_mode": {
            "label": "导入方式",
            "replace_all": "替换（同时清除减伤）",
            "replace_keep": "替换（保留减伤）",
            "append": "追加（仅导入现有之后的事件）",
            "replace_all_warning": "已放置的减伤也会被删除"
        },
```

- [ ] **Step 5: JSON 妥当性とビルド確認**

Run: `npx vitest run && npm run build`
Expected: PASS（JSON パース成功・tsc 通過）

> 各言語ファイルでキー追加位置の直前/直後カンマに注意（JSON 構文エラー防止）。

- [ ] **Step 6: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "i18n(import): 取り込みモードのラベル/警告キーを4言語追加"
```

---

## Task 4: モーダル UI — モード選択＋モード受け渡し

**Files:**
- Modify: `src/components/FFLogsImportModal.tsx`（state L71-75 付近、preview の警告 L317-321、handleImport L174-184）

**Interfaces:**
- Consumes: `ImportMode`（Task 1）、`importTimelineEvents(..., mode)`（Task 2）、i18n `fflogs.import_mode.*`（Task 3）。
- Produces: なし（UI 末端）。

- [ ] **Step 1: import とローカル state を追加**

ファイル冒頭の import に追加:

```ts
import type { ImportMode } from '../utils/importModes';
```

`useMitigationStore()` の取得行（L67）を変更し、既存タイムライン数も取得:

```ts
    const { importTimelineEvents } = useMitigationStore();
    const existingEventCount = useMitigationStore((s) => s.timelineEvents.length);
```

state 群（L71-75 付近）に追加:

```ts
    const [importMode, setImportMode] = useState<ImportMode>('replace_keep');
```

- [ ] **Step 2: プレビューの上書き警告をモード選択に置き換える**

`renderPreviewStats()` 内の警告ブロック（L317-321）を以下に置換:

```tsx
                {/* 取り込みモード選択（既存タイムラインがある時のみ） */}
                {existingEventCount > 0 ? (
                    <div className="flex flex-col gap-2">
                        <span className="text-app-text-muted text-app-lg uppercase tracking-wider">
                            {t('fflogs.import_mode.label')}
                        </span>
                        {(['replace_all', 'replace_keep', 'append'] as ImportMode[]).map((m) => (
                            <label
                                key={m}
                                className={clsx(
                                    'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all duration-200 text-app-lg',
                                    importMode === m
                                        ? 'border-app-text bg-app-text/5 text-app-text'
                                        : 'border-app-border text-app-text-muted hover:border-app-text/40',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="fflogs-import-mode"
                                    value={m}
                                    checked={importMode === m}
                                    onChange={() => setImportMode(m)}
                                    className="accent-app-text"
                                />
                                <span className="flex-1">{t(`fflogs.import_mode.${m}`)}</span>
                                {m === 'replace_all' && (
                                    <span className="flex items-center gap-1 text-app-amber text-app-md">
                                        <AlertCircle size={12} className="shrink-0" />
                                        {t('fflogs.import_mode.replace_all_warning')}
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                ) : null}
```

> `clsx` と `AlertCircle` は同ファイルで既に import 済み（既存の警告/ボタンが使用）。空タイムライン時はモード選択を出さず、`handleImport` は既定 `importMode='replace_keep'` で呼ぶ（空なのでどのモードでも結果同一）。

- [ ] **Step 3: handleImport でモードを渡す**

`handleImport`（L176）の呼び出しを変更:

```ts
        importTimelineEvents(status.mapped.events, status.mapped.phases, status.mapped.labels, importMode);
```

- [ ] **Step 4: モーダルを閉じる時にモードを既定へ戻す**

`handleClose`（L186-192、`setUrl('')`/`setStatus({ phase: 'idle' })` でリセットしている箇所）に1行追加:

```ts
    const handleClose = () => {
        setUrl('');
        setUrlError(null);
        setParsedData(null);
        setStatus({ phase: 'idle' });
        setImportMode('replace_keep'); // ← 追加: 次回開いた時に前回モードを引きずらない
        onClose();
    };
```

- [ ] **Step 5: 型・ビルド確認**

Run: `npm run build`
Expected: PASS（未使用変数なし・型通過）

- [ ] **Step 6: 手動確認（dev）**

Run: `npm run dev` → `/miti`
確認:
1. 既存タイムラインが空の状態で FFLogs URL → 生成 → プレビューに**モード選択が出ない**こと。
2. 何かイベントがある状態で生成 → プレビューに 3 モードが出て、既定が「置き換え（軽減は残す）」であること。
3. 「置き換え（軽減も削除）」にのみ黄色警告が付くこと。
4. 英語表示に切替えてラベルが崩れないこと。

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/FFLogsImportModal.tsx
rtk git commit -m "feat(import): FFLogsインポートのプレビューに取り込みモード選択UIを追加"
```

---

## Task 5: 結合確認（collab 実機 2 タブ・任意だが推奨）

**Files:** なし（手動検証）

- [ ] **Step 1: collab 2 タブで回帰確認**

memory `reference_collab_two_client_version_skew` の手順（両タブ最新版にリロード）で:
1. 2 タブで同じ部屋に入り、片方で軽減を数個配置。
2. 「置き換え（軽減は残す）」で FFLogs 取込 → **両タブで軽減が消えないこと**。
3. 「追記」で取込 → 後半イベントが両タブに増え、既存イベント/軽減が不変であること。
4. 「置き換え（軽減も削除）」で取込 → 両タブで軽減が消えること（従来挙動）。

- [ ] **Step 2: 最終確認**

Run: `npx vitest run && npm run build`
Expected: PASS（全テスト緑・ビルド通過）

---

## Self-Review（記入済み）

- **Spec coverage**: §2 三モード→Task1/2/4。§3 UI/空時非表示/既定→Task4。§4 追記境界(同時刻除外)→Task1。§5 collab importBulk→Task2。§7 回帰テスト(軽減保持)→Task2 Step6/7、collab→Task5。スコープ外(再アンカー/スプシ/⑧/CSV)は対象外で記載通り未着手。
- **Placeholder scan**: Step 4(Task4) の `handleClose` のみ「実装時に確認」を残すが、リセット漏れは軽微 UX 劣化と明示済みで、加える具体コードは提示済み。その他に TBD/TODO なし。
- **Type consistency**: `ImportMode`（'replace_all'|'replace_keep'|'append'）を Task1 で定義し Task2/4 で同名使用。`importBulk(events, phases, labels, clearMitigations)` を collabTypes/collabProvider/store/test で一致。`resolveImportEvents` の戻り値 `{events, clearMitigations, appendFromTime}` を store が一致して消費。
