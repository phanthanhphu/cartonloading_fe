/** ES Order workspace uses allocation and physical carton generation, not the SSCC workflow. */
import { generatePackingList, importPackingAllocationLines } from '../../services/packingListService';
import { generateCartonPlanFromWsp } from '../../services/cartonLoadingService';

export const operations = { generatePackingList, importPackingAllocationLines, generateCartonPlanFromWsp };
