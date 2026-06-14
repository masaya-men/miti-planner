import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { Tooltip } from './ui/Tooltip';

const ICON_BY_TYPE: Partial<Record<NonNullable<TimelineEvent['damageType']>, { src: string; altKey: string }>> = {
  magical: { src: '/icons/type_magic.png', altKey: 'modal.magical' },
  physical: { src: '/icons/type_phys.png', altKey: 'modal.physical' },
  unavoidable: { src: '/icons/type_dark.png', altKey: 'modal.unique' },
};

/** 種別アイコン(magical/physical/unavoidable)。ignoresDebuffMitigation=true のとき
 *  淡い赤背景+赤リングの小箱で囲み「デバフ軽減無効」を示す。PC/モバイル共有。 */
export const DamageTypeIcon: React.FC<{
  damageType: TimelineEvent['damageType'];
  ignoresDebuffMitigation?: boolean;
  size?: string;       // 例 "w-3 h-3"(PC) / "w-4 h-4"(モバイル)
  className?: string;
}> = ({ damageType, ignoresDebuffMitigation, size = 'w-3 h-3', className }) => {
  const { t } = useTranslation();
  const def = damageType ? ICON_BY_TYPE[damageType] : undefined;
  if (!def) return null;

  const img = <img src={def.src} className={clsx(size, 'object-contain opacity-90')} alt={t(def.altKey)} />;

  if (!ignoresDebuffMitigation) {
    return <span className={clsx('flex-shrink-0 inline-flex', className)}>{img}</span>;
  }

  return (
    <Tooltip content={t('timeline.debuff_immune_hint')} position="top">
      <span className={clsx('flex-shrink-0 inline-flex items-center justify-center rounded-sm p-px bg-red-500/10 ring-1 ring-red-500/40', className)}>
        {img}
      </span>
    </Tooltip>
  );
};
