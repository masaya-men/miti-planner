/**
 * api/housing 内のハンドラ共通の req / res 型。
 * @vercel/node の型は未導入のため、ハンドラが実際に触る範囲だけをローカルに定義する。
 */
export interface HousingReq {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- リクエスト本文は呼び出し側が自由な JSON を送るため(各ハンドラで検証してから使う)
  body?: any;
  [key: string]: unknown;
}

export interface HousingRes {
  setHeader(name: string, value: string | number | readonly string[]): unknown;
  status(code: number): HousingRes;
  json(body: unknown): unknown;
  end(chunk?: unknown): unknown;
  send(body?: unknown): unknown;
  [key: string]: unknown;
}
