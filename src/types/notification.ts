import type { ReportReason } from './housing';

export const NOTIFICATION_TYPES = ['housing_report', 'duplicate_alert'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const NOTIFICATION_SEVERITIES = ['normal', 'high'] as const;
export type NotificationSeverity = typeof NOTIFICATION_SEVERITIES[number];

export function isValidNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isValidSeverity(value: string): value is NotificationSeverity {
  return (NOTIFICATION_SEVERITIES as readonly string[]).includes(value);
}

/**
 * users/{uid}/notifications/{id} - アプリ内通知
 * 重要: 通報者の reporterUid はここに保存しない (家主に渡らない)
 *
 * type 別の意味:
 * - 'housing_report': 家主向け、 自分の listing が通報された。 reason 必須。
 * - 'duplicate_alert' (2026-05-27 追加): 家主向け、 同住所に新しいハウジングが登録された。
 *   listingId = 受信者自身の既存 listing (= 「今もあります」 を押す対象)、 reason なし。
 */
export interface HousingNotification {
  id: string;
  type: NotificationType;
  /** type='housing_report' / 'duplicate_alert' 共に「受信者がアクションする対象」 の listing id */
  listingId: string;
  /** 通報理由 (type='housing_report' の場合のみ必須、 他 type では undefined) */
  reason?: ReportReason;
  /** griefing / nsfw は 'high'、 他は 'normal'。 duplicate_alert は常に 'normal' */
  severity: NotificationSeverity;
  /** reason = 'other' の場合に通報者が入れたコメント */
  comment?: string;
  /** Listing 削除済みでも通知は残るため、 タイトルをスナップショット */
  listingTitleSnapshot?: string;
  createdAt: number;
  read: boolean;
  readAt?: number;
}
