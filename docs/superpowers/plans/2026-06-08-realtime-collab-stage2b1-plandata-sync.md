# 共同編集 段取り②-b-1（軽量 PlanData ライブ同期）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ②-a（`timelineMitigations` のみ同期）を additive 拡張し、`timelineEvents` / `phases` / `labels` / `memos` / `aaSettings` / `currentLevel` / `schAetherflowPatterns` を Yjs でライブ同期＋ Firestore 恒久保存する（UI 非露出・main dormant）。

**Architecture:** ②-a の「委譲方式」を踏襲。共同編集中、store の各 mutation は **計算した変更分（delta）を汎用ハンドラ（`upsertItems`/`removeItems`/`setMeta`/`importBulk`）に渡して early-return**（`pushHistory`/local `set` スキップ）。ハンドラが Y 操作 → `observeDeep` → store の `_apply*FromCollab` が反映。Y.Doc が唯一の正。クリッピング等の連鎖は store 側が計算した結果のみを delta として送るため Y-land に再実装しない。

**Tech Stack:** Yjs / y-partyserver（client `YProvider` + worker `YServer` on Cloudflare Durable Objects）/ Firestore（Vercel Node Function 受付係）/ Zustand store / Vitest（root は vmThreads・worker は `@cloudflare/vitest-pool-workers`）。

**設計書:** [docs/superpowers/specs/2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md](../specs/2026-06-08-realtime-collab-stage2b1-plandata-sync-design.md)

**前提（必読）:**
- ②-a 同期エンジン: [src/lib/collab/collabProvider.ts](../../../src/lib/collab/collabProvider.ts) / [yjsMitigations.ts](../../../src/lib/collab/yjsMitigations.ts) / [collabTypes.ts](../../../src/lib/collab/collabTypes.ts)
- worker: [workers/collab/src/server.ts](../../../workers/collab/src/server.ts) / [yjsMitigations.ts](../../../workers/collab/src/yjsMitigations.ts) / [collabPersistence.ts](../../../workers/collab/src/collabPersistence.ts)
- 受付係: [api/collab/_logic.ts](../../../api/collab/_logic.ts) / [_loadHandler.ts](../../../api/collab/_loadHandler.ts) / [_saveHandler.ts](../../../api/collab/_saveHandler.ts)
- store: [src/store/useMitigationStore.ts](../../../src/store/useMitigationStore.ts)
- **commit はタスク毎。push / worker `wrangler deploy` はしない（最終 Task で整合確認のみ。デプロイは別途ユーザー承認）。**
- **branch:** main から新規ブランチ `feat/collab-stage2b1-plandata-sync` で開始（dormant engine）。⑤-3a の `feat/collab-stage5-3a-owner-entry` は held のまま触らない。

**テスト実行コマンド（vmThreads ハング回避のため出力をパイプしない・memory `reference_vitest_vmthreads_hang`）:**
- root 単体: `npx vitest run <path>`
- root 全体: `npm test`
- worker: `npm --prefix workers/collab test`
- build: `npm run build`

---

## Task 0: ブランチ作成

- [ ] **Step 1: main 最新化して新ブランチ**

```bash
git checkout main
git pull
git checkout -b feat/collab-stage2b1-plandata-sync
```

---

## Task 1: クライアント Y 変換ヘルパ `src/lib/collab/yjsPlanData.ts`

汎用の record⇄Y.Map 変換、id キー配列の upsert/remove、planMeta 読み書き、slice 読み取りを 1 ファイルに集約。②-a の `yjsMitigations.ts`（[src/lib/collab/yjsMitigations.ts](../../../src/lib/collab/yjsMitigations.ts)）と同じ責務分離で additive 追加。

**Files:**
- Create: `src/lib/collab/yjsPlanData.ts`
- Test: `src/lib/collab/__tests__/yjsPlanData.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/collab/__tests__/yjsPlanData.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { TimelineEvent, Phase } from "../../../types";
import {
  recordToYMap, yMapToRecord, indexOfById, readArray, applyUpsert, applyRemove,
  readPlanMeta, setMetaField,
  TIMELINE_EVENTS_KEY, PHASES_KEY, PLAN_META_KEY, META_LEVEL, META_AA, META_SCH,
} from "../yjsPlanData";

function bridge(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== b) Y.applyUpdate(b, u, a); });
  b.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== a) Y.applyUpdate(a, u, b); });
}
const ev = (over: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: "e1", time: 30, name: { ja: "ボス技", en: "Boss" }, damageType: "magical", ...over,
});
const ph = (over: Partial<Phase> = {}): Phase => ({
  id: "p1", name: { ja: "P1", en: "P1" }, startTime: 0, endTime: 60, ...over,
});

describe("yjsPlanData 変換", () => {
  it("recordToYMap → yMapToRecord で入れ子(LocalizedString)含め往復一致", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY);
    arr.push([recordToYMap(ev({ damageAmount: 9999, warning: true }))]);
    expect(yMapToRecord<TimelineEvent>(arr.get(0))).toEqual(ev({ damageAmount: 9999, warning: true }));
  });
  it("undefined フィールドは set されない(false/空文字に化けない)", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY);
    arr.push([recordToYMap(ev())]);
    const back = yMapToRecord<TimelineEvent>(arr.get(0));
    expect(back.warning).toBeUndefined();
    expect(back.damageAmount).toBeUndefined();
  });
});

describe("yjsPlanData CRDT 同期(配列・id 単位マージ)", () => {
  it("upsert(新規=push) が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(TIMELINE_EVENTS_KEY), [ev({ id: "x" })]);
    expect(readArray<TimelineEvent>(b, TIMELINE_EVENTS_KEY)).toEqual([ev({ id: "x" })]);
  });
  it("upsert(既存=部分更新)で指定フィールドだけ変わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(TIMELINE_EVENTS_KEY), [ev({ id: "x", time: 30 })]);
    applyUpsert(a.getArray(TIMELINE_EVENTS_KEY), [{ id: "x", time: 45 } as TimelineEvent]);
    const got = readArray<TimelineEvent>(b, TIMELINE_EVENTS_KEY)[0];
    expect(got.time).toBe(45);
    expect(got.name).toEqual({ ja: "ボス技", en: "Boss" }); // 他フィールド保持
  });
  it("同時 upsert(別 id)は両方残る", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(PHASES_KEY), [ph({ id: "a1" })]);
    applyUpsert(b.getArray(PHASES_KEY), [ph({ id: "b1" })]);
    expect(readArray<Phase>(a, PHASES_KEY).map((p) => p.id).sort()).toEqual(["a1", "b1"]);
  });
  it("applyRemove(id) が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(PHASES_KEY), [ph({ id: "x" })]);
    applyRemove(a.getArray(PHASES_KEY), ["x"]);
    expect(readArray<Phase>(b, PHASES_KEY)).toEqual([]);
  });
  it("indexOfById は無ければ -1", () => {
    const doc = new Y.Doc();
    expect(indexOfById(doc.getArray(PHASES_KEY), "none")).toBe(-1);
  });
});

describe("yjsPlanData planMeta(スカラー・フィールド単位後勝ち)", () => {
  it("setMetaField → readPlanMeta 往復", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    setMetaField(a, META_LEVEL, 90);
    setMetaField(a, META_AA, { damage: 100, type: "magical", target: "MT" });
    setMetaField(a, META_SCH, { H2: 2 });
    expect(readPlanMeta(b)).toEqual({
      currentLevel: 90,
      aaSettings: { damage: 100, type: "magical", target: "MT" },
      schAetherflowPatterns: { H2: 2 },
    });
  });
  it("未設定の planMeta は全フィールド undefined", () => {
    const doc = new Y.Doc();
    doc.getMap(PLAN_META_KEY); // ensure exists
    expect(readPlanMeta(doc)).toEqual({ currentLevel: undefined, aaSettings: undefined, schAetherflowPatterns: undefined });
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: FAIL（`Cannot find module '../yjsPlanData'`）

- [ ] **Step 3: 最小実装**

`src/lib/collab/yjsPlanData.ts`:

```ts
import * as Y from "yjs";
import type { TimelineEvent, Phase, Label, PlanMemo } from "../../types";

/** ②-b-1 で同期する Y.Doc トップレベルのキー(②-a の timelineMitigations と並ぶ)。 */
export const TIMELINE_EVENTS_KEY = "timelineEvents";
export const PHASES_KEY = "phases";
export const LABELS_KEY = "labels";
export const MEMOS_KEY = "memos";
export const PLAN_META_KEY = "planMeta";

/** planMeta(Y.Map)内のスカラーキー。 */
export const META_LEVEL = "currentLevel";
export const META_AA = "aaSettings";
export const META_SCH = "schAetherflowPatterns";

/** 配列同期キーの型(events/phases/labels/memos)。 */
export type PlanArrayKey =
  | typeof TIMELINE_EVENTS_KEY | typeof PHASES_KEY | typeof LABELS_KEY | typeof MEMOS_KEY;

/** AASettings 型(PlanData.aaSettings 相当・store の setAaSettings と同一)。 */
export interface AASettings {
  damage: number;
  type: "physical" | "magical" | "unavoidable";
  target: "MT" | "ST";
}

export interface PlanMetaSlice {
  currentLevel?: number;
  aaSettings?: AASettings;
  schAetherflowPatterns?: Record<string, 1 | 2>;
}

/** プレーン record(id 必須)→ Y.Map。undefined は set しない(②-a appliedToYMap と同方針)。 */
export function recordToYMap<T extends { id: string }>(rec: T): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(rec)) {
    if (v !== undefined) y.set(k, v);
  }
  return y;
}

/** Y.Map → record。toJSON で入れ子オブジェクト(LocalizedString 等)も復元。 */
export function yMapToRecord<T>(y: Y.Map<unknown>): T {
  return y.toJSON() as T;
}

/** id 一致要素の index(なければ -1)。 */
export function indexOfById(arr: Y.Array<Y.Map<unknown>>, id: string): number {
  for (let i = 0; i < arr.length; i++) if (arr.get(i).get("id") === id) return i;
  return -1;
}

/** Y.Doc 配列キーを plain record 配列で読む。 */
export function readArray<T>(doc: Y.Doc, key: string): T[] {
  return doc.getArray<Y.Map<unknown>>(key).toArray().map((y) => yMapToRecord<T>(y));
}

/** delta upsert: 既存 id は与えられたフィールドだけ set(部分更新)、新規 id は push(全フィールド)。 */
export function applyUpsert(arr: Y.Array<Y.Map<unknown>>, items: Array<{ id: string }>): void {
  for (const item of items) {
    const idx = indexOfById(arr, item.id);
    if (idx < 0) {
      arr.push([recordToYMap(item)]);
    } else {
      const ym = arr.get(idx);
      for (const [k, v] of Object.entries(item)) {
        if (v !== undefined && ym.get(k) !== v) ym.set(k, v);
      }
    }
  }
}

/** delta remove: id 配列を順に削除(毎回 index 取り直しで index ずれに安全)。 */
export function applyRemove(arr: Y.Array<Y.Map<unknown>>, ids: string[]): void {
  for (const id of ids) {
    const idx = indexOfById(arr, id);
    if (idx >= 0) arr.delete(idx, 1);
  }
}

/** planMeta の 1 フィールドを set。 */
export function setMetaField(doc: Y.Doc, field: string, value: unknown): void {
  doc.getMap(PLAN_META_KEY).set(field, value);
}

/** planMeta を slice で読む。 */
export function readPlanMeta(doc: Y.Doc): PlanMetaSlice {
  const meta = doc.getMap(PLAN_META_KEY);
  return {
    currentLevel: meta.get(META_LEVEL) as number | undefined,
    aaSettings: meta.get(META_AA) as AASettings | undefined,
    schAetherflowPatterns: meta.get(META_SCH) as Record<string, 1 | 2> | undefined,
  };
}

/** 型エクスポート(consumer の参照用)。 */
export type { TimelineEvent, Phase, Label, PlanMemo };
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/lib/collab/__tests__/yjsPlanData.test.ts`
Expected: PASS（全 9 件）

- [ ] **Step 5: commit**

```bash
git add src/lib/collab/yjsPlanData.ts src/lib/collab/__tests__/yjsPlanData.test.ts
git commit -m "feat(collab): ②-b-1 クライアントY変換ヘルパ(record⇄Y.Map/upsert/remove/planMeta)"
```

---

## Task 2: worker Y 変換ミラー `workers/collab/src/yjsPlanData.ts`

worker が seed(Firestore→Y.Doc)/書き戻し(Y.Doc→plain)するための変換。**Task 1 と構造同一のミラー**（別パッケージのため複製。worker はフィールド型を見ないので generic `Record<string, unknown>` で扱う）。既存 `yjsMitigations.ts`（mitigations 専用・[workers/collab/src/yjsMitigations.ts](../../../workers/collab/src/yjsMitigations.ts)）は無改変で残す。

**Files:**
- Create: `workers/collab/src/yjsPlanData.ts`
- Test: `workers/collab/src/yjsPlanData.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`workers/collab/src/yjsPlanData.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  buildSeedDocFull, readPlanDataFull, type PlanDataSeed,
} from "./yjsPlanData";

const seed: PlanDataSeed = {
  mitigations: [{ id: "m1", mitigationId: "rampart", time: 10, duration: 20, ownerId: "MT" }],
  timelineEvents: [{ id: "e1", time: 30, name: { ja: "技", en: "x" }, damageType: "magical" }],
  phases: [{ id: "p1", name: { ja: "P1", en: "P1" }, startTime: 0, endTime: 60 }],
  labels: [{ id: "l1", name: { ja: "L", en: "L" }, startTime: 5, endTime: 10 }],
  memos: [{ id: "mo1", text: "hi", timeSec: 12, xRatio: 0.5, createdAt: 1, updatedAt: 1 }],
  currentLevel: 90,
  aaSettings: { damage: 100, type: "magical", target: "MT" },
  schAetherflowPatterns: { H2: 2 },
};

describe("worker yjsPlanData seed/read 往復", () => {
  it("buildSeedDocFull で組んだ Y.Doc を readPlanDataFull で読むと元に一致", () => {
    const doc = buildSeedDocFull(seed);
    expect(readPlanDataFull(doc)).toEqual(seed);
  });
  it("欠落フィールドは空配列/undefined にフォールバック", () => {
    const doc = buildSeedDocFull({ mitigations: [] });
    const out = readPlanDataFull(doc);
    expect(out.mitigations).toEqual([]);
    expect(out.timelineEvents).toEqual([]);
    expect(out.phases).toEqual([]);
    expect(out.labels).toEqual([]);
    expect(out.memos).toEqual([]);
    expect(out.currentLevel).toBeUndefined();
    expect(out.aaSettings).toBeUndefined();
    expect(out.schAetherflowPatterns).toBeUndefined();
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npm --prefix workers/collab test`
Expected: FAIL（`Cannot find module './yjsPlanData'`）

- [ ] **Step 3: 最小実装**

`workers/collab/src/yjsPlanData.ts`:

```ts
// client src/lib/collab/yjsPlanData.ts のミラー(別パッケージのため複製)。
// ⚠ キー名/構造を変えたら client 側と必ず揃える(往復が崩れると seed/save が壊れる)。
import * as Y from "yjs";
import { MITIGATIONS_KEY } from "./yjsMitigations";

export const TIMELINE_EVENTS_KEY = "timelineEvents";
export const PHASES_KEY = "phases";
export const LABELS_KEY = "labels";
export const MEMOS_KEY = "memos";
export const PLAN_META_KEY = "planMeta";
export const META_LEVEL = "currentLevel";
export const META_AA = "aaSettings";
export const META_SCH = "schAetherflowPatterns";

type Rec = Record<string, unknown> & { id: string };

/** worker が受付係から受け取る PlanData seed(全フィールド・worker はフィールド型を見ない)。 */
export interface PlanDataSeed {
  mitigations: Rec[];
  timelineEvents?: Rec[];
  phases?: Rec[];
  labels?: Rec[];
  memos?: Rec[];
  currentLevel?: number;
  aaSettings?: Record<string, unknown>;
  schAetherflowPatterns?: Record<string, number>;
}

function recordToYMap(rec: Rec): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(rec)) if (v !== undefined) y.set(k, v);
  return y;
}
function pushAll(doc: Y.Doc, key: string, items: Rec[] | undefined): void {
  if (!items || items.length === 0) return;
  const arr = doc.getArray<Y.Map<unknown>>(key);
  items.forEach((it) => arr.push([recordToYMap(it)]));
}
function readAll(doc: Y.Doc, key: string): Rec[] {
  return doc.getArray<Y.Map<unknown>>(key).toArray().map((y) => y.toJSON() as Rec);
}

/** seed 用: 全 PlanData 要素を載せた新しい Y.Doc を作る(onLoad の返り値)。 */
export function buildSeedDocFull(seed: PlanDataSeed): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    pushAll(doc, MITIGATIONS_KEY, seed.mitigations);
    pushAll(doc, TIMELINE_EVENTS_KEY, seed.timelineEvents);
    pushAll(doc, PHASES_KEY, seed.phases);
    pushAll(doc, LABELS_KEY, seed.labels);
    pushAll(doc, MEMOS_KEY, seed.memos);
    const meta = doc.getMap(PLAN_META_KEY);
    if (seed.currentLevel !== undefined) meta.set(META_LEVEL, seed.currentLevel);
    if (seed.aaSettings !== undefined) meta.set(META_AA, seed.aaSettings);
    if (seed.schAetherflowPatterns !== undefined) meta.set(META_SCH, seed.schAetherflowPatterns);
  });
  return doc;
}

/** 書き戻し用: Y.Doc から全 PlanData 要素を読む(onSave で使用)。 */
export function readPlanDataFull(doc: Y.Doc): PlanDataSeed {
  const meta = doc.getMap(PLAN_META_KEY);
  return {
    mitigations: readAll(doc, MITIGATIONS_KEY),
    timelineEvents: readAll(doc, TIMELINE_EVENTS_KEY),
    phases: readAll(doc, PHASES_KEY),
    labels: readAll(doc, LABELS_KEY),
    memos: readAll(doc, MEMOS_KEY),
    currentLevel: meta.get(META_LEVEL) as number | undefined,
    aaSettings: meta.get(META_AA) as Record<string, unknown> | undefined,
    schAetherflowPatterns: meta.get(META_SCH) as Record<string, number> | undefined,
  };
}
```

> 注意: テスト「欠落フィールドは空配列にフォールバック」は `readAll` が空 `Y.Array` を `[]` で返すことで満たす。`buildSeedDocFull({mitigations:[]})` は他キーを push しないが、`readAll` は `doc.getArray(key)`（無ければ空生成）で `[]` を返す。`currentLevel` 等は `meta.get` が `undefined` を返す。

- [ ] **Step 4: テスト緑を確認**

Run: `npm --prefix workers/collab test`
Expected: PASS（新規 2 件 + 既存緑のまま）

- [ ] **Step 5: commit**

```bash
git add workers/collab/src/yjsPlanData.ts workers/collab/src/yjsPlanData.test.ts
git commit -m "feat(collab): ②-b-1 worker Y変換ミラー(buildSeedDocFull/readPlanDataFull)"
```

---

## Task 3: worker 永続化 HTTP 層拡張 `workers/collab/src/collabPersistence.ts`

`SeedResult` に全 PlanData 要素を追加し、`fetchSeed` で受領、`postPlanData` で全要素を書き戻す。**既存 `postMitigations` は無改変で残す**（後方互換・参照が消えるまで）。

**Files:**
- Modify: `workers/collab/src/collabPersistence.ts`
- Test: `workers/collab/src/collabPersistence.test.ts`（既存に追記）

- [ ] **Step 1: 失敗するテストを追記**

`workers/collab/src/collabPersistence.test.ts` の末尾に追加:

```ts
import { fetchSeedFull, postPlanData, type PlanDataPayload } from "./collabPersistence";

const fullPayload = (): PlanDataPayload => ({
  mitigations: [m("a")],
  timelineEvents: [{ id: "e1", time: 30, name: { ja: "技" }, damageType: "magical" }],
  phases: [{ id: "p1", name: { ja: "P1" }, startTime: 0, endTime: 60 }],
  labels: [],
  memos: [],
  currentLevel: 90,
  aaSettings: { damage: 0, type: "magical", target: "MT" },
  schAetherflowPatterns: {},
});

describe("fetchSeedFull (全要素 seed 取得)", () => {
  it("live → 全フィールド + maxParticipants を返す", async () => {
    const body = { ...fullPayload(), maxParticipants: 4 };
    fetchMock.get(BASE).intercept({ path: "/api/collab/load?roomToken=full-a", method: "GET" }).reply(200, body);
    expect(await fetchSeedFull(BASE, "sec", "full-a")).toEqual(body);
  });
  it("墓標(deleted) → null", async () => {
    fetchMock.get(BASE).intercept({ path: "/api/collab/load?roomToken=full-b", method: "GET" }).reply(200, { deleted: true });
    expect(await fetchSeedFull(BASE, "sec", "full-b")).toBeNull();
  });
  it("5xx → null", async () => {
    fetchMock.get(BASE).intercept({ path: "/api/collab/load?roomToken=full-c", method: "GET" }).reply(500, "x");
    expect(await fetchSeedFull(BASE, "sec", "full-c")).toBeNull();
  });
});

describe("postPlanData (全要素書き戻し)", () => {
  it("live → roomToken + 全要素を POST し 'ok'", async () => {
    let sent: any = null;
    fetchMock.get(BASE).intercept({ path: "/api/collab/save", method: "POST" })
      .reply(200, (opts) => { sent = JSON.parse(opts.body as string); return { ok: true, version: 2 }; });
    expect(await postPlanData(BASE, "sec", "room-pd", fullPayload())).toBe("ok");
    expect(sent).toEqual({ roomToken: "room-pd", ...fullPayload() });
  });
  it("skipped(墓標応答) → 'skipped'", async () => {
    fetchMock.get(BASE).intercept({ path: "/api/collab/save", method: "POST" }).reply(200, { skipped: "deleted" });
    expect(await postPlanData(BASE, "sec", "room-pe", fullPayload())).toBe("skipped");
  });
  it("5xx → 'error'", async () => {
    fetchMock.get(BASE).intercept({ path: "/api/collab/save", method: "POST" }).reply(503, "x");
    expect(await postPlanData(BASE, "sec", "room-pf", fullPayload())).toBe("error");
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npm --prefix workers/collab test`
Expected: FAIL（`fetchSeedFull`/`postPlanData` 未 export）

- [ ] **Step 3: 最小実装（追記）**

`workers/collab/src/collabPersistence.ts` の末尾に追加（既存 `SECRET_HEADER` を再利用）:

```ts
import type { PlanDataSeed } from "./yjsPlanData";

/** save に送る全 PlanData(mitigations 必須・他は任意)。SeedResult と対。 */
export type PlanDataPayload = PlanDataSeed;

/** load の全要素 seed 結果(maxParticipants は roomToken 経路のみ)。 */
export interface SeedResultFull extends PlanDataSeed {
  maxParticipants?: number;
}

/** 受付係 load を叩き全 PlanData seed を取得。墓標/障害は null(破壊保存ガード)。 */
export async function fetchSeedFull(
  base: string, secret: string, roomToken: string,
): Promise<SeedResultFull | null> {
  try {
    const res = await fetch(
      `${base}/api/collab/load?roomToken=${encodeURIComponent(roomToken)}`,
      { headers: { [SECRET_HEADER]: secret } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { deleted?: boolean; mitigations?: unknown[] } & SeedResultFull;
    if (body.deleted || !Array.isArray(body.mitigations)) return null;
    return body;
  } catch {
    return null;
  }
}

/** 受付係 save に全 PlanData を POST。'ok'/'skipped'(墓標)/'error'。 */
export async function postPlanData(
  base: string, secret: string, roomToken: string, payload: PlanDataPayload,
): Promise<"ok" | "skipped" | "error"> {
  try {
    const res = await fetch(`${base}/api/collab/save`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify({ roomToken, ...payload }),
    });
    if (!res.ok) return "error";
    const body = (await res.json()) as { skipped?: string };
    return body.skipped ? "skipped" : "ok";
  } catch {
    return "error";
  }
}
```

> 注意: `SECRET_HEADER` は既存ファイル冒頭の `const SECRET_HEADER = "x-collab-secret";` を共有。追記コードは同一ファイル内なので再宣言しない。

- [ ] **Step 4: テスト緑を確認**

Run: `npm --prefix workers/collab test`
Expected: PASS（新規 6 件 + 既存緑）

- [ ] **Step 5: commit**

```bash
git add workers/collab/src/collabPersistence.ts workers/collab/src/collabPersistence.test.ts
git commit -m "feat(collab): ②-b-1 worker永続化に全PlanData授受(fetchSeedFull/postPlanData)追加"
```

---

## Task 4: worker `server.ts` を全要素 seed/save に結線

`Room.onLoad` を `fetchSeedFull`+`buildSeedDocFull` に、`flushSave` を `readPlanDataFull`+`postPlanData` に差し替え。**`#saveEnabled` 破壊保存ガード・墓標ガード・`MAX_PARTICIPANTS_KEY`/`/count`(⑤-2b)・`callbackOptions`/`hibernate` は無改変**。

**Files:**
- Modify: `workers/collab/src/server.ts`
- Test: `workers/collab/src/server.test.ts`（既存パターン確認のうえ追記）

- [ ] **Step 1: 既存 server.test.ts を読み、seed/save の検証パターンを把握**

Run: `npx --no-install cat workers/collab/src/server.test.ts`（または Read）
確認点: `onLoad` が `fetchSeed` を呼ぶ検証・`onClose` flush・破壊保存ガードのテストがどう書かれているか。**新テストは「全要素 seed が Y.Doc に載る」「flush が全要素を POST する」を既存スタイルで追加**。

- [ ] **Step 2: 失敗するテストを追記**

`workers/collab/src/server.test.ts` に、既存の seed/flush テストを全要素版へ拡張（既存 mock の load 応答に `timelineEvents`/`phases`/`planMeta` 相当を足し、`onSave`/`onClose` の POST body に全要素が含まれることを assert）。既存テストが `fetchMock` で `/api/collab/load`・`/api/collab/save` を張っているならその body 期待値を全要素へ更新する。

> 既存 server.test の具体構造に合わせて assert を書く（Step 1 で確認した形に追従）。新規観点:
> - load 応答に `timelineEvents:[{id:'e1',...}]` を入れ、接続後 Y.Doc の `timelineEvents` 配列に反映されること。
> - 編集後の save POST body に `timelineEvents`/`phases`/`memos`/`currentLevel` 等が含まれること。

- [ ] **Step 3: 実装差し替え**

`workers/collab/src/server.ts` の import と onLoad/flushSave を変更:

```ts
// import 差し替え(buildSeedDoc/readMitigations → Full 版)
import { buildSeedDocFull, readPlanDataFull } from "./yjsPlanData";
import { fetchSeedFull, postPlanData } from "./collabPersistence";
import { resolveMaxParticipants, MAX_PARTICIPANTS_KEY } from "./collabCapacity";
```

`onLoad` 内、`fetchSeed`→`fetchSeedFull`、`buildSeedDoc(seed.mitigations)`→`buildSeedDocFull(seed)`:

```ts
override async onLoad(): Promise<Y.Doc | void> {
  const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
  if (!APP_API_BASE || !COLLAB_SHARED_SECRET) return;
  const seed = await fetchSeedFull(APP_API_BASE, COLLAB_SHARED_SECRET, this.name);
  if (seed) {
    this.#saveEnabled = true;
    await this.ctx.storage.put(MAX_PARTICIPANTS_KEY, resolveMaxParticipants(seed.maxParticipants));
    return buildSeedDocFull(seed);
  }
}
```

`flushSave` 内、`readMitigations`→`readPlanDataFull`、`postMitigations(...,mitigations)`→`postPlanData(...,payload)`:

```ts
async flushSave(): Promise<void> {
  if (!this.#saveEnabled) return;
  const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
  const result = await postPlanData(
    APP_API_BASE, COLLAB_SHARED_SECRET, this.name, readPlanDataFull(this.document),
  );
  if (result === "skipped") this.#saveEnabled = false;
}
```

`onSave`/`onClose`/`onRequest`(/count) は無改変。旧 import（`buildSeedDoc`/`readMitigations`/`fetchSeed`/`postMitigations`）が他で未使用になるので削除。

- [ ] **Step 4: テスト緑 + 型チェック**

Run: `npm --prefix workers/collab test`
Run: `npm --prefix workers/collab run typecheck`
Expected: PASS / 型エラーなし

- [ ] **Step 5: commit**

```bash
git add workers/collab/src/server.ts workers/collab/src/server.test.ts
git commit -m "feat(collab): ②-b-1 Room.onLoad/flushSave を全PlanData seed/saveに結線"
```

---

## Task 5: 受付係 `_logic.ts` を全 PlanData に拡張

`PlanDocSnapshot`/`decideLoad`/`decideSave` を全 b-1 `data.*` 対応に。**`isCollabAuthorized`・version 計算・墓標ガードは無改変**。

**Files:**
- Modify: `api/collab/_logic.ts`
- Test: `src/lib/__tests__/collabLogic.test.ts`（既存に追記）

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/__tests__/collabLogic.test.ts` に追加:

```ts
import { decideLoadFull, type PlanDocSnapshotFull } from '../../../api/collab/_logic';

describe('decideLoadFull (全PlanData seed)', () => {
  const data = {
    timelineMitigations: [m('a')],
    timelineEvents: [{ id: 'e1', time: 30, name: { ja: '技' }, damageType: 'magical' }],
    phases: [{ id: 'p1', name: { ja: 'P1' }, startTime: 0, endTime: 60 }],
    labels: [],
    memos: [],
    currentLevel: 90,
    aaSettings: { damage: 0, type: 'magical', target: 'MT' },
    schAetherflowPatterns: { H2: 2 },
  };
  it('存在しない/墓標 → deleted', () => {
    expect(decideLoadFull(null)).toEqual({ deleted: true });
    expect(decideLoadFull({ deleted: true, data })).toEqual({ deleted: true });
  });
  it('live → 全要素を返す(欠落配列は[]・スカラーはundefined)', () => {
    expect(decideLoadFull({ data })).toEqual({
      mitigations: data.timelineMitigations,
      timelineEvents: data.timelineEvents,
      phases: data.phases,
      labels: [],
      memos: [],
      currentLevel: 90,
      aaSettings: data.aaSettings,
      schAetherflowPatterns: data.schAetherflowPatterns,
    });
    expect(decideLoadFull({ data: {} })).toEqual({
      mitigations: [], timelineEvents: [], phases: [], labels: [], memos: [],
      currentLevel: undefined, aaSettings: undefined, schAetherflowPatterns: undefined,
    });
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: FAIL（`decideLoadFull` 未 export）

- [ ] **Step 3: 実装（追記）**

`api/collab/_logic.ts` に追加（既存 `decideLoad`/`decideSave`/`PlanDocSnapshot` は無改変で残す）:

```ts
/** 全 b-1 data.* を表す snapshot(decideLoadFull 用)。 */
export interface PlanDocSnapshotFull {
  deleted?: boolean;
  version?: number;
  data?: {
    timelineMitigations?: MitigationRecord[];
    timelineEvents?: unknown[];
    phases?: unknown[];
    labels?: unknown[];
    memos?: unknown[];
    currentLevel?: number;
    aaSettings?: unknown;
    schAetherflowPatterns?: unknown;
  };
}

export type LoadResultFull =
  | { deleted: true }
  | {
      mitigations: MitigationRecord[];
      timelineEvents: unknown[];
      phases: unknown[];
      labels: unknown[];
      memos: unknown[];
      currentLevel?: number;
      aaSettings?: unknown;
      schAetherflowPatterns?: unknown;
    };

/** 全 b-1 要素の seed を決める。墓標/不存在は deleted(削除が勝つ)。配列欠落は []、スカラー欠落は undefined。 */
export function decideLoadFull(plan: PlanDocSnapshotFull | null): LoadResultFull {
  if (!plan || plan.deleted === true) return { deleted: true };
  const d = plan.data ?? {};
  return {
    mitigations: d.timelineMitigations ?? [],
    timelineEvents: d.timelineEvents ?? [],
    phases: d.phases ?? [],
    labels: d.labels ?? [],
    memos: d.memos ?? [],
    currentLevel: d.currentLevel,
    aaSettings: d.aaSettings,
    schAetherflowPatterns: d.schAetherflowPatterns,
  };
}
```

> `decideSave` は version 計算のみで data 中身に依存しないため**そのまま流用**（保存フィールドの拡張は Task 6 の handler 側 `tx.update` で行う）。

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add api/collab/_logic.ts src/lib/__tests__/collabLogic.test.ts
git commit -m "feat(collab): ②-b-1 decideLoadFull(全PlanData seed決定)追加"
```

---

## Task 6: 受付係ハンドラ `_loadHandler.ts` / `_saveHandler.ts` を全要素対応

**薄いパススルー層。純ロジックは Task 5 でテスト済なので、ここは build/型で担保**（リポジトリ既存方針: ハンドラは単体テストせず `_logic` を単体テスト）。roomToken→planId 解決・緊急停止・墓標ガード・version・401 は無改変。

**Files:**
- Modify: `api/collab/_loadHandler.ts`
- Modify: `api/collab/_saveHandler.ts`

- [ ] **Step 1: `_loadHandler.ts` を全要素返却に**

`decideLoad` → `decideLoadFull` に差し替え、返却 JSON に全要素を含める:

```ts
import { decideLoadFull, type PlanDocSnapshotFull } from './_logic.js';
// ...(resolveRoom/isCollabDisabled は無改変)
  const snap = await db.collection('plans').doc(planId).get();
  const plan = snap.exists ? (snap.data() as PlanDocSnapshotFull) : null;
  const result = decideLoadFull(plan);
  if ('deleted' in result) return res.status(200).json(result);
  return res.status(200).json({ ...result, maxParticipants });
```

> `maxParticipants` は roomToken 経路のみ定義（レガシーは undefined → JSON 省略）。`result` は `mitigations`/`timelineEvents`/... を含むため worker の `fetchSeedFull` がそのまま受領。

- [ ] **Step 2: `_saveHandler.ts` を全 data.* 部分更新に**

body から全要素を受け取り、`tx.update` を全 `data.*` に拡張。**`data.timelineMitigations`・version・updatedAt・墓標ガードは現行どおり**:

```ts
  const { planId: bodyPlanId, roomToken, mitigations,
    timelineEvents, phases, labels, memos, currentLevel, aaSettings, schAetherflowPatterns } =
    (req.body ?? {}) as {
      planId?: string; roomToken?: string; mitigations?: MitigationRecord[];
      timelineEvents?: unknown[]; phases?: unknown[]; labels?: unknown[]; memos?: unknown[];
      currentLevel?: number; aaSettings?: unknown; schAetherflowPatterns?: unknown;
    };
  if (!Array.isArray(mitigations)) {
    return res.status(400).json({ error: 'mitigations[] required' });
  }
  // ...(roomToken 解決・緊急停止は無改変)
  const result = await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const decision = decideSave(snap.exists ? (snap.data() as PlanDocSnapshot) : null);
    if ('skip' in decision) return decision;
    const update: Record<string, unknown> = {
      'data.timelineMitigations': mitigations,
      version: decision.nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (Array.isArray(timelineEvents)) update['data.timelineEvents'] = timelineEvents;
    if (Array.isArray(phases)) update['data.phases'] = phases;
    if (Array.isArray(labels)) update['data.labels'] = labels;
    if (Array.isArray(memos)) update['data.memos'] = memos;
    if (typeof currentLevel === 'number') update['data.currentLevel'] = currentLevel;
    if (aaSettings !== undefined) update['data.aaSettings'] = aaSettings;
    if (schAetherflowPatterns !== undefined) update['data.schAetherflowPatterns'] = schAetherflowPatterns;
    tx.update(ref, update);
    return decision;
  });
```

> `Array.isArray`/`typeof` ガードで「送られなかったフィールドは触らない」を保証（worker は常に全要素送るが、レガシー planId 経路や部分送信でも安全）。

- [ ] **Step 3: build/型チェック**

Run: `npm run build`
Expected: `tsc -b` + `tsc -p tsconfig.api.json` + `vite build` 全て成功（型エラーなし）

- [ ] **Step 4: 受付係ロジック回帰**

Run: `npx vitest run src/lib/__tests__/collabLogic.test.ts src/lib/__tests__/collabRoomLogic.test.ts`
Expected: PASS（既存の load/save/room ロジック緑のまま）

- [ ] **Step 5: commit**

```bash
git add api/collab/_loadHandler.ts api/collab/_saveHandler.ts
git commit -m "feat(collab): ②-b-1 受付係 load/save ハンドラを全PlanData授受に拡張"
```

---

## Task 7: `CollabHandlers` 型を汎用 5 メソッドに拡張

store↔collabProvider の遅延ロード境界。**既存 ②-a の `add`/`remove`/`updateTime` は無改変で残す**（mitigations 専用経路）。b-1 は汎用メソッドを追加。

**Files:**
- Modify: `src/lib/collab/collabTypes.ts`

- [ ] **Step 1: 型拡張**

`src/lib/collab/collabTypes.ts`:

```ts
import type { AppliedMitigation, TimelineEvent, Phase, Label, PlanMemo } from "../../types";
import type { PlanArrayKey, AASettings } from "./yjsPlanData";

/**
 * 共同編集の操作を遅延チャンク(collabProvider)へ委譲する関数束。
 * store はこのインタフェース型のみ参照し yjs を実行時 import しない(遅延ロード境界)。
 */
export interface CollabHandlers {
  // ②-a(mitigations 専用・無改変)
  add: (m: AppliedMitigation) => void;
  remove: (id: string) => void;
  updateTime: (id: string, newTime: number) => void;
  // ②-b-1 汎用(events/phases/labels/memos の id 単位 delta)
  upsertItems: (key: PlanArrayKey, items: Array<{ id: string }>) => void;
  removeItems: (key: PlanArrayKey, ids: string[]) => void;
  // planMeta スカラー
  setMeta: (field: "currentLevel" | "aaSettings" | "schAetherflowPatterns", value: number | AASettings | Record<string, 1 | 2>) => void;
  // バルク(FFLogs 取込: events/phases/labels 全置換 + mitigations クリア・1 transaction)
  importBulk: (events: TimelineEvent[], phases?: Phase[], labels?: Label[]) => void;
}
```

- [ ] **Step 2: build で型整合確認**

Run: `npm run build`
Expected: 既存 ②-a の `mockHandlers`（[src/store/__tests__/useMitigationStore.collab.test.ts:10](../../../src/store/__tests__/useMitigationStore.collab.test.ts#L10)）が新メソッド不足で**ビルド/テストが落ちる** → Task 9 で mock を補完する。ここでは型定義のみコミット。

> このタスク単独では既存 collab テストの mock が型不足になる。Task 8–9 と連続実行する前提（型エラーは Task 9 完了時に解消）。subagent 実行時はこの 3 タスクを 1 レビュー単位にまとめる。

- [ ] **Step 3: commit**

```bash
git add src/lib/collab/collabTypes.ts
git commit -m "feat(collab): ②-b-1 CollabHandlers に汎用5メソッド(upsert/remove/setMeta/importBulk)追加"
```

---

## Task 8: `collabProvider.ts` にハンドラ実装 + observeDeep 拡張

新 Y 型を取得し、汎用ハンドラを実装し、各 Y 型に `observeDeep` を張って store の `_apply*FromCollab` を呼ぶ。**②-a の mitigations 同期(yarr/handlers.add 等)は無改変で共存**。`importBulk` は mitigations Y.Array も同一 transaction でクリア。

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`

- [ ] **Step 1: import と Y 型取得を追加**

`startCollabSession` 冒頭（`const yarr = ...` の後）:

```ts
import {
  TIMELINE_EVENTS_KEY, PHASES_KEY, LABELS_KEY, MEMOS_KEY, PLAN_META_KEY,
  META_LEVEL, META_AA, META_SCH,
  applyUpsert, applyRemove, setMetaField, readArray, readPlanMeta,
  recordToYMap, type PlanArrayKey,
} from "./yjsPlanData";
import type { TimelineEvent, Phase, Label, PlanMemo } from "../../types";
```

`startCollabSession` 内（`const yarr` の下）:

```ts
  const yEvents = doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY);
  const yPhases = doc.getArray<Y.Map<unknown>>(PHASES_KEY);
  const yLabels = doc.getArray<Y.Map<unknown>>(LABELS_KEY);
  const yMemos = doc.getArray<Y.Map<unknown>>(MEMOS_KEY);
  const yMeta = doc.getMap(PLAN_META_KEY);
  const arrByKey: Record<PlanArrayKey, Y.Array<Y.Map<unknown>>> = {
    [TIMELINE_EVENTS_KEY]: yEvents, [PHASES_KEY]: yPhases, [LABELS_KEY]: yLabels, [MEMOS_KEY]: yMemos,
  };
```

- [ ] **Step 2: apply 関数 + observeDeep を追加**

`applyToStore`（②-a 既存）の下:

```ts
  const store = () => useMitigationStore.getState();
  const applyEvents = () => store()._applyEventsFromCollab(readArray<TimelineEvent>(doc, TIMELINE_EVENTS_KEY));
  const applyPhases = () => store()._applyPhasesFromCollab(readArray<Phase>(doc, PHASES_KEY));
  const applyLabels = () => store()._applyLabelsFromCollab(readArray<Label>(doc, LABELS_KEY));
  const applyMemos = () => store()._applyMemosFromCollab(readArray<PlanMemo>(doc, MEMOS_KEY));
  const applyMeta = () => store()._applyMetaFromCollab(readPlanMeta(doc));
  yEvents.observeDeep(applyEvents);
  yPhases.observeDeep(applyPhases);
  yLabels.observeDeep(applyLabels);
  yMemos.observeDeep(applyMemos);
  yMeta.observeDeep(applyMeta);
```

- [ ] **Step 3: 汎用ハンドラを `handlers` に追加**

既存 `const handlers: CollabHandlers = { add, remove, updateTime }` に汎用メソッドを追加:

```ts
    upsertItems: (key, items) => {
      doc.transact(() => applyUpsert(arrByKey[key], items), 'local');
    },
    removeItems: (key, ids) => {
      doc.transact(() => applyRemove(arrByKey[key], ids), 'local');
    },
    setMeta: (field, value) => {
      const k = field === 'currentLevel' ? META_LEVEL : field === 'aaSettings' ? META_AA : META_SCH;
      doc.transact(() => setMetaField(doc, k, value), 'local');
    },
    importBulk: (events, phases, labels) => {
      doc.transact(() => {
        yEvents.delete(0, yEvents.length);
        events.forEach((e) => yEvents.push([recordToYMap(e)]));
        if (phases) { yPhases.delete(0, yPhases.length); phases.forEach((p) => yPhases.push([recordToYMap(p)])); }
        if (labels) { yLabels.delete(0, yLabels.length); labels.forEach((l) => yLabels.push([recordToYMap(l)])); }
        yarr.delete(0, yarr.length); // 取込は別の戦闘 → mitigations 全クリア(②-a 領域だが破壊的全置換で衝突しない)
      }, 'local');
    },
```

- [ ] **Step 4: onSynced で全要素を初期反映、disconnect で全 observe 解除**

`onSynced`（②-a 既存）に追加:

```ts
    useMitigationStore.getState().enterCollabMode(handlers);
    applyToStore();          // ②-a mitigations
    applyEvents(); applyPhases(); applyLabels(); applyMemos(); applyMeta();
```

`disconnect`（②-a 既存）に追加:

```ts
    yEvents.unobserveDeep(applyEvents);
    yPhases.unobserveDeep(applyPhases);
    yLabels.unobserveDeep(applyLabels);
    yMemos.unobserveDeep(applyMemos);
    yMeta.unobserveDeep(applyMeta);
```

- [ ] **Step 5: build（store apply 未実装で型エラーが出る → Task 9 で解消）**

Run: `npm run build`
Expected: `_applyEventsFromCollab` 等が store に無く型エラー → Task 9 で追加。ここでコミット（Task 9 と連続）。

- [ ] **Step 6: commit**

```bash
git add src/lib/collab/collabProvider.ts
git commit -m "feat(collab): ②-b-1 collabProvider に汎用ハンドラ+全要素observeDeep+importBulk"
```

---

## Task 9: store に apply メソッド + collab mock 補完

Y → store 反映メソッドを追加（`pushHistory` を呼ばない＝②-a と同じ）。`currentLevel` 反映時のみ `partyMembers.computedValues` をローカル再計算。既存 collab テストの `mockHandlers` を新メソッドで補完してビルドを回復。

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Modify: `src/store/__tests__/useMitigationStore.collab.test.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`（apply テスト追記）

- [ ] **Step 1: mockHandlers 補完 + apply テストを書く（失敗）**

`src/store/__tests__/useMitigationStore.collab.test.ts` の `mockHandlers` を差し替え + 追記:

```ts
const mockHandlers = (): CollabHandlers => ({
  add: vi.fn(), remove: vi.fn(), updateTime: vi.fn(),
  upsertItems: vi.fn(), removeItems: vi.fn(), setMeta: vi.fn(), importBulk: vi.fn(),
});

describe('②-b-1 apply(Y→store 反映)', () => {
  beforeEach(() => {
    useMitigationStore.setState({ timelineEvents: [], phases: [], labels: [], memos: [], _collabActive: false, _collabHandlers: null });
  });
  it('_applyEventsFromCollab は time 昇順で反映', () => {
    useMitigationStore.getState()._applyEventsFromCollab([
      { id: 'b', time: 50, name: { ja: 'b' }, damageType: 'magical' },
      { id: 'a', time: 10, name: { ja: 'a' }, damageType: 'magical' },
    ] as any);
    expect(useMitigationStore.getState().timelineEvents.map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('_applyPhasesFromCollab は startTime 昇順で反映', () => {
    useMitigationStore.getState()._applyPhasesFromCollab([
      { id: 'p2', name: { ja: 'p2' }, startTime: 60, endTime: 100 },
      { id: 'p1', name: { ja: 'p1' }, startTime: 0, endTime: 59 },
    ] as any);
    expect(useMitigationStore.getState().phases.map((p) => p.id)).toEqual(['p1', 'p2']);
  });
  it('_applyMetaFromCollab は currentLevel/aaSettings を反映', () => {
    useMitigationStore.getState()._applyMetaFromCollab({ currentLevel: 80, aaSettings: { damage: 5, type: 'physical', target: 'ST' }, schAetherflowPatterns: { H2: 2 } });
    expect(useMitigationStore.getState().currentLevel).toBe(80);
    expect(useMitigationStore.getState().aaSettings).toEqual({ damage: 5, type: 'physical', target: 'ST' });
    expect(useMitigationStore.getState().schAetherflowPatterns).toEqual({ H2: 2 });
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（`_applyEventsFromCollab` 等が未定義）

- [ ] **Step 3: 型宣言と実装を追加**

`MitigationState` インタフェース（②-a `_applyMitigationsFromCollab` の近く）に宣言追加:

```ts
    _applyEventsFromCollab: (events: TimelineEvent[]) => void;
    _applyPhasesFromCollab: (phases: Phase[]) => void;
    _applyLabelsFromCollab: (labels: Label[]) => void;
    _applyMemosFromCollab: (memos: PlanMemo[]) => void;
    _applyMetaFromCollab: (meta: { currentLevel?: number; aaSettings?: AASettings; schAetherflowPatterns?: Record<string, 1 | 2> }) => void;
```

実装（②-a `_applyMitigationsFromCollab` の直後）:

```ts
                _applyEventsFromCollab: (events) =>
                    set({ timelineEvents: [...events].sort((a, b) => a.time - b.time) }),
                _applyPhasesFromCollab: (phases) =>
                    set({ phases: [...phases].sort((a, b) => a.startTime - b.startTime) }),
                _applyLabelsFromCollab: (labels) =>
                    set({ labels: [...labels].sort((a, b) => a.startTime - b.startTime) }),
                _applyMemosFromCollab: (memos) => set({ memos }),
                _applyMetaFromCollab: (meta) =>
                    set((state) => {
                        const patch: Partial<MitigationState> = {};
                        if (meta.aaSettings !== undefined) patch.aaSettings = meta.aaSettings;
                        if (meta.schAetherflowPatterns !== undefined) patch.schAetherflowPatterns = meta.schAetherflowPatterns;
                        if (meta.currentLevel !== undefined) {
                            patch.currentLevel = meta.currentLevel;
                            // computedValues は派生 → ローカル再計算(partyMembers 自体は b-1 で同期しない)
                            patch.partyMembers = state.partyMembers.map((mem) => ({
                                ...mem,
                                computedValues: calculateMemberValues(mem, meta.currentLevel!),
                            }));
                        }
                        return patch;
                    }),
```

`AASettings`/`TimelineEvent`/`Phase`/`Label`/`PlanMemo` の import が無ければ store 冒頭の types import に追加。`calculateMemberValues` は既存 import 済（[useMitigationStore.ts:293](../../../src/store/useMitigationStore.ts#L293) で使用）。

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS（②-a 既存 3 件 + 新規 3 件）

- [ ] **Step 5: build で collabProvider/collabTypes との型整合確認**

Run: `npm run build`
Expected: 成功（Task 7/8 の型エラー解消）

- [ ] **Step 6: commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): ②-b-1 store apply(_apply*FromCollab)追加+collab mock補完"
```

---

## Task 10: store events 委譲（add/update/remove）

共同編集中、events 操作を `upsertItems`/`removeItems` に委譲。**`pushHistory`/local set スキップ・UI tutorial イベントは従来どおり発火**。

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 委譲テストを追記（失敗）**

```ts
describe('②-b-1 events 委譲', () => {
  beforeEach(() => useMitigationStore.setState({ timelineEvents: [], _collabActive: false, _collabHandlers: null }));
  const e = { id: 'e1', time: 30, name: { ja: '技' }, damageType: 'magical' } as any;
  it('addEvent は upsertItems に委譲し store 直変更しない', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().addEvent(e);
    expect(h.upsertItems).toHaveBeenCalledWith('timelineEvents', [e]);
    expect(useMitigationStore.getState().timelineEvents).toEqual([]);
  });
  it('updateEvent は id+patch を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateEvent('e1', { time: 45 });
    expect(h.upsertItems).toHaveBeenCalledWith('timelineEvents', [{ id: 'e1', time: 45 }]);
  });
  it('removeEvent は removeItems に委譲', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().removeEvent('e1');
    expect(h.removeItems).toHaveBeenCalledWith('timelineEvents', ['e1']);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（委譲分岐が無く store が直変更される or handler 未呼び出し）

- [ ] **Step 3: 各 mutation 先頭に collab 分岐を追加**

`addEvent`（[useMitigationStore.ts:595](../../../src/store/useMitigationStore.ts#L595)）:

```ts
                addEvent: (event) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('timelineEvents', [event]);
                        useTutorialStore.getState().completeEvent('event:saved');
                        return;
                    }
                    pushHistory();
                    // ...(既存 set はそのまま)
```

`updateEvent`（[L631](../../../src/store/useMitigationStore.ts#L631)）:

```ts
                updateEvent: (id, updatedEvent) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('timelineEvents', [{ id, ...updatedEvent }]);
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

`removeEvent`（[L638](../../../src/store/useMitigationStore.ts#L638)）:

```ts
                removeEvent: (id) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('timelineEvents', [id]);
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): ②-b-1 store events 委譲(add/update/remove)"
```

---

## Task 11: store phases 委譲（add/update/remove/resize・delta 計算）

クリッピング/隣接調整は **store が変更分(delta)を計算してから `upsertItems` に渡す**（Y-land に連鎖を再実装しない）。

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 委譲テストを追記（失敗）**

```ts
describe('②-b-1 phases 委譲', () => {
  beforeEach(() => useMitigationStore.setState({
    phases: [{ id: 'p1', name: { ja: 'P1' }, startTime: 0, endTime: 100 }],
    timelineEvents: [{ id: 'e1', time: 120, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _collabActive: false, _collabHandlers: null,
  }));
  it('addPhase は新フェーズ + クリップ対象を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().addPhase(50, { ja: 'P2' } as any);
    expect(h.upsertItems).toHaveBeenCalledTimes(1);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('phases');
    // 新フェーズ(startTime:50) + 既存 p1 を endTime:49 にクリップ
    const ids = items.map((i: any) => i.id);
    expect(ids).toContain('p1');
    const p1 = items.find((i: any) => i.id === 'p1');
    expect(p1.endTime).toBe(49);
    const np = items.find((i: any) => i.id !== 'p1');
    expect(np.startTime).toBe(50);
    expect(useMitigationStore.getState().phases.find((p) => p.id === 'p1')!.endTime).toBe(100); // store 直変更なし
  });
  it('updatePhase(rename) は id+name を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updatePhase('p1', { ja: 'NEW' } as any);
    expect(h.upsertItems).toHaveBeenCalledWith('phases', [{ id: 'p1', name: { ja: 'NEW' } }]);
  });
  it('removePhase は removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().removePhase('p1');
    expect(h.removeItems).toHaveBeenCalledWith('phases', ['p1']);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL

- [ ] **Step 3: collab 分岐を追加**

`addPhase`（[L645](../../../src/store/useMitigationStore.ts#L645)）— ソロ版と同じ計算で delta を作って委譲:

```ts
                addPhase: (startTime, name) => {
                    const exists = get().phases.some(p => p.startTime === startTime);
                    if (exists) return;
                    if (get()._collabActive && get()._collabHandlers) {
                        const state = get();
                        const sorted = [...state.phases].sort((a, b) => a.startTime - b.startTime);
                        const nextPhase = sorted.find(p => p.startTime > startTime);
                        const containingPhase = sorted.find(p => p.startTime <= startTime && p.endTime >= startTime);
                        let endTime: number;
                        if (nextPhase) endTime = nextPhase.startTime - 1;
                        else if (containingPhase) endTime = containingPhase.endTime;
                        else {
                            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                            endTime = Math.max(maxEventTime, startTime + 1);
                        }
                        const newPhase: Phase = { id: crypto.randomUUID(), name, startTime, endTime };
                        const clipped = state.phases
                            .filter(p => p.endTime >= startTime && p.startTime < startTime)
                            .map(p => ({ id: p.id, endTime: startTime - 1 }));
                        get()._collabHandlers!.upsertItems('phases', [newPhase, ...clipped]);
                        return;
                    }
                    pushHistory();
                    // ...(既存 set)
```

`updatePhase`（[L680](../../../src/store/useMitigationStore.ts#L680)）:

```ts
                updatePhase: (id, name) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('phases', [{ id, name }]);
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

`removePhase`（[L687](../../../src/store/useMitigationStore.ts#L687)）:

```ts
                removePhase: (id) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('phases', [id]);
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

`updatePhaseEndTime`（[L694](../../../src/store/useMitigationStore.ts#L694)）— self + 場合により next を upsert:

```ts
                updatePhaseEndTime: (id, newEndTime) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().phases].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(p => p.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const nextPhase = sorted[idx + 1];
                        let final = Math.max(newEndTime, self.startTime + 1);
                        if (nextPhase && final >= nextPhase.startTime) {
                            final = Math.min(final, nextPhase.endTime - 2);
                            get()._collabHandlers!.upsertItems('phases', [
                                { id, endTime: final }, { id: nextPhase.id, startTime: final + 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('phases', [{ id, endTime: final }]);
                        }
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

`updatePhaseStartTime`（[L720](../../../src/store/useMitigationStore.ts#L720)）— self + 場合により prev:

```ts
                updatePhaseStartTime: (id, newStartTime) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().phases].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(p => p.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const prevPhase = idx > 0 ? sorted[idx - 1] : null;
                        let final = Math.max(newStartTime, 0);
                        final = Math.min(final, self.endTime - 1);
                        if (prevPhase && final <= prevPhase.endTime) {
                            final = Math.max(final, prevPhase.startTime + 2);
                            get()._collabHandlers!.upsertItems('phases', [
                                { id, startTime: final }, { id: prevPhase.id, endTime: final - 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('phases', [{ id, startTime: final }]);
                        }
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): ②-b-1 store phases 委譲(add/update/remove/resize・delta計算)"
```

---

## Task 12: store labels 委譲（phases と同型）

labels は phases と同じクリッピング/resize 構造。**phases と同一パターンを labels キーで実装**（コードは別物なので全文記載）。

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 委譲テストを追記（失敗）**

```ts
describe('②-b-1 labels 委譲', () => {
  beforeEach(() => useMitigationStore.setState({
    labels: [{ id: 'l1', name: { ja: 'L1' }, startTime: 0, endTime: 100 }],
    timelineEvents: [{ id: 'e1', time: 120, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _collabActive: false, _collabHandlers: null,
  }));
  it('addLabel は新ラベル+クリップを upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().addLabel(50, { ja: 'L2' } as any);
    const [key, items] = (h.upsertItems as any).mock.calls[0];
    expect(key).toBe('labels');
    expect(items.find((i: any) => i.id === 'l1').endTime).toBe(49);
  });
  it('removeLabel は removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().removeLabel('l1');
    expect(h.removeItems).toHaveBeenCalledWith('labels', ['l1']);
  });
  it('updateLabel(rename) は id+name を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateLabel('l1', { ja: 'NEW' } as any);
    expect(h.upsertItems).toHaveBeenCalledWith('labels', [{ id: 'l1', name: { ja: 'NEW' } }]);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL

- [ ] **Step 3: collab 分岐を追加**

`addLabel`（[L747](../../../src/store/useMitigationStore.ts#L747)）:

```ts
                addLabel: (startTime, name) => {
                    const exists = get().labels.some(l => l.startTime === startTime);
                    if (exists) return;
                    if (get()._collabActive && get()._collabHandlers) {
                        const state = get();
                        const sorted = [...state.labels].sort((a, b) => a.startTime - b.startTime);
                        const nextLabel = sorted.find(l => l.startTime > startTime);
                        const containingLabel = sorted.find(l => l.startTime <= startTime && l.endTime >= startTime);
                        let endTime: number;
                        if (nextLabel) endTime = nextLabel.startTime - 1;
                        else if (containingLabel) endTime = containingLabel.endTime;
                        else {
                            const maxEventTime = state.timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
                            endTime = Math.max(maxEventTime, startTime + 1);
                        }
                        const newLabel: Label = { id: crypto.randomUUID(), name, startTime, endTime };
                        const clipped = state.labels
                            .filter(l => l.endTime >= startTime && l.startTime < startTime)
                            .map(l => ({ id: l.id, endTime: startTime - 1 }));
                        get()._collabHandlers!.upsertItems('labels', [newLabel, ...clipped]);
                        return;
                    }
                    pushHistory();
                    // ...(既存 set)
```

`updateLabel`（[L780](../../../src/store/useMitigationStore.ts#L780)）:

```ts
                updateLabel: (id, name) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('labels', [{ id, name }]);
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

`removeLabel`（[L787](../../../src/store/useMitigationStore.ts#L787)）:

```ts
                removeLabel: (id) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('labels', [id]);
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

`updateLabelEndTime`（[L794](../../../src/store/useMitigationStore.ts#L794)）— phases と同構造を labels で:

```ts
                updateLabelEndTime: (id, newEndTime) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().labels].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(l => l.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const next = sorted[idx + 1];
                        let final = Math.max(newEndTime, self.startTime + 1);
                        if (next && final >= next.startTime) {
                            final = Math.min(final, next.endTime - 2);
                            get()._collabHandlers!.upsertItems('labels', [
                                { id, endTime: final }, { id: next.id, startTime: final + 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('labels', [{ id, endTime: final }]);
                        }
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

`updateLabelStartTime`（[L819](../../../src/store/useMitigationStore.ts#L819)）:

```ts
                updateLabelStartTime: (id, newStartTime) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const sorted = [...get().labels].sort((a, b) => a.startTime - b.startTime);
                        const idx = sorted.findIndex(l => l.id === id);
                        if (idx < 0) return;
                        const self = sorted[idx];
                        const prev = idx > 0 ? sorted[idx - 1] : null;
                        let final = Math.max(newStartTime, 0);
                        final = Math.min(final, self.endTime - 1);
                        if (prev && final <= prev.endTime) {
                            final = Math.max(final, prev.startTime + 2);
                            get()._collabHandlers!.upsertItems('labels', [
                                { id, startTime: final }, { id: prev.id, endTime: final - 1 },
                            ]);
                        } else {
                            get()._collabHandlers!.upsertItems('labels', [{ id, startTime: final }]);
                        }
                        return;
                    }
                    pushHistory();
                    // ...(既存)
```

> 確認: `updateLabelEndTime`/`updateLabelStartTime` のソロ版実装（[L794-845](../../../src/store/useMitigationStore.ts#L794-L845)）が phases と同じ規約か Step 3 着手時に Read で照合（隣接の `+1`/`-1`・最低幅 `+2` がズレていれば合わせる）。

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): ②-b-1 store labels 委譲(phases同型)"
```

---

## Task 13: store memos + planMeta 委譲

memos（add/update/delete/deleteAll）と planMeta（setCurrentLevel/setAaSettings/setSchAetherflowPattern）を委譲。

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 委譲テストを追記（失敗）**

```ts
describe('②-b-1 memos/planMeta 委譲', () => {
  beforeEach(() => useMitigationStore.setState({
    memos: [{ id: 'mo1', text: 'a', timeSec: 1, xRatio: 0.1, createdAt: 1, updatedAt: 1 }],
    schAetherflowPatterns: { H1: 1 },
    _collabActive: false, _collabHandlers: null,
  }));
  it('updateMemo は id+patch を upsert', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().updateMemo('mo1', { text: 'b' });
    expect(h.upsertItems).toHaveBeenCalledWith('memos', [{ id: 'mo1', text: 'b' }]);
  });
  it('deleteMemo は removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().deleteMemo('mo1');
    expect(h.removeItems).toHaveBeenCalledWith('memos', ['mo1']);
  });
  it('deleteAllMemos は現存 id を全 removeItems', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().deleteAllMemos();
    expect(h.removeItems).toHaveBeenCalledWith('memos', ['mo1']);
  });
  it('setAaSettings は setMeta(aaSettings) に委譲', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const aa = { damage: 9, type: 'magical', target: 'MT' } as const;
    useMitigationStore.getState().setAaSettings(aa);
    expect(h.setMeta).toHaveBeenCalledWith('aaSettings', aa);
  });
  it('setSchAetherflowPattern は既存にマージして setMeta', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().setSchAetherflowPattern('H2', 2);
    expect(h.setMeta).toHaveBeenCalledWith('schAetherflowPatterns', { H1: 1, H2: 2 });
  });
  it('setCurrentLevel は setMeta(currentLevel) に委譲', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    useMitigationStore.getState().setCurrentLevel(80);
    expect(h.setMeta).toHaveBeenCalledWith('currentLevel', 80);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL

- [ ] **Step 3: collab 分岐を追加**

`addMemo`（[L1206](../../../src/store/useMitigationStore.ts#L1206)）— 返り値 boolean を保つ。collab 中も上限チェックは行い、生成 memo を upsert:

```ts
                addMemo: (input) => {
                    // 既存の上限チェック・memo 生成ロジックはそのまま使い、生成した memo を取得する。
                    // collab 中: ローカル set せず upsert に委譲(成功時 true を返す)。
                    // 実装方針: 既存の生成部を共通化し、collab なら handler.upsertItems('memos',[memo]); 返り値 true。
                    // (既存ソロ実装の memo 構築コードを参照し、collab 分岐でも同じ memo を作る)
                    // 下記は擬似ではなく、既存 addMemo 本体の memo 構築結果を memo 変数に束ねた上での分岐:
                    // --- 実装時: 既存 addMemo の本体(上限判定→memo 生成→set)を読み、
                    //     collab 分岐は「set の代わりに upsertItems」に差し替える ---
                    return get().__addMemoImpl(input);
                },
```

> ⚠ `addMemo` は返り値 `boolean`（上限超過で false）かつ memo 構築ロジックを内包する（[L1206-1220](../../../src/store/useMitigationStore.ts#L1206-L1220)）。**実装時は既存本体を Read し**、(1) 上限判定はソロ/collab 共通で先に行い、(2) memo を構築し、(3) `_collabActive` なら `upsertItems('memos',[memo])`、そうでなければ既存 `set`、(4) どちらも `true` を返す、に整形する。`__addMemoImpl` という別関数は作らず、`addMemo` 本体内に分岐を入れる（上の擬似 return は使わない）。テストの `updateMemo`/`deleteMemo`/`deleteAllMemos` が緑になればよい（addMemo の collab テストは任意追加可）。

`updateMemo`（[L1222](../../../src/store/useMitigationStore.ts#L1222)）:

```ts
                updateMemo: (id, patch) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.upsertItems('memos', [{ id, ...patch }]);
                        return;
                    }
                    set((state) => ({ /* 既存 */ memos: state.memos.map(/* ... */) }));
                },
```

`deleteMemo`（[L1228](../../../src/store/useMitigationStore.ts#L1228)）:

```ts
                deleteMemo: (id) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('memos', [id]);
                        return;
                    }
                    set((state) => ({ memos: state.memos.filter(m => m.id !== id) }));
                },
```

`deleteAllMemos`（[L1232](../../../src/store/useMitigationStore.ts#L1232)）:

```ts
                deleteAllMemos: () => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.removeItems('memos', get().memos.map(m => m.id));
                        return;
                    }
                    set({ memos: [] });
                },
```

`setAaSettings`（[L1201](../../../src/store/useMitigationStore.ts#L1201)）:

```ts
                setAaSettings: (settings) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.setMeta('aaSettings', settings);
                        return;
                    }
                    set({ aaSettings: settings });
                },
```

`setSchAetherflowPattern`（[L1234](../../../src/store/useMitigationStore.ts#L1234)）— 既存にマージして全体を送る（planMeta はオブジェクト後勝ち）:

```ts
                setSchAetherflowPattern: (memberId, pattern) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.setMeta('schAetherflowPatterns', { ...get().schAetherflowPatterns, [memberId]: pattern });
                        return;
                    }
                    set((state) => ({ schAetherflowPatterns: { ...state.schAetherflowPatterns, [memberId]: pattern } }));
                },
```

`setCurrentLevel`（[L508](../../../src/store/useMitigationStore.ts#L508)）— level のみ Y へ。computedValues はローカル反映（送らない）:

```ts
                setCurrentLevel: (level) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        get()._collabHandlers!.setMeta('currentLevel', level);
                        return;
                    }
                    pushHistory(); // ← 既存にあれば踏襲。無ければ付けない(既存実装に合わせる)
                    set((state) => ({ /* 既存: currentLevel + partyMembers 再計算 */ }));
                },
```

> `setCurrentLevel` のソロ版は `partyMembers` の `computedValues` 再計算を含む（[L508-557](../../../src/store/useMitigationStore.ts#L508-L557)）。collab 分岐は **level を Y に送るだけ**（`computedValues` の反映は `_applyMetaFromCollab` が currentLevel 受信時にローカル再計算する＝Task 9）。`pushHistory` の有無は既存実装に合わせる。

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): ②-b-1 store memos/planMeta 委譲(level/aa/sch)"
```

---

## Task 14: store `importTimelineEvents` バルク委譲

取込（events+phases+labels 全置換・mitigations クリア）を `importBulk` に委譲。

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: 委譲テストを追記（失敗）**

```ts
describe('②-b-1 importTimelineEvents バルク委譲', () => {
  beforeEach(() => useMitigationStore.setState({ timelineEvents: [], phases: [], labels: [], _collabActive: false, _collabHandlers: null }));
  it('importBulk に events と(変換後)phases/labels を渡す', () => {
    const h = mockHandlers(); useMitigationStore.getState().enterCollabMode(h);
    const events = [{ id: 'e1', time: 30, name: { ja: 'x' }, damageType: 'magical' }] as any;
    const importPhases = [{ id: 1, startTimeSec: 0, name: { ja: 'P1' } }];
    useMitigationStore.getState().importTimelineEvents(events, importPhases as any, undefined);
    expect(h.importBulk).toHaveBeenCalledTimes(1);
    const [evArg, phArg, lbArg] = (h.importBulk as any).mock.calls[0];
    expect(evArg.map((e: any) => e.id)).toEqual(['e1']);
    expect(phArg[0].id).toBe('phase_1'); // ソロ版と同じ変換(phase_<id>)
    expect(lbArg).toBeUndefined();
    // store は直変更されない(反映は observeDeep 経由)
    expect(useMitigationStore.getState().timelineEvents).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL

- [ ] **Step 3: collab 分岐を追加**

`importTimelineEvents`（[L603](../../../src/store/useMitigationStore.ts#L603)）冒頭:

```ts
                importTimelineEvents: (events, importPhases, importLabels) => {
                    if (get()._collabActive && get()._collabHandlers) {
                        const maxEventTime = events.length > 0
                            ? events.reduce((max, e) => Math.max(max, e.time), 0) : undefined;
                        const finalEvents = [...events].sort((a, b) => a.time - b.time);
                        const finalPhases = importPhases
                            ? ensurePhaseEndTimes(importPhases
                                .filter(p => p.startTimeSec >= 0)
                                .map(p => ({ id: `phase_${p.id}`, name: p.name, startTime: p.startTimeSec })), maxEventTime)
                            : undefined;
                        get()._collabHandlers!.importBulk(finalEvents, finalPhases, importLabels);
                        if (events.length > 0) useTutorialStore.getState().completeEvent('content:selected');
                        return;
                    }
                    pushHistory();
                    // ...(既存 set)
```

> `ensurePhaseEndTimes` はソロ版と同じヘルパ（[L613](../../../src/store/useMitigationStore.ts#L613) で使用）。`importBulk` がローカルの mitigations クリア相当（Y の mitigations 全削除→②-a observeDeep→`_applyMitigationsFromCollab([])`）を担うため、store 側で `timelineMitigations:[]` を set しない。

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): ②-b-1 importTimelineEvents バルク委譲(importBulk)"
```

---

## Task 15: 監査ガード（undo/redo/loadSnapshot/reset を collab 中 no-op）

共同編集中に Y を経由せず store を全置換する経路を塞ぎ、無言 desync を防ぐ（設計書 §5/§9）。

**Files:**
- Modify: `src/store/useMitigationStore.ts`
- Test: `src/store/__tests__/useMitigationStore.collab.test.ts`

- [ ] **Step 1: ガードテストを追記（失敗）**

```ts
describe('②-b-1 collab 中のバルク/履歴経路ガード', () => {
  beforeEach(() => useMitigationStore.setState({
    timelineEvents: [{ id: 'e1', time: 10, name: { ja: 'x' }, damageType: 'magical' }] as any,
    _history: [{ timelineMitigations: [], timelineEvents: [], phases: [], labels: [], partyMembers: [] }] as any,
    _collabActive: false, _collabHandlers: null,
  }));
  it('collab 中の undo は状態を変えない(no-op)', () => {
    useMitigationStore.getState().enterCollabMode(mockHandlers());
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().undo();
    expect(useMitigationStore.getState().timelineEvents).toBe(before);
  });
  it('collab 中の redo は状態を変えない(no-op)', () => {
    useMitigationStore.setState({ _future: [{ timelineMitigations: [], timelineEvents: [], phases: [], labels: [], partyMembers: [] }] as any });
    useMitigationStore.getState().enterCollabMode(mockHandlers());
    const before = useMitigationStore.getState().timelineEvents;
    useMitigationStore.getState().redo();
    expect(useMitigationStore.getState().timelineEvents).toBe(before);
  });
});
```

- [ ] **Step 2: テストが落ちることを確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: FAIL（現状 undo/redo は collab でも store を書き換える）

- [ ] **Step 3: ガード追加**

`undo`（[L418](../../../src/store/useMitigationStore.ts#L418)）と `redo`（[L441](../../../src/store/useMitigationStore.ts#L441)）の先頭:

```ts
                undo: () => set((state) => {
                    if (state._collabActive) return state; // 共同編集中は no-op(CRDT undo は②-c)
                    if (state._history.length === 0) return state;
                    // ...(既存)
                }),
                redo: () => set((state) => {
                    if (state._collabActive) return state; // 共同編集中は no-op(②-c)
                    if (state._future.length === 0) return state;
                    // ...(既存)
                }),
```

`loadSnapshot`（[L353](../../../src/store/useMitigationStore.ts#L353)）冒頭 — collab 中は別プランの読み込みを禁止（部屋の seed が正）:

```ts
                loadSnapshot: (snapshot) => {
                    if (get()._collabActive) return; // 共同編集中は部屋の状態が正(別プラン読込を禁止)
                    // ...(既存)
                },
```

> レベル別 reset（[L1268](../../../src/store/useMitigationStore.ts#L1268) 付近の関数）が UI から collab 中に呼ばれ得るか実装時に確認。呼ばれ得るなら同様の `if (get()._collabActive) return;` ガードを足す。呼ばれない（モーダル等が collab 中は出ない設計）なら不要だが、安全側でガードを足してよい。

- [ ] **Step 4: テスト緑を確認**

Run: `npx vitest run src/store/__tests__/useMitigationStore.collab.test.ts`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/store/useMitigationStore.ts src/store/__tests__/useMitigationStore.collab.test.ts
git commit -m "feat(collab): ②-b-1 collab中のundo/redo/loadSnapshotをno-opガード"
```

---

## Task 16: 統合確認（非破壊・全テスト緑・build）

dormant engine として main に載せる前の最終ゲート。**UI 入口を増やさない＝本番 bundle 非混入を担保**。

**Files:** （変更なし・検証のみ）

- [ ] **Step 1: root 全テスト**

Run: `npm test`
Expected: 全 suite PASS（既存 + ②-b-1 新規）。既知の既存 failure（[docs/TODO.md](../../TODO.md) 記載の TopBar 4 件 + HousingWorkspace 1 件＝環境依存・本件無関係）以外に新規 failure が無いこと。

- [ ] **Step 2: worker 全テスト + 型**

Run: `npm --prefix workers/collab test`
Run: `npm --prefix workers/collab run typecheck`
Expected: PASS / 型エラーなし

- [ ] **Step 3: build（Vercel と同じ tsc 厳密・memory `feedback_vercel_tsc_strict`）**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: collabProvider 非 import の確認（dormant 担保）**

Run: `npx vitest run` は不要。代わりに grep で UI からの import 増加が無いことを確認:
Run: `git grep -n "collabProvider\|startCollabSession" -- src/components src/App.tsx`
Expected: ②-a 時点と同じ（新たな UI import が増えていない＝休眠継続）。増えていれば dormant 違反なので戻す。

- [ ] **Step 5: 仕上げ commit（あれば）+ ハンドオフ**

```bash
git status   # 未コミットが無いこと
git log --oneline -18   # Task0-16 のコミットを確認
```

- [ ] **Step 6: docs/TODO.md を更新**

`docs/TODO.md` のバックログ「リアルタイム共同編集」項に ②-b-1 完了（ブランチ `feat/collab-stage2b1-plandata-sync`・dormant・push/deploy 保留・次=②-b-2 partyMembers）を 1〜2 行で追記。100 行以内を維持。

```bash
git add docs/TODO.md
git commit -m "docs(todo): ②-b-1(軽量PlanDataライブ同期)実装完了を反映・次は②-b-2"
```

---

## Self-Review（plan 作成者チェック・実施済）

**Spec coverage（設計書の各節 → タスク対応）:**
- §3 Y.Doc 構造 → Task 1（client キー/変換）+ Task 2（worker ミラー）
- §3 マージ意味（id 単位/フィールド単位） → Task 1 テスト（同時 upsert 両残・部分更新）
- §4 クライアントブリッジ（handlers/observeDeep） → Task 7（型）+ Task 8（実装）
- §4 phases/labels クリッピング再現 → Task 11/12（delta 計算で委譲）
- §4 importTimelineEvents バルク → Task 14（+ Task 8 importBulk）
- §5 store 委譲（全 mutation） → Task 10–14
- §5 setCurrentLevel の partyMembers 非同期注意 → Task 9（apply で局所再計算）+ Task 13（level のみ送信）
- §6 永続化拡張（worker/Vercel・mitigations 無改変） → Task 3/4（worker）+ Task 5/6（Vercel）
- §7 同期しないもの（myMemberId/undo/computedValues） → Task 9（computedValues 局所）+ Task 15（undo/redo/loadSnapshot ガード）
- §8 b-2 接続・importBulk の mitigations 例外 → Task 8（importBulk が mitigations Y.Array クリア）
- §9 テスト方針（純/worker/Vercel/非破壊） → 各 Task の TDD + Task 16
- §10 dormant/デプロイ → Task 0（branch）+ Task 16 Step4（import 非増加）・push/deploy 保留

**Placeholder scan:** Task 4 Step2（既存 server.test 構造に追従）と Task 13 addMemo（既存本体に分岐挿入）は「既存を Read してから整形」の指示付き。これは既存コードに依存するため意図的（コードは周辺を全文記載済・`__addMemoImpl` の擬似 return は使わない旨明記）。それ以外に TBD/未記載コードなし。

**Type consistency:** `CollabHandlers` の汎用 5 メソッド（`upsertItems`/`removeItems`/`setMeta`/`importBulk` + ②-a 3 つ）は Task 7 定義 → Task 8 実装 → Task 9–14 で同シグネチャ使用で一致。`PlanArrayKey`（'timelineEvents'|'phases'|'labels'|'memos'）は Task 1 定義 → 全 upsert/remove 呼び出しで一致。`_apply*FromCollab` は Task 9 定義 → Task 8 で呼び出し一致。worker `PlanDataSeed`/`PlanDataPayload` は Task 2 定義 → Task 3/4 で一致。
