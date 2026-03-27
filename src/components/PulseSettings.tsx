import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { pulseConfig, gridConfig, pulseLineConfig } from './GridOverlay';

const DEFAULT_DISTANCE = 3;
const DEFAULT_SPEED = 3;
const DEFAULT_LINE_WIDTH = 4;
const PULSE_MIN = 1;
const PULSE_MAX = 5;
const GRID_MIN = 0;
const GRID_MAX = 7;

// 吸着スライダー（min/maxをpropsで指定可能）
const SnapSlider: React.FC<{
    value: number;
    onChange: (v: number) => void;
    leftLabel: string;
    rightLabel: string;
    disabled?: boolean;
    min?: number;
    max?: number;
}> = ({ value, onChange, leftLabel, rightLabel, disabled, min = PULSE_MIN, max = PULSE_MAX }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const getValueFromX = useCallback((clientX: number) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (max - min) + min);
    }, [value, min, max]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onChange(getValueFromX(e.clientX));
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || disabled) return;
        onChange(getValueFromX(e.clientX));
    };

    const handlePointerUp = () => {
        setDragging(false);
    };

    // つまみの位置（%）
    const percent = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex items-center gap-2">
            <span className="text-[8px] text-app-text-muted w-4 text-right shrink-0">{leftLabel}</span>
            <div
                ref={trackRef}
                className="relative flex-1 h-5 flex items-center cursor-pointer"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                {/* トラック */}
                <div className="absolute left-0 right-0 h-[2px] bg-app-border rounded-full" />
                {/* アクティブ部分 */}
                <div
                    className="absolute left-0 h-[2px] bg-app-text/40 rounded-full"
                    style={{ width: `${percent}%` }}
                />
                {/* ステップドット */}
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(step => (
                    <div
                        key={step}
                        className={`absolute w-1 h-1 rounded-full -translate-x-1/2 ${
                            step <= value ? 'bg-app-text/60' : 'bg-app-border'
                        }`}
                        style={{ left: `${((step - min) / (max - min)) * 100}%` }}
                    />
                ))}
                {/* つまみ */}
                <div
                    className="absolute w-3 h-3 rounded-full bg-app-text border-2 border-app-bg -translate-x-1/2 transition-[left] duration-75 shadow-sm"
                    style={{ left: `${percent}%` }}
                />
            </div>
            <span className="text-[8px] text-app-text-muted w-4 shrink-0">{rightLabel}</span>
        </div>
    );
};

export const PulseSettings: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [enabled, setEnabled] = useState(pulseConfig.enabled);
    const [distance, setDistance] = useState(pulseConfig.distance);
    const [speed, setSpeed] = useState(pulseConfig.speed);
    const [lineWidth, setLineWidth] = useState(gridConfig.lineWidth);
    const [pulseWidth, setPulseWidth] = useState(pulseLineConfig.width);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // パネル外クリックで閉じる
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen]);

    const updateEnabled = (v: boolean) => {
        setEnabled(v);
        pulseConfig.enabled = v;
    };

    const updateDistance = (v: number) => {
        setDistance(v);
        pulseConfig.distance = v;
    };

    const updateSpeed = (v: number) => {
        setSpeed(v);
        pulseConfig.speed = v;
    };

    const updateLineWidth = (v: number) => {
        setLineWidth(v);
        gridConfig.lineWidth = v;
    };

    const updatePulseWidth = (v: number) => {
        setPulseWidth(v);
        pulseLineConfig.width = v;
    };

    const resetToDefault = () => {
        updateEnabled(true);
        updateDistance(DEFAULT_DISTANCE);
        updateSpeed(DEFAULT_SPEED);
        updateLineWidth(DEFAULT_LINE_WIDTH);
        updatePulseWidth(DEFAULT_LINE_WIDTH);
    };

    const isDefault = enabled && distance === DEFAULT_DISTANCE && speed === DEFAULT_SPEED && lineWidth === DEFAULT_LINE_WIDTH && pulseWidth === DEFAULT_LINE_WIDTH;

    return (
        <span className="relative inline-block">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="underline hover:text-app-text transition-colors cursor-pointer"
            >
                {t('footer.pulse_settings')}
            </button>

            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-tier3 rounded-xl p-3 w-[220px] z-[99999]"
                >
                    {/* ×ボタン */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-app-text/10 transition-colors cursor-pointer"
                    >
                        <X size={12} />
                    </button>

                    {/* ON/OFF トグル */}
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-app-text uppercase tracking-wider">
                            {t('footer.pulse_enabled')}
                        </span>
                        <button
                            onClick={() => updateEnabled(!enabled)}
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                                enabled
                                    ? 'bg-app-text text-app-bg'
                                    : 'bg-app-surface2 text-app-text-muted border border-app-border'
                            }`}
                        >
                            {enabled ? t('footer.pulse_on') : t('footer.pulse_off')}
                        </button>
                    </div>

                    {/* 距離スライダー */}
                    <div className={`mb-3 transition-opacity ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1.5">
                            {t('footer.pulse_distance')}
                        </div>
                        <SnapSlider
                            value={distance}
                            onChange={updateDistance}
                            leftLabel={t('footer.pulse_short')}
                            rightLabel={t('footer.pulse_long')}
                            disabled={!enabled}
                        />
                    </div>

                    {/* 速度スライダー */}
                    <div className={`mb-3 transition-opacity ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1.5">
                            {t('footer.pulse_speed')}
                        </div>
                        <SnapSlider
                            value={speed}
                            onChange={updateSpeed}
                            leftLabel={t('footer.pulse_slow')}
                            rightLabel={t('footer.pulse_fast')}
                            disabled={!enabled}
                        />
                    </div>

                    {/* パルスの太さスライダー */}
                    <div className={`mb-3 transition-opacity ${!enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1.5">
                            {t('footer.pulse_line_width')}
                        </div>
                        <SnapSlider
                            value={pulseWidth}
                            onChange={updatePulseWidth}
                            leftLabel={t('footer.grid_none')}
                            rightLabel={t('footer.grid_thick')}
                            min={GRID_MIN}
                            max={GRID_MAX}
                            disabled={!enabled}
                        />
                    </div>

                    {/* 格子の太さスライダー */}
                    <div className="mb-3">
                        <div className="text-[9px] text-app-text-muted uppercase tracking-wider mb-1.5">
                            {t('footer.grid_line_width')}
                        </div>
                        <SnapSlider
                            value={lineWidth}
                            onChange={updateLineWidth}
                            leftLabel={t('footer.grid_none')}
                            rightLabel={t('footer.grid_thick')}
                            min={GRID_MIN}
                            max={GRID_MAX}
                        />
                    </div>

                    {/* デフォルトに戻すボタン */}
                    <button
                        onClick={resetToDefault}
                        disabled={isDefault}
                        className={`w-full py-1 rounded text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                            isDefault
                                ? 'text-app-text-muted/30 cursor-default'
                                : 'text-app-text-muted hover:text-app-text border border-app-border hover:border-app-text-muted'
                        }`}
                    >
                        {t('common.reset', 'Reset to Default')}
                    </button>
                </div>
            )}
        </span>
    );
};
