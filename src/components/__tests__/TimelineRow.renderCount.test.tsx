// @vitest-environment happy-dom
// 軽減を 1 つ置く・消すたびに、描き直される行の数を測る(94 行の表で、変更があった行だけになること)。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useMemo, useRef } from 'react';
import { render, act } from '@testing-library/react';
import { create } from 'zustand';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));
vi.mock('../../store/useMitigationStore', async () => {
    const { create } = await import('zustand');
    const useMitigationStore = create(() => ({
        myMemberId: null as string | null,
        timelineMitigations: [] as any[],
        phases: [] as any[],
        updateEvent: () => {},
        setClipboardEvent: () => {},
    }));
    return { useMitigationStore };
});
vi.mock('../../store/useThemeStore', () => ({
    useThemeStore: (sel?: any) => {
        const st = { contentLanguage: 'ja', themeStyle: 'standard' };
        return sel ? sel(st) : st;
    },
}));
const MITS = [{ id: 'reprisal', icon: '', isTankSwap: false }, { id: 'provoke', icon: '', isTankSwap: true }];
vi.mock('../../hooks/useSkillsData', () => ({ useJobs: () => [], useMitigations: () => MITS }));
// 行の中身(TimelineRowContent)が描き直されるたびに 1 回呼ばれる部品で、行ごとの描き直し回数を数える
const renders: Record<string, number> = {};
vi.mock('../EventNameSpan', () => ({
    EventNameSpan: ({ name }: { name: string }) => { renders[name] = (renders[name] ?? 0) + 1; return <span>{name}</span>; },
}));
vi.mock('../progress/useProgressRecording', () => ({
    useProgressRecording: { getState: () => ({ recordMode: false, commitReachedPos: vi.fn() }) },
}));

import { TimelineRow } from '../TimelineRow';
import { useMitigationStore } from '../../store/useMitigationStore';
import { reuseEqualArray } from '../timeline/stableArray';
import { reuseEqualDamages } from '../timeline/stableDamageMap';
import type { TimelineEvent } from '../../types';

const N = 94;
const noop = vi.fn();
const NONE: never[] = [];
const events: TimelineEvent[][] = Array.from({ length: N }, (_, i) => [
    { id: `e${i}`, time: i * 2, name: { ja: `攻撃${i}`, en: `a${i}` }, damageType: 'magical', target: 'AoE' } as TimelineEvent,
]);
const labels = { orConnector: 'or', endPhase: 'p', addLabel: 'l', addEvent: 'a', mitigationSelect: 'm' };

const mit = (id: string, mitigationId: string, time: number) =>
    ({ id, mitigationId, time, duration: 5, ownerId: 'MT' }) as any;

// Timeline 本体と同じ流れ: 親が 1 回だけ計算して、行ごとに必要な分を props で渡す
const Parent: React.FC = () => {
    const mits = useMitigationStore(s => s.timelineMitigations) as any[];
    const phases = useMitigationStore(s => s.phases) as any[];
    const swapRaw = useMemo(() => mits.filter(m => MITS.find(d => d.id === m.mitigationId)?.isTankSwap), [mits]);
    const swapRef = useRef<readonly any[] | undefined>(undefined);
    const swapMarkers = useMemo(() => (swapRef.current = reuseEqualArray(swapRef.current, swapRaw) as any[]), [swapRaw]) as any[];
    const dmgRef = useRef<Map<string, any> | undefined>(undefined);
    const damageMap = useMemo(() => {
        const raw = new Map<string, any>(events.map(([e]) => {
            const n = mits.filter(m => m.time <= e.time && e.time < m.time + m.duration).length;
            return [e.id, { unmitigated: 1000, mitigated: 1000 - n * 10, mitigationPercent: n, shieldTotal: 0 }];
        }));
        return (dmgRef.current = reuseEqualDamages(dmgRef.current, raw));
    }, [mits]);
    return (
        <>
            {events.map((evs, i) => {
                const t = evs[0].time;
                const active = mits.filter(m => m.time <= t && t < m.time + m.duration);
                return (
                    <React.Fragment key={t}>
                        <TimelineRow
                            time={t} top={i * 25} height={25}
                            damages={[damageMap.get(evs[0].id)]} events={evs}
                            partyMembers={NONE} visiblePartyMembers={NONE} activeMitigations={active}
                            swapMarkers={swapMarkers} phases={phases} labels={labels}
                            onPhaseAdd={noop} onAddEventClick={noop} onEventClick={noop} onCellClick={noop}
                            phaseColumnCollapsed labelColumnVisible={false}
                        />
                    </React.Fragment>
                );
            })}
        </>
    );
};

const counts = renders;
const changedRows = (before: Record<string, number>) =>
    Object.keys(counts).filter(k => counts[k] !== (before[k] ?? 0)).map(k => Number(k.replace('攻撃', '')));
const rerenderedRows = (_c: unknown, before: Record<string, number>) => changedRows(before).length;

describe('TimelineRow: 軽減を置く・消すで描き直される行', () => {
    beforeEach(() => { for (const k of Object.keys(renders)) delete renders[k]; useMitigationStore.setState({ timelineMitigations: [], phases: [] }); });

    it('置く 1 回で描き直される行は、その軽減に重なる行だけ', () => {
        render(<Parent />);
        const snap = { ...counts };
        // time 20〜24 に重なる行 = 時刻 20,22,24 の 3 行
        act(() => { useMitigationStore.setState({ timelineMitigations: [mit('m1', 'reprisal', 20)] }); });
        const n = rerenderedRows(counts, snap);
        console.log(`[renderCount] 置く: ${n} / ${N}`);
        expect(n).toBeLessThanOrEqual(3);
        const snap2 = { ...counts };
        act(() => { useMitigationStore.setState({ timelineMitigations: [] }); });
        const n2 = rerenderedRows(counts, snap2);
        console.log(`[renderCount] 消す: ${n2} / ${N}`);
        expect(n2).toBeLessThanOrEqual(3);
    });

    it('挑発(isTankSwap)を置いたときは、実効ターゲットが変わりうるため全行が更新される(正しさ優先)', () => {
        render(<Parent />);
        const snap = { ...counts };
        act(() => { useMitigationStore.setState({ timelineMitigations: [mit('m1', 'provoke', 20)] }); });
        expect(rerenderedRows(counts, snap)).toBeGreaterThan(3);
    });

    it('共同編集: 他人が別の軽減に差し替えても、重なる行は更新される', () => {
        render(<Parent />);
        act(() => { useMitigationStore.setState({ timelineMitigations: [mit('m1', 'reprisal', 20)] }); });
        const snap = { ...counts };
        act(() => { useMitigationStore.setState({ timelineMitigations: [mit('m2', 'reprisal', 60)] }); });
        const changed = changedRows(snap);
        // 旧位置(20,22,24)と新位置(60,62,64)の行が更新される
        expect(changed.sort((a, b) => a - b)).toEqual([10, 11, 12, 30, 31, 32]);
    });
});
void create;
