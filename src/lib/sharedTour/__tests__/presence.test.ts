// @vitest-environment happy-dom
// デフォルトの node 環境には sessionStorage / crypto.randomUUID の DOM 実装が無いため、
// JoinTourPage.test.tsx 等と同じく happy-dom を明示指定する (presence は sessionStorage 前提)。
import { getOrCreateSessionId } from '../presence';

describe('getOrCreateSessionId', () => {
  beforeEach(() => sessionStorage.clear());

  it('初回は新規IDを生成しsessionStorageに保存する', () => {
    const id = getOrCreateSessionId();
    expect(id).toBeTruthy();
    expect(sessionStorage.getItem('lopo_shared_tour_session')).toBe(id);
  });

  it('2回目以降は同じIDを返す', () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBe(b);
  });
});
