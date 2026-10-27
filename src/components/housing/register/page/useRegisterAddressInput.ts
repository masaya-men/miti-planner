import { useCallback, useEffect } from 'react';
import { parseHousingFromText, type HousingExtractResult } from '../../../../lib/housing/parseHousingFromText';
import { extractSizeToAddress } from '../../../../lib/housing/extractSizeToAddress';
import { deriveHouseSize } from '../../../../lib/housing/deriveHouseSize';
import type { RegisterFields } from './useRegisterFields';
import { TYPING_STAGGER_MS, ADDRESS_FIELD_NAMES } from './registerPageModel';

export function useRegisterAddressInput(f: RegisterFields) {
  const { address, setAddress, addressRef, fieldState, setAddressConfirmed, setAddressExtractFailed, addressAppliedRef, restoreRefetchGuardRef } = f;

  const handleAddressChange = (name: string, value: unknown) => {
    // ユーザーが住所を手編集したら、以降の SNS 再取得は復元 guard を外す
    // (通常の URL 貼付は全フィールド上書きに戻す)。
    restoreRefetchGuardRef.current = false;
    setAddress((prev) => ({ ...prev, [name]: value }));
    fieldState.userEdit(name, value);
    // 住所確認ゲート: 手編集は「住所が変わった」とみなし確認を解除する。
    setAddressConfirmed(false);
    setAddressExtractFailed(false);
  };

  /**
   * 住所確認ゲートの確認ボタン押下ハンドラ (Task1-1)。値が入っている住所系フィールドを
   * まとめて `fieldState.confirm()` し、初めて 'confirmed' (緑) 表示に到達させる。
   */
  const handleConfirmAddress = useCallback(() => {
    setAddressConfirmed(true);
    for (const name of ADDRESS_FIELD_NAMES) {
      if ((address as Record<string, unknown>)[name] !== undefined) {
        fieldState.confirm(name);
      }
    }
  }, [address, fieldState]);

  /**
   * size は (エリア × 区画) から一意に決まるので、**この effect が size の唯一の書き込み口**。
   *
   * `validateAddress` は house に plot 必須 / size 必須、apartment には size 不可を課すので、
   * 家であれば size は常に導出できる (FC 個室も親 plot のサイズ = 同じ関数で引ける)。
   * そのため UI 側の size 欄は disabled にしてあり (RegisterSectionAddress)、
   * 手入力・SNS 本文・オートセーブ復元・編集プリフィルのどれから来た値であっても
   * ここで区画由来の値に上書きする (区画 = ゲームの一次データが正)。
   *
   * fieldState への登録も必ず行う。requiredFieldsForAddress が 'size' を必須に数えるため、
   * 値だけ入れて fieldState が 'empty' のままだと isReadyToSubmit が永久に false になる。
   * すでに同じ値が入っている場合は setAutoFilled しない ('confirmed' を 'auto-filled' に
   * 巻き戻さないため)。
   */
  useEffect(() => {
    const derived = deriveHouseSize({
      buildingType: address.buildingType,
      area: address.area,
      plot: address.plot,
    });

    if (derived) {
      if (address.size !== derived) {
        setAddress((prev) => ({ ...prev, size: derived }));
      }
      if (fieldState.getValue('size') !== derived) {
        fieldState.setAutoFilled('size', derived);
      }
      return;
    }

    // 導出不可 (アパート / エリア未確定 / 区画未確定・範囲外) は size を持たせない。
    if (address.size !== undefined) {
      setAddress((prev) => ({ ...prev, size: undefined }));
    }
    if (fieldState.getState('size') !== 'empty') {
      fieldState.clearField('size');
    }
  }, [address.buildingType, address.area, address.plot, address.size, fieldState]);

  /**
   * parseHousingFromText の抽出結果を住所フィールドへ自動入力する共通処理。
   * 旧 HousingRegisterForm.tsx:123-151 の handleTweetFetched を移植し、ツイート/OGP
   * 両経路で共用できるよう分離した。size は extractSizeToAddress で
   * buildingType/roomKind/size モデルに変換してから展開する (dc/server/area/ward/plot は
   * そのまま渡す)。150ms スタッガーで 1 フィールドずつ自動入力し、
   * prefers-reduced-motion 時は即時反映する。
   *
   * spec:120: restoreRefetchGuardRef が true (復元起因の再取得中) のときは、適用時点で
   * 空のフィールド (address[name] === undefined) だけを埋める。復元済み・手修正済みの値は
   * 触らない。空判定はスタッガーの各適用時点の最新 address state (setAddress の prev) で行う。
   */
  const applyExtractedResult = useCallback(
    (result: HousingExtractResult) => {
      // 2026-07-21 追加 (Batch2): 複数URL対応。一度どれかのURLから住所を適用したら、
      // 以降のURL (2本目以降) から抽出された住所は無視する (「最初に見つかった方を採用」)。
      if (addressAppliedRef.current) return;
      const fills: Array<[string, unknown]> = [];
      if (result.dc) fills.push(['dc', result.dc]);
      if (result.server) fills.push(['server', result.server]);
      if (result.area) fills.push(['area', result.area]);
      if (result.ward != null) fills.push(['ward', result.ward]);
      if (result.plot != null) fills.push(['plot', result.plot]);
      if (result.size) {
        const converted = extractSizeToAddress(result.size);
        fills.push(['buildingType', converted.buildingType]);
        if (converted.roomKind) fills.push(['roomKind', converted.roomKind]);
        // アパート判定時は apartmentBuilding=1 (本街) を既定補完する (G 恒久ブロッカー根治)。
        // apartmentBuilding は validateAddress が 1|2 必須だが、自動判定は号棟を復元しないため
        // undefined のまま残り、号棟 select の value={apartmentBuilding ?? 1}=「1号棟」表示に
        // 隠れて addressOk=false→登録不可になる。EphemeralAddPanel も同じく apartment 検出時に
        // apartmentBuilding=1 を積んでいる (browse/EphemeralAddPanel.tsx の applyParse)。
        // normalize 側 (唯一のチョークポイント) でも補完済みだが、可視 state と fieldState を
        // 一致させて号棟表示・ステッパー完了印を正しくするためここでも積む。
        if (converted.buildingType === 'apartment') fills.push(['apartmentBuilding', 1]);
        // converted.size (S/M/L) はここでは**入れない**。house の size は (area, plot) から
        // 一意に決まるので、下の導出 effect が唯一の書き込み口になる。本文の "L" 表記が
        // 区画の実サイズと食い違っていても、区画側 (= ゲームの一次データ) を正とする。
      } else if (result.plot != null || result.apartmentBuilding != null || result.roomNumber != null) {
        // S/M/L 等のサイズ表記が本文に無くても、番地かアパート号棟/部屋番号が読み取れていれば
        // 建物タイプは実質確定している。parseHousingFromText は plot をアパート文脈でないと
        // 判定したときだけ、apartmentBuilding/roomNumber をアパート文脈と判定したときだけ設定する
        // ため(誤爆しない)、ここで house/apartment を選んでも新たな推測は増えない。これが無いと
        // 番地が自動入力済みなのに建物タイプだけ未選択のまま残り、番地欄自体が非表示になる
        // (isHouse/isApartment ゲート) UXギャップになる(2026-08-18 ユーザー実機報告)。
        const buildingType: 'house' | 'apartment' = result.plot != null ? 'house' : 'apartment';
        fills.push(['buildingType', buildingType]);
        if (buildingType === 'apartment') fills.push(['apartmentBuilding', 1]);
      }
      // アパートの号棟-部屋番号 (2026-07-13 round2 A-4)。パーサが確信を持って取れたときだけ
      // 値が入る (取れなければ undefined のまま = 誤値を作らない)。apartmentBuilding は
      // 上の既定値 1 補完より**後**に push することで、パーサが号棟 2 (拡張街) を検出できた
      // 場合に正しく上書きする (fills は setTimeout スタッガーで順に適用され、後勝ち)。
      if (result.roomNumber != null) fills.push(['roomNumber', result.roomNumber]);
      if (result.apartmentBuilding != null) fills.push(['apartmentBuilding', result.apartmentBuilding]);
      if (fills.length === 0) {
        // 復元起因の再取得 (spec:120) では「今回抽出できなかった」だけで、住所自体は既に
        // 復元済み値で正しく埋まっている可能性が高い。ここで失敗扱いにすると、正しく入力済みの
        // 住所欄の上に誤った「住所を読み取れませんでした」バナーが出てしまう (最終レビュー指摘)。
        if (!restoreRefetchGuardRef.current) setAddressExtractFailed(true);
        return;
      }
      setAddressExtractFailed(false);
      addressAppliedRef.current = true;

      // このハンドラ呼び出しが復元起因かをスナップショット (以降の setTimeout でも同じ値を使う)。
      const emptyOnly = restoreRefetchGuardRef.current;

      const applyOne = ([name, value]: [string, unknown]) => {
        // 復元起因の再取得では空フィールドのみ補完 (非空は上書きしない = spec:120)。
        // 空判定は最新 address を addressRef で読む (スタッガーで直前に埋めた値も反映される)。
        if (emptyOnly && (addressRef.current as Record<string, unknown>)[name] !== undefined) {
          return;
        }
        setAddress((prev) => ({ ...prev, [name]: value }));
        fieldState.setAutoFilled(name, value);
        // 住所確認ゲート: SNS 自動入力も「住所が変わった」とみなし確認を解除する。
        setAddressConfirmed(false);
      };

      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        fills.forEach(applyOne);
      } else {
        fills.forEach((fill, i) => {
          window.setTimeout(() => applyOne(fill), i * TYPING_STAGGER_MS);
        });
      }
    },
    [fieldState],
  );

  /**
   * ツイート本文など「1 本のテキスト」から住所を抽出して適用する (従来経路)。
   * OGP 経路はページ内に候補が複数あるので extractHousingAddressFromPage を使う (handleOgpFetched)。
   */
  const applyExtractedAddress = useCallback(
    (text: string) => applyExtractedResult(parseHousingFromText(text)),
    [applyExtractedResult],
  );

  return { handleAddressChange, handleConfirmAddress, applyExtractedResult, applyExtractedAddress };
}
