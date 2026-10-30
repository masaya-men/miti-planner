import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImportMenu } from '../../ImportMenu';
import { HeaderToolsMenu } from '../../HeaderToolsMenu';
import { PartyStatusPopover } from '../../PartyStatusPopover';
import { MilspecKey, MilspecKeyCap } from '../MilspecKey';
import { hitPolygon } from '../milspecKeyGeometry';
import { MilspecStencil } from '../MilspecDecor';
import { MsIcon } from '../milspecIcons';
import { bbox } from '../armor/geom';
import type { CapSpec } from '../armor/types';
import { headerLayout } from '../headerGeometry';
import { MilspecCrt } from './MilspecCrt';
import { useTutorialStore } from '../../../store/useTutorialStore';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { useThemeStore, useEffectiveTimelineView } from '../../../store/useThemeStore';
import { useRenderPendingStore } from '../../../store/useRenderPendingStore';
import { useJobs } from '../../../hooks/useSkillsData';
import { useCanPreviewWip } from '../../../hooks/useCanPreviewWip';
import { PARTY_MEMBER_IDS } from '../../../constants/party';

// H5(見本 js:904-927): PARTY OPS(パーティ編成・ステータス設定)・取り込み / その他・CRT・表示メンバー(ALL + 8 人)・表の見た目(ふつう / スプシ)・SORT。
// 親は「ヘッダー区画」(position:absolute の座標系)。座標は headerLayout の keyRows と decor.h5。
// 機能の出所は旧 MilspecToolbar(ConsolidatedHeader の Layer B)と同じ。

export interface PartyOpsProps {
  /** ヘッダー区画の実幅(1189 未満は 1189 として扱う) */
  MW: number;
  partySortOrder: 'light_party' | 'role';
  setPartySortOrder: (o: 'light_party' | 'role') => void;
  onAutoPlan: () => void;
  onImportLogs: () => void;
  statusOpen: boolean;
  setStatusOpen: (open: boolean) => void;
}

/** キーの形の左上(bbox)。列の箱は幅高さ 0 で、キーは bbox の位置に置く */
const capPos = (cap: CapSpec): React.CSSProperties => {
  const b = bbox(cap.pts);
  return { left: b.x, top: b.y };
};
/** 標準部品のボタン用: slot が幅高さと当たり判定(clip-path)を変数で渡す */
const slotStyle = (cap: CapSpec): React.CSSProperties => {
  const b = bbox(cap.pts);
  return { left: b.x, top: b.y, ['--kw' as string]: `${b.w}px`, ['--kh' as string]: `${b.h}px`, ['--kclip' as string]: hitPolygon(cap) } as React.CSSProperties;
};

export function PartyOps({ MW, partySortOrder, setPartySortOrder, onAutoPlan, onImportLogs, statusOpen, setStatusOpen }: PartyOpsProps) {
  const { t } = useTranslation();
  const { keyRows, decor } = React.useMemo(() => headerLayout(MW), [MW]);
  const row = (id: string) => keyRows.find((r) => r.id === id)!;
  const party = row('party'), io = row('io'), members = row('members'), view = row('view'), sort = row('sort');
  const d = decor.h5;

  const partyMembers = useMitigationStore((s) => s.partyMembers);
  const hiddenIds = useMitigationStore((s) => s.hiddenPartyMemberIds);
  const toggleHiddenPartyMember = useMitigationStore((s) => s.toggleHiddenPartyMember);
  const setHiddenPartyMemberIds = useMitigationStore((s) => s.setHiddenPartyMemberIds);
  const jobs = useJobs();
  const timelineView = useEffectiveTimelineView(); // 点灯は実効値で(チュートリアル中などは 'lanes')
  const setTimelineView = useThemeStore((s) => s.setTimelineView);
  const canPreviewWip = useCanPreviewWip();
  // 表示メンバーの並びは「並び替え」に関係なく固定(MT ST H1 H2 D1〜D4)
  const memberIds = PARTY_MEMBER_IDS;

  // 全体の再描画が重いので、先にインジケーターを 1 フレーム描かせてから本体を実行する(PartyVisibilityMenu と同じ手順)
  const deferHeavy = (fn: () => void) => {
    useRenderPendingStore.getState().show();
    requestAnimationFrame(() => { requestAnimationFrame(fn); });
  };

  // パーティ編成: ConsolidatedHeader の Party Comp ボタンと同一手順
  const openPartySettings = () => {
    window.dispatchEvent(new CustomEvent('timeline:party-settings', { detail: { open: true } }));
    useTutorialStore.getState().completeEvent('party:opened');
  };

  const iconCap = 'milspec-key-ic';
  const compName = t('party.comp_short');
  const statName = t('settings.config_short');
  const importName = t('nav.import');
  const moreName = t('ui.more');
  const sorts = [['light_party', t('ui.sort_light_party')], ['role', t('ui.sort_role')]] as const;
  const views = [['lanes', t('ui.table_view_lanes')], ['sheet', t('ui.table_view_sheet')]] as const;

  return (
    <>
      <MilspecStencil en="PARTY OPS" hi style={{ left: d.party.x, top: d.party.y }} />
      {/* 見出しは他の組と同じく「キーの上・左寄せ」(横幅を取らない)。x はキーの左端に揃える */}
      <MilspecStencil en="SORT" sub={t('ui.sort')} hi style={{ left: sort.x, top: d.members.y }} />
      <MilspecStencil en="MEMBERS" sub={t('ui.party_visibility_members')} hi style={{ left: d.members.x, top: d.members.y }} />
      {canPreviewWip && <MilspecStencil en="VIEW" sub={t('ui.table_view')} hi style={{ left: d.view.x, top: d.view.y }} />}

      {/* PARTY OPS: パーティ編成 / ステータス設定 */}
      <div className="milspec-h4-kc" role="group" aria-label="PARTY OPS" style={{ left: party.x, top: party.y }}>
        <MilspecKey cap={party.caps[0]} style={capPos(party.caps[0])} label={<>{MsIcon.party()}<b>{compName}</b></>} aria-label={compName} data-tutorial="party-comp" onClick={openPartySettings} />
        <MilspecKey cap={party.caps[1]} style={capPos(party.caps[1])} label={<>{MsIcon.stat()}<b>{statName}</b></>} aria-label={statName}
          pressed={statusOpen} onClick={() => setStatusOpen(!statusOpen)} />
      </div>

      {/* 取り込み / その他(標準のメニューをそのまま使い、ボタンの見た目だけキーにする) */}
      <div className="milspec-h4-kc" role="group" aria-label={`${importName} / ${moreName}`} style={{ left: io.x, top: io.y }}>
        <div className="milspec-h4-slot" style={slotStyle(io.caps[0])}>
          <ImportMenu btnClassName="milspec-keybtn" onImportLogs={onImportLogs} readOnly={false}>
            <MilspecKeyCap cap={io.caps[0]} className={iconCap} label={MsIcon.imp()} />
            <span className="milspec-sr">{importName}</span>
          </ImportMenu>
        </div>
        <div className="milspec-h4-slot" style={slotStyle(io.caps[1])}>
          <HeaderToolsMenu btnClassName="milspec-keybtn" onAutoPlan={onAutoPlan} readOnly={false}>
            <MilspecKeyCap cap={io.caps[1]} className={iconCap} label={MsIcon.more()} />
            <span className="milspec-sr">{moreName}</span>
          </HeaderToolsMenu>
        </div>
      </div>

      {/* CRT: 攻略の軌跡(親の 100% を埋めるので、見本の箱に入れる) */}
      <div style={{ position: 'absolute', left: d.crt.x, top: d.crt.y, width: d.crt.w, height: d.crt.h }}>
        <MilspecCrt />
      </div>

      {/* 表示メンバー: ALL + 8 人(沈んで下縁が緑 = 表示中、浮いて灰色 = 非表示)。ストアは見た目だけの絞り込み */}
      <div className="milspec-h4-kc" role="group" aria-label={t('ui.party_visibility_members')} style={{ left: members.x, top: members.y }}>
        <MilspecKey cap={members.caps[0]} style={capPos(members.caps[0])} latch pressed={hiddenIds.length === 0}
          label={<b>{t('ui.party_visibility_all')}</b>} onClick={() => { if (hiddenIds.length > 0) deferHeavy(() => setHiddenPartyMemberIds([])); }} />
        {memberIds.map((id, i) => {
          const hidden = hiddenIds.includes(id);
          const jobId = partyMembers.find((m) => m.id === id)?.jobId;
          const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;
          return (
            <MilspecKey key={id} cap={members.caps[i + 1]} style={capPos(members.caps[i + 1])} latch pressed={!hidden} data-member-toggle={id}
              label={job?.icon ? <img referrerPolicy="no-referrer" className="milspec-key-av" src={job.icon} alt="" /> : <b>{id}</b>}
              aria-label={t('ui.party_visibility_toggle_tooltip', { id, action: hidden ? t('ui.party_visibility_show') : t('ui.party_visibility_hide') })}
              onClick={() => deferHeavy(() => toggleHiddenPartyMember(id))} />
          );
        })}
      </div>

      {/* 表の見た目: ふつう / スプシ(SORT と同じ連動キー)。作り直し中(WIP)は出さない */}
      {canPreviewWip && (
        <div className="milspec-h4-kc" role="group" aria-label={t('ui.table_view')} style={{ left: view.x, top: view.y }}>
          {views.map(([value, name], i) => (
            <MilspecKey key={value} cap={view.caps[i]} style={capPos(view.caps[i])} latch pressed={timelineView === value}
              label={<b>{name}</b>} aria-label={name} onClick={() => setTimelineView(timelineView === 'sheet' ? 'lanes' : 'sheet')} />
          ))}
        </div>
      )}

      {/* SORT: 連動キー 2 つ(押すと沈んだまま止まり、もう片方を押すと弾かれて戻る) */}
      <div className="milspec-h4-kc" role="group" aria-label={t('ui.sort')} style={{ left: sort.x, top: sort.y }}>
        {sorts.map(([value, name], i) => (
          <MilspecKey key={value} cap={sort.caps[i]} style={capPos(sort.caps[i])} latch pressed={partySortOrder === value}
            label={<b>{name}</b>} aria-label={name} onClick={() => setPartySortOrder(partySortOrder === 'role' ? 'light_party' : 'role')} />
        ))}
      </div>

      {/* ステータス設定の開閉先(document.body へ portal される) */}
      <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />
    </>
  );
}
