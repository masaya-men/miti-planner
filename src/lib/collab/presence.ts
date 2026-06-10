// ④-b-1: presence(roster)の純粋ロジック + awareness 配線(設計書 §3・§4.1)。
// roster は WS awareness(provider.awareness)で全員に確実配信する。
// yjs/y-protocols を静的 import しない(遅延境界)。awareness は AwarenessLike 経由で受け取り、
// 本物の Awareness は collabProvider(遅延チャンク)から、テストは fake を渡す。

/** 各クライアントが awareness.presence に載せる気配情報。④-b-2 で jobId/cursorEnabled を活用。 */
export interface PresenceState {
  color: string;          // 自動配色(colorForClient)。roster/カーソル共通。
  jobId: string | null;   // 自己表現ジョブ(④-b-2 で選択 UI)。b-1 は null。
  isEditor: boolean;      // 表示用バッジ(真実の権限は④-a サーバゲート)= !readOnly。
  cursorEnabled: boolean; // カーソル配信 ON/OFF(④-b-2 のトグル)。b-1 は既定 true。
}

/** UI が描く 1 参加者分。 */
export interface RosterEntry {
  clientId: number;
  color: string;
  jobId: string | null;
  isEditor: boolean;
  cursorEnabled: boolean;
  isLocal: boolean;
}

/**
 * 同室内で識別しやすい中間トーンのパレット。機能色の意味(純赤=削除/純青=進む/純黄=警告)と
 * 衝突しない色相に寄せる(DESIGN ルール)。最終色はユーザー視覚確認で微調整可(設計書 §11)。
 */
export const PALETTE: readonly string[] = [
  '#34d399', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c',
  '#a3e635', '#e879f9', '#2dd4bf', '#818cf8', '#fbbf24',
];

/** clientId → 決定的に配色(同じ人は毎回同じ色)。負数も範囲内に丸める。 */
export function colorForClient(clientId: number): string {
  const n = PALETTE.length;
  return PALETTE[((clientId % n) + n) % n];
}

/** awareness の states マップを roster 配列へ。presence 未設定は除外。自分先頭→clientId 昇順。 */
export function buildRoster(
  states: Map<number, { presence?: PresenceState } | null | undefined>,
  localClientId: number,
): RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const [clientId, st] of states) {
    const p = st?.presence;
    if (!p) continue;
    out.push({
      clientId,
      color: p.color,
      jobId: p.jobId ?? null,
      isEditor: !!p.isEditor,
      cursorEnabled: p.cursorEnabled !== false,
      isLocal: clientId === localClientId,
    });
  }
  out.sort((a, b) => (a.isLocal === b.isLocal ? a.clientId - b.clientId : a.isLocal ? -1 : 1));
  return out;
}
