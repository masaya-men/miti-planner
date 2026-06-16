import {
  makeContents,
  makeTemplateRows,
  makeCandidates,
  makeTimelineDetail,
  type ContentItem,
  type TemplateRow,
  type PromotionCandidate,
  type TemplateDetail,
} from './fixtures/templates';

let contents: ContentItem[];
let templates: TemplateRow[];
let candidates: PromotionCandidate[];
let detailCache: Map<string, TemplateDetail>;

/** 初期データを再シードする（テストの beforeEach でも使用） */
export function resetSandboxStore(): void {
  contents = makeContents(60);
  templates = makeTemplateRows(60);
  candidates = makeCandidates(8);
  detailCache = new Map();
}

resetSandboxStore(); // モジュール読込時に初回シード

interface SaveBody {
  contentId: string;
  timelineEvents?: TemplateDetail['timelineEvents'];
  phases?: TemplateDetail['phases'];
  labels?: TemplateDetail['labels'];
  source?: string;
}

export const sandboxStore = {
  listContents: (): ContentItem[] => contents,
  listTemplates: (): TemplateRow[] => templates,
  listCandidates: (): PromotionCandidate[] => candidates,

  /** 詳細は初回アクセス時に生成してキャッシュ（同じ表は同じ中身を返す） */
  getTemplateDetail(id: string): TemplateDetail {
    if (!detailCache.has(id)) detailCache.set(id, makeTimelineDetail(id));
    return detailCache.get(id)!;
  },

  /** 保存: 詳細を差し替え、一覧行を更新（無ければ先頭に追加） */
  saveTemplate(body: SaveBody): void {
    const now = '2026-06-16T12:00:00.000Z';
    detailCache.set(body.contentId, {
      timelineEvents: body.timelineEvents ?? [],
      phases: body.phases ?? [],
      labels: body.labels ?? [],
    });
    const eventCount = body.timelineEvents?.length ?? 0;
    const phaseCount = body.phases?.length ?? 0;
    const existing = templates.find((t) => t.contentId === body.contentId);
    if (existing) {
      templates = templates.map((t) =>
        t.contentId === body.contentId
          ? { ...t, eventCount, phaseCount, lastUpdatedAt: now, source: body.source ?? t.source }
          : t,
      );
    } else {
      templates = [
        { contentId: body.contentId, source: body.source ?? 'admin_editor', eventCount, phaseCount, lockedAt: null, lastUpdatedAt: now },
        ...templates,
      ];
    }
  },

  setLock(contentId: string, lock: boolean): void {
    const now = '2026-06-16T12:00:00.000Z';
    templates = templates.map((t) =>
      t.contentId === contentId ? { ...t, lockedAt: lock ? now : null } : t,
    );
  },

  deleteTemplate(contentId: string): void {
    templates = templates.filter((t) => t.contentId !== contentId);
    detailCache.delete(contentId);
  },

  resolveCandidate(shareId: string): void {
    candidates = candidates.filter((c) => c.shareId !== shareId);
  },
};
