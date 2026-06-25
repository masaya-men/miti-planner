import { describe, it, expect } from 'vitest';
import { shouldAutoPromptLocalSafety } from '../localSafetyAutoPrompt';

const base = { isIOS: true, isLoggedIn: false, planCount: 1, seen: false, tutorialActive: false };

describe('shouldAutoPromptLocalSafety', () => {
    it('全条件成立で true', () => {
        expect(shouldAutoPromptLocalSafety(base)).toBe(true);
    });
    it('iOS でなければ false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, isIOS: false })).toBe(false);
    });
    it('ログイン済なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, isLoggedIn: true })).toBe(false);
    });
    it('表 0 件なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, planCount: 0 })).toBe(false);
    });
    it('既読なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, seen: true })).toBe(false);
    });
    it('チュートリアル中なら false', () => {
        expect(shouldAutoPromptLocalSafety({ ...base, tutorialActive: true })).toBe(false);
    });
});
