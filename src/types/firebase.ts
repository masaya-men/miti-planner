/**
 * Firebase/Firestore用の型定義
 *
 * 既存の PlanData 型を再利用し、Firestore固有のフィールド（Timestamp等）を追加する。
 * クライアント側では Timestamp → number（ミリ秒）に変換した型を使用する。
 */

import type { Timestamp } from 'firebase/firestore';
import type { PlanData } from './index';

// ========================================
// Firestoreドキュメント型（サーバー側の型）
// ========================================

/** users/{uid} ドキュメント */
export interface FirestoreUser {
  /** ユーザーが設定した表示名（本名ではない） */
  displayName: string;
  /** アバター画像URL */
  avatarUrl: string | null;
  /** 認証プロバイダ */
  provider: 'google' | 'discord' | 'twitter';
  /** アカウント作成日時 */
  createdAt: Timestamp;
  /** 最終更新日時 */
  updatedAt: Timestamp;
  /** アプリ設定 */
  settings: UserSettings;
  /** チームロゴのダウンロードURL（Firebase Storage） */
  teamLogoUrl?: string | null;
}

/** ユーザー設定 */
export interface UserSettings {
  /** 表示言語 */
  language: 'ja' | 'en';
  /** デフォルトのレベル同期設定 */
  defaultLevel: number;
}

/** plans/{planId} ドキュメント */
export interface FirestorePlan {
  /** プラン所有者のFirebase Auth UID */
  ownerId: string;
  /** 所有者の表示名（非正規化キャッシュ） */
  ownerDisplayName: string;
  /** プラン名 */
  title: string;
  /** コンテンツID（例: "aac_lhw_m4s"） */
  contentId: string;
  /** 共有が有効かどうか */
  isPublic: boolean;
  /** 共有用短縮ID（nanoid 10文字） */
  shareId: string | null;
  /** コピーされた回数 */
  copyCount: number;
  /** 閲覧回数 */
  useCount: number;
  /** 軽減プランのフルデータ */
  data: PlanData;
  /** 楽観的ロック用バージョン番号 */
  version: number;
  /** 作成日時 */
  createdAt: Timestamp;
  /** 最終更新日時 */
  updatedAt: Timestamp;
  /** アーカイブ済みの場合のタイムスタンプ */
  archivedAt: Timestamp | null;
}

/** sharedPlanMeta/{shareId} ドキュメント */
export interface FirestoreSharedPlanMeta {
  /** 実プランのドキュメントID */
  planId: string;
  /** プラン所有者のUID */
  ownerId: string;
  /** 所有者の表示名 */
  ownerDisplayName: string;
  /** プラン名 */
  title: string;
  /** コンテンツID */
  contentId: string;
  /** 作成日時 */
  createdAt: Timestamp;
  /** プランが有効かどうか（削除時にfalse） */
  isActive: boolean;
}

/** userPlanCounts/{uid} ドキュメント */
export interface FirestoreUserPlanCounts {
  /** 全プラン数 */
  total: number;
  /** コンテンツ別プラン数 */
  byContent: Record<string, number>;
  /** 最終更新日時 */
  updatedAt: Timestamp;
}

// ========================================
// クライアント側の型（Timestamp → number変換後）
// ========================================

/** Firestoreから取得後のプラン型 */
export interface ClientPlan {
  /** FirestoreドキュメントID */
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  contentId: string;
  isPublic: boolean;
  shareId: string | null;
  copyCount: number;
  useCount: number;
  data: PlanData;
  version: number;
  /** ミリ秒タイムスタンプ */
  createdAt: number;
  /** ミリ秒タイムスタンプ */
  updatedAt: number;
  archivedAt: number | null;
}

/** プラン一覧表示用の軽量型（dataフィールドを除外） */
export interface PlanListItem {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  contentId: string;
  isPublic: boolean;
  shareId: string | null;
  copyCount: number;
  updatedAt: number;
}

/** 共有プランのメタデータ（クライアント側） */
export interface ClientSharedPlanMeta {
  shareId: string;
  planId: string;
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  contentId: string;
  createdAt: number;
  isActive: boolean;
}

// ========================================
// 定数
// ========================================

/** プラン数やフィールド長の上限値 */
export const PLAN_LIMITS = {
  /** 1ユーザーの最大プラン数 */
  MAX_TOTAL_PLANS: 50,
  /** 1コンテンツあたりの最大プラン数 */
  MAX_PLANS_PER_CONTENT: 5,
  /** アーカイブ警告を表示する閾値 */
  ARCHIVE_WARNING_THRESHOLD: 30,
  /** プランタイトルの最大文字数 */
  MAX_TITLE_LENGTH: 100,
  /** 表示名の最大文字数 */
  MAX_DISPLAY_NAME_LENGTH: 30,
  /** 共有IDの長さ */
  SHARE_ID_LENGTH: 10,
  /** プラン保存のデバウンス間隔（ミリ秒） */
  SAVE_DEBOUNCE_MS: 5_000,
  /** アーカイブまでの日数 */
  ARCHIVE_AFTER_DAYS: 90,
} as const;

/** Firestoreコレクション名 */
export const COLLECTIONS = {
  USERS: 'users',
  PLANS: 'plans',
  SHARED_PLAN_META: 'sharedPlanMeta',
  USER_PLAN_COUNTS: 'userPlanCounts',
} as const;
