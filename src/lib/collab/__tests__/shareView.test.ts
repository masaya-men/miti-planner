import { describe, it, expect } from 'vitest';
import { resolveInitialShareView } from '../shareView';

describe('resolveInitialShareView', () => {
  it('未ログインはコピー共有へ直行(ON/OFF問わず)', () => {
    expect(resolveInitialShareView({ user: null, isOn: false })).toBe('copy');
    expect(resolveInitialShareView({ user: null, isOn: true })).toBe('copy');
  });

  it('ログイン済み・共同編集ONはオーナーパネル直行', () => {
    expect(resolveInitialShareView({ user: { uid: 'x' }, isOn: true })).toBe('panel');
  });

  it('ログイン済み・共同編集OFFは2択', () => {
    expect(resolveInitialShareView({ user: { uid: 'x' }, isOn: false })).toBe('choice');
  });
});
