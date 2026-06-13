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

/**
 * clientId → 決定的な表示名(形容詞+名詞)。同じ人は毎回同じ名前になり、
 * awareness の生 clientID(数字)を隠して識別しやすくする。
 * 単語リスト(adjectives/nouns)と区切り(separator)は i18n から渡す(多言語対応)。
 * 形容詞と名詞は独立したインデックスで選び、組合せの多様性を確保する。
 */
export function nameForClient(
  clientId: number,
  adjectives: readonly string[],
  nouns: readonly string[],
  separator = ' ',
): string {
  const a = adjectives.length;
  const n = nouns.length;
  if (a === 0 || n === 0) return `#${clientId}`;
  const adjIdx = ((clientId % a) + a) % a;
  const nounIdx = ((Math.floor(clientId / a) % n) + n) % n;
  return `${adjectives[adjIdx]}${separator}${nouns[nounIdx]}`;
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

/** provider.awareness(y-protocols Awareness)の必要最小インタフェース。テストで fake 可能にする。 */
export interface AwarenessLike {
  clientID: number;
  setLocalStateField(field: string, value: unknown): void;
  getStates(): Map<number, Record<string, unknown>>;
  on(event: 'change', cb: () => void): void;
  off(event: 'change', cb: () => void): void;
}

/** wirePresence の戻り値: 実行時更新(update)・自己修復(reannounce/requestResync)・購読解除(stop)。 */
export interface PresenceHandle {
  update(patch: Partial<PresenceState>): void;
  /** 値を変えずに自分の presence をもう一度ブロードキャストする(単発再送)。 */
  reannounce(): void;
  /**
   * ①自己修復の要: 「みんな presence を再送して」という要求(resyncReq)をブロードキャストする。
   * ハイバネ復帰で awareness が揮発すると、A は B を見えていても B は A を取りこぼす「非対称」が起きる。
   * このとき欠落側(B)は自分を再送しても直らない(A は欠落が無いので再送しない)。
   * そこで欠落側が requestResync() を呼ぶと、(a) この呼び出し自体が自分の presence を全員へ再送し、
   * (b) 受信側が「resync 要求」を見て自分の presence を再送で応える → 双方向に穴が埋まり収束する。
   * 要求は単調増加カウンタで重複応答しない(ループしない)。何もしないで待っていても収束する。
   */
  requestResync(): void;
  stop(): void;
}

/**
 * local presence を awareness に載せ、変化を購読して roster を通知する。
 * update でトグル(cursorEnabled/jobId)を実行時に反映、stop で購読解除。
 */
export function wirePresence(
  awareness: AwarenessLike,
  local: PresenceState,
  onRoster: (roster: RosterEntry[]) => void,
): PresenceHandle {
  let current: PresenceState = { ...local };
  // #3d/①: ハイバネ復帰でサーバの awareness が揮発すると、参加者の presence が片側だけ消える。
  // 対策は2系統:
  //  (1) gossip: 新規リモートを検知したら自分を再送(相手の roster に自分を出す)。
  //  (2) resync 要求への応答: 誰かが requestResync() を出したら自分を再送(欠落側からの要求で穴を埋める)。
  // どちらも単調増加の token / 既知 ID で重複を抑えループしない。
  const knownRemotes = new Set<number>();
  let respondedResync = 0;   // これまでに応答済みの最大 resync 要求値
  let myResync = 0;          // 自分が出した resync 要求カウンタ
  const announce = () => awareness.setLocalStateField('presence', current);
  const emit = () => {
    const states = awareness.getStates() as Map<number, { presence?: PresenceState; resyncReq?: number }>;
    let hasNew = false;
    let maxResync = 0;
    for (const [id, st] of states) {
      if (id === awareness.clientID) continue;
      if (!knownRemotes.has(id)) { knownRemotes.add(id); hasNew = true; }
      const rq = st?.resyncReq;
      if (typeof rq === 'number' && rq > maxResync) maxResync = rq;
    }
    const needRespond = maxResync > respondedResync;
    if (needRespond) respondedResync = maxResync; // announce より先に更新=再入で二重応答しない
    if (hasNew || needRespond) announce();
    onRoster(buildRoster(states, awareness.clientID));
  };
  awareness.on('change', emit);
  announce();
  emit();
  return {
    update(patch) {
      current = { ...current, ...patch };
      announce();
    },
    reannounce() {
      // 値は据え置きで再送(clock を進め、揮発した自分の presence を全員に届け直す)。
      announce();
    },
    requestResync() {
      // 自分の presence を再送しつつ「みんな再送して」と要求する(欠落側→全員への双方向修復)。
      myResync += 1;
      awareness.setLocalStateField('resyncReq', myResync);
    },
    stop() {
      awareness.off('change', emit);
    },
  };
}
