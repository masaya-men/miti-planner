import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SheetImportResult } from '../buildPlanFromSheets';

const getTemplate = vi.fn();
vi.mock('../../../data/templateLoader', () => ({ getTemplate: (id: string) => getTemplate(id) }));

import { applyTemplateTargetsToResult } from '../applyTemplateTargets';

const baseResult = (): SheetImportResult => ({
  timelineEvents: [
    { id: 'e1', time: 50, name: { ja: 'アクモーン', en: 'x' }, damageType: 'magical' },
  ],
  timelineMitigations: [], phases: [], labels: [], party: [], skipped: [],
});

beforeEach(() => getTemplate.mockReset());

describe('applyTemplateTargetsToResult', () => {
  it('contentId null → そのまま(getTemplate 呼ばない)', async () => {
    const r = baseResult();
    const out = await applyTemplateTargetsToResult(r, null);
    expect(out).toBe(r);
    expect(getTemplate).not.toHaveBeenCalled();
  });

  it('テンプレ有 → 一致 event の target を補完', async () => {
    getTemplate.mockResolvedValue({
      contentId: 'm4s', generatedAt: '', sourceLogsCount: 0, phases: [],
      timelineEvents: [{ id: 't1', time: 50, name: { ja: 'アクモーン', en: 'x' }, damageType: 'magical', target: 'MT' }],
    });
    const out = await applyTemplateTargetsToResult(baseResult(), 'm4s');
    expect(out.timelineEvents[0].target).toBe('MT');
  });

  it('テンプレ null → そのまま', async () => {
    getTemplate.mockResolvedValue(null);
    const r = baseResult();
    expect(await applyTemplateTargetsToResult(r, 'm4s')).toBe(r);
  });

  it('getTemplate 失敗 → 握って そのまま(取込は止めない)', async () => {
    // vmThreads+vi.mock 環境では mockRejectedValue(永続)はテスト後もrejectionを保持し
    // Vitestのunhandled rejection検知に引っかかるため、mockRejectedValueOnce を使用する
    getTemplate.mockRejectedValueOnce(new Error('network'));
    const r = baseResult();
    expect(await applyTemplateTargetsToResult(r, 'm4s')).toBe(r);
  });
});
