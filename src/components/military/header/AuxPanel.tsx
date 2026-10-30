import React from 'react';
import { useTranslation } from 'react-i18next';
import { TutorialMenu } from '../../tutorial/TutorialMenu';
import { LanguageSwitcher } from '../../LanguageSwitcher';
import { LoginModal } from '../../LoginModal';
import { ParticipantDots } from '../../collab/ParticipantDots';
import { PresenceControls } from '../../collab/PresenceControls';
import { showToast } from '../../toastBus';
import { useShareFlow } from '../../collab/useShareFlow';
import { MilspecKey, MilspecKeyCap } from '../MilspecKey';
import { hitPolygon } from '../milspecKeyGeometry';
import { MilspecLed, MilspecMark, MilspecStencil } from '../MilspecDecor';
import { MsIcon } from '../milspecIcons';
import { bbox } from '../armor/geom';
import type { CapSpec } from '../armor/types';
import { headerLayout } from '../headerGeometry';
import { ThemeRocker } from './ThemeRocker';
import { ModeLever } from './ModeLever';
import { useThemeStore } from '../../../store/useThemeStore';
import { usePlanStore } from '../../../store/usePlanStore';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { getContentById } from '../../../data/contentRegistry';
import { getPhaseName } from '../../../types';
import './AuxPanel.css';

// H4(見本 js:890-903): AUX(チュートリアル)・DSP(昼夜ロッカー)・MODE(T 字レバー)・COM(共有 / 同期 / 言語 / ログイン)。
// 親は「ヘッダー区画」(position:absolute の座標系)。座標は headerLayout の keyRows と decor.h4。
// 標準の LanguageSwitcher は useTransitionOverlay を使うため、TransitionOverlayProvider の内側に置くこと。

export interface AuxPanelProps {
  /** ヘッダー区画の実幅(layoutMW 済みでなくてもよい。1189 未満は 1189 として扱う) */
  MW: number;
  theme: 'dark' | 'light';
  /** 昼夜切替。setTheme を直接呼ぶ関数(ロッカーが走査線ワイプのあとで呼ぶ) */
  onToggleTheme: () => void;
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

export function AuxPanel({ MW, theme, onToggleTheme }: AuxPanelProps) {
  const { t } = useTranslation();
  const { keyRows, decor } = React.useMemo(() => headerLayout(MW), [MW]);
  const aux = keyRows.find((r) => r.id === 'aux')!;
  const com = keyRows.find((r) => r.id === 'com')!;
  const d = decor.h4;

  // 共有: ShareButtons と同じフロー(共有モーダル・共同編集中の判定)。contentLabel も標準ヘッダーと同じ作り
  const contentLanguage = useThemeStore((s) => s.contentLanguage);
  const currentPlan = usePlanStore((s) => s.plans.find((p) => p.id === s.currentPlanId));
  const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
  const contentLabel = contentDef ? getPhaseName(contentDef.name, contentLanguage) : null;
  const { openShareUI, isOn, liveCount, active, modals } = useShareFlow({ contentLabel, currentPlan });

  // 同期: SyncButton と同じ条件(プラン無し・未ログインは出さない)と同じ処理
  const currentPlanId = usePlanStore((s) => s.currentPlanId);
  const cloudStatus = usePlanStore((s) => s._cloudStatus);
  const user = useAuthStore((s) => s.user);
  const profileDisplayName = useAuthStore((s) => s.profileDisplayName);
  const profileAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);
  const handleSync = () => {
    if (!user) return;
    const planStore = usePlanStore.getState();
    if (planStore.currentPlanId) {
      const snapshot = useMitigationStore.getState().getSnapshot();
      planStore.updatePlan(planStore.currentPlanId, { data: snapshot });
    }
    planStore.manualSync(user.uid, profileDisplayName || 'User').then(() => {
      if (cloudStatus === 'error') showToast(t('app.sync_push_success'), 'success');
    }).catch(() => {
      showToast(t('app.sync_push_error'), 'error');
    });
  };
  const syncErr = cloudStatus === 'error';
  const syncing = cloudStatus === 'syncing';
  const syncOk = !!(currentPlanId && user);

  // ログイン: 標準ヘッダーと同じく LoginModal を開く。ログイン中はアバター画像(未設定なら頭文字)を刻印に
  const [showLogin, setShowLogin] = React.useState(false);
  const initial = (profileDisplayName || 'U').charAt(0).toUpperCase();

  const iconCap = 'milspec-key-ic';
  const shareLabel = isOn
    ? (liveCount > 0 ? t('collab.chip_active_count', { count: liveCount }) : t('collab.chip_active'))
    : t('app.share');
  const tutName = t('app.view_tutorial');

  return (
    <>
      <MilspecStencil en="AUX" style={{ left: d.aux.x, top: d.aux.y }} />
      <MilspecStencil en="DSP" style={{ left: d.dsp.x, top: d.dsp.y }} />
      <MilspecStencil en="MODE" style={{ left: d.mode.x, top: d.mode.y }} />
      <MilspecStencil en="COM" style={{ left: d.com.x, top: d.com.y }} />

      {/* AUX: チュートリアル */}
      <div className="milspec-h4-kc" style={{ left: aux.x, top: aux.y }}>
        <div className="milspec-h4-slot" style={slotStyle(aux.caps[0])}>
          <TutorialMenu btnClassName="milspec-keybtn">
            <MilspecKeyCap cap={aux.caps[0]} label={<>{MsIcon.tut()}<b>{tutName}</b></>} />
            <span className="milspec-sr">{tutName}</span>
          </TutorialMenu>
        </div>
      </div>

      {/* DSP: 昼夜(縦ロッカー) */}
      <ThemeRocker theme={theme} onToggle={onToggleTheme} style={{ left: d.rocker.x, top: d.rocker.y }} />

      {/* MODE: 標準 ⇄ MIL-SPEC(T 字レバー。WIP 公開条件つき) */}
      <ModeLever x={d.lever.x} y={d.lever.y} w={d.lever.w} h={d.lever.h} />

      {/* COM: 共有 / 同期 / 言語 / ログイン(丸キー 4 つ) */}
      <div className="milspec-h4-kc" role="group" aria-label="COM" style={{ left: com.x, top: com.y }}>
        {/* プランが無いときも共有キーは置いたまま、押せない暗い状態にする(列が歯抜けにならない) */}
        <MilspecKey
          cap={com.caps[0]}
          style={capPos(com.caps[0])}
          className={`${iconCap}${currentPlan ? '' : ' milspec-key-na'}`}
          latch
          pressed={isOn}
          label={MsIcon.share()}
          aria-label={currentPlan ? shareLabel : t('milspec.com_share_na')}
          title={currentPlan ? shareLabel : t('milspec.com_share_na')}
          disabled={!currentPlan}
          data-tutorial={isOn ? undefined : 'share-copy-btn'}
          onClick={openShareUI}
        />
        {currentPlan && isOn && <MilspecLed state="on" size={5} style={{ left: 19, top: 2, position: 'absolute', pointerEvents: 'none' }} />}
        {/* 同期: 未ログイン・プラン無しは押せない暗い状態で置く */}
        <MilspecKey
          cap={com.caps[1]}
          style={capPos(com.caps[1])}
          className={`${iconCap}${syncErr ? ' milspec-key-dng' : ''}${syncOk ? '' : ' milspec-key-na'}`}
          label={MsIcon.sync()}
          aria-label={!syncOk ? t('milspec.com_sync_na') : syncErr ? t('app.sync_error_label') : t('app.sync_saved')}
          title={!syncOk ? t('milspec.com_sync_na') : syncErr ? t('app.sync_error_label') : t('app.sync_saved')}
          disabled={!syncOk || syncing}
          onClick={handleSync}
        />
        <div className="milspec-h4-slot" style={slotStyle(com.caps[2])}>
          <LanguageSwitcher btnClassName="milspec-keybtn">
            <MilspecKeyCap cap={com.caps[2]} className={iconCap} label={MsIcon.globe()} />
            <span className="milspec-sr">{t('app.switch_language')}</span>
          </LanguageSwitcher>
        </div>
        <MilspecKey
          cap={com.caps[3]}
          style={capPos(com.caps[3])}
          className={iconCap}
          label={user ? (profileAvatarUrl ? <img referrerPolicy="no-referrer" className="milspec-key-av" src={profileAvatarUrl} alt="" /> : <b>{initial}</b>) : MsIcon.login()}
          aria-label={t('app.sign_in')}
          title={t('app.sign_in')}
          onClick={() => setShowLogin(true)}
        />
      </div>

      {/* 共同編集中だけ: 参加者ドットとカーソル操作(標準 ShareButtons と同じ出し方・条件)。
          銘板の窪み(H2)の右端に、暗い床を敷いて重ねる */}
      {isOn && (
        <div className="milspec-collab-dots" style={{ left: decor.nameplate.x + decor.nameplate.w - 12, top: decor.nameplate.y + 21 }}>
          <ParticipantDots size={8} />
          {active && <PresenceControls compact />}
        </div>
      )}

      <MilspecMark text="H4" style={{ left: d.id.x, top: d.id.y }} />
      {modals}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
