import type React from 'react';
import type { PartyMember, TimelineEvent, AppliedMitigation, Phase } from '../../types';

export interface DamageInfo {
    unmitigated: number;
    mitigated: number;
    mitigationPercent: number;
    shieldTotal: number;
    isInvincible?: boolean;
    mitigationStates?: Record<string, { stacks?: number }>;
}

export interface TimelineRowProps {
    time: number;
    top: number;
    /** 行の高さ(px)= 1 段 × max(1, 攻撃数)。Timeline の rowLayout が決める */
    height: number;
    damages: (DamageInfo | null)[];
    events: TimelineEvent[];
    partyMembers: PartyMember[];
    /** 表示/非表示スイッチで隠したメンバーを除いた列描画専用リスト(2026-08-19)。「Job Columns
     * Cells」(1人1列の当たり判定セル)にのみ使う。partyMembers 自体は maxHp 参照等の計算に
     * 使われているため絞り込まない(全員分を維持)。 */
    visiblePartyMembers: PartyMember[];
    activeMitigations: AppliedMitigation[];
    onPhaseAdd: (time: number, e: React.MouseEvent) => void;
    onAddEventClick: (time: number, e: React.MouseEvent) => void;
    onEventClick: (event: TimelineEvent, e: React.MouseEvent) => void;
    onCellClick: (memberId: string, time: number, e: React.MouseEvent) => void;
    onMobileDamageClick?: (time: number, e: React.MouseEvent) => void;
    onLabelAdd?: (time: number, e: React.MouseEvent) => void;
    phaseColumnCollapsed?: boolean;
    labelColumnVisible?: boolean;
    hasPhases?: boolean;
    timelineSelectMode?: { phaseId: string; startTime: number } | null;
    labelSelectMode?: { labelId: string; startTime: number } | null;
    onTimelineSelect?: (time: number) => void;
    onTimelineSelectHover?: (time: number) => void;
    showRowBorders?: boolean;
    /** スプシ表示: メンバー id → 列数。指定時だけメンバー要素の幅を「列数 × --sheet-col-w」にする(未指定 = 従来)。
     * memo 比較は参照比較のため、呼び出し側は参照が安定した Map を渡すこと */
    sheetCols?: ReadonlyMap<string, number>;
    /** isTankSwap(挑発)の配置だけを抜き出した一覧。親(Timeline)が 1 回だけ計算し、挑発の増減がない限り同じ参照を渡す
     * (行がストアを直接購読すると、軽減を置く・消すたびに全行が描き直されるため) */
    swapMarkers: readonly AppliedMitigation[];
    /** フェーズ一覧(挑発の効く範囲の判定用)。親がストアから 1 回読んで渡す */
    phases: readonly Phase[];
    /** 行内の文言。親が t() を 1 回だけ呼んで渡す(行ごとに t() を呼ぶと全行ぶん重い)。言語が変わると参照も変わる */
    labels: RowLabels;
}

export interface RowLabels {
    orConnector: string;
    endPhase: string;
    addLabel: string;
    addEvent: string;
    mitigationSelect: string;
}

// 外枠(TimelineRow)が持つ位置情報。中身(TimelineRowContent)は高さ・位置を使わないため
// 受け取らない(行の高さ変化で位置だけズレた行は、外枠だけ描き直し中身は描き直さないため)。
export type TimelineRowContentProps = Omit<TimelineRowProps, 'top' | 'height'>;
