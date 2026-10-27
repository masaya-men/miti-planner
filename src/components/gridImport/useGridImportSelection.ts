import { useState, useCallback, useEffect, useRef } from 'react';
import type { TimelineEvent, ContentLevel, ContentCategory, ContentDefinition } from '../../types';
import { resolveInitialSelection, deriveContentId, type ContentSelectionDefault } from '../../lib/contentSelection';
import { getTemplate } from '../../data/templateLoader';
import type { CarryTarget } from '../../lib/sheetImport/carryOverTargets';

export function useGridImportSelection(args: {
  isOpen: boolean;
  defaultSelection: ContentSelectionDefault;
}) {
  const { isOpen, defaultSelection } = args;

  // 取り込み先コンテンツ選択
  const [selLevel, setSelLevel] = useState<ContentLevel | null>(null);
  const [selCategory, setSelCategory] = useState<ContentCategory | null>(null);
  const [selBoss, setSelBoss] = useState<ContentDefinition | null>(null);
  const [selTitle, setSelTitle] = useState('');
  const defaultSelRef = useRef(defaultSelection);
  defaultSelRef.current = defaultSelection;
  useEffect(() => {
    if (!isOpen) return;
    const init = resolveInitialSelection(defaultSelRef.current);
    setSelLevel(init.level); setSelCategory(init.category); setSelBoss(init.boss); setSelTitle(init.title);
  }, [isOpen]);
  const selectedContentId = deriveContentId(selBoss, selCategory, selTitle);

  // ── テンプレ state(selectedContentId 変化時に getTemplate で読む) ───────────
  const [templateEvents, setTemplateEvents] = useState<TimelineEvent[]>([]);
  useEffect(() => {
    let alive = true;
    if (!selectedContentId) { setTemplateEvents([]); return; }
    getTemplate(selectedContentId)
      .then((tpl) => { if (alive) setTemplateEvents(tpl?.timelineEvents ?? []); })
      .catch(() => { if (alive) setTemplateEvents([]); });
    return () => { alive = false; };
  }, [selectedContentId]);

  // ── 手動 override state(安定キー `${time}|${name.ja}` → CarryTarget|'none') ─
  const [targetOverrides, setTargetOverrides] = useState<Record<string, CarryTarget | 'none'>>({});

  /** 安定キー: event id はビルド毎に再採番されるため time+name.ja で固定する。 */
  const targetKey = (ev: TimelineEvent) => `${ev.time}|${ev.name.ja}`;

  /**
   * targetOverrides(安定キー→target) を overridesById(id→target) に変換して
   * resolveEventTarget / applyResolvedTargets へ渡す。
   */
  const toOverridesById = useCallback(
    (events: TimelineEvent[]): Record<string, CarryTarget | 'none'> =>
      Object.fromEntries(
        events
          .filter((e) => targetOverrides[targetKey(e)] !== undefined)
          .map((e) => [e.id, targetOverrides[targetKey(e)]]),
      ),
    [targetOverrides],
  );

  return { selLevel, setSelLevel, selCategory, setSelCategory, selBoss, setSelBoss, selTitle, setSelTitle, selectedContentId, templateEvents, targetOverrides, setTargetOverrides, toOverridesById };
}
