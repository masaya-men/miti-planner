/** i18nキーで「,」区切りのリストを配列に変換 */
export function splitItems(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}
