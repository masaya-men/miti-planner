import { describe, it, expect } from 'vitest';
import zh from '../zh.json';
import zhHant from '../zh-Hant.json';

// zh.json自体に元々あった未翻訳マーカー(空文字列)
// フェーズ③(繁体字翻訳・ゲーム用語対応)で埋める想定
// これら既知パスのみ非空チェックをスキップする
const KNOWN_EMPTY_PATHS = [
    'housing.login_prompt.register.lead',
    'housing.login.title',
    'housing.login.notice.intro',
    'housing.login.notice.item1',
    'housing.login.notice.item2',
    'housing.login.notice.item3',
    'housing.login.discordButton',
    'housing.login.closeLabel',
    'housing.account.title',
    'housing.account.avatarChange',
    'housing.account.avatarDelete',
    'housing.account.displayNameLabel',
    'housing.account.displayNameEdit',
    'housing.account.adminLink',
    'housing.account.signOut',
    'housing.account.deleteAccount',
    'housing.account.deleteConfirmTitle',
    'housing.account.deleteConfirmBody',
    'housing.account.deleteConfirmYes',
    'housing.account.deleteConfirmNo',
    'housing.account.closeLabel',
    'housing.topbar.login',
    'housing.topbar.account',
] as const;

function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
            paths.push(path);
        } else if (typeof value === 'object' && value !== null) {
            paths.push(...collectLeafPaths(value as Record<string, unknown>, path));
        }
    }
    return paths;
}

function getByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((acc, key) => {
        if (acc == null || typeof acc !== 'object') return undefined;
        return (acc as Record<string, unknown>)[key];
    }, obj);
}

describe('zh-Hant.json の完全性 (zh.json とのキーパリティ)', () => {
    it('zh.json の全キーが zh-Hant.json にも存在し非空文字列である(既知の23件を除く)', () => {
        const zhPaths = collectLeafPaths(zh);
        expect(zhPaths.length).toBeGreaterThan(0);
        for (const path of zhPaths) {
            const value = getByPath(zhHant as Record<string, unknown>, path);
            expect(value, `zh-Hant.${path} が存在しない`).toBeDefined();
            expect(typeof value, `zh-Hant.${path} は文字列であるべき`).toBe('string');

            // 既知の未翻訳パスを除き、全て非空チェック
            if (!KNOWN_EMPTY_PATHS.includes(path as any)) {
                expect(value, `zh-Hant.${path} は非空文字列であるべき(既知未翻訳リストに未記載)`).toBeTruthy();
            }
        }
    });
});
