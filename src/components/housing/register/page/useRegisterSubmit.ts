import { useCallback, useState } from 'react';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingUpdate } from '../../edit/useHousingUpdate';
import { showToast } from '../../../toastBus';
import { checkDuplicate, registerListing, uploadListingThumbnail, QuotaExhaustedError, type DuplicateEntry } from '../../../../lib/housingApiClient';
import type { RegistrationDraft } from '../../../../utils/housingRegistrationTypes';
import { normalizeAddressForBuildingType } from '../../../../lib/housing/normalizeAddressForBuildingType';
import { AUTOSAVE_KEY } from '../../../../lib/housing/registerAutosave';
import { SAVED_IMAGES_LIMIT } from '../HousingRegisterImageField';
import type { HousingListing } from '../../../../types/housing';
import type { RegisterFields } from './useRegisterFields';
import type { User } from 'firebase/auth';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import { buildDraftImageFields, buildLocalListingViewModel } from './registerPageModel';

export function useRegisterSubmit({ f, mode, initialValues, onSaved, user, canSubmit, t, navigate, updateListing }: { f: RegisterFields; mode: 'create' | 'edit'; initialValues?: HousingListing; onSaved?: (listingId: string) => void | Promise<unknown>; user: User | null; canSubmit: boolean; t: TFunction; navigate: NavigateFunction; updateListing: ReturnType<typeof useHousingUpdate>['update'] }) {
  const { address, title, description, tags, visibility, publishUntil, afterExpiryVisibility, allowPromoTweet, localImages, sourceImageUrls, snsCapture, sourcePostUrls } = f;

  // ===== submit オーケストレーション (Task14) =====
  const [submitting, setSubmitting] = useState(false);
  const [submitErrorKey, setSubmitErrorKey] = useState<string | null>(null);
  // submit 時の重複警告ダイアログ。null=非表示、配列=公開重複を表示中。
  const [submitDuplicates, setSubmitDuplicates] = useState<DuplicateEntry[] | null>(null);

  /**
   * 分散した page state を 1 つの RegistrationDraft に組む。
   * - 住所は新モデル (buildingType/roomKind/size) を素通し (旧 5 択変換は不要)。
   * - title/visibility/publishUntil/tags/description を含める。
   * - 画像フィールドは buildDraftImageFields (旧優先順位の複製) で組む。
   */
  const buildDraft = useCallback((): RegistrationDraft => {
    const imageFields = buildDraftImageFields(snsCapture, localImages, sourceImageUrls);
    // 検証 (addressCandidate) と同じ正規化済み住所を使う (不可視フィールド残留を送信しない・B5)。
    const a = normalizeAddressForBuildingType(address);
    return {
      dc: a.dc ?? '',
      server: a.server ?? '',
      area: a.area ?? '',
      ward: a.ward ?? 0,
      buildingType: a.buildingType ?? 'house',
      plot: a.plot,
      size: a.size,
      apartmentBuilding: a.apartmentBuilding,
      roomKind: a.roomKind,
      roomNumber: a.roomNumber,
      tags,
      description: description || undefined,
      // タイトルは任意 (2026-07-10)。空文字はサーバー validateTitle の required に当たるため
      // undefined で送る (未指定=OK)。未入力なら一覧カードは住所フォールバックを表示する。
      title: title.trim() ? title.trim() : undefined,
      visibility,
      publishUntil,
      afterExpiryVisibility,
      allowPromoTweet,
      ...imageFields,
      ...(sourcePostUrls.length > 0 ? { sourcePostUrls } : {}),
    };
  }, [
    address,
    tags,
    description,
    title,
    visibility,
    publishUntil,
    afterExpiryVisibility,
    allowPromoTweet,
    snsCapture,
    localImages,
    sourceImageUrls,
    sourcePostUrls,
  ]);

  /**
   * 実 register + 後続処理 (重複 OK / 「それでも登録」 両方から呼ばれる)。
   * 旧 performRegister (HousingRegisterFormModal.tsx:141-184) を踏襲。
   */
  const performRegister = useCallback(
    async (draft: RegistrationDraft) => {
      setSubmitting(true);
      try {
        const { id } = await registerListing(draft);

        // localImages があれば register 直後に upload-thumbnail を逐次呼ぶ (index=0..N-1)。
        // 1 件でも失敗したら upload_failed を控えるが listing 自体は成功済み。
        // HousingRegisterImageField は最大12枚まで選ばせるが、物件画像として保存されるのは
        // 先頭 SAVED_IMAGES_LIMIT 枚のみ (UI の「使用」バッジ・ja.json ヒントと同じ約束)。
        // ここで絞らずに全件送ると、サーバー側 MAX_IMAGES_PER_LISTING で確実に拒否される
        // リクエストのぶんだけ無駄にレート制限バケットを消費してしまう (2026-07-20 実ユーザー報告)。
        const imagesToUpload = localImages.slice(0, SAVED_IMAGES_LIMIT);
        if (imagesToUpload.length > 0) {
          let uploadFailedOnce = false;
          for (let i = 0; i < imagesToUpload.length; i++) {
            const img = imagesToUpload[i];
            try {
              await uploadListingThumbnail({
                listingId: id,
                base64: img.base64,
                mimeType: img.mimeType,
                index: i,
              });
            } catch (uploadErr) {
              console.warn(`[RegisterPage] thumbnail upload failed (index=${i})`, uploadErr);
              uploadFailedOnce = true;
            }
          }
          if (uploadFailedOnce) setSubmitErrorKey('upload_failed');
        }

        // 中央一覧へ即反映 (2026-07-13 round2 A-5・c: リロード不要 + Firestore 読み取り0)。
        // 旧実装は fetchAndUpsert(id) (getDoc 1件) + loadMine(uid) (最大200件) を毎登録で
        // 叩いていた。draft + id + ownerUid からローカルに view-model を組んで upsert する
        // だけで反映できるため、追加の Firestore 読み取りを一切発生させない。
        // マイ一覧 (loadMine) の即時再取得は行わない (次回マイページ訪問時に load される)。
        if (user) {
          useHousingListingsStore.getState().upsert(buildLocalListingViewModel(draft, id, user.uid));
        }

        // 登録成功でオートセーブを破棄。
        try {
          window.localStorage.removeItem(AUTOSAVE_KEY);
        } catch {
          /* localStorage 不可でも致命的でない */
        }

        showToast(
          draft.visibility === 'private'
            ? t('housing.register.toast.saved_private')
            : t('housing.register.toast.published'),
          'success',
        );
        navigate(`/housing/listing/${id}`);
      } catch (e) {
        if (e instanceof QuotaExhaustedError) {
          setSubmitErrorKey('quota_exhausted');
        } else if (e instanceof Error && e.message === 'not_authenticated') {
          setSubmitErrorKey('not_authenticated');
        } else {
          setSubmitErrorKey('generic');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [localImages, user, navigate, t],
  );

  /**
   * mode='edit' の保存 (Task3.2)。 useHousingUpdate 経由で更新 API を呼ぶ
   * (HousingRegisterView.performUpdate を踏襲)。 create パス (performRegister) とは
   * 完全に独立: checkDuplicate 照会なし・thumbnail upload なし
   * (画像は方式Aによりこのフォームで変更しない・サーバー updatePayload も画像フィールドを含めない)。
   * 成功時は一覧 + マイ一覧を即反映してから詳細ページへ戻る。
   */
  const performUpdate = useCallback(
    async (draft: RegistrationDraft) => {
      if (!initialValues) return;
      setSubmitting(true);
      try {
        const result = await updateListing(initialValues.id, draft);
        if (result.ok) {
          // Task3.3a 回帰修復 / Task3.4-4 順序修正: 編集=通報対処とみなす後処理 (resolveReport 等) を、
          // store 再取得より先に呼ぶ。 resolveReport はサーバー側の isHidden を解除するため、
          // 先に呼んでおかないと直後の fetchAndUpsert/loadMine が unhide 前の stale な状態を
          // 一時的に拾ってしまう (旧 handleListingSaved: resolveReport→refreshAfterChange と同順)。
          // 失敗しても編集自体は保存済みなので後続 (store 再取得/navigate) は止めない。
          try {
            await onSaved?.(initialValues.id);
          } catch {
            /* onSaved (通報解決等) の失敗は保存フローを止めない */
          }
          await useHousingListingsStore.getState().fetchAndUpsert(initialValues.id);
          if (user) await useHousingListingsStore.getState().loadMine(user.uid);
          showToast(t('housing.edit.success'), 'success');
          navigate(`/housing/listing/${initialValues.id}`);
        } else {
          setSubmitErrorKey('generic');
        }
      } catch {
        setSubmitErrorKey('generic');
      } finally {
        setSubmitting(false);
      }
    },
    [initialValues, updateListing, user, navigate, t, onSaved],
  );

  /**
   * 確認セクションの主アクション押下時。
   * mode='edit' は checkDuplicate を照会せず (自分自身が重複扱いになるため) performUpdate へ
   * 直行する。 mode='create' (既定) の挙動は不変: まず checkDuplicate で公開重複を照会し、
   * あれば HousingDuplicateWarningDialog を出す (onProceed で performRegister へ)。
   * submit 時の checkDuplicate 失敗は登録を止めず register に進む (旧 handleConfirm:204-209
   * と同じ = ゲートをバイパスするだけ。Task13 の debounce プレチェックとは別物)。
   */
  const handleSubmit = useCallback(async () => {
    if (submitting || !canSubmit) return;
    setSubmitErrorKey(null);
    const draft = buildDraft();

    if (mode === 'edit') {
      await performUpdate(draft);
      return;
    }

    setSubmitting(true);
    try {
      const dup = await checkDuplicate(draft);
      setSubmitting(false);
      if (dup.duplicates.length > 0) {
        setSubmitDuplicates(dup.duplicates);
        return;
      }
      await performRegister(draft);
    } catch (e) {
      setSubmitting(false);
      console.warn('[RegisterPage] checkDuplicate failed on submit, proceeding anyway', e);
      await performRegister(draft);
    }
  }, [submitting, canSubmit, buildDraft, mode, performUpdate, performRegister]);

  return { submitting, submitErrorKey, submitDuplicates, setSubmitDuplicates, buildDraft, performRegister, handleSubmit };
}
