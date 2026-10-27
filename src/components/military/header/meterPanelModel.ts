/** SYNC ランプの状態(決定事項): 保存済み = 緑 / 保存中・未保存 = 琥珀 / エラー = 赤 / 未ログイン = 消灯 */
export function syncLampState(s: { loggedIn: boolean; status: 'idle' | 'syncing' | 'synced' | 'error'; dirty: boolean }): LedState {
  if (!s.loggedIn) return 'off';
  if (s.status === 'error') return 'dng';
  if (s.status === 'syncing' || s.dirty) return 'warn';
  return 'on';
}

/** 軍隊式の日時(DTG)。端末のローカル時刻 → 日 2 + 時 2 + 分 2 の 6 桁と、月・曜日の英字 3 文字(言語設定に関係なく英語大文字) */
export function dtgOf(d: Date): { digits: number[]; month: string; dow: string } {
  return {
    digits: (pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes())).split('').map(Number),
    month: MONTHS[d.getMonth()],
    dow: WEEKDAYS[d.getDay()],
  };
}

export type LedState = 'off' | 'on' | 'warn' | 'dng';

const pad2 = (n: number) => String(n).padStart(2, '0');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
