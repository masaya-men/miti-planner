import type { Job } from '../../types';

/** ジョブ名(日英中韓いずれか)→ jobId。store の Job[] から解決。未知は null。 */
export function resolveJobId(name: string, jobs: Job[]): string | null {
  const n = name.trim();
  if (!n) return null;
  const hit = jobs.find(
    (j) => j.name.ja === n || j.name.en === n || j.name.ko === n || j.name.zh === n,
  );
  return hit ? hit.id : null;
}
