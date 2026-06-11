/** id 一意化（最初の出現を残す）。partyMembers/mitigations/events 等の表示・射影直前の保険（多層防御）。 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}
