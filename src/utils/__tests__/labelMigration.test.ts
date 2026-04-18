import { describe, it, expect } from 'vitest';
import { isLegacyLabelFormat, migrateLabels, ensureLabelEndTimes, repairLastLabelEndTime } from '../labelMigration';

// テスト用のヘルパー型
type TEvent = {
    id: string;
    time: number;
    name: { ja: string; en: string };
    damageType: 'magical' | 'physical' | 'unavoidable' | 'enrage';
    mechanicGroup?: { ja: string; en: string };
};

type TPhase = {
    id: string;
    name: { ja: string; en: string };
    startTime: number;
    endTime: number;
};

describe('isLegacyLabelFormat', () => {
    it('labels[]がない場合は旧形式と判定する', () => {
        const data = {
            timelineEvents: [
                { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical' as const, mechanicGroup: { ja: '開幕', en: 'Opener' } },
            ],
        };
        expect(isLegacyLabelFormat(data)).toBe(true);
    });

    it('labels[]がある場合は新形式と判定する', () => {
        const data = {
            labels: [{ id: 'l1', name: { ja: '開幕', en: 'Opener' }, startTime: 0 }],
            timelineEvents: [],
        };
        expect(isLegacyLabelFormat(data)).toBe(false);
    });

    it('labels[]が空配列の場合は新形式と判定する', () => {
        const data = {
            labels: [],
            timelineEvents: [],
        };
        expect(isLegacyLabelFormat(data)).toBe(false);
    });
});

describe('migrateLabels', () => {
    it('空配列は空配列を返す', () => {
        const result = migrateLabels([], []);
        expect(result).toEqual([]);
    });

    it('mechanicGroupからLabel[]に変換する（基本）', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 10, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e3', time: 20, name: { ja: 'C', en: 'C' }, damageType: 'magical', mechanicGroup: { ja: '展開', en: 'Spread' } },
        ];
        const result = migrateLabels(events, []);
        expect(result).toHaveLength(2);
        expect(result[0].name).toEqual({ ja: '開幕', en: 'Opener' });
        expect(result[0].startTime).toBe(0);
        expect(result[1].name).toEqual({ ja: '展開', en: 'Spread' });
        expect(result[1].startTime).toBe(20);
    });

    it('連続する同名ラベルは1つのLabelにまとめる', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 5, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 15, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e3', time: 25, name: { ja: 'C', en: 'C' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
        ];
        const result = migrateLabels(events, []);
        expect(result).toHaveLength(1);
        expect(result[0].name).toEqual({ ja: '開幕', en: 'Opener' });
        expect(result[0].startTime).toBe(5);
    });

    it('ラベルなしイベントは隙間として扱う（Labelを作らない）', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 10, name: { ja: 'B', en: 'B' }, damageType: 'magical' }, // mechanicGroupなし
            { id: 'e3', time: 20, name: { ja: 'C', en: 'C' }, damageType: 'magical', mechanicGroup: { ja: '展開', en: 'Spread' } },
        ];
        const result = migrateLabels(events, []);
        // ラベルなしイベントはLabelを作らない（隙間）
        expect(result).toHaveLength(2);
        expect(result[0].name.ja).toBe('開幕');
        expect(result[0].startTime).toBe(0);
        expect(result[1].name.ja).toBe('展開');
        expect(result[1].startTime).toBe(20);
    });

    it('フェーズ境界でラベルは区切る', () => {
        // フェーズ1: 0-30、フェーズ2: 30-
        const phases: TPhase[] = [
            { id: 'p1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 30 },
            { id: 'p2', name: { ja: 'P2', en: 'P2' }, startTime: 30, endTime: 60 },
        ];
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 20, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            // フェーズ境界をまたいで同じmechanicGroup名
            { id: 'e3', time: 30, name: { ja: 'C', en: 'C' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e4', time: 40, name: { ja: 'D', en: 'D' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
        ];
        const result = migrateLabels(events, phases);
        // フェーズをまたいでいるので2つのLabelになる
        expect(result).toHaveLength(2);
        expect(result[0].startTime).toBe(0);
        expect(result[1].startTime).toBe(30);
    });

    it('各ラベルにはユニークなIDが付与される', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 10, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '展開', en: 'Spread' } },
        ];
        const result = migrateLabels(events, []);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBeTruthy();
        expect(result[1].id).toBeTruthy();
        expect(result[0].id).not.toBe(result[1].id);
    });

    it('生成されたラベルにendTimeが補完される', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 10, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e3', time: 20, name: { ja: 'C', en: 'C' }, damageType: 'magical', mechanicGroup: { ja: '展開', en: 'Spread' } },
        ];
        const result = migrateLabels(events, []);
        expect(result[0].endTime).toBe(20);
        expect(result[1].endTime).toBe(21);
    });

    it('最終ラベル startTime より後にイベントがある場合、endTime はそこまで伸びる', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 10, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e3', time: 50, name: { ja: 'C', en: 'C' }, damageType: 'magical' },
        ];
        const result = migrateLabels(events, []);
        expect(result).toHaveLength(1);
        expect(result[0].startTime).toBe(0);
        expect(result[0].endTime).toBe(50);
    });

    it('最終ラベル startTime = 最終イベント時刻の場合、endTime は startTime + 1', () => {
        const events: TEvent[] = [
            { id: 'e1', time: 0, name: { ja: 'A', en: 'A' }, damageType: 'magical', mechanicGroup: { ja: '開幕', en: 'Opener' } },
            { id: 'e2', time: 20, name: { ja: 'B', en: 'B' }, damageType: 'magical', mechanicGroup: { ja: '展開', en: 'Spread' } },
        ];
        const result = migrateLabels(events, []);
        expect(result[1].startTime).toBe(20);
        expect(result[1].endTime).toBe(21);
    });
});

describe('ensureLabelEndTimes', () => {
    it('maxTime を渡すと最終ラベルの endTime がそれになる', () => {
        const labels = [
            { id: 'l1', name: { ja: 'A', en: 'A' }, startTime: 0 },
            { id: 'l2', name: { ja: 'B', en: 'B' }, startTime: 30 },
        ];
        const result = ensureLabelEndTimes(labels, 200);
        expect(result[0].endTime).toBe(30);
        expect(result[1].endTime).toBe(200);
    });

    it('maxTime 未指定時は startTime + 1 が使われる（後方互換）', () => {
        const labels = [
            { id: 'l1', name: { ja: 'A', en: 'A' }, startTime: 0 },
            { id: 'l2', name: { ja: 'B', en: 'B' }, startTime: 30 },
        ];
        const result = ensureLabelEndTimes(labels);
        expect(result[0].endTime).toBe(30);
        expect(result[1].endTime).toBe(31);
    });

    it('既に endTime がある最終ラベルは maxTime で上書きされない', () => {
        const labels = [
            { id: 'l1', name: { ja: 'A', en: 'A' }, startTime: 0, endTime: 100 },
        ];
        const result = ensureLabelEndTimes(labels, 500);
        expect(result[0].endTime).toBe(100);
    });
});

describe('repairLastLabelEndTime', () => {
    const label = (id: string, startTime: number, endTime: number) => ({
        id, name: { ja: id, en: id }, startTime, endTime,
    });

    it('最終ラベルの endTime が startTime+1 かつ後続イベントがあれば修復する', () => {
        const labels = [label('l1', 0, 30), label('l2', 30, 31)];
        const events = [{ id: 'e1', time: 500 }] as any;
        const result = repairLastLabelEndTime(labels, events, 500);
        expect(result[0].endTime).toBe(30);
        expect(result[1].endTime).toBe(500);
    });

    it('最終ラベルの endTime が startTime+1 でも後続イベントが無ければ修復しない', () => {
        const labels = [label('l1', 0, 30), label('l2', 30, 31)];
        const events = [{ id: 'e1', time: 20 }] as any;
        const result = repairLastLabelEndTime(labels, events, 20);
        expect(result[1].endTime).toBe(31);
    });

    it('最終ラベルの endTime が startTime+1 でない場合は修復しない', () => {
        const labels = [label('l1', 0, 30), label('l2', 30, 50)];
        const events = [{ id: 'e1', time: 500 }] as any;
        const result = repairLastLabelEndTime(labels, events, 500);
        expect(result[1].endTime).toBe(50);
    });

    it('空配列を受け取ると空配列を返す', () => {
        expect(repairLastLabelEndTime([], [], 100)).toEqual([]);
    });
});
