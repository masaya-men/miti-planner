import type { AppliedMitigation, Mitigation } from '../../types';

/** 軽減アイコンの画像 URL を決める(iconOverride > 学者セラフィム中の置換 > 既定アイコン) */
export function getEffectiveIcon(
    iconOverride: string | undefined,
    def: Mitigation | undefined,
    activeMitigations: AppliedMitigation[],
    mitigation: AppliedMitigation,
): string {
    if (iconOverride) return iconOverride;
    if (!def) return "/icons/Placeholder.png";

    // アーサリースターの動的変化判定 (設置後10秒で変化)
    if (def.id === 'earthly_star') {
        // タイムライン上の表示位置（selectedTimeではない、個別のアイテム位置）
        // ここでは簡易的に現在の配置時間からの経過で判定するロジックを想定
        // シミュレーターとして「10秒後の位置」を特定するのは描画ロジックに依存するため
        // 配置されたオブジェクト自体は1つのため、アイコン1つを表示する
        // ユーザー要望: 10秒後に巨星へ。表示を分ける場合は別ロジックだが
        // ここでは「配置したスターが10s経過位置にあるか」ではなく「スター自体」を表示
    }

    // 学者: サモン・セラフィム中のアイコン置換
    const isSeraphActive = activeMitigations.some(am =>
        am.mitigationId === 'summon_seraph' &&
        am.ownerId === mitigation.ownerId &&
        mitigation.time >= am.time &&
        mitigation.time < am.time + am.duration
    );

    if (isSeraphActive) {
        if (def.id === 'whispering_dawn') return "/icons/Angel's_Whisper.png";
        if (def.id === 'fey_illumination') return "/icons/Seraphic_Illumination.png";
    }

    return def.icon;
}
