import {
  AssignmentOutlined,
  HistoryOutlined,
  ScaleOutlined,
  SensorsOutlined,
  FactCheckOutlined
} from '@mui/icons-material';
import {
  canAssignBarcode,
  canManageSales,
  canPrintRoom,
  canUseBuyerWorkspace,
  canWeightCheck,
  isAdmin
} from 'utils/accessControl';
import { buyerPath } from 'utils/buyerAccess';
import { BUYER_MODULE_KEY } from '../../../constants/appConstants';

const allowed = {
  workspace: () => canUseBuyerWorkspace(),
  sales: () => canManageSales(),
  packing: () => canAssignBarcode() || canManageSales(),
  trace: () => canUseBuyerWorkspace() || canAssignBarcode() || canManageSales() || canWeightCheck() || canPrintRoom(),
  weighing: () => canWeightCheck(),
  shipping: () => canManageSales() || canAssignBarcode()
};

/** LULULEMON owns its menu, routes and workflow; it does not inherit ES Barcode/Weight screens. */
const moduleConfig = {
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
    { id: 'orders', title: 'Orders', icon: AssignmentOutlined, to: buyerPath(buyer, 'orders'), access: () => allowed.packing() || allowed.weighing() },
    { id: 'checking', title: 'Checking Management', icon: FactCheckOutlined, to: buyerPath(buyer, 'checking'), access: allowed.packing },
    { id: 'rfid-devices', title: 'Device Management', icon: SensorsOutlined, to: buyerPath(buyer, 'rfid-devices'), access: () => isAdmin() },
    { id: 'trace-history', title: 'History', icon: HistoryOutlined, to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ],
  accessLanding: (buyer) => {
    if (canPrintRoom() && !canAssignBarcode() && !canManageSales() && !canUseBuyerWorkspace()) return buyerPath(buyer, 'trace-history');
    if (allowed.weighing()) return buyerPath(buyer, 'orders');
    if (allowed.packing()) return buyerPath(buyer, 'orders');
    return canManageSales() ? buyerPath(buyer, 'orders') : buyerPath(buyer, 'trace-history');
  },
  workflow: (buyer) => [
    { owner: 'Packing', title: 'Orders', description: 'Create Factory-scoped Orders, import All_BP; open a PO to assign SSCC, scan RFID and weigh (SSCC bulk import optional).', to: buyerPath(buyer, 'orders'), access: allowed.packing },
    { owner: 'Operator', title: 'PO Processing', description: 'Open Orders → PO to scan SSCC + SKU, verify RFID, record manual weight and Next/END.', to: buyerPath(buyer, 'orders'), access: allowed.weighing },
    { owner: 'Packing / QC', title: 'Checking Management', description: 'Optional independent QC history.', to: buyerPath(buyer, 'checking'), access: allowed.packing },
    { owner: 'Supervisor', title: 'History', description: 'One page for Trace/RFID and Weight History via two tabs.', to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ]
};

export default moduleConfig;
