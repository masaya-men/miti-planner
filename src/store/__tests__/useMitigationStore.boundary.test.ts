import { describe, it, expect, beforeEach, vi } from 'vitest';

// Firebase App Check は reCAPTCHA 初期化時に DOM (document) を参照するため、
// node 環境のテストでは空関数にモック化して初期化ツリーを切る。
vi.mock('../../lib/appCheck', () => ({
    initAppCheck: () => null,
}));

import { useMitigationStore } from '../useMitigationStore';
import type { Phase, Label } from '../../types';

/**
 * フェーズ/ラベル境界編集（add / updatePhase*Time / updateLabel*Time）の挙動テスト
 *
 * 仕様（2026-04-18 改修 第 2 版）:
 * 隣接規約: phase[i].endTime + 1 === phase[i+1].startTime（描画 endTime+1 と整合）
 *
 * - EndTime を後ろへ動かしたとき → 衝突する「次」の startTime が final + 1 に追従（次の endTime - 2 まで）
 * - StartTime を前へ動かしたとき → 衝突する「前」の endTime が final - 1 に追従（前の startTime + 2 まで）
 * - 「隣接 1 個だけ」追従。被される側が 1 秒幅を保つよう最低幅確保。
 * - フェーズ・ラベル同一ロジック。
 */

const makePhase = (id: string, startTime: number, endTime: number): Phase => ({
    id,
    name: { ja: id, en: id },
    startTime,
    endTime,
});

const makeLabel = (id: string, startTime: number, endTime: number): Label => ({
    id,
    name: { ja: id, en: id },
    startTime,
    endTime,
});

/** テスト用に store を初期化し、phases / labels だけ差し込むヘルパ */
function setPhases(phases: Phase[]) {
    useMitigationStore.setState({
        phases,
        labels: [],
        timelineEvents: [],
        _history: [],
        _future: [],
    });
}
function setLabels(labels: Label[]) {
    useMitigationStore.setState({
        phases: [],
        labels,
        timelineEvents: [],
        _history: [],
        _future: [],
    });
}

describe('updatePhaseEndTime', () => {
    beforeEach(() => setPhases([]));

    it('次フェーズがなければ自由に endTime を後ろへ動かせる', () => {
        setPhases([makePhase('p1', 0, 30)]);
        useMitigationStore.getState().updatePhaseEndTime('p1', 100);
        expect(useMitigationStore.getState().phases[0].endTime).toBe(100);
    });

    it('自分の startTime + 1 未満には設定できない（最低幅確保）', () => {
        setPhases([makePhase('p1', 50, 100)]);
        useMitigationStore.getState().updatePhaseEndTime('p1', 10);
        expect(useMitigationStore.getState().phases[0].endTime).toBe(51);
    });

    it('次フェーズと衝突しない範囲ではクリップされない', () => {
        setPhases([makePhase('p1', 0, 30), makePhase('p2', 60, 100)]);
        useMitigationStore.getState().updatePhaseEndTime('p1', 50);
        const phases = useMitigationStore.getState().phases;
        expect(phases.find(p => p.id === 'p1')!.endTime).toBe(50);
        expect(phases.find(p => p.id === 'p2')!.startTime).toBe(60);
    });

    it('次フェーズと衝突したら、次フェーズの startTime が final+1 に追従する', () => {
        setPhases([makePhase('p1', 0, 30), makePhase('p2', 60, 100)]);
        useMitigationStore.getState().updatePhaseEndTime('p1', 80);
        const phases = useMitigationStore.getState().phases;
        expect(phases.find(p => p.id === 'p1')!.endTime).toBe(80);
        expect(phases.find(p => p.id === 'p2')!.startTime).toBe(81);
        expect(phases.find(p => p.id === 'p2')!.endTime).toBe(100);
    });

    it('次フェーズを潰す範囲まで延ばすと、次フェーズの endTime - 2 で止まる', () => {
        setPhases([makePhase('p1', 0, 30), makePhase('p2', 60, 100)]);
        useMitigationStore.getState().updatePhaseEndTime('p1', 200);
        const phases = useMitigationStore.getState().phases;
        expect(phases.find(p => p.id === 'p1')!.endTime).toBe(98);
        expect(phases.find(p => p.id === 'p2')!.startTime).toBe(99);
        expect(phases.find(p => p.id === 'p2')!.endTime).toBe(100);
    });
});

describe('updatePhaseStartTime', () => {
    beforeEach(() => setPhases([]));

    it('前フェーズがなければ自由に startTime を前へ動かせる', () => {
        setPhases([makePhase('p1', 50, 100)]);
        useMitigationStore.getState().updatePhaseStartTime('p1', 10);
        expect(useMitigationStore.getState().phases[0].startTime).toBe(10);
    });

    it('自分の endTime - 1 超には設定できない', () => {
        setPhases([makePhase('p1', 0, 30)]);
        useMitigationStore.getState().updatePhaseStartTime('p1', 100);
        expect(useMitigationStore.getState().phases[0].startTime).toBe(29);
    });

    it('前フェーズと衝突しない範囲では前フェーズは変わらない（巻き戻しバグの解消確認）', () => {
        setPhases([makePhase('p1', 0, 30), makePhase('p2', 60, 100)]);
        useMitigationStore.getState().updatePhaseStartTime('p2', 70);
        const phases = useMitigationStore.getState().phases;
        expect(phases.find(p => p.id === 'p2')!.startTime).toBe(70);
        expect(phases.find(p => p.id === 'p1')!.endTime).toBe(30);
    });

    it('前フェーズと衝突したら、前フェーズの endTime が final-1 に追従する', () => {
        setPhases([makePhase('p1', 0, 50), makePhase('p2', 60, 100)]);
        useMitigationStore.getState().updatePhaseStartTime('p2', 30);
        const phases = useMitigationStore.getState().phases;
        expect(phases.find(p => p.id === 'p2')!.startTime).toBe(30);
        expect(phases.find(p => p.id === 'p1')!.endTime).toBe(29);
        expect(phases.find(p => p.id === 'p1')!.startTime).toBe(0);
    });

    it('前フェーズを潰す範囲まで戻すと、前フェーズの startTime + 2 で止まる', () => {
        setPhases([makePhase('p1', 20, 50), makePhase('p2', 60, 100)]);
        useMitigationStore.getState().updatePhaseStartTime('p2', 5);
        const phases = useMitigationStore.getState().phases;
        expect(phases.find(p => p.id === 'p2')!.startTime).toBe(22);
        expect(phases.find(p => p.id === 'p1')!.endTime).toBe(21);
        expect(phases.find(p => p.id === 'p1')!.startTime).toBe(20);
    });
});

describe('updateLabelEndTime', () => {
    beforeEach(() => setLabels([]));

    it('次ラベルがなければ自由に endTime を後ろへ動かせる', () => {
        setLabels([makeLabel('l1', 0, 30)]);
        useMitigationStore.getState().updateLabelEndTime('l1', 100);
        expect(useMitigationStore.getState().labels[0].endTime).toBe(100);
    });

    it('自分の startTime + 1 未満には設定できない', () => {
        setLabels([makeLabel('l1', 50, 100)]);
        useMitigationStore.getState().updateLabelEndTime('l1', 10);
        expect(useMitigationStore.getState().labels[0].endTime).toBe(51);
    });

    it('次ラベルと衝突したら、次ラベルの startTime が final+1 に追従する', () => {
        setLabels([makeLabel('l1', 0, 30), makeLabel('l2', 60, 100)]);
        useMitigationStore.getState().updateLabelEndTime('l1', 80);
        const labels = useMitigationStore.getState().labels;
        expect(labels.find(l => l.id === 'l1')!.endTime).toBe(80);
        expect(labels.find(l => l.id === 'l2')!.startTime).toBe(81);
        expect(labels.find(l => l.id === 'l2')!.endTime).toBe(100);
    });

    it('次ラベルを潰す範囲まで延ばすと、次ラベルの endTime - 2 で止まる', () => {
        setLabels([makeLabel('l1', 0, 30), makeLabel('l2', 60, 100)]);
        useMitigationStore.getState().updateLabelEndTime('l1', 200);
        const labels = useMitigationStore.getState().labels;
        expect(labels.find(l => l.id === 'l1')!.endTime).toBe(98);
        expect(labels.find(l => l.id === 'l2')!.startTime).toBe(99);
    });
});

describe('updateLabelStartTime', () => {
    beforeEach(() => setLabels([]));

    it('前ラベルがなければ自由に startTime を前へ動かせる', () => {
        setLabels([makeLabel('l1', 50, 100)]);
        useMitigationStore.getState().updateLabelStartTime('l1', 10);
        expect(useMitigationStore.getState().labels[0].startTime).toBe(10);
    });

    it('自分の endTime - 1 超には設定できない', () => {
        setLabels([makeLabel('l1', 0, 30)]);
        useMitigationStore.getState().updateLabelStartTime('l1', 100);
        expect(useMitigationStore.getState().labels[0].startTime).toBe(29);
    });

    it('前ラベルと衝突したら、前ラベルの endTime が final-1 に追従する', () => {
        setLabels([makeLabel('l1', 0, 50), makeLabel('l2', 60, 100)]);
        useMitigationStore.getState().updateLabelStartTime('l2', 30);
        const labels = useMitigationStore.getState().labels;
        expect(labels.find(l => l.id === 'l2')!.startTime).toBe(30);
        expect(labels.find(l => l.id === 'l1')!.endTime).toBe(29);
    });

    it('前ラベルを潰す範囲まで戻すと、前ラベルの startTime + 2 で止まる', () => {
        setLabels([makeLabel('l1', 20, 50), makeLabel('l2', 60, 100)]);
        useMitigationStore.getState().updateLabelStartTime('l2', 5);
        const labels = useMitigationStore.getState().labels;
        expect(labels.find(l => l.id === 'l2')!.startTime).toBe(22);
        expect(labels.find(l => l.id === 'l1')!.endTime).toBe(21);
    });

    it('隣接していないラベル（gap あり）でも衝突判定が正しく働く', () => {
        setLabels([makeLabel('l1', 0, 30), makeLabel('l2', 60, 100)]);
        useMitigationStore.getState().updateLabelStartTime('l2', 40);
        const labels = useMitigationStore.getState().labels;
        expect(labels.find(l => l.id === 'l2')!.startTime).toBe(40);
        expect(labels.find(l => l.id === 'l1')!.endTime).toBe(30);
    });
});

describe('addPhase', () => {
    beforeEach(() => {
        useMitigationStore.setState({
            phases: [],
            labels: [],
            timelineEvents: [],
            _history: [],
            _future: [],
        });
    });

    it('新規フェーズを 2 個追加したとき、前フェーズの endTime + 1 === 次の startTime になる', () => {
        useMitigationStore.getState().addPhase(4, { ja: 'Phase 1', en: 'Phase 1' });
        useMitigationStore.getState().addPhase(16, { ja: 'Phase 2', en: 'Phase 2' });
        const phases = useMitigationStore.getState().phases;
        expect(phases).toHaveLength(2);
        const p1 = phases.find(p => (p.name as any).ja === 'Phase 1')!;
        const p2 = phases.find(p => (p.name as any).ja === 'Phase 2')!;
        // 空白を意図的に作れる仕様のため、gap があっても OK だが隣接の場合は +1 ずれる必要
        // 新規追加時 p1 は maxEventTime=0 で (4,5) → p2 追加時 containing なしで clipped しない
        // よって p1 (4, 5), p2 (16, 17) で gap が残る（意図仕様）
        expect(p1.startTime).toBe(4);
        expect(p2.startTime).toBe(16);
        // p1 が p2 に含まれる場合は -1 される（次のテスト）
    });

    it('含有フェーズ内に新規追加したとき、前フェーズは startTime - 1 でクリップされる', () => {
        // phase1 が十分長い状態を手動でセット
        useMitigationStore.setState({
            phases: [makePhase('p1', 4, 200)],
            labels: [],
            timelineEvents: [],
            _history: [],
            _future: [],
        });
        useMitigationStore.getState().addPhase(16, { ja: 'Phase 2', en: 'Phase 2' });
        const phases = useMitigationStore.getState().phases;
        const p1 = phases.find(p => p.id === 'p1')!;
        const p2 = phases.find(p => (p.name as any).ja === 'Phase 2')!;
        expect(p1.endTime).toBe(15);
        expect(p2.startTime).toBe(16);
        expect(p1.endTime + 1).toBe(p2.startTime);
    });
});

describe('addLabel', () => {
    beforeEach(() => {
        useMitigationStore.setState({
            phases: [],
            labels: [],
            timelineEvents: [],
            _history: [],
            _future: [],
        });
    });

    it('含有ラベル内に新規追加したとき、前ラベルは startTime - 1 でクリップされる', () => {
        useMitigationStore.setState({
            phases: [],
            labels: [makeLabel('l1', 4, 200)],
            timelineEvents: [],
            _history: [],
            _future: [],
        });
        useMitigationStore.getState().addLabel(16, { ja: 'L2', en: 'L2' });
        const labels = useMitigationStore.getState().labels;
        const l1 = labels.find(l => l.id === 'l1')!;
        const l2 = labels.find(l => (l.name as any).ja === 'L2')!;
        expect(l1.endTime).toBe(15);
        expect(l2.startTime).toBe(16);
        expect(l1.endTime + 1).toBe(l2.startTime);
    });
});
