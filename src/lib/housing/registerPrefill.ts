import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';

/**
 * 「住所登録なし一時ツアー」からの「この家を登録する」→ 登録フォームへの一回限り受け渡し
 * (計画書 §4.3, Task5)。
 *
 * ページ遷移をまたぐ一時データのため sessionStorage を使う (タブを閉じる/リロードで消える。
 * ephemeral listing 本体と同じ「使い捨て」思想)。`consumeRegisterPrefill` は読んだら即座に
 * sessionStorage から削除するため、2回目以降の呼び出しは常に null になる
 * (ブラウザバック等で誤って再適用されることを防ぐ)。
 */
const KEY = 'housing-register-prefill';

/** 登録フォームへ一回限り引き継ぐ内容 (一時 listing の住所系 + SNS URL のみ)。 */
export interface RegisterPrefill {
  area?: HousingArea;
  ward?: number;
  buildingType?: 'house' | 'apartment';
  plot?: number;
  size?: HousingSize;
  apartmentBuilding?: 1 | 2;
  roomNumber?: number;
  postUrl?: string;
}

/** 「この家を登録する」押下時に、遷移先の登録フォームへ渡す内容を保存する。 */
export function saveRegisterPrefill(p: RegisterPrefill): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sessionStorage 不可でも致命的でない (プリフィルなしで登録フォームが開くだけ) */
  }
}

/**
 * 保存済みのプリフィルを読み取り、即座に削除する (一回限り)。
 * - 未保存 → null
 * - 壊れた JSON / object でない値 → null (読んだ形跡は削除するため、再度呼んでも例外なく null)
 */
export function consumeRegisterPrefill(): RegisterPrefill | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw == null || raw === '') return null;

  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* 削除に失敗しても読めた値自体は返す (再消費されても実害は軽微) */
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as RegisterPrefill;
  } catch {
    return null;
  }
}
