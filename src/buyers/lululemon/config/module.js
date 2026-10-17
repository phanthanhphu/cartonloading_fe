import {
  AssignmentOutlined,
  LocalShippingOutlined,
  MoveToInboxOutlined,
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
    { id: 'orders', title: 'Orders', icon: AssignmentOutlined, to: buyerPath(buyer, 'orders'), access: allowed.sales },
    { id: 'po-picking', title: 'PO Picking', icon: AssignmentOutlined, to: buyerPath(buyer, 'po-picking'), access: () => allowed.packing() || allowed.sales() },
    { id: 'packing', title: 'Packing', icon: MoveToInboxOutlined, to: buyerPath(buyer, 'packing'), activePaths: [buyerPath(buyer, 'carton-loading')], access: allowed.packing },
    { id: 'checking', title: 'Checking Management', icon: FactCheckOutlined, to: buyerPath(buyer, 'checking'), access: allowed.packing },
    { id: 'shipping', title: 'Shipment Management', icon: LocalShippingOutlined, to: buyerPath(buyer, 'shipping'), activePaths: [buyerPath(buyer, 'shipping/review')], access: allowed.shipping },
    // A single sidebar entry opens Weight Management. The factory tabs inside that
    // workspace are derived from the authenticated user's weighing assignments.
    // Packing-only users retain the same single entry and existing workflow.
    { id: 'weight-management', title: 'Weight Management', icon: ScaleOutlined,
      to: buyerPath(buyer, 'weighing'), activePaths: [buyerPath(buyer, 'weighing'), buyerPath(buyer, 'weight-history')],
      access: allowed.weighing },
    { id: 'rfid-devices', title: 'RFID Devices', icon: SensorsOutlined, to: buyerPath(buyer, 'rfid-devices'), access: () => isAdmin() },
    { id: 'trace-history', title: 'Trace & History', icon: HistoryOutlined, to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ],
  accessLanding: (buyer) => {
    // Former Print Room-only accounts retain read-only Trace access; there is no Print Request page.
    if (canPrintRoom() && !canAssignBarcode() && !canManageSales() && !canUseBuyerWorkspace()) return buyerPath(buyer, 'trace-history');
    if (canAssignBarcode() && !canUseBuyerWorkspace()) return buyerPath(buyer, 'packing');
    if (!canManageSales()) return buyerPath(buyer, 'trace-history');
    return buyerPath(buyer, 'orders');
  },
  workflow: (buyer) => [
    { owner: 'Sales', title: 'Order Management & Master Data', description: 'Open an Order, import ALL_BP, then drill down PO → Carton → Item.', to: buyerPath(buyer, 'orders'), access: allowed.sales },
    { owner: 'Packing', title: 'Packing Operations', description: 'Review carton identity, expected SKU and quantity. Item-by-item scanning is not required; product verification will be handled by RFID.', to: buyerPath(buyer, 'packing'), access: allowed.packing },
    { owner: 'Packing / QC', title: 'Checking Management', description: 'Search by PO, scan SKU or scan SSCC; inspect carton details and record PASS/FAIL with an independent QC history.', to: buyerPath(buyer, 'checking'), access: allowed.packing },
    { owner: 'Packing', title: 'Shipment Management', description: 'Packing picks POs, creates the Shipment, checks carton readiness and explicitly sends it to Weight. Weight only scans cartons after SEND.', to: buyerPath(buyer, 'shipping'), access: allowed.shipping },
    { owner: 'Carton Weight / Supervisor', title: 'Weight Management', description: 'Use Carton Weight to weigh the Packing-confirmed Shipping Lists and Weight History to search retained results across Orders, factories and SSCC-18.', to: buyerPath(buyer, 'weighing'), access: allowed.weighing },
    { owner: 'Supervisor / Operations', title: 'Trace & History', description: 'Trace PO → SKU → Carton → SSCC → Item Scan and perform audited exception actions when authorized.', to: buyerPath(buyer, 'trace-history'), access: allowed.trace }
  ]
};

export default moduleConfig;
