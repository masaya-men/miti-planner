import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../mockData';

describe('AST スキル定義の整合性', () => {
    it('sun_sign は neutral_sect 発動から 30 秒間使用可能 (公式仕様)', () => {
        const sunSign = MITIGATIONS.find(m => m.id === 'sun_sign');
        expect(sunSign).toBeDefined();
        expect(sunSign?.requires).toBe('neutral_sect');
        expect(sunSign?.requiresWindow).toBe(30);
    });
});
