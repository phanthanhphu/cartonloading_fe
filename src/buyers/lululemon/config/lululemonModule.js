import {
  AssignmentOutlined,
  LocalShippingOutlined,
  MoveToInboxOutlined,
  SendOutlined,
  QrCodeScannerOutlined,
  HistoryOutlined,
  ScaleOutlined
} from '@mui/icons-material';
import {
  canAssignBarcode,
  canManageSales,
  canPrintRoom,
  canUseBuyerWorkspace,
  canWeightCheck
} from 'utils/accessControl';
import { buyerPath } from 'utils/buyerAccess';

const allowed = {
  workspace: () => canUseBuyerWorkspace(),
  sales: () => canManageSales(),
  packing: () => canAssignBarcode() || canManageSales(),
  print: () => canPrintRoom() || canAssignBarcode() || canManageSales(),
  trace: () => canUseBuyerWorkspace() || canAssignBarcode() || canManageSales() || canWeightCheck() || canPrintRoom(),
  weighing: () => canWeightCheck() || canManageSales() || canAssignBarcode()
};

/** LULULEMON owns its menu, routes and workflow; it does not inherit ES Barcode/Weight screens. */
const lululemonModule = {
  key: 'lululemon',
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
    { id: 'orders', title: 'Orders', icon: AssignmentOutlined, to: buyerPath(buyer, 'orders'), access: allowed.workspace },
    { id: 'print-requests', title: 'PO Handoff', icon: SendOutlined, to: buyerPath(buyer, 'print-requests'), access: allowed.print },
    { id: 'packing', title: 'Packing', icon: MoveToInboxOutlined, to: buyerPath(buyer, 'packing'), access: allowed.packing },
    { id: 'shipping', title: 'Shipping / Ex-Factory', icon: LocalShippingOutlined, to: buyerPath(buyer, 'shipping'), access: allowed.sales },
    { id: 'carton-loading', title: 'Carton Label / SSCC', icon: QrCodeScannerOutlined, to: buyerPath(buyer, 'carton-loading'), access: allowed.packing },
    { id: 'weighing', title: 'Carton Weighing', icon: ScaleOutlined, to: buyerPath(buyer, 'weighing'), access: allowed.weighing },
    { id: 'trace-history', title: 'Trace & History', icon: HistoryOutlined, to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ],
  accessLanding: (buyer) => {
    if (canPrintRoom() && !canAssignBarcode() && !canManageSales() && !canUseBuyerWorkspace()) return buyerPath(buyer, 'print-requests');
    if (canAssignBarcode() && !canUseBuyerWorkspace()) return buyerPath(buyer, 'packing');
    return buyerPath(buyer, 'orders');
  },
  workflow: (buyer) => [
    { owner: 'Sales', title: 'Order Management & Master Data', description: 'Open an Order, import ALL_BP, then drill down PO → Carton → Item.', to: buyerPath(buyer, 'orders'), access: allowed.workspace },
    { owner: 'Packing → Print Room', title: 'PO Handoff', description: 'Packing selects POs and sends the list electronically. Print Room opens the system and views the Packing owner, Factory, Order and PO details.', to: buyerPath(buyer, 'print-requests'), access: allowed.print },
    { owner: 'Packing', title: 'Packing Operations', description: 'Choose PO, scan product SKU, and finish each carton.', to: buyerPath(buyer, 'packing'), access: allowed.packing },
    { owner: 'HCM Sales', title: 'Shipping & Ex-Factory', description: 'Update Ex-fty Date from the Shipping List.', to: buyerPath(buyer, 'shipping'), access: allowed.sales },
    { owner: 'Packing', title: 'Carton Label & SSCC', description: 'Scan label SKU, confirm carton information, then assign unique SSCC-18.', to: buyerPath(buyer, 'carton-loading'), access: allowed.packing },
    { owner: 'Packing / Weight Station', title: 'Carton Weighing', description: 'Create a Weighing Order, scan SSCC-18, accept only stable scale readings, then PASS or HOLD by configured tolerance.', to: buyerPath(buyer, 'weighing'), access: allowed.weighing },
    { owner: 'Supervisor / Operations', title: 'Trace & History', description: 'Trace PO → SKU → Carton → SSCC → Item Scan and perform audited exception actions when authorized.', to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ]
};

export default lululemonModule;
