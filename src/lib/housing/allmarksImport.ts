/**
 * Allmarks (マイコラージュ) の共有リンクから、一時ツアーへまとめてインポートする機能
 * (2026-08-19)。
 *
 * 背景: 一時ツアー(住所登録なし)は元々「URLを1件貼る→住所を読み取る→追加」を繰り返す
 * 一件ずつの仕組み(`EphemeralAddPanel.tsx`)。Allmarksには既に「ボードをタグで絞り込んで
 * 共有リンクを発行する」機能(最大100件・公開JSON APIで元URL一覧を誰でも取得可能)がある
 * ため、Allmarks側は一切変更せず、LoPo側でその共有リンクを検出→中身のURLを取り出し→
 * 既存の「URLから住所を読み取る」処理にループで通す、という形で実現する。
 *
 * 2026-07-16 に一度検討され却下された「短いハンドル」案(ハウジンガー短縮URL、
 * housingerProfile.ts 参照)とは別件。あちらは名前を鍵にする設計、こちらは既存の
 * Allmarks共有APIをそのまま叩くだけで新しいデータは一切持たない。
 */
import { classifySnsUrl } from './snsUrlRouting';
import { parseHousingFromText, type HousingExtractResult } from './parseHousingFromText';
import { extractHousingAddressFromPage } from './extractHousingAddressFromPage';
import type { TweetData } from './useTweetFetch';
import type { OgpData } from './useOgpFetch';
import type { YoutubeMetaData } from './useYoutubeFetch';

/** Allmarksの共有ID(6桁の英数字、Allmarks側 `lib/share/kv-id.ts` の isValidShareId と同一形式)。 */
const ALLMARKS_SHARE_ID_RE = /^[A-Za-z0-9]{6}$/;
const ALLMARKS_SHARE_URL_RE = /^https?:\/\/(?:www\.)?allmarks\.app\/s\/([A-Za-z0-9]{6})(?:[/?#].*)?$/i;

/** 貼られたURLがAllmarksの共有リンクなら共有IDを返す (それ以外は null)。 */
export function parseAllmarksShareUrl(value: string): string | null {
  const match = ALLMARKS_SHARE_URL_RE.exec(value.trim());
  return match ? match[1] : null;
}

export function isValidAllmarksShareId(id: string): boolean {
  return ALLMARKS_SHARE_ID_RE.test(id);
}

/** SNS 由来のメタデータ (登録リンク引き継ぎ + 代表画像)。EphemeralAddPanel.tsx の SnsSource と同形。 */
export interface AllmarksImportSource {
  postUrl: string;
  ogImageUrl?: string;
  sourceImageUrls?: string[];
}

export interface AllmarksImportResolved {
  result: HousingExtractResult;
  source: AllmarksImportSource | null;
}

/**
 * サーバーから Allmarks 共有の中身(元URL一覧)を取得する。
 * `/api/housing?action=fetch-allmarks-share&shareId=...` (新規サーバー機能は追加しない、
 * 既存のハウジング統合エンドポイントに相乗り)。取得できなければ空配列。
 */
export async function fetchAllmarksShareUrls(shareId: string): Promise<string[]> {
  if (!isValidAllmarksShareId(shareId)) return [];
  try {
    const res = await fetch(`/api/housing?action=fetch-allmarks-share&shareId=${encodeURIComponent(shareId)}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { urls?: unknown };
    return Array.isArray(json.urls) ? json.urls.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 1件のURLを「種別判定→取得→本文/概要欄から住所を解釈」まで通しで行う純粋な非同期関数。
 * `EphemeralAddPanel.tsx` の useTweetFetch/useOgpFetch/useYoutubeFetch 各 hook が行っている
 * 処理と同じ判定順・同じエンドポイントを、React state を介さずループ内で呼べる形にしたもの。
 * 取得/解釈に失敗したら null (呼び出し側は「読み取れませんでした」の1件としてカウントする。
 * 原因は区別しない=2026-08-17 YouTube概要欄住所自動入力の失敗表示方針と同じ)。
 */
export async function resolveHousingAddressFromUrl(url: string): Promise<AllmarksImportResolved | null> {
  const route = classifySnsUrl(url);
  try {
    switch (route.kind) {
      case 'youtube': {
        const res = await fetch(`/api/youtube-meta?videoId=${encodeURIComponent(route.videoId)}`);
        if (!res.ok) return null;
        const data = (await res.json()) as YoutubeMetaData;
        const result = parseHousingFromText(data.description ?? '');
        return { result, source: { postUrl: route.postUrl, ogImageUrl: route.ogImageUrl } };
      }
      case 'tweet': {
        const res = await fetch(`/api/tweet-meta?id=${encodeURIComponent(route.tweetId)}`);
        if (!res.ok) return null;
        const data = (await res.json()) as TweetData;
        const result = parseHousingFromText(data.text);
        const photos = data.photos ?? [];
        return {
          result,
          source: {
            postUrl: route.postUrl,
            ogImageUrl: photos[0],
            sourceImageUrls: photos.length > 0 ? photos.slice(0, 10) : undefined,
          },
        };
      }
      case 'ogp': {
        const res = await fetch(`/api/og-fetch?url=${encodeURIComponent(route.postUrl)}`);
        if (!res.ok) return null;
        const data = (await res.json()) as OgpData;
        const result = extractHousingAddressFromPage({
          title: data.title,
          description: data.description,
          bodyText: data.text,
        });
        const images = data.images ?? [];
        const ogImageUrl = data.image ?? images[0];
        return {
          result,
          source: {
            postUrl: route.postUrl,
            ogImageUrl: ogImageUrl ?? undefined,
            sourceImageUrls: images.length > 0 ? images.slice(0, 10) : ogImageUrl ? [ogImageUrl] : undefined,
          },
        };
      }
      case 'empty':
      case 'invalid':
        return null;
    }
  } catch {
    return null;
  }
}
