import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, RotateCcw, Plus, Undo2 } from 'lucide-react';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import EventForm from './EventForm';
import { computeElapsed, formatStopwatch } from '../utils/stopwatch';
import type { TimelineEvent } from '../types';

const genId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).slice(2, 9);

const PipRecorder: React.FC = () => {
    const { t } = useTranslation();
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const addEvent = useMitigationStore(s => s.addEvent);
    const undo = useMitigationStore(s => s.undo);
    const eventCount = useMitigationStore(s => s.timelineEvents.length);

    const accumulatedRef = useRef(0);
    const startedAtRef = useRef<number | null>(null);
    const [running, setRunning] = useState(false);
    const [display, setDisplay] = useState('00:00.00');
    const [formTime, setFormTime] = useState<number | null>(null);

    const readElapsed = useCallback(
        () => computeElapsed(accumulatedRef.current, startedAtRef.current, performance.now()),
        [],
    );

    useEffect(() => {
        if (!running) return;
        let raf = 0;
        const tick = () => {
            setDisplay(formatStopwatch(readElapsed()));
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [running, readElapsed]);

    const start = useCallback(() => {
        if (running) return;
        startedAtRef.current = performance.now();
        setRunning(true);
    }, [running]);

    const pause = useCallback(() => {
        if (!running) return;
        accumulatedRef.current = readElapsed() * 1000;
        startedAtRef.current = null;
        setRunning(false);
        setDisplay(formatStopwatch(accumulatedRef.current / 1000));
    }, [running, readElapsed]);

    const reset = useCallback(() => {
        accumulatedRef.current = 0;
        startedAtRef.current = null;
        setRunning(false);
        setDisplay('00:00.00');
    }, []);

    const openForm = useCallback(() => {
        const elapsed = readElapsed();
        accumulatedRef.current = elapsed * 1000;
        startedAtRef.current = null;
        setRunning(false);
        setDisplay(formatStopwatch(elapsed));
        setFormTime(Math.round(elapsed * 100) / 100);
    }, [readElapsed]);

    const writeToSheet = useCallback((ev: Omit<TimelineEvent, 'id'>) => {
        addEvent({ ...ev, id: genId() });
        setFormTime(null);
    }, [addEvent]);

    if (!currentPlanId) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-center text-app-text/70 text-app-md">
                {t('timeline.recorder.no_plan')}
            </div>
        );
    }

    if (formTime !== null) {
        return (
            <div className="h-full overflow-y-auto bg-app-bg text-app-text">
                <EventForm
                    variant="pip"
                    reverseOnly
                    initialTime={formTime}
                    labels={{ saveButtonKey: 'timeline.recorder.write' }}
                    onSave={writeToSheet}
                    onCancel={() => setFormTime(null)}
                />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col items-center justify-between gap-3 bg-app-bg p-3 text-app-text">
            <div
                className="w-full text-center font-barlow font-bold tracking-tight"
                style={{ fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontFeatureSettings: '"tnum" 1' }}
            >
                {display}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={running ? pause : start}
                    className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer"
                >
                    {running ? <Pause size={16} /> : <Play size={16} />}
                    {running ? t('timeline.recorder.pause') : t('timeline.recorder.start')}
                </button>
                <button
                    onClick={reset}
                    className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer"
                >
                    <RotateCcw size={16} /> {t('timeline.recorder.reset')}
                </button>
            </div>

            <button
                onClick={openForm}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-blue py-4 text-app-2xl font-bold text-white hover:bg-app-blue-hover active:scale-95 cursor-pointer"
            >
                <Plus size={20} /> {t('timeline.recorder.add_event')}
            </button>

            <div className="flex w-full items-center justify-between text-app-base text-app-text/60">
                <span>{t('timeline.recorder.recorded_count', { count: eventCount })}</span>
                <button
                    onClick={() => undo()}
                    className="flex items-center gap-1 rounded px-2 py-1 hover:bg-app-text/10 active:scale-95 cursor-pointer"
                >
                    <Undo2 size={14} /> {t('timeline.recorder.undo')}
                </button>
            </div>
        </div>
    );
};

export default PipRecorder;
