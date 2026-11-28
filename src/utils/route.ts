// Minimal path handling without a router library. Vercel already rewrites every path to index.html,
// so /team works when opened directly or refreshed.
export type AppView = 'EDITORIAL' | 'COMMAND' | 'TEAM';

const PATHS: Record<AppView, string> = { EDITORIAL: '/', COMMAND: '/', TEAM: '/team' };

export function viewFromPath(pathname: string = window.location.pathname): AppView | null {
  return pathname.replace(/\/+$/, '') === '/team' ? 'TEAM' : null;
}

/** Push a history entry when the view changes its path, so the browser Back button works. */
export function syncPath(view: AppView): void {
  const target = PATHS[view];
  if (window.location.pathname.replace(/\/+$/, '') !== target.replace(/\/+$/, '')) {
    window.history.pushState({ view }, '', target);
  }
}
