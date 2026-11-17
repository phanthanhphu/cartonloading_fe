/** LULULEMON-specific Order workspace UI + operations. Shared workspace never imports this Buyer directly. */
import LululemonExcelActions from '../../components/LululemonExcelActions';
import ShippingSchedulesTab from '../../components/ShippingSchedulesTab';
import PoDuplicateConflictDialog from '../../components/PoDuplicateConflictDialog';
import PoScanProgressCell from '../../components/PoScanProgressCell';
import PoInspectionProgressCell from '../../components/PoInspectionProgressCell';
import {
  createShippingSchedule,
  createWeighingOrder,
  deletePo,
  importAllBp,
  listShippingSchedules,
  updatePo
} from '../../services/service';

export const components = {
  LululemonExcelActions, ShippingSchedulesTab, PoDuplicateConflictDialog,
  PoScanProgressCell, PoInspectionProgressCell
};
export const operations = {
  createShippingSchedule, createWeighingOrder, deletePo,
  importAllBp, listShippingSchedules, updatePo
};
