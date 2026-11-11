/**
 * 「色で探す」の欄(colorFamilies / colorRule)を Firestore の更新に載せるための小さな道具。
 * 代表の写真が変わる処理は、古い色を必ず失効させる(残すと別の写真の色で探しに出てしまう)。
 */
import { FieldValue } from 'firebase-admin/firestore';
import { validateListingColors } from '../../src/lib/housing/color/housingColorValidate.js';

/** 代表の写真が変わった時に update へ足す: 色の欄を 2 つとも消す。 */
export function colorInvalidation(): Record<string, unknown> {
  return { colorFamilies: FieldValue.delete(), colorRule: FieldValue.delete() };
}

/** 検証済みの色だけを update へ足す形にする。許可外・欠落は null(= 保存しない)。 */
export function validatedColorFields(input: unknown): { colorFamilies: string[]; colorRule: number } | null {
  const v = validateListingColors(input);
  return v.ok ? { colorFamilies: v.colorFamilies, colorRule: v.colorRule } : null;
}

/**
 * 登録 (register-listing) の本文に同梱された色を、保存してよい形にする。
 * sns の家(X・YouTube・OGP)だけ: 代表の写真は登録時点で決まっている。
 * 直接アップロードの家は画像を送る時(upload-thumbnail の index 0)に色が付く。
 */
export function registrationColorFields(
  body: unknown,
  imageFields: { imageMode?: string },
): { colorFamilies?: string[]; colorRule?: number } {
  if (imageFields.imageMode !== 'sns') return {};
  return validatedColorFields(body) ?? {};
}
