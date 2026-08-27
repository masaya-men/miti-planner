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

  // グループをまたぐ: ディアグノシスが絡めばディアグノシスが勝つ
  if (a.group !== b.group) {
    if (a.group === 'eukrasian_diagnosis') return 'a';
    if (b.group === 'eukrasian_diagnosis') return 'b';
    // galvanize ↔ eukrasian_prognosis → 後勝ち
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
