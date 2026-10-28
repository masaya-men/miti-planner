/**
 * ハウジング入力チェックの結果型と ok / fail (純粋関数)
 */
export type ValidationErrors = Partial<Record<string, string>>;
export interface ValidationResult { ok: boolean; errors: ValidationErrors; }

export const ok = (): ValidationResult => ({ ok: true, errors: {} });
export const fail = (errors: ValidationErrors): ValidationResult => ({ ok: false, errors });
