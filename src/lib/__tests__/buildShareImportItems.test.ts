import { describe, it, expect } from 'vitest';
import { parseSharedDataToImportItems, buildNewPlan } from '../buildShareImportItems';
import type { PlanData } from '../../types';

const samplePlanData: PlanData = {
  currentLevel: 100,
  timelineEvents: [],
  timelineMitigations: [],
  phases: [],
  partyMembers: [],
  aaSettings: { damage: 0, type: 'physical', target: 'MT' },
  schAetherflowPatterns: {},
};

describe('parseSharedDataToImportItems', () => {
  it('handles single shared plan (non-bundle)', () => {
    const data = {
      shareId: 'abc123',
      title: 'P1 P2 終了後',
      contentId: 'fru',
      planData: samplePlanData,
      createdAt: 0,
      updatedAt: 0,
    };
    const items = parseSharedDataToImportItems(data, 'abc123');
    expect(items).toHaveLength(1);
    expect(items[0].sourceShareId).toBe('abc123');
    expect(items[0].contentId).toBe('fru');
    expect(items[0].title).toBe('P1 P2 終了後');
    expect(items[0].planData).toBe(samplePlanData);
  });

  it('handles bundle shared data (multiple plans)', () => {
    const data = {
      shareId: 'bundle456',
      contentId: 'fru',
      plans: [
        { id: 'p1', title: 'P2 終了後', planData: samplePlanData },
        { id: 'p2', title: 'P3 P4 後半', planData: samplePlanData },
        { id: 'p3', title: 'ガード範囲', planData: samplePlanData },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const items = parseSharedDataToImportItems(data, 'bundle456');
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe('P2 終了後');
    expect(items[0].sourcePlanId).toBe('p1');
    expect(items[2].title).toBe('ガード範囲');
    expect(items[2].sourcePlanId).toBe('p3');
    items.forEach(item => {
      expect(item.sourceShareId).toBe('bundle456');
      expect(item.contentId).toBe('fru');
    });
  });

  it('uses index-based fallback when bundle plans lack id', () => {
    const data = {
      contentId: 'fru',
      plans: [
        { title: 'A', planData: samplePlanData },
        { title: 'B', planData: samplePlanData },
      ],
    };
    const items = parseSharedDataToImportItems(data, 'shareXyz');
    expect(items[0].sourcePlanId).toBe('shareXyz_0');
    expect(items[1].sourcePlanId).toBe('shareXyz_1');
  });

  it('falls back to "Shared Plan" when title missing in single', () => {
    const data = {
      shareId: 'noTitle',
      contentId: 'fru',
      planData: samplePlanData,
      createdAt: 0,
      updatedAt: 0,
    };
    const items = parseSharedDataToImportItems(data, 'noTitle');
    expect(items[0].title).toBe('Shared Plan');
  });
});

describe('buildNewPlan', () => {
  it('creates SavedPlan with ownerId="local"', () => {
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const plan = buildNewPlan(item);
    expect(plan.ownerId).toBe('local');
    expect(plan.contentId).toBe('fru');
    expect(plan.title).toBe('Test');
    expect(plan.data).toBe(samplePlanData);
    expect(plan.id).toBeTruthy();
    expect(plan.id.length).toBeGreaterThan(0);
  });

  it('generates unique ids per call', () => {
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const p1 = buildNewPlan(item);
    const p2 = buildNewPlan(item);
    expect(p1.id).not.toBe(p2.id);
  });

  it('sets isPublic=false copyCount=0 useCount=0', () => {
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const plan = buildNewPlan(item);
    expect(plan.isPublic).toBe(false);
    expect(plan.copyCount).toBe(0);
    expect(plan.useCount).toBe(0);
  });

  it('sets createdAt and updatedAt to a recent timestamp', () => {
    const before = Date.now();
    const item = {
      sourceShareId: 'abc',
      contentId: 'fru',
      title: 'Test',
      planData: samplePlanData,
    };
    const plan = buildNewPlan(item);
    const after = Date.now();
    expect(plan.createdAt).toBeGreaterThanOrEqual(before);
    expect(plan.createdAt).toBeLessThanOrEqual(after);
    expect(plan.updatedAt).toBe(plan.createdAt);
  });
});
