import React from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent, LocalizedString } from '../../types';
import { SegmentButton } from '../ui/SegmentButton';
import { TimeInput } from '../ui/TimeInput';
import { INPUT_CLASS } from '../ui/ModalParts';

interface EventFormAttackFieldsProps {
    time: number;
    setTime: (v: number) => void;
    name: LocalizedString;
    setName: (v: LocalizedString) => void;
    altName: LocalizedString;
    setAltName: (v: LocalizedString) => void;
    damageType: TimelineEvent['damageType'];
    setDamageType: (v: TimelineEvent['damageType']) => void;
    target: TimelineEvent['target'];
    setTarget: (v: TimelineEvent['target']) => void;
    ignoresDebuffMitigation: boolean;
    setIgnoresDebuffMitigation: (v: boolean) => void;
    contentLanguage: string;
    compact: boolean;
}

// 攻撃そのものの入力欄(時間・攻撃名と別名・ダメージ種別と対象・デバフ軽減不可)。
export const EventFormAttackFields: React.FC<EventFormAttackFieldsProps> = ({
    time, setTime, name, setName, altName, setAltName, damageType, setDamageType, target, setTarget,
    ignoresDebuffMitigation, setIgnoresDebuffMitigation, contentLanguage, compact,
}) => {
    const { t } = useTranslation();
    return (
        <>
            {/* 時間（M:SS でも 裸の秒数でも入力可。幅控えめ・全幅にすると間延びするため上限を設ける） */}
            <div className="max-w-[200px]">
                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('modal.time')}</label>
                <TimeInput
                    value={time}
                    onChange={(sec) => setTime(sec ?? 0)}
                    data-testid="event-time-input"
                    placeholder={t('modal.time_placeholder')}
                    className={INPUT_CLASS}
                />
                <p className="mt-1 text-app-sm text-app-text-muted">{t('modal.time_format_hint')}</p>
            </div>

            {/* 攻撃名 ＋ 2択攻撃の別名（任意）— 別名を攻撃名の直下に密着させ、続きの欄だと分かるようにする */}
            <div>
                <label className="block text-app-lg font-medium text-app-text mb-1.5">{t('mechanic_modal.name_label')}</label>
                <input
                    data-tutorial="event-name-input"
                    type="text"
                    lang={t('app.language') === 'English' ? 'en' : 'ja'}
                    value={contentLanguage === 'en' ? name.en : name.ja}
                    onChange={(e) => setName({ ...name, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                    className={INPUT_CLASS}
                    required
                    placeholder={t('mechanic_modal.placeholder')}
                />
                {/* 淡色サブラベル＋密着配置（mt-2）で「攻撃名の続き＝もう一方の名前」と伝える */}
                <label className="block text-app-sm text-app-text-muted mt-2 mb-1">{t('event.alt_name_label')}</label>
                <input
                    data-testid="event-altname-input"
                    type="text"
                    lang={t('app.language') === 'English' ? 'en' : 'ja'}
                    value={contentLanguage === 'en' ? altName.en : altName.ja}
                    onChange={(e) => setAltName({ ...altName, [contentLanguage === 'en' ? 'en' : 'ja']: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder={t('event.alt_name_placeholder')}
                />
            </div>

            {/* Type & Target Row */}
            <div className={clsx("grid grid-cols-2", compact ? "gap-3" : "gap-4")}>
                {/* Damage Type */}
                <div className="flex flex-col">
                    <label className={clsx("block text-app-lg font-medium text-app-text", compact ? "mb-1.5" : "mb-2")}>{t('modal.damage_type')}</label>
                    <SegmentButton
                        options={[
                            { value: 'magical', label: t('modal.magical'), icon: '/icons/type_magic.png' },
                            { value: 'physical', label: t('modal.physical'), icon: '/icons/type_phys.png' },
                            { value: 'unavoidable', label: t('modal.unavoidable'), icon: '/icons/type_dark.png' },
                        ]}
                        value={damageType}
                        onChange={(v) => setDamageType(v as TimelineEvent['damageType'])}
                        size={compact ? 'sm' : 'md'}
                        layout="vertical"
                        className="flex-1"
                    />
                </div>

                {/* Target Selection */}
                <div className="flex flex-col">
                    <label className={clsx("block text-app-lg font-medium text-app-text", compact ? "mb-1.5" : "mb-2")}>{t('modal.target')}</label>
                    <SegmentButton
                        options={[
                            { value: 'AoE', label: t('modal.aoe') },
                            { value: 'MT', label: t('modal.mt') },
                            { value: 'ST', label: t('modal.st') },
                        ]}
                        value={target ?? 'AoE'}
                        onChange={(v) => setTarget(v as TimelineEvent['target'])}
                        size={compact ? 'sm' : 'md'}
                        className="flex-1"
                    />
                </div>
            </div>

            {/* デバフ軽減不可(外周攻撃など) */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    data-testid="ignores-debuff-mit"
                    checked={ignoresDebuffMitigation}
                    onChange={(e) => setIgnoresDebuffMitigation(e.target.checked)}
                    className="w-4 h-4 accent-app-red cursor-pointer"
                />
                <span className="text-app-base text-app-text">{t('modal.ignores_debuff_mitigation')}</span>
                <span className="text-app-sm text-app-text-muted">{t('modal.ignores_debuff_mitigation_desc')}</span>
            </label>
        </>
    );
};
