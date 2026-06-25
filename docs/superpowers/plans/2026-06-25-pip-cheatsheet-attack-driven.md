# PiP カンペ「攻撃の全リスト基準」化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PiP カンペを軽減ドリブンから攻撃ドリブンに変え、名前付き攻撃を全部行に出す（AA除外）＋軽減だけの時刻も空欄行で出す。

**Architecture:** 純粋関数 `computeCueItems` を書き換え（行＝非AA攻撃のある全時刻 ∪ 選択メンバー軽減のある時刻）。ビュー `PipView` は空欄行ガードと空状態文言を追従。i18n に空状態キーを1つ追加。

**Tech Stack:** TypeScript / React / Zustand / Vitest / i18next。

## Global Constraints

- AA 判定: `name.ja === 'AA' || name.en === 'AA'`（generateAAEvents が両方 'AA' でセット・guid無し）。
- メンバー選択は軽減アイコンの絞り込みのみ。攻撃行は選択に依存せず常に全部出す。空選択 → 攻撃行のみ・軽減だけの行は消える。
- 同時刻イベントの優先度順は現状維持: AoE > 単体(MT/ST) > 未設定、同列は id 昇順。
- i18n は ja/en/ko/zh の4言語 parity 維持。該当ブロックだけ textual 編集（全体 parse→stringify しない）。
- push 前に `npm run build` + `npx vitest run` 必須（Vercel は tsc -b 厳密）。

---

### Task 1: `computeCueItems` を攻撃ドリブンに書き換え

**Files:**
- Modify: `src/utils/pipViewLogic.ts:24-54`（`computeCueItems` 本体）
- Test: `src/__tests__/pipViewLogic.test.ts`（`describe('computeCueItems')` ブロックを全面書き換え。`computeInitialSelection`/`getDefaultBgColor`/`isBgLight` の describe は変更しない）

**Interfaces:**
- Consumes: `TimelineEvent`（`{ id, time, name: {ja,en,ko,zh}, target?, ... }`）、`AppliedMitigation`（`{ id, time, ownerId, mitigationId, duration }`）、`CueGroup`（`{ time, events: TimelineEvent[], mitigations: AppliedMitigation[] }`）。
- Produces: `computeCueItems(events: TimelineEvent[], mitigations: AppliedMitigation[], selectedMemberIds: Set<string>): CueGroup[]`。各 CueGroup は `events`（非AAのみ・空配列あり）と `mitigations`（選択メンバー分のみ・空配列あり）を持ち、`events` と `mitigations` の少なくとも一方は非空。時刻昇順。

- [ ] **Step 1: テストを書き換えて失敗させる**

`src/__tests__/pipViewLogic.test.ts` の先頭ヘルパに AA 用ヘルパを追加し（`evt`/`miti` はそのまま残す）、`describe('computeCueItems', ...)` ブロックの中身を以下で**置き換える**:

```ts
// 既存の evt / miti ヘルパの下に追加
const aaEvt = (id: string, time: number, target: 'MT' | 'ST' = 'MT'): TimelineEvent => ({
    id,
    time,
    name: { ja: 'AA', en: 'AA', ko: 'AA', zh: 'AA' },
    damageType: 'physical',
    target,
} as TimelineEvent);

describe('computeCueItems', () => {
    it('非AA攻撃を全部行にする（軽減ゼロでも）', () => {
        const events = [evt('e1', 10), evt('e2', 20)];
        const result = computeCueItems(events, [], new Set(['MT']));
        expect(result.map(r => r.time)).toEqual([10, 20]);
        expect(result.every(r => r.mitigations.length === 0)).toBe(true);
    });

    it('AAだけの時刻は軽減が無ければ行にしない', () => {
        const events = [aaEvt('a1', 10)];
        const result = computeCueItems(events, [], new Set(['MT']));
        expect(result).toEqual([]);
    });

    it('AAだけの時刻に選択メンバー軽減があれば空欄行(events空)で出す', () => {
        const events = [aaEvt('a1', 10)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result).toHaveLength(1);
        expect(result[0].events).toEqual([]);
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });

    it('イベントの無い時刻に選択メンバー軽減があれば空欄行で出す', () => {
        const events = [evt('e1', 20)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result.map(r => r.time)).toEqual([10, 20]);
        const r10 = result.find(r => r.time === 10)!;
        expect(r10.events).toEqual([]);
        expect(r10.mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });

    it('実攻撃とAAが同時刻なら events に実攻撃だけ残す', () => {
        const events = [evt('e1', 10, 'AoE'), aaEvt('a1', 10, 'MT')];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result).toHaveLength(1);
        expect(result[0].events.map(e => e.id)).toEqual(['e1']);
    });

    it('メンバー選択は攻撃行に影響せずアイコンのみ絞る／空選択で軽減だけの行は消える', () => {
        const events = [evt('e1', 10), evt('e2', 20)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart'), miti('m2', 30, 'MT', 'reprisal')];
        const sel = computeCueItems(events, mitigations, new Set(['MT']));
        expect(sel.map(r => r.time)).toEqual([10, 20, 30]); // 30 は軽減だけの空欄行
        const none = computeCueItems(events, mitigations, new Set());
        expect(none.map(r => r.time)).toEqual([10, 20]); // 攻撃のみ・30は消える
        expect(none.every(r => r.mitigations.length === 0)).toBe(true);
    });

    it('時刻昇順 + 同時刻は優先度順(AoE>単体>未設定, 同列id昇順)', () => {
        const events = [evt('a-undef', 10, undefined), evt('b-st', 10, 'ST'), evt('c-aoe', 10, 'AoE'), evt('d-mt', 10, 'MT')];
        const mitigations = [miti('m1', 10, 'MT', 'rampart')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].events.map(e => e.id)).toEqual(['c-aoe', 'b-st', 'd-mt', 'a-undef']);
    });

    it('非選択メンバーの軽減はアイコンに出さない', () => {
        const events = [evt('e1', 10)];
        const mitigations = [miti('m1', 10, 'MT', 'rampart'), miti('m2', 10, 'H1', 'sacred_soil')];
        const result = computeCueItems(events, mitigations, new Set(['MT']));
        expect(result[0].mitigations.map(m => m.mitigationId)).toEqual(['rampart']);
    });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認**

Run: `npx vitest run src/__tests__/pipViewLogic.test.ts`
Expected: FAIL（旧 `computeCueItems` は軽減ゼロや空選択で `[]` を返すため、新テストが落ちる）

- [ ] **Step 3: `computeCueItems` を書き換え**

`src/utils/pipViewLogic.ts` の `computeCueItems`（24-54行）を以下で置き換える。`eventPriority`（12-17行）と `CueGroup` interface（3-10行）はそのまま残す。`isAAEvent` ヘルパを `eventPriority` の下に追加:

```ts
/** AA(オートアタック)イベント判定。generateAAEvents が name を ja/en とも 'AA' でセットする。 */
function isAAEvent(e: TimelineEvent): boolean {
    return e.name?.ja === 'AA' || e.name?.en === 'AA';
}

/**
 * カンペ行を「攻撃ドリブン」で算出する。
 * 行 = 非AA攻撃のある全時刻 ∪ 選択メンバーの軽減が置かれた時刻。
 * - events: その時刻の非AAイベントのみ(優先度順)。AAだけ/無しの時刻では空配列。
 * - mitigations: その時刻の選択メンバー分のみ。
 * 各行は events と mitigations の少なくとも一方が非空。時刻昇順で返す。
 * メンバー選択は軽減アイコンの絞り込みのみで、攻撃行は選択に依存しない。
 */
export function computeCueItems(
    events: TimelineEvent[],
    mitigations: AppliedMitigation[],
    selectedMemberIds: Set<string>,
): CueGroup[] {
    const filteredMitis = mitigations.filter(m => selectedMemberIds.has(m.ownerId));

    // 非AAイベントを時刻ごとに集約
    const nonAAByTime = new Map<number, TimelineEvent[]>();
    for (const e of events) {
        if (isAAEvent(e)) continue;
        const list = nonAAByTime.get(e.time) ?? [];
        list.push(e);
        nonAAByTime.set(e.time, list);
    }

    // 行にする時刻 = 非AA攻撃のある時刻 ∪ 選択メンバー軽減のある時刻
    const times = new Set<number>(nonAAByTime.keys());
    for (const m of filteredMitis) times.add(m.time);

    return [...times]
        .sort((a, b) => a - b)
        .map(time => ({
            time,
            events: [...(nonAAByTime.get(time) ?? [])].sort((a, b) => {
                const pd = eventPriority(a) - eventPriority(b);
                if (pd !== 0) return pd;
                return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
            }),
            mitigations: filteredMitis.filter(m => m.time === time),
        }));
}
```

- [ ] **Step 4: テストを走らせて緑を確認**

Run: `npx vitest run src/__tests__/pipViewLogic.test.ts`
Expected: PASS（全 describe 緑）

- [ ] **Step 5: コミット**

```bash
git add src/utils/pipViewLogic.ts src/__tests__/pipViewLogic.test.ts
git commit -m "feat(pip): カンペを攻撃ドリブン化(全攻撃表示・AA除外・軽減だけの行も表示)"
```

---

### Task 2: 空状態 i18n キー `pip_no_events` を4言語に追加

**Files:**
- Modify: `src/locales/ja.json:536`、`src/locales/en.json:532`、`src/locales/ko.json:524`、`src/locales/zh.json:524`（いずれも `pip_no_mitigations` 行の直後に1行追加）

**Interfaces:**
- Produces: i18n キー `timeline.pip_no_events`（ja/en/ko/zh）。Task 3 の `PipView` が `t('timeline.pip_no_events')` で参照。

- [ ] **Step 1: 各ロケールにキーを追加**

`pip_no_mitigations` の行の直後に、それぞれ次の1行を追加する（既存行・前後は触らない・末尾カンマに注意）:

`src/locales/ja.json`（`"pip_no_mitigations": "軽減が配置されていません",` の直後）:
```json
        "pip_no_events": "表示する攻撃がありません",
```

`src/locales/en.json`（`"pip_no_mitigations": "No mitigations placed",` の直後）:
```json
        "pip_no_events": "No attacks to show",
```

`src/locales/ko.json`（`"pip_no_mitigations": "경감이 배치되지 않았습니다",` の直後）:
```json
        "pip_no_events": "표시할 공격이 없습니다",
```

`src/locales/zh.json`（`"pip_no_mitigations": "未配置减伤",` の直後）:
```json
        "pip_no_events": "没有可显示的攻击",
```

- [ ] **Step 2: JSON が壊れていないか確認**

Run: `node -e "for (const f of ['ja','en','ko','zh']) { JSON.parse(require('fs').readFileSync('src/locales/'+f+'.json','utf8')); console.log(f, 'OK'); }"`
Expected: `ja OK` / `en OK` / `ko OK` / `zh OK`（parse 例外が出ない）

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "i18n(pip): カンペ空状態キー pip_no_events を4言語追加"
```

---

### Task 3: `PipView` を空欄行・空状態文言に追従

**Files:**
- Modify: `src/components/PipView.tsx:307-419`（空状態メッセージのキー差し替え + 行描画の空配列ガード）

**Interfaces:**
- Consumes: Task 1 の `computeCueItems` 経由の `cueGroups`（`events` が空配列の行がありうる）、Task 2 の `timeline.pip_no_events`。

- [ ] **Step 1: 空状態メッセージのキーを差し替え**

`src/components/PipView.tsx` の空状態（307-313行付近）の `{t('timeline.pip_no_mitigations')}` を `{t('timeline.pip_no_events')}` に変更する:

```tsx
                {cueGroups.length === 0 ? (
                    <p className={clsx(
                        "text-current/40 text-center",
                        isFs ? "text-base mt-8" : "text-[10px] mt-4",
                    )}>
                        {t('timeline.pip_no_events')}
                    </p>
                ) : (
```

- [ ] **Step 2: 行描画の先頭で空配列ガードを入れる**

316-319行の `cueGroups.map(...)` 冒頭の3行を置き換える:

置換前:
```tsx
                        {cueGroups.map(({ time, events, mitigations }, i) => {
                            const idx = (eventIndexByTime[time] ?? 0) % events.length;
                            const event = events[idx];
                            const hasExtra = events.length > 1;
```
置換後:
```tsx
                        {cueGroups.map(({ time, events, mitigations }, i) => {
                            const hasEvent = events.length > 0;
                            const idx = hasEvent ? (eventIndexByTime[time] ?? 0) % events.length : 0;
                            const event = hasEvent ? events[idx] : null;
                            const hasExtra = events.length > 1;
```

- [ ] **Step 3: 攻撃名エリアを `event` 有無でガード**

攻撃名エリアの `<div className={clsx("flex-1 min-w-0 flex items-center", ...)}>`（338-341行付近）の**中身全体**を `{event && (<>...</>)}` で包む。これにより `event` が null の行は flex-1 のスペーサーだけが残り、軽減アイコンが右に寄る。置換前の中身（342-396行: `{!isFs && editingEventId === event.id ? (...) : (...)}` と `{hasExtra && (...)}`）を次の形にする:

```tsx
                                    <div className={clsx(
                                        "flex-1 min-w-0 flex items-center",
                                        isFs ? "gap-1.5" : "gap-1",
                                    )}>
                                        {event && (<>
                                            {!isFs && editingEventId === event.id ? (
                                                <input
                                                    ref={editInputRef}
                                                    defaultValue={notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                                    onBlur={(e) => handleEditConfirm(event.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleEditConfirm(event.id, (e.target as HTMLInputElement).value);
                                                        if (e.key === 'Escape') setEditingEventId(null);
                                                    }}
                                                    className="flex-1 min-w-0 bg-current/10 border border-current/30 rounded outline-none text-[10px] px-1 py-0"
                                                    style={{ color: fgColor }}
                                                />
                                            ) : (
                                                <>
                                                    <span
                                                        onDoubleClick={!isFs ? () => handleDoubleClick(event.id) : undefined}
                                                        onClick={isFs ? () => setMenuTime(time) : undefined}
                                                        className={clsx(
                                                            "min-w-0 truncate leading-tight text-current/80",
                                                            isFs ? "text-[17px] font-bold cursor-pointer" : "text-[10px] cursor-text",
                                                        )}
                                                        title={t('timeline.pip_edit_hint')}
                                                    >
                                                        {notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
                                                    </span>
                                                    {notes[event.id] && (
                                                        <button
                                                            onClick={() => updateNote(event.id, '')}
                                                            className={clsx(
                                                                "shrink-0 rounded opacity-50 hover:opacity-100 hover:bg-current/10 text-current/70 transition-opacity cursor-pointer",
                                                                isFs ? "p-1" : "p-0.5",
                                                            )}
                                                            title={t('timeline.pip_reset_note')}
                                                            aria-label={t('timeline.pip_reset_note')}
                                                        >
                                                            <X size={isFs ? 14 : 10} />
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {hasExtra && (
                                                <button
                                                    onClick={() => cycleEventAtTime(time, events.length)}
                                                    className={clsx(
                                                        "shrink-0 rounded bg-current/10 hover:bg-current/25 text-current/60 hover:text-current font-mono cursor-pointer transition-colors",
                                                        isFs ? "px-1.5 py-0.5 text-xs" : "px-1 text-[8px]",
                                                    )}
                                                    title={t('timeline.pip_switch_event')}
                                                >
                                                    +{events.length - 1}
                                                </button>
                                            )}
                                        </>)}
                                    </div>
```

- [ ] **Step 4: 型チェック + ビルドが通ることを確認**

Run: `npm run build`
Expected: 成功（tsc -b でエラー無し。特に `event` が null 可能になったことによる未ガード参照が無いこと）

- [ ] **Step 5: 全テスト + ビルドの最終確認**

Run: `npx vitest run`
Expected: PASS（既存スイートも緑。`pipViewLogic.test.ts` 含む）

- [ ] **Step 6: コミット**

```bash
git add src/components/PipView.tsx
git commit -m "feat(pip): カンペ空欄行(攻撃なし)対応と空状態文言を pip_no_events に差し替え"
```

---

## 実機検証（実装後・本番投入前）

`npm run dev` で PiP/スマホ全画面カンペを開き、軽減を配置したプランで:
- 軽減未配置の攻撃も含めて攻撃が全部出る。
- AA が行として出ない。
- AA / 何も無い時刻に置いた軽減が空欄行（時刻＋アイコンのみ）で出る。
- メンバーを絞るとアイコンだけ変わり、攻撃行は不変。全員外すと攻撃のみ・軽減だけの行は消える。
- 攻撃のある行はメモ編集可、空欄行はメモ UI 無し。
- スマホ全画面でも同様（空欄行タップでモーダルが開かない＝攻撃名が無いので想定どおり）。

## Self-Review

- **Spec coverage**: 表示ルール(集合1∪集合2)=Task1 / AA除外=Task1 isAAEvent / メンバー選択の役割=Task1+テスト6 / 空欄行=Task3 Step2-3 / メモ編集不可=Task3 Step3(event null で UI 非表示) / 空状態文言=Task2+Task3 Step1 / 非対象(他画面)=触らない。全網羅。
- **Placeholder scan**: TBD/TODO 無し。各 Step に実コード・実コマンド・期待出力あり。
- **Type consistency**: `computeCueItems` のシグネチャ/`CueGroup` 形は Task1 と Task3 で一致。`isAAEvent`/`hasEvent`/`event: TimelineEvent | null` 一貫。i18n キー `timeline.pip_no_events` は Task2 定義・Task3 参照で一致。
