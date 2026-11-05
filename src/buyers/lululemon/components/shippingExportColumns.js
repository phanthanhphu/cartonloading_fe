// LULULEMON Shipping Schedule XLSX contract. Keys/labels match PoShippingExportColumns.java.
// Never reuse All POs table-column settings: this is an independent export template.
export const SHIPPING_EXPORT_DEFAULT_COLUMNS = Object.freeze([
  'DC_CODE', 'CHANNEL', 'PO', 'STYLE', 'DESCRIPTION', 'COLOR', 'QTY', 'PCS_CTN',
  'CTNS', 'REMAINDER', 'REMARK', 'SHIP_MODE'
]);

export const SHIPPING_EXPORT_COLUMN_OPTIONS = Object.freeze([
  ['DC_CODE', 'DC Code'], ['CHANNEL', 'Channel'], ['PO', 'PO'], ['STYLE', 'Style'],
  ['DESCRIPTION', 'Description'], ['COLOR', 'Color Description'], ['QTY', 'Qty'],
  ['PCS_CTN', 'Pcs/Ctn'], ['CTNS', 'Ctns'], ['REMAINDER', 'Remainder Qty'],
  ['REMARK', 'Remark'], ['SHIP_MODE', 'Ship Mode'], ['DESTINATION', 'Destination'],
  ['MASTER_PO', 'Master PO'], ['PACKING_PLAN', 'Packing Plan'], ['SALES_ORDER_PTS', 'SO (PTS)'],
  ['SKU', 'SKU'], ['FACTORY', 'Factory'], ['SHIPPING_DATE', 'Shipping Date'],
  ['ORDER', 'Order'], ['STT', 'STT'], ['PLANNED_CARTONS', 'Planned Cartons'],
  ['SEASON', 'Season'], ['FWD', 'FWD'], ['CARTON_BOX_SIZE', 'Carton Box Size'],
  ['NW', 'NW'], ['GW', 'GW'], ['EX_FTY_DATE', 'Ex-Factory Date'],
  ['HOD', 'HOD (Hand over date)'], ['SGS_TESTING', 'SGS testing'],
  ['GB_TESTING', 'GB testing'], ['BV_INSPECTION', 'BV inspection'],
  ['DP_PERCENT', 'DP%'], ['MPR_NUMBER', 'MPR NUMBER'], ['REMARK_2', 'Remark 2']
].map(([key, label]) => Object.freeze({ key, label })));

const allowedKeys = new Set(SHIPPING_EXPORT_COLUMN_OPTIONS.map((option) => option.key));
export const validShippingExportColumns = (keys) => {
  if (!Array.isArray(keys) || !keys.length) return [...SHIPPING_EXPORT_DEFAULT_COLUMNS];
  const seen = new Set();
  const unique = keys.filter((key) => {
    if (typeof key !== 'string' || !allowedKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length ? unique : [...SHIPPING_EXPORT_DEFAULT_COLUMNS];
};
