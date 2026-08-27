export type BarrierStackGroup = 'galvanize' | 'eukrasian_prognosis' | 'eukrasian_diagnosis';

export interface BarrierConflictInput {
  group?: BarrierStackGroup;
  remaining: number;
  castTime: number;
  id: string;
}

/** 同時刻タイブレーク: id の大きい方を勝ちとする（安定・決定的）。 */
function tiebreak(a: BarrierConflictInput, b: BarrierConflictInput): 'a' | 'b' {
  return a.id > b.id ? 'a' : 'b';
}

/** castTime が新しい方を勝ちにする（同時刻は id）。 */
function laterWins(a: BarrierConflictInput, b: BarrierConflictInput): 'a' | 'b' {
  if (a.castTime !== b.castTime) return a.castTime > b.castTime ? 'a' : 'b';
  return tiebreak(a, b);
}

export function resolveBarrierConflict(a: BarrierConflictInput, b: BarrierConflictInput): 'a' | 'b' | 'both' {
  if (a.group == null || b.group == null) return 'both';

  // グループをまたぐ: エウクラシア・ディアグノシスは「バリアが残っている間」は一方通行で勝つ
  // （鼓舞系では上書きできない）。削り切られた（remaining<=0）ディアグノシスは buff が落ちて
  // いる状態なので、後から置いた鼓舞系で上書きできる（＝後勝ちに戻る）。
  if (a.group !== b.group) {
    if (a.group === 'eukrasian_diagnosis' && a.remaining > 0) return 'a';
    if (b.group === 'eukrasian_diagnosis' && b.remaining > 0) return 'b';
    // galvanize ↔ eukrasian_prognosis、または削り切られたディアグノシス → 後勝ち
    return laterWins(a, b);
  }

  // 同グループ
  if (a.group === 'galvanize') {
    if (a.remaining !== b.remaining) return a.remaining > b.remaining ? 'a' : 'b';
    return laterWins(a, b);
  }
  // eukrasian_prognosis / eukrasian_diagnosis 同グループ → 後勝ち
  return laterWins(a, b);
}

/**
 * バリア(シールド)1インスタンスに一撃が当たったときの状態遷移(純粋・テスト可能)。
 * damageMapResult の被弾ループから切り出したもの。挙動は元コードと 1:1。
 *
 * - `absorbed`: この一撃で肩代わりした量
 * - `finalShield`: 一撃後の残バリア量。スタック制(`reapplyOnAbsorption`)は壊れると
 *   1 スタック消費して `maxVal` に貼り直されるため、スタックが残っていれば 0 にはならない。
 * - `finalStacks`: 一撃後の残スタック数(スタック非対応なら `undefined`)
 * - `exhausted`: バリアが完全に尽きた(= `finalShield <= 0`、もう肩代わりできない)か。
 *   スタックが残っている限り `false`。エフェクト棒の早期終了判定に使う。
 */
export function stepShieldAbsorption(args: {
    shieldRemaining: number;
    incomingDamage: number;
    stacksRemaining: number | undefined;
    maxVal: number;
    reapplyOnAbsorption: boolean | undefined;
}): { absorbed: number; finalShield: number; finalStacks: number | undefined; exhausted: boolean } {
    const { shieldRemaining, incomingDamage, stacksRemaining, maxVal, reapplyOnAbsorption } = args;
    const absorbed = Math.min(shieldRemaining, incomingDamage);
    const isBroken = absorbed >= shieldRemaining;
    let finalShield = shieldRemaining - absorbed;
    let finalStacks = stacksRemaining;
    // 🚨 仕様: 1回の着弾で複数スタックを一気に消費しない
    if (isBroken && finalStacks !== undefined && finalStacks > 0 && reapplyOnAbsorption) {
        finalStacks -= 1;
        finalShield = maxVal; // 貼り直されたので次は新品
    }
    return { absorbed, finalShield, finalStacks, exhausted: finalShield <= 0 };
}

/**
 * バリアの「実効カバー範囲」を表す context を返す(純粋・テスト可能)。
 * エフェクト棒の早期終了は、このカバー範囲のバケツが尽きたときだけ行う。
 *
 * ダメージ計算はバリアを Party / MT / ST の 3 バケツで別々に追跡する。全体バリア
 * (意気軒高の策・ディヴァインヴェール等)はタンク単体攻撃で MT バケツだけ枯れても、
 * 全体攻撃用の Party バケツと他メンバー分は残っている = まだ効いている。棒を止めて
 * よいのは「全体攻撃で全体分(Party バケツ)が尽きたとき」だけ。
 *
 * - 対象指定バリア(鼓舞激励の策等 targetId あり)      → その対象 context
 * - 自分バリア(scope:'self')                          → 使用者本人の context
 * - それ以外(全体バリア / scope:'party' / 未指定)     → 'Party'
 */
export function shieldCoverageContext(
    targetId: string | undefined,
    scope: string | undefined,
    ownerId: string,
): string {
    if (targetId) return targetId;
    if (scope === 'self') return ownerId;
    return 'Party';
}

export interface ContextShieldEntry {
  appMitId: string;
  group?: BarrierStackGroup;
  /** 消費優先順位。小さいほど先。未設定バリアは呼び出し側で Number.MAX_SAFE_INTEGER を渡す。 */
  priority: number;
  castTime: number;
  /** 満タンのバリア量（この context 用）。 */
  maxVal: number;
  /** スタック制の最大スタック数。非スタックは undefined。 */
  maxStacks?: number;
  reapplyOnAbsorption?: boolean;
}

export interface ContextShieldState {
  /** appMitId → 現在の残バリア量。 */
  remaining: Map<string, number>;
  /** appMitId → 現在の残スタック。 */
  stacks: Map<string, number>;
  /** この context で既に上書き負けして無効なバリアの appMitId（ラッチ）。 */
  overwritten: Set<string>;
}

export interface ContextShieldResult {
  /** この被弾でバリアが吸収した合計量。 */
  totalAbsorbed: number;
  /** この被弾で完全に尽きた（もう肩代わりできない）バリアの appMitId。 */
  newlyExhausted: string[];
  /** この被弾で初めて上書き負けが確定したバリアの appMitId。 */
  newlyOverwritten: string[];
  /** displayContext 用: 各バリアの被弾後スタック数（UI 表示用）。 */
  stacksAfter: Map<string, number | undefined>;
}

/** entries の中で state.overwritten でないものについて:
 *  1) 非スタック解決（詠唱時刻昇順の逐次サバイバー方式。group を持つものだけが
 *     上書き合戦に参加し、負けたら state.overwritten に追加）。
 *     非推移的な連鎖（大鼓舞 → プログノシス → 小鼓舞）でも全滅しないよう、
 *     全ペア総当たりではなく「詠唱時刻昇順で 1 枚ずつ既存サバイバーと戦う」方式を採る。
 *  2) 生き残りを priority 昇順（同値は castTime 昇順→appMitId 昇順）に並べ、
 *     incomingDamage を持ち回って順に吸収（stepShieldAbsorption）。
 *  state（remaining / stacks / overwritten）を破壊的に更新する。 */
export function resolveContextShields(
  entries: ContextShieldEntry[],
  incomingDamage: number,
  state: ContextShieldState,
): ContextShieldResult {
  const remainingOf = (e: ContextShieldEntry): number =>
    state.remaining.has(e.appMitId) ? state.remaining.get(e.appMitId)! : e.maxVal;
  const stacksOf = (e: ContextShieldEntry): number | undefined =>
    state.stacks.has(e.appMitId) ? state.stacks.get(e.appMitId)! : e.maxStacks;
  const byId = (a: ContextShieldEntry, b: ContextShieldEntry) =>
    a.appMitId < b.appMitId ? -1 : a.appMitId > b.appMitId ? 1 : 0;

  const newlyExhausted: string[] = [];
  const newlyOverwritten: string[] = [];
  const stacksAfter = new Map<string, number | undefined>();

  // --- 非スタック解決（詠唱時刻昇順の逐次サバイバー方式） ---
  const active = entries.filter(e => !state.overwritten.has(e.appMitId));
  // group を持つものだけが上書き合戦に参加する。group 未設定は常に共存。
  const grouped = active
    .filter(e => e.group != null)
    .sort((a, b) => a.castTime - b.castTime || byId(a, b));

  const survivors: ContextShieldEntry[] = [];
  const losers = new Set<string>();

  for (const e of grouped) {
    let eLoses = false;
    const beaten: ContextShieldEntry[] = [];
    for (const s of survivors) {
      const verdict = resolveBarrierConflict(
        { group: e.group, remaining: remainingOf(e), castTime: e.castTime, id: e.appMitId },
        { group: s.group, remaining: remainingOf(s), castTime: s.castTime, id: s.appMitId },
      );
      if (verdict === 'b') { eLoses = true; break; }   // 既存サバイバー s が勝ち → e 敗退
      if (verdict === 'a') beaten.push(s);              // e が s に勝つ
      // 'both' は両方 group 非 null のとき resolveBarrierConflict からは返らない
    }
    if (eLoses) {
      losers.add(e.appMitId);
    } else {
      for (const s of beaten) {
        losers.add(s.appMitId);
        const idx = survivors.indexOf(s);
        if (idx >= 0) survivors.splice(idx, 1);
      }
      survivors.push(e);
    }
  }

  // ラッチ（state.overwritten へ）＋ newlyOverwritten は詠唱時刻昇順（= grouped の順）
  for (const e of grouped) {
    if (losers.has(e.appMitId)) {
      state.overwritten.add(e.appMitId);
      newlyOverwritten.push(e.appMitId);
    }
  }

  // --- 吸収（消費優先順位 昇順 → 詠唱時刻 昇順 → appMitId 昇順） ---
  const absorbers = active
    .filter(e => !losers.has(e.appMitId))
    .sort((a, b) => a.priority - b.priority || a.castTime - b.castTime || byId(a, b));

  let dmg = incomingDamage;
  let totalAbsorbed = 0;

  for (const e of absorbers) {
    const rem = remainingOf(e);
    if (rem <= 0) continue;
    if (dmg <= 0) break;                 // 残りのバリアは無傷で残す
    const step = stepShieldAbsorption({
      shieldRemaining: rem,
      incomingDamage: dmg,
      stacksRemaining: stacksOf(e),
      maxVal: e.maxVal,
      reapplyOnAbsorption: e.reapplyOnAbsorption,
    });
    state.remaining.set(e.appMitId, step.finalShield);
    if (step.finalStacks !== undefined) state.stacks.set(e.appMitId, step.finalStacks);
    stacksAfter.set(e.appMitId, step.finalStacks);
    dmg -= step.absorbed;
    totalAbsorbed += step.absorbed;
    if (step.finalShield <= 0) newlyExhausted.push(e.appMitId);
  }

  return { totalAbsorbed, newlyExhausted, newlyOverwritten, stacksAfter };
}
