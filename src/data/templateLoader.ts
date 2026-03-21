/**
 * src/data/templateLoader.ts
 *
 * Dynamically loads pre-generated template JSON files for mitigation plans.
 * If a template doesn't exist for the contentId, returns null.
 */

import type { TimelineEvent } from '../types';

export interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; }[];
  _warning?: string;
}

// Statically check if a template exists based on whether the file is present in the build
// Vite handles this using glob import
const templateModules = import.meta.glob('./templates/*.json');

/**
 * Checks synchronously if a template is available for the given contentId.
 */
export function hasTemplate(contentId: string): boolean {
  return `./templates/${contentId}.json` in templateModules;
}

/**
 * Asynchronously loads the template data for the given contentId.
 * Returns null if no template exists.
 */
export async function getTemplate(contentId: string): Promise<TemplateData | null> {
  const modulePath = `./templates/${contentId}.json`;
  
  if (!(modulePath in templateModules)) {
    return null;
  }

  try {
    const module = await templateModules[modulePath]() as { default: TemplateData };
    return module.default;
  } catch (error) {
    console.error(`Failed to load template for ${contentId}:`, error);
    return null;
  }
}
