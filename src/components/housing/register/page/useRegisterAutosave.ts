import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RegisterAddressValues } from '../RegisterSectionAddress';
import { AUTOSAVE_KEY, serializeDraft, restoreDraft, hasMeaningfulDraft, type AutosaveDraft } from '../../../../lib/housing/registerAutosave';
import { consumeRegisterPrefill } from '../../../../lib/housing/registerPrefill';
import { EMPTY_SNS_CAPTURE } from '../snsCapture';
import type { RegisterFields } from './useRegisterFields';
import type { User } from 'firebase/auth';

export function useRegisterAutosave({ f, mode, user }: { f: RegisterFields; mode: 'create' | 'edit'; user: User | null }) {
  const { address, setAddress, fieldState, setAddressConfirmed, setAddressExtractFailed, title, setTitle, description, setDescription, tags, setTags, visibility, setVisibility, publishUntil, setPublishUntil, afterExpiryVisibility, setAfterExpiryVisibility, allowPromoTweet, setAllowPromoTweet, setVisibilityTouched, setLocalImages, setSourceImageUrls, setSnsCapture, postUrl, setPostUrl, setSourcePostUrls, setUrlSlotCount, capturedVideoRef, addressAppliedRef, setRestoredSnsUrl, setMediaKey, restoreRefetchGuardRef } = f;

  // ===== オートセーブ (Task14 / spec:119-120) =====
  // 値変化を debounce (700ms) でテキスト系のみ localStorage 保存。
  const autosaveTimerRef = useRef<number | null>(null);
  // マウント直後の復元適用が終わるまで保存を抑止 (復元値を即上書きしないため)。
  const autosaveReadyRef = useRef(false);
  const [restoredNoticeVisible, setRestoredNoticeVisible] = useState(false);

  const autosaveValues = useMemo<Partial<AutosaveDraft>>(
    () => ({
      title,
      description,
      tags,
      dc: address.dc,
      server: address.server,
      area: address.area,
      ward: address.ward,
      buildingType: address.buildingType,
      plot: address.plot,
      size: address.size,
      apartmentBuilding: address.apartmentBuilding,
      roomKind: address.roomKind,
      roomNumber: address.roomNumber,
      postUrl: postUrl || undefined,
      visibility,
      publishUntil,
      afterExpiryVisibility,
      // 既定 (許可) のときは保存しない。OFF にしたときだけ false を残す。
      allowPromoTweet: allowPromoTweet === false ? false : undefined,
    }),
    [title, description, tags, address, postUrl, visibility, publishUntil, afterExpiryVisibility, allowPromoTweet],
  );

  useEffect(() => {
    // オートセーブは「新規登録の入力を途中で失わないための復旧」機能であり、mode='edit' には
    // 適用しない。edit は常に initialValues (サーバーの現在値) が正なので保存対象にすると、
    // 編集中の内容が「次に開く新規登録 or 別リスティングの編集」に漏れて誤って復元される
    // (2026-07-20 実ユーザー報告: 最初に登録した物件を編集すると別の物件の内容になる、の根因の一つ)。
    if (mode !== 'create') return;
    if (!user) return;
    if (!autosaveReadyRef.current) return; // 復元適用前は保存しない
    if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        // 意味のある入力が 1 つも無い間は保存しない (既存の空ドラフトも掃除する)。
        // 「開いただけで次回『入力途中を復元しました』が出る」誤発火を保存の段階で断つ。
        if (hasMeaningfulDraft(autosaveValues)) {
          window.localStorage.setItem(AUTOSAVE_KEY, serializeDraft(autosaveValues));
        } else {
          window.localStorage.removeItem(AUTOSAVE_KEY);
        }
      } catch {
        /* localStorage 不可でも致命的でない */
      }
    }, 700);
    return () => {
      if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [mode, user, autosaveValues]);

  /**
   * マウント時 (ログイン済) に localStorage から復元。復元候補があれば:
   * - 住所/タイトル/コメント/タグ/公開設定を反映。fieldState への setAutoFilled はこの時点で
   *   全フィールドが空なので復元値をそのまま適用する。
   * - 保存済み SNS URL があれば restoredSnsUrl に設定し、RegisterSectionMedia →
   *   HousingRegisterSnsUrlField(initialUrl) 経由でマウント時に画像を実再取得する (spec:120)。
   *   この復元起因の再取得は restoreRefetchGuardRef=true とし、applyExtractedAddress が
   *   「その時点で空の住所フィールドだけ」を補完する (復元済み・手修正済みの住所値を上書きしない)。
   *   注記「SNS 画像は再取得します」は実際に再取得が走るため正しくなる。
   *
   * 続けて (Task5・spec §4.3): create モードのみ、「住所登録なし一時ツアー」の
   * 「この家を登録する」から渡された一回限りプリフィル (registerPrefill) を消費する。
   * 上のオートセーブ復元で埋まったフィールドは上書きしない (addressPatch を共有して判定)。
   * postUrl も復元と同じ restoredSnsUrl 経路に乗せて SNS を再取得するが、通知行は出さない
   * (ユーザーが直前に自分で押した遷移のため)。
   *
   * 一度だけ実行 (user 確定後)。
   *
   * mode='edit' には適用しない (2026-07-20 実ユーザー報告の根因): 復元は「新規登録の
   * 下書き」を前提にしており、edit は既に initialValues で正しい値を持っている。ここを
   * 無条件で実行すると、以前どこかで (別リスティングの編集中や新規登録の入力中に) 保存された
   * 無関係な下書きが、今開いている edit フォームへ無条件に上書き適用されてしまう。
   */
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'create') return;
    if (!user) return;
    if (restoreAppliedRef.current) {
      autosaveReadyRef.current = true;
      return;
    }
    restoreAppliedRef.current = true;

    // 住所 patch はオートセーブ復元・一時ツアープリフィルの両方が書き込む共有バッファ。
    // 最後に 1 回だけ setAddress する (どちらもここまでに決まった値を尊重する)。
    const addressPatch: RegisterAddressValues = {};
    let postUrlApplied = false;

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(AUTOSAVE_KEY);
    } catch {
      raw = null;
    }
    const restored = restoreDraft(raw);

    if (restored) {
      // テキスト系を state へ反映。
      if (typeof restored.title === 'string') setTitle(restored.title);
      if (typeof restored.description === 'string') setDescription(restored.description);
      if (Array.isArray(restored.tags)) setTags(restored.tags);
      if (restored.visibility === 'public' || restored.visibility === 'private') {
        setVisibility(restored.visibility);
        setVisibilityTouched(true);
      }
      if (restored.publishUntil === null || typeof restored.publishUntil === 'number') {
        setPublishUntil(restored.publishUntil);
      }
      if (restored.afterExpiryVisibility === 'unlisted' || restored.afterExpiryVisibility === 'private') {
        setAfterExpiryVisibility(restored.afterExpiryVisibility);
      }
      if (typeof restored.allowPromoTweet === 'boolean') {
        setAllowPromoTweet(restored.allowPromoTweet);
      }
      // 保存済み SNS URL: postUrl state を復元 + initialUrl として SnsUrlField に渡し実再取得する。
      // 復元起因の再取得は住所を空フィールドだけ補完する (spec:120 guard を先に true にする)。
      if (typeof restored.postUrl === 'string' && restored.postUrl.trim()) {
        setPostUrl(restored.postUrl);
        restoreRefetchGuardRef.current = true;
        setRestoredSnsUrl(restored.postUrl);
        postUrlApplied = true;
      }

      // 住所フィールド: 復元後に空のフィールドだけへ適用 (この時点で全フィールドは空なので全て適用)。
      const setIfDefined = (key: keyof RegisterAddressValues, value: unknown) => {
        if (value === undefined) return;
        (addressPatch as Record<string, unknown>)[key] = value;
        fieldState.setAutoFilled(key, value);
      };
      setIfDefined('dc', restored.dc);
      setIfDefined('server', restored.server);
      setIfDefined('area', restored.area);
      setIfDefined('ward', restored.ward);
      setIfDefined('buildingType', restored.buildingType);
      setIfDefined('plot', restored.plot);
      setIfDefined('size', restored.size);
      setIfDefined('apartmentBuilding', restored.apartmentBuilding);
      setIfDefined('roomKind', restored.roomKind);
      setIfDefined('roomNumber', restored.roomNumber);

      // 実際に意味のある入力があるドラフトのときだけ通知 + 破棄ボタンを出す
      // (空文字タイトル/コメント・既定 public・publishUntil null だけの下書きでは誤発火させない)。
      if (hasMeaningfulDraft(restored)) setRestoredNoticeVisible(true);
    }

    // Task5 (spec §4.3): 一時ツアーからの一回限りプリフィル。create モードのみ消費し、
    // まだ空いているフィールドだけを埋める (上の復元・既存の初期値を上書きしない)。
    // 適用しても通知行は出さない (ユーザーが直前に自分で押した遷移のため)。
    if (mode === 'create') {
      const prefill = consumeRegisterPrefill();
      if (prefill) {
        const setPrefillIfEmpty = (key: keyof RegisterAddressValues, value: unknown) => {
          if (value === undefined) return;
          if ((addressPatch as Record<string, unknown>)[key] !== undefined) return; // 復元済みは上書きしない
          if ((address as Record<string, unknown>)[key] !== undefined) return; // 既存入力も上書きしない
          (addressPatch as Record<string, unknown>)[key] = value;
          fieldState.setAutoFilled(key, value);
        };
        setPrefillIfEmpty('area', prefill.area);
        setPrefillIfEmpty('ward', prefill.ward);
        setPrefillIfEmpty('buildingType', prefill.buildingType);
        setPrefillIfEmpty('plot', prefill.plot);
        setPrefillIfEmpty('size', prefill.size);
        setPrefillIfEmpty('apartmentBuilding', prefill.apartmentBuilding);
        setPrefillIfEmpty('roomNumber', prefill.roomNumber);

        // postUrl: 復元側が既に設定済み/既存入力があれば上書きしない。
        if (prefill.postUrl && !postUrlApplied && !postUrl.trim()) {
          setPostUrl(prefill.postUrl);
          restoreRefetchGuardRef.current = true;
          setRestoredSnsUrl(prefill.postUrl);
        }
      }
    }

    if (Object.keys(addressPatch).length > 0) {
      setAddress((prev) => ({ ...prev, ...addressPatch }));
      // 住所確認ゲート: 復元/プリフィルいずれも「住所が変わった」とみなし未確認にする (spec:1-1)。
      setAddressConfirmed(false);
    }

    // 復元/プリフィルの適用が終わったので以降の値変化から保存を再開する。
    autosaveReadyRef.current = true;
    // 依存は user/mode のみ (一度だけ実行)。fieldState は identity が変わるが restoreAppliedRef で二重適用を防ぐ。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode]);

  const handleDiscardRestore = useCallback(() => {
    try {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      /* noop */
    }
    setRestoredNoticeVisible(false);
    // 入力内容をクリアして初期状態に戻す。
    setTitle('');
    setDescription('');
    setTags([]);
    setAddress({});
    setPostUrl('');
    setVisibility('public');
    setVisibilityTouched(false);
    setPublishUntil(null);
    setAllowPromoTweet(true);
    setLocalImages([]);
    setSourceImageUrls([]);
    setSnsCapture(EMPTY_SNS_CAPTURE);
    for (const name of Object.keys(autosaveValues)) fieldState.clearField(name);
    // 復元 guard を解除し、initialUrl も消して SnsUrlField を再マウント (内部 url state もクリア)。
    restoreRefetchGuardRef.current = false;
    setRestoredSnsUrl(undefined);
    setMediaKey((k) => k + 1);
    // 2026-07-21 レビュー指摘 Bug2 fix: Batch2 で追加したガード state/ref も初期状態に戻す。
    // 未リセットのままだと、破棄後も addressAppliedRef が住所自動入力を永久にブロックしたり、
    // sourcePostUrls に残った URL を再度貼ると誤って重複扱いになったりする。
    setSourcePostUrls([]);
    capturedVideoRef.current = false;
    addressAppliedRef.current = false;
    setUrlSlotCount(1);
    // 最終レビュー指摘: 復元下書きを破棄したら、その下書き由来の抽出失敗バナーも残さない。
    setAddressExtractFailed(false);
  }, [autosaveValues, fieldState]);

  // ユーザーが URL 欄を手入力したら復元 guard を外す (以降の再取得は全フィールド上書きに戻す)。
  const handleUrlUserEdit = useCallback(() => {
    restoreRefetchGuardRef.current = false;
  }, []);

  return { restoredNoticeVisible, handleDiscardRestore, handleUrlUserEdit };
}
