import type { Mitigation, PartyMember } from '../types';

/**
 * スキルモード（リボーン / エヴォルヴ）。
 * - reborn: 旧モード。基本データそのまま
 * - evolved: 新モード（8.0 想定）。Mitigation.modes.evolved の差分を適用
 */
export type SkillMode = 'reborn' | 'evolved';

/**
 * 新規 PartyMember 作成時に書き込むデフォルトモード。
 *
 * 8.0 リリース時にこの 1 行を 'evolved' に変更してデフォルト切替する。
 * 注意: 既存プラン（mode フィールド未指定）には影響しない。
 *      getMode() のフォールバックは互換性保証のため永久に 'reborn' 固定。
 */
export const DEFAULT_NEW_MODE: SkillMode = 'reborn';

/**
 * PartyMember のスキルモードを取得する。
 *
 * 未指定時は 'reborn' を返す。このフォールバック値は既存プラン互換性のため
 * 永久に変更しない（DEFAULT_NEW_MODE と独立）。
 */
export function getMode(member: PartyMember): SkillMode {
    return member.mode ?? 'reborn';
}

/**
 * Mitigation を指定モードで解決し、差分を適用したオブジェクトを返す。
 *
 * - reborn: 入力をそのまま返す（参照同一性維持）
 * - evolved + 差分なし: 入力をそのまま返す（参照同一性維持）
 * - evolved + Partial 差分: spread でマージした新オブジェクト
 * - evolved + { disabled: true }: null（エヴォルヴモードでは存在しないスキル）
 *
 * @returns 解決済み Mitigation、または disabled の場合 null
 */
export function resolveMitigation(
    m: Mitigation,
    mode: SkillMode,
): Mitigation | null {
    if (mode === 'reborn') return m;
    const diff = m.modes?.evolved;
    if (!diff) return m;
    if ('disabled' in diff && diff.disabled === true) return null;
    return { ...m, ...(diff as Partial<Mitigation>) };
}
