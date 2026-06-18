import { describe, it, expect, beforeEach } from 'vitest';
import { readVisibleFromStorage, writeVisibleToStorage } from '../useProgressBarVisibility';

describe('progress bar visibility storage', () => {
    beforeEach(() => localStorage.clear());
    it('未設定はデフォルトON(true)', () => {
        expect(readVisibleFromStorage()).toBe(true);
    });
    it('false 保存で非表示', () => {
        writeVisibleToStorage(false);
        expect(readVisibleFromStorage()).toBe(false);
    });
    it('true 保存で表示', () => {
        writeVisibleToStorage(false);
        writeVisibleToStorage(true);
        expect(readVisibleFromStorage()).toBe(true);
    });
});
