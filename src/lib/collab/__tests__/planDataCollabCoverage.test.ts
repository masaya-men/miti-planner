import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useMitigationStore } from "../../../store/useMitigationStore";
import { usePlanStore } from "../../../store/usePlanStore";
import { applyRoomToStore } from "../collabRoomApply";
import { PLAN_DATA_COLLAB, PLAN_META_KEY, buildArrByKey, metaKeyForField, applyInsertAt, recordToYMap, type CollabSyncTarget } from "../yjsPlanData";
import { decideLoadFull, type PlanDocSnapshotFull } from "../../../../api/collab/_logic";
import type { PlanData } from "../../../types";

// 共同編集の網羅テスト(2026-10-27 整頓④)。PlanData の項目は PLAN_DATA_COLLAB に全部載り(型で強制)、
// 同期する項目は「サーバーの seed → 部屋 → 手元」「手元 → 部屋(復元)」「部屋 → サーバー保存」「worker の seed/読み出し」
// のどこにも抜けが無いことをここで見る。1 つ忘れると「ソロでは動くが共同編集で消える」。
// 手順書: docs/ADDING_PLAN_DATA_FIELDS.md

const ROOT = resolve(__dirname, "../../../../");
const entries = Object.entries(PLAN_DATA_COLLAB) as [keyof PlanData, { sync?: readonly CollabSyncTarget[]; notSynced?: string }][];
const targets: CollabSyncTarget[] = entries.flatMap(([, rule]) => rule.sync ?? []);

/** "data.progress.points" → snapshot.progress.points */
function atPath(obj: unknown, savePath: string): unknown {
  return savePath.replace(/^data\./, "").split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}
const ids = (v: unknown) => (v as { id: string }[]).map((x) => x.id);

// 同期する項目がすべて「空でない・既定値と違う」値を持つプラン
const FULL: PlanData = {
  currentLevel: 90,
  timelineEvents: [{ id: "ev1", time: 10, name: { ja: "全体攻撃", en: "Raidwide" }, damageType: "magical", damageAmount: 1000, target: "AoE" } as never],
  timelineMitigations: [{ id: "m1", mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT" } as never],
  phases: [{ id: "ph1", name: { ja: "P1", en: "P1" }, startTime: 0 } as never],
  labels: [{ id: "lb1", name: { ja: "L", en: "L" }, startTime: 0 } as never],
  partyMembers: [{ id: "MT", jobId: "war", role: "tank", stats: {}, computedValues: {} } as never],
  aaSettings: { damage: 1234, type: "magical", target: "ST" },
  schAetherflowPatterns: { H2: 2 },
  myMemberId: "MT",
  memos: [{ id: "memo1", text: "x", timeSec: 5, xRatio: 0.5 } as never],
  progress: { points: [{ id: "pt1", ts: 1, reachedPos: 30 }], cleared: true, activeDays: 3, activeHours: 7 },
  hiddenPartyMemberIds: ["D4"],
  timelineSortOrder: "role",
};

function resetStore() {
  useMitigationStore.setState({
    _collabActive: false, _collabHandlers: null, _collabReadonly: false, _loadedPlanId: null,
    timelineMitigations: [], timelineEvents: [], phases: [], labels: [], memos: [], partyMembers: [],
    progress: { points: [], cleared: false },
  } as never);
  usePlanStore.setState({ plans: [] } as never);
}

describe("PlanData の共同編集の網羅", () => {
  beforeEach(resetStore);

  it("PlanData の全項目が PLAN_DATA_COLLAB に載っている(getSnapshot の項目と一致)", () => {
    const snapKeys = Object.keys(useMitigationStore.getState().getSnapshot()).sort();
    expect(snapKeys).toEqual(entries.map(([k]) => k).sort());
  });

  it("配列の鍵は部屋の配列一覧(buildArrByKey)と過不足なく一致する", () => {
    const arrayKeys = targets.filter((t) => t.kind === "array").map((t) => t.yjsKey).sort();
    expect(arrayKeys).toEqual(Object.keys(buildArrByKey(new Y.Doc())).sort());
  });

  it("meta の鍵はすべて setMeta で書ける(metaKeyForField)", () => {
    for (const t of targets.filter((x) => x.kind === "meta")) expect(metaKeyForField(t.yjsKey), t.yjsKey).toBe(t.yjsKey);
  });

  it("手元 → 部屋(部屋が空のときの復元)→ 手元 で同期項目がすべて往復する", () => {
    // 手元にプランを読み込み、その部屋に入る(持ち主一致 = 復元してよい)
    useMitigationStore.setState({ ...FULL, _loadedPlanId: "plan1" } as never);
    usePlanStore.setState({ plans: [{ id: "plan1", activeCollabRoomToken: "room1" }] } as never);
    const doc = new Y.Doc();
    applyRoomToStore(doc, { readOnly: false, roomToken: "room1", handlers: {} as never });
    const meta = doc.getMap(PLAN_META_KEY);
    for (const t of targets) {
      if (t.kind === "array") expect(doc.getArray(t.yjsKey).length, `部屋へ復元されない: ${t.yjsKey}`).toBeGreaterThan(0);
      else expect(meta.get(t.yjsKey), `部屋へ復元されない: ${t.yjsKey}`).toEqual(atPath(FULL, t.savePath));
    }

    // 別の人(閲覧)が同じ部屋を受け取る → 手元に全部入る
    useMitigationStore.getState().exitCollabMode();
    resetStore();
    applyRoomToStore(doc, { readOnly: true, roomToken: "room1", handlers: {} as never });
    const snap = useMitigationStore.getState().getSnapshot();
    for (const t of targets) {
      const want = atPath(FULL, t.savePath);
      const got = atPath(snap, t.savePath);
      if (t.kind === "array") expect(ids(got), `部屋から手元へ入らない: ${t.yjsKey}`).toEqual(ids(want));
      else expect(got, `部屋から手元へ入らない: ${t.yjsKey}`).toEqual(want);
    }
  });

  it("サーバーの seed(decideLoadFull)が同期項目をすべて渡す", () => {
    const loaded = decideLoadFull({ data: FULL } as unknown as PlanDocSnapshotFull) as Record<string, unknown>;
    for (const t of targets) {
      // 軽減だけは seed 上の名前が mitigations(②-a からの互換)
      const k = t.yjsKey === "timelineMitigations" ? "mitigations" : t.yjsKey;
      const v = loaded[k];
      expect(v, `seed に無い: ${k}`).toBeDefined();
      if (Array.isArray(v)) expect(v.length, `seed が空: ${k}`).toBeGreaterThan(0);
    }
  });

  it("サーバー保存(_saveHandler)が同期項目をすべて Firestore に書く", () => {
    const src = readFileSync(resolve(ROOT, "api/collab/_saveHandler.ts"), "utf8");
    for (const t of targets) expect(src, `保存されない: ${t.savePath}`).toContain(`update['${t.savePath}']`);
  });

  it("worker の seed と読み出し(保存の元)が同期項目をすべて扱う", () => {
    const src = ["yjsPlanData.ts", "yjsMitigations.ts"].map((f) => readFileSync(resolve(ROOT, "workers/collab/src", f), "utf8")).join("\n");
    const constOf = new Map([...src.matchAll(/^(?:export )?const (\w+) = "(\w+)"/gm)].map((m) => [m[2], m[1]]));
    const body = (fn: string) => {
      const start = src.indexOf(`export function ${fn}(`);
      expect(start, fn).toBeGreaterThanOrEqual(0);
      return src.slice(start, src.indexOf("\n}\n", start));
    };
    const seed = body("buildSeedDocFull");
    const read = body("readPlanDataFull");
    for (const t of targets) {
      const name = constOf.get(t.yjsKey);
      expect(name, `worker に鍵の定義が無い: ${t.yjsKey}`).toBeDefined();
      expect(seed, `worker の seed に無い: ${t.yjsKey}`).toMatch(new RegExp(`\\b${name}\\b`));
      expect(read, `worker の読み出しに無い: ${t.yjsKey}`).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});

describe("applyInsertAt(削除の取り消しで元の位置に戻す)", () => {
  const arrOf = (idList: string[]) => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>("progressPoints");
    for (const id of idList) arr.push([recordToYMap({ id })]);
    return arr;
  };
  const idsOf = (arr: Y.Array<Y.Map<unknown>>) => arr.toArray().map((y) => y.get("id"));

  it("指定の位置に差し込む", () => {
    const arr = arrOf(["a", "c"]);
    applyInsertAt(arr, 1, { id: "b" });
    expect(idsOf(arr)).toEqual(["a", "b", "c"]);
  });

  it("範囲外の位置は端に丸める・同じ id があれば増やさない", () => {
    const arr = arrOf(["a"]);
    applyInsertAt(arr, 99, { id: "z" });
    applyInsertAt(arr, -5, { id: "0" });
    applyInsertAt(arr, 0, { id: "a" });
    expect(idsOf(arr)).toEqual(["0", "a", "z"]);
  });
});
