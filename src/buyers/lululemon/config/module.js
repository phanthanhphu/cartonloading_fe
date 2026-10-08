import {
  AssignmentOutlined,
  LocalShippingOutlined,
  MoveToInboxOutlined,
  SendOutlined,
  HistoryOutlined,
  ScaleOutlined,
  FactCheckOutlined
} from '@mui/icons-material';
import {
  canAssignBarcode,
  canManageSales,
  canPrintRoom,
  canUseBuyerWorkspace,
  canWeightCheck
} from 'utils/accessControl';
import { buyerPath } from 'utils/buyerAccess';
import { BUYER_MODULE_KEY } from '../../../constants/appConstants';

const allowed = {
  workspace: () => canUseBuyerWorkspace(),
  sales: () => canManageSales(),
  packing: () => canAssignBarcode() || canManageSales(),
  print: () => canPrintRoom() || canAssignBarcode() || canManageSales(),
  trace: () => canUseBuyerWorkspace() || canAssignBarcode() || canManageSales() || canWeightCheck() || canPrintRoom(),
  weighing: () => canWeightCheck() || canManageSales() || canAssignBarcode(),
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
    shipmentPlanning: true,
    shipmentTracking: false
  },
  menu: (buyer) => [
    { id: 'orders', title: 'Orders', icon: AssignmentOutlined, to: buyerPath(buyer, 'orders'), access: allowed.workspace },
    { id: 'print-requests', title: 'Print Request', icon: SendOutlined, to: buyerPath(buyer, 'print-requests'), access: allowed.print },
    { id: 'packing', title: 'Packing', icon: MoveToInboxOutlined, to: buyerPath(buyer, 'packing'), access: allowed.packing },
    { id: 'checking', title: 'Checking Management', icon: FactCheckOutlined, to: buyerPath(buyer, 'checking'), access: allowed.packing },
    { id: 'shipping', title: 'Shipping Schedule', icon: LocalShippingOutlined, to: buyerPath(buyer, 'shipping'), access: allowed.shipping },
    { id: 'shipping-operations', title: 'Shipping', icon: LocalShippingOutlined, to: buyerPath(buyer, 'shipping/review'), access: allowed.packing },
    // One navigation entry for both weight pages. Keep existing URLs as tab destinations.
    {
      id: 'weight-management',
      title: 'Weight Management',
      icon: ScaleOutlined,
      to: buyerPath(buyer, 'weighing'),
      activePaths: [buyerPath(buyer, 'weighing'), buyerPath(buyer, 'weight-history')],
      access: allowed.weighing
    },
    { id: 'trace-history', title: 'Trace & History', icon: HistoryOutlined, to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ],
  accessLanding: (buyer) => {
    if (canPrintRoom() && !canAssignBarcode() && !canManageSales() && !canUseBuyerWorkspace()) return buyerPath(buyer, 'print-requests');
    if (canAssignBarcode() && !canUseBuyerWorkspace()) return buyerPath(buyer, 'packing');
    return buyerPath(buyer, 'orders');
  },
  workflow: (buyer) => [
    { owner: 'Sales', title: 'Order Management & Master Data', description: 'Open an Order, import ALL_BP, then drill down PO → Carton → Item.', to: buyerPath(buyer, 'orders'), access: allowed.workspace },
    { owner: 'Packing → Print Room', title: 'Print Request', description: 'Packing selects POs and sends them to a managed print list. The Print Room views the list and PO details; the system does not connect to or control a printer.', to: buyerPath(buyer, 'print-requests'), access: allowed.print },
    { owner: 'Packing', title: 'Packing Operations', description: 'Review carton identity, expected SKU and quantity. Item-by-item scanning is not required; product verification will be handled by RFID.', to: buyerPath(buyer, 'packing'), access: allowed.packing },
    { owner: 'Packing / QC', title: 'Checking Management', description: 'Search by PO, scan SKU or scan SSCC; inspect carton details and record PASS/FAIL with an independent QC history.', to: buyerPath(buyer, 'checking'), access: allowed.packing },
    { owner: 'Sales / Packing', title: 'Shipping Schedule', description: 'Sales assigns Factory, Shipping Date and logical POs to a shipping schedule. Packing checks SKU/SSCC readiness and releases the schedule to Carton Weight.', to: buyerPath(buyer, 'shipping'), access: allowed.shipping },
    { owner: 'Carton Weight / Supervisor', title: 'Weight Management', description: 'Use Carton Weight to weigh the Packing-confirmed Shipping Lists and Weight History to search retained results across Orders, factories and SSCC-18.', to: buyerPath(buyer, 'weighing'), access: allowed.weighing },
    { owner: 'Supervisor / Operations', title: 'Trace & History', description: 'Trace PO → SKU → Carton → SSCC → Item Scan and perform audited exception actions when authorized.', to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ]
};

export default moduleConfig;
