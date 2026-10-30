// スプシ表示の列見出し(下段)。RecastRow の代わりに #timeline-header-inner のメンバー領域へ置く。
// メンバーごとに「列数 × --sheet-col-w」の箱を 1 つ、その中に列(軽減技)ごとの静的アイコン。
// スクロールで変わる情報は無いので、描き直しは列定義が変わったときだけ。
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PartyMember } from '../../../types';
import { getPhaseName } from '../../../types';
import { useThemeStore } from '../../../store/useThemeStore';
import { Tooltip } from '../../ui/Tooltip';
import type { SheetColumn } from './sheetColumns';
import { sheetWidthExpr } from './sheetStyle';

export interface SheetColumnHeaderProps {
    members: readonly PartyMember[];
    sheetColumnMap: ReadonlyMap<string, SheetColumn[]>;
    /** 本文のメンバー列と x を揃えるための ref(JobPickerRow と同じ factory)。省略可 */
    getMemberRefCallback?: (id: string) => (el: HTMLDivElement | null) => void;
    /** 技アイコンを押したとき、その技の列を隠す(技 ID)。省略時は押しても何も起きない */
    onHideColumn?: (mitigationId: string) => void;
}

export const SheetColumnHeader: React.FC<SheetColumnHeaderProps> = ({ members, sheetColumnMap, getMemberRefCallback, onHideColumn }) => {
    const { t } = useTranslation();
    const contentLanguage = useThemeStore(s => s.contentLanguage);
    return (
        <>
            {members.map(member => {
                const cols = sheetColumnMap.get(member.id) ?? [];
                const w = sheetWidthExpr(cols.length);
                return (
                    <div
                        key={member.id}
                        ref={getMemberRefCallback ? getMemberRefCallback(member.id) : undefined}
                        data-sheet-member={member.id}
                        data-role={member.role}
                        className="flex flex-none h-full items-stretch border-r border-app-text/20 bg-app-surface2 box-border"
                        style={{ width: w, minWidth: w, maxWidth: w }}
                    >
                        {cols.map(({ mitigationId, def }) => {
                            const name = getPhaseName(def.name, contentLanguage);
                            return (
                                <div
                                    key={mitigationId}
                                    data-sheet-col={mitigationId}
                                    onClick={onHideColumn ? () => onHideColumn(mitigationId) : undefined}
                                    className={`w-[var(--sheet-col-w)] min-w-[var(--sheet-col-w)] h-full flex items-center justify-center${onHideColumn ? ' cursor-pointer hover:bg-app-surface2/60' : ''}`}
                                >
                                    <Tooltip
                                        content={t('timeline.sheet_col_tooltip', { name, recast: def.recast, duration: def.duration }) + (onHideColumn ? ` — ${t('timeline.sheet_col_tooltip_hide')}` : '')}
                                        position="bottom"
                                    >
                                        <img referrerPolicy="no-referrer"
                                            data-mit-icon=""
                                            src={def.icon}
                                            alt={name}
                                            draggable={false}
                                            className="bg-black/50 rounded border border-app-border object-contain block"
                                            style={{ width: 'var(--sheet-icon-px)', height: 'var(--sheet-icon-px)' }}
                                        />
                                    </Tooltip>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </>
    );
};
