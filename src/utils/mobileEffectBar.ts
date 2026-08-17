import type { AppliedMitigation, Mitigation } from '../types';

export const MOBILE_EFFECT_BAR_ICON_SIZE = 15;
export const MOBILE_EFFECT_BAR_WIDTH = 4;
export const MOBILE_EFFECT_BAR_SLOT_PITCH = 17;
export const MOBILE_EFFECT_BAR_ROW_INSET = 12;
export const MOBILE_EFFECT_BAR_SCROLL_IDLE_MS = 150;
/**
 * 軽減アイコン専用行(MitiIcons)の1アイコンあたりの必要幅(px、22pxアイコン+グループ間
 * gap-1.5=6pxの最悪ケースで見積もり)。実際は同じ使用者同士は gap-px=1px で密着するため
 * 過小に見積もりがちだが、安全側(絶対に折り返させない)に倒すため意図的に保守的な値。
 */
export const MOBILE_MITI_ICON_PITCH_PX = 28;
/** MobileTimelineRow.tsx の行コンテンツ左右余白(px-3=12px)と同じ値。片側分。 */
export const MOBILE_MITI_ICONS_ROW_PADDING_PX = 12;
/** クロスフェードの最大不透明度(index.cssのフォールバック値と同じ数を維持すること)。 */
export const MOBILE_EFFECT_BAR_MAX_OPACITY = 0.55;
/**
 * 変身が完了するまでに必要なスクロール量(px)。速度ではなく「今回の連続スクロールで
 * 何pxスクロールしたか(絶対値)」で進み具合を決める(2026-08-13、ユーザー判断=速さは無関係)。
 * 指を止めればそこで止まり、逆方向に戻せば進み具合も戻る。
 * 40→60(2026-08-13ユーザー要望=変身が早く終わりすぎるのでもう少し長く)。
 */
export const MOBILE_EFFECT_BAR_MORPH_DISTANCE_PX = 60;
/**
 * 「進む」変身アニメの基本の長さ(ms)。ゆっくりしたスクロールはこの速さで追従する。
 * 勢いよくスクロールした瞬間だけ MOBILE_EFFECT_BAR_SLOWDOWN_MAX_MS まで延ばす
 * (2026-08-13ユーザー要望=速くスクロールするほどアニメが一瞬で終わって見えなくなるため、
 * わざとゆっくり見せてアニメーション自体を認識できるようにする)。
 */
export const MOBILE_EFFECT_BAR_TRACK_MS = 80;
/** 初速がこの速さ(px/ms)以上で最大まで引き伸ばす。 */
export const MOBILE_EFFECT_BAR_FAST_SCROLL_MAX_PX_MS = 1.2;
/** 初速がこの速さ(px/ms)未満なら引き伸ばさない(通常のTRACK_MSのまま)。 */
export const MOBILE_EFFECT_BAR_FAST_SCROLL_MIN_PX_MS = 0.2;
/** 初速最大時の「進む」アニメの長さ(ms)。 */
export const MOBILE_EFFECT_BAR_SLOWDOWN_MAX_MS = 400;

/** PC版のエフェクト棒(MitigationItem)がアイコン分の高さとして加算しているのと同じ値。[Timeline.tsx:3503] */
const ICON_BOTTOM_PADDING = 24;

/**
 * 行の一番上(=時刻)から、静止時に軽減アイコンが実際に表示される高さ(2行目)までのオフセット。
 * MobileTimelineRow.tsx の1行目は「時間+攻撃名」に加えて右端へ「元ダメ→(極小)/軽減率+軽減後
 * ダメージ(通常)」の2段スタックを詰め込む構成(行の高さ=pixelsPerSecond=60pxは不変・
 * 2026-08-13ユーザー指定)。Playwright+WebKit実測値(38px、ダメージ有無どちらの行でも同一)を
 * 直接採用(値がズレたら要調整)。
 */
const MOBILE_EFFECT_BAR_ICON_ROW_OFFSET = 38;

export interface MobileEffectBarColors {
  bg: string;
  border: string;
  shadow: string;
}

export interface MobileEffectBarItem {
  id: string;
  ownerId: string;
  iconUrl: string;
  top: number;
  height: number;
  slotIndex: number;
  colors: MobileEffectBarColors;
}

export interface ComputeMobileEffectBarsArgs {
  timelineMitigations: AppliedMitigation[];
  mitigationDefs: Mitigation[];
  timeToYMap: Map<number, number>;
  pixelsPerSecond: number;
  offsetTime: number;
  hideEmptyRows: boolean;
  maxTime: number;
  eventsByTime: Map<number, unknown[]>;
  mitStartsByTime: Map<number, boolean>;
  showPreStart: boolean;
  /** 横に並べられる最大同時本数(画面幅から算出、呼び出し側が渡す) */
  maxConcurrent: number;
  getColorClasses: (jobId: string | undefined, ownerId: string) => MobileEffectBarColors;
}

// 表示は右詰め1本のクラスタで、読み順(左→右)は MT H1 D1 D3 ST H2 D2 D4 にしたい。
// 右詰めは「優先順位が先の者ほど右端(slotIndex 0)に来る」ため、埋める優先順位は
// 上記の読み順を逆にした配列(D4が最優先で右端)にする。
const MOBILE_EFFECT_BAR_FILL_ORDER = ['D4', 'D2', 'H2', 'ST', 'D3', 'D1', 'H1', 'MT'];

const priorityOf = (ownerId: string): number => {
  const idx = MOBILE_EFFECT_BAR_FILL_ORDER.indexOf(ownerId);
  return idx === -1 ? MOBILE_EFFECT_BAR_FILL_ORDER.length : idx;
};

export function computeMobileEffectBars(args: ComputeMobileEffectBarsArgs): MobileEffectBarItem[] {
  const {
    timelineMitigations, mitigationDefs, timeToYMap, pixelsPerSecond, offsetTime,
    hideEmptyRows, maxTime, eventsByTime, mitStartsByTime, showPreStart,
    maxConcurrent, getColorClasses,
  } = args;

  const defById = new Map(mitigationDefs.map(d => [d.id, d]));

  const getMappedY = (t: number): number => {
    if (timeToYMap.has(t)) return timeToYMap.get(t)!;
    const gridKeys = Array.from(timeToYMap.keys());
    const maxGridTime = gridKeys.length > 0 ? Math.max(...gridKeys) : 0;
    const maxGridY = timeToYMap.get(maxGridTime) ?? 0;
    if (t > maxGridTime) return maxGridY + (t - maxGridTime) * pixelsPerSecond;
    return Math.max(0, t - offsetTime) * pixelsPerSecond;
  };

  const candidates = timelineMitigations.filter(m => {
    if (!(showPreStart || (m.time + m.duration > 0))) return false;
    if (hideEmptyRows && m.autoHidden) return false;
    const def = defById.get(m.mitigationId);
    if (!def) return false;
    if (m.duration <= 1) return false;
    if (def.copiesShield) return false;
    return true;
  });

  // 時系列順(同時刻なら優先順位が高い方を先)に処理する。
  // 旧実装は「優先順位→時刻」の順でソートしていたため、優先順位が高いオーナーの終盤の
  // 使用まで先にまとめて処理してしまい、その枠が「ずっと先まで埋まっている」と記録され、
  // 優先順位が低いオーナーの序盤の使用が(実際には誰とも重なっていなくても)弾かれる
  // バグがあった(2026-08-17 実機不具合)。時系列でスイープすることで、
  // 「入りきらない」判定を常にその瞬間の実際の重なり本数だけで行うようにする。
  const chronological = [...candidates].sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return priorityOf(a.ownerId) - priorityOf(b.ownerId);
  });

  // 現在アクティブな(枠を使用中の)軽減の一覧。idで対応するresults要素を追跡し、
  // 追い出し(下記)が発生した際にresultsからも一緒に取り除けるようにする。
  const active: { id: string; priority: number; slotIndex: number; endTime: number }[] = [];
  const results: MobileEffectBarItem[] = [];

  for (const mit of chronological) {
    const def = defById.get(mit.mitigationId)!;
    const endTime = mit.time + mit.duration;
    const priority = priorityOf(mit.ownerId);

    // 開始時刻より前に終わっている枠を解放する。
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endTime <= mit.time) active.splice(i, 1);
    }

    const occupied = new Set(active.map(a => a.slotIndex));
    let slotIndex = -1;
    for (let i = 0; i < maxConcurrent; i++) {
      if (!occupied.has(i)) { slotIndex = i; break; }
    }

    if (slotIndex === -1) {
      // 本当にmaxConcurrent本を超えて重なっている → 優先順位が最も低いものを追い出す。
      let worst = -1;
      let worstPriority = -Infinity;
      active.forEach((a, i) => {
        if (a.priority > worstPriority) { worstPriority = a.priority; worst = i; }
      });
      if (worst !== -1 && worstPriority > priority) {
        slotIndex = active[worst].slotIndex;
        const evictedId = active[worst].id;
        active.splice(worst, 1);
        const evictedResultsIndex = results.findIndex(r => r.id === evictedId);
        if (evictedResultsIndex !== -1) results.splice(evictedResultsIndex, 1);
      } else {
        continue; // 入りきらない → この軽減は棒を出さない
      }
    }

    const durationEndTime = mit.time + mit.duration - 1;
    let effectiveEndTime = durationEndTime;
    if (hideEmptyRows) {
      const isEndVisible = eventsByTime.has(durationEndTime) || mitStartsByTime.has(durationEndTime);
      if (!isEndVisible) {
        let prevVisible = mit.time;
        for (let t = durationEndTime; t >= mit.time; t--) {
          if (eventsByTime.has(t) || mitStartsByTime.has(t)) { prevVisible = t; break; }
        }
        effectiveEndTime = prevVisible;
      }
    }
    effectiveEndTime = Math.min(effectiveEndTime, maxTime);

    const startY = getMappedY(mit.time);
    const endY = getMappedY(effectiveEndTime) + ICON_BOTTOM_PADDING;
    const height = Math.max(0, Math.round(endY - startY));

    results.push({
      id: mit.id,
      ownerId: mit.ownerId,
      iconUrl: def.icon,
      top: Math.round(startY) + MOBILE_EFFECT_BAR_ICON_ROW_OFFSET,
      height,
      slotIndex,
      colors: getColorClasses(def.jobId, mit.ownerId),
    });
    active.push({ id: mit.id, priority, slotIndex, endTime });
  }

  return results;
}
