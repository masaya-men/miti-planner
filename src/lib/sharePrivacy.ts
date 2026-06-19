/**
 * 共有プライバシー: 共有/コピーに載せない「個人状態」フィールドを取り除く。
 *
 * 対象フィールド:
 *  - `progress` … 進捗トラッキング（その人がどこまで進んだか・活動日数・踏破）。完全に個人状態。
 *  - `memos`    … メモ（個人情報を書いている可能性があるため共有しない。2026-06-19 ユーザー判断）。
 *
 * 非破壊（入力は変更せず新オブジェクトを返す）。
 * サーバ(api/share の POST 保存時・GET 返却時)とクライアント(ShareModal 送信前)の二重防御で使う。
 * ⚠ getSnapshot や自分のプラン保存(syncToFirestore)では使わない（自分の進捗/メモは保持する）。
 */
export function stripSharedPersonalData<T>(planData: T): T {
    if (!planData || typeof planData !== 'object') return planData;
    const clone: Record<string, unknown> = { ...(planData as Record<string, unknown>) };
    delete clone.progress;
    delete clone.memos;
    return clone as T;
}
