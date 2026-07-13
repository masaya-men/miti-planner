import type { RegisterAddressValues } from '../../components/housing/register/RegisterSectionAddress';

/**
 * buildingType と整合しない (UI 上不可視の) フィールドを落とす純関数 (実機ゲート B5 根治)。
 *
 * アパート選択中は番地/サイズ入力が画面から消えるが、state には残留し得る
 * (例: オートセーブ復元→SNS 再取得の「空欄のみ補完」が、ハウス住所ツイートの
 * plot/size を不可視フィールドへ注入する)。その状態で validateAddress にかけると
 * 'not_allowed_for_apartment' で永遠に不合格になり、見た目は全部埋まっているのに
 * 「住所を入力してください」から抜けられない。
 *
 * 検証 (addressCandidate)・重複照会・送信 draft は必ず本関数を通した値を使うこと。
 * 逆方向 (house 選択中のアパート専用フィールド残留) も対称に落とす。
 */
export function normalizeAddressForBuildingType(a: RegisterAddressValues): RegisterAddressValues {
  if (a.buildingType === 'apartment') {
    // apartment は plot/size を持てない (不可視フィールド残留を落とす)。
    //
    // さらに apartmentBuilding (号棟) は validateAddress が 1|2 必須。SNS 自動判定や手選択で
    // buildingType='apartment' にはなっても apartmentBuilding が undefined のまま残ると、
    // 号棟 select が value={apartmentBuilding ?? 1} で「1号棟」を表示して未設定を隠蔽するため、
    // 全項目が埋まって見えるのに addressOk=false→canSubmit=false で永遠に登録できなくなる (G 恒久ブロッカー)。
    // 1 でも 2 でもない (undefined/null 含む) 場合は既定 1 (本街アパート) を補完し、
    // 検証・重複照会・送信 draft がこのチョークポイントを通る全経路でブロッカーを潰す。
    const apartmentBuilding =
      a.apartmentBuilding === 1 || a.apartmentBuilding === 2 ? a.apartmentBuilding : 1;
    return { ...a, plot: undefined, size: undefined, apartmentBuilding };
  }
  if (a.buildingType === 'house') {
    const isChamber = a.roomKind === 'private_chamber';
    return {
      ...a,
      apartmentBuilding: undefined,
      roomKind: isChamber ? 'private_chamber' : undefined,
      roomNumber: isChamber ? a.roomNumber : undefined,
    };
  }
  return a;
}
