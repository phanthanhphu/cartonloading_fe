/**
 * Resolve the SINGLE sidebar entry that owns the current page.
 * - Buyer menu URLs own their nested pages (Order -> PO -> Carton -> Items).
 * - Home/admin URLs are exact; activePaths are exact aliases by default (e.g. Weight History), and may use
 *   a trailing /* to explicitly include nested alias pages.
 * - Most-specific path wins, with Shipment Management owning its review/detail subroutes.
 * - Segment boundaries prevent /orders from matching /orders-archive.
 */
const normalizePath = (value) => {
  const text = String(value || '/').split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return text.toLowerCase();
};

const matchesCandidate = (candidate, pathname) => {
  const isWildcard = candidate.raw.endsWith('/*');
  const path = normalizePath(isWildcard ? candidate.raw.slice(0, -2) : candidate.raw);
  const matched = pathname === path || ((candidate.matchDescendants || isWildcard) && path !== '/' && pathname.startsWith(`${path}/`));
  if (!matched) return null;
  // More-specific URLs win; primary URLs beat aliases of equal length.
  return path.length * 10 + (pathname === path ? 2 : 0) + (candidate.primary ? 1 : 0);
};

export const getActiveMenuItemId = (menuGroups, pathname) => {
  const currentPath = normalizePath(pathname);
  let winner = null;
  let winnerScore = -1;

  const visit = (menuItem) => {
    if (!menuItem) return;
    if (menuItem.type === 'item' && menuItem.url) {
      const candidates = [
        { raw: menuItem.url, primary: true, matchDescendants: Boolean(menuItem.matchDescendants) },
        ...(Array.isArray(menuItem.activePaths) ? menuItem.activePaths
          .filter((path) => path && path !== menuItem.url)
          .map((raw) => ({ raw, primary: false, matchDescendants: false })) : [])
      ];
      for (const candidate of candidates) {
        const score = matchesCandidate(candidate, currentPath);
        if (score !== null && score > winnerScore) {
          winnerScore = score;
          winner = menuItem.id;
        }
      }
    }
    if (Array.isArray(menuItem.children)) menuItem.children.forEach(visit);
  };
  (menuGroups || []).forEach(visit);
  return winner;
};
