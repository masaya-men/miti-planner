import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImportMenu } from '../../ImportMenu';
import { HeaderToolsMenu } from '../../HeaderToolsMenu';
import { PartyVisibilityMenu } from '../../PartyVisibilityMenu';
import { PartyStatusPopover } from '../../PartyStatusPopover';
import { MitigationSheet } from '../../MitigationSheet';
import { MilspecKey, MilspecKeyCap, hitPolygon } from '../MilspecKey';
import { MilspecStencil } from '../MilspecDecor';
import { MsIcon } from '../milspecIcons';
import { bbox } from '../armor/geom';
import type { CapSpec } from '../armor/types';
import { headerLayout } from '../headerGeometry';
import { MilspecCrt } from './MilspecCrt';
import { usePlanStore } from '../../../store/usePlanStore';
import { useTutorialStore } from '../../../store/useTutorialStore';
import { useMitigationStore } from '../../../store/useMitigationStore';
import './milspecH4.css';

// H5(見本 js:904-927): PARTY OPS(パーティ編成・ステータス設定)・取り込み / その他・CRT・主流・表示メンバー・SORT。
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
  const party = row('party'), io = row('io'), main = row('mainstream'), gear = row('gear'), sort = row('sort');
  const d = decor.h5;

  const currentPlan = usePlanStore((s) => s.plans.find((p) => p.id === s.currentPlanId));
  const [mitiOpen, setMitiOpen] = React.useState(false);
  const hasHidden = useMitigationStore((s) => s.hiddenPartyMemberIds.length > 0);

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
  const mainName = t('popular.title');
  const visName = t('app.fab_party_visibility');
  const sorts = [['light_party', t('ui.sort_light_party')], ['role', t('ui.sort_role')]] as const;

  return (
    <>
      <MilspecStencil en="PARTY OPS" hi style={{ left: d.party.x, top: d.party.y }} />
      <MilspecStencil en="SORT" hi style={{ left: d.sort.x, top: d.sort.y }} />

      {/* PARTY OPS: パーティ編成 / ステータス設定 */}
      <div className="milspec-h4-kc" role="group" aria-label="PARTY OPS" style={{ left: party.x, top: party.y }}>
        <MilspecKey cap={party.caps[0]} style={capPos(party.caps[0])} label={<>{MsIcon.party()}<b>{compName}</b></>} aria-label={compName} onClick={openPartySettings} />
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

      {/* 主流: みんなの軽減表 */}
      <div className="milspec-h4-kc" style={{ left: main.x, top: main.y }}>
        <MilspecKey cap={main.caps[0]} style={capPos(main.caps[0])} label={<b>{mainName}</b>} aria-label={mainName} onClick={() => setMitiOpen(true)} />
      </div>

      {/* 表示メンバー(非表示の人がいれば緑のランプ) */}
      <div className="milspec-h4-kc" style={{ left: gear.x, top: gear.y }}>
        <div className="milspec-h4-slot" style={slotStyle(gear.caps[0])}>
          <PartyVisibilityMenu btnClassName="milspec-keybtn" btnActiveClassName="milspec-keybtn" sortOrder={partySortOrder} readOnly={false}>
            <MilspecKeyCap cap={gear.caps[0]} className={iconCap} label={MsIcon.gear()} active={hasHidden} />
            <span className="milspec-sr">{visName}</span>
          </PartyVisibilityMenu>
        </div>
      </div>

      {/* SORT: 連動キー 2 つ(押すと沈んだまま止まり、もう片方を押すと弾かれて戻る) */}
      <div className="milspec-h4-kc" role="group" aria-label={t('ui.sort')} style={{ left: sort.x, top: sort.y }}>
        {sorts.map(([value, name], i) => (
          <MilspecKey key={value} cap={sort.caps[i]} style={capPos(sort.caps[i])} latch pressed={partySortOrder === value}
            label={<b>{name}</b>} aria-label={name} onClick={() => setPartySortOrder(value)} />
        ))}
      </div>

      <MitigationSheet isOpen={mitiOpen} onClose={() => setMitiOpen(false)} currentContentId={currentPlan?.contentId ?? null} />
      {/* ステータス設定の開閉先(document.body へ portal される) */}
      <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />
    </>
  );
}
