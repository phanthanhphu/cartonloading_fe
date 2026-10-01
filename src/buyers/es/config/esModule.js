import {
  AssignmentOutlined,
  Inventory2Outlined,
  LocalShippingOutlined,
  QrCode2Outlined,
  QrCodeScannerOutlined
} from '@mui/icons-material';
import {
  canAssignBarcode,
  canManageBarcodes,
  canManageSales,
  canUseBuyerWorkspace,
  canWeightCheck,
  isAdmin,
  isViewOnly
} from 'utils/accessControl';
import { buyerPath } from 'utils/buyerAccess';

const allowed = {
  workspace: () => canUseBuyerWorkspace(),
  sales: () => canManageSales(),
  packing: () => canAssignBarcode() || canManageSales(),
  weight: () => canWeightCheck(),
  tracking: () => isAdmin() || canManageSales() || canWeightCheck() || isViewOnly()
};

/** Existing Engelbert Strauss workflow. Legacy ES screens stay in place to avoid regression. */
const esModule = {
  key: 'es',
  landingChild: 'orders',
  capabilities: {
    orders: true,
    allocation: true,
    barcodeInventory: true,
    factoryBarcode: true,
    scaleStations: true,
    weightCheck: true,
    shipmentPlanning: true,
    shipmentTracking: true,
    sscc18: false
  },
  menu: (buyer) => [
    { id: 'orders', title: 'Order Management', icon: AssignmentOutlined, to: buyerPath(buyer, 'orders'), access: allowed.workspace },
    { id: 'assign-barcode', title: 'Carton Barcode Assignment', icon: QrCode2Outlined, to: '/assign-barcode', access: allowed.packing },
    { id: 'shipment-planning', title: 'Shipment Planning', icon: LocalShippingOutlined, to: '/sales/shipment-planning', access: allowed.sales },
    { id: 'weight-check', title: 'Weight Check & Dispatch', icon: QrCodeScannerOutlined, to: '/packing/shipments', access: allowed.weight },
    { id: 'tracking', title: 'Shipment Tracking', icon: Inventory2Outlined, to: '/shipment-management', access: allowed.tracking }
  ],
  accessLanding: (buyer) => {
    if (canUseBuyerWorkspace()) return buyerPath(buyer, 'orders');
    if (canAssignBarcode()) return '/assign-barcode';
    if (canWeightCheck()) return '/packing/shipments';
    if (canManageBarcodes()) return '/barcode-management';
    return buyerPath(buyer, 'orders');
  },
  workflow: (buyer) => [
    { owner: 'Sales / Packing', title: 'Orders & Allocation', description: 'Manage the existing ES Order / Allocation workflow.', to: buyerPath(buyer, 'orders'), access: allowed.workspace },
    { owner: 'Packing', title: 'Assign Factory Barcode', description: 'Assign ES Factory Barcode to physical cartons.', to: '/assign-barcode', access: allowed.packing },
    { owner: 'Packing', title: 'Weight Check & Dispatch', description: 'Run ES weight-check and dispatch workflow.', to: '/packing/shipments', access: allowed.weight }
  ]
};

export default esModule;
