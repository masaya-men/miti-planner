import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { RegisterSectionAddress } from '../register/RegisterSectionAddress';
import { RegisterSectionIntro } from '../register/RegisterSectionIntro';
import { RegisterSectionMedia } from '../register/RegisterSectionMedia';
import { HousingEditMediaSection } from '../edit/HousingEditMediaSection';
import type { EditMediaMode } from '../edit/HousingEditMediaModeTabs';
import { RegisterSectionVisibility } from '../register/RegisterSectionVisibility';
import { RegisterSectionConfirm } from '../register/RegisterSectionConfirm';
import { RegisterHousingerCta } from '../register/RegisterHousingerCta';
import { HousingDuplicateWarningDialog } from '../HousingDuplicateWarningDialog';
import { useHousingUpdate } from '../edit/useHousingUpdate';
import type { HousingListing } from '../../../types/housing';
import { useRegisterFields } from '../register/page/useRegisterFields';
import { useRegistrationQuota } from '../register/page/useRegistrationQuota';
import { useRegisterAddressInput } from '../register/page/useRegisterAddressInput';
import { useRegisterSnsFetch } from '../register/page/useRegisterSnsFetch';
import { useRegisterScrollSpy } from '../register/page/useRegisterScrollSpy';
import { useRegisterChecks } from '../register/page/useRegisterChecks';
import { useRegisterDuplicateCheck } from '../register/page/useRegisterDuplicateCheck';
import { useRegisterSubmit } from '../register/page/useRegisterSubmit';
import { useRegisterEditMedia } from '../register/page/useRegisterEditMedia';
import { useRegisterAutosave } from '../register/page/useRegisterAutosave';
import { RegisterLeftColumn } from '../register/page/RegisterLeftColumn';
import { RegisterAutosaveNotice } from '../register/page/RegisterAutosaveNotice';
import { RegisterRightColumn } from '../register/page/RegisterRightColumn';
import './RegisterPage.css';

interface RegisterPageProps {
  /** 'create' (既定) で新規登録、 'edit' で既存物件の編集プリフィル (Task3.1)。 */
  mode?: 'create' | 'edit';
  /** mode='edit' のとき、フォーム初期値の出典にする既存 listing。 */
  initialValues?: HousingListing;
  /**
   * mode='edit' の保存成功時のみ呼ぶ後処理フック (Task3.3a 回帰修復)。 create パスでは呼ばない。
   * 旧 HousingEditModal 経由の編集では、 保存成功で useHousingDetail.handleListingSaved が
   * resolveReport(listing.id) を走らせて「編集=通報対処」 とみなし自己非表示を解除していた。
   * 別ページ化でこの経路が失われるため、 呼び出し側 (HousingEditPage) が resolveReport を
   * ここに配線して回帰を塞ぐ。 onSaved 内の失敗は保存フロー (navigate) を止めない
   * (編集自体は保存済みのため)。
   */
  onSaved?: (listingId: string) => void | Promise<unknown>;
}

/**
 * 登録ページ (3カラム): 探す/お気に入りと同じ骨格。
 * 未ログイン → 中央にログイン案内。ログイン済 → 3カラムのフォーム枠。
 * フォーム状態 (住所/紹介/画像/公開設定) は本ページが親として保持し、子セクションに
 * 値とセッタを渡す。中央カラムのセクションは spec 正典順 (media→address→intro→
 * visibility→confirm) で並び、IntersectionObserver による scroll-spy で左カラムの
 * ステッパー (RegisterStepperNav) と連動する (Task12)。confirm セクション本体と
 * 右カラムの中身は Task13-14 で本実装、それまでスタブに留める。
 *
 * mode/initialValues (Task3.1): mode='edit' + initialValues 指定時、住所/タイトル/紹介文/
 * タグ/公開範囲/公開終了日時を listing の値でプリフィルする。写真系 state
 * (localImages/sourceImageUrls/snsCapture/postUrl) はプリフィルしない (方式A: 編集で
 * 写真は変えない。サーバーの update ハンドラも画像フィールドを更新しない設計)。
 * mode/initialValues 未指定時は create 挙動 (現状の初期値) と完全に不変。
 */
export const RegisterPage: React.FC<RegisterPageProps> = ({ mode = 'create', initialValues, onSaved }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  // mode='edit' の保存 (Task3.2): HousingRegisterView.performUpdate と同じ更新 hook を使う。
  const { update: updateListing } = useHousingUpdate();

  const f = useRegisterFields(mode, initialValues);
  const { isAdmin, remaining, registrationCount } = useRegistrationQuota(user);
  const { handleAddressChange, handleConfirmAddress, applyExtractedResult, applyExtractedAddress } = useRegisterAddressInput(f);
  const { handleTweetFetched, handleYoutubeFetched, handleOgpFetched, handleAddUrlSlot, handleRemoveUrlSlot } = useRegisterSnsFetch(f, applyExtractedResult, applyExtractedAddress, t);
  const { effectiveStepIds, scrollContainerRef, sectionRefs, activeStepId, stepperProgress, handleJumpToStep } = useRegisterScrollSpy(mode, user);
  const { checklistItems, canSubmit, checkPanelItems, steps, confirmSummary, addressOk, addressCandidate } = useRegisterChecks(f, mode, effectiveStepIds, activeStepId, i18n);
  const { duplicateState, duplicates, privateMatchCount } = useRegisterDuplicateCheck(mode, addressOk, addressCandidate);
  const { submitting, submitErrorKey, submitDuplicates, setSubmitDuplicates, buildDraft, performRegister, handleSubmit } = useRegisterSubmit({ f, mode, initialValues, onSaved, user, canSubmit, t, navigate, updateListing });
  const { handleEditThumbnailPathsChange, commitEditSnsFetch } = useRegisterEditMedia({ f, initialValues, buildDraft, updateListing });
  const { restoredNoticeVisible, handleDiscardRestore, handleUrlUserEdit } = useRegisterAutosave({ f, mode, user });

  const { address, fieldState, addressConfirmed, addressExtractFailed, title, description, tags, visibility, publishUntil, afterExpiryVisibility, allowPromoTweet, handleVisibilityChange, handleIntroChange, localImages, setLocalImages, sourceImageUrls, setSourceImageUrls, editThumbnailPaths, editVideoPreview, snsCapture, postUrl, sourcePostUrls, urlSlotCount, restoredSnsUrl, mediaKey } = f;

  if (!user) {
    return (
      <div className="housing-register">
        <section className="housing-register-panel housing-register-panel-solo" data-region="center">
          <div className="housing-register-col housing-register-col-center">
            <div data-testid="housing-register-login-prompt">
              <HousingLoginPrompt context="register" registerFlag={false} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="housing-register" data-testid="housing-register-form-root">
      {/* 左カラム: ステッパーナビ (スクロール) + 本日の登録枠 (下端固定・#6)。
          残数はスクロールに埋もれないよう、スクロール領域の外=左パネル最下部に固定する。
          「登録の流れ」(RegisterGuide) はステッパーと役割が重複していたため右カラムへ移設。 */}
      <RegisterLeftColumn
        steps={steps}
        onJump={handleJumpToStep}
        progress={stepperProgress}
        isAdmin={isAdmin}
        remaining={remaining}
        registrationCount={registrationCount}
      />

      {/* 中央カラム: セクション群。spec 正典順 (media→address→intro→visibility→confirm)。 */}
      <section className="housing-register-panel" data-region="center">
        <div className="housing-register-col housing-register-col-center" ref={scrollContainerRef}>
          <div className="housing-register-sections">
            {restoredNoticeVisible && (
              <RegisterAutosaveNotice postUrl={postUrl} onDiscard={handleDiscardRestore} />
            )}
            <div ref={(el) => { sectionRefs.current.media = el; }} data-step-id="media">
              {mode === 'edit' ? (
                initialValues && (
                  <HousingEditMediaSection
                    listingId={initialValues.id}
                    initialMode={
                      (initialValues.imageMode === 'thumbnail' ? 'thumbnail' : 'sns') as EditMediaMode
                    }
                    thumbnailPaths={editThumbnailPaths}
                    onThumbnailPathsChange={handleEditThumbnailPathsChange}
                    sourceImageUrls={sourceImageUrls}
                    onSourceImageUrlsChange={setSourceImageUrls}
                    videoPreview={editVideoPreview}
                    sourcePostUrls={sourcePostUrls}
                    onCommitSnsFetch={commitEditSnsFetch}
                  />
                )
              ) : (
                <RegisterSectionMedia
                  key={`${mediaKey}:${restoredSnsUrl ?? ''}`}
                  onTweetFetched={handleTweetFetched}
                  onYoutubeFetched={handleYoutubeFetched}
                  onOgpFetched={handleOgpFetched}
                  localImages={localImages}
                  onLocalImagesChange={setLocalImages}
                  sourceImageUrls={sourceImageUrls}
                  onSourceImageUrlsChange={setSourceImageUrls}
                  initialSnsUrl={restoredSnsUrl}
                  onUrlUserEdit={handleUrlUserEdit}
                  // 動画ツイートの poster を最小プレビュー (ポスター1枚+「動画あり」バッジ) で見せる。
                  // <video> 直参照は CSP 不可のため posterUrl (pbs.twimg.com) を <img> で出す。
                  tweetVideo={snsCapture.tweetData?.video ?? null}
                  urlSlotCount={urlSlotCount}
                  onAddUrlSlot={handleAddUrlSlot}
                  onRemoveUrlSlot={handleRemoveUrlSlot}
                />
              )}
            </div>
            <div ref={(el) => { sectionRefs.current.address = el; }} data-step-id="address">
              {addressExtractFailed && (
                <p className="housing-error-text" data-testid="housing-register-address-extract-failed">
                  {t('housing.register.address_extract_failed')}
                </p>
              )}
              <RegisterSectionAddress
                fieldState={fieldState}
                values={address}
                onChange={handleAddressChange}
              />
            </div>
            <div ref={(el) => { sectionRefs.current.intro = el; }} data-step-id="intro">
              <RegisterSectionIntro
                title={title}
                description={description}
                tags={tags}
                visibility={visibility}
                onChange={handleIntroChange}
              />
            </div>
            <div ref={(el) => { sectionRefs.current.visibility = el; }} data-step-id="visibility">
              <RegisterSectionVisibility
                // 破棄 (handleDiscardRestore) で mediaKey が ++ される → 再マウントされ、
                // publishUntil=null で初期化され直して終了日時トグルが OFF に戻る (復元 ON は
                // RegisterSectionVisibility 内の useEffect が publishUntil 到着で ON にする)。
                key={mediaKey}
                visibility={visibility}
                publishUntil={publishUntil}
                afterExpiryVisibility={afterExpiryVisibility}
                allowPromoTweet={allowPromoTweet}
                showPromoToggle={mode === 'create'}
                onChange={handleVisibilityChange}
              />
            </div>
            {/* Task9: 確認セクション直前の任意ブロック (spec §4.1)。 ステッパー/scroll-spy の
                対象 (STEP_IDS) には含めない — 何も要求しない導線なので「必須ステップ」に
                見せない。 ログイン済のときだけ RegisterHousingerCta 内部で自分のプロフィールを
                読み、 CTA (未公開時) / 公開中表示を出す。 */}
            <RegisterHousingerCta />
            <div
              ref={(el) => { sectionRefs.current.confirm = el; }}
              data-step-id="confirm"
            >
              <RegisterSectionConfirm
                mode={mode}
                summary={confirmSummary}
                canSubmit={canSubmit}
                visibility={visibility}
                submitting={submitting}
                errorKey={submitErrorKey}
                onSubmit={handleSubmit}
                checklistItems={checklistItems}
                addressConfirmed={addressConfirmed}
                onConfirmAddress={handleConfirmAddress}
                duplicateFound={duplicateState === 'found'}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 右カラム: チェック/重複パネル + 区画マッププレビュー (Task13 本実装) */}
      <RegisterRightColumn
        mode={mode}
        checkPanelItems={checkPanelItems}
        duplicateState={duplicateState}
        duplicates={duplicates}
        privateMatchCount={privateMatchCount}
        address={address}
      />

      {/* submit 時の同住所公開重複ダイアログ。「戻って修正」/「それでも登録」 の二択。 */}
      {submitDuplicates && (
        <HousingDuplicateWarningDialog
          duplicates={submitDuplicates}
          onClose={() => setSubmitDuplicates(null)}
          onCorrect={() => setSubmitDuplicates(null)}
          onProceed={async () => {
            setSubmitDuplicates(null);
            await performRegister(buildDraft());
          }}
        />
      )}
    </div>
  );
};
