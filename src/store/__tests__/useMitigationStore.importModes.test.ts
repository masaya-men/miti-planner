import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { TimelineEvent, AppliedMitigation } from '../../types';

const ev = (id: string, time: number): TimelineEvent => ({
  id, time, name: { ja: id, en: id }, damageType: 'magical',
});
const mit = (id: string, time: number): AppliedMitigation => ({
  id, mitigationId: 'rampart', time, duration: 20, ownerId: 'MT',
});

describe('importTimelineEvents モード別(ローカル経路)', () => {
  beforeEach(() => {
    useMitigationStore.setState({
      timelineEvents: [ev('a', 10), ev('b', 60)],
      timelineMitigations: [mit('m1', 12)],
      _collabActive: false, _collabHandlers: null, _collabReadonly: false,
    } as any);
  });

  it('replace_all: イベント全置換・軽減クリア', () => {
    useMitigationStore.getState().importTimelineEvents([ev('x', 5)], undefined, undefined, 'replace_all');
    expect(useMitigationStore.getState().timelineEvents.map(e => e.id)).toEqual(['x']);
    expect(useMitigationStore.getState().timelineMitigations).toEqual([]);
  });

  it('replace_keep: イベント全置換・軽減は残す', () => {
    useMitigationStore.getState().importTimelineEvents([ev('x', 5)], undefined, undefined, 'replace_keep');
    expect(useMitigationStore.getState().timelineEvents.map(e => e.id)).toEqual(['x']);
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(['m1']);
  });

  it('append: 最終時刻(60)より後だけ追加・既存と軽減は不変', () => {
    useMitigationStore.getState().importTimelineEvents([ev('x', 5), ev('y', 70)], undefined, undefined, 'append');
    expect(useMitigationStore.getState().timelineEvents.map(e => e.id)).toEqual(['a', 'b', 'y']);
    expect(useMitigationStore.getState().timelineMitigations.map(m => m.id)).toEqual(['m1']);
  });

  it('append: カットオフ以降に新規フェーズがない場合、既存フェーズは変更されない', () => {
    // beforeEach で timelineEvents = [ev('a',10), ev('b',60)]
    // フェーズを仕込む: startTime=0 の既存フェーズ
    useMitigationStore.setState({
      phases: [{ id: 'p_existing', name: { ja: 'P1' }, startTime: 0, endTime: 100 }] as any,
    });
    const beforePhases = useMitigationStore.getState().phases;
    // importPhases に startTimeSec=30 のフェーズ(カットオフ60以前)だけを渡す → incomingPhases は空
    useMitigationStore.getState().importTimelineEvents(
      [ev('y', 70)],
      [{ id: 99, startTimeSec: 30, name: { ja: 'Old' } }] as any,
      undefined,
      'append',
    );
    const afterPhases = useMitigationStore.getState().phases;
    // 既存フェーズが変更されていないこと
    expect(afterPhases).toEqual(beforePhases);
    expect(afterPhases[0].id).toBe('p_existing');
    expect(afterPhases[0].startTime).toBe(0);
  });

  it('append+新規フェーズ: 既存フェーズのendTimeが変更されない(silent mutation修正)', () => {
    // beforeEach で timelineEvents = [ev('a',10), ev('b',60)]
    // 既存フェーズ: startTime=0, endTime=55 (意図的な非デフォルト境界)
    useMitigationStore.setState({
      timelineEvents: [ev('a', 10), ev('b', 60)],
      phases: [{ id: 'p1', name: { ja: 'P1' }, startTime: 0, endTime: 55 }] as any,
      _collabActive: false, _collabHandlers: null, _collabReadonly: false,
    } as any);

    // カットオフ(60)より後の新規フェーズ(startTimeSec=80)を含む importPhases で append
    useMitigationStore.getState().importTimelineEvents(
      [ev('y', 70), ev('z', 90)],
      [{ id: 1, startTimeSec: 80, name: { ja: 'P2' } }] as any,
      undefined,
      'append',
    );

    const afterPhases = useMitigationStore.getState().phases;
    // 既存フェーズ p1 が追加された(length >= 2)
    expect(afterPhases.length).toBeGreaterThanOrEqual(2);
    // 既存フェーズ p1 の endTime が 55 のまま変わっていないこと
    const existing = afterPhases.find(p => p.id === 'p1');
    expect(existing).toBeDefined();
    expect(existing!.endTime).toBe(55);
    // 新規フェーズ phase_1 が追加されていること
    const newPhase = afterPhases.find(p => p.id === 'phase_1');
    expect(newPhase).toBeDefined();
    expect(newPhase!.startTime).toBe(80);
  });
});
