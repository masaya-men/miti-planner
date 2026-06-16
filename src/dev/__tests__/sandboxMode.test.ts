import { describe, it, expect } from 'vitest';
import { isAdminSandbox } from '../sandboxMode';

describe('isAdminSandbox', () => {
  it('DEV かつ MODE=admin-sandbox のとき true', () => {
    expect(isAdminSandbox({ DEV: true, MODE: 'admin-sandbox' })).toBe(true);
  });

  it('本番ビルド (DEV=false) では必ず false', () => {
    expect(isAdminSandbox({ DEV: false, MODE: 'admin-sandbox' })).toBe(false);
  });

  it('MODE が別 (通常の dev) なら false', () => {
    expect(isAdminSandbox({ DEV: true, MODE: 'development' })).toBe(false);
  });

  it('vitest のデフォルト MODE=test なら false', () => {
    expect(isAdminSandbox({ DEV: true, MODE: 'test' })).toBe(false);
  });
});
