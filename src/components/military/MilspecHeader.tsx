import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, LogIn, ChevronUp, ChevronDown } from 'lucide-react';
import { TutorialMenu } from '../tutorial/TutorialMenu';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { LoginModal } from '../LoginModal';
import { ShareButtons } from '../ShareButtons';
import { SyncButton } from '../SyncButton';
import { TransitionOverlayProvider } from '../ui/TransitionOverlay';
import { MilspecStyleToggle } from './MilspecStyleToggle';
import { useThemeStore } from '../../store/useThemeStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getContentById } from '../../data/contentRegistry';
import { getPhaseName } from '../../types';
import type { MilspecLayoutProps } from './MilspecLayout';

export type MilspecHeaderProps = Pick<
  MilspecLayoutProps,
  'theme' | 'onToggleTheme' | 'isHeaderCollapsed' | 'setIsHeaderCollapsed'
>;

/** SP1 では旧 ConsolidatedHeader から外した MilspecStyleToggle を DEV / ?milspec-preview=1 の
 *  ときだけ表示する(旧 ConsolidatedHeader.tsx の呼び出し側にあったゲートを再現。トグル本体は無変更)。 */
function useShowStyleToggle(): boolean {
  return (
    import.meta.env.DEV ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('milspec-preview') === '1')
  );
}

/** ヘッダー — ハードサーフェス パネルアセンブリ。
 *  正典: docs/.private/theme-refs/milspec-mockup.html DOM 1920-1979 / CSS .header 771- 。
 *  .hp-logo(ロゴプレート) / .seam-diag / .hp-title(遭遇名) / .hp-fill(銘板+ハザード+タービン) /
 *  .hp-share(共有) / .hp-tools(ツールボタン群) を1枚のパネル群として並べる。 */
export const MilspecHeader: React.FC<MilspecHeaderProps> = (props) => {
  const { theme, onToggleTheme, isHeaderCollapsed, setIsHeaderCollapsed } = props;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const showStyleToggle = useShowStyleToggle();

  const contentLanguage = useThemeStore((s) => s.contentLanguage);
  const currentPlan = usePlanStore((s) => s.plans.find((p) => p.id === s.currentPlanId));
  const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
  // 遭遇名: モックアップ(DOM 1940-1941)は jp/en を常に2行同時表示する固有の表示規約。
  // 既存の getCurrentContentLabel は contentLanguage 1言語分しか返さないため使えない(controller訂正#3)。
  const nameJa = contentDef ? getPhaseName(contentDef.name, 'ja') : '';
  const nameEn = contentDef ? getPhaseName(contentDef.name, 'en') : '';
  // ShareButtons へ渡す contentLabel は標準 ConsolidatedHeader と同じ現在言語ベースの表示名。
  const contentLabel = contentDef ? getPhaseName(contentDef.name, contentLanguage) : null;

  const user = useAuthStore((s) => s.user);
  const profileDisplayName = useAuthStore((s) => s.profileDisplayName);
  const profileAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);
  const [showLoginModal, setShowLoginModal] = React.useState(false);

  // タービン(遊び・データ非依存)。ローカル state のみ、ストアは一切触らない。
  const [spinning, setSpinning] = React.useState(false);

  return (
    // LanguageSwitcher / MilspecStyleToggle が内部で useTransitionOverlay() を無条件に呼ぶため、
    // MilspecHeader 自身を自己完結させる(controller確認済み: runTransition は document.body 操作 +
    // provider インスタンス毎の lockRef のみで、標準/軍事レイアウトは Layout.tsx の分岐で排他マウント
    // されるため App.tsx ルートの Provider とネストしても衝突しない)。
    <TransitionOverlayProvider>
    <header className="milspec-hdr milspec-chan" data-collapsed={isHeaderCollapsed ? '' : undefined}>
      {/* ロゴプレート — mockup .hp-logo(DOM 1922-1932)。ブランド視覚は MIL-SPEC 金属プレートに
          作り直し(標準 LoPoButton のカプセル+スキャンライン意匠は世界観が異なるため非採用)。
          遷移機能(navigate('/'))のみ標準と同一(ConsolidatedHeader.tsx 181行目相当)。 */}
      <div className="milspec-hp milspec-hp-logo">
        <span className="milspec-bolt tl" /><span className="milspec-bolt bl" />
        <span className="milspec-pl v" style={{ left: 'calc(50% - 2px)', top: 8, bottom: 8, opacity: 0.4 }} />
        <button
          type="button"
          className="milspec-logo-text milspec-disp"
          onClick={() => navigate('/')}
          aria-label={t('app.return_home')}
        >
          LoPo
        </button>
        <div className="milspec-logo-meta">
          <span className="l1">Combat Analysis System</span>
          <span className="l2">Loop Optimizer · Fire-Plan Unit</span>
          <span className="l3"><span>MDL. LP-2 / STD ISSUE</span><span className="d" /></span>
        </div>
        <span className="milspec-sc" style={{ bottom: 3, right: 8, opacity: 0.4 }}>DMG-REDUCTION PLANNING SET</span>
      </div>

      {/* 斜めシーム — mockup .seam-diag(DOM 1933) */}
      <div className="milspec-seam-diag"><span className="grn" /></div>

      {/* 遭遇名プレート — mockup .hp-title(DOM 1934-1943) */}
      <div className="milspec-hp milspec-hp-title recess">
        <span className="milspec-ao-mark" />
        <span className="tick" />
        <span className="milspec-pl h" style={{ left: 22, right: 14, top: 12, opacity: 0.45 }} />
        <span className="milspec-pl h" style={{ left: 22, right: 14, bottom: 12, opacity: 0.35 }} />
        <span className="milspec-sc br">TTL-01 · TARGET ENGAGEMENT</span>
        <div>
          <div className="jp">{nameJa}</div>
          <div className="en">{nameEn}</div>
        </div>
      </div>

      {/* 埋めプレート(銘板 + ハザード + タービン) — mockup .hp-fill(DOM 1944-1966) */}
      <div className="milspec-hp milspec-hp-fill">
        <span className="milspec-gl v" style={{ left: '52%' }} />
        <span className="milspec-hash" style={{ top: 8, left: 14, right: 'auto' }} />
        <span className="milspec-sc bl" style={{ left: 14 }}>A.R.D-07 · COOLANT</span>
        <span className="milspec-hazard" style={{ position: 'absolute', right: 6, top: 4, width: 64, height: 3, opacity: 0.5 }} />
        <span className="milspec-sc" style={{ top: 8, right: 6, textAlign: 'right' }}>⚠ ROTATING</span>
        <span className="milspec-nameplate" style={{ left: 150, top: '50%', transform: 'translateY(-50%)' }}>
          DEFENSIVE COOLDOWN PLANNING TERMINAL<br />PARTY SURVIVABILITY OPTIMIZER · MK.II
        </span>
        <span className="milspec-pl h" style={{ left: 150, right: 150, top: 14, opacity: 0.5 }} />
        <span className="milspec-pl h" style={{ left: 150, right: 150, bottom: 12, opacity: 0.4 }} />

        {/* タービン(遊び) — mockup #tb-switch-header。実用機能ゼロ・ローカル state のみ。 */}
        <div className="milspec-tb-cluster2">
          <button
            type="button"
            className="milspec-tb-switch"
            aria-label="タービン起動"
            title="タービン起動(遊び)"
            onClick={() => setSpinning((v) => !v)}
          >
            <span className={`milspec-lamp amber${spinning ? ' milspec-lit' : ''}`} />
            <span className="milspec-tb-switch-lbl">TRB</span>
          </button>
          <div className="milspec-tb-frame">
            <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
            <span className="milspec-bolt bl" /><span className="milspec-bolt br" />
            <span className="milspec-turbine" data-spin={spinning ? '' : undefined}>
              <span className="milspec-tb-vanes" />
              <span className="milspec-tb-hub" />
            </span>
          </div>
        </div>
      </div>

      {/* 共有プレート — mockup .hp-share(DOM 1967)。実際の共有起動は標準 ShareButtons を再利用
          (SP1 では標準テーマの共有モーダルが開く)。currentPlan が無ければ非表示(標準と同じ条件)。 */}
      <div className="milspec-hp milspec-hp-share">
        {currentPlan && <ShareButtons contentLabel={contentLabel} currentPlan={currentPlan} />}
        {!isHeaderCollapsed && <SyncButton size={14} />}
      </div>

      {/* ツールプレート群 — mockup .hp-tools(DOM 1968-1978) */}
      <div className="milspec-hp-tools">
        <TutorialMenu btnClassName="milspec-hud-btn" />

        <button type="button" className="milspec-hud-btn" onClick={onToggleTheme}>
          <span className="milspec-bolt tl" /><span className="milspec-bolt br" />
          <span className="milspec-lamp" />
          <span className="icf">
            {theme === 'dark' ? <Sun size={15} className="ico" /> : <Moon size={15} className="ico" />}
          </span>
          <span className="lbl">
            <span className="en">{t('app.fab_theme', { lng: 'en' })}</span>
            <span className="jp">{t('app.fab_theme', { lng: 'ja' })}</span>
          </span>
        </button>

        <span className="milspec-hud-btn-slot"><LanguageSwitcher /></span>

        <button type="button" className="milspec-hud-btn" onClick={() => setShowLoginModal(true)}>
          <span className="milspec-bolt tl" /><span className="milspec-bolt br" />
          <span className="milspec-lamp" />
          <span className="icf">
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt="" className="milspec-hud-avatar" />
            ) : user ? (
              <span className="milspec-hud-avatar milspec-hud-avatar-initial">
                {(profileDisplayName || 'U').charAt(0).toUpperCase()}
              </span>
            ) : (
              <LogIn size={15} className="ico" />
            )}
          </span>
          <span className="lbl">
            <span className="en">{t('app.sign_in', { lng: 'en' })}</span>
            <span className="jp">{t('app.sign_in', { lng: 'ja' })}</span>
          </span>
        </button>

        {showStyleToggle && (
          <span data-milspec-style-toggle className="milspec-hud-btn-slot">
            <MilspecStyleToggle compact className="milspec-hud-btn" />
          </span>
        )}
      </div>

      {/* ヘッダー折りたたみ — mockup 側には対応 DOM が無い(サイドバー上部の sb-collapse とは別物)。
          Task 5(Sidebar)未実装の SP1 時点ではヘッダー自身が担う。凝った意匠は不要(brief 指示通り)。 */}
      <button
        type="button"
        className="milspec-hdr-collapse"
        onClick={() => setIsHeaderCollapsed((v) => !v)}
        aria-label={t(isHeaderCollapsed ? 'sidebar.expand_header' : 'sidebar.collapse_header')}
        title={t(isHeaderCollapsed ? 'sidebar.expand_header' : 'sidebar.collapse_header')}
      >
        {isHeaderCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </header>
    </TransitionOverlayProvider>
  );
};
