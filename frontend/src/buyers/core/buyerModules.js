import { buyerPath, normalizeBuyerCode } from 'utils/buyerAccess';

// Discover compiled Buyer modules at build time (same strategy as Sales–BOM–MPR).
// Buyer Master remains dynamic, but a Buyer without an implemented module is
// deliberately NOT granted another Buyer's operational workflow.
const moduleFiles = import.meta.glob('../*/config/module.js', { eager: true });

const buyerModules = Object.values(moduleFiles)
  .map((entry) => entry?.default)
  .filter((entry) => entry && Array.isArray(entry.buyerCodes));

const modulesByBuyer = new Map();
for (const buyerModule of buyerModules) {
  for (const rawCode of buyerModule.buyerCodes) {
    const code = normalizeBuyerCode(rawCode);
    if (!code) continue;
    if (modulesByBuyer.has(code)) {
      throw new Error(`Duplicate Carton Loading Buyer module: ${code}`);
    }
    modulesByBuyer.set(code, buyerModule);
  }
}

export const getBuyerModule = (buyer) => {
  const code = normalizeBuyerCode(typeof buyer === 'string' ? buyer : buyer?.code || buyer?.buyerKey);
  return modulesByBuyer.get(code) || null;
};

export const getBuyerLandingPath = (buyer) => {
  if (!buyer) return '/dashboard';
  const module = getBuyerModule(buyer);
  return module?.landingChild ? buyerPath(buyer, module.landingChild) : '/dashboard';
};

/** Permission-aware landing path. Buyer modules own their own operational entry point. */
export const getBuyerAccessLandingPath = (buyer) => {
  if (!buyer) return '/dashboard';
  const module = getBuyerModule(buyer);
  return typeof module?.accessLanding === 'function' ? module.accessLanding(buyer) : getBuyerLandingPath(buyer);
};

export const getBuyerMenuEntries = (buyer) => getBuyerModule(buyer)?.menu(buyer).filter((entry) => entry.access?.() !== false) || [];
export const getBuyerWorkflowEntries = (buyer) => getBuyerModule(buyer)?.workflow(buyer) || [];
export const buyerCapability = (buyer, capability) => Boolean(getBuyerModule(buyer)?.capabilities?.[capability]);
