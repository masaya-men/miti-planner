import type { TimelineEvent } from '../../types';
import { matchTemplateTarget, type CarryTarget } from './carryOverTargets';

export type TargetSource = 'manual' | 'sheet' | 'template' | 'none';
export interface ResolvedTarget { target: CarryTarget | null; source: TargetSource; }

/** 実効対象を解決。優先: 手動(overrides) > 自作対象列(ev.target) > テンプレ > なし。
 *  overrides[id]==='none' は「手動でなし」= テンプレに勝って null。 */
export function resolveEventTarget(
  ev: TimelineEvent,
  templateEvents: TimelineEvent[],
  overrides: Record<string, CarryTarget | 'none'>,
): ResolvedTarget {
  const ov = overrides[ev.id];
  if (ov !== undefined) return { target: ov === 'none' ? null : ov, source: 'manual' };
  if (ev.target !== undefined) return { target: ev.target as CarryTarget, source: 'sheet' };
  const tmpl = matchTemplateTarget(ev.name.ja, ev.time, templateEvents);
  if (tmpl !== undefined) return { target: tmpl, source: 'template' };
  return { target: null, source: 'none' };
}

/** create 用: 各 event の target を実効値で確定(null は target キーを外す・非破壊)。 */
export function applyResolvedTargets(
  events: TimelineEvent[],
  templateEvents: TimelineEvent[],
  overrides: Record<string, CarryTarget | 'none'>,
): TimelineEvent[] {
  return events.map((ev) => {
    const { target } = resolveEventTarget(ev, templateEvents, overrides);
    const next = { ...ev };
    if (target === null) delete (next as { target?: CarryTarget }).target;
    else (next as { target?: CarryTarget }).target = target;
    return next;
  });
}
