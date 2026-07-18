const SESSION_KEY = 'lopo_shared_tour_session';

/** タブ単位のセッションID。sessionStorage に保持し、同タブの再読み込みでも同一IDを維持する。 */
export function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
