/** Buyer-owned SSCC Carton processing adapter. No shared component imports Buyer implementations. */
import PoRfidWeightWorkspace from '../../components/PoRfidWeightWorkspace';
import OperationWorkspaceDialog from '../../components/OperationWorkspaceDialog';
import { unassignProcessingIdentity } from '../../services/cartonProcessing';

export const components = { PoRfidWeightWorkspace, OperationWorkspaceDialog };
export const operations = { unassignProcessingIdentity };
