import {
  AssignmentOutlined,
  HistoryOutlined,
  SensorsOutlined
} from '@mui/icons-material';
import {
  canAssignBarcode,
  canManageSales,
  canUseBuyerWorkspace,
  canWeightCheck,
  isAdmin
} from 'utils/accessControl';
import { buyerPath } from 'utils/buyerAccess';
import { BUYER_CODE, BUYER_MODULE_KEY } from '../../../constants/appConstants';

const allowed = {
  workspace: () => canUseBuyerWorkspace(),
  packing: () => canAssignBarcode() || canManageSales(),
  trace: () => canUseBuyerWorkspace() || canAssignBarcode() || canManageSales() || canWeightCheck(),
  weighing: () => canWeightCheck()
};

/** LULULEMON owns its menu, routes and workflow; it does not inherit ES Barcode/Weight screens. */
const moduleConfig = {
  buyerCodes: [BUYER_CODE.LULULEMON],
  key: BUYER_MODULE_KEY.SSCC_PACKING,
  landingChild: 'orders',
  capabilities: {
    allBp: true,
    po: true,
    productScan: true,
    exFty: true,
    cartonLabel: true,
    sscc18: true,
    barcodeInventory: false,
    factoryBarcode: false,
    scaleStations: false,
    weightCheck: true,
    shipmentPlanning: false,
    shipmentTracking: false
  },
  menu: (buyer) => [
    { id: 'orders', title: 'Orders', icon: AssignmentOutlined, to: buyerPath(buyer, 'orders'), access: () => allowed.workspace() || allowed.packing() || allowed.weighing() },
    { id: 'rfid-devices', title: 'Device Management', icon: SensorsOutlined, to: buyerPath(buyer, 'rfid-devices'), access: () => isAdmin() },
    { id: 'trace-history', title: 'Carton History', icon: HistoryOutlined, to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ],
  accessLanding: (buyer) => (allowed.workspace() || allowed.packing() || allowed.weighing())
    ? buyerPath(buyer, 'orders')
    : buyerPath(buyer, 'trace-history'),
  workflow: (buyer) => [
    { owner: 'Packing', title: 'Orders', description: 'Create Factory-scoped Orders, import All_BP and scan SSCC/SKU directly in a PO.', to: buyerPath(buyer, 'orders'), access: allowed.packing },
    { owner: 'Operator', title: 'PO Processing', description: 'Open Orders → PO to scan SSCC + SKU, verify RFID, record manual weight and Next/END.', to: buyerPath(buyer, 'orders'), access: allowed.weighing },
    { owner: 'Supervisor', title: 'Carton History', description: 'Review completed carton records with RFID and Weight audit details in one page.', to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ]
};

export default moduleConfig;
