/** 軽減などの新規 id。Timeline の本体と TimelineMobileSheets の両方で使う。 */
export function genId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id_' + Math.random().toString(36).substring(2, 9);
}
