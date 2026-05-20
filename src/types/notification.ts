import type { ReportReason } from './housing';

export const NOTIFICATION_TYPES = ['housing_report'] as const;
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
 */
export interface HousingNotification {
  id: string;
  type: NotificationType;
  listingId: string;
  /** 通報理由 (type='housing_report' の場合) */
  reason: ReportReason;
  /** griefing / nsfw は 'high'、 他は 'normal' */
  severity: NotificationSeverity;
  /** reason = 'other' の場合に通報者が入れたコメント */
  comment?: string;
  /** Listing 削除済みでも通知は残るため、 タイトルをスナップショット */
  listingTitleSnapshot?: string;
  createdAt: number;
  read: boolean;
  readAt?: number;
}
