/**
 * 運営からの通知 (broadcast 型、 全ユーザー共通)。
 * ハウジング側の HousingNotification (1-to-1 型) とは別系統。
 */

/** 4 言語の多言語テキスト。 ja/en は必須、 ko/zh は将来拡張用 optional。 */
export interface LocalizedText {
  ja: string;
  en: string;
  ko?: string;
  zh?: string;
}

/** Firestore system_notifications/{id} のスキーマ */
export interface SystemNotification {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  /** false にすると即時 UI から消える (削除と違い不可逆ではない) */
  published: boolean;
  /** 将来拡張用。 admin UI からは入力しない */
  link?: string;
  createdAt: number;
  updatedAt: number;
}

/** localStorage 'lopo:system_notifs:read' の保存形式 */
export interface SystemNotifReadState {
  readIds: string[];
  updatedAt: number;
}

/** Admin API のリクエストペイロード */
export interface SystemNotifCreatePayload {
  title: LocalizedText;
  body: LocalizedText;
  published: boolean;
}
export interface SystemNotifUpdatePayload extends Partial<SystemNotifCreatePayload> {
  /** undefined を Firestore で「変更なし」 として扱う */
}
