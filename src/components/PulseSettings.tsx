import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { pulseConfig } from './GridOverlay';

const DEFAULT_DISTANCE = 3;
const DEFAULT_SPEED = 3;
const MIN = 1;
const MAX = 5;

// 1-5に吸着するスライダー
const SnapSlider: React.FC<{
    value: number;
    onChange: (v: number) => void;
    leftLabel: string;
    rightLabel: string;
    disabled?: boolean;
}> = ({ value, onChange, leftLabel, rightLabel, disabled }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const getValueFromX = useCallback((clientX: number) => {
        if (!trackRef.current) return value;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(ratio * (MAX - MIN) + MIN);
    }, [value]);

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
    const percent = ((value - MIN) / (MAX - MIN)) * 100;

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
                {[1, 2, 3, 4, 5].map(step => (
                    <div
                        key={step}
                        className={`absolute w-1 h-1 rounded-full -translate-x-1/2 ${
                            step <= value ? 'bg-app-text/60' : 'bg-app-border'
                        }`}
                        style={{ left: `${((step - MIN) / (MAX - MIN)) * 100}%` }}
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

    const resetToDefault = () => {
        updateEnabled(true);
        updateDistance(DEFAULT_DISTANCE);
        updateSpeed(DEFAULT_SPEED);
    };

    const isDefault = enabled && distance === DEFAULT_DISTANCE && speed === DEFAULT_SPEED;

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
