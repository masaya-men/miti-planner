import type { SavedPlan } from '../../types';
import { auth } from '../../lib/firebase';

/**
 * 新規作成プランに「ログイン中作成」 フラグを付与する共通 helper。
 *
 * 背景: `ownerId='local'` マーカーは「Firestore に未アップロード」 の技術判定に
 * 使われていて、 これに「ユーザー本人の意思でアップしてない (= 取り込みダイアログ
 * 対象)」 という UX 判定も乗せていたため誤発火していた。
 *
 * このフィールド (`_createdLoggedIn`) で UX 判定を独立させ、 ログイン中作成プランは
 * Firestore SDK のオフラインキュー経由で自動同期される (= ダイアログ不要)。
 *
 * **新規プラン作成経路は必ずこの helper を通すこと**。 直接 `addPlan` を呼ぶ場合は
 * addPlan 内で自動適用されるが、 `duplicatePlan` 等 `addPlan` を経由しない経路では
 * 各実装内で明示的に呼ぶ必要がある。
 *
 * 認証状態は `auth.currentUser` から直接読む (useAuthStore 循環 import 回避)。
 */
export function tagCreationIntent(plan: SavedPlan): SavedPlan {
    // 既に uid 化されてる = 既存プランなので何もしない
    if (plan.ownerId !== 'local') return plan;
    // 既に明示的に設定済みなら尊重 (例: backupRestore で false を明示する等の将来用途)
    if (plan._createdLoggedIn !== undefined) return plan;
    const isLoggedIn = !!auth.currentUser?.uid;
    return { ...plan, _createdLoggedIn: isLoggedIn };
}
