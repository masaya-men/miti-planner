import { describe, it, expect } from 'vitest';
import zh from '../zh.json';
import zhHant from '../zh-Hant.json';

// 2026-07-28 フェーズ③で housing.login/account 系23件を含め全て翻訳済みになったため空配列
const KNOWN_EMPTY_PATHS: readonly string[] = [
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
