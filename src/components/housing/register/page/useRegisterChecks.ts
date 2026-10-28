import { useMemo } from 'react';
import type { RegisterConfirmSummary } from '../RegisterSectionConfirm';
import type { RegisterStep, RegisterStepState } from '../RegisterStepperNav';
import { validateAddress, validateTitle } from '../../../../utils/housingValidation';
import type { AddressInput } from '../../../../utils/housingRegistrationTypes';
import { computeRegisterChecklist, isReadyToPublish } from '../../../../lib/housing/registerChecklist';
import { normalizeAddressForBuildingType } from '../../../../lib/housing/normalizeAddressForBuildingType';
import { formatFullHousingAddress } from '../../../../lib/housing/formatHousingAddress';
import type { HousingArea } from '../../../../types/housing';
import { regionForDC } from '../../../../data/housing/dcServerMap';
import type { RegisterFields } from './useRegisterFields';
import type { i18n as I18n } from 'i18next';
import { type StepId, STEP_LABEL_KEYS } from './registerPageModel';

export function useRegisterChecks(f: RegisterFields, mode: 'create' | 'edit', effectiveStepIds: StepId[], activeStepId: StepId, i18n: I18n) {
  const { address, fieldState, addressConfirmed, title, visibility, visibilityTouched, localImages, sourceImageUrls, editThumbnailPaths, snsCapture } = f;

  // メディアの有無 = 静止画 + 動画/YouTube。画像必須 (新規登録) の判定に使う
  // (ユーザー承認 2026-07-15: 画像 or 動画があれば OK)。
  const hasMedia =
    localImages.length > 0 ||
    sourceImageUrls.length > 0 ||
    editThumbnailPaths.length > 0 ||
    !!snsCapture.tweetData?.video?.url ||
    !!snsCapture.youtube;
  const introDone = title.trim().length > 0;

  // ===== 右カラム: 入力チェック (Task13) =====
  // address を AddressInput 候補に組み立てて validateAddress にかける (重複照会の妥当性判定と共用)。
  // buildingType と矛盾する不可視フィールド (アパート中の plot/size 等) は必ず落とす (B5 根治)。
  const normalizedAddress = useMemo(() => normalizeAddressForBuildingType(address), [address]);
  const addressCandidate = useMemo<AddressInput>(
    () => ({
      dc: normalizedAddress.dc ?? '',
      server: normalizedAddress.server ?? '',
      area: normalizedAddress.area ?? '',
      ward: normalizedAddress.ward ?? Number.NaN,
      buildingType: normalizedAddress.buildingType ?? '',
      plot: normalizedAddress.plot,
      size: normalizedAddress.size,
      apartmentBuilding: normalizedAddress.apartmentBuilding,
      roomKind: normalizedAddress.roomKind,
      roomNumber: normalizedAddress.roomNumber,
    }),
    [normalizedAddress],
  );
  const addressOk = useMemo(() => validateAddress(addressCandidate).ok, [addressCandidate]);
  const titleOk = useMemo(() => validateTitle(title).ok, [title]);
  const checklistItems = useMemo(
    () =>
      computeRegisterChecklist({
        addressOk,
        addressConfirmed,
        titleOk,
        hasImage: hasMedia,
        // 新規登録のみ画像/動画を必須にする (edit は写真を編集しない方式A のため対象外)。
        imageRequired: mode === 'create',
      }),
    [addressOk, addressConfirmed, titleOk, hasMedia, mode],
  );
  // 公開可否 = 必須行 (住所/タイトル) が全て done か。画像 (推奨) は見ない。
  const canSubmit = useMemo(() => isReadyToPublish(checklistItems), [checklistItems]);
  const checkPanelItems = checklistItems;

  const doneMap = useMemo<Record<StepId, boolean>>(
    () => ({
      media: hasMedia,
      address: fieldState.isReadyToSubmit(),
      intro: introDone,
      visibility: visibilityTouched,
      // confirm = 必須項目が揃って登録可能になったら done (isReadyToPublish)。
      confirm: canSubmit,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mode は計算では読まないが、従来どおり mode が変わった時にも再計算させる
    [mode, hasMedia, fieldState, introDone, visibilityTouched, canSubmit],
  );

  const steps: RegisterStep[] = useMemo(
    () =>
      effectiveStepIds.map((id, idx) => {
        const state: RegisterStepState = id === activeStepId ? 'active' : doneMap[id] ? 'done' : 'idle';
        // 番号は表示位置 (idx+1) で振り直す。 edit で media を除外しても 1 から詰まり欠番が出ない (Task3.4-1)。
        // intro ステップは「住所非公開」選択時、ラベルはそのまま「コメント」の説明文だけ差し替える
        // (一覧に住所ではなく「住所は非公開です」と出る旨を伝える・Task4)。
        const descKey = id === 'intro' && visibility === 'unlisted' ? 'housing.register.step_desc.intro_unlisted' : undefined;
        return { id: idx + 1, labelKey: STEP_LABEL_KEYS[id], state, descKey };
      }),
    [effectiveStepIds, activeStepId, doneMap, visibility],
  );

  // ===== 確認セクション要約 =====
  const confirmSummary = useMemo<RegisterConfirmSummary>(() => {
    let addressText: string | null = null;
    if (addressOk && address.area) {
      // 確認セクション+公開ボタン上の住所をフル住所化 (2026-07-13 round2 A-3・②)。
      // region は regionForDC(dc) で導出し、未知 DC (Shadow 等) は null になり得るが
      // formatFullHousingAddress 側の null ガード (A-2) が街区住所へフォールバックするので
      // ここではそのまま渡してよい。addressOk===true のときは dc/server は必ず値が入っている。
      addressText = formatFullHousingAddress(
        {
          region: regionForDC(address.dc ?? ''),
          dc: address.dc ?? '',
          server: address.server ?? '',
          area: address.area as HousingArea,
          ward: address.ward ?? 0,
          buildingType: address.buildingType,
          plot: address.plot,
          apartmentBuilding: address.apartmentBuilding,
          roomNumber: address.roomNumber,
        },
        i18n.language,
      );
    }
    // 静止画枚数 (ローカル + SNS 取得画像)。加えて、静止画ゼロでも動画のみツイート/YouTube を
    // 捕捉していれば「1 件」として数える (sourceImageUrls 空の動画ツイートで 0 と表示されないように)。
    const stillCount = localImages.length + sourceImageUrls.length + editThumbnailPaths.length;
    const hasCapturedMedia =
      stillCount === 0 && (!!snsCapture.tweetData?.video?.url || !!snsCapture.youtube);
    return {
      address: addressText,
      title: title.trim() ? title.trim() : null,
      imageCount: stillCount + (hasCapturedMedia ? 1 : 0),
    };
  }, [
    addressOk,
    address,
    title,
    localImages.length,
    sourceImageUrls.length,
    editThumbnailPaths.length,
    snsCapture.tweetData,
    snsCapture.youtube,
    i18n.language,
  ]);

  return { addressOk, addressCandidate, checklistItems, canSubmit, checkPanelItems, steps, confirmSummary };
}
