import { describe, it, expect } from 'vitest';
import { parseHousingFromText } from '../../lib/housing/parseHousingFromText';

describe('parseHousingFromText - 定番フォーマット', () => {
    it('sample 1: Mana/Anima/Shirogane 6-6 Small', () => {
        const text = `Mana
Anima
Shirogane | 6-6 | Small | Commission

#FF14housing #FFXIVHousing #FF14ハウジング #FF14 #FFXIV`;
        const result = parseHousingFromText(text);
        expect(result.dc).toBe('Mana');
        expect(result.server).toBe('Anima');
        expect(result.area).toBe('Shirogane');
        expect(result.ward).toBe(6);
        expect(result.plot).toBe(6);
        expect(result.size).toBe('S');
    });

    it('sample 2: Materia/Bismarck/LavenderBeds 23-6 Large with prefix message', () => {
        const text = `完成しました！見にきてください！！！
ありがとうございます！

Materia
Bismarck
Lavender Beds | 23-6 | Large

#FF14housing #FFXIVHousing #FF14ハウジング #FF14 #FFXIV`;
        const result = parseHousingFromText(text);
        expect(result.dc).toBe('Materia');
        expect(result.server).toBe('Bismarck');
        expect(result.area).toBe('LavenderBeds');
        expect(result.ward).toBe(23);
        expect(result.plot).toBe(6);
        expect(result.size).toBe('L');
    });
});
