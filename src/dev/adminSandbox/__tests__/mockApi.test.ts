import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiFetch } from '../mockApi';
import { resetSandboxStore } from '../store';

beforeEach(() => resetSandboxStore());

describe('mockApiFetch', () => {
  it('GET contents は items 配列を返す', async () => {
    const res = await mockApiFetch('/api/admin?resource=contents');
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.items.length).toBe(60);
    expect(body.items[0].id).toBe('content-001');
  });

  it('GET templates 一覧は templates 配列を返す', async () => {
    const res = await mockApiFetch('/api/admin?resource=templates');
    const body = await res!.json();
    expect(body.templates.length).toBe(60);
    expect(body.templates[0]).toHaveProperty('lastUpdatedAt');
  });

  it('GET templates&id は詳細(timelineEvents/phases/labels)を返す', async () => {
    const res = await mockApiFetch('/api/admin?resource=templates&id=content-001');
    const body = await res!.json();
    expect(body.timelineEvents.length).toBe(40);
    expect(body.phases.length).toBe(5);
    expect(body.labels.length).toBe(6);
  });

  it('DELETE templates は一覧から消える', async () => {
    await mockApiFetch('/api/admin?resource=templates&contentId=content-001', { method: 'DELETE' });
    const res = await mockApiFetch('/api/admin?resource=templates');
    const body = await res!.json();
    expect(body.templates.some((t: { contentId: string }) => t.contentId === 'content-001')).toBe(false);
    expect(body.templates.length).toBe(59);
  });

  it('PUT templates でロック状態が反映される', async () => {
    await mockApiFetch('/api/admin?resource=templates', {
      method: 'PUT',
      body: JSON.stringify({ contentId: 'content-002', lock: true }),
    });
    const res = await mockApiFetch('/api/admin?resource=templates');
    const body = await res!.json();
    const row = body.templates.find((t: { contentId: string }) => t.contentId === 'content-002');
    expect(row.lockedAt).not.toBeNull();
  });

  it('GET 昇格候補は candidates を返し、POST で1件消える', async () => {
    const before = await (await mockApiFetch('/api/template?action=promote&candidates=true'))!.json();
    expect(before.candidates.length).toBe(8);
    await mockApiFetch('/api/template?action=promote', {
      method: 'POST',
      body: JSON.stringify({ shareId: before.candidates[0].shareId, action: 'approve' }),
    });
    const after = await (await mockApiFetch('/api/template?action=promote&candidates=true'))!.json();
    expect(after.candidates.length).toBe(7);
  });

  it('未対応の URL は null を返す(本物へフォールバック)', async () => {
    const res = await mockApiFetch('/api/auth?provider=discord', { method: 'POST' });
    expect(res).toBeNull();
  });
});
