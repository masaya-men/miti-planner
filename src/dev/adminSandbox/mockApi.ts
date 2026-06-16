import { sandboxStore } from './store';

/**
 * 管理画面の API 呼び出しをダミーにすり替える。
 * 該当する URL/メソッドならダミー Response を、該当しなければ null（=本物の fetch へフォールバック）を返す。
 * ネットワーク・本番・Firestore には一切アクセスしない。
 */
export async function mockApiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response | null> {
  const method = (options.method ?? 'GET').toUpperCase();
  const parsed = new URL(url, 'http://localhost');
  const path = parsed.pathname;
  const params = parsed.searchParams;

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const readBody = (): Record<string, unknown> =>
    options.body ? JSON.parse(options.body as string) : {};

  // /api/admin?resource=contents
  if (path === '/api/admin' && params.get('resource') === 'contents' && method === 'GET') {
    return json({ items: sandboxStore.listContents() });
  }

  // /api/admin?resource=templates  (id ありは詳細、なしは一覧、POST/PUT/DELETE は更新)
  // 注: type 付き (type=stats / type=logs 等) は別レスポンス形なのでここで横取りしない
  //     (横取りすると一覧形が返り、stats 等が Object.keys(undefined) でクラッシュする)。
  //     type 付きは null フォールバック → 各ページは「読み込みエラー」表示になりクラッシュしない。
  if (path === '/api/admin' && params.get('resource') === 'templates' && !params.get('type')) {
    const id = params.get('id');
    if (method === 'GET' && id) {
      return json(sandboxStore.getTemplateDetail(id));
    }
    if (method === 'GET') {
      return json({ templates: sandboxStore.listTemplates() });
    }
    if (method === 'POST') {
      sandboxStore.saveTemplate(readBody() as unknown as Parameters<typeof sandboxStore.saveTemplate>[0]);
      return json({ ok: true });
    }
    if (method === 'PUT') {
      const body = readBody();
      sandboxStore.setLock(String(body.contentId), Boolean(body.lock));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      sandboxStore.deleteTemplate(params.get('contentId') ?? '');
      return json({ ok: true });
    }
  }

  // /api/template?action=promote
  if (path === '/api/template' && params.get('action') === 'promote') {
    if (method === 'GET' && params.get('candidates') === 'true') {
      return json({ candidates: sandboxStore.listCandidates() });
    }
    if (method === 'POST') {
      sandboxStore.resolveCandidate(String(readBody().shareId));
      return json({ ok: true });
    }
  }

  return null; // 未対応 → 本物へフォールバック
}
