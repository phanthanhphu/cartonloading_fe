// Import each Buyer's operational routes through the same module-discovery
// convention. Existing route arrays and route guards remain unchanged.
const routeFiles = import.meta.glob('../*/routes/routes.jsx', { eager: true });

const buyerOperationalRoutes = Object.entries(routeFiles)
  .sort(([left], [right]) => left.localeCompare(right))
  .flatMap(([, entry]) => (Array.isArray(entry?.default) ? entry.default : []));

export default buyerOperationalRoutes;
