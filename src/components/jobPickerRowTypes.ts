// JobPickerRow の props 型。軍事版の差込口(military/table/MilspecJackRow)も同じ型を使うため分けている
// (JobPickerRow.tsx に置くと JobPickerRow ⇄ MilspecJackRow の型だけの循環 import になる)。
import type React from 'react';
import type { TFunction } from 'i18next';
import type { Job, PartyMember } from '../types';
import type { SheetColumn } from './timeline/sheet/sheetColumns';

export interface JobPickerRowProps {
    partyMembers: PartyMember[];
    partySortOrder: 'role' | 'light_party';
    /** jobId → icon url の解決関数 (Timeline.tsx 内 getJobIcon と整合) */
    getJobIcon: (jobId: string | null) => string | null;
    /** JOBS (現状未使用だが将来の拡張用に保持) */
    jobs: Job[];
    /** メンバーアイコンクリック時 (= JobPicker モーダルを開く) */
    handleJobIconClick: (memberId: string, e: React.MouseEvent) => void;
    /** メンバーセルの ref を取得する callback factory */
    getMemberRefCallback: (id: string) => (el: HTMLDivElement | null) => void;
    t: TFunction;
    /** 'socket' = 軍事テーマの差込口(中身だけ差し替え。外側 div・ref・data 属性・クリックは同じ)。未指定 = 標準 */
    variant?: 'socket';
    /** スプシ表示: メンバー id → 列数。指定時は幅を「列数 × --sheet-col-w」にし、3 列以上ならジョブ名と位置も出す。未指定 = 従来 */
    sheetCols?: ReadonlyMap<string, number>;
    /** スプシ表示: メンバー id → 列見出しで隠した技の列。1 つ以上あるメンバーのジョブ欄に「+(数)」を出す */
    sheetHidden?: ReadonlyMap<string, SheetColumn[]>;
    /** 「+(数)」を押したとき(小窓を開く) */
    onOpenSheetHidden?: (memberId: string, e: React.MouseEvent) => void;
}
