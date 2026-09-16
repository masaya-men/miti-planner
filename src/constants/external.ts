/**
 * 外部サービスへの固定リンク集約。
 * 複数コンポーネントから参照するため、個別ファイルへのハードコードを避けてここに集約する。
 */

/** Ko-fi 支援ページ */
export const KOFI_URL = 'https://ko-fi.com/lopoly';

/**
 * 2026-09-16 masaya 判断: FFXIV著作物利用条件(https://support.jp.square-enix.com/rule.php?id=5381)
 * 1条(1)が「商用・営利目的」に「寄付を募ること」を明記しているため、/support (Ko-fi 支援導線) を
 * 一時停止する。コードは残置(削除しない)。**再開判断もこのフラグの値も、必ずユーザー確認の上で変更する
 * こと(このコメントを読んだだけで true に戻さない)**。
 */
export const SUPPORT_PAGE_ENABLED = false;
