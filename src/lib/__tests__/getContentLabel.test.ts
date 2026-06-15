import { describe, it, expect } from 'vitest';
import { addWaEiSpace, getCurrentContentLabel } from '../getContentLabel';

describe('addWaEiSpace', () => {
  it('漢字/かなと半角英数字の境界にスペースを挿入', () => {
    expect(addWaEiSpace('絶オメガ検証4')).toBe('絶オメガ検証 4');
    expect(addWaEiSpace('M5零式')).toBe('M5 零式');
  });
  it('境界が無ければそのまま', () => {
    expect(addWaEiSpace('零式')).toBe('零式');
    expect(addWaEiSpace('Savage')).toBe('Savage');
  });
});

describe('getCurrentContentLabel', () => {
  it('プラン無し / contentId 無しは null', () => {
    expect(getCurrentContentLabel(undefined, 'ja')).toBeNull();
    expect(getCurrentContentLabel({ contentId: null }, 'ja')).toBeNull();
  });
  it('未知の contentId は null(レジストリに無い)', () => {
    expect(getCurrentContentLabel({ contentId: '__nonexistent__' }, 'ja')).toBeNull();
  });
});
