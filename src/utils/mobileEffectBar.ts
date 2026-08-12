import type { AppliedMitigation, Mitigation } from '../types';
import { PARTY_MEMBER_IDS } from '../constants/party';

export const MOBILE_EFFECT_BAR_ICON_SIZE = 15;
export const MOBILE_EFFECT_BAR_WIDTH = 4;
export const MOBILE_EFFECT_BAR_SLOT_PITCH = 17;
export const MOBILE_EFFECT_BAR_ROW_INSET = 12;
export const MOBILE_EFFECT_BAR_SCROLL_IDLE_MS = 150;

/** PC版のエフェクト棒(MitigationItem)がアイコン分の高さとして加算しているのと同じ値。[Timeline.tsx:3503] */
const ICON_BOTTOM_PADDING = 24;

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

const priorityOf = (ownerId: string): number => {
  const idx = (PARTY_MEMBER_IDS as readonly string[]).indexOf(ownerId);
  return idx === -1 ? PARTY_MEMBER_IDS.length : idx;
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

  // 優先順位(PARTY_MEMBER_IDS順)→ 開始時刻の順に処理する。
  // 同じ優先順位内では早く始まったものから枠を確保する。
  const sorted = [...candidates].sort((a, b) => {
    const pa = priorityOf(a.ownerId);
    const pb = priorityOf(b.ownerId);
    if (pa !== pb) return pa - pb;
    return a.time - b.time;
  });

  // slotFreeAt[i] = スロットiが「何秒時点から」空くか。
  // 割り当ては必ず freeAt <= 新規アイテムの開始時刻 のときだけ許可するため、
  // 処理順によらず同一スロット内での時間重複は起きない(詳細は設計書3.3)。
  const slotFreeAt: number[] = [];
  const results: MobileEffectBarItem[] = [];

  for (const mit of sorted) {
    const def = defById.get(mit.mitigationId)!;
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

    let slotIndex = slotFreeAt.findIndex(freeAt => freeAt <= mit.time);
    if (slotIndex === -1) {
      if (slotFreeAt.length >= maxConcurrent) continue; // 入りきらない → この軽減は棒を出さない
      slotIndex = slotFreeAt.length;
      slotFreeAt.push(0);
    }
    slotFreeAt[slotIndex] = mit.time + mit.duration;

    const startY = getMappedY(mit.time);
    const endY = getMappedY(effectiveEndTime) + ICON_BOTTOM_PADDING;
    const height = Math.max(0, Math.round(endY - startY));

    results.push({
      id: mit.id,
      ownerId: mit.ownerId,
      iconUrl: def.icon,
      top: Math.round(startY),
      height,
      slotIndex,
      colors: getColorClasses(def.jobId, mit.ownerId),
    });
  }

  return results;
}
