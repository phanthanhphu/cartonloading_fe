export const BUYER_CODE = Object.freeze({
  LULULEMON: 'LULULEMON',
  ENGELBERT_STRAUSS: 'ENGELBERT_STRAUSS'
});

export const BUYER_CODE_ALIAS = Object.freeze({
  ENGELBERT_STRAUSS_SHORT: 'ES',
  ENGELBERT_STRAUSS_COMPACT: 'ENGELBERTSTRAUSS'
});

export const BUYER_LABEL = Object.freeze({
  [BUYER_CODE.LULULEMON]: 'LULULEMON',
  [BUYER_CODE.ENGELBERT_STRAUSS]: 'ENGELBERT STRAUSS'
});

export const BUYER_MODULE_KEY = Object.freeze({
  BARCODE_PACKING: 'barcode-packing',
  SSCC_PACKING: 'sscc-packing'
});

export const BUYER_API_SEGMENT = Object.freeze({
  [BUYER_CODE.LULULEMON]: 'lululemon'
});

export const ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  ROLE_ADMIN: 'ROLE_ADMIN',
  USER: 'USER'
});

export const ACCESS_PERMISSION = Object.freeze({
  SALES: 'SALES',
  BARCODE_OPERATOR: 'BARCODE_OPERATOR',
  ASSIGN_BARCODE: 'ASSIGN_BARCODE',
  WEIGHT_CHECK: 'WEIGHT_CHECK',
  PRINT_ROOM: 'PRINT_ROOM',
  VIEW_SYSTEM: 'VIEW_SYSTEM'
});


export const ROUTE_PATH = Object.freeze({
  LOGIN: '/login',
  DASHBOARD: '/dashboard'
});

export const OPERATION_ROUTE = Object.freeze({
  ASSIGN_BARCODE: '/assign-barcode',
  SHIPMENT_PLANNING: '/sales/shipment-planning',
  PACKING_SHIPMENTS: '/packing/shipments',
  BARCODE_MANAGEMENT: '/barcode-management',
  SHIPMENT_MANAGEMENT: '/shipment-management',
  SCALE_STATIONS: '/scale-stations'
});

export const STORAGE_KEY = Object.freeze({
  TOKEN: 'token',
  ACCESS_TOKEN: 'accessToken',
  USER: 'user',
  USER_ID: 'userId',
  IS_AUTHENTICATED: 'isAuthenticated',
  ROLE: 'role',
  ACCESS_PERMISSIONS: 'accessPermissions',
  BUYER_PERMISSIONS: 'buyerPermissions',
  FACTORY_PERMISSIONS: 'factoryPermissions',
  SELECTED_BUYER: 'selectedBuyer',
  SELECTED_BUYER_LABEL: 'selectedBuyerLabel',
  LOGIN_AT: 'loginAt',
  BUYER_CATALOG: 'buyerCatalog',
  LOGIN_DRAFT_EMAIL: 'loginDraftEmail',
  LOGIN_DRAFT_PASSWORD: 'loginDraftPassword',
  LOGIN_DRAFT_BUYER: 'loginDraftBuyer',
  WEIGHING_STATION_SSCC: 'lululemon.weight.station'
});

export const AUTH_STORAGE_KEYS = Object.freeze([
  STORAGE_KEY.TOKEN,
  STORAGE_KEY.ACCESS_TOKEN,
  STORAGE_KEY.USER,
  STORAGE_KEY.USER_ID,
  STORAGE_KEY.IS_AUTHENTICATED,
  STORAGE_KEY.ROLE,
  STORAGE_KEY.ACCESS_PERMISSIONS,
  STORAGE_KEY.BUYER_PERMISSIONS,
  STORAGE_KEY.FACTORY_PERMISSIONS,
  STORAGE_KEY.SELECTED_BUYER,
  STORAGE_KEY.SELECTED_BUYER_LABEL,
  STORAGE_KEY.LOGIN_AT
]);

export const ACCESS_PERMISSION_LABEL = Object.freeze({
  [ACCESS_PERMISSION.SALES]: 'Sales',
  [ACCESS_PERMISSION.BARCODE_OPERATOR]: 'Barcode Operator',
  [ACCESS_PERMISSION.ASSIGN_BARCODE]: 'Packing / Assign Barcode',
  [ACCESS_PERMISSION.WEIGHT_CHECK]: 'Weight Check',
  [ACCESS_PERMISSION.PRINT_ROOM]: 'Print Room',
  [ACCESS_PERMISSION.VIEW_SYSTEM]: 'View Only'
});

export const USER_ACCESS_PERMISSIONS = Object.freeze([
  ACCESS_PERMISSION.SALES,
  ACCESS_PERMISSION.BARCODE_OPERATOR,
  ACCESS_PERMISSION.ASSIGN_BARCODE,
  ACCESS_PERMISSION.WEIGHT_CHECK,
  ACCESS_PERMISSION.PRINT_ROOM,
  ACCESS_PERMISSION.VIEW_SYSTEM
]);

export const ADMIN_ACCESS_PERMISSIONS = Object.freeze([
  ACCESS_PERMISSION.SALES,
  ACCESS_PERMISSION.BARCODE_OPERATOR,
  ACCESS_PERMISSION.ASSIGN_BARCODE,
  ACCESS_PERMISSION.WEIGHT_CHECK,
  ACCESS_PERMISSION.PRINT_ROOM
]);

export const ALLOWED_ACCESS_PERMISSIONS = Object.freeze([
  ...ADMIN_ACCESS_PERMISSIONS,
  ACCESS_PERMISSION.VIEW_SYSTEM
]);


export const buyerOrderStorageKey = (buyerCode) => `cartonloading.${String(buyerCode || '').trim().toLowerCase()}.orderId`;
export const buyerPoColumnStorageKey = (buyerCode) => `${String(buyerCode || '').trim().toLowerCase()}.po-master.visible-columns.v2`;
export const buyerWorkspaceColumnStorageKey = (buyerCode) => `cartonloading.${String(buyerCode || '').trim().toLowerCase()}.order-workspace.visible-columns.v1`;

export const DEFAULT_BUYERS = Object.freeze([
  { code: BUYER_CODE.LULULEMON, slug: 'lululemon', label: BUYER_LABEL[BUYER_CODE.LULULEMON], active: true, sequence: 10 },
  { code: BUYER_CODE.ENGELBERT_STRAUSS, slug: 'engelbert-strauss', label: BUYER_LABEL[BUYER_CODE.ENGELBERT_STRAUSS], active: true, sequence: 20 }
]);

export const CARTON_STATUS = Object.freeze({
  READY_TO_PACK: 'READY_TO_PACK',
  PACKING: 'PACKING',
  FINISHED: 'FINISHED',
  LABEL_CONFIRMED: 'LABEL_CONFIRMED',
  READY_TO_SHIP: 'READY_TO_SHIP'
});

export const PURCHASE_ORDER_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  PACKING: 'PACKING',
  WAITING_EX_FTY: 'WAITING_EX_FTY',
  WAITING_LABEL: 'WAITING_LABEL',
  WAITING_SSCC: 'WAITING_SSCC',
  READY_TO_SHIP: 'READY_TO_SHIP'
});

export const PURCHASE_ORDER_STATUS_OPTIONS = Object.freeze(Object.values(PURCHASE_ORDER_STATUS));

export const BARCODE_CARTON_STATUS = Object.freeze({
  PLANNED: 'PLANNED',
  WAITING_WEIGHT: 'WAITING_WEIGHT',
  COMPLETED: 'COMPLETED',
  WEIGHT_WARNING: 'WEIGHT_WARNING',
  PLAN_MISMATCH: 'PLAN_MISMATCH',
  CANCELLED: 'CANCELLED'
});

export const SHIPMENT_STATUS = Object.freeze({
  PREPARING: 'PREPARING',
  PLANNED: 'PLANNED',
  DISPATCHING: 'DISPATCHING',
  SHIPPED: 'SHIPPED',
  CANCELLED: 'CANCELLED'
});

export const SCALE_WEIGHT_STATUS = Object.freeze({
  NOT_WEIGHED: 'NOT_WEIGHED',
  NO_STANDARD: 'NO_STANDARD',
  OK: 'OK',
  UNDER: 'UNDER',
  OVER: 'OVER'
});

export const PROGRESS_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  PLANNED: 'PLANNED',
  DRAFT: 'DRAFT',
  READY: 'READY',
  WAITING: 'WAITING'
});


export const INSPECTION_RESULT = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL'
});

export const COMMON_FILTER = Object.freeze({
  ALL: 'ALL',
  OPEN: 'OPEN',
  DONE: 'DONE',
  UNPLANNED: 'UNPLANNED'
});

export const IMPORT_MODE = Object.freeze({
  CREATE_ONLY: 'CREATE_ONLY',
  UPSERT: 'UPSERT',
  REPLACE_ALL: 'REPLACE_ALL'
});

export const SHIPMENT_LIFECYCLE_STATUS = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  CHECKED: 'CHECKED',
  COMPLETED: 'COMPLETED',
  SHIPPED: 'SHIPPED',
  CANCELLED: 'CANCELLED'
});

export const WEIGHING_RESULT = Object.freeze({
  PASS: 'PASS',
  FAILED: 'FAILED'
});

export const ITEM_STATUS = Object.freeze({
  PENDING: 'PENDING',
  IDENTIFIED: 'IDENTIFIED',
  PASS: 'PASS'
});

export const RFID_STATUS = Object.freeze({
  WAITING_RFID: 'WAITING_RFID',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED'
});

export const PRINT_REQUEST_STATUS = Object.freeze({
  SENT: 'SENT',
  PENDING: 'PENDING',
  PRINTING: 'PRINTING',
  PRINTED_SENT_TO_PACKING: 'PRINTED_SENT_TO_PACKING',
  CANCELLED: 'CANCELLED'
});

export const FACTORY_BARCODE_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  VOID: 'VOID'
});


export const STATUS_COLOR_GROUPS = Object.freeze({
  success: Object.freeze([
    PROGRESS_STATUS.COMPLETED,
    CARTON_STATUS.FINISHED,
    CARTON_STATUS.LABEL_CONFIRMED,
    'PACKED',
    CARTON_STATUS.READY_TO_SHIP,
    'RELEASED',
    INSPECTION_RESULT.PASS,
    'PASSED',
    SCALE_WEIGHT_STATUS.OK,
    FACTORY_BARCODE_STATUS.AVAILABLE,
    'PRINTED',
    PRINT_REQUEST_STATUS.PRINTED_SENT_TO_PACKING,
    SHIPMENT_STATUS.SHIPPED,
    'SUCCESS',
    ITEM_STATUS.IDENTIFIED,
    RFID_STATUS.VERIFIED
  ]),
  info: Object.freeze([
    PROGRESS_STATUS.IN_PROGRESS,
    CARTON_STATUS.PACKING,
    PRINT_REQUEST_STATUS.PRINTING,
    PRINT_REQUEST_STATUS.SENT,
    FACTORY_BARCODE_STATUS.ASSIGNED,
    'RUNNING',
    'SCANNING'
  ]),
  primary: Object.freeze([
    'READY',
    CARTON_STATUS.READY_TO_PACK,
    BARCODE_CARTON_STATUS.PLANNED,
    SHIPMENT_LIFECYCLE_STATUS.CREATED,
    COMMON_FILTER.OPEN
  ]),
  warning: Object.freeze([
    'WAITING',
    PURCHASE_ORDER_STATUS.WAITING_LABEL,
    PURCHASE_ORDER_STATUS.WAITING_SSCC,
    PURCHASE_ORDER_STATUS.WAITING_EX_FTY,
    'WAITING_FOR_WEIGHING',
    BARCODE_CARTON_STATUS.WAITING_WEIGHT,
    ITEM_STATUS.PENDING,
    RFID_STATUS.WAITING_RFID,
    PROGRESS_STATUS.NOT_STARTED,
    PROGRESS_STATUS.DRAFT,
    'UNASSIGNED'
  ]),
  error: Object.freeze([
    SHIPMENT_STATUS.CANCELLED,
    'CANCELED',
    'FAILED',
    INSPECTION_RESULT.FAIL,
    'ERROR',
    FACTORY_BARCODE_STATUS.VOID,
    BARCODE_CARTON_STATUS.WEIGHT_WARNING,
    'WEIGHT_MISMATCH',
    WEIGHING_RESULT.FAILED,
    'REJECTED',
    'WRONG_SKU'
  ])
});

export const WEIGHT_SOURCE = Object.freeze({
  PLC: 'PLC',
  SCALE: 'SCALE',
  MANUAL: 'MANUAL'
});

export const WEIGHT_ACTION = Object.freeze({
  WEIGH: 'WEIGH',
  REOPEN: 'REOPEN',
  OVERRIDE: 'OVERRIDE'
});

export const SCAN_INPUT_MODE = Object.freeze({
  ZEBRA: 'ZEBRA',
  MANUAL: 'MANUAL'
});

export const DEFAULT_PALLET_CODE = 'P01';

export const DEFAULT_TABLE_PAGE_SIZE = 25;
export const DEFAULT_TABLE_ROWS_PER_PAGE = 10;
export const LARGE_TABLE_PAGE_SIZE = 50;
export const LOOKUP_PAGE_SIZE = 100;
export const DEFAULT_BARCODE_GENERATION_QUANTITY = 10;
export const EXCEL_FILE_ACCEPT = '.xlsx,.xls';

export const COMMON_PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50]);

export const LARGE_PAGE_SIZE_OPTIONS = Object.freeze([10, 25, 50, 100]);

export const FACTORY_CODES = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']);

export const REDIRECT_REASON = Object.freeze({
  SESSION_EXPIRED: 'sessionExpired',
  GLOBAL_ERROR: 'globalError'
});

export const DEFAULT_SCALE_STATION = 'SCALE-01';
export const DEFAULT_SCALE_MINIMUM_WEIGHT_KG = '0.50';
export const DEFAULT_SCALE_STABILITY_TOLERANCE_KG = '0.02';

export const API_PATH = Object.freeze({
  BUYERS: '/api/buyers',
  CARTON_LOADING: '/api/carton-loading',
  BARCODE_WORKFLOW_SCALE_STATIONS: '/api/buyers/engelbert-strauss/scale-stations',
  BARCODE_WORKFLOW_FACTORY_BARCODES: '/api/buyers/engelbert-strauss/factory-barcodes'
});

export const CARTON_FINAL_STATUSES = Object.freeze([BARCODE_CARTON_STATUS.COMPLETED, BARCODE_CARTON_STATUS.WEIGHT_WARNING]);
export const PACKING_DONE_STATUSES = Object.freeze([CARTON_STATUS.FINISHED, CARTON_STATUS.LABEL_CONFIRMED, CARTON_STATUS.READY_TO_SHIP]);

export const SHIPMENT_FILTER_STATES = Object.freeze([
  COMMON_FILTER.ALL,
  SHIPMENT_LIFECYCLE_STATUS.CREATED,
  SHIPMENT_LIFECYCLE_STATUS.ASSIGNED,
  SHIPMENT_LIFECYCLE_STATUS.CHECKED,
  SHIPMENT_LIFECYCLE_STATUS.COMPLETED,
  SHIPMENT_LIFECYCLE_STATUS.SHIPPED,
  SHIPMENT_LIFECYCLE_STATUS.CANCELLED
]);

export const DEFAULT_FACTORY_BARCODE_CODE = '002';

export const CODE128_PATTERNS = Object.freeze([
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
  '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
  '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
  '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'
]);


export const ALL_BP_KNOWN_HEADERS = Object.freeze([
  'HOD (Hand over date)', 'SGS testing', 'GB testing', 'BV inspection', 'DC Code', 'Destination', 'Chanel',
  'Master PO', 'PO', 'Packing Plan', 'SO (PTS)', 'Style#', 'Description', 'Color description', "Q'ty", 'Pcs/ctn',
  'lẻ', 'Ctns', 'Dư', 'Remark', 'FOB Price', 'Care & Content Label', 'China Inspection Tag', 'FOB Amount',
  'Total FOB+Prcie Tag', 'FOB Fty Price', 'FOB Fty Amount', 'Ship mode', 'Season', 'DP%', 'MPR NUMBER',
  'FWD', 'Carton Box Size', 'NW', 'GW', 'Remark 2'
]);

export const ALL_BP_SOURCE_ALIAS = Object.freeze({
  HOD: 'HOD', HODHANDOVERDATE: 'HOD', HANDOVERDATE: 'HOD',
  SGSTESTING: 'SGS_TESTING', SGSTEST: 'SGS_TESTING',
  GBTESTING: 'GB_TESTING', GBTEST: 'GB_TESTING',
  BVINSPECTION: 'BV_INSPECTION', BVINSPECT: 'BV_INSPECTION',
  DCCODE: 'DC_CODE', DC: 'DC_CODE',
  DESTINATION: 'DESTINATION', DEST: 'DESTINATION',
  CHANEL: 'CHANNEL', CHANNEL: 'CHANNEL',
  MASTERPO: 'MASTER_PO',
  PO: 'PO', PONO: 'PO', PONUMBER: 'PO', PURCHASEORDER: 'PO',
  PACKINGPLAN: 'PACKING_PLAN', PACKINGPLANNO: 'PACKING_PLAN',
  SOPTS: 'SALES_ORDER_PTS', SO: 'SALES_ORDER_PTS', SALESORDERPTS: 'SALES_ORDER_PTS', SALESORDER: 'SALES_ORDER_PTS',
  STYLE: 'STYLE', STYLENO: 'STYLE', STYLENUMBER: 'STYLE',
  DESCRIPTION: 'DESCRIPTION', DESC: 'DESCRIPTION',
  COLORDESCRIPTION: 'COLOR', COLOR: 'COLOR', COLOURDESCRIPTION: 'COLOR', COLOUR: 'COLOR',
  QTY: 'QTY', QTYTOTAL: 'QTY', TOTALQTY: 'QTY', QUANTITY: 'QTY', ORDERQTY: 'QTY',
  PCSCTN: 'PCS_CTN', PCSPERCTN: 'PCS_CTN', PCSPERCARTON: 'PCS_CTN', QTYPERCTN: 'PCS_CTN', PCSCTNS: 'PCS_CTN', UNITQTY: 'PCS_CTN',
  LE: 'ODD_RATIO',
  CTNS: 'CTNS', CARTONS: 'CTNS', CARTONQTY: 'CTNS', TOTALCARTONS: 'CTNS',
  DU: 'REMAINDER', REMAINDER: 'REMAINDER', REMAINDERQTY: 'REMAINDER', BALANCEQTY: 'REMAINDER', ODDPCS: 'REMAINDER',
  REMARK: 'REMARK',
  FOBPRICE: 'FOB_PRICE',
  CARECONTENTLABEL: 'CARE_CONTENT_LABEL', CAREANDCONTENTLABEL: 'CARE_CONTENT_LABEL',
  CHINAINSPECTIONTAG: 'CHINA_INSPECTION_TAG',
  FOBAMOUNT: 'FOB_AMOUNT',
  TOTALFOBPRCIETAG: 'TOTAL_FOB_PRICE_TAG', TOTALFOBPRICETAG: 'TOTAL_FOB_PRICE_TAG',
  FOBFTYPRICE: 'FOB_FTY_PRICE', FOBFACTORYPRICE: 'FOB_FTY_PRICE',
  FOBFTYAMOUNT: 'FOB_FTY_AMOUNT', FOBFACTORYAMOUNT: 'FOB_FTY_AMOUNT',
  SHIPMODE: 'SHIP_MODE', SHIPPINGMODE: 'SHIP_MODE',
  SEASON: 'SEASON',
  DP: 'DP_PERCENT', DPPERCENT: 'DP_PERCENT',
  MPRNUMBER: 'MPR_NUMBER', MPRNO: 'MPR_NUMBER', MPR: 'MPR_NUMBER',
  FWD: 'FWD', FORWARDER: 'FWD',
  CARTONBOXSIZE: 'CARTON_BOX_SIZE', CARTONSIZE: 'CARTON_BOX_SIZE', BOXSIZE: 'CARTON_BOX_SIZE',
  NW: 'NW', NETWEIGHT: 'NW', NETWEIGHTKG: 'NW',
  GW: 'GW', GROSSWEIGHT: 'GW', GROSSWEIGHTKG: 'GW',
  REMARK2: 'REMARK_2', REMARK02: 'REMARK_2'
});

export const ALL_BP_FORMULA_KEYS = Object.freeze([
  'ODD_RATIO',
  'CTNS',
  'REMAINDER',
  'FOB_AMOUNT',
  'TOTAL_FOB_PRICE_TAG',
  'FOB_FTY_PRICE',
  'FOB_FTY_AMOUNT'
]);

export const ALL_BP_FORMULA_TEXT = Object.freeze({
  ODD_RATIO: '=O/P',
  CTNS: '=ROUNDDOWN(Q,0)',
  REMAINDER: '=O-(R*P)',
  FOB_AMOUNT: '=O*U',
  TOTAL_FOB_PRICE_TAG: '=O*(U+V+W)',
  FOB_FTY_PRICE: '=ROUND((U+V+W)*AD,2)',
  FOB_FTY_AMOUNT: '=O*Z'
});

// English captions used by the LULULEMON UI for the three carton math columns.
// The source Excel headers remain unchanged so ALL_BP import stays compatible.
export const ALL_BP_UI_LABELS = Object.freeze({
  ODD_RATIO: 'Carton Ratio',
  CTNS: 'Full Ctns',
  REMAINDER: 'Remainder Qty'
});

// LULULEMON ALL_BP rows are one logical record only when all 10 business-key
// fields below match. Editing one of these fields propagates to every source row
// in that merged record so the identity cannot become internally inconsistent.
export const ALL_BP_SHARED_KEYS = Object.freeze([
  'DC_CODE',
  'DESTINATION',
  'CHANNEL',
  'MASTER_PO',
  'PO',
  'PACKING_PLAN',
  'SALES_ORDER_PTS',
  'STYLE',
  'DESCRIPTION',
  'COLOR'
]);

export const ALL_BP_IMPORTANT_SOURCE_ORDER = Object.freeze([
  'PO',
  'MASTER_PO',
  'STYLE',
  'DESCRIPTION',
  'COLOR',
  'SIZE',
  'QTY',
  'PCS_CTN',
  'ODD_RATIO',
  'CTNS',
  'REMAINDER',
  'DESTINATION',
  'DC_CODE',
  'CHANNEL',
  'SHIP_MODE',
  'SEASON',
  'FWD'
]);



export const DEFAULT_WORKSPACE_COLUMN_STORAGE_KEY = buyerWorkspaceColumnStorageKey(BUYER_CODE.LULULEMON);

export const WORKSPACE_SYSTEM_COLUMN_DEFINITIONS = Object.freeze([
  Object.freeze({ key: '__stt', label: 'STT', minWidth: 65, group: 'System' }),
  Object.freeze({ key: 'sys:factory', label: 'Factory', minWidth: 90, group: 'System' }),
  Object.freeze({ key: 'sys:sku', label: 'SKU', minWidth: 135, group: 'System' }),
  Object.freeze({ key: 'sys:exFtyDate', label: 'Ex-Factory', minWidth: 110, group: 'System' }),
  Object.freeze({ key: 'sys:status', label: 'Status', minWidth: 110, group: 'System' })
]);

export const WORKSPACE_DEFAULT_COLUMN_KEYS = Object.freeze([
  '__stt', 'src:PO', 'src:MASTER_PO', 'sys:factory', 'src:STYLE', 'src:DESCRIPTION', 'src:COLOR',
  'src:QTY', 'src:PCS_CTN', 'src:ODD_RATIO', 'src:CTNS', 'src:REMAINDER', 'src:DESTINATION', 'sys:sku', 'sys:status'
]);

export const DEFAULT_PO_COLUMN_STORAGE_KEY = buyerPoColumnStorageKey(BUYER_CODE.LULULEMON);

export const PO_SYSTEM_COLUMNS = Object.freeze([
  { key: 'sys:factory', label: 'Factory', group: 'System', minWidth: 100, value: (row) => row.factoryCode || '—' },
  { key: 'sys:sku', label: 'SKU', group: 'System', minWidth: 145, value: (row) => row.sku || '' },
  { key: 'sys:exFtyDate', label: 'Ex-fty Date', group: 'System', minWidth: 115, value: (row) => row.exFtyDate || '—' },
  { key: 'sys:status', label: 'Status', group: 'System', minWidth: 130, status: true }
]);

export const PO_DEFAULT_COLUMN_KEYS = Object.freeze([
  'sys:factory', 'src:PO', 'src:STYLE', 'src:DESTINATION', 'src:QTY', 'src:PCS_CTN', 'src:ODD_RATIO', 'src:CTNS', 'src:REMAINDER',
  'src:SHIP_MODE', 'sys:sku', 'sys:exFtyDate', 'sys:status'
]);

export const PACKING_ORDER_FIELDS = Object.freeze([
  { name: 'orderName', label: 'Order Name', required: true },
  { name: 'orderDate', label: 'Start Order', type: 'date', required: true },
  { name: 'endOrderDate', label: 'End Order', type: 'date', required: true }
]);

export const PACKING_ALLOCATION_FIELDS = Object.freeze([
  { name: 'supplierName', label: 'Supplier name', type: 'text', width: 150 },
  { name: 'supplierNumber', label: 'e.s. Supplier #', type: 'text', width: 120 },
  { name: 'productionFacility', label: 'Production facility', type: 'text', width: 135 },
  { name: 'containerNumber', label: 'Container #', type: 'text', width: 120 },
  { name: 'shipmentMode', label: 'Mode of shipment', type: 'text', width: 135 },
  { name: 'etd', label: 'ETD', type: 'date', width: 110 },
  { name: 'eta', label: 'ETA', type: 'date', width: 110 },
  { name: 'poNumber', label: 'e.s. PO #', type: 'text', required: true, width: 110 },
  { name: 'articleNumber', label: 'e.s. Article #', type: 'text', required: true, width: 125 },
  { name: 'styleNumber', label: 'STYLE#', type: 'text', required: true, width: 110 },
  { name: 'style', label: 'STYLE', type: 'text', required: true, width: 290 },
  { name: 'color', label: 'Color', type: 'text', required: true, width: 150 },
  { name: 'size', label: 'Size', type: 'text', required: true, width: 90 },
  { name: 'qtyPerCarton', label: 'Qty Per Ctn', type: 'number', required: true, width: 110 },
  { name: 'invoiceNumber', label: 'Invoice #', type: 'text', width: 120 },
  { name: 'totalPcs', label: 'Total pcs', type: 'number', required: true, width: 105 },
  { name: 'totalCartons', label: 'Total ctns', type: 'number', required: true, width: 105 },
  { name: 'pcsAir', label: 'Pcs AIR', type: 'number', width: 95 },
  { name: 'cartonsAir', label: 'Ctns AIR', type: 'number', width: 95 },
  { name: 'pcsSea', label: 'Pcs SEA', type: 'number', width: 95 },
  { name: 'cartonsSea', label: 'Ctns SEA', type: 'number', width: 95 },
  { name: 'cbmAir', label: 'CBM AIR', type: 'number', width: 100 },
  { name: 'kgAir', label: 'KG AIR', type: 'number', width: 100 },
  { name: 'status', label: 'STATUS', type: 'text', width: 100 },
  { name: 'openPoQtyOverdel', label: 'Open PO QTY / Overdel', type: 'number', width: 155 },
  { name: 'remarks', label: 'Remarks', type: 'text', width: 170 },
  { name: 'yoLotNumber', label: 'YO Lot#', type: 'text', width: 100 },
  { name: 'hCtn', label: 'H CTN', type: 'number', width: 90 },
  { name: 'cbmCtn', label: 'CBM CTN', type: 'number', width: 100 }
]);

export const PACKING_LIST_FIELDS = Object.freeze([
  { name: 'cartonFrom', label: 'C/T From', type: 'number', width: 95 },
  { name: 'cartonTo', label: 'C/T To', type: 'number', width: 95 },
  { name: 'cartonsQty', label: 'CTNS Qty', type: 'number', required: true, width: 100 },
  { name: 'poNumber', label: 'P.O. #', type: 'text', required: true, width: 115 },
  { name: 'styleNumber', label: 'Style #', type: 'text', required: true, width: 115 },
  { name: 'style', label: 'Style', type: 'text', width: 300 },
  { name: 'articleNumber', label: 'Art.no.', type: 'text', required: true, width: 120 },
  { name: 'color', label: 'Color', type: 'text', required: true, width: 150 },
  { name: 'size', label: 'Size', type: 'text', required: true, width: 105 },
  { name: 'qtyPerCarton', label: 'Qty/CTN', type: 'number', required: true, width: 105 },
  { name: 'totalPcs', label: 'Total PCS', type: 'number', required: true, width: 110 },
  { name: 'cartonMeasurement', label: 'Ctn Meas', type: 'text', width: 145 },
  { name: 'cbm', label: 'CBM', type: 'number', width: 100 },
  { name: 'grossWeightKg', label: 'Gross Weight (kg)', type: 'number', width: 145 },
  { name: 'netWeightKg', label: 'Net Weight (kg)', type: 'number', width: 140 },
  { name: 'actualWeightKg', label: 'Actual Weight (kg)', type: 'number', width: 150 },
  { name: 'remarks', label: 'Remarks', type: 'text', width: 200 }
]);

export const DEFAULT_SCALE_STATION_FORM = Object.freeze({
  stationCode: '',
  stationName: '',
  plcIp: '',
  gatewayIp: '',
  location: '',
  active: true,
  minimumWeightKg: DEFAULT_SCALE_MINIMUM_WEIGHT_KG,
  stabilityToleranceKg: DEFAULT_SCALE_STABILITY_TOLERANCE_KG
});
