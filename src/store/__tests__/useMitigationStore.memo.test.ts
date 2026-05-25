import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import { MEMO_LIMITS } from '../../types/firebase';

describe('useMitigationStore memo actions', () => {
  beforeEach(() => {
    useMitigationStore.getState().resetForTutorial();
    useMitigationStore.setState({ memos: [], toolMode: 'idle' });
  });

  it('toolMode 初期値は idle', () => {
    expect(useMitigationStore.getState().toolMode).toBe('idle');
  });

  it('setToolMode("memo") で memo モードに入る', () => {
    useMitigationStore.getState().setToolMode('memo');
    expect(useMitigationStore.getState().toolMode).toBe('memo');
  });

  it('memo モードと aa-placement モードは排他 (memo ON → aa OFF)', () => {
    useMitigationStore.setState({ toolMode: 'aa-placement' });
    useMitigationStore.getState().setToolMode('memo');
    expect(useMitigationStore.getState().toolMode).toBe('memo');
  });

  it('addMemo でメモが追加される', () => {
    useMitigationStore.getState().addMemo({ text: 'テスト', timeSec: 10, xRatio: 0.5 });
    const memos = useMitigationStore.getState().memos;
    expect(memos).toHaveLength(1);
    expect(memos[0].text).toBe('テスト');
    expect(memos[0].timeSec).toBe(10);
    expect(memos[0].xRatio).toBe(0.5);
    expect(memos[0].id).toMatch(/^memo_/);
    expect(memos[0].createdAt).toBeGreaterThan(0);
  });

  it('addMemo は上限 (MAX_MEMOS_PER_PLAN) を超えると false を返す', () => {
    for (let i = 0; i < MEMO_LIMITS.MAX_MEMOS_PER_PLAN; i++) {
      useMitigationStore.getState().addMemo({ text: `m${i}`, timeSec: i, xRatio: 0.5 });
    }
    expect(useMitigationStore.getState().memos).toHaveLength(MEMO_LIMITS.MAX_MEMOS_PER_PLAN);
    const result = useMitigationStore.getState().addMemo({ text: 'overflow', timeSec: 0, xRatio: 0.5 });
    expect(result).toBe(false);
    expect(useMitigationStore.getState().memos).toHaveLength(MEMO_LIMITS.MAX_MEMOS_PER_PLAN);
  });

  it('updateMemo でテキストと座標を変更できる', () => {
    useMitigationStore.getState().addMemo({ text: '元', timeSec: 5, xRatio: 0.1 });
    const id = useMitigationStore.getState().memos[0].id;
    useMitigationStore.getState().updateMemo(id, { text: '変更後', timeSec: 20, xRatio: 0.8 });
    const updated = useMitigationStore.getState().memos[0];
    expect(updated.text).toBe('変更後');
    expect(updated.timeSec).toBe(20);
    expect(updated.xRatio).toBe(0.8);
  });

  it('deleteMemo で指定 id のメモが消える', () => {
    useMitigationStore.getState().addMemo({ text: 'a', timeSec: 1, xRatio: 0.1 });
    useMitigationStore.getState().addMemo({ text: 'b', timeSec: 2, xRatio: 0.2 });
    const idToDelete = useMitigationStore.getState().memos[0].id;
    useMitigationStore.getState().deleteMemo(idToDelete);
    expect(useMitigationStore.getState().memos).toHaveLength(1);
    expect(useMitigationStore.getState().memos[0].text).toBe('b');
  });

  it('deleteAllMemos で全消去', () => {
    useMitigationStore.getState().addMemo({ text: 'a', timeSec: 1, xRatio: 0.1 });
    useMitigationStore.getState().addMemo({ text: 'b', timeSec: 2, xRatio: 0.2 });
    useMitigationStore.getState().deleteAllMemos();
    expect(useMitigationStore.getState().memos).toHaveLength(0);
  });
});
