import React from 'react';
import clsx from 'clsx';
import type { AppliedMitigation, Mitigation } from '../types';
import { getPhaseName } from '../types';
import { useMitigations } from '../hooks/useSkillsData';

/** 軽減アイコン(1個)。MitiIcons(2行目)と、あふれた分を表示する1行目ダメージエリアの
 * 両方から同じ見た目で使う。 */
export const MitiIconImg: React.FC<{
    mit: AppliedMitigation;
    def: Mitigation;
    contentLanguage: string;
    isNotMine: boolean;
    isStartRow: boolean;
    /** 競合(同スキルCDかぶり)中: PC版のring-2より枠を細くして22pxアイコンでも潰れないようにする。 */
    isConflicting?: boolean;
}> = ({ mit, def, contentLanguage, isNotMine, isStartRow, isConflicting }) => (
    <img referrerPolicy="no-referrer"
        key={mit.id}
        src={def.icon}
        alt={def.name ? getPhaseName(def.name, contentLanguage) : ''}
        data-myjob-dim={isNotMine ? 'gray' : undefined}
        className={clsx(
            'w-[22px] h-[22px] object-cover rounded-md',
            isStartRow ? 'opacity-90' : 'opacity-[0.55]',
            isConflicting && 'animate-conflict-pulse ring-1 ring-app-amber',
        )}
    />
);

/** 軽減スキルアイコン列（専用行・フル幅・18px・使用者ごとにグルーピング表示） */
export const MitiIcons: React.FC<{
    visibleGroups: { key: string; items: AppliedMitigation[] }[];
    hiddenCount: number;
    contentLanguage: string;
    myMemberId: string | null;
    /** この行の時刻。mit.timeと一致する行(=設置した瞬間)だけ通常の濃さにし、それ以外
     * (効果継続中の行)はエフェクト棒と同じ濃さ(0.55)まで薄くして「どこで使ったか」を
     * 目立たせる(2026-08-13ユーザー提案)。 */
    time: number;
    /** 「+N」タップ時のコールバック(1行目ダメージ表記エリアへのあふれ表示ON/OFFを親が管理)。
     * 2026-08-13ユーザー確認=「+Nを押した時だけそうなる」= 常時表示ではなくタップ式に確定。 */
    onOverflowTap: () => void;
    conflictingIds?: Set<string>;
    /** 隠れている(あふれた)分の中に競合中インスタンスが含まれるか。含まれる場合は
     * 「+N」バッジ自体も光らせ、開かないと気づけない競合を示唆する(2026-08-14ユーザー確認)。 */
    hiddenHasConflict?: boolean;
}> = ({ visibleGroups, hiddenCount, contentLanguage, myMemberId, time, onOverflowTap, conflictingIds, hiddenHasConflict }) => {
    const MITIGATIONS = useMitigations();
    if (visibleGroups.length === 0 && hiddenCount === 0) return null;

    return (
        // 同じ人のアイコン同士はほぼ密着(gap-px=1px)、人が変わるところだけ gap-1.5(6px)空ける。
        // 「ぴったりくっつく」ためには同グループ内の隙間をほぼ0にする必要があった。
        // mix-blend-plus-lighter: エフェクト棒(奥に描画済み)とのクロスフェード時、不透明度の
        // 単純な上げ下げだと切り替わりの中間で両方が重なって濁って見える問題があるため、
        // 加算合成にして常に綺麗に混ざるようにする(静止時は背景がほぼ黒なので見た目は変わらない)。
        // flex-wrap は使わない(2026-08-13ユーザー要望=行の高さが固定コマのため2段折り返しは
        // 絶対にしない。あふれた分は「+N」タップで1行目のダメージ表記エリアに表示する。
        // overflow-hidden は maxIcons 見積もりのズレに対する保険)。
        <div className="mobile-miti-icons flex items-center justify-end gap-1.5 flex-nowrap overflow-hidden mix-blend-plus-lighter">
            {visibleGroups.map(group => (
                <div key={group.key} className="flex items-center gap-px">
                    {group.items.map(mit => {
                        const def = MITIGATIONS.find(m => m.id === mit.mitigationId);
                        if (!def) return null;
                        // 薄暗くは親 .timeline-scroll-container[data-myjob-highlight] + CSS が担当（myJobHighlight 非購読）。
                        const isNotMine = !!myMemberId && mit.ownerId !== myMemberId;
                        // 0.55 = エフェクト棒(MOBILE_EFFECT_BAR_MAX_OPACITY)と同じ濃さ。
                        const isStartRow = mit.time === time;
                        return (
                            <MitiIconImg key={mit.id} mit={mit} def={def} contentLanguage={contentLanguage} isNotMine={isNotMine} isStartRow={isStartRow} isConflicting={conflictingIds?.has(mit.id)} />
                        );
                    })}
                </div>
            ))}
            {hiddenCount > 0 && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOverflowTap(); }}
                    className={clsx(
                        "flex-shrink-0 w-[22px] h-[22px] rounded-md bg-app-text/15 text-app-text text-app-base font-black flex items-center justify-center",
                        hiddenHasConflict && "animate-conflict-pulse ring-1 ring-app-amber",
                    )}
                >
                    +{hiddenCount}
                </button>
            )}
        </div>
    );
};
