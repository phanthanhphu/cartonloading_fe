// Routes do not exist unless an administrator explicitly enables the test cleanup feature on BE.
import { apiRawClient } from '../../../routes/globalApi';
import { scopedRoot, unwrap } from './client';

export const getLululemonTestCleanupStatus = (orderId) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId)}/test-cleanup/status`)
);
export const purgeLululemonTestOrder = (orderId, confirmation) => unwrap(
  apiRawClient.post(`${scopedRoot(orderId)}/test-cleanup/purge`, { confirmation })
);

export const previewLululemonTestOrder = (orderId) => unwrap(
  apiRawClient.get(`${scopedRoot(orderId)}/test-cleanup/preview`)
);
