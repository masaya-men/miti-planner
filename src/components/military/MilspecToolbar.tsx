import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../../store/usePlanStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { MitigationSheet } from '../MitigationSheet';
import { ImportMenu } from '../ImportMenu';
import { HeaderToolsMenu } from '../HeaderToolsMenu';
import { PartyVisibilityMenu } from '../PartyVisibilityMenu';
import { PartyStatusPopover } from '../PartyStatusPopover';
import { MilspecTileInner } from './MilspecTileInner';
import type { MilspecLayoutProps } from './MilspecLayout';
// 副作用 import: i18next の初期化(MilspecSidebar.tsx と同じ理由 — useTranslation() は
// initReactI18next 済みインスタンスが無いとキー文字列をそのまま返す/依存先が未初期化例外を出す)。
// 実アプリでは main.tsx 起動時に既に初期化済みのため重複実行の影響は無い(単体テストの安全網)。
import '../../i18n';

export type MilspecToolbarProps = Pick<
  MilspecLayoutProps,
  'partySortOrder' | 'setPartySortOrder' | 'onAutoPlan' | 'onImportLogs' | 'statusOpen' | 'setStatusOpen'
>;

/**
 * ツールバー — CREW(パーティ編成/設定/ログ取込/その他) / VIEW(みんなの軽減表/表示メンバー) / SORT(ライト/ロール)。
 * 正典: docs/.private/theme-refs/milspec-mockup.html DOM 2063-2086(<div class="toolbar">) /
 *       CSS .toolbar 891- ・.tb-cluster/.tool-btn/.tool-spacer/.tool-seg。
 * 配線出典: ConsolidatedHeader.tsx Layer B(365-469 相当・controller訂正によりgrepで確認)。
 *
 * Party/Config/Popular(みんなの軽減表) は自前ボタンとしてモック DOM そのまま
 * (bolt tl/br + lamp + icf アイコン + lbl en/jp) を再現する。
 * Import(ImportMenu)/More(HeaderToolsMenu)/View(PartyVisibilityMenu) は標準コンポーネント自身が
 * <button> を保有しラベル span を追加できないため、btnClassName 経由でのみ外観を寄せる
 * (MilspecHeader.tsx の LanguageSwitcher ラップと同じ判断・全コンポーネント本体は無変更)。
 */
export const MilspecToolbar: React.FC<MilspecToolbarProps> = (props) => {
  const { partySortOrder, setPartySortOrder, onAutoPlan, onImportLogs, statusOpen, setStatusOpen } = props;
  const { t } = useTranslation();

  const currentPlan = usePlanStore((s) => s.plans.find((p) => p.id === s.currentPlanId));
  const currentContentId = currentPlan?.contentId ?? null;

  const [isMitiSheetOpen, setIsMitiSheetOpen] = React.useState(false);

  // パーティ編成: ConsolidatedHeader.tsx の Party Comp ボタンと同一手順。
  const openPartySettings = () => {
    window.dispatchEvent(new CustomEvent('timeline:party-settings', { detail: { open: true } }));
    useTutorialStore.getState().completeEvent('party:opened');
  };

  return (
    <div className="milspec-tb">
      <span className="milspec-tb-decal" aria-hidden="true" />

      {/* CREW — mockup 最初の .tb-cluster(DOM 2066-2071) */}
      <div className="milspec-tb-cluster">
        <span className="milspec-sc tl">CREW</span>

        <button type="button" className="milspec-tool-btn" onClick={openPartySettings}>
          <span className="milspec-bolt tl" /><span className="milspec-bolt br" />
          <span className="milspec-lamp" />
          <span className="icf">
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" />
              <path d="M4 19c0-3 2.5-5 5-5s5 2 5 5M14 19c0-2 1-3.5 3-3.5s3 1.5 3 3.5" />
            </svg>
          </span>
          <span className="lbl">
            <span className="en">{t('party.comp_short', { lng: 'en' })}</span>
            <span className="jp">{t('party.comp_short', { lng: 'ja' })}</span>
          </span>
        </button>

        <button
          type="button"
          className={`milspec-tool-btn${statusOpen ? ' active' : ''}`}
          onClick={() => setStatusOpen(!statusOpen)}
        >
          <span className="milspec-bolt tl" /><span className="milspec-bolt br" />
          <span className={`milspec-lamp${statusOpen ? ' lit cyan' : ''}`} />
          <span className="icf">
            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 17l5-6 4 3 5-8 4 5" /><path d="M3 21h18" />
            </svg>
          </span>
          <span className="lbl">
            <span className="en">{t('settings.config_short', { lng: 'en' })}</span>
            <span className="jp">{t('settings.config_short', { lng: 'ja' })}</span>
          </span>
        </button>

        <ImportMenu btnClassName="milspec-tool-btn" onImportLogs={onImportLogs} readOnly={false}>
          <MilspecTileInner
            en={t('nav.import', { lng: 'en' })}
            jp={t('nav.import', { lng: 'ja' })}
            icon={
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
              </svg>
            }
          />
        </ImportMenu>
        <HeaderToolsMenu btnClassName="milspec-tool-btn" onAutoPlan={onAutoPlan} readOnly={false}>
          <MilspecTileInner
            en={t('ui.more', { lng: 'en' })}
            jp={t('ui.more', { lng: 'ja' })}
            icon={
              <svg className="ico" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            }
          />
        </HeaderToolsMenu>
      </div>

      {/* 中央: 装飾テキスト(mockup .tool-spacer 2072-2075)。軍事英字の装飾文言は翻訳対象外(constraint 8)。 */}
      <div className="milspec-tb-spacer">
        <span className="milspec-sc" style={{ top: 8, left: '6%' }}>DEFENSIVE COOLDOWN SCHEDULING SUITE</span>
        <span className="milspec-sc" style={{ bottom: 8, right: '6%', textAlign: 'right' }}>DMG-REDUCTION FIRE PLAN · REV.C</span>
      </div>

      {/* VIEW — mockup 2つめの .tb-cluster(DOM 2077-2080) */}
      <div className="milspec-tb-cluster">
        <span className="milspec-sc tl">VIEW</span>

        <button type="button" className="milspec-tool-btn" onClick={() => setIsMitiSheetOpen(true)}>
          {/* mockup は短い「Popular / みんなの軽減表」。popular.open_popular は宣伝文言なので
              クリーンな popular.title を使う(en: "Popular Sheets" / ja: "みんなの軽減表")。 */}
          <MilspecTileInner
            en={t('popular.title', { lng: 'en' })}
            jp={t('popular.title', { lng: 'ja' })}
            icon={
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 6h16M4 12h16M4 18h10" /><circle cx="18" cy="18" r="3" />
              </svg>
            }
          />
        </button>

        <PartyVisibilityMenu
          btnClassName="milspec-tool-btn"
          btnActiveClassName="milspec-tool-btn active"
          sortOrder={partySortOrder}
          readOnly={false}
        >
          <MilspecTileInner
            en={t('app.fab_party_visibility', { lng: 'en' })}
            jp={t('app.fab_party_visibility', { lng: 'ja' })}
            icon={
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="3" /><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
              </svg>
            }
          />
        </PartyVisibilityMenu>
      </div>

      {/* SORT — mockup .tb-cluster.tool-seg(DOM 2081-2085)。ランプ + EN/JP 2 段の自前タイル 2 つ
          (SegmentButton だと単一 label 文字列で bilingual にできないため・active はシアンランプ点灯)。 */}
      <div className="milspec-tb-cluster milspec-tb-sort">
        <span className="milspec-sc tl">SORT</span>
        {([
          ['light_party', 'ui.sort_light_party'],
          ['role', 'ui.sort_role'],
        ] as const).map(([value, key]) => (
          <button
            key={value}
            type="button"
            className={`milspec-tool-btn milspec-sort-btn${partySortOrder === value ? ' active' : ''}`}
            onClick={() => setPartySortOrder(value)}
          >
            <span className={`milspec-lamp cyan${partySortOrder === value ? ' milspec-lit' : ''}`} />
            <span className="lbl">
              <span className="en">{t(key, { lng: 'en' })}</span>
              <span className="jp">{t(key, { lng: 'ja' })}</span>
            </span>
          </button>
        ))}
      </div>

      <MitigationSheet
        isOpen={isMitiSheetOpen}
        onClose={() => setIsMitiSheetOpen(false)}
        currentContentId={currentContentId}
      />

      {/* 設定(Config)ボタンの開閉対象。Fix round 1: トリガーだけでなく開閉先の UI も完成させる
          (Popular ボタンの isMitiSheetOpen + MitigationSheet と同じ「trigger + content」判断基準)。
          createPortal で document.body 直下へレンダリングされるため、JSX 上の位置は表示に影響しない。 */}
      <PartyStatusPopover isOpen={statusOpen} onClose={() => setStatusOpen(false)} />
    </div>
  );
};
