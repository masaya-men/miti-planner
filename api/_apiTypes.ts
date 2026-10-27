/**
 * Vercel Node 関数のリクエスト/レスポンスの最小型。
 * @vercel/node を依存に入れずに、ハンドラが実際に使うメンバだけを型付けする(型のみ・実行時コードなし)。
 * body / query / headers は呼び出し側で形が決まるため any のままにしている(中身は各ハンドラが検証する)。
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- 外部入力(body/query/headers)は形が不定でハンドラ側で検証するため */
export interface ApiRequest {
  method?: string;
  url?: string;
  body?: any;
  query: Record<string, any>;
  headers: Record<string, any>;
  socket?: { remoteAddress?: string };
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: any): ApiResponse;
  send(body?: any): ApiResponse;
  end(body?: any): ApiResponse;
  setHeader(name: string, value: string | number | readonly string[]): ApiResponse;
  redirect(url: string): ApiResponse;
}
