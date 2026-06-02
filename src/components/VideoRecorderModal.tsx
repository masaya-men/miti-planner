import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Play, Pause, RotateCcw, Plus, Undo2 } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useMitigationStore } from '../store/useMitigationStore';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { parseYouTubeId } from '../utils/youtube';
import { formatStopwatch, snapToSecond } from '../utils/stopwatch';
import EventForm from './EventForm';
import type { TimelineEvent } from '../types';

const genId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).slice(2, 9);

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const VideoRecorderModal: React.FC<Props> = ({ isOpen, onClose }) => {
    useEscapeClose(isOpen, onClose);
    const { t, i18n } = useTranslation();
    const lang = (i18n.language || 'ja') as 'ja' | 'en' | 'zh' | 'ko';

    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
    const addEvent = useMitigationStore(s => s.addEvent);
    const undo = useMitigationStore(s => s.undo);
    const eventCount = useMitigationStore(s => s.timelineEvents.length);

    const planTitle = currentPlan?.title ?? '';
    const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : undefined;
    const contentName = contentDef
        ? (contentDef.name[lang] || contentDef.name.ja || contentDef.name.en || '')
        : (currentPlan?.contentId ?? '');

    const [urlInput, setUrlInput] = useState('');
    const [videoId, setVideoId] = useState<string | null>(null);
    const [urlError, setUrlError] = useState(false);
    const playerHostRef = useRef<HTMLDivElement>(null);
    const { play, pause, getCurrentTime, isPlaying } = useYouTubePlayer(playerHostRef, videoId);

    const [combatStartSec, setCombatStartSec] = useState<number | null>(null);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [formTime, setFormTime] = useState<number | null>(null);

    useEffect(() => {
        if (combatStartSec == null) { setElapsedSec(0); return; }
        const id = setInterval(() => {
            setElapsedSec(Math.max(0, getCurrentTime() - combatStartSec));
        }, 200);
        return () => clearInterval(id);
    }, [combatStartSec, getCurrentTime]);

    const handleLoadUrl = useCallback(() => {
        const id = parseYouTubeId(urlInput);
        if (!id) { setUrlError(true); return; }
        setUrlError(false);
        setVideoId(id);
        setCombatStartSec(null);
    }, [urlInput]);

    const handleChangeVideo = useCallback(() => {
        setVideoId(null);
        setCombatStartSec(null);
        setUrlInput('');
    }, []);

    const handleStart = useCallback(() => { setCombatStartSec(getCurrentTime()); }, [getCurrentTime]);
    const handleReset = useCallback(() => { setCombatStartSec(null); }, []);
    const handleTogglePlay = useCallback(() => { if (isPlaying) pause(); else play(); }, [isPlaying, play, pause]);
    const handleAddEvent = useCallback(() => {
        pause();
        const base = combatStartSec ?? getCurrentTime();
        setFormTime(snapToSecond(Math.max(0, getCurrentTime() - base)));
    }, [pause, combatStartSec, getCurrentTime]);

    const writeToSheet = useCallback((ev: Omit<TimelineEvent, 'id'>) => {
        addEvent({ ...ev, id: genId() });
        setFormTime(null);
    }, [addEvent]);

    if (!isOpen) return null;

    const combatStarted = combatStartSec != null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/50 cursor-pointer"
                />
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="relative glass-tier3 rounded-2xl shadow-2xl w-full max-w-[1200px] max-h-[90vh] overflow-hidden flex flex-col"
                >
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-glass-border/30 shrink-0">
                        <h2 className="text-app-lg font-black text-app-text tracking-wider">{t('timeline.recorder.menu_record')}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full text-app-text/60 hover:text-app-text hover:bg-app-text/10 transition-colors cursor-pointer active:scale-90"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* 本体: 左=動画, 右=記録UI */}
                    <div className="flex flex-col md:flex-row gap-4 p-4 overflow-y-auto">
                        {/* 左ペイン: 動画 */}
                        <div className="md:flex-[2] min-w-0">
                            {!videoId ? (
                                <div className="flex flex-col gap-3 h-full justify-center">
                                    <label className="text-app-md font-bold text-app-text/80">{t('timeline.recorder.video_url_placeholder')}</label>
                                    <input
                                        type="text"
                                        value={urlInput}
                                        onChange={(e) => { setUrlInput(e.target.value); setUrlError(false); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleLoadUrl(); }}
                                        placeholder={t('timeline.recorder.video_url_placeholder')}
                                        className="w-full rounded-lg p-3 bg-app-surface2 border border-app-border text-app-text focus:outline-none focus:border-app-text"
                                    />
                                    {urlError && <span className="text-app-base text-app-red">{t('timeline.recorder.video_url_error')}</span>}
                                    <button
                                        onClick={handleLoadUrl}
                                        className="self-start rounded-lg bg-app-blue px-5 py-2.5 text-white font-bold hover:bg-app-blue-hover active:scale-95 cursor-pointer"
                                    >
                                        {t('timeline.recorder.video_load')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <div ref={playerHostRef} className="w-full aspect-video bg-black rounded-lg overflow-hidden" />
                                    <button
                                        onClick={handleChangeVideo}
                                        className="self-start text-app-base text-app-text/60 hover:text-app-text underline cursor-pointer"
                                    >
                                        {t('timeline.recorder.video_change')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 右ペイン: 記録UI */}
                        <div className="md:flex-1 min-w-0 md:max-w-[340px] flex flex-col">
                            {!currentPlanId ? (
                                <div className="flex flex-1 items-center justify-center p-4 text-center text-app-text/70 text-app-md">
                                    {t('timeline.recorder.no_plan')}
                                </div>
                            ) : formTime !== null ? (
                                <EventForm
                                    variant="pip"
                                    reverseOnly
                                    initialTime={formTime}
                                    labels={{ saveButtonKey: 'timeline.recorder.write' }}
                                    onSave={writeToSheet}
                                    onCancel={() => setFormTime(null)}
                                />
                            ) : (
                                <div className="flex flex-col gap-3 p-2">
                                    {/* コンテンツ名 + プラン名 */}
                                    <div className="text-center leading-tight">
                                        {contentName && <div className="text-app-base text-app-text/50 truncate">{contentName}</div>}
                                        {planTitle && <div className="text-app-md font-bold text-app-text/80 truncate">{planTitle}</div>}
                                    </div>

                                    {/* ストップウォッチ表示 */}
                                    <div
                                        className="w-full text-center font-mono font-bold tracking-tight"
                                        style={{ fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontFeatureSettings: '"tnum" 1' }}
                                    >
                                        {formatStopwatch(elapsedSec)}
                                    </div>

                                    {!combatStarted ? (
                                        <>
                                            <p className="text-app-base text-app-text/50 text-center">{t('timeline.recorder.video_hint')}</p>
                                            <button
                                                onClick={handleStart}
                                                className="w-full rounded-xl bg-app-blue py-4 text-app-2xl font-bold text-white hover:bg-app-blue-hover active:scale-95 cursor-pointer"
                                            >
                                                {t('timeline.recorder.start')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* 再生/一時停止 + リセット */}
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={handleTogglePlay}
                                                    className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer"
                                                >
                                                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                                    {isPlaying ? t('timeline.recorder.pause') : t('timeline.recorder.start')}
                                                </button>
                                                <button
                                                    onClick={handleReset}
                                                    className="flex items-center gap-1 rounded-lg border border-app-border px-3 py-2 text-app-md hover:bg-app-toggle hover:text-app-toggle-text active:scale-95 cursor-pointer"
                                                >
                                                    <RotateCcw size={16} /> {t('timeline.recorder.reset')}
                                                </button>
                                            </div>

                                            {/* イベント追加ボタン */}
                                            <button
                                                onClick={handleAddEvent}
                                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-app-blue py-4 text-app-2xl font-bold text-white hover:bg-app-blue-hover active:scale-95 cursor-pointer"
                                            >
                                                <Plus size={20} /> {t('timeline.recorder.add_event')}
                                            </button>

                                            {/* 記録件数 + Undo */}
                                            <div className="flex w-full items-center justify-between text-app-base text-app-text/60">
                                                <span>{t('timeline.recorder.recorded_count', { count: eventCount })}</span>
                                                <button
                                                    onClick={() => undo()}
                                                    className="flex items-center gap-1 rounded px-2 py-1 hover:bg-app-text/10 active:scale-95 cursor-pointer"
                                                >
                                                    <Undo2 size={14} /> {t('timeline.recorder.undo')}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

export default VideoRecorderModal;
