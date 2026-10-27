import type { AppliedMitigation } from '../types';
import { PARTY_MEMBER_IDS } from '../constants/party';

/** 軽減アイコンを「1行に入りきる分」と「あふれた分」に分ける(グルーピング込み)。
 * MitiIcons(2行目に表示)とMobileTimelineRow(あふれた分を1行目のダメージ表記エリアに表示)の
 * 両方が同じ分け方を使う必要があるため共通関数化(バラバラに計算すると数がズレるバグの元に
 * なる。2026-08-13実機検証で実際に1件ズレるバグを踏んだ)。
 * visibleMemberIds: 表示/非表示スイッチで隠していないメンバーID(2026-08-19)。省略時は全員表示。
 * 隠したメンバーのアイコンは「+N」あふれ扱いにはせず、そのまま非表示にする(orphan 判定=
 * 「スロットIDとして未知かどうか」は非表示状態に関わらず変えない)。 */
export function groupAndCapMitigations(
    mitigations: AppliedMitigation[],
    maxIcons: number | undefined,
    visibleMemberIds?: readonly string[],
) {
    // 表示/非表示スイッチで隠したメンバーの分は、以降の計算(あふれ判定・「+N」あふれ扱い)
    // に一切混ざらないよう最初に取り除く。「+N」タップで復活してしまうバグを防ぐため、
    // このあとは raw な mitigations を絶対に参照しない(2026-08-19)。
    const knownIds = new Set<string>(PARTY_MEMBER_IDS);
    const visibleIdSet = new Set<string>(visibleMemberIds ?? PARTY_MEMBER_IDS);
    // orphan(未知スロットID)は非表示スイッチの対象外(そもそも対応するメンバーが無いため)。
    const mitigationsInScope = mitigations.filter(
        (m) => !knownIds.has(m.ownerId) || visibleIdSet.has(m.ownerId)
    );

    // 表示順は常に MT→ST→H1→H2→D1〜D4 固定(PARTY_MEMBER_IDS)。PC の並び替え設定
    // (partySortOrder='light_party' 等)の影響を受けない — スマホは常に同じ並びにする。
    const groups: { key: string; items: AppliedMitigation[] }[] = PARTY_MEMBER_IDS
        .filter(id => visibleIdSet.has(id))
        .map(id => ({ key: id, items: mitigationsInScope.filter(m => m.ownerId === id) }))
        .filter(g => g.items.length > 0);
    const orphan = mitigationsInScope.filter(m => !knownIds.has(m.ownerId));
    if (orphan.length > 0) groups.push({ key: 'orphan', items: orphan });

    // 「+N」バッジ自体も1枠分の幅を使うため、あふれる場合はバッジの分を1枠減らして確保する
    // (2026-08-13実機検証: バッジの分を引かずに満タンまで表示すると行の見積り幅を超える)。
    const cap = maxIcons ?? Infinity;
    const overflowCount = Math.max(0, mitigationsInScope.length - cap);
    let visibleBudget = overflowCount > 0 ? Math.max(0, cap - 1) : cap;
    const visibleGroups: { key: string; items: AppliedMitigation[] }[] = [];
    for (const g of groups) {
        if (visibleBudget <= 0) break;
        const take = g.items.slice(0, visibleBudget);
        if (take.length > 0) visibleGroups.push({ key: g.key, items: take });
        visibleBudget -= take.length;
    }
    const visibleIds = new Set(visibleGroups.flatMap(g => g.items.map(i => i.id)));
    const hiddenMitigations = mitigationsInScope.filter(m => !visibleIds.has(m.id));
    return { visibleGroups, hiddenMitigations };
}
