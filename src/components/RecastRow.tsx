import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { AppliedMitigation, Mitigation, PartyMember } from '../types';
import { RecastIcon } from './RecastIcon';
import { getActiveRecasts, selectVisibleByLimit, calculateAngle, EXCLUDED_FROM_RECAST_ROW } from '../utils/recastRow';
import { getColumnCssVar } from '../utils/calculator';
import { Tooltip } from './ui/Tooltip';

export interface RecastRowHandle {
    /**
     * 現在時刻に応じて各アイコンの CSS variable と残秒テキストを直接更新する。
     * React の再レンダリングを起こさないことが本機能の核心:
     * スクロールハンドラが毎フレーム呼ぶため、 re-render は厳禁。
     */
    update: (currentTime: number) => void;
    /**
     * 全アイコンを非表示にする (ON/OFF トグル OFF 時用)。
     * セル自体は DOM に残るため罫線は維持される。
     */
    hideAll: () => void;
}

interface RecastRowProps {
    partyMembers: PartyMember[];
    placements: AppliedMitigation[];
    mitigationDefs: Mitigation[];
}

/** T (tank) / H (healer) の表示上限 (1 メンバーあたり同時可視数) */
const LIMIT_TH = 6;
/** DPS の表示上限 */
const LIMIT_DPS = 2;

// padding-left / padding-right は .recast-cell の CSS (src/index.css) で定義する。
// 計算式: padding-left = calc(--col-member-pad-x + 2px)
//   本文 MitigationItem の絶対配置 left = colStart + VISUAL_OFFSET(2)
//   colStart = JobPicker.offsetLeft + computed paddingLeft (= --col-member-pad-x = 2.9px)
//   なので RecastRow アイコンも同じ x にするには --col-member-pad-x + 2 が必要。
// happy-dom が calc() padding-left の inline style を保持しない問題を避けるため CSS 側で定義する。

/**
 * リキャスト専用行コンポーネント (セッション 18 ツールバー統合版)。
 *
 * 設計の核心:
 * - 各メンバーセル内に、 **「過去に一度でも置かれた mitigationId」 ぶんだけ RecastIcon を mount する** (= 静的 DOM)
 * - スクロール時の表示更新は `update(currentTime)` (`useImperativeHandle` で外部公開) が CSS variable を直接書き換える
 * - React の再レンダリングは placements / partyMembers / mitigationDefs が変わったときだけ
 *
 * これにより 60fps スクロールでも DOM の add/remove が起きず、 GPU 合成だけで完結する。
 *
 * セッション 18 案 C1 物理移動:
 * - 旧: scroll container の sticky 子として配置、 全列 (phase/label/time/mechanic/RAW/TAKEN/members) を内包
 * - 新: header (`headerRef`) の flex container 内の右端、 メンバー列だけを直接子として返す Fragment
 *   左側の列ヘッダー (敵の攻撃 / ラベル / Time / ...) は触らず、 そのまま残す
 */
export const RecastRow = forwardRef<RecastRowHandle, RecastRowProps>(
    ({ partyMembers, placements, mitigationDefs }, ref) => {
        // 各メンバーごとに 「過去に一度でも配置された mitigationId 一覧」 を構築。
        // これが各セルに mount するアイコンの集合 (静的)。
        const speciesByMember = useMemo(() => {
            const map = new Map<string, string[]>();
            for (const m of partyMembers) map.set(m.id, []);
            const seen = new Set<string>();
            for (const p of placements) {
                // 除外スキル (高頻度回し系) は DOM にも mount しない
                if (EXCLUDED_FROM_RECAST_ROW.has(p.mitigationId)) continue;
                const key = p.ownerId + '|' + p.mitigationId;
                if (seen.has(key)) continue;
                seen.add(key);
                const arr = map.get(p.ownerId);
                if (arr) arr.push(p.mitigationId);
            }
            return map;
        }, [partyMembers, placements]);

        // mitigationDefs を id → def の Map に変換し、 JSX renderer の O(N×M) ルックアップを排除。
        // 各セル × 各アイコンで .find() を回すと placements 数に応じて二乗で重くなるため、 Map.get() の O(1) を使う。
        const defByMitId = useMemo(() => {
            const m = new Map<string, Mitigation>();
            for (const d of mitigationDefs) m.set(d.id, d);
            return m;
        }, [mitigationDefs]);

        // (ownerId, mitigationId) → DOM 要素の参照。 update() で直接書き換える。
        const iconRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

        useImperativeHandle(ref, () => ({
            hideAll: () => {
                iconRefs.current.forEach((el) => {
                    if (el) el.style.setProperty('--cd-display', 'none');
                });
            },
            update: (currentTime: number) => {
                // owner 別に placements を分類 (毎回の O(N) ではあるが、 通常 N は数十程度)
                const placementsByOwner = new Map<string, AppliedMitigation[]>();
                for (const p of placements) {
                    let arr = placementsByOwner.get(p.ownerId);
                    if (!arr) {
                        arr = [];
                        placementsByOwner.set(p.ownerId, arr);
                    }
                    arr.push(p);
                }

                for (const member of partyMembers) {
                    const memberPlacements = placementsByOwner.get(member.id) ?? [];
                    const actives = getActiveRecasts(memberPlacements, mitigationDefs, currentTime);
                    const limit = member.role === 'dps' ? LIMIT_DPS : LIMIT_TH;
                    const visible = selectVisibleByLimit(actives, limit);

                    // mitigationId → 描画用エントリ (remaining / recast / order)
                    const visibleByMitId = new Map<
                        string,
                        { remaining: number; recast: number; order: number }
                    >();
                    visible.forEach((v, idx) => {
                        visibleByMitId.set(v.mitigationId, {
                            remaining: v.remaining,
                            recast: v.recast,
                            order: idx,
                        });
                    });

                    const species = speciesByMember.get(member.id) ?? [];
                    for (const mitId of species) {
                        const key = member.id + '|' + mitId;
                        const el = iconRefs.current.get(key);
                        if (!el) continue;
                        const entry = visibleByMitId.get(mitId);
                        if (!entry) {
                            // 上限外/期限切れ/未配置 → 非表示
                            el.style.setProperty('--cd-display', 'none');
                            continue;
                        }
                        el.style.setProperty('--cd-display', 'flex');
                        el.style.setProperty(
                            '--cd-angle',
                            calculateAngle(entry.remaining, entry.recast) + 'deg',
                        );
                        el.style.setProperty('--cd-order', String(entry.order));
                        const num = el.querySelector('.recast-num');
                        if (num) num.textContent = String(Math.ceil(entry.remaining));
                    }
                }
            },
        }), [partyMembers, placements, mitigationDefs, speciesByMember]);

        return (
            <>
                {partyMembers.map((member) => {
                    const species = speciesByMember.get(member.id) ?? [];
                    const widthExpr = getColumnCssVar(member.role);
                    return (
                        <div
                            key={member.id}
                            className="recast-cell"
                            data-member={member.id}
                            data-role={member.role}
                            style={{
                                width: widthExpr,
                                minWidth: widthExpr,
                                maxWidth: widthExpr,
                                // padding は .recast-cell CSS で定義 (calc 値を inline で渡すと
                                // happy-dom が値を保持しないため)
                            }}
                        >
                            {species.map((mitId) => {
                                const def = defByMitId.get(mitId);
                                if (!def) return null;
                                const key = member.id + '|' + mitId;
                                const tooltipLabel = def.name.ja || def.name.en || mitId;
                                return (
                                    <Tooltip key={key} content={tooltipLabel} wrapperClassName="recast-tooltip-wrap">
                                        <RecastIcon
                                            ref={(el) => {
                                                iconRefs.current.set(key, el);
                                            }}
                                            iconUrl={def.icon}
                                            alt={tooltipLabel}
                                        />
                                    </Tooltip>
                                );
                            })}
                        </div>
                    );
                })}
            </>
        );
    },
);
RecastRow.displayName = 'RecastRow';
