import { canUseBuyerWorkspace } from 'utils/accessControl';
import { buyerPath, normalizeBuyerCode } from 'utils/buyerAccess';
import esModule from 'buyers/es/config/esModule';
import lululemonModule from 'buyers/lululemon/config/lululemonModule';


export const getBuyerModule = (buyer) => {
  const code = normalizeBuyerCode(typeof buyer === 'string' ? buyer : buyer?.code);
  if (code === 'LULULEMON') return lululemonModule;
  if (code === 'ENGELBERT_STRAUSS') return esModule;
  return null;
};

export const getBuyerLandingPath = (buyer) => {
  if (!buyer) return '/workflow';
  const module = getBuyerModule(buyer);
  return module?.landingChild ? buyerPath(buyer, module.landingChild) : '/workflow';
};

/** Permission-aware landing path. Buyer modules own their own operational entry point. */
export const getBuyerAccessLandingPath = (buyer) => {
  if (!buyer) return '/workflow';
  const module = getBuyerModule(buyer);
  return typeof module?.accessLanding === 'function' ? module.accessLanding(buyer) : getBuyerLandingPath(buyer);
};

export const getBuyerMenuEntries = (buyer) => getBuyerModule(buyer)?.menu(buyer).filter((entry) => entry.access?.() !== false) || [];
export const getBuyerWorkflowEntries = (buyer) => getBuyerModule(buyer)?.workflow(buyer) || [];
export const buyerCapability = (buyer, capability) => Boolean(getBuyerModule(buyer)?.capabilities?.[capability]);

export const BUYER_MODULES = Object.freeze({
  ENGELBERT_STRAUSS: esModule,
  LULULEMON: lululemonModule
});
