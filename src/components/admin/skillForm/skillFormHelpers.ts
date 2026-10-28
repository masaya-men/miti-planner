/**
 * スキル追加/編集モーダル — 新規スキルの初期値と ID スラッグ生成
 */
import type { Mitigation } from '../../../types';

/** デフォルト値で新規スキルを作成 */
export function createDefaultSkill(jobId: string): Mitigation {
    return {
        id: '',
        jobId,
        name: { ja: '', en: '' },
        icon: '',
        duration: 15,
        recast: 60,
        type: 'all',
        value: 10,
        scope: 'party',
    };
}

/** IDスラッグ生成 */
export function slugify(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
