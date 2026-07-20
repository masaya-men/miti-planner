/**
 * ハウジング系統合エンドポイント
 *
 * ?action=can-register              → GET 登録可能か判定 (auth + housing_user_meta 読み)
 * ?action=register-listing          → POST 物件登録 (canRegister + listings 作成 + meta 更新)
 * ?action=check-duplicate           → POST 同住所重複検索
 * ?action=update-listing            → POST 物件編集 (ownerUid 認可)
 * ?action=delete-listing            → POST 物件 soft delete (ownerUid 認可)
 * ?action=report-listing            → POST 物件通報 (reports + reportCount + 通知 doc)
 * ?action=list-notifications        → GET 自分の通知一覧
 * ?action=mark-notification-read    → POST 通知既読化 (1 件 or 全件)
 * ?action=delete-notification       → POST 通知削除 (1 件 or listingId 単位、 解決時に消す)
 * ?action=resolve-report            → POST 通報対処+自己復帰 (非表示解除、 ownerUid 認可)
 * ?action=purge-if-tweet-gone       → POST SNS 物件のツイート削除を再確認し 404 なら soft delete
 * ?action=upload-thumbnail          → POST 物件のサムネ画像を base64 で受領 → Firebase Storage に保存
 * ?action=delete-thumbnail          → POST 直接アップロード画像を1枚削除 (後続を繰り上げ)
 * ?action=confirm-listing           → POST 家主が「今もあります」 で lastConfirmedAt を更新 (Phase 2-2)
 * ?action=my-personal-tag           → GET 自分の個人タグ取得 (未作成なら null。 作成は無く、
 *                                      upsert-housinger-profile 公開時に自動作成される — タグ刷新
 *                                      Phase B との統合契約1で create-personal-tag action は廃止)
 * ?action=search-personal-tags      → GET 個人タグ検索 (探すページのフィルタ用オートコンプリート)
 * ?action=report-personal-tag       → POST 個人タグ通報
 * ?action=upsert-housinger-profile  → POST ハウジンガープロフィール 公開/更新/非公開/同期 (冪等)
 * ?action=report-housinger          → POST ハウジンガープロフィール通報
 * ?action=create-shared-tour        → POST 招待ツアー発行 (幹事ログイン必須・shared_tours 作成)
 * ?action=join-shared-tour          → POST 参加者の入場ゲート+heartbeat (認証不要・匿名・presence 集計で300人ソフト上限)
 * ?action=gc-shared-tours           → POST cron 専用: 期限切れ共有ツアーの物理削除 (CRON_SECRET認証・日次)
 */
import canRegisterHandler from './_canRegisterHandler.js';
import registerListingHandler from './_registerListingHandler.js';
import checkDuplicateHandler from './_checkDuplicateHandler.js';
import updateListingHandler from './_updateListingHandler.js';
import deleteListingHandler from './_deleteListingHandler.js';
import reportListingHandler from './_reportListingHandler.js';
import listNotificationsHandler from './_listNotificationsHandler.js';
import markNotificationReadHandler from './_markNotificationReadHandler.js';
import deleteNotificationHandler from './_deleteNotificationHandler.js';
import resolveReportHandler from './_resolveReportHandler.js';
import purgeIfTweetGoneHandler from './_purgeIfTweetGoneHandler.js';
import uploadThumbnailHandler from './_uploadThumbnailHandler.js';
import deleteThumbnailHandler from './_deleteThumbnailHandler.js';
import confirmListingHandler from './_confirmListingHandler.js';
import myPersonalTagHandler from './_myPersonalTagHandler.js';
import searchPersonalTagsHandler from './_searchPersonalTagsHandler.js';
import reportPersonalTagHandler from './_reportPersonalTagHandler.js';
import upsertHousingerProfileHandler from './_upsertHousingerProfileHandler.js';
import reportHousingerHandler from './_reportHousingerHandler.js';
import createSharedTourHandler from './_createSharedTourHandler.js';
import joinSharedTourHandler from './_joinSharedTourHandler.js';
import gcSharedToursHandler from './_gcSharedToursHandler.js';
import { publicWindowHandler } from './_publicWindow.js';

// 公開読みキャッシュ窓口の action (App Check 不要・匿名可・Cloudflare キャッシュ対象)。
// クライアントは /api/housing/public?action=... を叩き、vercel.json の rewrite で
// /api/housing へ寄せる。独立関数を増やさない (Vercel Hobby 12 関数上限回避)。
const PUBLIC_WINDOW_ACTIONS = new Set(['version', 'gallery', 'housinger', 'listing']);

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  // App Check 検証より前に公開窓口へ委譲 (窓口は匿名で触れる公開データのみ返す)。
  if (typeof action === 'string' && PUBLIC_WINDOW_ACTIONS.has(action)) {
    return publicWindowHandler(req, res);
  }

  switch (action) {
    case 'can-register':
      return canRegisterHandler(req, res);
    case 'register-listing':
      return registerListingHandler(req, res);
    case 'check-duplicate':
      return checkDuplicateHandler(req, res);
    case 'update-listing':
      return updateListingHandler(req, res);
    case 'delete-listing':
      return deleteListingHandler(req, res);
    case 'report-listing':
      return reportListingHandler(req, res);
    case 'list-notifications':
      return listNotificationsHandler(req, res);
    case 'mark-notification-read':
      return markNotificationReadHandler(req, res);
    case 'delete-notification':
      return deleteNotificationHandler(req, res);
    case 'resolve-report':
      return resolveReportHandler(req, res);
    case 'purge-if-tweet-gone':
      return purgeIfTweetGoneHandler(req, res);
    case 'upload-thumbnail':
      return uploadThumbnailHandler(req, res);
    case 'delete-thumbnail':
      return deleteThumbnailHandler(req, res);
    case 'confirm-listing':
      return confirmListingHandler(req, res);
    case 'my-personal-tag':
      return myPersonalTagHandler(req, res);
    case 'search-personal-tags':
      return searchPersonalTagsHandler(req, res);
    case 'report-personal-tag':
      return reportPersonalTagHandler(req, res);
    case 'upsert-housinger-profile':
      return upsertHousingerProfileHandler(req, res);
    case 'report-housinger':
      return reportHousingerHandler(req, res);
    case 'create-shared-tour':
      return createSharedTourHandler(req, res);
    case 'join-shared-tour':
      return joinSharedTourHandler(req, res);
    case 'gc-shared-tours':
      return gcSharedToursHandler(req, res);
    default:
      return res.status(400).json({
        error:
          'Missing or invalid action parameter. Use ?action=can-register|register-listing|check-duplicate|update-listing|delete-listing|report-listing|list-notifications|mark-notification-read|delete-notification|resolve-report|purge-if-tweet-gone|upload-thumbnail|delete-thumbnail|confirm-listing|my-personal-tag|search-personal-tags|report-personal-tag|upsert-housinger-profile|report-housinger|create-shared-tour|join-shared-tour',
      });
  }
}
