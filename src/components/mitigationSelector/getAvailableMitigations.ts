import type { Mitigation, AppliedMitigation } from '../../types';
import { getMitigationPriority } from '../../hooks/useSkillsData';
import { resolveSeraphismMitigation } from '../../utils/scholarShieldRules';

interface GetAvailableMitigationsArgs {
    allJobMitigations: Mitigation[];
    currentLevel: number;
    activeMitigations: AppliedMitigation[];
    selectedTime: number;
    isSeraphActive: boolean;
    isSeraphismActive: boolean;
    MITIGATIONS: Mitigation[];
}

// 軽減追加の窓に並べる技の一覧(レベル・前提・隠しの絞り込み → 並び替え → セラフィム/セラフィズム中の差し替え)。
export const getAvailableMitigations = ({
    allJobMitigations, currentLevel, activeMitigations, selectedTime, isSeraphActive, isSeraphismActive, MITIGATIONS,
}: GetAvailableMitigationsArgs) => {
    return allJobMitigations
        .filter((m: Mitigation) => {
            // Level sync filtering
            if (m.minLevel !== undefined && currentLevel < m.minLevel) return false;
            if (m.maxLevel !== undefined && currentLevel > m.maxLevel) return false;

            // Filter out hidden skills (e.g., Adloquium)
            if (m.hidden) return false;

            if (!m.requires) return true;

            // AST カード専用: 最新のドローが対応する種別か (手札は次のドローまで保持される仕様)
            if (m.requires === 'astral_draw' || m.requires === 'umbral_draw') {
                const drawsBeforeNow = activeMitigations
                    .filter(am => am.mitigationId === 'astral_draw' || am.mitigationId === 'umbral_draw')
                    .filter(am => am.time <= selectedTime)
                    .sort((a, b) => b.time - a.time);
                if (drawsBeforeNow.length === 0) return false;
                return drawsBeforeNow[0].mitigationId === m.requires;
            }

            return activeMitigations.some(am => {
                const isNeutSect = am.mitigationId === 'neutral_sect';
                const isHoroscope = am.mitigationId === 'horoscope';
                // requiresWindow がある場合はそちらを使用（例: 金剛周天は30秒窓）
                const window = m.requiresWindow ?? am.duration;
                const isActive = selectedTime >= am.time && selectedTime < am.time + window;
                if (!isActive) return false;

                // Special handling for Astrologian conditional skills
                if (m.requires === 'neutral_sect') {
                    // Sun Sign MUST have Neutral Sect active
                    if (m.id === 'sun_sign') {
                        return isNeutSect;
                    }
                    // Helios-based skills can use either Neutral Sect or Horoscope
                    return isNeutSect || isHoroscope;
                }

                return am.mitigationId === m.requires;
            });
        })
        // ソートは「すり替え前」の id で行う。すり替え後の id でソートすると、セラフィズムの
        // 発動/終了のたびに一覧内の表示位置が飛んでしまうため。
        .sort((a: Mitigation, b: Mitigation) => getMitigationPriority(a.id) - getMitigationPriority(b.id))
        .map((m: Mitigation) => {
            // セラフィズム中: 鼓舞激励の策→マニフェステーション、意気軒高の策→アクセッション
            const seraphismResolved = isSeraphismActive
                ? resolveSeraphismMitigation(m, selectedTime, activeMitigations, MITIGATIONS)
                : m;
            if (seraphismResolved !== m) return seraphismResolved;

            // Scholar Seraph dynamic changes (サモン・セラフィム中の名称のみ変更)
            if (isSeraphActive) {
                if (m.id === 'whispering_dawn') {
                    return { ...m, name: { ...m.name, ja: '光輝の囁き', en: 'Angel\'s Whisper' }, icon: '/icons/Angel\'s_Whisper.png' };
                }
                if (m.id === 'fey_illumination') {
                    return { ...m, name: { ...m.name, ja: 'セラフィックイルミネーション', en: 'Seraphic Illumination' }, icon: '/icons/Seraphic_Illumination.png' };
                }
            }
            return m;
        });
};
