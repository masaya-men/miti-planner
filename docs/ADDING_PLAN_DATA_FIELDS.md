# 軽減表のデータ項目を足すとき(共同編集の配線チェックリスト)

軽減表のデータ(`PlanData`・`src/types/index.ts`)に項目を足すと、ソロ・共同編集・サーバー保存の各層に手で配線が要る。1 か所でも忘れると「ソロでは動くが共同編集で消える」。

**唯一の一覧** = `PLAN_DATA_COLLAB`(`src/lib/collab/yjsPlanData.ts`)。`PlanData` に項目を足すとここで型エラーになるので、まず「同期する / しない」を決めて書く。
**網羅テスト** = `src/lib/collab/__tests__/planDataCollabCoverage.test.ts`。一覧に書いた同期先が、下の各層に配線されていないと落ちる。

## 1. 同期しない項目(人ごとの表示設定など)

- [ ] `PLAN_DATA_COLLAB` に `{ notSynced: "理由" }` を書く
- [ ] 他の人の部屋に持ち込まれて困るなら `enterCollabMode`(`src/store/useMitigationStore.ts`)で既定に戻す(例: `hiddenPartyMemberIds`)

## 2. 同期する項目

配列(id を持つ要素の列)は Y.Doc トップレベルの配列、単一の値は `planMeta` の中に置く。

| # | 場所 | やること |
|---|---|---|
| 1 | `src/lib/collab/yjsPlanData.ts` | 鍵の定数・`PLAN_DATA_COLLAB` に `{ sync: [...] }`。配列なら `PlanArrayKey` と `buildArrByKey`、値なら `PlanMetaSlice` / `metaKeyForField` / `readPlanMeta` |
| 2 | `src/lib/collab/collabTypes.ts` | 値なら `setMeta` の field の型に足す |
| 3 | `src/store/useMitigationStore.ts` | 状態・`getSnapshot`・`partialize`・ソロの処理。**変更する全アクションに共同編集の分岐**(`_collabActive && _collabHandlers` → handlers へ渡し、手元は直接変えない)。部屋からの反映 `_apply...FromCollab`(値なら `_applyMetaFromCollab`) |
| 4 | `src/lib/collab/collabProvider.ts` | `applyRoomToStore`(入室時の反映)・`observeDeep`(相手の変更の反映)。全部空のときの復元 `reseedEmptyDocFields` |
| 5 | `api/collab/_logic.ts` | `PlanDocSnapshotFull` / `LoadResultFull` / `decideLoadFull`(サーバーからの seed)。空で上書きされて困る構造なら `GUARDED_ARRAY_FIELDS` |
| 6 | `api/collab/_saveHandler.ts` | body の受け取りと `update['data.…']`(保存) |
| 7 | `workers/collab/src/yjsPlanData.ts` | client の鍵のミラー・`PlanDataSeed`・`buildSeedDocFull`・`readPlanDataFull`(別パッケージなので複製) |
| 8 | テスト | `npx vitest run src/lib/collab src/store/__tests__/useMitigationStore.collab.test.ts` と `workers/collab` の vitest |

## 3. 気をつけること

- **`undefined` は部屋に送れない**(Yjs の Map は undefined を持てない)。値を「消す」操作は共同編集では手元だけになる。消す必要があるなら `null` などの番兵値で表す。
- **元に戻す(Ctrl+Z)** の対象は 5 つの配列だけ(`collabProvider.ts` の `planUndo`)。新しい配列を戻したいなら範囲に足す。
- **削除の取り消しで元の位置に戻す**ときは `upsertItems` ではなく `insertItemAt`(upsert は末尾に足すため順番が崩れる)。
- 共有コピーから外す項目(進捗・メモ等)の扱いは共有側の処理も確認する。
