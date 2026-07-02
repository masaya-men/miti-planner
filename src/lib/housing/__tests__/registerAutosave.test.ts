import { describe, it, expect } from 'vitest';
import { serializeDraft, restoreDraft } from '../registerAutosave';

describe('registerAutosave', () => {
  it('テキスト系フィールドを round-trip する', () => {
    const values = { title: 'わが家', description: 'コメント', dc: 'Elemental', tags: ['x'], postUrl: 'https://x.com/a' };
    const restored = restoreDraft(serializeDraft(values as any));
    expect(restored?.title).toBe('わが家');
    expect(restored?.tags).toEqual(['x']);
  });
  it('壊れた JSON は null', () => {
    expect(restoreDraft('{bad')).toBeNull();
  });
  it('null 入力は null', () => {
    expect(restoreDraft(null)).toBeNull();
  });
});
