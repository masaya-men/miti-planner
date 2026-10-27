// 本人向け (認証・個人データ) の API 応答に付ける Cache-Control。
// CDN / 中間キャッシュが本人向け応答を共有キャッシュして他人に配らないための保険。
// 公開データを返す窓口 (public 系・GET の人気取得) には付けない。
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vercel の res は api/ 側のモックと型が揃わないため src/lib では緩く受ける
export function setPrivateNoStore(res: any): void {
  res.setHeader('Cache-Control', 'private, no-store');
}
