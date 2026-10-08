import { buyerPath, normalizeBuyerCode } from 'utils/buyerAccess';
import { BUYER_CODE } from '../../constants/appConstants';
import barcodePackingModule from 'buyers/es/config/module';
import ssccPackingModule from 'buyers/lululemon/config/module';


export const getBuyerModule = (buyer) => {
  const code = normalizeBuyerCode(typeof buyer === 'string' ? buyer : buyer?.code);
  if (code === BUYER_CODE.LULULEMON) return ssccPackingModule;
  if (code === BUYER_CODE.ENGELBERT_STRAUSS) return barcodePackingModule;
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
