// workers/collab/src/collabCapacity.ts
// 共同編集⑤-2b: 満員判定の純ロジック。DO/WS 非依存で決定的にテストする
// (③/⑤-1 の _logic.ts・_roomLogic.ts と同じ「純関数を分離」方針の worker 版)。
// index.ts(onBeforeConnect)と server.ts(/count)がこれを wrap する。

/**
 * 既定の最大人数 = 零式/絶のフルパーティ1組。
 * root の api/collab/_roomLogic.ts:6 と同値(別ランタイムで import 不可のため複製)。
 */
export const DEFAULT_MAX_PARTICIPANTS = 8;
/**
 * システム上限。root の api/collab/_roomLogic.ts:8 と同値(別ランタイムで複製)。
 */
export const SYSTEM_MAX_PARTICIPANTS = 28;

/** DO 永続ストレージに max を保存するキー。y-partyserver の内部キーと衝突しないよう名前空間を付ける。 */
export const MAX_PARTICIPANTS_KEY = "collab:maxParticipants";

/** 在室数が上限に達しているか。新規接続を受け入れる前に呼ぶ(count は接続前の現在値)。 */
export function isRoomFull(count: number, max: number): boolean {
  return count >= max;
}

/**
 * storage から読んだ max(未保存=undefined や壊れた値を含む)を有効な上限に正規化する。
 * 未指定/非数は既定 8、範囲外は [1, SYSTEM_MAX] に丸め、小数は切り捨て。
 * (受付係が clampMaxParticipants 済みの値を返すが、storage 値の防御的正規化として再適用する。)
 */
export function resolveMaxParticipants(stored: number | undefined): number {
  if (typeof stored !== "number" || !Number.isFinite(stored)) return DEFAULT_MAX_PARTICIPANTS;
  return Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, Math.floor(stored)));
}
