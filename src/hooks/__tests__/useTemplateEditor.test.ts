// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { useTemplateEditor } from '../useTemplateEditor';
import type { TimelineEvent } from '../../types';

function makeEvents(): TimelineEvent[] {
  return [
    {
      id: 'ev1', time: 3,
      name: { ja: 'テスト攻撃', en: 'Test Attack' },
      damageType: 'magical', target: 'AoE',
      mechanicGroup: { ja: 'テスト', en: 'Test' },
    },
    {
      id: 'ev2', time: 10,
      name: { ja: 'テスト攻撃', en: 'Test Attack' },
      damageType: 'magical', target: 'AoE',
      mechanicGroup: { ja: 'テスト', en: 'Test' },
    },
    {
      id: 'ev3', time: 20,
      name: { ja: '二撃目', en: 'Second Hit' },
      damageType: 'physical', target: 'MT',
    },
  ];
}

function makePhases() {
  return [
    { id: 1, startTimeSec: 0, name: { ja: 'フェーズ1', en: 'Phase 1' } },
  ];
}

describe('useTemplateEditor', () => {
  it('loadEvents でデータをロードできる', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    expect(result.current.visibleEvents).toHaveLength(3);
    expect(result.current.hasChanges).toBe(false);
  });

  it('updateCell でセル値を更新し modified を記録する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev1', 'name.ja', '変更後'));
    expect(result.current.state.current.find(e => e.id === 'ev1')?.name.ja).toBe('変更後');
    expect(result.current.hasChanges).toBe(true);
  });

  it('翻訳自動伝播: 同じJA名のイベントにEN翻訳が伝播する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev1', 'name.en', 'Updated Attack'));
    const ev2 = result.current.state.current.find(e => e.id === 'ev2');
    expect(ev2?.name.en).toBe('Updated Attack');
  });

  it('deleteEvent でイベントを削除し visibleEvents から除外する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.deleteEvent('ev1'));
    expect(result.current.visibleEvents).toHaveLength(2);
    expect(result.current.visibleEvents.find(e => e.id === 'ev1')).toBeUndefined();
  });

  it('undo でオリジナル状態に戻る', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev1', 'name.ja', '変更後'));
    act(() => result.current.deleteEvent('ev2'));
    act(() => result.current.undo());
    expect(result.current.visibleEvents).toHaveLength(3);
    expect(result.current.state.current.find(e => e.id === 'ev1')?.name.ja).toBe('テスト攻撃');
    expect(result.current.hasChanges).toBe(false);
  });

  it('setPhaseAtTime でフェーズ境界を追加する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(10, { ja: '新フェーズ', en: 'New Phase' }));
    expect(result.current.state.currentPhases).toHaveLength(2);
    expect(result.current.state.currentPhases[1].startTimeSec).toBe(10);
  });

  it('setPhaseAtTime で既存フェーズの名前を更新する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(0, { ja: '更新名', en: 'Updated' }));
    expect(result.current.state.currentPhases).toHaveLength(1);
    expect(result.current.state.currentPhases[0].name).toEqual({ ja: '更新名', en: 'Updated' });
  });

  it('setPhaseAtTime で空名でフェーズを削除する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(0, { ja: '', en: '' }));
    expect(result.current.state.currentPhases).toHaveLength(0);
  });

  it('setPhaseAtTime で null でフェーズを削除する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(0, null));
    expect(result.current.state.currentPhases).toHaveLength(0);
  });

  it('updateLabel でラベル名を一括更新する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateLabel('テスト', { ja: '更新ラベル', en: 'Updated Label' }));
    const ev1 = result.current.state.current.find(e => e.id === 'ev1');
    const ev2 = result.current.state.current.find(e => e.id === 'ev2');
    expect(ev1?.mechanicGroup?.ja).toBe('更新ラベル');
    expect(ev2?.mechanicGroup?.ja).toBe('更新ラベル');
    const ev3 = result.current.state.current.find(e => e.id === 'ev3');
    expect(ev3?.mechanicGroup).toBeUndefined();
  });

  it('getSaveData で削除済みイベントを除外したデータを返す', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.deleteEvent('ev2'));
    const saveData = result.current.getSaveData();
    expect(saveData.events).toHaveLength(2);
    expect(saveData.events.find(e => e.id === 'ev2')).toBeUndefined();
    expect(saveData.phases).toHaveLength(1);
  });
});
